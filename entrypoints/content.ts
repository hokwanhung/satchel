import { parseAppData, readAppDataAttribute, shouldHandleAppData } from '../lib/extract';
import { isSatchelMessage } from '../lib/frame-probe';
import { injectExportBar, injectMindMapBar, injectReportBar } from '../lib/inject-ui';
import { countMindMapNodes } from '../lib/mindmap';
import { extractReport, type ReportDocument } from '../lib/report';
import {
  SATCHEL_MINDMAP_ROOT_ID,
  SATCHEL_REPORT_ROOT_ID,
  SATCHEL_ROOT_ID,
  type ExtractResult,
} from '../lib/types';

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
    let latest: ExtractResult | null = null;
    let latestReport: ReportDocument | null = null;
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

    const applyResult = (parsed: ExtractResult) => {
      if (parsed.kind === 'mindmap' && parsed.mindMap) {
        latest = parsed;
        if (window === window.top) {
          document.getElementById(SATCHEL_ROOT_ID)?.remove();
          injectMindMapBar(parsed.mindMap, document);
        }
        return;
      }
      if (parsed.cards.length === 0) return;
      latest = parsed;
      if (window === window.top) {
        document.getElementById(SATCHEL_MINDMAP_ROOT_ID)?.remove();
        injectExportBar(parsed.cards, document, parsed.kind);
      }
    };

    const publish = (raw: string) => {
      lastRaw = raw;
      view.__satchelLastRaw = raw;
      const parsed = parseAppData(raw);
      if (!parsed) return;
      if (parsed.kind === 'mindmap') {
        if (!parsed.mindMap) return;
      } else if (!parsed.cards.length) {
        return;
      }

      if (window === window.top) {
        applyResult(parsed);
        return;
      }

      postToNotebookTop(raw);
    };

    const scanReport = () => {
      if (window !== window.top) return;
      const report = extractReport(document);
      latestReport = report;
      if (!report) {
        document.getElementById(SATCHEL_REPORT_ROOT_ID)?.remove();
        return;
      }
      injectReportBar(report, document);
    };

    const runScan = () => {
      scanReport();
      const found = readAppDataAttribute(document);
      if (!found) {
        observeTree();
        return;
      }

      if (shouldHandleAppData(found.data, lastRaw)) {
        publish(found.data);
      }

      watchDataNode(found.node);
      observeTree();
    };

    if (window === window.top) {
      window.addEventListener('message', (event) => {
        if (!isSatchelMessage(event)) return;
        if (!shouldHandleAppData(event.data.data, lastRaw)) return;
        lastRaw = event.data.data;
        view.__satchelLastRaw = lastRaw;
        const parsed = parseAppData(event.data.data);
        if (parsed) applyResult(parsed);
      });

      browser.runtime.onMessage.addListener((message) => {
        if (!message || typeof message !== 'object' || !('type' in message)) return;
        if (message.type !== 'SATCHEL_GET_STATUS') return;
        return Promise.resolve({
          count:
            latest?.kind === 'mindmap' && latest.mindMap
              ? countMindMapNodes(latest.mindMap)
              : (latest?.cards.length ?? 0),
          kind: latest?.kind,
          hasBar: Boolean(document.getElementById('satchel-export-root')),
          reportTitle: latestReport?.title,
          mindMapTitle: latest?.mindMap?.name,
        });
      });
    }

    runScan();
    if (!lastRaw) observeTree();
  },
});
