import { parseAppData, readAppDataAttribute, shouldHandleAppData } from '../lib/extract';
import { isSatchelMessage } from '../lib/frame-probe';
import { injectExportBar } from '../lib/inject-ui';
import type { Flashcard } from '../lib/types';

const NOTEBOOK_MATCHES = [
  'https://notebooklm.google.com/*',
  'https://notebook.google.com/*',
  'https://*.usercontent.goog/*',
];

/** Wait for Studio's iframe DOM to finish mounting before scanning. */
const TREE_SETTLE_MS = 300;

type SatchelWindow = Window & { __satchelLastRaw?: string };

function postToNotebookTop(data: string): void {
  try {
    (window.top ?? window.parent).postMessage({ type: 'SATCHEL_NOTEBOOKLM_DATA', data }, '*');
  } catch {
    window.parent.postMessage({ type: 'SATCHEL_NOTEBOOKLM_DATA', data }, '*');
  }
}

export default defineContentScript({
  matches: NOTEBOOK_MATCHES,
  allFrames: true,
  matchOriginAsFallback: true,
  runAt: 'document_idle',
  main() {
    const view = window as SatchelWindow;
    let latestCards: Flashcard[] = [];
    let lastRaw = view.__satchelLastRaw ?? '';
    let settleTimer: number | undefined;
    let dataNodeObserver: MutationObserver | null = null;

    const treeObserver = new MutationObserver(() => {
      treeObserver.disconnect();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        runScan();
      }, TREE_SETTLE_MS);
    });

    const observeTree = () => {
      const root = document.documentElement;
      if (!root) return;
      treeObserver.observe(root, { childList: true, subtree: true });
    };

    const watchDataNode = (node: Element) => {
      dataNodeObserver?.disconnect();
      dataNodeObserver = new MutationObserver(() => {
        runScan();
      });
      dataNodeObserver.observe(node, {
        attributes: true,
        attributeFilter: ['data-app-data'],
      });
    };

    const applyCards = (cards: Flashcard[]) => {
      if (cards.length === 0) return;
      latestCards = cards;
      if (window === window.top) {
        injectExportBar(cards);
      }
    };

    const publish = (raw: string) => {
      lastRaw = raw;
      view.__satchelLastRaw = raw;
      const parsed = parseAppData(raw);
      if (!parsed?.cards.length) return;

      if (window === window.top) {
        applyCards(parsed.cards);
        return;
      }

      postToNotebookTop(raw);
    };

    const runScan = () => {
      const found = readAppDataAttribute(document);
      if (!found) {
        observeTree();
        return;
      }

      if (shouldHandleAppData(found.data, lastRaw)) {
        publish(found.data);
      }

      watchDataNode(found.node);
    };

    if (window === window.top) {
      window.addEventListener('message', (event) => {
        if (!isSatchelMessage(event)) return;
        if (!shouldHandleAppData(event.data.data, lastRaw)) return;
        lastRaw = event.data.data;
        view.__satchelLastRaw = lastRaw;
        const parsed = parseAppData(event.data.data);
        if (parsed?.cards.length) applyCards(parsed.cards);
      });

      browser.runtime.onMessage.addListener((message) => {
        if (!message || typeof message !== 'object' || !('type' in message)) return;
        if (message.type !== 'SATCHEL_GET_STATUS') return;
        return Promise.resolve({
          count: latestCards.length,
          hasBar: Boolean(document.getElementById('satchel-export-root')),
        });
      });
    }

    runScan();
    if (!lastRaw) observeTree();
  },
});
