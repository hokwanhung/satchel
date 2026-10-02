// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { injectExportBar, injectReportBar } from '../lib/inject-ui';
import { reportToMarkdown } from '../lib/markdown';
import { extractReport } from '../lib/report';

const reportHtml = `
  <artifact-viewer id="preview">
    <div class="paragraph normal">Short</div>
  </artifact-viewer>
  <artifact-viewer id="open">
    <div class="artifact-title">Briefing Doc</div>
    <div class="elements-container">
      <div class="paragraph heading1">Overview</div>
      <div class="paragraph normal">Water moves by <strong>osmosis</strong> [1, 2].</div>
      <paragraph-element-view>
        <div class="paragraph list-item">First point</div>
      </paragraph-element-view>
      <paragraph-element-view>
        <div class="paragraph list-item">Second point</div>
      </paragraph-element-view>
      <div class="paragraph list-item"><span class="list-marker">1.</span> One</div>
      <div class="paragraph list-item"><span class="list-marker">2.</span> Two</div>
      <table>
        <tr>
          <th><div class="paragraph table-paragraph">A</div></th>
          <th><div class="paragraph table-paragraph">B</div></th>
        </tr>
        <tr>
          <td><div class="paragraph table-paragraph">1</div></td>
          <td><div class="paragraph table-paragraph">2</div></td>
        </tr>
      </table>
      <div class="paragraph normal">-----</div>
      <p>See <a href="https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa&amp;sa=D">example</a>.</p>
    </div>
    <div class="artifact-footer"></div>
  </artifact-viewer>
`;

describe('extractReport', () => {
  it('reads the open Studio report, not previews, chat, or source viewers', () => {
    document.body.innerHTML = reportHtml;
    const report = extractReport(document);

    expect(report?.title).toBe('Briefing Doc');
    expect(report?.blocks).toEqual([
      { type: 'heading', level: 1, inlines: [{ text: 'Overview' }] },
      {
        type: 'paragraph',
        inlines: [
          { text: 'Water moves by ' },
          { text: 'osmosis', bold: true },
          { text: ' [1, 2].' },
        ],
      },
      {
        type: 'list',
        ordered: false,
        items: [[{ text: 'First point' }], [{ text: 'Second point' }]],
      },
      {
        type: 'list',
        ordered: true,
        items: [[{ text: 'One' }], [{ text: 'Two' }]],
      },
      {
        type: 'table',
        header: true,
        rows: [
          [[{ text: 'A' }], [{ text: 'B' }]],
          [[{ text: '1' }], [{ text: '2' }]],
        ],
      },
      { type: 'rule' },
      {
        type: 'paragraph',
        inlines: [
          { text: 'See ' },
          { text: 'example', href: 'https://example.com/a' },
          { text: '.' },
        ],
      },
    ]);
    expect(reportToMarkdown(report!)).toContain('[1, 2]');
    expect(reportToMarkdown(report!)).toContain('[example](https://example.com/a)');
  });

  it('accepts ordinary HTML headings and lists', () => {
    document.body.innerHTML = `
      <labs-tailwind-doc-viewer>
        <h2>Notes</h2>
        <ul>
          <li>Alpha</li>
          <li>Beta</li>
        </ul>
      </labs-tailwind-doc-viewer>
    `;

    expect(extractReport(document)).toEqual({
      title: 'Notes',
      blocks: [
        { type: 'heading', level: 2, inlines: [{ text: 'Notes' }] },
        {
          type: 'list',
          ordered: false,
          items: [[{ text: 'Alpha' }], [{ text: 'Beta' }]],
        },
      ],
    });
  });

  it('ignores chat, imported source reports, and empty study viewers', () => {
    document.body.innerHTML = `
      <div class="chat-panel">
        <div class="elements-container">
          <div class="paragraph heading1">Nope</div>
        </div>
      </div>
      <source-viewer>
        <labs-tailwind-doc-viewer>
          <div class="elements-container">
            <div class="paragraph heading1">Imported</div>
          </div>
        </labs-tailwind-doc-viewer>
      </source-viewer>
      <artifact-viewer>
        <iframe></iframe>
        <div class="artifact-footer"></div>
      </artifact-viewer>
    `;

    expect(extractReport(document)).toBeNull();
  });

  it('adds Word and Markdown actions without removing the CSV bar', () => {
    document.body.innerHTML = reportHtml;
    const report = extractReport(document);
    expect(report).not.toBeNull();
    if (!report) return;

    expect(injectExportBar([{ front: 'Q', back: 'A' }], document, 'quiz')).toBe(true);
    expect(injectReportBar(report, document)).toBe(true);

    expect(document.querySelector('[data-satchel-download]')?.textContent).toBe('Download CSV');
    expect(document.querySelector('[data-satchel-word]')?.textContent).toBe('Download Word');
    expect(document.querySelector('[data-satchel-markdown]')?.textContent).toBe('Download Markdown');
    expect(document.querySelector('#satchel-export-root [data-satchel-status]')?.textContent).toBe(
      '1 questions ready',
    );
    expect(document.querySelector('#satchel-report-root [data-satchel-status]')?.textContent).toBe(
      'Report ready',
    );
    expect(document.querySelector('#open .artifact-footer #satchel-report-root')).not.toBeNull();
    expect(document.querySelector('#preview #satchel-report-root')).toBeNull();
  });
});
