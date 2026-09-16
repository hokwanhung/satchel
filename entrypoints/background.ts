import { probeAndPost, shouldInjectFrame } from '../lib/frame-probe';

async function inject(tabId: number, frameId: number) {
  try {
    await browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: probeAndPost,
    });
  } catch (error) {
    console.debug('[satchel] frame inject skipped', error);
  }
}

async function scanTab(tabId: number) {
  const frames = await browser.webNavigation.getAllFrames({ tabId });
  for (const frame of frames ?? []) {
    if (frame.frameId === 0) continue;
    await inject(tabId, frame.frameId);
  }
}

export default defineBackground(() => {
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId <= 0) return;
    if (!shouldInjectFrame(details.url)) return;
    void inject(details.tabId, details.frameId);
  });

  browser.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId <= 0) return;
    if (!shouldInjectFrame(details.url)) return;
    void inject(details.tabId, details.frameId);
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (message.type !== 'SATCHEL_SCAN_TAB') return;
    const tabId =
      'tabId' in message && typeof message.tabId === 'number' ? message.tabId : sender.tab?.id;
    if (!tabId) return Promise.resolve({ ok: false, error: 'No tab' });
    return scanTab(tabId).then(() => ({ ok: true }));
  });
});
