import { streamText } from 'ai';
import { getModel } from '@/lib/ai';
import { getSystemPrompt } from '@/prompts';
import type { ChatMode, ResponseStyle } from '@/types';

// 回答风格指令
const STYLE_INSTRUCTIONS: Record<Exclude<ResponseStyle, 'custom'>, string> = {
  default: '',
  balanced: '\n\n【回答风格】回答保持适中：兼顾要点完整与简洁可读，避免冗长，也不过度精简，不使用过多表情符号。',
  concise: '\n\n【回答风格】回答必须极其精简：只给核心要点，不说废话，不用客套语，不使用任何表情符号和多余修饰，能一句说清绝不用两句。',
};

export async function POST(req: Request) {
  try {
    const { messages, mode, style, customStyleText, context } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '消息不能为空' }, { status: 400 });
    }

    let systemPrompt = getSystemPrompt(mode as ChatMode, context);

    // 追加回答风格指令（自定义风格直接使用用户文本）
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
      systemPrompt += `\n\n【当前上下文】用户正在查看的知识节点是「${context.selectedNode.title}」，其内容为：\n${context.selectedNode.content?.slice(0, 2000) || '（无内容）'}\n请基于此上下文回答用户的问题。`;
    }

    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json({ error: 'AI 服务暂时不可用' }, { status: 500 });
  }
}
