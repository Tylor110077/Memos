import { generateObject } from 'ai';
import { getModel } from '@/lib/ai';
import { graphParseSchema } from '@/schemas';

export async function POST(req: Request) {
  try {
    const { conversation, existingNodes } = await req.json();

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return Response.json({ error: '对话内容不能为空' }, { status: 400 });
    }

    const conversationText = conversation
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const existingNodesText = existingNodes && existingNodes.length > 0
      ? existingNodes.map((n: { id: string; title: string }) => `- ${n.title}`).join('\n')
      : '（暂无已有节点）';

    const result = await generateObject({
      model: getModel(),
      schema: graphParseSchema,
      prompt: `分析以下对话，提取其中的知识点结构。

已有节点列表（避免重复创建）：
${existingNodesText}

对话内容：
${conversationText}

请输出：
1. newNodes: 对话中新出现的知识点（不在已有列表中的）
2. updatedNodes: 需要补充内容的已有节点
3. newEdges: 节点间的关系

对于每个新节点，判断其 level：
- 如果是一个大领域 → level 0
- 如果是主题分类 → level 1
- 如果是子主题 → level 2
- 如果是具体知识点 → level 3+

对于每条边，判断类型：
- hierarchy: 上下级/包含关系
- association: 相关/类比/对比关系
- reference: 引用/来源关系

注意：只提取明确的知识点，不要过度拆分。一次对话通常产生 1-5 个节点。`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Graph parse error:', error);
    return Response.json({ error: '图谱解析失败' }, { status: 500 });
  }
}
