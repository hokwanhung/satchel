import { extractFromDocument, parseAppData } from '../lib/extract';
import { isSatchelMessage, probeAndPost } from '../lib/frame-probe';
import { injectExportBar } from '../lib/inject-ui';
import type { Flashcard } from '../lib/types';

const NOTEBOOK_MATCHES = [
  'https://notebooklm.google.com/*',
  'https://notebook.google.com/*',
  'https://*.usercontent.goog/*',
];

export default defineContentScript({
  matches: NOTEBOOK_MATCHES,
  allFrames: true,
  matchOriginAsFallback: true,
  runAt: 'document_idle',
  main() {
    let latestCards: Flashcard[] = [];

    const applyCards = (cards: Flashcard[]) => {
      if (cards.length === 0) return;
      latestCards = cards;
      if (window === window.top) {
        injectExportBar(cards);
      }
    };

    const scanLocal = () => {
      const result = extractFromDocument(document);
      if (!result) return;
      if (result.cards.length > 0) {
        if (window === window.top) {
          applyCards(result.cards);
        } else {
          probeAndPost();
        }
      }
    };

    if (window === window.top) {
      window.addEventListener('message', (event) => {
        if (!isSatchelMessage(event)) return;
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
    } else {
      scanLocal();
    }

    const observer = new MutationObserver(() => {
      scanLocal();
      if (window === window.top && latestCards.length > 0) {
        injectExportBar(latestCards);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-app-data'],
    });

    scanLocal();
  },
});
