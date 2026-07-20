import { generateObject } from 'ai';
import { getModel } from '@/lib/ai';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { content, title } = await req.json();
    if (!content) return Response.json({ error: '内容不能为空' }, { status: 400 });

    const result = await generateObject({
      model: getModel(),
      schema: z.object({ summary: z.string() }),
      prompt: `请为以下知识内容生成一段简洁的中文摘要（2-3句话）：

标题：${title}
内容：${content.slice(0, 3000)}`,
    });

    return Response.json(result.object);
  } catch (error) {
    return Response.json({ error: '摘要生成失败' }, { status: 500 });
  }
}
