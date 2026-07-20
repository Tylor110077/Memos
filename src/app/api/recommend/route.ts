import { generateObject } from 'ai';
import { getModel } from '@/lib/ai';
import { recommendationSchema } from '@/schemas';

export async function POST(req: Request) {
  try {
    const { currentNode, graph, type } = await req.json();

    if (type === 'related') {
      const existingTitles = graph?.nodes?.map((n: { title: string }) => n.title).join(', ') || '';
      const notesText = currentNode?.notes?.length
        ? `\n用户在该知识点上的笔记：${currentNode.notes.join('；')}`
        : '';
      const result = await generateObject({
        model: getModel(),
        schema: recommendationSchema,
        prompt: `用户正在学习“${currentNode?.title || '未知'}”，内容是：${currentNode?.content || ''}${notesText}
用户已学过的知识：${existingTitles}

推荐 3-5 个与当前知识相关、但用户尚未学习的延伸方向。
不要推荐用户已经学过的内容。
每个推荐说明为什么跟当前知识有关。`,
      });
      return Response.json(result.object);
    }

    if (type === 'breakthrough') {
      const domains = graph?.nodes?.map((n: { title: string }) => n.title).join(', ') || '';
      const result = await generateObject({
        model: getModel(),
        schema: recommendationSchema,
        prompt: `用户的知识图谱主要覆盖：${domains}

推荐 3 个内容，混合以下两种类型：
1. 知识类（1-2个）：与用户已有知识完全无关的有趣学科/概念
2. 趣闻类（1-2个）：历史上或现代的有趣冷知识、奇闻轶事（如“19世纪有个胖子俱乐部”、“章鱼有三颗心脏”、“Cleopatra 生活的时间距离月球登陆比距离金字塔建造更近”）

每个推荐标注 category: 'knowledge' 或 'trivia'。
趣闻要真正有趣、出人意料，不要太常见。`,
      });
      return Response.json(result.object);
    }

    return Response.json({ error: '无效的推荐类型' }, { status: 400 });
  } catch (error) {
    console.error('Recommend error:', error);
    return Response.json({ error: '推荐生成失败' }, { status: 500 });
  }
}
