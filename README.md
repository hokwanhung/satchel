# Satchel

Pack NotebookLM flashcards and quizzes into Anki-ready CSV, download Studio reports as Word or Markdown, and save mind maps as an interactive HTML file or an SVG image.

Satchel is a Chrome extension for [Gemini Notebook](https://notebook.google.com/) (formerly NotebookLM). It adds **Copy CSV** and **Download CSV** to the Studio flashcard and quiz viewers so you can import cards into Anki. On a Studio report it adds **Download Word** and **Download Markdown**, so you can save the file without opening Google Docs. On a mind map it adds **Download map** (offline HTML) and **Download image** (fully expanded SVG). Extraction runs in your browser. Nothing is uploaded.

Not affiliated with Google.

## Why

NotebookLM still has weak file export for study artifacts. Flashcards now have a native CSV download; Satchel still targets Anki TSV (tab-separated, LaTeX left intact). Quizzes have no native file export. [AnkiNLM](https://github.com/maialks/ankinlm) filled the flashcard gap, then stopped working after the move to `notebook.google.com`. Satchel restores that flow on both `notebook.google.com` and `notebooklm.google.com`, and packs quizzes the same way.

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
4. Open a notebook, generate flashcards, a quiz, a report, or a mind map, and use the Satchel bar

For live reload while developing: `npm run dev`.

If the bar does not appear, open the flashcard, quiz, or mind map viewer, click **Scan this tab** in the popup, and reload the notebook after installing or updating.

## Import into Anki

1. File → Import
2. Choose `satchel-flashcards.csv` or `satchel-quiz.csv`
3. Field separator: **Tab** (the file is TSV with a `.csv` name, matching AnkiNLM)
4. Field 1 → Front, Field 2 → Back
5. Import

Quiz fronts list the question and labeled options (`A.`, `B.`, …). Backs have the correct option letter(s) and text, plus a rationale when NotebookLM provided one.

The file is UTF-8 with a BOM. Expressions such as `\sin(x)` and `\frac{a}{b}` are unchanged. To render math in Anki, use a MathJax or LaTeX add-on (AnkiNLM suggested Better Markdown Anki, id `2100166052`).

## Download a report

1. In Studio, generate or open a report (briefing doc, study guide, blog post, or a custom report)
2. Use **Download Word** or **Download Markdown** on the Satchel bar
3. The file name follows the report title, for example `Briefing Doc.docx`

Word is a `.docx` file. Markdown keeps headings, lists, tables, and links. Both are built from the report already open in the page.

## Download a mind map

1. In Studio, generate or open a mind map
2. Use **Download map** or **Download image** on the Satchel bar
3. The file name follows the root topic, for example `Root Topic.html`

**Download map** is a single HTML file. It opens offline, starts with every node expanded, and can pan, zoom, and fold branches. **Download image** is an SVG of that same fully expanded tree.

## Privacy

Satchel only runs on NotebookLM and its Studio iframes. There is no account, analytics, or backend.

## Develop

```bash
npm test
npm run compile
npm run build
```

Google can change Studio DOM or iframe URLs. If export breaks after a NotebookLM update, open an issue with the page URL pattern and whether flashcards or a quiz were visible when you clicked Scan.
