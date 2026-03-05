import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicDocumentsAPI } from '../lib/api';
import {
  HIGHLIGHT_COLOR_KEYS,
  getColorDisplayName,
  hexToRgba,
} from '../lib/colors';
import { normalizePdfText } from '../lib/pdfText';
import { pageWrapper, text, bg, border, btnPrimary } from '../lib/theme';
import {
  FileText,
  FileDown,
  Braces,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  BookOpen,
} from 'lucide-react';

export default function PublicSummaryPage() {
  const { token: tokenParam } = useParams();
  const token = tokenParam ? String(tokenParam).trim() : '';

  const [view, setView] = useState('sequence');
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [showExport, setShowExport] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-summary', token],
    queryFn: async () => {
      const res = await publicDocumentsAPI.getSummary(token);
      return res.data;
    },
    enabled: !!token,
  });

  const document = data?.document;
  const highlights = data?.highlights ?? [];

  const lensColors = useMemo(
    () => document?.highlight_preset_detail?.colors ?? [],
    [document?.highlight_preset_detail?.colors]
  );

  const documentColorKeys = useMemo(() => {
    if (lensColors?.length) return lensColors.map((c) => c.key);
    const keys = Object.keys(document?.color_labels || {});
    return keys.length > 0 ? keys : [...HIGHLIGHT_COLOR_KEYS];
  }, [lensColors, document?.color_labels]);

  const filteredHighlights = useMemo(() => {
    let list = highlights || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          (h.highlighted_text &&
            h.highlighted_text.toLowerCase().includes(q)) ||
          (h.note?.content && h.note.content.toLowerCase().includes(q))
      );
    }
    if (activeFilters.size > 0) {
      list = list.filter((h) => activeFilters.has(h.color));
    }
    return list;
  }, [highlights, search, activeFilters]);

  const groupedByTopic = useMemo(() => {
    const groups = {};
    for (const h of filteredHighlights) {
      const key = h.color ?? 'uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    }
    return groups;
  }, [filteredHighlights]);

  const groupedByPage = useMemo(() => {
    const groups = {};
    for (const h of filteredHighlights) {
      const key = `page-${h.page_number ?? 0}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    }
    const keys = Object.keys(groups).sort(
      (a, b) =>
        parseInt(a.replace('page-', ''), 10) -
        parseInt(b.replace('page-', ''), 10)
    );
    return keys.map((k) => ({
      key: k,
      page: parseInt(k.replace('page-', ''), 10),
      items: groups[k],
    }));
  }, [filteredHighlights]);

  const handleExportJSON = useCallback(() => {
    const payload = {
      filename: document?.filename,
      exportedAt: new Date().toISOString(),
      highlights: filteredHighlights.map((h) => ({
        id: h.id,
        page_number: h.page_number,
        category_name:
          h.color_display_name ??
          getColorDisplayName(
            h.color,
            document?.color_labels,
            lensColors
          ),
        highlighted_text: h.highlighted_text,
        note: h.note?.content,
        created_at: h.created_at,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${(document?.filename || 'summary').replace(
      /\.pdf$/i,
      ''
    )}-highlights.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  }, [document?.filename, document?.color_labels, filteredHighlights, lensColors]);

  const handleExportDocx = useCallback(async () => {
    try {
      const { Document, Packer, Paragraph, TextRun } = await import('docx');
      const { saveAs } = await import('file-saver');
      const children = [
        new Paragraph({
          children: [
            new TextRun({
              text: document?.filename ?? 'Document Summary',
              bold: true,
              size: 28,
            }),
          ],
          spacing: { after: 200 },
        }),
      ];
      if (view === 'sequence') {
        for (const h of filteredHighlights) {
          const colorDisplay =
            h.color_display_name ??
            getColorDisplayName(
              h.color,
              document?.color_labels,
              lensColors
            );
          const quote = h.highlighted_text || '';
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${colorDisplay}: `,
                  bold: true,
                  size: 22,
                }),
                new TextRun({
                  text: `"${quote}"`,
                  size: 22,
                }),
                new TextRun({
                  text: `, `,
                  size: 22,
                }),
                new TextRun({
                  text: `p.${h.page_number}`,
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: {
                before: 120,
                after: h.note?.content ? 20 : 60,
              },
            })
          );
          if (h.note?.content) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: h.note.content,
                    italics: true,
                    size: 20,
                  }),
                ],
                spacing: { after: 80 },
              })
            );
          }
        }
      } else if (view === 'topic') {
        for (const [topicKey, items] of Object.entries(groupedByTopic)) {
          const name =
            items[0]?.color_display_name ??
            getColorDisplayName(
              topicKey,
              document?.color_labels,
              lensColors
            );
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: name,
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { before: 160, after: 40 },
            })
          );
          for (const h of items) {
            const quote = h.highlighted_text || '';
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({
                    text: `"${quote}"`,
                    size: 22,
                  }),
                  new TextRun({
                    text: `, `,
                    size: 22,
                  }),
                  new TextRun({
                    text: `p.${h.page_number}`,
                    italics: true,
                    size: 20,
                  }),
                ],
              })
            );
            if (h.note?.content) {
              children.push(
                new Paragraph({
                  bullet: { level: 1 },
                  children: [
                    new TextRun({
                      text: h.note.content,
                      size: 20,
                    }),
                  ],
                })
              );
            }
          }
        }
      } else if (view === 'page') {
        for (const { page, items } of groupedByPage) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Page ${page}`,
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { before: 160, after: 40 },
            })
          );
          for (const h of items) {
            const colorDisplay =
              h.color_display_name ??
              getColorDisplayName(
                h.color,
                document?.color_labels,
                lensColors
              );
            const quote = h.highlighted_text || '';
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({
                    text: `${colorDisplay}: `,
                    bold: true,
                    size: 22,
                  }),
                  new TextRun({
                    text: `"${quote}"`,
                    size: 22,
                  }),
                  new TextRun({
                    text: `, `,
                    size: 22,
                  }),
                  new TextRun({
                    text: `p.${h.page_number}`,
                    italics: true,
                    size: 20,
                  }),
                ],
              })
            );
            if (h.note?.content) {
              children.push(
                new Paragraph({
                  bullet: { level: 1 },
                  children: [
                    new TextRun({
                      text: h.note.content,
                      size: 20,
                    }),
                  ],
                })
              );
            }
          }
        }
      }
      const docxDoc = new Document({
        sections: [{ children }],
      });
      const blob = await Packer.toBlob(docxDoc);
      saveAs(
        blob,
        `${(document?.filename || 'summary').replace(
          /\.pdf$/i,
          ''
        )}-highlights.docx`
      );
      setShowExport(false);
    } catch (err) {
      console.error('Public export docx failed', err);
    }
  }, [document?.filename, document?.color_labels, filteredHighlights, lensColors, view, groupedByTopic, groupedByPage]);

  const handleExportPdf = useCallback(async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const { saveAs } = await import('file-saver');
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(16);
      doc.text(document?.filename ?? 'Document Summary', 20, y);
      y += 12;
      doc.setFont(undefined, 'normal');
      if (view === 'sequence') {
        for (const h of filteredHighlights) {
          const colorDisplay =
            h.color_display_name ??
            getColorDisplayName(
              h.color,
              document?.color_labels,
              lensColors
            );
          const quote = normalizePdfText(h.highlighted_text || '');
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const maxWidth = 170;
          const categoryLabel = `${colorDisplay}: `;
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
          const catWidth = doc.getTextWidth(categoryLabel);
          doc.text(categoryLabel, 20, y);
          const rest = `"${quote}", p.${h.page_number}`;
          doc.setFont(undefined, 'normal');
          const restLines = doc.splitTextToSize(rest, maxWidth - catWidth);
          restLines.forEach((line, idx) => {
            const lineY = y + idx * 5;
            const x = 20 + (idx === 0 ? catWidth : 0);
            doc.text(line, x, lineY);
          });
          y += restLines.length * 5 + 2;
          if (h.note?.content) {
            doc.setFontSize(10);
            const noteLines = doc.splitTextToSize(
              `Note: ${normalizePdfText(h.note.content)}`,
              166
            );
            doc.text(noteLines, 24, y);
            y += noteLines.length * 5 + 4;
          } else {
            y += 4;
          }
        }
      } else if (view === 'topic') {
        for (const [topicKey, items] of Object.entries(groupedByTopic)) {
          const name =
            items[0]?.color_display_name ??
            getColorDisplayName(
              topicKey,
              document?.color_labels,
              lensColors
            );
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.setFontSize(13);
          doc.setFont(undefined, 'bold');
          doc.text(name, 20, y);
          y += 8;
          doc.setFont(undefined, 'normal');
          for (const h of items) {
            const quote = normalizePdfText(h.highlighted_text || '');
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.setFontSize(11);
            const bulletLine = `• "${quote}", p.${h.page_number}`;
            const bLines = doc.splitTextToSize(bulletLine, 170);
            doc.text(bLines, 20, y);
            y += bLines.length * 5 + 2;
            if (h.note?.content) {
              doc.setFontSize(10);
              const noteLines = doc.splitTextToSize(
                `- ${normalizePdfText(h.note.content)}`,
                166
              );
              doc.text(noteLines, 24, y);
              y += noteLines.length * 5 + 4;
            } else {
              y += 4;
            }
          }
          y += 4;
        }
      } else if (view === 'page') {
        for (const { page, items } of groupedByPage) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.setFontSize(13);
          doc.setFont(undefined, 'bold');
          doc.text(`Page ${page}`, 20, y);
          y += 8;
          doc.setFont(undefined, 'normal');
          for (const h of items) {
            const colorDisplay =
              h.color_display_name ??
              getColorDisplayName(
                h.color,
                document?.color_labels,
                lensColors
              );
            const quote = normalizePdfText(h.highlighted_text || '');
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            const maxWidth = 170;
            const prefix = `• ${colorDisplay}: `;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            const prefixWidth = doc.getTextWidth(prefix);
            doc.text(prefix, 20, y);
            const rest = `"${quote}", p.${h.page_number}`;
            doc.setFont(undefined, 'normal');
            const restLines = doc.splitTextToSize(rest, maxWidth - prefixWidth);
            restLines.forEach((line, idx) => {
              const lineY = y + idx * 5;
              const x = 20 + (idx === 0 ? prefixWidth : 0);
              doc.text(line, x, lineY);
            });
            y += restLines.length * 5 + 2;
            if (h.note?.content) {
              doc.setFontSize(10);
              const noteLines = doc.splitTextToSize(
                `- ${normalizePdfText(h.note.content)}`,
                166
              );
              doc.text(noteLines, 24, y);
              y += noteLines.length * 5 + 4;
            } else {
              y += 4;
            }
          }
          y += 4;
        }
      }
      const blob = doc.output('blob');
      saveAs(
        blob,
        `${(document?.filename || 'summary').replace(
          /\.pdf$/i,
          ''
        )}-highlights.pdf`
      );
      setShowExport(false);
    } catch (err) {
      console.error('Public export pdf failed', err);
    }
  }, [document?.filename, document?.color_labels, filteredHighlights, lensColors, view, groupedByTopic, groupedByPage]);

  const toggleFilter = useCallback((colorKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(colorKey)) next.delete(colorKey);
      else next.add(colorKey);
      return next;
    });
  }, []);

  const toggleSection = useCallback((sectionKey) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className={`${pageWrapper} flex items-center justify-center min-h-[50vh]`}>
        <Loader2 className={`w-8 h-8 ${text.muted} animate-spin`} />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <div className={`${pageWrapper} flex flex-col items-center justify-center min-h-[50vh]`}>
        <h2 className={`text-lg font-semibold ${text.heading} mb-2`}>Shared summary not found</h2>
        <p className={`text-sm ${text.secondary} mb-4`}>
          This public link may be invalid or the document has been removed.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = '/';
            }
          }}
          className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
        >
          Go back
        </button>
      </div>
    );
  }

  const colorKeysForFilter =
    lensColors?.length > 0
      ? lensColors.map((c) => c.key)
      : documentColorKeys?.length > 0
        ? documentColorKeys
        : HIGHLIGHT_COLOR_KEYS;

  return (
    <div className={`min-h-screen ${bg.page}`}>
      <header
        className={`h-[52px] px-6 flex items-center justify-between border-b ${border.default} ${bg.surface}`}
      >
        <div
          className="flex items-center gap-2 text-sm font-medium"
          style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1f2e' }}
        >
          <div
            className={`w-5 h-5 rounded-md bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white`}
          >
            W
          </div>
          WiseMark
        </div>
        <Link
          to="/login"
          className={`${btnPrimary} no-underline text-sm py-1.5 px-3.5 rounded-md`}
        >
          Request access
        </Link>
      </header>

      <main className="p-4 max-w-3xl mx-auto">
        <div className="mb-3">
          <h1 className={`text-base font-semibold ${text.heading}`}>Summary</h1>
          <p className={`text-xs ${text.muted} truncate max-w-xs`}>{document?.filename}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
            {[
              { key: 'sequence', label: 'Sequence' },
              { key: 'topic', label: 'Topic' },
              { key: 'page', label: 'Page' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-all ${
                  view === key
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : `${text.secondary} hover:text-slate-700`
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search highlights..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 text-sm border ${border.default} rounded-lg ${bg.surface} outline-none ${text.body} placeholder:text-slate-400`}
            />
          </div>

          <div className="relative shrink-0 flex items-center gap-2">
            <Link
              to={`/share/${token}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border ${border.default} ${bg.surface} hover:bg-slate-50 ${text.body} no-underline`}
            >
              <BookOpen className="w-4 h-4" />
              View PDF with highlights
            </Link>
            <button
              type="button"
              onClick={() => setShowExport((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border ${border.default} ${bg.surface} hover:bg-slate-50 ${text.body}`}
            >
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            {showExport && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExport(false)}
                  aria-hidden="true"
                />
                <div
                  className={`absolute right-0 top-full mt-1 z-20 py-1 rounded-lg border ${border.default} ${bg.surface} shadow-lg min-w-[160px]`}
                >
                  <button
                    type="button"
                    onClick={handleExportDocx}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4" /> DOCX
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50"
                  >
                    <FileDown className="w-4 h-4" /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50"
                  >
                    <Braces className="w-4 h-4" /> JSON
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-6">
          {colorKeysForFilter.map((key) => {
            const count = (highlights || []).filter((h) => h.color === key).length;
            if (!count) return null;
            const hex = lensColors?.find((c) => c.key === key)?.hex ?? '#94a3b8';
            const name = getColorDisplayName(
              key,
              document?.color_labels,
              lensColors
            );
            const isActive =
              activeFilters.size === 0 || activeFilters.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleFilter(key)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[11px] font-semibold"
                style={{
                  borderColor: isActive ? hex : '#E2E8F0',
                  background: isActive ? hexToRgba(hex, 0.08) : '#fff',
                  opacity: isActive ? 1 : 0.5,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: hex }}
                />
                <span>{name}</span>
                <span className="opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {!filteredHighlights.length ? (
            <div className={`py-12 text-center ${text.muted} text-sm`}>
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No highlights yet.</p>
            </div>
          ) : view === 'sequence' ? (
            <ul className="space-y-2">
              {filteredHighlights.map((h) => {
                const hex =
                  lensColors?.find((c) => c.key === h.color)?.hex ?? '#94a3b8';
                const colorDisplay =
                  h.color_display_name ??
                  getColorDisplayName(
                    h.color,
                    document?.color_labels,
                    lensColors
                  );
                return (
                  <li
                    key={h.id}
                    className={`rounded-[10px] p-3 border ${border.default} bg-white`}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color: hex }}>
                      {colorDisplay}
                    </p>
                    <p className={`text-xs ${text.body} whitespace-pre-line`}>
                      {normalizePdfText(h.highlighted_text) || '(No text captured)'}
                    </p>
                    {h.note?.content && (
                      <p className={`mt-1 text-[11px] ${text.muted} italic`}>
                        {normalizePdfText(h.note.content)}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">p.{h.page_number}</p>
                  </li>
                );
              })}
            </ul>
          ) : view === 'topic' ? (
            <div className="space-y-4">
              {Object.entries(groupedByTopic).map(([topicKey, items]) => {
                const hex =
                  lensColors?.find((c) => c.key === topicKey)?.hex ?? '#94a3b8';
                const name =
                  items[0]?.color_display_name ??
                  getColorDisplayName(
                    topicKey,
                    document?.color_labels,
                    lensColors
                  );
                const sectionKey = `topic-${topicKey}`;
                const isCollapsed = collapsedSections.has(sectionKey);
                return (
                  <div
                    key={topicKey}
                    className="border rounded-lg overflow-hidden"
                    style={{ borderColor: hexToRgba(hex, 0.3) }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionKey)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left font-semibold text-sm"
                      style={{ backgroundColor: hexToRgba(hex, 0.1) }}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      )}
                      <span style={{ color: hex }}>{name}</span>
                      <span className="text-slate-500 text-xs">
                        ({items.length})
                      </span>
                    </button>
                    {!isCollapsed && (
                      <ul className="p-3 space-y-2 bg-white">
                        {items.map((h) => (
                          <li
                            key={h.id}
                            className={`rounded-[10px] p-3 border ${border.default} bg-white`}
                          >
                            <p className={`text-xs ${text.body} whitespace-pre-line`}>
                              {normalizePdfText(h.highlighted_text) ||
                                '(No text captured)'}
                            </p>
                            {h.note?.content && (
                              <p
                                className={`mt-1 text-[11px] ${text.muted} italic`}
                              >
                                {normalizePdfText(h.note.content)}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">
                              p.{h.page_number}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByPage.map(({ key, page, items }) => {
                const sectionKey = `page-${page}`;
                const isCollapsed = collapsedSections.has(sectionKey);
                return (
                  <div
                    key={key}
                    className={`border ${border.default} rounded-lg overflow-hidden`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionKey)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left font-semibold text-sm bg-slate-50"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      )}
                      Page {page}
                      <span className={`text-xs ${text.muted}`}>
                        ({items.length})
                      </span>
                    </button>
                    {!isCollapsed && (
                      <ul className="p-3 space-y-2 bg-white">
                        {items.map((h) => {
                          const hex =
                            lensColors?.find((c) => c.key === h.color)?.hex ??
                            '#94a3b8';
                          const colorDisplay =
                            h.color_display_name ??
                            getColorDisplayName(
                              h.color,
                              document?.color_labels,
                              lensColors
                            );
                          return (
                            <li
                              key={h.id}
                              className={`rounded-[10px] p-3 border ${border.default} bg-white`}
                            >
                              <p
                                className="text-xs font-semibold mb-1"
                                style={{ color: hex }}
                              >
                                {colorDisplay}
                              </p>
                              <p
                                className={`text-xs ${text.body} whitespace-pre-line`}
                              >
                                {normalizePdfText(h.highlighted_text) ||
                                  '(No text captured)'}
                              </p>
                              {h.note?.content && (
                                <p
                                  className={`mt-1 text-[11px] ${text.muted} italic`}
                                >
                                  {normalizePdfText(h.note.content)}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1">
                                p.{h.page_number}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

