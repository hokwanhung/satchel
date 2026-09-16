import type { ExtractResult, Flashcard } from './types';

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function parseFlashcards(raw: unknown): Flashcard[] {
  const root = asRecord(raw);
  if (!root) return [];

  const list = Array.isArray(root.flashcards)
    ? root.flashcards
    : Array.isArray(root.cards)
      ? root.cards
      : [];

  const cards: Flashcard[] = [];
  for (const item of list) {
    const record = asRecord(item);
    if (!record) continue;
    const front = stringField(record, 'f', 'front', 'question', 'q');
    const back = stringField(record, 'b', 'back', 'answer', 'a');
    if (front.length === 0 && back.length === 0) continue;
    cards.push({ front, back });
  }
  return cards;
}

export function parseAppData(raw: string): ExtractResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeEntities(trimmed));
  } catch {
    return null;
  }

  const cards = parseFlashcards(parsed);
  if (cards.length === 0) {
    const root = asRecord(parsed);
    if (root && Array.isArray(root.quiz)) {
      return { kind: 'quiz', cards: [], raw: parsed };
    }
    return { kind: 'unknown', cards: [], raw: parsed };
  }

  return { kind: 'flashcards', cards, raw: parsed };
}

export function readAppDataAttribute(
  root: ParentNode = document,
): { node: Element; data: string } | null {
  const nodes = root.querySelectorAll('[data-app-data], app-root');
  for (const node of nodes) {
    const data = node.getAttribute('data-app-data');
    if (data) return { node, data };
  }
  return null;
}

export function shouldHandleAppData(raw: string, lastRaw: string): boolean {
  return raw.length > 0 && raw !== lastRaw;
}

export function extractFromDocument(doc: Document = document): ExtractResult | null {
  const found = readAppDataAttribute(doc);
  if (!found) return null;
  const result = parseAppData(found.data);
  if (result && (result.cards.length > 0 || result.kind === 'quiz')) {
    return result;
  }
  return null;
}
