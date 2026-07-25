import { generateText } from 'ai';
import { getModel } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { text, apiKey } = await req.json();
    if (!text) return Response.json({ error: '内容不能为空' }, { status: 400 });

    const model = getModel(apiKey);
    if (!model) return Response.json({ error: '请先在设置中配置 API Key' }, { status: 400 });

    const { text: result } = await generateText({
      model,
      prompt: `请用以下格式简要解释用户选中的内容。要求：用最简单直白的语言，帮助用户快速理解。

格式要求：
**{术语} 简要解析**

**单词拆分**（如果是英文术语）
将单词拆解为词根/前缀/后缀，用中文标注含义

**核心含义**
用2-3句话解释这个概念在当前领域中最常用的含义

**简单一句话**
用一句大白话总结

---

用户选中的内容：${text}`,
    });

    return Response.json({ explanation: result });
  } catch (error) {
    console.error('解释失败:', error);
    return Response.json({ error: '解释失败' }, { status: 500 });
  }
}
