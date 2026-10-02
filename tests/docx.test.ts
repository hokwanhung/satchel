import { describe, expect, it } from 'vitest';
import { buildDocx } from '../lib/docx';
import type { ReportDocument } from '../lib/report';

const report: ReportDocument = {
  title: 'Briefing Doc',
  blocks: [
    { type: 'heading', level: 1, inlines: [{ text: 'Overview' }] },
    {
      type: 'paragraph',
      inlines: [{ text: 'A & B ' }, { text: 'osmosis', bold: true }],
    },
    {
      type: 'list',
      ordered: false,
      items: [[{ text: 'First point' }]],
    },
    {
      type: 'paragraph',
      inlines: [{ text: 'example', href: 'https://example.com/a' }],
    },
  ],
};

describe('buildDocx', () => {
  it('packs a Word document with the heading and list item', () => {
    const files = unzipStored(buildDocx(report));
    const documentXml = files.get('word/document.xml') ?? '';
    const rels = files.get('word/_rels/document.xml.rels') ?? '';

    expect(files.has('[Content_Types].xml')).toBe(true);
    expect(files.has('word/styles.xml')).toBe(true);
    expect(files.has('word/numbering.xml')).toBe(true);
    expect(documentXml).toContain('Overview');
    expect(documentXml).toContain('First point');
    expect(documentXml).toContain('<w:b/>');
    expect(documentXml).toContain('A &amp; B');
    expect(documentXml).toContain('w:val="Heading1"');
    expect(rels).toContain('https://example.com/a');
    expect(rels).toContain('TargetMode="External"');
  });
});

function unzipStored(bytes: Uint8Array): Map<string, string> {
  const files = new Map<string, string>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    if (method !== 0) throw new Error(`expected a stored zip entry for ${name}`);
    files.set(name, new TextDecoder().decode(bytes.subarray(dataStart, dataStart + size)));
    offset = dataStart + size;
  }

  return files;
}
