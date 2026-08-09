import { getModel } from '@/lib/ai';

const VL_MODEL = process.env.QWEN_VL_MODEL || 'qwen-vl-plus';

const SUMMARY_PROMPT =
  '你是一个知识整理助手。请理解用户提供的{media}内容，产出一段 100-200 字的中文摘要，提炼核心知识点。只输出摘要，不要其他内容。';

export async function POST(req: Request) {
  try {
    const { type, dataUrls, text, title, apiKey } = await req.json();
    const key = apiKey || process.env.QWEN_API_KEY;
    if (!key) return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });

    const baseURL = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

    // 文件类型：文本送普通模型
    if (type === 'file') {
      const model = getModel(key);
      if (!model) return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });
      const { generateText } = await import('ai');
      const { text: summary } = await generateText({
        model,
        prompt: `${SUMMARY_PROMPT.replace('{media}', '文档')}\n\n文档标题：${title || ''}\n文档内容：\n${(text || '').slice(0, 6000)}`,
      });
      return Response.json({ summary });
    }

    // 图片/视频：多模态内容送 vl 模型
    const mediaLabel = type === 'video' ? '视频（关键帧）' : '图片';
    const content: Array<Record<string, unknown>> = [];
    for (const url of dataUrls || []) {
      content.push({ type: 'image_url', image_url: { url } });
    }
    content.push({ type: 'text', text: SUMMARY_PROMPT.replace('{media}', mediaLabel) + (title ? `\n标题：${title}` : '') });

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: VL_MODEL, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `多模态理解失败 ${res.status}: ${err.slice(0, 200)}` }, { status: 500 });
    }
    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content || '';
    return Response.json({ summary });
  } catch (error) {
    console.error('Understand error:', error);
    return Response.json({ error: '理解失败' }, { status: 500 });
  }
}
