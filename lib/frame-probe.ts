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
