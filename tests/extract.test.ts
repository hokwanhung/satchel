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

  it('maps quiz options onto Anki front/back rows', () => {
    const result = parseAppData(
      JSON.stringify({
        quiz: [
          {
            question: 'What is 2+2?',
            hint: 'Think simple',
            rationale: 'Addition of two twos.',
            answerOptions: [
              { text: '3', isCorrect: false },
              { text: '4', isCorrect: true },
            ],
          },
        ],
      }),
    );
    expect(result?.kind).toBe('quiz');
    expect(result?.cards).toEqual([
      {
        front: 'What is 2+2?\nA. 3\nB. 4',
        back: 'B. 4\n\nAddition of two twos.',
      },
    ]);
  });

  it('accepts quiz aliases and skips empty items', () => {
    const result = parseAppData(
      JSON.stringify({
        questions: [
          {},
          {
            prompt: 'Closest planet?',
            options: [
              { t: 'Venus', correct: false },
              { option: 'Mercury', correct: true },
            ],
            explanation: 'Mercury is nearest the Sun.',
          },
          {
            q: 'Two answers',
            answers: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: true },
            ],
          },
        ],
      }),
    );
    expect(result?.kind).toBe('quiz');
    expect(result?.cards).toEqual([
      {
        front: 'Closest planet?\nA. Venus\nB. Mercury',
        back: 'B. Mercury\n\nMercury is nearest the Sun.',
      },
      {
        front: 'Two answers\nA. A\nB. B',
        back: 'A. A\nB. B',
      },
    ]);
  });

  it('keeps quiz kind when items have no correct option', () => {
    const result = parseAppData(
      JSON.stringify({
        quiz: [{ question: 'Q', answerOptions: [{ text: 'A', isCorrect: false }] }],
      }),
    );
    expect(result?.kind).toBe('quiz');
    expect(result?.cards).toEqual([{ front: 'Q\nA. A', back: '' }]);
  });

  it('decodes HTML entities in quiz payloads', () => {
    const result = parseAppData(
      '{"quiz":[{"question":"A &amp; B","answerOptions":[{"text":"ok","isCorrect":true}]}]}',
    );
    expect(result?.cards[0]).toEqual({ front: 'A & B\nA. ok', back: 'A. ok' });
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
