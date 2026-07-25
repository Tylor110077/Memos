import { generateObject } from 'ai';
import { getModel } from '@/lib/ai';
import { z } from 'zod';

const evaluateSchema = z.object({
  level: z.number().min(1).max(5),
  reason: z.string(),
  knowledgePoints: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    const { conversation, nodeContent, apiKey } = await req.json();

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return Response.json({ error: '对话内容不能为空' }, { status: 400 });
    }

    const model = getModel(apiKey);
    if (!model) return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });

    const conversationText = conversation
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const result = await generateObject({
      model,
      schema: evaluateSchema,
      prompt: `你是一个认知评审专家。请根据以下费曼学习对话，评估用户对知识点的理解程度。

【节点原始内容】
${nodeContent?.slice(0, 2000) || '（无）'}

【费曼对话记录】
${conversationText}

【评分标准（5 档制）】
1 = 未理解：无法用自己的话解释核心概念，回答与主题无关或完全错误
2 = 模糊：能提及部分关键词但逻辑混乱，存在重大理解错误
3 = 基本：能正确解释主要概念，但细节有误或遗漏重要部分
4 = 清晰：能准确解释且能举例说明，仅有极小瑕疵
5 = 精通：能深入浅出、举一反三、指出边界条件和例外情况

请返回 level（1-5 整数）、reason（一句话评价理由）、knowledgePoints（用户已掌握/未掌握的知识点列表）。`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('认知评审失败:', error);
    return Response.json({ error: '评审失败' }, { status: 500 });
  }
}
