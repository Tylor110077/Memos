/**
 * 直调 API 层（direct 模式）
 * 在无 Next.js 服务端时（桌面应用离线包），于客户端直接调用 Qwen API，
 * 复刻所有 API Routes 的逻辑，返回与 server 模式完全一致的 Response 格式。
 *
 * server 模式下 apiFetch 直接透传给原生 fetch，行为不变。
 */
import { streamText, generateObject, generateText, createDataStreamResponse, formatDataStreamPart } from 'ai';
import { z } from 'zod';
import { getModel, getVLModel } from '@/lib/ai';
import { getSystemPrompt } from '@/prompts';
import {
  graphParseSchema,
  domainGraphSchema,
  recommendationSchema,
  nodeSplitSchema,
} from '@/schemas';
import { isDirectMode } from '@/lib/env';
import type { ChatMode, ResponseStyle } from '@/types';

// 回答风格指令（与 server 保持一致）
const STYLE_INSTRUCTIONS: Record<Exclude<ResponseStyle, 'custom'>, string> = {
  default: '',
  balanced: '\n\n【回答风格】回答保持适中：兼顾要点完整与简洁可读，避免冗长，也不过度精简，不使用过多表情符号。',
  concise: '\n\n【回答风格】回答必须极其精简：只给核心要点，不说废话，不用客套语，不使用任何表情符号和多余修饰，能一句说清绝不用两句。',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function parseBody(init?: RequestInit): Record<string, any> {
  try {
    if (init?.body && typeof init.body === 'string') return JSON.parse(init.body);
  } catch { /* ignore */ }
  return {};
}

/** 将媒体（图片/视频帧）附加到最后一条用户消息，构成多模态 content */
function attachMediaToLastUser(messages: any[], dataUrls: string[], kind?: string): any[] {
  const out = [...messages];
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].role === 'user') {
      const text = typeof out[i].content === 'string' ? out[i].content : '';
      const parts: any[] = dataUrls.map((url) => ({ type: 'image_url', image_url: { url } }));
      const hint = kind === 'video' ? '（以下是视频的关键帧）' : '';
      parts.push({ type: 'text', text: `${hint}${text}` });
      out[i] = { ...out[i], content: parts };
      break;
    }
  }
  return out;
}

// ===== /api/chat（流式） =====
async function handleChat(body: Record<string, any>, signal?: AbortSignal): Promise<Response> {
  const { messages, mode, style, customStyleText, context, apiKey, webSearch } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) return json({ error: '消息不能为空' }, 400);
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);

  let systemPrompt = getSystemPrompt(mode as ChatMode, context);
  const styleKey = (style as ResponseStyle) || 'default';
  if (styleKey === 'custom') {
    const custom = (customStyleText || '').trim();
    if (custom) systemPrompt += `\n\n【回答风格】请严格按照以下风格要求回答：${custom}`;
  } else if (STYLE_INSTRUCTIONS[styleKey]) {
    systemPrompt += STYLE_INSTRUCTIONS[styleKey];
  }
  if (context?.selectedNode) {
    const summaryPart = context.selectedNode.summary ? `\n【AI 摘要】${context.selectedNode.summary}` : '';
    systemPrompt += `\n\n【当前上下文】用户正在查看的知识节点是「${context.selectedNode.title}」，其内容为：\n${context.selectedNode.content?.slice(0, 2000) || '（无内容）'}${summaryPart}\n请基于此上下文回答用户的问题。`;
  }

  // 多模态：节点带图片/视频帧时，用视觉模型并把媒体随最后一条用户消息传入
  const media = context?.media as { kind?: string; dataUrls?: string[] } | undefined;
  if (media?.dataUrls?.length) {
    const vlModel = getVLModel(apiKey);
    if (!vlModel) return json({ error: '请先在设置中配置 API Key' }, 400);
    const mmMessages = attachMediaToLastUser(messages, media.dataUrls, media.kind);
    const result = streamText({ model: vlModel, system: systemPrompt, messages: mmMessages as any, abortSignal: signal });
    return result.toDataStreamResponse();
  }

  // 联网搜索：直调 DashScope
  if (webSearch) {
    const baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const modelName = 'qwen-plus';
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
        stream_options: { include_usage: true },
        enable_search: true,
        search_options: { forced_search: true },
      }),
      signal,
    });
    if (!res.ok) return json({ error: `AI 服务错误 ${res.status}` }, 500);
    return createDataStreamResponse({
      execute: async (dataStream) => {
        dataStream.writeData({ type: 'web-search', status: 'searching' });
        const reader = res.body?.getReader();
        if (!reader) { dataStream.writeData({ type: 'web-search', status: 'done', sources: 0 }); return; }
        const decoder = new TextDecoder();
        let buffer = '';
        let searchDone = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.usage && !searchDone) {
                  const est = Math.max(1, Math.round(((parsed.usage.prompt_tokens || 0) - 200) / 400));
                  dataStream.writeData({ type: 'web-search', status: 'done', sources: est });
                  searchDone = true;
                }
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  if (!searchDone) { dataStream.writeData({ type: 'web-search', status: 'done', sources: 0 }); searchDone = true; }
                  dataStream.write(formatDataStreamPart('text', delta));
                }
              } catch { /* skip */ }
            }
          }
        } finally {
          reader.releaseLock();
          if (!searchDone) dataStream.writeData({ type: 'web-search', status: 'done', sources: 0 });
        }
      },
    });
  }

  const result = streamText({ model, system: systemPrompt, messages, abortSignal: signal });
  return result.toDataStreamResponse();
}

// ===== /api/graph/parse =====
async function handleGraphParse(body: Record<string, any>): Promise<Response> {
  const { conversation, existingNodes, apiKey } = body;
  if (!conversation || !Array.isArray(conversation) || conversation.length === 0) return json({ error: '对话内容不能为空' }, 400);
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);
  const conversationText = conversation.map((m: any) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n\n');
  const existingNodesText = existingNodes?.length ? existingNodes.map((n: any) => `- ${n.title}`).join('\n') : '（暂无已有节点）';
  const result = await generateObject({
    model,
    schema: graphParseSchema,
    prompt: `分析以下对话，找出已有节点之间的关系。\n\n已有节点列表：\n${existingNodesText}\n\n对话内容：\n${conversationText}\n\n请输出：\n1. newNodes: 对话中新出现的知识点\n2. updatedNodes: 需要补充内容的已有节点\n3. newEdges: 节点间的关系`,
  });
  return json(result.object);
}

// ===== /api/graph/themes =====
const themeSchema = z.object({
  themes: z.array(z.object({
    title: z.string(),
    content: z.string(),
    childNodeTitles: z.array(z.string()),
  })),
});
async function handleThemes(body: Record<string, any>): Promise<Response> {
  const { nodes, scope, apiKey } = body;
  const isSelected = scope === 'selected';
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);
  const candidateNodes = isSelected ? nodes : (nodes || []).filter((n: any) => n.type === 'concept');
  const minCount = isSelected ? 2 : 3;
  if (candidateNodes.length < minCount) return json({ themes: [] });
  const nodesText = candidateNodes.map((n: any) => `- ${n.title}: ${n.content?.slice(0, 100) || ''}`).join('\n');
  const result = await generateObject({
    model,
    schema: themeSchema,
    prompt: `分析以下知识点列表，识别其中可以归纳为主题分组的节点。\n\n知识点列表：\n${nodesText}\n\n规则：\n- 只有当 ${minCount} 个或以上节点在语义上明确相关时，才归纳为一个主题\n- 主题名称应简洁（2-6个字）\n- 不要强行分组\n- 一个节点可以属于多个主题\n- 最多生成 3 个主题\n- 【重要】childNodeTitles 中的每个标题必须与列表中的节点标题逐字完全一致`,
  });
  return json(result.object);
}

// ===== /api/evaluate =====
const evaluateSchema = z.object({ level: z.number().min(1).max(5), reason: z.string(), knowledgePoints: z.array(z.string()) });
async function handleEvaluate(body: Record<string, any>): Promise<Response> {
  const { conversation, nodeContent, notes, apiKey } = body;
  if (!conversation || !Array.isArray(conversation) || conversation.length === 0) return json({ error: '对话内容不能为空' }, 400);
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);
  const userMessages = conversation.filter((m: any) => m.role === 'user').map((m: any) => m.content).join('\n\n');
  const notesText = notes?.length ? `\n【用户的手动笔记】\n${notes.join('\n---\n')}` : '';
  const result = await generateObject({
    model,
    schema: evaluateSchema,
    prompt: `你是一个严格的认知评审专家。评估用户对知识点的真实理解程度。\n\n【节点原始内容】\n${nodeContent?.slice(0, 2000) || '（无）'}\n\n【用户的发言】\n${userMessages || '（无发言）'}\n${notesText}\n\n请返回 level（1-5）、reason、knowledgePoints。`,
  });
  return json(result.object);
}

// ===== /api/explain =====
async function handleExplain(body: Record<string, any>): Promise<Response> {
  const { text, apiKey } = body;
  if (!text) return json({ error: '内容不能为空' }, 400);
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);
  const { text: result } = await generateText({
    model,
    prompt: `请用以下格式简要解释用户选中的内容。\n\n**{术语} 简要解析**\n\n**单词拆分**\n将单词拆解为词根/前缀/后缀\n\n**核心含义**\n用2-3句话解释\n\n**简单一句话**\n用一句大白话总结\n\n---\n\n用户选中的内容：${text}`,
  });
  return json({ explanation: result });
}

// ===== /api/recommend =====
async function handleRecommend(body: Record<string, any>): Promise<Response> {
  const { currentNode, graph, type, apiKey } = body;
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);
  if (type === 'related') {
    const existingTitles = graph?.nodes?.map((n: any) => n.title).join(', ') || '';
    const result = await generateObject({
      model,
      schema: recommendationSchema,
      prompt: `用户正在学习“${currentNode?.title || '未知'}”，内容是：${currentNode?.content || ''}\n用户已学过的知识：${existingTitles}\n\n推荐 3-5 个相关但尚未学习的延伸方向。`,
    });
    return json(result.object);
  }
  const domains = graph?.nodes?.map((n: any) => n.title).join(', ') || '';
  const result = await generateObject({
    model,
    schema: recommendationSchema,
    prompt: `用户的知识图谱主要覆盖：${domains}\n\n推荐 3 个内容，混合知识类和趣闻类，每个标注 category。`,
  });
  return json(result.object);
}

// ===== /api/domain =====
async function handleDomain(body: Record<string, any>): Promise<Response> {
  const { domain, depth = 3, apiKey } = body;
  if (!domain || typeof domain !== 'string') return json({ error: '领域名称不能为空' }, 400);
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);
  const result = await generateObject({
    model,
    schema: domainGraphSchema,
    prompt: `为"${domain}"领域生成一个多层级知识图谱结构。层级深度：${depth} 层。`,
  });
  return json(result.object);
}

// ===== /api/summarize =====
async function handleSummarize(body: Record<string, any>): Promise<Response> {
  const { content, title, apiKey } = body;
  if (!content) return json({ error: '内容不能为空' }, 400);
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);
  const result = await generateObject({
    model,
    schema: z.object({ summary: z.string() }),
    prompt: `请为以下知识内容生成一段简洁的中文摘要（2-3句话）：\n\n标题：${title}\n内容：${content.slice(0, 3000)}`,
  });
  return json(result.object);
}

// ===== /api/node/split =====
async function handleSplit(body: Record<string, any>): Promise<Response> {
  const { node, instruction, connectedEdges, apiKey } = body;
  if (!node || !instruction) return json({ error: '节点和指令不能为空' }, 400);
  const model = getModel(apiKey);
  if (!model) return json({ error: '请先在设置中配置 API Key' }, 400);
  const edgesText = connectedEdges?.length
    ? connectedEdges.map((e: any) => `- [${e.id}] ${e.source} → ${e.target} (${e.relation})`).join('\n')
    : '（无外部连接）';
  const result = await generateObject({
    model,
    schema: nodeSplitSchema,
    prompt: `用户想拆分知识节点"${node.title}"。\n当前内容：${node.content}\n用户指示：${instruction}\n\n当前节点的外部连接：\n${edgesText}\n\n请将其拆分为多个独立子节点。`,
  });
  return json(result.object);
}

// ===== /api/scrape（直调模式受 CORS 限制） =====
async function handleScrape(body: Record<string, any>): Promise<Response> {
  const { url } = body;
  if (!url) return json({ error: 'URL 不能为空' }, 400);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Studyboard/0.0.2)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // 简单提取（无 cheerio，用 DOMParser）
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());
    const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title || url;
    const content = (doc.querySelector('article')?.textContent || doc.querySelector('main')?.textContent || doc.body?.textContent || '')
      .replace(/\s+/g, ' ').trim().slice(0, 5000);
    let favicon = doc.querySelector('link[rel="icon"]')?.getAttribute('href') || '';
    try { favicon = favicon.startsWith('http') ? favicon : new URL(favicon || '/favicon.ico', url).href; } catch { favicon = ''; }
    return json({ title: title.trim(), favicon, content });
  } catch {
    return json({ error: '网页抓取失败（桌面离线模式可能受跨域限制）' }, 500);
  }
}

// ===== 路由分发 =====
const handlers: Record<string, (body: Record<string, any>, signal?: AbortSignal) => Promise<Response>> = {
  '/api/chat': handleChat,
  '/api/graph/parse': handleGraphParse,
  '/api/graph/themes': handleThemes,
  '/api/evaluate': handleEvaluate,
  '/api/explain': handleExplain,
  '/api/recommend': handleRecommend,
  '/api/domain': handleDomain,
  '/api/summarize': handleSummarize,
  '/api/node/split': handleSplit,
  '/api/scrape': handleScrape,
};

/**
 * 统一 fetch 入口
 * - server 模式：透传原生 fetch
 * - direct 模式：拦截 /api/* 并在客户端处理
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!isDirectMode()) {
    return fetch(input, init);
  }
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.startsWith('http') ? new URL(url).pathname : url;
  const handler = handlers[path];
  if (!handler) {
    return json({ error: `直调模式不支持的接口: ${path}` }, 404);
  }
  try {
    return await handler(parseBody(init), init?.signal ?? undefined);
  } catch (error) {
    console.error(`[directApi] ${path} error:`, error);
    return json({ error: 'AI 服务暂时不可用' }, 500);
  }
}
