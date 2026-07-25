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
    const { conversation, nodeContent, notes, apiKey } = await req.json();

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return Response.json({ error: '对话内容不能为空' }, { status: 400 });
    }

    const model = getModel(apiKey);
    if (!model) return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });

    // 只提取用户的发言（不看 AI 回复，避免 AI 的回答影响判定）
    const userMessages = conversation
      .filter((m: { role: string }) => m.role === 'user')
      .map((m: { content: string }) => m.content)
      .join('\n\n');

    const notesText = notes?.length
      ? `\n【用户的手动笔记】\n${notes.join('\n---\n')}`
      : '';

    const result = await generateObject({
      model,
      schema: evaluateSchema,
      prompt: `你是一个严格的认知评审专家。你的任务是评估用户对知识点的真实理解程度。

重要原则：
- 只根据用户自己的表述（发言和笔记）来判定，不要参考 AI 的回答
- 如果用户只是在提问、表达困惑、或者说“我不懂”，那应该判定为低分
- 只有用户能用自己的话正确解释概念时，才给高分
- 宁可严格，不可宽松

【节点原始内容（用户应该理解的知识）】
${nodeContent?.slice(0, 2000) || '（无）'}

【用户的发言（费曼对话中用户说的话）】
${userMessages || '（无发言）'}
${notesText}

【评分标准（5 档制）】
1 = 未理解：用户没有尝试解释，只是在提问或表达困惑
2 = 模糊：用户尝试解释但逻辑混乱、有重大错误、或只是复述关键词
3 = 基本：用户能用自己的话解释主要概念，但细节有误或遗漏
4 = 清晰：用户能准确解释且能举例，仅有极小瑕疵
5 = 精通：用户能深入浅出、举一反三、指出边界条件

请返回 level（1-5 整数）、reason（一句话评价理由）、knowledgePoints（用户已掌握/未掌握的知识点列表）。`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('认知评审失败:', error);
    return Response.json({ error: '评审失败' }, { status: 500 });
  }
}
