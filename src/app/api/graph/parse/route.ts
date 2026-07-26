import { generateObject } from 'ai';
import { getModel } from '@/lib/ai';
import { graphParseSchema } from '@/schemas';

export async function POST(req: Request) {
  try {
    const { conversation, existingNodes, apiKey } = await req.json();

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return Response.json({ error: '对话内容不能为空' }, { status: 400 });
    }

    const model = getModel(apiKey);
    if (!model) return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });

    const conversationText = conversation
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const existingNodesText = existingNodes && existingNodes.length > 0
      ? existingNodes.map((n: { id: string; title: string }) => `- ${n.title}`).join('\n')
      : '（暂无已有节点）';

    const result = await generateObject({
      model,
      schema: graphParseSchema,
      prompt: `分析以下对话，找出已有节点之间的关系。

已有节点列表：
${existingNodesText}

对话内容：
${conversationText}

请输出：
1. newNodes: 留空数组（不创建新节点）
2. updatedNodes: 需要补充内容的已有节点（可选）
3. newEdges: 已有节点之间的关系（重点）

对于每条边，判断类型：
- hierarchy: 上下级/包含关系
- association: 相关/类比/对比关系
- reference: 引用/来源关系

注意：
- 只连接已有节点列表中的节点，不要创建新节点
- 只提取明确的关系，不要过度连接
- sourceTitle 和 targetTitle 必须精确匹配已有节点列表中的标题`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Graph parse error:', error);
    return Response.json({ error: '图谱解析失败' }, { status: 500 });
  }
}
