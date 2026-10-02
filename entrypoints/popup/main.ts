const status = document.querySelector('#status');
const rescan = document.querySelector('#rescan');

async function refreshStatus() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    if (status) status.textContent = 'No active tab.';
    return;
  }

  const onNotebook =
    tab.url.includes('notebook.google.com') || tab.url.includes('notebooklm.google.com');
  if (!onNotebook) {
    if (status) {
      status.textContent = 'Open NotebookLM, then generate flashcards, a quiz, a report, or a mind map.';
    }
    return;
  }

  try {
    const result = (await browser.tabs.sendMessage(tab.id, {
      type: 'SATCHEL_GET_STATUS',
    })) as { count?: number; kind?: string; reportTitle?: string; mindMapTitle?: string } | undefined;
    if (status) {
      const parts: string[] = [];
      if (result?.reportTitle) parts.push(`Report ready: ${result.reportTitle}.`);
      if (result?.mindMapTitle) parts.push(`Mind map ready: ${result.mindMapTitle}.`);
      if (result?.count) {
        const noun =
          result.kind === 'quiz' ? 'questions' : result.kind === 'mindmap' ? 'nodes' : 'cards';
        parts.push(`${result.count} ${noun} ready in this notebook.`);
      }
      status.textContent =
        parts.join(' ') ||
        'Nothing detected yet. Open a Studio report, mind map, flashcards, or a quiz.';
    }
  } catch {
    if (status) status.textContent = 'Reload the NotebookLM tab after installing Satchel.';
  }
}

rescan?.addEventListener('click', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    if (status) status.textContent = 'No active tab.';
    return;
  }
  try {
    await browser.runtime.sendMessage({ type: 'SATCHEL_SCAN_TAB', tabId: tab.id });
  } catch {
    if (status) status.textContent = 'Could not scan this tab.';
    return;
  }
  window.setTimeout(() => {
    void refreshStatus();
  }, 400);
});

void refreshStatus();
