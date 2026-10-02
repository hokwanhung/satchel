import { probeAndPost, probeMindMapAndPost, shouldInjectFrame, shouldProbeMindMap } from '../lib/frame-probe';

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

async function injectMindMap(tabId: number, frameId: number) {
  try {
    await browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: 'MAIN',
      func: probeMindMapAndPost,
    });
  } catch (error) {
    console.debug('[satchel] mindmap probe skipped', error);
  }
}

async function scanTab(tabId: number) {
  const frames = await browser.webNavigation.getAllFrames({ tabId });
  for (const frame of frames ?? []) {
    if (shouldProbeMindMap(frame.url)) {
      await injectMindMap(tabId, frame.frameId);
    }
    if (frame.frameId === 0) continue;
    await inject(tabId, frame.frameId);
  }
}

export default defineBackground(() => {
  browser.webNavigation.onCommitted.addListener((details) => {
    if (shouldProbeMindMap(details.url)) {
      void injectMindMap(details.tabId, details.frameId);
    }
    if (details.frameId <= 0) return;
    if (!shouldInjectFrame(details.url)) return;
    void inject(details.tabId, details.frameId);
  });

  browser.webNavigation.onCompleted.addListener((details) => {
    if (shouldProbeMindMap(details.url)) {
      void injectMindMap(details.tabId, details.frameId);
    }
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
