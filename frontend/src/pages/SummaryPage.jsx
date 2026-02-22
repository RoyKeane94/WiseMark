import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { documentsAPI, lensesAPI } from '../lib/api';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_KEYS,
  getColorDisplayName,
  hexToRgba,
} from '../lib/colors';
import { normalizePdfText } from '../lib/pdfText';
import { pageWrapper, headerBar, btnPrimary, btnIcon, text, bg, border } from '../lib/theme';
import {
  ArrowLeft,
  FileText,
  FileDown,
  Braces,
  Search,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Check,
  X,
} from 'lucide-react';

function getHex(colorKey, lensColors) {
  return (
    lensColors?.find((c) => c.key === colorKey)?.hex ??
    HIGHLIGHT_COLORS[colorKey]?.hex ??
    '#94a3b8'
  );
}

function AnnotationCard({
  highlight,
  selected,
  onToggleSelect,
  lensColors,
  colorLabels,
  editingNoteId,
  editingNoteValue,
  onStartEdit,
  onSaveNote,
  onCancelEdit,
  onEditValueChange,
  onCopy,
  onDelete,
}) {
  const colorKey = highlight.color;
  const hex = getHex(colorKey, lensColors);
  const displayName = getColorDisplayName(colorKey, colorLabels, lensColors);
  const isEditing = editingNoteId === highlight.id;

  return (
    <div
      className={`rounded-[10px] p-3 border bg-white transition-all ${
        selected ? 'border-slate-300' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex gap-2.5 items-start">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(highlight.id)}
          className="mt-1.5 shrink-0 rounded border-slate-300 text-slate-800 focus:ring-slate-400 cursor-pointer"
          aria-label="Select highlight"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-xs leading-snug ${text.body} whitespace-pre-line`}>
            {normalizePdfText(highlight.highlighted_text) || '(No text captured)'}
          </p>
          {isEditing ? (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={editingNoteValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className={`w-full text-[11.5px] border ${border.default} rounded-lg px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-slate-300 ${text.body}`}
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onSaveNote(highlight.id)}
                  className="text-[11px] font-medium px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-700 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="text-[11px] font-medium px-2 py-1 rounded text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {highlight.note?.content && (
                <p className={`text-[11.5px] ${text.muted} mt-2 leading-snug italic whitespace-pre-line`}>
                  {normalizePdfText(highlight.note.content)}
                </p>
              )}
              <button
                type="button"
                onClick={() => onStartEdit(highlight)}
                className="mt-1.5 text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                {highlight.note?.content ? 'Edit note' : 'Add note'}
              </button>
            </>
          )}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ color: hex, backgroundColor: hexToRgba(hex, 0.08) }}
            >
              {displayName}
            </span>
            <span className="text-[10px] text-slate-400">p.{highlight.page_number}</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => onCopy(highlight)}
                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Copy"
                aria-label="Copy"
              >
                <Copy className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(highlight.id)}
                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SummaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState('sequence');
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [copiedSelected, setCopiedSelected] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [pendingDeleteHighlight, setPendingDeleteHighlight] = useState(null);
  const [pendingDeleteSelected, setPendingDeleteSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');

  const {
    data: document,
    isLoading: docLoading,
    isError: docError,
  } = useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const { data } = await documentsAPI.get(id);
      return data;
    },
    enabled: !!id,
  });

  const { data: highlights = [] } = useQuery({
    queryKey: ['highlights', id],
    queryFn: async () => {
      const { data } = await documentsAPI.highlights(id);
      return data;
    },
    enabled: !!id,
  });

  const { data: lenses = [] } = useQuery({
    queryKey: ['lenses'],
    queryFn: async () => {
      const { data } = await lensesAPI.list();
      return data;
    },
  });

  const currentLens = useMemo(() => {
    if (!lenses.length) return null;
    if (document?.highlight_preset != null) {
      return lenses.find((p) => p.id === document.highlight_preset) ?? null;
    }
    return lenses.find((p) => p.is_system) ?? lenses[0] ?? null;
  }, [lenses, document?.highlight_preset]);

  const lensColors = useMemo(
    () =>
      currentLens?.colors ?? document?.highlight_preset_detail?.colors ?? [],
    [currentLens?.colors, document?.highlight_preset_detail?.colors]
  );

  const documentColorKeys = useMemo(() => {
    if (lensColors?.length) return lensColors.map((c) => c.key);
    const keys = Object.keys(document?.color_labels || {});
    return keys.length > 0 ? keys : [...HIGHLIGHT_COLOR_KEYS];
  }, [lensColors, document?.color_labels]);

  const deleteHighlightMutation = useMutation({
    mutationFn: ({ documentId, highlightId }) =>
      documentsAPI.deleteHighlight(documentId, highlightId),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ['highlights', documentId] });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ documentId, highlightId, note }) =>
      documentsAPI.updateHighlight(documentId, highlightId, { note }),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ['highlights', documentId] });
    },
  });

  const filteredHighlights = useMemo(() => {
    let list = highlights || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          (h.highlighted_text && h.highlighted_text.toLowerCase().includes(q)) ||
          (h.note?.content && h.note.content.toLowerCase().includes(q))
      );
    }
    if (activeFilters.size > 0) {
      list = list.filter((h) => activeFilters.has(h.color));
    }
    return list;
  }, [highlights, search, activeFilters]);

  const sequenceList = useMemo(() => filteredHighlights, [filteredHighlights]);

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
      (a, b) => parseInt(a.replace('page-', ''), 10) - parseInt(b.replace('page-', ''), 10)
    );
    return keys.map((k) => ({ key: k, page: parseInt(k.replace('page-', ''), 10), items: groups[k] }));
  }, [filteredHighlights]);

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

  const toggleSelect = useCallback((highlightId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const sid = String(highlightId);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const handleCopySelected = useCallback(async () => {
    const selected = highlights.filter((h) => selectedIds.has(String(h.id)));
    const text = selected
      .map(
        (h) =>
          `${h.highlighted_text || ''}${h.note?.content ? `\n  Note: ${h.note.content}` : ''}`
      )
      .join('\n\n');
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedSelected(true);
      setTimeout(() => setCopiedSelected(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }, [highlights, selectedIds]);

  const handleDeleteSelected = useCallback(async () => {
    if (!id) return;
    setPendingDeleteSelected(true);
  }, [id]);

  const confirmBulkDelete = useCallback(async () => {
    if (!id) return;
    setDeletingSelected(true);
    try {
      for (const sid of selectedIds) {
        await documentsAPI.deleteHighlight(id, sid);
      }
      queryClient.invalidateQueries({ queryKey: ['highlights', id] });
      setSelectedIds(new Set());
      setPendingDeleteSelected(false);
    } catch (err) {
      console.error('Failed to delete highlights', err);
    } finally {
      setDeletingSelected(false);
    }
  }, [id, selectedIds, queryClient]);

  const handleExportJSON = useCallback(() => {
    const payload = {
      filename: document?.filename,
      exportedAt: new Date().toISOString(),
      highlights: filteredHighlights.map((h) => ({
        id: h.id,
        page_number: h.page_number,
        color: h.color,
        highlighted_text: h.highlighted_text,
        note: h.note?.content,
        created_at: h.created_at,
        updated_at: h.updated_at,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${(document?.filename || 'summary').replace(/\.pdf$/i, '')}-highlights.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  }, [document?.filename, filteredHighlights]);

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
      for (const h of filteredHighlights) {
        const colorDisplay = getColorDisplayName(h.color, document?.color_labels, lensColors);
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[${colorDisplay}] p.${h.page_number}`,
                bold: true,
                size: 20,
              }),
            ],
            spacing: { before: 120, after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: h.highlighted_text || '', size: 22 })],
            spacing: { after: 60 },
          })
        );
        if (h.note?.content) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `Note: ${h.note.content}`, italics: true, size: 20 }),
              ],
              spacing: { after: 120 },
            })
          );
        }
      }
      const doc = new Document({
        sections: [{ children }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(
        blob,
        `${(document?.filename || 'summary').replace(/\.pdf$/i, '')}-highlights.docx`
      );
      setShowExport(false);
    } catch (err) {
      console.error('Export docx failed', err);
    }
  }, [document?.filename, document?.color_labels, filteredHighlights, lensColors]);

  const handleExportPdf = useCallback(async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const { saveAs } = await import('file-saver');
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(16);
      doc.text(document?.filename ?? 'Document Summary', 20, y);
      y += 12;
      for (const h of filteredHighlights) {
        const colorDisplay = getColorDisplayName(h.color, document?.color_labels, lensColors);
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`[${colorDisplay}] p.${h.page_number}`, 20, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(h.highlighted_text || '', 170);
        doc.text(lines, 20, y);
        y += lines.length * 5 + 4;
        if (h.note?.content) {
          doc.setFont(undefined, 'italic');
          doc.text(`Note: ${h.note.content}`, 20, y);
          y += 6;
          doc.setFont(undefined, 'normal');
        }
        y += 8;
      }
      const blob = doc.output('blob');
      saveAs(blob, `${(document?.filename || 'summary').replace(/\.pdf$/i, '')}-highlights.pdf`);
      setShowExport(false);
    } catch (err) {
      console.error('Export pdf failed', err);
    }
  }, [document?.filename, document?.color_labels, filteredHighlights, lensColors]);

  const handleStartEditNote = (h) => {
    setEditingNoteId(h.id);
    setEditingNoteValue(h.note?.content ?? '');
  };

  const handleSaveNote = (highlightId) => {
    if (!id) return;
    updateNoteMutation.mutate({
      documentId: id,
      highlightId,
      note: editingNoteValue.trim() || '',
    });
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  const handleCopyHighlight = (h) => {
    const text = `${h.highlighted_text || ''}${h.note?.content ? `\n  Note: ${h.note.content}` : ''}`;
    navigator.clipboard?.writeText(text).catch(console.error);
  };

  const handleDeleteHighlight = (highlightId) => {
    setPendingDeleteHighlight(highlightId);
  };

  const confirmDeleteSingle = useCallback(async () => {
    if (!id || !pendingDeleteHighlight) return;
    await documentsAPI.deleteHighlight(id, pendingDeleteHighlight);
    queryClient.invalidateQueries({ queryKey: ['highlights', id] });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(String(pendingDeleteHighlight));
      return next;
    });
    setPendingDeleteHighlight(null);
  }, [id, pendingDeleteHighlight, queryClient]);

  if (!id) {
    navigate('/', { replace: true });
    return null;
  }

  if (docLoading) {
    return (
      <div className={`${pageWrapper} flex items-center justify-center min-h-[50vh]`}>
        <Loader2 className={`w-8 h-8 ${text.muted} animate-spin`} />
      </div>
    );
  }

  if (docError || (!document && !docLoading)) {
    return (
      <div className={`${pageWrapper} flex flex-col items-center justify-center min-h-[50vh]`}>
        <h2 className={`text-lg font-semibold ${text.heading} mb-2`}>Document not found</h2>
        <p className={`text-sm ${text.secondary} mb-4`}>
          It may have been deleted or you don&apos;t have access to it.
        </p>
        <button
          type="button"
          onClick={() =>
            navigate(document?.project ? `/project/${document.project}` : '/')
          }
          className={btnPrimary}
        >
          Back to project
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
      <header className={`${headerBar} px-4 py-2.5 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(document?.project ? `/project/${document.project}` : `/document/${id}`)}
            className={btnIcon}
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className={`text-base font-semibold ${text.heading}`}>Summary</h1>
            <p className={`text-xs ${text.muted} truncate max-w-xs`}>{document?.filename}</p>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto">
        {/* View tabs, search, export - all in one row */}
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

          <div className="relative shrink-0">
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

        {/* Selection actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className={`text-sm ${text.secondary}`}>
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleCopySelected}
              className="text-[11px] font-medium text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50 flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedSelected ? 'Copied' : 'Copy selected'}
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="text-[11px] font-medium text-red-600 border border-red-300 rounded px-2 py-0.5 hover:bg-red-50 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-blue-400 hover:text-blue-600 flex items-center gap-1"
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Color filter pills */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {colorKeysForFilter.map((key) => {
            const count = (highlights || []).filter((h) => h.color === key).length;
            if (!count) return null;
            const hex = getHex(key, lensColors);
            const name = getColorDisplayName(key, document?.color_labels, lensColors);
            const isActive = activeFilters.size === 0 || activeFilters.has(key);
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

        {/* Annotation list */}
        <div className="space-y-4">
          {!filteredHighlights.length ? (
            <div className={`py-12 text-center ${text.muted} text-sm`}>
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No highlights yet.</p>
              <p className="mt-1 text-xs">
                Open the document and create highlights to see them here.
              </p>
            </div>
          ) : view === 'sequence' ? (
            <ul className="space-y-2">
              {sequenceList.map((h) => (
                <li key={h.id}>
                  <AnnotationCard
                    highlight={h}
                    selected={selectedIds.has(String(h.id))}
                    onToggleSelect={toggleSelect}
                    lensColors={lensColors}
                    colorLabels={document?.color_labels}
                    editingNoteId={editingNoteId}
                    editingNoteValue={editingNoteValue}
                    onStartEdit={handleStartEditNote}
                    onSaveNote={handleSaveNote}
                    onCancelEdit={handleCancelEditNote}
                    onEditValueChange={setEditingNoteValue}
                    onCopy={handleCopyHighlight}
                    onDelete={handleDeleteHighlight}
                  />
                </li>
              ))}
            </ul>
          ) : view === 'topic' ? (
            <div className="space-y-4">
              {Object.entries(groupedByTopic).map(([topicKey, items]) => {
                const hex = getHex(topicKey, lensColors);
                const name = getColorDisplayName(topicKey, document?.color_labels, lensColors);
                const sectionKey = `topic-${topicKey}`;
                const isCollapsed = collapsedSections.has(sectionKey);
                return (
                  <div key={topicKey} className="border rounded-lg overflow-hidden" style={{ borderColor: hexToRgba(hex, 0.3) }}>
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
                      <span className="text-slate-500 text-xs">({items.length})</span>
                    </button>
                    {!isCollapsed && (
                      <ul className="p-3 space-y-2 bg-white">
                        {items.map((h) => (
                          <li key={h.id}>
                            <AnnotationCard
                              highlight={h}
                              selected={selectedIds.has(String(h.id))}
                              onToggleSelect={toggleSelect}
                              lensColors={lensColors}
                              colorLabels={document?.color_labels}
                              editingNoteId={editingNoteId}
                              editingNoteValue={editingNoteValue}
                              onStartEdit={handleStartEditNote}
                              onSaveNote={handleSaveNote}
                              onCancelEdit={handleCancelEditNote}
                              onEditValueChange={setEditingNoteValue}
                              onCopy={handleCopyHighlight}
                              onDelete={handleDeleteHighlight}
                            />
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
                  <div key={key} className={`border ${border.default} rounded-lg overflow-hidden`}>
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
                      <span className={`text-xs ${text.muted}`}>({items.length})</span>
                    </button>
                    {!isCollapsed && (
                      <ul className="p-3 space-y-2 bg-white">
                        {items.map((h) => (
                          <li key={h.id}>
                            <AnnotationCard
                              highlight={h}
                              selected={selectedIds.has(String(h.id))}
                              onToggleSelect={toggleSelect}
                              lensColors={lensColors}
                              colorLabels={document?.color_labels}
                              editingNoteId={editingNoteId}
                              editingNoteValue={editingNoteValue}
                              onStartEdit={handleStartEditNote}
                              onSaveNote={handleSaveNote}
                              onCancelEdit={handleCancelEditNote}
                              onEditValueChange={setEditingNoteValue}
                              onCopy={handleCopyHighlight}
                              onDelete={handleDeleteHighlight}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Single delete modal */}
      {pendingDeleteHighlight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPendingDeleteHighlight(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-base font-semibold text-slate-800 mb-2"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Delete highlight?
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              This highlight will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteHighlight(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingle}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete modal */}
      {pendingDeleteSelected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !deletingSelected && setPendingDeleteSelected(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-base font-semibold text-slate-800 mb-2"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Delete {selectedIds.size} highlight{selectedIds.size !== 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              The selected highlights will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteSelected(false)}
                disabled={deletingSelected}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={deletingSelected}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-70 flex items-center gap-2"
              >
                {deletingSelected && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
