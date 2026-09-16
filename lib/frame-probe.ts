import { SATCHEL_MESSAGE } from './types';

/**
 * Must stay self-contained: Chrome serializes this function into the target frame.
 */
export function probeAndPost(): boolean {
  const nodes = document.querySelectorAll('[data-app-data], app-root');
  for (const node of nodes) {
    const data = node.getAttribute('data-app-data');
    if (!data) continue;
    try {
      window.parent.postMessage({ type: 'SATCHEL_NOTEBOOKLM_DATA', data }, '*');
      return true;
    } catch {
      // keep scanning
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
