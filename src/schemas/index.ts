import { z } from 'zod';

export const graphParseSchema = z.object({
  newNodes: z.array(z.object({
    title: z.string().describe('知识点标题'),
    content: z.string().describe('知识点内容摘要'),
    type: z.enum(['concept', 'theme', 'material', 'understanding', 'question']).describe('节点类型'),
    level: z.number().min(0).max(5).describe('层级：0=领域,1=主题,2=子主题,3+=知识点'),
    relatedNodeTitles: z.array(z.string()).describe('与之相关的已有节点标题'),
  })),
  updatedNodes: z.array(z.object({
    title: z.string().describe('要更新的已有节点标题'),
    additionalContent: z.string().describe('要追加的内容'),
  })),
  newEdges: z.array(z.object({
    sourceTitle: z.string().describe('源节点标题'),
    targetTitle: z.string().describe('目标节点标题'),
    relation: z.string().describe('关系描述'),
    type: z.enum(['hierarchy', 'association', 'reference']).describe('边类型'),
  })),
});

export const domainGraphSchema = z.object({
  nodes: z.array(z.object({
    title: z.string(),
    content: z.string(),
    type: z.enum(['concept', 'theme']),
    level: z.number().min(0).max(4),
  })),
  edges: z.array(z.object({
    sourceTitle: z.string(),
    targetTitle: z.string(),
    relation: z.string(),
    type: z.enum(['hierarchy', 'association']),
  })),
});

export const recommendationSchema = z.object({
  recommendations: z.array(z.object({
    title: z.string(),
    description: z.string(),
    reason: z.string(),
    category: z.enum(['knowledge', 'trivia']).optional(),
  })),
});

export const nodeSplitSchema = z.object({
  newNodes: z.array(z.object({
    title: z.string(),
    content: z.string(),
    type: z.enum(['concept', 'theme', 'material', 'understanding', 'question']),
    level: z.number(),
  })),
  newEdges: z.array(z.object({
    sourceTitle: z.string(),
    targetTitle: z.string(),
    relation: z.string(),
    type: z.enum(['hierarchy', 'association', 'reference']),
  })),
  edgeReassignment: z.array(z.object({
    originalEdgeId: z.string(),
    newSourceTitle: z.string().optional(),
    newTargetTitle: z.string().optional(),
  })),
});

export type GraphParseResult = z.infer<typeof graphParseSchema>;
export type DomainGraphResult = z.infer<typeof domainGraphSchema>;
export type RecommendationResult = z.infer<typeof recommendationSchema>;
export type NodeSplitResult = z.infer<typeof nodeSplitSchema>;
