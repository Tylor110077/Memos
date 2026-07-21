import { generateObject } from 'ai';
import { getModel } from '@/lib/ai';
import { nodeSplitSchema } from '@/schemas';

export async function POST(req: Request) {
  try {
    const { node, instruction, connectedEdges, apiKey } = await req.json();

    if (!node || !instruction) {
      return Response.json({ error: '节点和指令不能为空' }, { status: 400 });
    }

    const model = getModel(apiKey);
    if (!model) return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });

    const edgesText = connectedEdges?.length > 0
      ? connectedEdges.map((e: { id: string; source: string; target: string; relation: string }) =>
          `- [${e.id}] ${e.source} → ${e.target} (${e.relation})`
        ).join('\n')
      : '（无外部连接）';

    const result = await generateObject({
      model,
      schema: nodeSplitSchema,
      prompt: `用户想拆分知识节点"${node.title}"。
当前内容：${node.content}
用户指示：${instruction}

当前节点的外部连接：
${edgesText}

请将其拆分为多个独立子节点，并说明：
1. 每个新节点的标题和内容
2. 新节点之间的关系（newEdges）
3. 原来的外部连接应该分配给哪个新节点（edgeReassignment）`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Node split error:', error);
    return Response.json({ error: '节点分化失败' }, { status: 500 });
  }
}
