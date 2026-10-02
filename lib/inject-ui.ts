import { cardsToTsvWithBom, createTsvBlob } from './csv';
import { createDocxBlob } from './docx';
import { createMarkdownBlob, reportToMarkdown } from './markdown';
import {
  countMindMapNodes,
  createMindMapHtmlBlob,
  createMindMapSvgBlob,
  mindMapFileStem,
  type MindMapNode,
} from './mindmap';
import { reportBarHost, reportFileStem, type ReportDocument } from './report';
import {
  SATCHEL_MINDMAP_ROOT_ID,
  SATCHEL_REPORT_ROOT_ID,
  SATCHEL_ROOT_ID,
  type ArtifactKind,
  type Flashcard,
} from './types';

function itemNoun(kind: ArtifactKind): string {
  return kind === 'quiz' ? 'questions' : 'cards';
}

function downloadName(kind: ArtifactKind): string {
  return kind === 'quiz' ? 'satchel-quiz.csv' : 'satchel-flashcards.csv';
}

function readyStatus(count: number, kind: ArtifactKind): string {
  return `${count} ${itemNoun(kind)} ready`;
}

const FOOTER_SELECTORS = [
  'artifact-viewer .artifact-footer',
  '.artifact-footer',
  'artifact-viewer footer',
  '[class*="artifact-footer"]',
  '.artifact-viewer-container .artifact-footer',
];

export function findFooter(root: ParentNode = document): HTMLElement | null {
  for (const selector of FOOTER_SELECTORS) {
    const el = root.querySelector(selector);
    if (el instanceof HTMLElement) return el;
  }

  const viewer = root.querySelector('artifact-viewer');
  if (viewer) {
    const buttons = viewer.querySelectorAll('button');
    const last = buttons[buttons.length - 1];
    if (last?.parentElement instanceof HTMLElement) {
      return last.parentElement;
    }
  }

  return null;
}

function setStatus(root: HTMLElement, message: string, kind: 'ok' | 'err' = 'ok') {
  const status = root.querySelector<HTMLElement>('[data-satchel-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function downloadBlob(blob: Blob, filename: string, doc: Document) {
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCards(cards: Flashcard[], kind: ArtifactKind, doc: Document) {
  downloadBlob(createTsvBlob(cards), downloadName(kind), doc);
}

function bindActions(root: HTMLElement, cards: Flashcard[], kind: ArtifactKind, doc: Document) {
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-satchel-copy]');
  const downloadBtn = root.querySelector<HTMLButtonElement>('[data-satchel-download]');
  if (!copyBtn || !downloadBtn) return;

  copyBtn.onclick = async () => {
    try {
      await copyText(cardsToTsvWithBom(cards));
      setStatus(root, `Copied ${cards.length} ${itemNoun(kind)}`, 'ok');
    } catch {
      setStatus(root, 'Copy failed', 'err');
    }
  };

  downloadBtn.onclick = () => {
    downloadCards(cards, kind, doc);
    setStatus(root, `Downloaded ${cards.length} ${itemNoun(kind)}`, 'ok');
  };
}

export function injectExportBar(
  cards: Flashcard[],
  doc: Document = document,
  kind: ArtifactKind = 'flashcards',
): boolean {
  if (cards.length === 0) return false;

  const existing = doc.getElementById(SATCHEL_ROOT_ID);
  if (existing) {
    const nextCount = String(cards.length);
    const nextStatus = readyStatus(cards.length, kind);
    bindActions(existing, cards, kind, doc);
    if (existing.dataset.count !== nextCount) existing.dataset.count = nextCount;
    if (existing.dataset.kind !== kind) existing.dataset.kind = kind;
    const status = existing.querySelector<HTMLElement>('[data-satchel-status]');
    if (status?.textContent !== nextStatus) setStatus(existing, nextStatus, 'ok');
    return true;
  }

  const footer = findFooter(doc);
  const host = footer ?? doc.body;
  if (!host) return false;

  const root = doc.createElement('div');
  root.id = SATCHEL_ROOT_ID;
  root.dataset.count = String(cards.length);
  root.dataset.kind = kind;
  root.innerHTML = `
    <div class="satchel-bar">
      <span class="satchel-brand">Satchel</span>
      <button type="button" data-satchel-copy>Copy CSV</button>
      <button type="button" data-satchel-download>Download CSV</button>
      <span data-satchel-status>${readyStatus(cards.length, kind)}</span>
    </div>
  `;

  const style = doc.createElement('style');
  style.textContent = barCss(SATCHEL_ROOT_ID);
  root.prepend(style);

  if (!footer) {
    root.style.position = 'fixed';
    root.style.right = '16px';
    root.style.bottom = '16px';
  }

  host.appendChild(root);
  bindActions(root, cards, kind, doc);
  return true;
}

function bindReportActions(root: HTMLElement, report: ReportDocument, doc: Document) {
  const wordBtn = root.querySelector<HTMLButtonElement>('[data-satchel-word]');
  const markdownBtn = root.querySelector<HTMLButtonElement>('[data-satchel-markdown]');
  if (!wordBtn || !markdownBtn) return;

  const stem = reportFileStem(report.title);

  wordBtn.onclick = () => {
    try {
      downloadBlob(createDocxBlob(report), `${stem}.docx`, doc);
      setStatus(root, 'Downloaded Word', 'ok');
    } catch {
      setStatus(root, 'Download failed', 'err');
    }
  };

  markdownBtn.onclick = () => {
    try {
      downloadBlob(createMarkdownBlob(report), `${stem}.md`, doc);
      setStatus(root, 'Downloaded Markdown', 'ok');
    } catch {
      setStatus(root, 'Download failed', 'err');
    }
  };
}

export function injectReportBar(report: ReportDocument, doc: Document = document): boolean {
  if (report.blocks.length === 0) return false;

  const signature = `${report.title}\n${reportToMarkdown(report)}`;
  const existing = doc.getElementById(SATCHEL_REPORT_ROOT_ID);
  if (existing) {
    const host = reportBarHost(doc);
    if (host && existing.parentElement !== host) host.appendChild(existing);
    bindReportActions(existing, report, doc);
    if (existing.dataset.signature !== signature) {
      existing.dataset.signature = signature;
      setStatus(existing, 'Report ready', 'ok');
    }
    return true;
  }

  const footer = reportBarHost(doc);
  const host = footer ?? doc.body;
  if (!host) return false;

  const root = doc.createElement('div');
  root.id = SATCHEL_REPORT_ROOT_ID;
  root.dataset.signature = signature;
  root.innerHTML = `
    <div class="satchel-bar">
      <span class="satchel-brand">Satchel</span>
      <button type="button" data-satchel-word>Download Word</button>
      <button type="button" data-satchel-markdown>Download Markdown</button>
      <span data-satchel-status>Report ready</span>
    </div>
  `;

  const style = doc.createElement('style');
  style.textContent = barCss(SATCHEL_REPORT_ROOT_ID);
  root.prepend(style);

  if (!footer) {
    root.style.position = 'fixed';
    root.style.right = '16px';
    root.style.bottom = '16px';
  }

  host.appendChild(root);
  bindReportActions(root, report, doc);
  return true;
}

function bindMindMapActions(root: HTMLElement, tree: MindMapNode, doc: Document) {
  const mapBtn = root.querySelector<HTMLButtonElement>('[data-satchel-map]');
  const imageBtn = root.querySelector<HTMLButtonElement>('[data-satchel-image]');
  if (!mapBtn || !imageBtn) return;

  const stem = mindMapFileStem(tree);
  const nodes = countMindMapNodes(tree);

  mapBtn.onclick = () => {
    try {
      downloadBlob(createMindMapHtmlBlob(tree), `${stem}.html`, doc);
      setStatus(root, `Downloaded ${nodes} nodes`, 'ok');
    } catch {
      setStatus(root, 'Download failed', 'err');
    }
  };

  imageBtn.onclick = () => {
    try {
      downloadBlob(createMindMapSvgBlob(tree), `${stem}.svg`, doc);
      setStatus(root, `Downloaded ${nodes} nodes`, 'ok');
    } catch {
      setStatus(root, 'Download failed', 'err');
    }
  };
}

export function injectMindMapBar(tree: MindMapNode, doc: Document = document): boolean {
  const nodes = countMindMapNodes(tree);
  if (nodes === 0) return false;

  const signature = JSON.stringify(tree);
  const existing = doc.getElementById(SATCHEL_MINDMAP_ROOT_ID);
  const ready = `${nodes} nodes ready`;
  if (existing) {
    bindMindMapActions(existing, tree, doc);
    if (existing.dataset.signature !== signature) {
      existing.dataset.signature = signature;
      setStatus(existing, ready, 'ok');
    }
    return true;
  }

  const footer = findFooter(doc);
  const host = footer ?? doc.body;
  if (!host) return false;

  const root = doc.createElement('div');
  root.id = SATCHEL_MINDMAP_ROOT_ID;
  root.dataset.signature = signature;
  root.innerHTML = `
    <div class="satchel-bar">
      <span class="satchel-brand">Satchel</span>
      <button type="button" data-satchel-map>Download map</button>
      <button type="button" data-satchel-image>Download image</button>
      <span data-satchel-status>${ready}</span>
    </div>
  `;

  const style = doc.createElement('style');
  style.textContent = barCss(SATCHEL_MINDMAP_ROOT_ID);
  root.prepend(style);

  if (!footer) {
    root.style.position = 'fixed';
    root.style.right = '16px';
    root.style.bottom = '16px';
  }

  host.appendChild(root);
  bindMindMapActions(root, tree, doc);
  return true;
}

function barCss(rootId: string): string {
  return `
    #${rootId} {
      font-family: "Google Sans", system-ui, sans-serif;
      font-size: 13px;
      z-index: 2147483646;
    }
    #${rootId} .satchel-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 8px 12px;
      padding: 8px 10px;
      border-radius: 999px;
      background: #1b3a2f;
      color: #f4fff8;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    }
    #${rootId} .satchel-brand {
      font-weight: 650;
      letter-spacing: 0.02em;
      padding: 0 6px;
    }
    #${rootId} button {
      border: 0;
      border-radius: 999px;
      padding: 6px 12px;
      background: #d8f3dc;
      color: #133226;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    #${rootId} button:hover {
      background: #c3ead0;
    }
    #${rootId} [data-satchel-status] {
      opacity: 0.85;
    }
    #${rootId} [data-satchel-status][data-kind="err"] {
      color: #ffd7d2;
    }
  `;
}
