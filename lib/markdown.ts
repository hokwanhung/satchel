import type { Block, Inline, ReportDocument } from './report';

export function reportToMarkdown(report: ReportDocument): string {
  const parts: string[] = [];
  for (const block of report.blocks) {
    const rendered = renderBlock(block);
    if (rendered) parts.push(rendered);
  }
  if (parts.length === 0) return '';
  return `${parts.join('\n\n')}\n`;
}

export function createMarkdownBlob(report: ReportDocument): Blob {
  return new Blob([reportToMarkdown(report)], { type: 'text/markdown;charset=utf-8' });
}

function renderBlock(block: Block): string {
  if (block.type === 'heading') {
    return `${'#'.repeat(block.level)} ${renderInlines(block.inlines)}`;
  }
  if (block.type === 'paragraph') return renderInlines(block.inlines);
  if (block.type === 'rule') return '---';
  if (block.type === 'list') {
    return block.items
      .map((item, index) => {
        const marker = block.ordered ? `${index + 1}. ` : '- ';
        return marker + renderInlines(item);
      })
      .join('\n');
  }
  return renderTable(block.rows);
}

function renderTable(rows: Inline[][][]): string {
  const normalized = rows.map((row) => row.map((cell) => renderInlines(cell, true)));
  const width = normalized.reduce((max, row) => Math.max(max, row.length), 0);
  const header = normalized[0];
  if (!header || width === 0) return '';

  const pad = (row: string[]) => {
    const cells = [...row];
    while (cells.length < width) cells.push('');
    return `| ${cells.join(' | ')} |`;
  };

  const lines = [pad(header), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`];
  for (const row of normalized.slice(1)) lines.push(pad(row));
  return lines.join('\n');
}

function renderInlines(inlines: Inline[], cell = false): string {
  return inlines.map((inline) => renderInline(inline, cell)).join('');
}

function renderInline(inline: Inline, cell: boolean): string {
  let text = escapeMd(inline.text);
  if (cell) text = text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  if (inline.bold && inline.italic) text = `***${text}***`;
  else if (inline.bold) text = `**${text}**`;
  else if (inline.italic) text = `*${text}*`;
  if (!inline.href) return text;
  const href = inline.href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
  return `[${text}](${href})`;
}

function escapeMd(text: string): string {
  return text.replace(/[\\`*_{}]/g, '\\$1');
}
