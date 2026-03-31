/**
 * "Style C — Typographic" export: shared model + HTML→PDF (html2pdf.js) + DOCX (docx).
 */
import { saveAs } from 'file-saver';
import { getColorDisplayName, HIGHLIGHT_COLORS } from './colors';
import { normalizePdfText } from './pdfText';

export const TYPOGRAPHIC_GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Karla:ital,wght@0,300;0,400;0,500;1,300&family=Overpass+Mono:wght@400;500&display=swap';

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexForKey(key, lensColors) {
  const p = lensColors?.find((c) => c.key === key);
  if (p?.hex) return p.hex;
  return HIGHLIGHT_COLORS[key]?.hex || '#888888';
}

/**
 * @param {object} opts
 * @param {object[]} opts.highlights
 * @param {object} [opts.document]
 * @param {object[]} [opts.lensColors]
 * @param {'sequence'|'topic'|'page'} opts.view
 * @param {string} [opts.analystEmail]
 */
export function buildTypographicExportModel({
  highlights,
  document,
  lensColors = [],
  view,
  analystEmail = '',
}) {
  const colorLabels = document?.color_labels || {};
  const list = highlights || [];
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const rawTitle = (document?.filename || 'Document Summary').replace(/\.pdf$/i, '');
  const titleLines = rawTitle.split(/\r?\n/).filter(Boolean);
  const subtitle = '';
  const commentCount = list.filter((h) => h.note?.content).length;

  /** @type {{ title: string, accentHex: string, items: { page: number, quote: string, comment: string, categoryLine?: string }[] }[]} */
  let sections = [];

  if (view === 'topic') {
    const groups = {};
    for (const h of list) {
      const key = h.color ?? 'uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    }
    for (const [topicKey, items] of Object.entries(groups)) {
      const title =
        items[0]?.color_display_name ??
        getColorDisplayName(topicKey, colorLabels, lensColors);
      sections.push({
        title,
        accentHex: hexForKey(topicKey, lensColors),
        items: items.map((h) => ({
          page: h.page_number,
          quote: normalizePdfText(h.highlighted_text || ''),
          comment: h.note?.content ? normalizePdfText(h.note.content) : '',
        })),
      });
    }
  } else if (view === 'page') {
    const pageGroups = {};
    for (const h of list) {
      const k = h.page_number ?? 0;
      if (!pageGroups[k]) pageGroups[k] = [];
      pageGroups[k].push(h);
    }
    const pages = Object.keys(pageGroups)
      .map((n) => parseInt(n, 10))
      .sort((a, b) => a - b);
    for (const page of pages) {
      sections.push({
        title: `Page ${page}`,
        accentHex: '#888888',
        items: pageGroups[page].map((h) => ({
          page: h.page_number,
          quote: normalizePdfText(h.highlighted_text || ''),
          comment: h.note?.content ? normalizePdfText(h.note.content) : '',
          categoryLine:
            h.color_display_name ??
            getColorDisplayName(h.color, colorLabels, lensColors),
        })),
      });
    }
  } else {
    sections.push({
      showHeading: false,
      title: '',
      accentHex: '#111111',
      items: list.map((h) => ({
        page: h.page_number,
        quote: normalizePdfText(h.highlighted_text || ''),
        comment: h.note?.content ? normalizePdfText(h.note.content) : '',
        categoryLine:
          h.color_display_name ??
          getColorDisplayName(h.color, colorLabels, lensColors),
      })),
    });
  }

  return {
    brand: 'WiseMark',
    dateStr,
    titleLines,
    subtitle,
    analystEmail: analystEmail.trim() || '—',
    annotationCount: list.length,
    commentCount,
    sections,
  };
}

const TYPOGRAPHIC_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .export-root {
    font-family: 'Karla', sans-serif;
    background: #fff;
    color: #111;
    font-size: 12.5pt;
    line-height: 1.6;
    max-width: 740px;
    margin: 0 auto;
    padding: 56px 64px 80px;
  }
  .hd-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
    padding-bottom: 10px;
  }
  .hd-brand {
    font-family: 'Overpass Mono', monospace;
    font-size: 10pt;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #111;
  }
  .hd-date {
    font-family: 'Overpass Mono', monospace;
    font-size: 10pt;
    color: #aaa;
  }
  .hd-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22pt;
    font-weight: 500;
    line-height: 1.25;
    letter-spacing: -0.01em;
    color: #111;
    margin-bottom: 6px;
  }
  .hd-sub {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 17px;
    font-weight: 300;
    color: #888;
    margin-bottom: 28px;
  }
  .hd-title--no-sub {
    margin-bottom: 16px;
  }
  .hd-meta {
    display: flex;
    gap: 28px;
    padding-bottom: 14px;
    flex-wrap: nowrap;
    align-items: flex-start;
    justify-content: flex-start;
  }
  .hd-meta-item {
    min-width: 0;
  }
  .hd-meta-item:first-child {
    flex: 1 1 0;
    min-width: 0;
    padding-right: 12px;
  }
  .hd-meta-item:nth-child(2),
  .hd-meta-item:nth-child(3) {
    flex: 0 0 auto;
    text-align: right;
    white-space: nowrap;
  }
  .hm-label {
    font-family: 'Overpass Mono', monospace;
    font-size: 7.5pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #bbb;
    margin-bottom: 2px;
  }
  .hm-value {
    font-family: 'Karla', sans-serif;
    font-size: 9pt;
    font-weight: 400;
    color: #111;
  }
  .hd-meta-item:first-child .hm-value {
    white-space: nowrap;
  }
  .section { margin-top: 52px; }
  .section.section--no-heading { margin-top: 28px; }
  .sec-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 11pt;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #aaa;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 1.35em;
    break-after: avoid;
    page-break-after: avoid;
  }
  .ann {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 0;
    margin-bottom: 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ann-pg {
    font-family: 'Overpass Mono', monospace;
    font-size: 9pt;
    color: #ccc;
    padding-top: 2pt;
    letter-spacing: 0.05em;
  }
  .ann-body {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ann-seq-cat {
    font-family: 'Overpass Mono', monospace;
    font-size: 8.5pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #bbb;
    margin-bottom: 4px;
  }
  .ann-q {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 10pt;
    font-weight: 400;
    line-height: 1.55;
    color: #555;
    margin-bottom: 3pt;
  }
  .ann-c {
    font-family: 'Cormorant Garamond', serif;
    font-size: 10pt;
    font-style: normal;
    font-weight: 400;
    line-height: 1.55;
    color: #111;
  }
  .ann-divider {
    grid-column: 1 / -1;
    height: 1px;
    background: #f0f0f0;
    margin-top: 10px;
    margin-bottom: 6px;
    break-after: avoid;
    page-break-after: avoid;
  }
  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ann      { break-inside: avoid; page-break-inside: avoid; }
    .ann-body { break-inside: avoid; page-break-inside: avoid; }
    .ann-divider { break-after: avoid; page-break-after: avoid; }
    .sec-title   { break-after: avoid; page-break-after: avoid; }
  }
`;

/** Inner HTML only (inside `.export-root`). */
export function buildTypographicRootContentHtml(model) {
  const titleHtml = model.titleLines.map((line) => escapeHtml(line)).join('<br/>');
  const sub = (model.subtitle || '').trim();
  const titleClass = sub ? 'hd-title' : 'hd-title hd-title--no-sub';
  const subHtml = sub ? `<div class="hd-sub">${escapeHtml(sub)}</div>` : '';

  const sectionsHtml = model.sections
    .map((sec) => {
      const itemsHtml = sec.items
        .map((item, idx) => {
          const cat =
            item.categoryLine != null
              ? `<div class="ann-seq-cat">${escapeHtml(item.categoryLine)}</div>`
              : '';
          const comment = item.comment
            ? `<div class="ann-c">${escapeHtml(item.comment)}</div>`
            : '';
          const divider =
            idx < sec.items.length - 1
              ? '<div class="ann-divider"></div>'
              : '';
          return `
    <div class="ann">
      <div class="ann-pg">p.&nbsp;${item.page}</div>
      <div class="ann-body">
        ${cat}
        <div class="ann-q">${escapeHtml(item.quote)}</div>
        ${comment}
      </div>
      ${divider}
    </div>`;
        })
        .join('');
      const showHeading = sec.showHeading !== false && Boolean(sec.title);
      const headingHtml = showHeading
        ? `<div class="sec-title">
      <span class="sec-accent-wrap"><span class="sec-accent" style="background:${escapeHtml(sec.accentHex)}"></span></span>${escapeHtml(sec.title)}
    </div>`
        : '';
      const sectionClass = showHeading ? 'section' : 'section section--no-heading';
      return `
  <div class="${sectionClass}">
    ${headingHtml}
    ${itemsHtml}
  </div>`;
    })
    .join('');

  return `
  <div class="hd-top">
    <div class="hd-brand">${escapeHtml(model.brand)}</div>
    <div class="hd-date">${escapeHtml(model.dateStr)}</div>
  </div>
  <div class="${titleClass}">${titleHtml}</div>
  ${subHtml}
  <div class="hd-meta">
    <div class="hd-meta-item">
      <div class="hm-label">Analyst</div>
      <div class="hm-value">${escapeHtml(model.analystEmail)}</div>
    </div>
    <div class="hd-meta-item">
      <div class="hm-label">Annotations</div>
      <div class="hm-value">${model.annotationCount}</div>
    </div>
    <div class="hd-meta-item">
      <div class="hm-label">Comments</div>
      <div class="hm-value">${model.commentCount}</div>
    </div>
  </div>
  ${sectionsHtml}`;
}

/**
 * Mounts a full-screen white curtain over the entire app for the duration of the export.
 *
 * html2pdf/html2canvas briefly manipulates scroll position and DOM structure during capture,
 * which causes a visible layout flash (the page collapses and re-expands). The curtain sits
 * at z-index max so any shift underneath is completely hidden from the user.
 */
function mountExportCurtain() {
  const curtain = document.createElement('div');
  curtain.id = 'wisemark-export-curtain';
  curtain.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'background:#fff',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-family:system-ui,sans-serif',
    'font-size:14px',
    'color:#aaa',
    'letter-spacing:0.06em',
    'pointer-events:all',
  ].join(';');
  curtain.textContent = 'Exporting…';
  document.body.appendChild(curtain);
  return curtain;
}

/**
 * Render model to PDF using html2pdf (HTML layout matches Style C).
 */
export async function downloadTypographicPdf(model, baseFilename) {
  const html2pdf = (await import('html2pdf.js')).default;

  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = TYPOGRAPHIC_GOOGLE_FONTS_URL;
  document.head.appendChild(fontLink);

  // Curtain goes up first — before html2pdf touches anything — so the user
  // never sees the layout shift that html2canvas causes internally.
  const curtain = mountExportCurtain();

  // Off-screen container placed far to the left so it is never in the viewport.
  // scrollX: 60000 below tells html2canvas to compensate for this offset.
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText =
    'position:fixed;left:-60000px;top:0;width:740px;background:#fff;pointer-events:none;';
  container.innerHTML = `<style>${TYPOGRAPHIC_CSS}</style><div class="export-root">${buildTypographicRootContentHtml(model)}</div>`;
  document.body.appendChild(container);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    // Give fonts a moment to render into the hidden container before capture.
    await new Promise((r) => setTimeout(r, 600));

    const safeName = `${baseFilename.replace(/\.pdf$/i, '')}-highlights.pdf`;
    await html2pdf()
      .set({
        margin: 8,
        filename: safeName,
        image: { type: 'jpeg', quality: 0.93 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          // Match the container's fixed left offset so html2canvas finds the
          // element without scrolling the main document.
          scrollX: 60000,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(container.querySelector('.export-root'))
      .save();
  } finally {
    // Always clean up, even on error.
    curtain.remove();
    container.remove();
    if (fontLink.parentNode) fontLink.remove();
  }
}

const SZ = {
  mono10: 20,
  mono9: 18,
  mono85: 17,
  monoMetaLabel: 15,
  sansMeta: 18,
  serif17: 34,
  serifTitle: 44,
  serif11: 22,
  body10: 20,
};

/** Word export: same hierarchy; fonts are common Office families so Word does not fall back to Times. */
export async function downloadTypographicDocx(model, baseFilename) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
  } = await import('docx');

  const noTableBorder = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
  };

  const MONO = 'Consolas';
  const SERIF = 'Georgia';
  const SANS = 'Calibri';

  const children = [];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [4500, 4500],
      borders: noTableBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: model.brand,
                      font: MONO,
                      size: SZ.mono10,
                      characterSpacing: 40,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: model.dateStr,
                      font: MONO,
                      size: SZ.mono10,
                      color: 'AAAAAA',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ spacing: { after: 40 }, children: [] }));

  for (const line of model.titleLines) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: line, font: SERIF, size: SZ.serifTitle })],
      })
    );
  }

  if ((model.subtitle || '').trim()) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: model.subtitle,
            font: SERIF,
            size: SZ.serif17,
            italics: true,
            color: '888888',
          }),
        ],
      })
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3000, 2500, 2500],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'ANALYST',
                      font: MONO,
                      size: SZ.monoMetaLabel,
                      color: 'BBBBBB',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: model.analystEmail,
                      font: SANS,
                      size: SZ.sansMeta,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'ANNOTATIONS',
                      font: MONO,
                      size: SZ.monoMetaLabel,
                      color: 'BBBBBB',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(model.annotationCount),
                      font: SANS,
                      size: SZ.sansMeta,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'COMMENTS',
                      font: MONO,
                      size: SZ.monoMetaLabel,
                      color: 'BBBBBB',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(model.commentCount),
                      font: SANS,
                      size: SZ.sansMeta,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  for (const sec of model.sections) {
    if (sec.showHeading !== false && sec.title) {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 140 },
          children: [
            new TextRun({
              text: sec.title.toUpperCase(),
              font: SERIF,
              size: SZ.serif11,
              color: 'AAAAAA',
              characterSpacing: 44,
            }),
          ],
        })
      );
    } else {
      children.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [] }));
    }

    const n = sec.items.length;
    sec.items.forEach((item, idx) => {
      const rightChildren = [];
      if (item.categoryLine) {
        rightChildren.push(
          new Paragraph({
            spacing: { after: 50 },
            children: [
              new TextRun({
                text: item.categoryLine.toUpperCase(),
                font: MONO,
                size: SZ.mono85,
                color: 'BBBBBB',
                characterSpacing: 28,
              }),
            ],
          })
        );
      }
      rightChildren.push(
        new Paragraph({
          spacing: { after: item.comment ? 60 : 50 },
          children: [
            new TextRun({
              text: item.quote,
              font: SERIF,
              size: SZ.body10,
              italics: true,
              color: '555555',
            }),
          ],
        })
      );
      if (item.comment) {
        rightChildren.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: item.comment,
                font: SERIF,
                size: SZ.body10,
                color: '111111',
              }),
            ],
          })
        );
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [720, 8380],
          borders: noTableBorder,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 720, type: WidthType.DXA },
                  margins: { top: 30 },
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `p. ${item.page}`,
                          font: MONO,
                          size: SZ.mono9,
                          color: 'CCCCCC',
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                  children: rightChildren,
                }),
              ],
            }),
          ],
        })
      );

      if (idx < n - 1) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'F0F0F0', space: 2 },
            },
            children: [],
          })
        );
      }
    });
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${baseFilename.replace(/\.pdf$/i, '')}-highlights.docx`);
}