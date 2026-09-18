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

function optionLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function parseOptions(record: Record<string, unknown>): { text: string; correct: boolean }[] {
  const list = Array.isArray(record.answerOptions)
    ? record.answerOptions
    : Array.isArray(record.options)
      ? record.options
      : Array.isArray(record.answers)
        ? record.answers
        : [];

  const options: { text: string; correct: boolean }[] = [];
  for (const item of list) {
    const option = asRecord(item);
    if (!option) continue;
    const text = stringField(option, 'text', 't', 'option');
    if (text.length === 0) continue;
    options.push({
      text,
      correct: option.isCorrect === true || option.correct === true,
    });
  }
  return options;
}

function formatQuizCard(record: Record<string, unknown>): Flashcard | null {
  const question = stringField(record, 'question', 'q', 'prompt');
  const options = parseOptions(record);
  if (question.length === 0 && options.length === 0) return null;

  const labeled = options.map((option, index) => `${optionLetter(index)}. ${option.text}`);
  const front = [question, ...labeled].filter((part) => part.length > 0).join('\n');

  const correct = options.flatMap((option, index) =>
    option.correct ? [`${optionLetter(index)}. ${option.text}`] : [],
  );
  const rationale = stringField(record, 'rationale', 'explanation');
  const back = [correct.join('\n'), rationale].filter((part) => part.length > 0).join('\n\n');

  if (front.length === 0 && back.length === 0) return null;
  return { front, back };
}

function quizItems(raw: unknown): unknown[] | null {
  const root = asRecord(raw);
  if (!root) return null;
  if (Array.isArray(root.quiz)) return root.quiz;
  if (Array.isArray(root.questions)) return root.questions;
  return null;
}

function parseQuiz(items: unknown[]): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const item of items) {
    const record = asRecord(item);
    if (!record) continue;
    const card = formatQuizCard(record);
    if (card) cards.push(card);
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
  if (cards.length > 0) {
    return { kind: 'flashcards', cards, raw: parsed };
  }

  const items = quizItems(parsed);
  if (items) {
    return { kind: 'quiz', cards: parseQuiz(items), raw: parsed };
  }

  return { kind: 'unknown', cards: [], raw: parsed };
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
