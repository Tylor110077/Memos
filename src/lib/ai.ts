import { createOpenAI } from '@ai-sdk/openai';

/**
 * 获取 Qwen 模型实例
 * @param apiKey 前端传入的 API Key，优先使用；若为空则 fallback 到环境变量
 */
export function getModel(apiKey?: string) {
  const key = apiKey || process.env.QWEN_API_KEY;
  if (!key) return null;
  const provider = createOpenAI({
    baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: key,
  });
  return provider(process.env.QWEN_MODEL || 'qwen-plus');
}
