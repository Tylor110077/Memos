import type { NodeTypes } from '@xyflow/react';
import { ConceptNode } from './ConceptNode';
import { ThemeNode } from './ThemeNode';
import { MaterialNode } from './MaterialNode';
import { UnderstandingNode } from './UnderstandingNode';
import { QuestionNode } from './QuestionNode';

export { ConceptNode, ThemeNode, MaterialNode, UnderstandingNode, QuestionNode };

export const nodeTypes: NodeTypes = {
  concept: ConceptNode,
  theme: ThemeNode,
  material: MaterialNode,
  understanding: UnderstandingNode,
  question: QuestionNode,
};
