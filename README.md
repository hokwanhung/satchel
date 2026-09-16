# Satchel

Pack NotebookLM flashcards into Anki-ready CSV.

Satchel is a Chrome extension for [Gemini Notebook](https://notebook.google.com/) (formerly NotebookLM). It adds **Copy CSV** and **Download CSV** to the Studio flashcard viewer so you can import cards into Anki. Extraction runs in your browser. Nothing is uploaded.

Not affiliated with Google.

## Why

NotebookLM still has weak file export for study artifacts. [AnkiNLM](https://github.com/maialks/ankinlm) filled that gap, then stopped working after the move to `notebook.google.com`. Satchel restores that flow on both `notebook.google.com` and `notebooklm.google.com`, with LaTeX left intact.

Quizzes and other Studio exports are planned later.

## Install (unpacked)

Chrome Web Store listing is not published yet. Load from source:

```bash
git clone https://github.com/hokwanhung/satchel.git
cd satchel
npm install
npm run build
```

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** and select `.output/chrome-mv3`
4. Open a notebook, generate flashcards, and use the Satchel bar

For live reload while developing: `npm run dev`.

If the bar does not appear, open the flashcard viewer, click **Scan this tab** in the popup, and reload the notebook after installing or updating.

## Import into Anki

1. File → Import
2. Choose `satchel-flashcards.csv`
3. Field separator: **Tab** (the file is TSV with a `.csv` name, matching AnkiNLM)
4. Field 1 → Front, Field 2 → Back
5. Import

The file is UTF-8 with a BOM. Expressions such as `\sin(x)` and `\frac{a}{b}` are unchanged. To render math in Anki, use a MathJax or LaTeX add-on (AnkiNLM suggested Better Markdown Anki, id `2100166052`).

## Privacy

Satchel only runs on NotebookLM and its Studio iframes. There is no account, analytics, or backend.

## Develop

```bash
npm test
npm run compile
npm run build
```

Google can change Studio DOM or iframe URLs. If export breaks after a NotebookLM update, open an issue with the page URL pattern and whether flashcards were visible when you clicked Scan.
