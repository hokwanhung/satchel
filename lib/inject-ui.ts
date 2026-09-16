import { cardsToTsvWithBom, createTsvBlob } from './csv';
import { SATCHEL_ROOT_ID, type Flashcard } from './types';

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

function downloadCards(cards: Flashcard[]) {
  const blob = createTsvBlob(cards);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'satchel-flashcards.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindActions(root: HTMLElement, cards: Flashcard[]) {
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-satchel-copy]');
  const downloadBtn = root.querySelector<HTMLButtonElement>('[data-satchel-download]');
  if (!copyBtn || !downloadBtn) return;

  copyBtn.onclick = async () => {
    try {
      await copyText(cardsToTsvWithBom(cards));
      setStatus(root, `Copied ${cards.length} cards`, 'ok');
    } catch {
      setStatus(root, 'Copy failed', 'err');
    }
  };

  downloadBtn.onclick = () => {
    downloadCards(cards);
    setStatus(root, `Downloaded ${cards.length} cards`, 'ok');
  };
}

export function injectExportBar(cards: Flashcard[], doc: Document = document): boolean {
  if (cards.length === 0) return false;

  const existing = doc.getElementById(SATCHEL_ROOT_ID);
  if (existing) {
    existing.dataset.count = String(cards.length);
    bindActions(existing, cards);
    setStatus(existing, `${cards.length} cards ready`, 'ok');
    return true;
  }

  const footer = findFooter(doc);
  const host = footer ?? doc.body;
  if (!host) return false;

  const root = doc.createElement('div');
  root.id = SATCHEL_ROOT_ID;
  root.dataset.count = String(cards.length);
  root.innerHTML = `
    <div class="satchel-bar">
      <span class="satchel-brand">Satchel</span>
      <button type="button" data-satchel-copy>Copy CSV</button>
      <button type="button" data-satchel-download>Download CSV</button>
      <span data-satchel-status>${cards.length} cards ready</span>
    </div>
  `;

  const style = doc.createElement('style');
  style.textContent = `
    #${SATCHEL_ROOT_ID} {
      font-family: "Google Sans", system-ui, sans-serif;
      font-size: 13px;
      z-index: 2147483646;
    }
    #${SATCHEL_ROOT_ID} .satchel-bar {
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
    #${SATCHEL_ROOT_ID} .satchel-brand {
      font-weight: 650;
      letter-spacing: 0.02em;
      padding: 0 6px;
    }
    #${SATCHEL_ROOT_ID} button {
      border: 0;
      border-radius: 999px;
      padding: 6px 12px;
      background: #d8f3dc;
      color: #133226;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    #${SATCHEL_ROOT_ID} button:hover {
      background: #c3ead0;
    }
    #${SATCHEL_ROOT_ID} [data-satchel-status] {
      opacity: 0.85;
    }
    #${SATCHEL_ROOT_ID} [data-satchel-status][data-kind="err"] {
      color: #ffd7d2;
    }
  `;
  root.prepend(style);

  if (!footer) {
    root.style.position = 'fixed';
    root.style.right = '16px';
    root.style.bottom = '16px';
  }

  host.appendChild(root);
  bindActions(root, cards);
  return true;
}
