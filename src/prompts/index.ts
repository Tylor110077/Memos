import { learnPrompt } from './learn';
import { feynmanPrompt } from './feynman';
import { debatePrompt } from './debate';
import { designPrompt } from './design';
import type { ChatMode } from '@/types';

export function getSystemPrompt(mode: ChatMode, context?: { currentNodeTitle?: string }): string {
  const prompts: Record<ChatMode, string> = {
    learn: learnPrompt,
    feynman: feynmanPrompt,
    debate: debatePrompt,
    design: designPrompt,
  };

  let prompt = prompts[mode];

  if (context?.currentNodeTitle) {
    prompt += `\n\n当前用户正在学习的知识节点是："${context.currentNodeTitle}"，请围绕这个主题进行对话。`;
  }

  return prompt;
}
