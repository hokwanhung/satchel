import { SATCHEL_MESSAGE } from './types';

/**
 * Must stay self-contained: Chrome serializes this function into the target frame.
 * Do not close over module state or helper functions; Chrome copies this body only.
 */
export function probeAndPost(): boolean {
  const view = window as Window & { __satchelLastRaw?: string };
  const nodes = document.querySelectorAll('[data-app-data], app-root');
  for (const node of nodes) {
    const data = node.getAttribute('data-app-data');
    if (!data || data === view.__satchelLastRaw) continue;
    try {
      (window.top ?? window.parent).postMessage({ type: 'SATCHEL_NOTEBOOKLM_DATA', data }, '*');
      view.__satchelLastRaw = data;
      return true;
    } catch {
      try {
        window.parent.postMessage({ type: 'SATCHEL_NOTEBOOKLM_DATA', data }, '*');
        view.__satchelLastRaw = data;
        return true;
      } catch {
        // keep scanning
      }
    }
  }
  return false;
}

export function isSatchelMessage(
  event: MessageEvent
): event is MessageEvent<{ type: string; data: string }> {
  const origin = event.origin;
  const trusted =
    origin === 'null' ||
    origin.includes('google.com') ||
    origin.includes('usercontent.goog');
  if (!trusted) return false;
  const payload = event.data;
  return (
    payload !== null &&
    typeof payload === 'object' &&
    payload.type === SATCHEL_MESSAGE &&
    typeof payload.data === 'string'
  );
}

export function shouldInjectFrame(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('blob:') ||
    url.includes('usercontent.goog') ||
    url.includes('shim.html')
  );
}

export function shouldProbeMindMap(url: string): boolean {
  if (!url) return false;
  return (
    shouldInjectFrame(url) ||
    url.includes('notebook.google.com') ||
    url.includes('notebooklm.google.com')
  );
}

/**
 * MAIN-world probe: D3 binds the tree on SVG nodes as __data__.
 * Must stay self-contained. Chrome copies this body into the page.
 */
export function probeMindMapAndPost(): boolean {
  const view = window as Window & { __satchelLastMindMap?: string };

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

  const nodeName = (record: Record<string, unknown>): string => {
    for (const key of ['name', 'label', 'text', 'title']) {
      const value = record[key];
      if (typeof value === 'string') return value;
    }
    return '';
  };

  const childList = (record: Record<string, unknown>): unknown[] => {
    const kids = Array.isArray(record.children) ? record.children : [];
    if (kids.length > 0) return kids;
    if (Array.isArray(record._children) && record._children.length > 0) return record._children;
    if (Array.isArray(record.nodes)) return record.nodes;
    return kids;
  };

  const walkToRoot = (value: unknown): unknown => {
    let current = value;
    const seen = new Set<object>();
    while (true) {
      const record = asRecord(current);
      if (!record || seen.has(record)) return current;
      seen.add(record);
      if (!('parent' in record) || record.parent == null) return current;
      current = record.parent;
    }
  };

  const normalize = (
    value: unknown,
    seen: WeakSet<object>,
  ): { name: string; children: { name: string; children: unknown[] }[] } | null => {
    const record = asRecord(value);
    if (!record || seen.has(record)) return null;
    seen.add(record);

    const hierarchy =
      'data' in record && (record.parent !== undefined || typeof record.depth === 'number');
    const data = hierarchy ? (asRecord(record.data) ?? record) : record;
    const source = hierarchy ? record : data;
    const name = nodeName(data);
    const keyed =
      hierarchy ||
      'children' in source ||
      '_children' in source ||
      'nodes' in source;
    const children = keyed
      ? childList(source).flatMap((child) => {
          const node = normalize(child, seen);
          return node ? [node] : [];
        })
      : [];
    if (name.length === 0 && children.length === 0) return null;
    return { name, children };
  };

  const count = (node: { children: unknown[] }): number => {
    const kids = node.children as { children: unknown[] }[];
    return 1 + kids.reduce((sum, child) => sum + count(child), 0);
  };

  let best: { name: string; children: unknown[] } | null = null;
  let bestCount = 0;
  const elements = document.querySelectorAll('svg *');
  for (const element of elements) {
    const datum = (element as Element & { __data__?: unknown }).__data__;
    if (!datum) continue;
    const tree = normalize(walkToRoot(datum), new WeakSet<object>());
    if (!tree || tree.children.length === 0) continue;
    const size = count(tree);
    if (size > bestCount) {
      best = tree;
      bestCount = size;
    }
  }

  if (!best) return false;
  const data = JSON.stringify(best);
  if (!data || data === view.__satchelLastMindMap) return false;

  try {
    (window.top ?? window.parent).postMessage({ type: 'SATCHEL_NOTEBOOKLM_DATA', data }, '*');
    view.__satchelLastMindMap = data;
    return true;
  } catch {
    try {
      window.parent.postMessage({ type: 'SATCHEL_NOTEBOOKLM_DATA', data }, '*');
      view.__satchelLastMindMap = data;
      return true;
    } catch {
      return false;
    }
  }
}
