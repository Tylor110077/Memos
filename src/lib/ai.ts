import { createOpenAI } from '@ai-sdk/openai';

export const qwen = createOpenAI({
  baseURL: process.env.QWEN_BASE_URL,
  apiKey: process.env.QWEN_API_KEY,
});

export const getModel = () => qwen(process.env.QWEN_MODEL || 'qwen-plus-3.7');
