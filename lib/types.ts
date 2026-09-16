export interface Flashcard {
  front: string;
  back: string;
}

export type ArtifactKind = 'flashcards' | 'quiz' | 'unknown';

export interface ExtractResult {
  kind: ArtifactKind;
  cards: Flashcard[];
  raw: unknown;
}

export const SATCHEL_MESSAGE = 'SATCHEL_NOTEBOOKLM_DATA';
export const SATCHEL_ROOT_ID = 'satchel-export-root';
