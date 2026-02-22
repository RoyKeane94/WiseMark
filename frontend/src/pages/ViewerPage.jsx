import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { documentsAPI, lensesAPI } from '../lib/api';
import WiseMarkDropdown from '../components/WiseMarkDropdown';
import { getPDFForDocument, calculateHash, storePDF } from '../lib/db';
import { HIGHLIGHT_COLOR_KEYS } from '../lib/colors';
import PDFRenderer from '../components/PDFRenderer';
import AnnotationsSidebar from '../components/AnnotationsSidebar';
import ColorPicker from '../components/ColorPicker';
import EditLensModal from '../components/EditPresetModal';
import EditNotePopover from '../components/EditNotePopover';
import { ArrowLeft, ZoomIn, ZoomOut, Loader2, Upload, PanelRightOpen, PanelRightClose, Settings2, FileStack } from 'lucide-react';
import { pageWrapper, headerBar, btnPrimary, btnIcon, text, bg, border, dividerV } from '../lib/theme';

export default function ViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pdfData, setPdfData] = useState(null);
  const [needsReupload, setNeedsReupload] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [scale, setScale] = useState(1.3);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredHighlightId, setHoveredHighlightId] = useState(null);
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const [pendingHighlight, setPendingHighlight] = useState(null);
  const [pickerPosition, setPickerPosition] = useState(null);
  const [selectionForPicker, setSelectionForPicker] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [colorLabelsOpen, setColorLabelsOpen] = useState(false);
  const [openEditForHighlightId, setOpenEditForHighlightId] = useState(null);
  const [editPopover, setEditPopover] = useState(null);
  const [pendingLensSwitch, setPendingLensSwitch] = useState(null);

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

  useEffect(() => {
    if (!document || !id) return;
    let cancelled = false;
    const load = async () => {
      setLoadingPdf(true);
      try {
        const pdf = await getPDFForDocument(document);
        if (!cancelled) {
          if (pdf) setPdfData(pdf.data);
          else setNeedsReupload(true);
        }
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [document, id]);

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

  const docLensColors = useMemo(
    () => (currentLens?.colors ?? document?.highlight_preset_detail?.colors ?? []),
    [currentLens?.colors, document?.highlight_preset_detail?.colors]
  );
  const documentColorKeys = useMemo(() => {
    if (docLensColors?.length) return docLensColors.map((c) => c.key);
    const keys = Object.keys(document?.color_labels || {});
    return keys.length > 0 ? keys : [...HIGHLIGHT_COLOR_KEYS];
  }, [docLensColors, document?.color_labels]);

  const updateDocMutation = useMutation({
    mutationFn: ({ documentId, payload }) => documentsAPI.update(documentId, payload),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
  });

  const handleHighlightCreated = useCallback(
    async (payload) => {
      if (!id) return;
      const optimisticId = `_opt_${Date.now()}`;
      const optimistic = {
        id: optimisticId,
        page_number: payload.page_number,
        position_data: payload.position_data,
        highlighted_text: payload.highlighted_text,
        color: payload.color,
        note: payload.comment ? { id: optimisticId, content: payload.comment } : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData(['highlights', id], (old = []) => [...old, optimistic]);
      setPendingHighlight(null);
      setPickerPosition(null);
      setSelectionForPicker(null);

      try {
        await documentsAPI.createHighlight(id, payload);
        queryClient.invalidateQueries({ queryKey: ['highlights', id] });
      } catch (err) {
        console.error('Failed to save highlight', err);
        queryClient.setQueryData(['highlights', id], (old = []) =>
          old.filter((h) => h.id !== optimisticId)
        );
      }
    },
    [id, queryClient]
  );

  const handleSelectionComplete = useCallback((payload) => {
    setPendingHighlight({
      page_number: payload.pageNumber,
      position_data: payload.position_data,
      highlighted_text: payload.highlighted_text,
    });
    setPickerPosition(payload.pickerPosition);
    setSelectionForPicker({
      pageNumber: payload.pageNumber,
      spanStart: payload.spanStart,
      spanEnd: payload.spanEnd,
    });
  }, []);

  const handleColorSelect = useCallback(
    (color, comment) => {
      if (!pendingHighlight) return;
      handleHighlightCreated({ ...pendingHighlight, color, comment });
    },
    [pendingHighlight, handleHighlightCreated]
  );

  const handlePickerClose = useCallback(() => {
    setPendingHighlight(null);
    setPickerPosition(null);
    setSelectionForPicker(null);
  }, []);

  const handleScrollToPage = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
    const container = window.document.getElementById('pdf-scroll-container');
    const pageEl = container?.querySelector(`[data-page="${pageNumber}"]`);
    pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleHighlightClick = useCallback((id) => {
    setActiveHighlightId((prev) => (prev != null && String(prev) === String(id) ? null : id));
  }, []);

  const handleNumPages = useCallback((num) => setTotalPages(num ?? 0), []);

  const handlePrevPage = useCallback(() => {
    if (currentPage <= 1) return;
    const next = currentPage - 1;
    setCurrentPage(next);
    handleScrollToPage(next);
  }, [currentPage, handleScrollToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage >= totalPages) return;
    const next = currentPage + 1;
    setCurrentPage(next);
    handleScrollToPage(next);
  }, [currentPage, totalPages, handleScrollToPage]);

  const handleReupload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !document || !id) return;
    const arrayBuffer = await file.arrayBuffer();
    const hash = await calculateHash(arrayBuffer);
    if (hash !== document.pdf_hash) {
      alert('This file does not match the original document.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', new Blob([arrayBuffer], { type: 'application/pdf' }), file.name || document.filename || 'document.pdf');
      await documentsAPI.uploadPdf(id, formData);
    } catch (err) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Upload failed';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
      return;
    }
    await storePDF(hash, document.filename || file.name, file.size, arrayBuffer);
    setPdfData(arrayBuffer);
    setNeedsReupload(false);
  };

  if (!id) {
    navigate('/', { replace: true });
    return null;
  }

  if (docLoading || loadingPdf) {
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
          It may have been deleted or you don’t have access to it.
        </p>
        <button type="button" onClick={() => navigate(document?.project ? `/project/${document.project}` : '/')} className={btnPrimary}>
          Back to project
        </button>
      </div>
    );
  }

  if (needsReupload) {
    return (
      <div className={`${pageWrapper} flex flex-col items-center justify-center`}>
        <Upload className={`w-12 h-12 ${text.muted} mb-4`} />
        <h2 className={`text-lg font-semibold ${text.heading} mb-2`}>PDF needed on this device</h2>
        <p className={`text-sm ${text.secondary} mb-4 text-center max-w-sm`}>
          Upload the same file to open <strong>{document?.filename}</strong>.
        </p>
        <label className={`${btnPrimary} inline-flex items-center gap-2`}>
          <Upload className="w-4 h-4" /> Upload PDF
          <input type="file" accept=".pdf" onChange={handleReupload} className="hidden" />
        </label>
        <button type="button" onClick={() => navigate(document?.project ? `/project/${document.project}` : '/')} className={`mt-4 text-sm ${text.muted} hover:underline`}>
          Back to project
        </button>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${bg.page} overflow-hidden`}>
      <header className={`${headerBar} px-4 py-2.5 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(document?.project ? `/project/${document.project}` : '/')} className={btnIcon} title="Back to project">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <p className={`text-sm font-medium ${text.heading} truncate max-w-xs`}>{document?.filename}</p>
        </div>
        <div className="flex items-center gap-2">
          {lenses.length > 0 && (
            <WiseMarkDropdown
              value={document?.highlight_preset != null ? document.highlight_preset : (lenses.find((p) => p.is_system)?.id ?? lenses[0]?.id)}
              options={lenses.map((l) => ({ value: l.id, label: l.name }))}
              onChange={(lensId) => {
                if (!id) return;
                if (highlights.length > 0) {
                  setPendingLensSwitch(lensId);
                } else {
                  updateDocMutation.mutate({
                    documentId: id,
                    payload: { highlight_preset: lensId },
                  });
                }
              }}
              minWidth="140px"
              className="max-w-44"
            />
          )}
          <button
            type="button"
            onClick={() => setColorLabelsOpen(true)}
            className={btnIcon}
            title="Edit lens"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/document/${id}/summary`)}
            className={btnIcon}
            title="Summary"
          >
            <FileStack className="w-4 h-4" />
          </button>
          <div className={dividerV} />
          <div className={`flex items-center gap-1 ${bg.muted} rounded-lg px-1 py-0.5`}>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className={`p-1.5 ${text.secondary} hover:text-slate-700 rounded cursor-pointer`}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className={`text-xs ${text.secondary} w-12 text-center`}>{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              className={`p-1.5 ${text.secondary} hover:text-slate-700 rounded cursor-pointer`}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className={dividerV} />
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className={btnIcon}
            title={sidebarOpen ? 'Close annotations' : 'Open annotations'}
          >
            {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto flex flex-col relative pb-14" id="pdf-scroll-container">
          {pdfData && (
            <PDFRenderer
              pdfData={pdfData}
              scale={scale}
              highlights={highlights}
              hoveredHighlightId={hoveredHighlightId}
              activeHighlightId={activeHighlightId}
              selectionForPicker={selectionForPicker}
              lensColors={docLensColors}
              onSelectionComplete={handleSelectionComplete}
              onNumPages={handleNumPages}
              onHighlightHover={setHoveredHighlightId}
              onHighlightHoverEnd={() => setHoveredHighlightId(null)}
              onHighlightEdit={(highlightId, event) => {
                const rect = event?.target?.getBoundingClientRect?.();
                if (rect) {
                  setEditPopover({
                    highlightId,
                    x: rect.left + rect.width / 2,
                    y: rect.bottom,
                  });
                } else {
                  setOpenEditForHighlightId(highlightId);
                  setSidebarOpen(true);
                }
              }}
              onHighlightDelete={async (highlightId) => {
                if (!id) return;
                const prev = queryClient.getQueryData(['highlights', id]);
                queryClient.setQueryData(['highlights', id], (old = []) =>
                  old.filter((h) => String(h.id) !== String(highlightId))
                );
                if (String(activeHighlightId) === String(highlightId)) setActiveHighlightId(null);
                if (String(hoveredHighlightId) === String(highlightId)) setHoveredHighlightId(null);
                try {
                  await documentsAPI.deleteHighlight(id, highlightId);
                  queryClient.invalidateQueries({ queryKey: ['highlights', id] });
                } catch (err) {
                  console.error('Failed to delete highlight', err);
                  queryClient.setQueryData(['highlights', id], prev);
                }
              }}
            />
          )}
          {pickerPosition && (
            <ColorPicker
              position={pickerPosition}
              onSelect={handleColorSelect}
              onClose={handlePickerClose}
              colorLabels={document?.color_labels}
              documentColorKeys={documentColorKeys}
              lensColors={docLensColors}
            />
          )}
          {editPopover && (
            <EditNotePopover
              position={{ x: editPopover.x, y: editPopover.y }}
              initialValue={
                (highlights || []).find((h) => String(h.id) === String(editPopover.highlightId))?.note?.content ?? ''
              }
              onSave={async (noteContent) => {
                if (!id) return;
                await documentsAPI.updateHighlight(id, editPopover.highlightId, { note: noteContent });
                queryClient.invalidateQueries({ queryKey: ['highlights', id] });
                setEditPopover(null);
              }}
              onClose={() => setEditPopover(null)}
            />
          )}
          {colorLabelsOpen && (
            <EditLensModal
              lens={currentLens}
              documentId={id}
              onClose={() => setColorLabelsOpen(false)}
            />
          )}
          {pendingLensSwitch !== null && (
            <div
              className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 cursor-pointer"
              onClick={() => setPendingLensSwitch(null)}
            >
              <div
                className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-semibold text-slate-800 mb-2">Switch lens?</h3>
                <p className="text-sm text-slate-600 mb-5">
                  This document has <strong>{highlights.length}</strong> highlight{highlights.length !== 1 ? 's' : ''}. Switching lenses will <strong>delete all existing highlights</strong> because the colour categories will change.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingLensSwitch(null)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const lensId = pendingLensSwitch;
                      setPendingLensSwitch(null);
                      for (const h of highlights) {
                        await documentsAPI.deleteHighlight(id, h.id);
                      }
                      queryClient.invalidateQueries({ queryKey: ['highlights', id] });
                      setActiveHighlightId(null);
                      setHoveredHighlightId(null);
                      updateDocMutation.mutate({
                        documentId: id,
                        payload: { highlight_preset: lensId },
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete highlights & switch
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {sidebarOpen && (
          <AnnotationsSidebar
            highlights={highlights}
            colorLabels={document?.color_labels}
            lensColors={docLensColors}
            documentColorKeys={documentColorKeys}
            activeHighlightId={activeHighlightId}
            onScrollToPage={handleScrollToPage}
            onHighlightClick={handleHighlightClick}
            onHighlightHover={setHoveredHighlightId}
            onHighlightHoverEnd={() => setHoveredHighlightId(null)}
            onClearActive={() => setActiveHighlightId(null)}
            documentId={id}
            openEditForHighlightId={openEditForHighlightId}
            onClearOpenEditForHighlightId={() => setOpenEditForHighlightId(null)}
            onHighlightNoteUpdate={async (highlightId, noteContent) => {
              if (!id) return;
              await documentsAPI.updateHighlight(id, highlightId, { note: noteContent });
              queryClient.invalidateQueries({ queryKey: ['highlights', id] });
            }}
            onHighlightDelete={async (highlightId) => {
              if (!id) return;
              await documentsAPI.deleteHighlight(id, highlightId);
              queryClient.invalidateQueries({ queryKey: ['highlights', id] });
              if (String(activeHighlightId) === String(highlightId)) setActiveHighlightId(null);
              if (String(hoveredHighlightId) === String(highlightId)) setHoveredHighlightId(null);
            }}
          />
        )}
      </div>
      {totalPages > 0 && (
        <div
          className={`fixed bottom-0 left-0 z-10 flex items-center justify-center gap-2 border-t border-slate-200 bg-white py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] ${sidebarOpen ? 'right-80' : 'right-0'}`}
        >
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-default cursor-pointer hover:bg-slate-50 text-sm"
          >
            ‹
          </button>
          <span className="min-w-[80px] text-center text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-default cursor-pointer hover:bg-slate-50 text-sm"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
