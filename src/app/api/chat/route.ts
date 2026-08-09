import { streamText, createDataStreamResponse, formatDataStreamPart } from 'ai';
import { getModel } from '@/lib/ai';
import { getSystemPrompt } from '@/prompts';
import type { ChatMode, ResponseStyle } from '@/types';

// 回答风格指令
const STYLE_INSTRUCTIONS: Record<Exclude<ResponseStyle, 'custom'>, string> = {
  default: '',
  balanced: '\n\n【回答风格】回答保持适中：兼顾要点完整与简洁可读，避免冗长，也不过度精简，不使用过多表情符号。',
  concise: '\n\n【回答风格】回答必须极其精简：只给核心要点，不说废话，不用客套语，不使用任何表情符号和多余修饰，能一句说清绝不用两句。',
};

/** 直接调用 DashScope 流式 API（支持 enable_search）并转换为 Vercel AI SDK data stream 格式 */
async function streamWithWebSearch(params: {
  messages: any[];
  system: string;
  apiKey: string;
}) {
  const { messages, system, apiKey } = params;
  const baseURL = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = process.env.QWEN_MODEL || 'qwen-plus';

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      stream: true,
      stream_options: { include_usage: true },
      enable_search: true,
      search_options: { forced_search: true },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DashScope API error ${res.status}: ${errText}`);
  }

  // 将 OpenAI SSE 流转换为 Vercel AI SDK data stream 格式
  return createDataStreamResponse({
    execute: async (dataStream) => {
      // 发送联网搜索开始事件
      dataStream.writeData({ type: 'web-search', status: 'searching' });

      const reader = res.body?.getReader();
      if (!reader) { dataStream.writeData({ type: 'error', message: 'No response body' }); return; }
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
              // 检测 usage chunk（最后一个 chunk）获取搜索 token 信息
              if (parsed.usage && !searchDone) {
                const promptTokens = parsed.usage.prompt_tokens || 0;
                // 搜索结果的 token 数 = prompt_tokens - 原始消息估算 tokens
                // 用 prompt_tokens 大小估算搜索源数量（每个源约 300-500 tokens）
                const estimatedSources = Math.max(1, Math.round((promptTokens - 200) / 400));
                dataStream.writeData({ type: 'web-search', status: 'done', sources: estimatedSources });
                searchDone = true;
              }
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                // 第一个文本 chunk 到达时，如果还没发搜索完成事件，发送一个
                if (!searchDone) {
                  dataStream.writeData({ type: 'web-search', status: 'done', sources: 0 });
                  searchDone = true;
                }
                dataStream.write(formatDataStreamPart('text', delta));
              }
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        reader.releaseLock();
        if (!searchDone) {
          dataStream.writeData({ type: 'web-search', status: 'done', sources: 0 });
        }
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const { messages, mode, style, customStyleText, context, apiKey, webSearch } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '消息不能为空' }, { status: 400 });
    }

    const key = apiKey || process.env.QWEN_API_KEY;
    if (!key) {
      return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });
    }

    let systemPrompt = getSystemPrompt(mode as ChatMode, context);

    // 追加回答风格指令
    const styleKey = (style as ResponseStyle) || 'default';
    if (styleKey === 'custom') {
      const custom = (customStyleText || '').trim();
      if (custom) {
        systemPrompt += `\n\n【回答风格】请严格按照以下风格要求回答：${custom}`;
      }
    } else if (STYLE_INSTRUCTIONS[styleKey]) {
      systemPrompt += STYLE_INSTRUCTIONS[styleKey];
    }

    // 注入选中节点上下文
    if (context?.selectedNode) {
      const summaryPart = context.selectedNode.summary ? `\n【AI 摘要】${context.selectedNode.summary}` : '';
      systemPrompt += `\n\n【当前上下文】用户正在查看的知识节点是「${context.selectedNode.title}」，其内容为：\n${context.selectedNode.content?.slice(0, 2000) || '（无内容）'}${summaryPart}\n请基于此上下文回答用户的问题。`;
    }

    // 联网搜索：直接调用 DashScope API（绕过 SDK 参数白名单限制）
    if (webSearch) {
      return streamWithWebSearch({ messages, system: systemPrompt, apiKey: key });
    }

    // 普通模式：使用 Vercel AI SDK streamText
    const model = getModel(key);
    if (!model) {
      return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json({ error: 'AI 服务暂时不可用' }, { status: 500 });
  }
}
