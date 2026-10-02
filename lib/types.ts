import type { MindMapNode } from './mindmap';

export interface Flashcard {
  front: string;
  back: string;
}

export type ArtifactKind = 'flashcards' | 'quiz' | 'mindmap' | 'unknown';

export interface ExtractResult {
  kind: ArtifactKind;
  cards: Flashcard[];
  raw: unknown;
  mindMap?: MindMapNode;
}

export const SATCHEL_MESSAGE = 'SATCHEL_NOTEBOOKLM_DATA';
export const SATCHEL_ROOT_ID = 'satchel-export-root';
export const SATCHEL_REPORT_ROOT_ID = 'satchel-report-root';
export const SATCHEL_MINDMAP_ROOT_ID = 'satchel-mindmap-root';
