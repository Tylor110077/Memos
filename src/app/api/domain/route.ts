import { generateObject } from 'ai';
import { getModel } from '@/lib/ai';
import { domainGraphSchema } from '@/schemas';

export async function POST(req: Request) {
  try {
    const { domain, depth = 3 } = await req.json();

    if (!domain || typeof domain !== 'string') {
      return Response.json({ error: '领域名称不能为空' }, { status: 400 });
    }

    const result = await generateObject({
      model: getModel(),
      schema: domainGraphSchema,
      prompt: `为"${domain}"领域生成一个多层级知识图谱结构。

要求：
- 层级深度：${depth} 层
- 第 0 层：领域本身（1个节点）
- 第 1 层：主要主题（3-6 个）
- 第 2 层：子主题（每个主题下 2-4 个）
- 第 3 层：具体知识点（每个子主题下 2-5 个）
- 包含主题间的交叉关联（association 类型的边）
- 每个节点附带一句话描述作为 content
- 层级关系用 hierarchy 类型的边表示`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Domain generation error:', error);
    return Response.json({ error: '领域图谱生成失败' }, { status: 500 });
  }
}
