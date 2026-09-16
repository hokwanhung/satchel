import type { Flashcard } from './types';

const BOM = '\uFEFF';
const TAB = '\t';

export function escapeTsvField(field: string): string {
  const escaped = field.replace(/"/g, '""');
  if (/[\t\n\r"]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function cardsToTsv(cards: Flashcard[]): string {
  return cards
    .map((card) => `${escapeTsvField(card.front)}${TAB}${escapeTsvField(card.back)}`)
    .join('\n');
}

export function cardsToTsvWithBom(cards: Flashcard[]): string {
  return BOM + cardsToTsv(cards);
}

export function createTsvBlob(cards: Flashcard[]): Blob {
  return new Blob([cardsToTsvWithBom(cards)], { type: 'text/csv;charset=utf-8' });
}
