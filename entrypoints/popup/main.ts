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
    if (status) status.textContent = 'Open NotebookLM, then generate flashcards or a quiz.';
    return;
  }

  try {
    const result = (await browser.tabs.sendMessage(tab.id, {
      type: 'SATCHEL_GET_STATUS',
    })) as { count?: number; kind?: string } | undefined;
    if (status) {
      const noun = result?.kind === 'quiz' ? 'questions' : 'cards';
      status.textContent = result?.count
        ? `${result.count} ${noun} ready in this notebook.`
        : 'Nothing detected yet. Open the Studio flashcard or quiz viewer.';
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
