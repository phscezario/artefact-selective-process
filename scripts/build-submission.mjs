import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { marked } from 'marked';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Builds the submission PDF from the Markdown sources.
 *
 * Markdown -> HTML (with a cover and a table of contents) -> headless Chrome
 * printing to A4 -> pdf-lib stamping the footer and the document metadata.
 *
 * The form has a single upload field ("Theoretical Questions or Documentation"),
 * so one file carries everything: the theoretical answers, the practical case and
 * the repository README as an appendix.
 *
 * Each part declares its own base directory: the parts come from `docs/answers`
 * and the repository root, so relative images are resolved to absolute `file://`
 * URLs before the single HTML file is written.
 *
 * The PDF is printed into `submission/` (gitignored, the copy uploaded to the
 * form) and copied to `docs/answers/` (committed, so the repository links to the
 * same document that was submitted).
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const ANSWERS_DIR = path.join(ROOT, 'docs', 'answers');
const OUT_DIR = path.join(ROOT, 'submission');
const PUBLISH_DIR = ANSWERS_DIR;

const AUTHOR = 'Paulo Cezario';
const ROLE = 'Software Engineer · Senior · Brazil';
const REPO_LABEL = 'github.com/phscezario/artefact-selective-process';
const REPO_URL = 'https://github.com/phscezario/artefact-selective-process';
const PDF_BASENAME = 'Paulo Cezario - Software Engineer Sênior Brazil';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/**
 * One submission, one PDF: the form has a single upload field ("Theoretical
 * Questions or Documentation"), so the README travels as the appendix instead of
 * as a second file.
 */
const DOCUMENT_PARTS = [
  {
    file: path.join(ANSWERS_DIR, 'part-1-theory.md'),
    baseDir: ANSWERS_DIR,
    title: 'Part 1 — Theoretical questions',
    prefix: 'p1',
  },
  {
    file: path.join(ANSWERS_DIR, 'part-2-practical.md'),
    baseDir: ANSWERS_DIR,
    title: 'Part 2 — Practical case',
    prefix: 'p2',
  },
  {
    file: path.join(ROOT, 'README.md'),
    baseDir: ROOT,
    title: 'Appendix — Project README',
    prefix: 'rm',
    appendix: true,
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
      // The answers already carry their own number ("1. ..."); the <ol> in the
      // table of contents adds one, so drop the manual prefix there.
      entries.push({ id, label: stripTags(inner).replace(/^\d+\.\s+/, '') });
    }

    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

  return { html: output, entries };
}

/**
 * A PDF cannot navigate to a repository-relative path, so links are rewritten to
 * their GitHub equivalent. Images keep their relative `src`: they are resolved by
 * the `<base>` tag pointing at the source folder.
 */
function absoluteLinks(html) {
  return html.replace(/<a href="([^"]*)"/g, (match, href) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) {
      return match;
    }

    const target = href.replace(/^\.\//, '').replace(/^\/+/, '');
    const kind = path.extname(target) ? 'blob' : 'tree';

    return `<a href="${REPO_URL}/${kind}/main/${target}"`;
  });
}

const BOX_DRAWING_CHARS = /[┌└├┼│─╔╚║═]/;

/**
 * Images are resolved against the base directory of the Markdown they came from,
 * so one HTML file can mix `docs/answers` and the repository root.
 */
function absoluteImages(html, baseDir) {
  return html.replace(/<img([^>]*?)src="([^"]*)"/g, (match, prefix, src) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src)) {
      return match;
    }

    return `<img${prefix}src="${pathToFileURL(path.resolve(baseDir, src)).href}"`;
  });
}

/**
 * Marks ASCII diagrams so they are printed with a line height equal to the glyph
 * box (see `pre.diagram`). Only diagrams need it: flattening a regular code block
 * would just make it cramped.
 */
function markDiagrams(html) {
  return html.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (match, attributes, code) =>
    BOX_DRAWING_CHARS.test(code)
      ? `<pre class="diagram"><code${attributes}>${code}</code></pre>`
      : match,
  );
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
    font-family: Consolas, 'Cascadia Code', 'Liberation Mono', monospace;
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

  /*
   * ASCII diagrams. Box-drawing glyphs only touch when the line box matches the
   * em box; at the default line height the vertical borders become dashed lines
   * in print. The size goes on the block, not on the <code>, so the line box is
   * built from the diagram's own strut instead of the body font's.
   */
  pre.diagram {
    font-size: 7.9pt;
    line-height: 1;
  }

  pre.diagram code {
    font-size: inherit;
    line-height: 1;
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
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 108mm;
    object-fit: contain;
    object-position: top;
    margin: 3mm auto 2mm;
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
    /* A caption stranded on the next page does not explain anything. */
    break-before: avoid;
  }

  /* ---------- Cover (written case) ---------- */

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

  /* ---------- Table of contents (written case) ---------- */

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

  /* ---------- Parts (written case) ---------- */

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

  /* ---------- Table of contents (three parts on one page) ---------- */

  .toc-combined .toc-part {
    margin-top: 5.5mm;
  }

  .toc-combined li {
    margin: 1.1mm 0;
  }

  /* ---------- README specifics: denser, print-friendly ---------- */

  .doc-readme {
    line-height: 1.5;
  }

  .doc-readme h2 {
    margin: 7mm 0 2.4mm;
    padding-bottom: 1.4mm;
    border-bottom: 1px solid #e5e7eb;
    font-size: 13.6pt;
  }

  .doc-readme h3 {
    font-size: 11pt;
  }

  .doc-readme table {
    font-size: 8.4pt;
    line-height: 1.35;
  }

  .doc-readme th,
  .doc-readme td {
    padding: 1.6mm 2mm;
  }

  .doc-readme tbody tr {
    break-inside: avoid;
  }

  .doc-readme pre code {
    font-size: 7.9pt;
  }

  .doc-readme img {
    margin-top: 1mm;
  }
`;

function pageShell({ lang = 'en', title, baseDir, extraClass = '', body }) {
  const baseHref = `${pathToFileURL(baseDir).href}/`;
  const classes = ['doc', extraClass].filter(Boolean).join(' ');

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <base href="${baseHref}" />
    <title>${title}</title>
    <style>${css}</style>
  </head>
  <body class="${classes}">
    ${body}
  </body>
</html>
`;
}

const generatedOn = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());

async function buildSubmissionHtml() {
  const renderedParts = [];

  for (const part of DOCUMENT_PARTS) {
    const markdown = await readFile(part.file, 'utf8');
    let html = markDiagrams(marked.parse(markdown));

    if (part.appendix) {
      // The README title becomes the appendix heading, so every part keeps a
      // single h1.
      html = html.replace(/<h1>[\s\S]*?<\/h1>/, '');
    }

    const { html: withIds, entries } = withHeadingIds(
      absoluteImages(absoluteLinks(html), part.baseDir),
      part.prefix,
    );

    renderedParts.push({ ...part, html: withIds, entries });
    console.info(`[submission] ${path.basename(part.file)}: ${entries.length} sections`);
  }

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
    .map(
      (part) => `
        <section class="part${part.appendix ? ' doc-readme' : ''}">
          ${part.appendix ? `<h1>${part.title}</h1>` : ''}
          ${part.html}
        </section>`,
    )
    .join('\n');

  return pageShell({
    title: PDF_BASENAME,
    baseDir: ROOT,
    body: `
    <section class="cover">
      <div class="cover-top">
        <span class="cover-mark">✓</span>
        <span>Artefact · Software Engineer (Senior, Brazil)</span>
      </div>

      <div class="cover-main">
        <h1>Written case</h1>
        <p class="cover-role">${AUTHOR}</p>
        <p class="cover-subtitle">
          Theory and practice of rendering, backend approaches and tRPC, followed by a task manager
          built with Next.js 15 and a transport-agnostic tRPC backend. The appendix is the project
          README: how to run, test and verify the result.
        </p>
        <div class="cover-rule"></div>
      </div>

      <dl class="cover-meta">
        <dt>Candidate</dt>
        <dd>${AUTHOR}</dd>
        <dt>Role</dt>
        <dd>${ROLE}</dd>
        <dt>Repository</dt>
        <dd>${REPO_LABEL}</dd>
        <dt>Contents</dt>
        <dd>Theoretical questions · practical case · README</dd>
        <dt>Date</dt>
        <dd>${generatedOn}</dd>
      </dl>
    </section>

    <section class="toc toc-combined">
      <h1>Contents</h1>
      ${toc}
    </section>

    ${body}`,
  });
}

const DOCUMENTS = [
  {
    id: 'submission',
    htmlFile: path.join(OUT_DIR, 'submission.html'),
    pdfFile: path.join(OUT_DIR, `${PDF_BASENAME}.pdf`),
    build: buildSubmissionHtml,
    footer: {
      left: `${AUTHOR} · ${ROLE} · Written case`,
      skipFirstPage: true,
    },
    meta: {
      title: `${PDF_BASENAME} — written case and documentation`,
      subject:
        'Written case (theory and practice) plus the README of a Next.js 15 + tRPC task manager',
      keywords: [
        'written case',
        'README',
        'Next.js',
        'tRPC',
        'TypeScript',
        'software engineer',
        'task manager',
      ],
    },
  },
];

async function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));

  if (!found) {
    throw new Error(
      'Chrome or Edge was not found. Install one, or print the generated HTML files manually.',
    );
  }

  return found;
}

function printToPdf(chromePath, url, outputPath) {
  const profileDir = path.join(
    process.env.TEMP ?? process.env.TMPDIR ?? '.',
    `chrome-pdf-${Date.now()}-${path.basename(outputPath, '.pdf')}`,
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

const FOOTER_COLOR = rgb(0.42, 0.45, 0.5);
const FOOTER_RULE = rgb(0.88, 0.9, 0.92);
/** 1mm in PostScript points. */
const mm = (value) => (value * 72) / 25.4;

/**
 * Chrome does not write page numbers or metadata, so the printed file is reopened
 * and finished here: a footer on every page (except the cover, when asked), the
 * page count, and the document properties a reader shows in its title bar.
 */
async function finishPdf(filePath, { footer, meta }) {
  const pdf = await PDFDocument.load(await readFile(filePath));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const total = pages.length;
  const size = 7.5;
  const left = `${footer.left}`;

  pages.forEach((page, index) => {
    if (footer.skipFirstPage && index === 0) {
      return;
    }

    const { width } = page.getSize();
    const y = mm(9);
    const label = `Page ${index + 1} of ${total}`;

    page.drawText(left, { x: mm(16), y, size, font, color: FOOTER_COLOR });
    page.drawText(label, {
      x: width - mm(16) - font.widthOfTextAtSize(label, size),
      y,
      size,
      font,
      color: FOOTER_COLOR,
    });
    page.drawLine({
      start: { x: mm(16), y: y + mm(3.4) },
      end: { x: width - mm(16), y: y + mm(3.4) },
      thickness: 0.5,
      color: FOOTER_RULE,
    });
  });

  pdf.setTitle(meta.title);
  pdf.setAuthor(AUTHOR);
  pdf.setSubject(meta.subject);
  pdf.setKeywords(meta.keywords);
  pdf.setCreator('scripts/build-submission.mjs');
  pdf.setProducer('Chrome headless + pdf-lib');
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());

  await writeFile(filePath, await pdf.save());

  return total;
}

await mkdir(OUT_DIR, { recursive: true });
const chromePath = await findChrome();

for (const document of DOCUMENTS) {
  const html = await document.build();

  await writeFile(document.htmlFile, html, 'utf8');
  await rm(document.pdfFile, { force: true });
  await printToPdf(chromePath, pathToFileURL(document.htmlFile).href, document.pdfFile);

  const pageCount = await finishPdf(document.pdfFile, document);
  console.info(`[submission] ${path.basename(document.pdfFile)}: ${pageCount} pages`);

  // The committed copy lives next to the Markdown it was generated from.
  const published = path.join(PUBLISH_DIR, path.basename(document.pdfFile));
  await copyFile(document.pdfFile, published);
  console.info(`[submission] copied to ${path.relative(ROOT, published)}`);
}
