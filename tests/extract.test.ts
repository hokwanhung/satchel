import { describe, expect, it } from 'vitest';
import { parseAppData, shouldHandleAppData } from '../lib/extract';

describe('parseAppData', () => {
  it('reads NotebookLM {f,b} flashcards', () => {
    const result = parseAppData(
      JSON.stringify({
        flashcards: [
          { f: 'What is osmosis?', b: 'Movement of water' },
          { f: '\\sin(x)', b: '\\frac{a}{b}' },
        ],
      }),
    );
    expect(result?.kind).toBe('flashcards');
    expect(result?.cards).toEqual([
      { front: 'What is osmosis?', back: 'Movement of water' },
      { front: '\\sin(x)', back: '\\frac{a}{b}' },
    ]);
  });

  it('accepts front/back aliases', () => {
    const result = parseAppData(
      JSON.stringify({
        cards: [{ front: 'Q', back: 'A' }],
      }),
    );
    expect(result?.cards).toEqual([{ front: 'Q', back: 'A' }]);
  });

  it('decodes HTML entities in the attribute payload', () => {
    const result = parseAppData('{"flashcards":[{"f":"A &amp; B","b":"ok"}]}');
    expect(result?.cards[0]).toEqual({ front: 'A & B', back: 'ok' });
  });

  it('marks quiz payloads without inventing cards', () => {
    const result = parseAppData(
      JSON.stringify({
        quiz: [{ question: 'Q', answerOptions: [{ text: 'A', isCorrect: true }] }],
      }),
    );
    expect(result?.kind).toBe('quiz');
    expect(result?.cards).toEqual([]);
  });

  it('returns null for invalid JSON', () => {
    expect(parseAppData('not-json')).toBeNull();
  });
});

describe('shouldHandleAppData', () => {
  it('skips empty and unchanged payloads', () => {
    expect(shouldHandleAppData('', '')).toBe(false);
    expect(shouldHandleAppData('{"flashcards":[]}', '{"flashcards":[]}')).toBe(false);
    expect(shouldHandleAppData('{"flashcards":[{"f":"Q","b":"A"}]}', '')).toBe(true);
  });
});
