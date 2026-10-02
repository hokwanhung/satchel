import { describe, expect, it } from 'vitest';
import { reportToMarkdown } from '../lib/markdown';
import { reportFileStem, type ReportDocument } from '../lib/report';

const report: ReportDocument = {
  title: 'Briefing Doc',
  blocks: [
    { type: 'heading', level: 1, inlines: [{ text: 'Overview' }] },
    {
      type: 'paragraph',
      inlines: [
        { text: 'Water moves by ' },
        { text: 'osmosis', bold: true },
        { text: ' [1, 2].' },
      ],
    },
    {
      type: 'list',
      ordered: false,
      items: [[{ text: 'First point' }], [{ text: 'Second point', italic: true }]],
    },
    {
      type: 'table',
      header: true,
      rows: [
        [[{ text: 'A' }], [{ text: 'B | C' }]],
        [[{ text: '1' }], [{ text: '2' }]],
      ],
    },
    { type: 'rule' },
    {
      type: 'paragraph',
      inlines: [{ text: 'example', href: 'https://example.com/a' }],
    },
    {
      type: 'list',
      ordered: true,
      items: [[{ text: 'One' }], [{ text: 'Two' }]],
    },
  ],
};

describe('reportToMarkdown', () => {
  it('writes headings, lists, tables, links, and citations', () => {
    expect(reportToMarkdown(report)).toBe(`# Overview

Water moves by **osmosis** [1, 2].

- First point
- *Second point*

| A | B \\| C |
| --- | --- |
| 1 | 2 |

---

[example](https://example.com/a)

1. One
2. Two
`);
  });
});

describe('reportFileStem', () => {
  it('keeps a readable title and strips file-name characters', () => {
    expect(reportFileStem('Briefing Doc')).toBe('Briefing Doc');
    expect(reportFileStem('A/B: C')).toBe('A B C');
    expect(reportFileStem('   ')).toBe('Report');
  });
});
