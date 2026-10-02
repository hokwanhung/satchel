export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; inlines: Inline[] }
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'table'; header: boolean; rows: Inline[][][] }
  | { type: 'rule' };

export interface ReportDocument {
  title: string;
  blocks: Block[];
}

type Kind =
  | 'container'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'paragraph'
  | 'list-item'
  | 'list'
  | 'ordered-list'
  | 'table'
  | 'rule';

interface Marks {
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

const VIEWER_SELECTOR = 'artifact-viewer, labs-tailwind-doc-viewer';
const TITLE_SELECTOR = '[class*="artifact-title"], [class*="artifactTitle"], .source-title';

export function reportFileStem(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'Report';
}

export function inlinePlain(inlines: Inline[]): string {
  return inlines.map((inline) => inline.text).join('');
}

export function extractReport(doc: Document): ReportDocument | null {
  return findBestReport(doc)?.report ?? null;
}

/** Footer of the open report, or the viewer itself when it has no footer. */
export function reportBarHost(doc: Document): HTMLElement | null {
  const found = findBestReport(doc);
  if (!found || !(found.viewer instanceof HTMLElement)) return null;
  const footer = [...found.viewer.querySelectorAll('.artifact-footer, footer')].find(
    (el) => el instanceof HTMLElement,
  );
  return footer instanceof HTMLElement ? footer : found.viewer;
}

function findBestReport(doc: Document): { report: ReportDocument; viewer: Element } | null {
  let best: { report: ReportDocument; viewer: Element } | null = null;
  let bestScore = 0;

  for (const viewer of findViewerRoots(doc)) {
    const body = findBody(viewer);
    const blocks = blocksFrom(body);
    if (blocks.length === 0) continue;
    const report = { title: readTitle(viewer, body, blocks), blocks };
    const score = textLength(blocks) + (hasFooter(viewer) ? 10_000 : 0);
    if (!best || score > bestScore) {
      best = { report, viewer };
      bestScore = score;
    }
  }

  return best;
}

function findViewerRoots(doc: Document): Element[] {
  const primary = [...doc.querySelectorAll(VIEWER_SELECTOR)].filter(
    (el) => !isInSourceViewer(el) && !isNestedViewer(el) && !isSkippable(el),
  );
  if (primary.length > 0) return primary;

  return [...doc.querySelectorAll('.elements-container')].filter(
    (el) => !isInSourceViewer(el) && !looksLikeChat(el) && !isSkippable(el),
  );
}

function isNestedViewer(el: Element): boolean {
  const parent = el.parentElement;
  if (!parent) return false;
  return parent.closest(VIEWER_SELECTOR) !== null;
}

function isInSourceViewer(el: Element): boolean {
  return el.closest('source-viewer') !== null;
}

function looksLikeChat(el: Element): boolean {
  let current: Element | null = el;
  while (current) {
    if (current.tagName.toLowerCase().includes('chat')) return true;
    const cls = current.getAttribute('class') || '';
    if (/(?:^|\s)\S*chat\S*(?:\s|$)/i.test(cls)) return true;
    current = current.parentElement;
  }
  return false;
}

function findBody(viewer: Element): Element {
  return viewer.querySelector('.elements-container') ?? viewer;
}

function hasFooter(viewer: Element): boolean {
  return viewer.querySelector('.artifact-footer, footer') !== null;
}

function readTitle(viewer: Element, body: Element, blocks: Block[]): string {
  for (const el of viewer.querySelectorAll(TITLE_SELECTOR)) {
    if (body.contains(el)) continue;
    const text = elementTitle(el);
    if (text) return text;
  }

  const sibling = viewer.previousElementSibling;
  if (sibling?.matches(TITLE_SELECTOR)) {
    const text = elementTitle(sibling);
    if (text) return text;
  }

  const heading = blocks.find((block) => block.type === 'heading');
  if (heading && heading.type === 'heading') {
    const text = inlinePlain(heading.inlines).replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 150);
  }

  return 'Report';
}

function elementTitle(el: Element): string {
  const text = (el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 150) return '';
  return text;
}

function textLength(blocks: Block[]): number {
  let total = 0;
  for (const block of blocks) {
    if (block.type === 'rule') total += 1;
    else if (block.type === 'list') {
      for (const item of block.items) total += inlinePlain(item).length;
    } else if (block.type === 'table') {
      for (const row of block.rows) {
        for (const cell of row) total += inlinePlain(cell).length;
      }
    } else total += inlinePlain(block.inlines).length;
  }
  return total;
}

function blocksFrom(root: Element): Block[] {
  const blocks: Block[] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;

  const flush = () => {
    if (list && list.items.length > 0) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
    }
    list = null;
  };

  const visit = (el: Element) => {
    if (isSkippable(el)) return;
    const kind = classify(el);

    if (kind === 'container') {
      for (const child of elementChildren(el)) visit(child);
      return;
    }

    if (kind === 'list-item') {
      const ordered = itemOrdered(el);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      const inlines = inlinesFrom(el);
      if (inlines.length > 0) list.items.push(inlines);
      return;
    }

    flush();

    if (kind === 'rule') {
      blocks.push({ type: 'rule' });
      return;
    }

    if (kind === 'h1' || kind === 'h2' || kind === 'h3' || kind === 'h4') {
      const inlines = inlinesFrom(el);
      if (inlines.length > 0) {
        blocks.push({ type: 'heading', level: headingLevel(kind), inlines });
      }
      return;
    }

    if (kind === 'paragraph') {
      const inlines = inlinesFrom(el);
      if (inlines.length > 0) blocks.push({ type: 'paragraph', inlines });
      return;
    }

    if (kind === 'table') {
      const table = tableFrom(el);
      if (table) blocks.push(table);
      return;
    }

    if (kind === 'list' || kind === 'ordered-list') {
      const block = listBlockFrom(el, kind === 'ordered-list');
      if (block) blocks.push(block);
    }
  };

  for (const child of elementChildren(root)) visit(child);
  flush();
  return blocks;
}

function headingLevel(kind: 'h1' | 'h2' | 'h3' | 'h4'): 1 | 2 | 3 | 4 {
  if (kind === 'h1') return 1;
  if (kind === 'h2') return 2;
  if (kind === 'h3') return 3;
  return 4;
}

function classify(el: Element): Kind {
  const tag = el.tagName;
  if (tag === 'TABLE') return 'table';
  if (tag === 'UL') return 'list';
  if (tag === 'OL') return 'ordered-list';
  if (tag === 'HR') return 'rule';

  const ariaHeading = headingFromRole(el);
  if (ariaHeading) return ariaHeading;
  if (tag === 'H1' || el.classList.contains('heading1')) return 'h1';
  if (tag === 'H2' || el.classList.contains('heading2')) return 'h2';
  if (tag === 'H3' || el.classList.contains('heading3')) return 'h3';
  if (tag === 'H4' || el.classList.contains('heading4')) return 'h4';
  if (tag === 'LI' || el.classList.contains('list-item')) return 'list-item';
  if (isDivider(el)) return 'rule';
  if (tag === 'P' || el.classList.contains('normal') || el.classList.contains('table-paragraph')) {
    return 'paragraph';
  }
  return 'container';
}

function headingFromRole(el: Element): 'h1' | 'h2' | 'h3' | 'h4' | null {
  if (el.getAttribute('role') !== 'heading') return null;
  const level = Number(el.getAttribute('aria-level') || '1');
  if (level <= 1) return 'h1';
  if (level === 2) return 'h2';
  if (level === 3) return 'h3';
  return 'h4';
}

function isDivider(el: Element): boolean {
  if (el.tagName.startsWith('H')) return false;
  if (
    el.classList.contains('heading1') ||
    el.classList.contains('heading2') ||
    el.classList.contains('heading3') ||
    el.classList.contains('heading4')
  ) {
    return false;
  }
  return /^[\s\-—–_]{5,}$/.test(el.textContent ?? '');
}

function itemOrdered(el: Element): boolean {
  if (el.closest('ol')) return true;
  if (el.classList.contains('ordered') || el.classList.contains('numbered')) return true;
  const parent = el.parentElement;
  if (parent?.classList.contains('ordered') || parent?.classList.contains('numbered')) return true;
  const marker = [...el.children].find((child) => isMarker(child));
  if (!marker) return false;
  return /^\d+[.)\]]?$/.test((marker.textContent || '').replace(/\s+/g, ''));
}

function listBlockFrom(list: Element, ordered: boolean): Block | null {
  const items: Inline[][] = [];

  const collect = (el: Element) => {
    for (const child of elementChildren(el)) {
      if (child.tagName === 'UL' || child.tagName === 'OL') {
        collect(child);
        continue;
      }
      if (child.tagName !== 'LI' && !child.classList.contains('list-item')) continue;
      const inlines = inlinesFrom(child);
      if (inlines.length > 0) items.push(inlines);
      for (const nested of elementChildren(child)) {
        if (nested.tagName === 'UL' || nested.tagName === 'OL') collect(nested);
      }
    }
  };

  collect(list);
  if (items.length === 0) return null;
  return { type: 'list', ordered, items };
}

function tableFrom(table: Element): Block | null {
  const rows: Inline[][][] = [];
  let header = false;
  const rowEls = [...table.querySelectorAll('tr')].filter((row) => row.closest('table') === table);

  for (const row of rowEls) {
    const cells = [...row.children].filter(
      (cell) => cell.tagName === 'TD' || cell.tagName === 'TH',
    );
    if (cells.length === 0) continue;
    if (cells.some((cell) => cell.tagName === 'TH')) header = true;
    rows.push(cells.map((cell) => inlinesFrom(cell)));
  }

  if (rows.length === 0) return null;
  return { type: 'table', header, rows };
}

function inlinesFrom(el: Element): Inline[] {
  const inlines: Inline[] = [];

  const walk = (node: Node, marks: Marks) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text) inlines.push(makeInline(text, marks));
      return;
    }
    if (!(node instanceof Element)) return;
    if (isMarker(node)) return;
    if (node !== el && isNestedBlock(node)) return;

    const next: Marks = { ...marks };
    if (isBold(node)) next.bold = true;
    if (isItalic(node)) next.italic = true;
    const href = linkHref(node);
    if (href) next.href = href;

    for (const child of node.childNodes) walk(child, next);
  };

  walk(el, {});
  return mergeInlines(inlines);
}

function isNestedBlock(el: Element): boolean {
  const tag = el.tagName;
  return tag === 'UL' || tag === 'OL' || tag === 'TABLE' || tag === 'HR';
}

function isMarker(el: Element): boolean {
  return el.classList.contains('list-marker') || el.classList.contains('bullet');
}

function isBold(el: Element): boolean {
  if (el.tagName === 'STRONG' || el.tagName === 'B') return true;
  if (el.classList.contains('bold') || el.classList.contains('font-bold')) return true;
  return /font-weight\s*:\s*(bold|[6-9]00)/i.test(el.getAttribute('style') || '');
}

function isItalic(el: Element): boolean {
  if (el.tagName === 'EM' || el.tagName === 'I') return true;
  if (el.classList.contains('italic') || el.classList.contains('font-italic')) return true;
  return /font-style\s*:\s*italic/i.test(el.getAttribute('style') || '');
}

function linkHref(el: Element): string | undefined {
  if (el.tagName !== 'A') return undefined;
  const raw = el.getAttribute('href');
  if (!raw) return undefined;
  return safeHref(raw);
}

function safeHref(raw: string): string | undefined {
  const decoded = decodeGoogleRedirect(raw);
  if (!decoded) return undefined;
  try {
    const url = new URL(decoded, 'https://notebooklm.google.com');
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'mailto:') {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}

function decodeGoogleRedirect(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, 'https://notebooklm.google.com');
    const google = url.hostname === 'google.com' || url.hostname.endsWith('.google.com');
    if (google && (url.pathname === '/url' || url.pathname.startsWith('/url/'))) {
      const target = url.searchParams.get('q') || url.searchParams.get('url');
      if (target) return target;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function makeInline(text: string, marks: Marks): Inline {
  const inline: Inline = { text };
  if (marks.bold) inline.bold = true;
  if (marks.italic) inline.italic = true;
  if (marks.href) inline.href = marks.href;
  return inline;
}

function mergeInlines(inlines: Inline[]): Inline[] {
  const merged: Inline[] = [];
  for (const inline of inlines) {
    const text = inline.text.replace(/\s+/g, ' ');
    if (!text) continue;
    const next = makeInline(text, inline);
    const prev = merged[merged.length - 1];
    if (prev && sameMarks(prev, next)) prev.text += next.text;
    else merged.push(next);
  }

  const first = merged[0];
  const last = merged[merged.length - 1];
  if (first) first.text = first.text.trimStart();
  if (last) last.text = last.text.trimEnd();
  return merged.filter((inline) => inline.text.length > 0);
}

function sameMarks(a: Inline, b: Inline): boolean {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && (a.href || '') === (b.href || '');
}

function elementChildren(el: Element): Element[] {
  return [...el.children];
}

function isSkippable(el: Element): boolean {
  const tag = el.tagName;
  if (
    tag === 'SCRIPT' ||
    tag === 'STYLE' ||
    tag === 'BUTTON' ||
    tag === 'FOOTER' ||
    tag === 'SVG' ||
    tag === 'NAV'
  ) {
    return true;
  }
  if (el.id === 'satchel-report-root' || el.id === 'satchel-export-root' || el.id === 'satchel-mindmap-root')
    return true;
  if (el.closest('#satchel-report-root, #satchel-export-root, #satchel-mindmap-root')) return true;
  const cls = el.getAttribute('class') || '';
  if (/(?:^|\s)artifact-footer(?:\s|$)/.test(cls)) return true;
  if (el.hasAttribute('hidden')) return true;
  if (/display\s*:\s*none/i.test(el.getAttribute('style') || '')) return true;
  return false;
}
