import type { Block, Inline, ReportDocument } from './report';

const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const CRC_TABLE = buildCrcTable();

export function buildDocx(report: ReportDocument): Uint8Array {
  const rendered = renderDocument(report.blocks);
  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: xml(contentTypes(rendered.numbering)) },
    { name: '_rels/.rels', data: xml(packageRels()) },
    { name: 'word/document.xml', data: xml(rendered.document) },
    { name: 'word/styles.xml', data: xml(stylesXml()) },
    { name: 'word/_rels/document.xml.rels', data: xml(documentRels(rendered)) },
  ];
  if (rendered.numbering) {
    files.push({ name: 'word/numbering.xml', data: xml(rendered.numbering) });
  }
  return storeZip(files);
}

export function createDocxBlob(report: ReportDocument): Blob {
  const bytes = buildDocx(report);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

interface RenderedDocument {
  document: string;
  numbering: string | null;
  hyperlinks: string[];
}

function renderDocument(blocks: Block[]): RenderedDocument {
  const hyperlinks: string[] = [];
  const numDefs: string[] = [];
  let numId = 1;
  const body: string[] = [];

  for (const block of blocks) {
    if (block.type === 'heading') {
      body.push(paragraphXml(block.inlines, hyperlinks, { style: `Heading${block.level}` }));
    } else if (block.type === 'paragraph') {
      body.push(paragraphXml(block.inlines, hyperlinks));
    } else if (block.type === 'rule') {
      body.push(ruleXml());
    } else if (block.type === 'list') {
      const id = numId;
      numId += 1;
      const abstractId = block.ordered ? 1 : 0;
      numDefs.push(`<w:num w:numId="${id}"><w:abstractNumId w:val="${abstractId}"/></w:num>`);
      for (const item of block.items) {
        body.push(paragraphXml(item, hyperlinks, { numId: id }));
      }
    } else {
      body.push(tableXml(block, hyperlinks));
    }
  }

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body.join('')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return {
    document,
    numbering: numDefs.length > 0 ? numberingXml(numDefs) : null,
    hyperlinks,
  };
}

function paragraphXml(
  inlines: Inline[],
  hyperlinks: string[],
  opts: { style?: string; numId?: number } = {},
): string {
  const props: string[] = [];
  if (opts.style) props.push(`<w:pStyle w:val="${opts.style}"/>`);
  if (opts.numId) {
    props.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.numId}"/></w:numPr>`);
  }
  const pPr = props.length > 0 ? `<w:pPr>${props.join('')}</w:pPr>` : '';
  return `<w:p>${pPr}${runsXml(inlines, hyperlinks)}</w:p>`;
}

function runsXml(inlines: Inline[], hyperlinks: string[]): string {
  return inlines
    .map((inline) => {
      const run = `<w:r>${runProps(inline)}<w:t xml:space="preserve">${xmlEscape(inline.text)}</w:t></w:r>`;
      if (!inline.href) return run;
      const id = `rIdLink${hyperlinks.length + 1}`;
      hyperlinks.push(inline.href);
      return `<w:hyperlink r:id="${id}">${run}</w:hyperlink>`;
    })
    .join('');
}

function runProps(inline: Inline): string {
  const props: string[] = [];
  if (inline.href) props.push('<w:rStyle w:val="Hyperlink"/>');
  if (inline.bold) props.push('<w:b/>');
  if (inline.italic) props.push('<w:i/>');
  return props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';
}

function ruleXml(): string {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>`;
}

function tableXml(block: Extract<Block, { type: 'table' }>, hyperlinks: string[]): string {
  const rows = block.rows
    .map((row, index) => {
      const header = block.header && index === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
      const cells = row
        .map((cell) => {
          const content = cell.length > 0 ? cell : [{ text: '' }];
          return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraphXml(content, hyperlinks)}</w:tc>`;
        })
        .join('');
      return `<w:tr>${header}${cells}</w:tr>`;
    })
    .join('');

  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>${rows}</w:tbl>`;
}

function numberingXml(numDefs: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  ${numDefs.join('')}
</w:numbering>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  ${headingStyle(1, '32', '0')}
  ${headingStyle(2, '28', '1')}
  ${headingStyle(3, '24', '2')}
  ${headingStyle(4, '22', '3')}
  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>
  </w:style>
</w:styles>`;
}

function headingStyle(level: number, size: string, outline: string): string {
  return `<w:style w:type="paragraph" w:styleId="Heading${level}">
    <w:name w:val="heading ${level}"/>
    <w:basedOn w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr><w:outlineLvl w:val="${outline}"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr>
  </w:style>`;
}

function contentTypes(numbering: string | null): string {
  const numberingOverride = numbering
    ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  ${numberingOverride}
</Types>`;
}

function packageRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function documentRels(rendered: RenderedDocument): string {
  const rels = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
  ];
  if (rendered.numbering) {
    rels.push(
      '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    );
  }
  rendered.hyperlinks.forEach((href, index) => {
    rels.push(
      `<Relationship Id="rIdLink${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(href)}" TargetMode="External"/>`,
    );
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.join('')}
</Relationships>`;
}

function xml(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function xmlEscape(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function storeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals = new ByteWriter();
  const entries: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const offset = locals.length;
    locals.u32(0x04034b50);
    locals.u16(20);
    locals.u16(0);
    locals.u16(0);
    locals.u16(DOS_TIME);
    locals.u16(DOS_DATE);
    locals.u32(crc);
    locals.u32(file.data.length);
    locals.u32(file.data.length);
    locals.u16(name.length);
    locals.u16(0);
    locals.raw(name);
    locals.raw(file.data);
    entries.push({ name, crc, size: file.data.length, offset });
  }

  const central = new ByteWriter();
  for (const entry of entries) {
    central.u32(0x02014b50);
    central.u16(20);
    central.u16(20);
    central.u16(0);
    central.u16(0);
    central.u16(DOS_TIME);
    central.u16(DOS_DATE);
    central.u32(entry.crc);
    central.u32(entry.size);
    central.u32(entry.size);
    central.u16(entry.name.length);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u32(0);
    central.u32(entry.offset);
    central.raw(entry.name);
  }

  const centralOffset = locals.length;
  const end = new ByteWriter();
  end.u32(0x06054b50);
  end.u16(0);
  end.u16(0);
  end.u16(entries.length);
  end.u16(entries.length);
  end.u32(central.length);
  end.u32(centralOffset);
  end.u16(0);

  const out = new Uint8Array(locals.length + central.length + end.length);
  out.set(locals.bytes(), 0);
  out.set(central.bytes(), locals.length);
  out.set(end.bytes(), locals.length + central.length);
  return out;
}

class ByteWriter {
  private readonly parts: Uint8Array[] = [];
  private size = 0;

  get length(): number {
    return this.size;
  }

  u16(value: number): void {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setUint16(0, value, true);
    this.raw(buf);
  }

  u32(value: number): void {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, value >>> 0, true);
    this.raw(buf);
  }

  raw(data: Uint8Array): void {
    this.parts.push(data);
    this.size += data.length;
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.size);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }
}

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i] ?? 0;
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
