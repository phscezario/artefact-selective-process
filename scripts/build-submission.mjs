import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { marked } from 'marked';

/**
 * Builds the written-case PDF from the Markdown answers.
 *
 * Markdown -> HTML (with a cover page and a table of contents) -> headless Chrome
 * printing to A4. Images are referenced relative to docs/answers, and a <base>
 * tag pointing at that folder is what makes ../screenshots/*.png resolve while
 * the HTML file itself lives in submission/.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const ANSWERS_DIR = path.join(ROOT, 'docs', 'answers');
const OUT_DIR = path.join(ROOT, 'submission');
const HTML_FILE = path.join(OUT_DIR, 'answers.html');
const PDF_FILE = path.join(OUT_DIR, 'Paulo Cezario - Software Engineer Sênior Brazil.pdf');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const PARTS = [
  {
    file: 'part-1-theory.md',
    title: 'Part 1 — Theoretical questions',
    prefix: 'p1',
  },
  {
    file: 'part-2-practical.md',
    title: 'Part 2 — Practical case',
    prefix: 'p2',
  },
];

function stripTags(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Adds stable ids to the headings and collects the h2s so the table of contents
 * does not need a second Markdown parse.
 */
function withHeadingIds(html, prefix) {
  const entries = [];
  let index = 0;

  const output = html.replace(/<h([12])>([\s\S]*?)<\/h\1>/g, (match, level, inner) => {
    const id = `${prefix}-${index}`;
    index += 1;

    if (level === '2') {
      // The heading already carries its own number ("1. ..."); the <ol> in the
      // table of contents adds one, so drop the manual prefix there.
      entries.push({ id, label: stripTags(inner).replace(/^\d+\.\s+/, '') });
    }

    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

  return { html: output, entries };
}

const css = `
  @page {
    size: A4;
    margin: 17mm 16mm 18mm;
  }

  * {
    box-sizing: border-box;
  }

  html {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    margin: 0;
    color: #16191f;
    font-family: 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.4pt;
    line-height: 1.55;
  }

  a {
    color: #4338ca;
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  /* ---------- Cover ---------- */

  .cover {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 253mm;
    break-after: page;
  }

  .cover-top {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: #4338ca;
  }

  .cover-mark {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: #4f46e5;
    color: #ffffff;
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0;
  }

  .cover-main {
    margin-top: 40mm;
  }

  .cover h1 {
    margin: 0;
    font-size: 34pt;
    line-height: 1.06;
    letter-spacing: -0.03em;
    font-weight: 700;
  }

  .cover-role {
    margin: 10mm 0 0;
    font-size: 15pt;
    font-weight: 600;
    color: #4f46e5;
  }

  .cover-subtitle {
    margin: 5mm 0 0;
    max-width: 125mm;
    font-size: 11pt;
    color: #4a5160;
  }

  .cover-rule {
    width: 100%;
    height: 3px;
    margin: 12mm 0 0;
    background: linear-gradient(90deg, #4f46e5 0%, #a5b4fc 55%, #e5e7eb 100%);
    border-radius: 2px;
  }

  .cover-meta {
    display: grid;
    grid-template-columns: 26mm 1fr;
    gap: 2mm 4mm;
    padding-top: 8mm;
    border-top: 1px solid #e1e4e9;
    font-size: 9.6pt;
  }

  .cover-meta dt {
    color: #6b7280;
    font-weight: 600;
  }

  .cover-meta dd {
    margin: 0;
  }

  /* ---------- Table of contents ---------- */

  .toc {
    break-after: page;
  }

  .toc h1 {
    margin: 0 0 8mm;
    font-size: 20pt;
    letter-spacing: -0.02em;
  }

  .toc-part {
    margin-top: 7mm;
  }

  .toc-label {
    margin: 0;
    font-size: 9.6pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4f46e5;
  }

  .toc ol {
    margin: 2.5mm 0 0;
    padding-left: 7mm;
    font-size: 10.6pt;
  }

  .toc li {
    margin: 1.6mm 0;
  }

  .toc li::marker {
    color: #9aa1ae;
  }

  .toc a {
    color: #16191f;
  }

  /* ---------- Parts ---------- */

  .part + .part {
    break-before: page;
  }

  .part > h1:first-child {
    margin: 0 0 9mm;
    padding-bottom: 4mm;
    border-bottom: 2px solid #4f46e5;
    font-size: 21pt;
    letter-spacing: -0.02em;
  }

  h2 {
    margin: 9mm 0 3mm;
    font-size: 13.2pt;
    letter-spacing: -0.01em;
    break-after: avoid;
  }

  h3 {
    margin: 7mm 0 2mm;
    font-size: 11.4pt;
    break-after: avoid;
  }

  p {
    margin: 0 0 3.4mm;
    text-align: left;
  }

  strong {
    font-weight: 650;
  }

  ul,
  ol {
    margin: 0 0 3.6mm;
    padding-left: 6mm;
  }

  li {
    margin: 1.2mm 0;
  }

  li > p {
    margin: 0;
  }

  hr {
    margin: 8mm 0;
    border: none;
    border-top: 1px solid #e1e4e9;
  }

  blockquote {
    margin: 0 0 4mm;
    padding: 3mm 4mm;
    border-left: 3px solid #c7d2fe;
    background: #f6f7ff;
    color: #3d4351;
  }

  blockquote p:last-child {
    margin-bottom: 0;
  }

  code {
    padding: 0.6mm 1.4mm;
    border-radius: 3px;
    background: #f1f2f5;
    font-family: 'Cascadia Code', Consolas, 'Liberation Mono', monospace;
    font-size: 8.9pt;
  }

  pre {
    margin: 0 0 4mm;
    padding: 3.4mm 4mm;
    background: #f7f8fa;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    overflow: hidden;
    break-inside: avoid;
  }

  pre code {
    padding: 0;
    background: none;
    font-size: 8.3pt;
    line-height: 1.45;
  }

  table {
    width: 100%;
    margin: 0 0 5mm;
    border-collapse: collapse;
    font-size: 9pt;
    line-height: 1.4;
  }

  thead {
    display: table-header-group;
  }

  th,
  td {
    padding: 2mm 2.4mm;
    border: 1px solid #e1e4e9;
    text-align: left;
    vertical-align: top;
  }

  th {
    background: #f5f6f9;
    font-weight: 650;
  }

  /* ---------- Figures ---------- */

  img {
    display: block;
    width: 100%;
    max-height: 165mm;
    object-fit: contain;
    object-position: top;
    margin: 3mm 0 2mm;
    border: 1px solid #dfe3e9;
    border-radius: 5px;
  }

  p:has(> img) {
    break-inside: avoid;
    margin-bottom: 0;
  }

  p:has(> em:only-child) {
    margin: 0 0 5mm;
    font-size: 8.9pt;
    color: #5b6270;
    text-align: center;
  }
`;

function buildHtml(renderedParts) {
  const toc = renderedParts
    .map(
      (part) => `
        <section class="toc-part">
          <p class="toc-label">${part.title}</p>
          <ol>
            ${part.entries.map((entry) => `<li><a href="#${entry.id}">${entry.label}</a></li>`).join('')}
          </ol>
        </section>`,
    )
    .join('');

  const body = renderedParts
    .map((part) => `<section class="part">${part.html}</section>`)
    .join('\n');

  const baseHref = `${pathToFileURL(ANSWERS_DIR).href}/`;
  const generatedOn = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <base href="${baseHref}" />
    <title>Paulo Cezario - Software Engineer Sênior Brazil</title>
    <style>${css}</style>
  </head>
  <body>
    <section class="cover">
      <div class="cover-top">
        <span class="cover-mark">✓</span>
        <span>Artefact · Software Engineer (Senior, Brazil)</span>
      </div>

      <div class="cover-main">
        <h1>Written case</h1>
        <p class="cover-role">Paulo Cezario</p>
        <p class="cover-subtitle">
          Theory and practice of rendering, backend approaches and tRPC, followed by a task manager
          built with Next.js 15 and a transport-agnostic tRPC backend.
        </p>
        <div class="cover-rule"></div>
      </div>

      <dl class="cover-meta">
        <dt>Candidate</dt>
        <dd>Paulo Cezario</dd>
        <dt>Role</dt>
        <dd>Software Engineer · Senior · Brazil</dd>
        <dt>Repository</dt>
        <dd>github.com/phscezario/artefact-selective-process</dd>
        <dt>Date</dt>
        <dd>${generatedOn}</dd>
      </dl>
    </section>

    <section class="toc">
      <h1>Contents</h1>
      ${toc}
    </section>

    ${body}
  </body>
</html>
`;
}

async function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));

  if (!found) {
    throw new Error(
      'Chrome or Edge was not found. Install one, or print submission/answers.html manually.',
    );
  }

  return found;
}

function printToPdf(chromePath, url, outputPath) {
  const profileDir = path.join(
    process.env.TEMP ?? process.env.TMPDIR ?? '.',
    `chrome-pdf-${Date.now()}`,
  );

  return new Promise((resolve, reject) => {
    const chrome = spawn(
      chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--allow-file-access-from-files',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=15000',
        '--no-pdf-header-footer',
        `--user-data-dir=${profileDir}`,
        `--print-to-pdf=${outputPath}`,
        url,
      ],
      { stdio: 'ignore' },
    );

    chrome.on('error', reject);
    chrome.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Chrome exited with code ${code} while printing the PDF.`));
      }
    });
  });
}

await mkdir(OUT_DIR, { recursive: true });

const renderedParts = [];

for (const part of PARTS) {
  const markdown = await readFile(path.join(ANSWERS_DIR, part.file), 'utf8');
  const html = marked.parse(markdown);
  const { html: withIds, entries } = withHeadingIds(html, part.prefix);

  renderedParts.push({ ...part, html: withIds, entries });
  console.info(`[submission] ${part.file}: ${entries.length} sections`);
}

await writeFile(HTML_FILE, buildHtml(renderedParts), 'utf8');

const chromePath = await findChrome();
await rm(PDF_FILE, { force: true });
await printToPdf(chromePath, pathToFileURL(HTML_FILE).href, PDF_FILE);

console.info(`[submission] PDF written to ${PDF_FILE}`);
