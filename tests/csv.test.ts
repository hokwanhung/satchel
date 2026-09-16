import { describe, expect, it } from 'vitest';
import { cardsToTsv, cardsToTsvWithBom, escapeTsvField } from '../lib/csv';

describe('escapeTsvField', () => {
  it('leaves plain text alone', () => {
    expect(escapeTsvField('hello')).toBe('hello');
  });

  it('quotes tabs, newlines, and quotes', () => {
    expect(escapeTsvField('a\tb')).toBe('"a\tb"');
    expect(escapeTsvField('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeTsvField('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('cardsToTsv', () => {
  it('joins front and back with tabs', () => {
    expect(
      cardsToTsv([
        { front: 'Q1', back: 'A1' },
        { front: 'Q2', back: 'A2' },
      ]),
    ).toBe('Q1\tA1\nQ2\tA2');
  });

  it('preserves LaTeX', () => {
    const tsv = cardsToTsv([{ front: '\\sin(x)', back: '\\frac{a}{b}' }]);
    expect(tsv).toBe('\\sin(x)\t\\frac{a}{b}');
  });

  it('prefixes UTF-8 BOM for Excel/Anki', () => {
    const withBom = cardsToTsvWithBom([{ front: 'Q', back: 'A' }]);
    expect(withBom.startsWith('\uFEFF')).toBe(true);
    expect(withBom.slice(1)).toBe('Q\tA');
  });
});
