import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsAPI, presetsAPI } from '../lib/api';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_KEYS, getColorDisplayName, hexToRgba } from '../lib/colors';
import { ArrowLeft, Loader2, Search, ChevronRight, Copy, Check, Pencil, X, Download, FileText, FileDown, Braces } from 'lucide-react';
import { Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';

function usePresetColorMap(presetColors) {
  return useMemo(() => {
    const map = {};
    if (presetColors?.length) {
      presetColors.forEach((c) => {
        map[c.key] = { hex: c.hex, displayName: c.display_name };
      });
    }
    return map;
  }, [presetColors]);
}

function getHex(colorKey, presetColorMap) {
  if (presetColorMap[colorKey]) return presetColorMap[colorKey].hex;
  const def = HIGHLIGHT_COLORS[colorKey];
  return def?.hex ?? def?.solid ?? '#94a3b8';
}

function hexToRgb(hex) {
  const n = parseInt((hex || '#94a3b8').replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function buildAnnotationRows(highlights, colorLabels, presetColors, presetColorMap, colorKeys) {
  const sorted = [...highlights].sort((a, b) => {
    if (a.page_number !== b.page_number) return a.page_number - b.page_number;
    return new Date(a.created_at) - new Date(b.created_at);
  });
  return sorted.map((h, i) => ({
    seq: i + 1,
    text: h.highlighted_text || '',
    note: h.note?.content || '',
    page: h.page_number,
    category: getColorDisplayName(h.color, colorLabels, presetColors),
    colorKey: h.color,
    hex: getHex(h.color, presetColorMap),
  }));
}

function buildGroupedByTopic(rows, colorKeys, colorLabels, presetColors, presetColorMap) {
  const groups = {};
  rows.forEach((r) => { (groups[r.colorKey] ??= []).push(r); });
  return colorKeys
    .map((key) => ({
      topic: getColorDisplayName(key, colorLabels, presetColors),
      hex: getHex(key, presetColorMap),
      items: groups[key] || [],
    }))
    .filter((g) => g.items.length > 0);
}

async function exportDocx(filename, rows, grouped) {
  const children = [];
  children.push(new Paragraph({ text: filename, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));
  children.push(new Paragraph({ text: `${rows.length} annotations`, spacing: { after: 300 }, style: 'Subtitle' }));

  grouped.forEach(({ topic, hex, items }) => {
    children.push(new Paragraph({
      spacing: { before: 300, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: hex.replace('#', '') } },
      children: [new TextRun({ text: `${topic} (${items.length})`, bold: true, size: 24, color: hex.replace('#', '') })],
    }));
    items.forEach((r) => {
      children.push(new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({ text: `"${r.text}"`, italics: true, size: 21 }),
          new TextRun({ text: `  — p.${r.page}`, size: 18, color: '94A3B8' }),
        ],
      }));
      if (r.note) {
        children.push(new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: r.note, size: 18, italics: true, color: hex.replace('#', '') })],
        }));
      }
    });
  });

  const doc = new DocxDocument({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename.replace(/\.pdf$/i, '')} — Summary.docx`);
}

function exportPdf(filename, rows, grouped) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(filename, margin, y);
  y += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`${rows.length} annotations`, margin, y);
  y += 12;

  grouped.forEach(({ topic, hex, items }) => {
    ensureSpace(18);
    const [r, g, b] = hexToRgb(hex);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, margin + contentW, y);
    y += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(r, g, b);
    pdf.text(`${topic} (${items.length})`, margin, y);
    y += 7;

    items.forEach((row) => {
      ensureSpace(14);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9.5);
      pdf.setTextColor(30);
      const lines = pdf.splitTextToSize(`"${row.text}"`, contentW - 10);
      lines.forEach((line) => {
        ensureSpace(5);
        pdf.text(line, margin + 2, y);
        y += 4.2;
      });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`p.${row.page}  #${row.seq}`, margin + 2, y);
      y += 4;
      if (row.note) {
        ensureSpace(5);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(8.5);
        pdf.setTextColor(r, g, b);
        const noteLines = pdf.splitTextToSize(row.note, contentW - 10);
        noteLines.forEach((line) => {
          ensureSpace(4.5);
          pdf.text(line, margin + 2, y);
          y += 4;
        });
      }
      y += 3;
    });
    y += 4;
  });

  pdf.save(`${filename.replace(/\.pdf$/i, '')} — Summary.pdf`);
}

function exportJson(filename, rows) {
  const blob = new Blob(
    [JSON.stringify({ document: filename, exported_at: new Date().toISOString(), annotations: rows }, null, 2)],
    { type: 'application/json' },
  );
  saveAs(blob, `${filename.replace(/\.pdf$/i, '')} — Summary.json`);
}

export default function SummaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState('sequence');
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    if (!showExport) return;
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showExport]);

  const { data: document, isLoading: docLoading, isError: docError } = useQuery({
    queryKey: ['document', id],
    queryFn: async () => (await documentsAPI.get(id)).data,
    enabled: !!id,
  });

  const { data: highlights = [] } = useQuery({
    queryKey: ['highlights', id],
    queryFn: async () => (await documentsAPI.highlights(id)).data,
    enabled: !!id,
  });

  const { data: presets = [] } = useQuery({
    queryKey: ['presets'],
    queryFn: async () => (await presetsAPI.list()).data,
  });

  const currentPreset = useMemo(() => {
    if (!presets.length) return null;
    if (document?.highlight_preset != null)
      return presets.find((p) => p.id === document.highlight_preset) ?? null;
    return presets.find((p) => p.is_system) ?? presets[0] ?? null;
  }, [presets, document?.highlight_preset]);

  const presetColors = useMemo(
    () => currentPreset?.colors ?? document?.highlight_preset_detail?.colors ?? [],
    [currentPreset?.colors, document?.highlight_preset_detail?.colors],
  );

  const colorLabels = document?.color_labels || {};
  const presetColorMap = usePresetColorMap(presetColors);

  const colorKeys = useMemo(() => {
    if (presetColors?.length) return presetColors.map((c) => c.key);
    return HIGHLIGHT_COLOR_KEYS;
  }, [presetColors]);

  const updateNote = useMutation({
    mutationFn: ({ highlightId, note }) => documentsAPI.updateHighlight(id, highlightId, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['highlights', id] });
      setEditingNoteId(null);
      setEditingNoteValue('');
    },
  });

  const toggleFilter = useCallback((key) => {
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const toggleSelect = useCallback((hId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(hId)) next.delete(hId);
      else next.add(hId);
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((section) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const handleExport = useCallback((format) => {
    setShowExport(false);
    const rows = buildAnnotationRows(highlights, colorLabels, presetColors, presetColorMap, colorKeys);
    const grouped = buildGroupedByTopic(rows, colorKeys, colorLabels, presetColors, presetColorMap);
    const fname = document?.filename || 'Document';
    if (format === 'docx') exportDocx(fname, rows, grouped);
    else if (format === 'pdf') exportPdf(fname, rows, grouped);
    else exportJson(fname, rows);
  }, [highlights, colorLabels, presetColors, presetColorMap, colorKeys, document?.filename]);

  const counts = useMemo(() => {
    const c = {};
    highlights.forEach((h) => {
      c[h.color] = (c[h.color] || 0) + 1;
    });
    return c;
  }, [highlights]);

  const filtered = useMemo(() => {
    return highlights.filter((h) => {
      if (activeFilters.length > 0 && !activeFilters.includes(h.color)) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          h.highlighted_text?.toLowerCase().includes(s) ||
          h.note?.content?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [highlights, activeFilters, search]);

  const sequenceList = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.page_number !== b.page_number) return a.page_number - b.page_number;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [filtered]);

  const groupedByTopic = useMemo(() => {
    if (view !== 'topic') return [];
    const groups = {};
    filtered.forEach((h) => {
      if (!groups[h.color]) groups[h.color] = [];
      groups[h.color].push(h);
    });
    return colorKeys
      .map((key) => ({
        colorKey: key,
        topic: getColorDisplayName(key, colorLabels, presetColors),
        hex: getHex(key, presetColorMap),
        items: (groups[key] || []).sort((a, b) => {
          if (a.page_number !== b.page_number) return a.page_number - b.page_number;
          return new Date(a.created_at) - new Date(b.created_at);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [view, filtered, colorKeys, colorLabels, presetColors, presetColorMap]);

  const groupedByPage = useMemo(() => {
    if (view !== 'page') return [];
    const groups = {};
    filtered.forEach((h) => {
      const key = h.page_number;
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    });
    return Object.entries(groups)
      .map(([page, items]) => ({
        page: Number(page),
        items: items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      }))
      .sort((a, b) => a.page - b.page);
  }, [view, filtered]);

  if (!id) {
    navigate('/', { replace: true });
    return null;
  }

  if (docLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (docError || !document) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Document not found</h2>
        <button type="button" onClick={() => navigate('/')} className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-700">
          Back
        </button>
      </div>
    );
  }

  const globalSeqMap = new Map();
  [...highlights]
    .sort((a, b) => {
      if (a.page_number !== b.page_number) return a.page_number - b.page_number;
      return new Date(a.created_at) - new Date(b.created_at);
    })
    .forEach((h, i) => globalSeqMap.set(h.id, i + 1));

  return (
    <div className="min-h-screen bg-[#F8FAFB]" style={{ fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {/* Sticky header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50" style={{ padding: '16px 32px' }}>
        <div className="max-w-[820px] mx-auto">
          {/* Top row */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/document/${id}`)}
                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="w-px h-5 bg-slate-200" />
              <div>
                <h1 className="text-[16px] font-semibold text-slate-900 tracking-tight">Summary</h1>
                <p className="text-xs text-slate-400 truncate max-w-[300px]">{document.filename}</p>
              </div>
            </div>

            {/* Export button */}
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setShowExport((v) => !v)}
                disabled={!highlights.length}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-slate-800 text-white text-[13px] font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              {showExport && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-50 min-w-[200px]">
                  {[
                    { key: 'docx', icon: FileText, label: 'Word (.docx)', desc: 'Formatted summary' },
                    { key: 'pdf', icon: FileDown, label: 'PDF (.pdf)', desc: 'Print-ready export' },
                    { key: 'json', icon: Braces, label: 'JSON (.json)', desc: 'Structured data' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleExport(opt.key)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                    >
                      <opt.icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <div className="text-[13px] font-medium text-slate-800">{opt.label}</div>
                        <div className="text-[11px] text-slate-400">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Annotation count dots */}
          <div className="flex items-center gap-1.5 mt-3 mb-3.5">
            <span className="text-xs font-semibold text-slate-600">
              {highlights.length} annotation{highlights.length !== 1 ? 's' : ''}
            </span>
            <span className="text-slate-300 mx-0.5">—</span>
            {colorKeys.map((key) => {
              const count = counts[key] || 0;
              if (!count) return null;
              const hex = getHex(key, presetColorMap);
              return (
                <span key={key} className="flex items-center gap-1">
                  <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: hex }} />
                  <span className="text-[11px] text-slate-500">{count}</span>
                </span>
              );
            })}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View tabs */}
            <div className="flex bg-slate-100 rounded-md p-0.5">
              {[
                { key: 'sequence', label: 'Sequence' },
                { key: 'topic', label: 'Topic' },
                { key: 'page', label: 'Page' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setView(t.key)}
                  className={`px-3 py-1.5 rounded text-[12.5px] font-medium transition-all ${
                    view === t.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 flex-1 max-w-[280px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search annotations..."
                className="border-0 bg-transparent outline-none text-[12.5px] text-slate-900 w-full placeholder:text-slate-400"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selection actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-md border border-blue-200">
                <span className="text-xs font-medium text-blue-600">{selectedIds.size} selected</span>
                <button
                  type="button"
                  onClick={() => {
                    const selected = highlights.filter((h) => selectedIds.has(h.id));
                    const text = selected
                      .map((h) => `"${h.highlighted_text}" — p.${h.page_number}`)
                      .join('\n\n');
                    navigator.clipboard?.writeText(text);
                  }}
                  className="text-[11px] font-medium text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-100"
                >
                  Copy selected
                </button>
                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-blue-400 hover:text-blue-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {colorKeys.map((key) => {
              const count = counts[key] || 0;
              if (!count) return null;
              const hex = getHex(key, presetColorMap);
              const name = getColorDisplayName(key, colorLabels, presetColors);
              const active = activeFilters.length === 0 || activeFilters.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFilter(key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all"
                  style={{
                    borderColor: active ? hex : '#E2E8F0',
                    background: active ? hexToRgba(hex, 0.08) : '#fff',
                    opacity: active ? 1 : 0.5,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
                  <span className="text-xs font-medium" style={{ color: active ? hex : '#94A3B8' }}>{name}</span>
                  <span
                    className="text-[11px] font-semibold px-1.5 rounded"
                    style={{
                      color: active ? hex : '#CBD5E1',
                      background: active ? hexToRgba(hex, 0.1) : '#F8FAFC',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[820px] mx-auto" style={{ padding: '24px 32px 60px 64px' }}>
        {!highlights.length ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <p>No highlights yet.</p>
            <p className="mt-1">Select text in the document to create highlights, then return here.</p>
            <button
              type="button"
              onClick={() => navigate(`/document/${id}`)}
              className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-700 mt-4"
            >
              Open document
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No annotations match your search.
          </div>
        ) : view === 'sequence' ? (
          <div className="flex flex-col gap-2">
            {sequenceList.map((h) => (
              <AnnotationCard
                key={h.id}
                h={h}
                seq={globalSeqMap.get(h.id)}
                showCategory
                presetColorMap={presetColorMap}
                colorLabels={colorLabels}
                presetColors={presetColors}
                hovered={hoveredId === h.id}
                selected={selectedIds.has(h.id)}
                onHover={setHoveredId}
                onLeave={() => setHoveredId(null)}
                onSelect={toggleSelect}
                editingNoteId={editingNoteId}
                editingNoteValue={editingNoteValue}
                onEditNote={(hId) => { setEditingNoteId(hId); setEditingNoteValue(h.note?.content ?? ''); }}
                onChangeNote={setEditingNoteValue}
                onSaveNote={() => updateNote.mutate({ highlightId: editingNoteId, note: editingNoteValue.trim() })}
                onCancelNote={() => { setEditingNoteId(null); setEditingNoteValue(''); }}
                savingNote={updateNote.isPending}
              />
            ))}
          </div>
        ) : view === 'topic' ? (
          <div className="flex flex-col gap-5">
            {groupedByTopic.map(({ colorKey, topic, hex, items }) => {
              const collapsed = collapsedSections.has(colorKey);
              return (
                <div key={colorKey}>
                  <button
                    type="button"
                    onClick={() => toggleCollapse(colorKey)}
                    className="flex items-center gap-2 w-full pb-2.5 sticky top-[160px] z-10"
                  >
                    <ChevronRight
                      className="w-4 h-4 text-slate-500 transition-transform"
                      style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }} />
                    <span className="text-sm font-semibold text-slate-900">{topic}</span>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 px-1.5 rounded">{items.length}</span>
                  </button>
                  {!collapsed && (
                    <div className="flex flex-col gap-2">
                      {items.map((h) => (
                        <AnnotationCard
                          key={h.id}
                          h={h}
                          seq={globalSeqMap.get(h.id)}
                          showCategory={false}
                          presetColorMap={presetColorMap}
                          colorLabels={colorLabels}
                          presetColors={presetColors}
                          hovered={hoveredId === h.id}
                          selected={selectedIds.has(h.id)}
                          onHover={setHoveredId}
                          onLeave={() => setHoveredId(null)}
                          onSelect={toggleSelect}
                          editingNoteId={editingNoteId}
                          editingNoteValue={editingNoteValue}
                          onEditNote={(hId) => { setEditingNoteId(hId); setEditingNoteValue(h.note?.content ?? ''); }}
                          onChangeNote={setEditingNoteValue}
                          onSaveNote={() => updateNote.mutate({ highlightId: editingNoteId, note: editingNoteValue.trim() })}
                          onCancelNote={() => { setEditingNoteId(null); setEditingNoteValue(''); }}
                          savingNote={updateNote.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groupedByPage.map(({ page, items }) => {
              const key = `p${page}`;
              const collapsed = collapsedSections.has(key);
              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => toggleCollapse(key)}
                    className="flex items-center gap-2 pb-2.5 sticky top-[160px] z-10"
                  >
                    <ChevronRight
                      className="w-4 h-4 text-slate-500 transition-transform"
                      style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                    />
                    <span className="text-sm font-semibold text-slate-900">Page {page}</span>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 px-1.5 rounded">{items.length}</span>
                  </button>
                  {!collapsed && (
                    <div className="flex flex-col gap-2">
                      {items.map((h) => (
                        <AnnotationCard
                          key={h.id}
                          h={h}
                          seq={globalSeqMap.get(h.id)}
                          showCategory
                          presetColorMap={presetColorMap}
                          colorLabels={colorLabels}
                          presetColors={presetColors}
                          hovered={hoveredId === h.id}
                          selected={selectedIds.has(h.id)}
                          onHover={setHoveredId}
                          onLeave={() => setHoveredId(null)}
                          onSelect={toggleSelect}
                          editingNoteId={editingNoteId}
                          editingNoteValue={editingNoteValue}
                          onEditNote={(hId) => { setEditingNoteId(hId); setEditingNoteValue(h.note?.content ?? ''); }}
                          onChangeNote={setEditingNoteValue}
                          onSaveNote={() => updateNote.mutate({ highlightId: editingNoteId, note: editingNoteValue.trim() })}
                          onCancelNote={() => { setEditingNoteId(null); setEditingNoteValue(''); }}
                          savingNote={updateNote.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AnnotationCard({
  h,
  seq,
  showCategory,
  presetColorMap,
  colorLabels,
  presetColors,
  hovered,
  selected,
  onHover,
  onLeave,
  onSelect,
  editingNoteId,
  editingNoteValue,
  onEditNote,
  onChangeNote,
  onSaveNote,
  onCancelNote,
  savingNote,
}) {
  const [copied, setCopied] = useState(false);
  const hex = getHex(h.color, presetColorMap);
  const topic = getColorDisplayName(h.color, colorLabels, presetColors);
  const isEditing = editingNoteId === h.id;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(`"${h.highlighted_text}" — p.${h.page_number}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="relative rounded-lg bg-white transition-all"
      style={{
        border: `1px solid ${hovered ? hexToRgba(hex, 0.3) : '#E8ECF0'}`,
        borderLeft: `3px solid ${hex}`,
        padding: '14px 16px 12px 16px',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
      }}
      onMouseEnter={() => onHover?.(h.id)}
      onMouseLeave={() => onLeave?.()}
    >
      {/* Selection checkbox */}
      <div
        className="absolute transition-opacity"
        style={{ top: 14, left: -32, opacity: hovered || selected ? 1 : 0 }}
      >
        <div
          onClick={(e) => { e.stopPropagation(); onSelect?.(h.id); }}
          className="w-[18px] h-[18px] rounded flex items-center justify-center cursor-pointer transition-all"
          style={{
            border: selected ? `2px solid ${hex}` : '2px solid #CBD5E1',
            background: selected ? hex : '#fff',
          }}
        >
          {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </div>
      </div>

      {/* Quote text */}
      <p className="text-[13.5px] leading-[1.55] text-slate-900" style={{ fontFamily: "'Charter', 'Georgia', serif" }}>
        &ldquo;{h.highlighted_text || '(No text captured)'}&rdquo;
      </p>

      {/* Comment / note */}
      {isEditing ? (
        <div className="mt-2 space-y-1.5">
          <textarea
            value={editingNoteValue}
            onChange={(e) => onChangeNote(e.target.value)}
            rows={2}
            autoFocus
            className="w-full text-[12.5px] border border-slate-200 rounded-lg px-2.5 py-1.5 resize-none outline-none focus:ring-1 focus:ring-slate-300 text-slate-800"
            placeholder="Add a note..."
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onSaveNote}
              disabled={savingNote}
              className="text-[11px] font-medium px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {savingNote ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onCancelNote}
              className="text-[11px] font-medium px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : h.note?.content ? (
        <p className="mt-2 text-[12.5px] leading-normal italic" style={{ color: hex }}>
          {h.note.content}
        </p>
      ) : (
        hovered && (
          <button
            type="button"
            onClick={() => onEditNote(h.id)}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            + Add a note...
          </button>
        )
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100">
        {showCategory && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{
              color: hex,
              background: hexToRgba(hex, 0.08),
            }}
          >
            {topic}
          </span>
        )}
        <span className="text-[11px] font-medium text-slate-400">p.{h.page_number}</span>
        {seq != null && <span className="text-[10px] text-slate-300">#{seq}</span>}

        {/* Hover actions */}
        <div
          className="ml-auto flex gap-1 transition-opacity"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-50"
            style={{ color: copied ? '#16A34A' : '#64748B' }}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => onEditNote(h.id)}
            className="flex items-center gap-1 text-[11px] text-slate-500 border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-50"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
