import { streamText } from 'ai';
import { getModel } from '@/lib/ai';
import { getSystemPrompt } from '@/prompts';
import type { ChatMode } from '@/types';

export async function POST(req: Request) {
  try {
    const { messages, mode, context } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '消息不能为空' }, { status: 400 });
    }

    let systemPrompt = getSystemPrompt(mode as ChatMode, context);

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
