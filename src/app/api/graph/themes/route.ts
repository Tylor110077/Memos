import { generateObject } from 'ai';
import { getModel } from '@/lib/ai';
import { z } from 'zod';

const themeSchema = z.object({
  themes: z.array(z.object({
    title: z.string().describe('主题名称'),
    content: z.string().describe('主题简述'),
    childNodeTitles: z.array(z.string()).describe('属于该主题的已有节点标题'),
  })),
});

export async function POST(req: Request) {
  try {
    const { nodes, scope, apiKey } = await req.json();
    const isSelected = scope === 'selected';

    const model = getModel(apiKey);
    if (!model) return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });

    // 'selected' 模式：用户已明确选中要分组的节点，全部参与，≥2 即可
    // 'all' 模式：只分析 concept 类型，≥3 才归纳
    const candidateNodes = isSelected
      ? nodes
      : nodes.filter((n: { type: string }) => n.type === 'concept');
    const minCount = isSelected ? 2 : 3;

    if (candidateNodes.length < minCount) {
      return Response.json({ themes: [] });
    }

    const nodesText = candidateNodes
      .map((n: { title: string; content: string }) => `- ${n.title}: ${n.content?.slice(0, 100) || ''}`)
      .join('\n');

    const result = await generateObject({
      model,
      schema: themeSchema,
      prompt: `分析以下知识点列表，识别其中可以归纳为主题分组的节点。

知识点列表：
${nodesText}

规则：
- 只有当 ${minCount} 个或以上节点在语义上明确相关时，才归纳为一个主题
- 主题名称应简洁（2-6个字），如"LLM基础"、"排序算法"、"概率论"
- 不要强行分组，如果节点之间没有明显关联就不归纳
- 一个节点可以属于多个主题
- 最多生成 3 个主题
- 【重要】childNodeTitles 中的每个标题必须与上方列表中的节点标题逐字完全一致，不要改写、截断或翻译`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Theme generation error:', error);
    return Response.json({ error: '主题生成失败' }, { status: 500 });
  }
}
