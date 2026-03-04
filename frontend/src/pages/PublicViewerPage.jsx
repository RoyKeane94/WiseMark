import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicDocumentsAPI } from '../lib/api';
import PDFRenderer from '../components/PDFRenderer';
import AnnotationsSidebar from '../components/AnnotationsSidebar';
import { HIGHLIGHT_COLOR_KEYS } from '../lib/colors';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Loader2,
  PanelRightOpen,
  PanelRightClose,
  FileStack,
  BookOpen,
} from 'lucide-react';
import { pageWrapper, btnIcon, text, bg, border, dividerV, btnPrimary } from '../lib/theme';

export default function PublicViewerPage() {
  const { token } = useParams();
  const [pdfData, setPdfData] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  const [scale, setScale] = useState(1.3);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredHighlightId, setHoveredHighlightId] = useState(null);
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-viewer', token],
    queryFn: async () => {
      const res = await publicDocumentsAPI.getSummary(token);
      return res.data;
    },
    enabled: !!token,
  });

  const document = data?.document;
  const highlights = data?.highlights ?? [];

  const lensColors = document?.highlight_preset_detail?.colors ?? [];
  const documentColorKeys =
    lensColors?.length > 0
      ? lensColors.map((c) => c.key)
      : Object.keys(document?.color_labels || {}).length > 0
        ? Object.keys(document.color_labels)
        : HIGHLIGHT_COLOR_KEYS;

  useEffect(() => {
    if (!token || !document) return;
    setPdfData(null);
    setPdfError(null);
    setLoadingPdf(true);
    publicDocumentsAPI
      .getPdf(token)
      .then((res) => {
        const buf = res.data instanceof ArrayBuffer ? res.data : res.data;
        if (buf) setPdfData(buf);
        else setPdfError('PDF not available');
      })
      .catch(() => setPdfError('PDF could not be loaded'))
      .finally(() => setLoadingPdf(false));
  }, [token, document?.id]);

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

  const latestHighlight =
    highlights.length > 0
      ? highlights.reduce((latest, h) => {
          if (!latest) return h;
          const latestTime = new Date(latest.created_at).getTime();
          const time = new Date(h.created_at).getTime();
          return time > latestTime ? h : latest;
        }, null)
      : null;

  const pageVisibilityRef = useRef({});
  useEffect(() => {
    if (!pdfData || totalPages < 1) return;
    const container = window.document.getElementById('pdf-scroll-container');
    if (!container) return;
    const pageEls = container.querySelectorAll('[data-page]');
    if (pageEls.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const page = Number(entry.target.getAttribute('data-page'));
          if (page) pageVisibilityRef.current[page] = entry.intersectionRatio;
        });
        const ratios = pageVisibilityRef.current;
        let bestPage = 1;
        let bestRatio = 0;
        Object.entries(ratios).forEach(([p, r]) => {
          if (r > bestRatio) {
            bestRatio = r;
            bestPage = Number(p);
          }
        });
        if (bestRatio > 0) setCurrentPage(bestPage);
      },
      { root: container, rootMargin: '-15% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );
    pageEls.forEach((el) => observer.observe(el));
    return () => {
      pageVisibilityRef.current = {};
      observer.disconnect();
    };
  }, [pdfData, totalPages]);

  const handleResumeReading = useCallback(() => {
    if (!latestHighlight) return;
    handleScrollToPage(latestHighlight.page_number);
    setActiveHighlightId(latestHighlight.id);
  }, [latestHighlight, handleScrollToPage]);

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

  if (!token) {
    return (
      <div className={`${pageWrapper} flex items-center justify-center min-h-[50vh]`}>
        <p className={text.muted}>Missing share link.</p>
      </div>
    );
  }

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
        <h2 className={`text-lg font-semibold ${text.heading} mb-2`}>Shared document not found</h2>
        <p className={`text-sm ${text.secondary} mb-4`}>
          This link may be invalid or the document has been removed.
        </p>
        <Link to="/" className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
          Go to home
        </Link>
      </div>
    );
  }

  if (pdfError || (!loadingPdf && !pdfData)) {
    return (
      <div className={`${pageWrapper} flex flex-col items-center justify-center min-h-[50vh]`}>
        <h2 className={`text-lg font-semibold ${text.heading} mb-2`}>PDF not available</h2>
        <p className={`text-sm ${text.secondary} mb-4`}>
          {pdfError || 'The PDF is not available for this shared link.'}
        </p>
        <Link
          to={`/share/${token}/summary`}
          className="flex items-center gap-2 text-sm text-slate-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> View summary instead
        </Link>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${bg.page} overflow-hidden`}>
      {/* Standard WiseMark header for unauthenticated users */}
      <header
        className={`h-[52px] px-6 flex items-center justify-between border-b ${border.default} ${bg.surface} shrink-0`}
      >
        <div
          className="flex items-center gap-2 text-sm font-medium"
          style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1f2e' }}
        >
          <Link to="/" className="flex items-center gap-2 hover:opacity-90">
            <div className="w-5 h-5 rounded-md bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
              W
            </div>
            WiseMark
          </Link>
        </div>
        <Link to="/login" className={`${btnPrimary} no-underline text-sm py-1.5 px-3.5 rounded-md`}>
          Request access
        </Link>
      </header>
      {/* Viewer toolbar: same layout as normal ViewerPage */}
      <header className={`px-4 py-2.5 flex items-center justify-between border-b ${border.default} ${bg.surface} shrink-0`}>
        <div className="flex items-center gap-3">
          <Link
            to={`/share/${token}/summary`}
            className={btnIcon}
            title="Back to summary"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <p className={`text-sm font-medium ${text.heading} truncate max-w-xs`}>
            {document?.filename}
          </p>
          <span className={`text-xs ${text.muted} shrink-0`}>Read-only</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/share/${token}/summary`} className={btnIcon} title="Summary">
            <FileStack className="w-4 h-4" />
          </Link>
          <div className={dividerV} />
          <div className={`flex items-center gap-1 ${bg.muted} rounded-lg px-1 py-0.5`}>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className={`p-1.5 ${text.secondary} hover:text-slate-700 rounded cursor-pointer`}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className={`text-xs ${text.secondary} w-12 text-center`}>
              {Math.round(scale * 100)}%
            </span>
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
            {sidebarOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex-1 overflow-auto flex flex-col relative pb-14"
          id="pdf-scroll-container"
        >
          {!pdfData && loadingPdf && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className={`w-7 h-7 ${text.muted} animate-spin`} />
              <p className={`text-xs ${text.secondary}`}>Loading PDF…</p>
            </div>
          )}
          {pdfData && (
            <PDFRenderer
              pdfData={pdfData}
              scale={scale}
              highlights={highlights}
              hoveredHighlightId={hoveredHighlightId}
              activeHighlightId={activeHighlightId}
              lensColors={lensColors}
              onNumPages={handleNumPages}
              onHighlightHover={setHoveredHighlightId}
              onHighlightHoverEnd={() => setHoveredHighlightId(null)}
            />
          )}
        </div>
        {sidebarOpen && (
          <AnnotationsSidebar
            highlights={highlights}
            colorLabels={document?.color_labels}
            lensColors={lensColors}
            documentColorKeys={documentColorKeys}
            activeHighlightId={activeHighlightId}
            onScrollToPage={handleScrollToPage}
            onHighlightClick={handleHighlightClick}
            onHighlightHover={setHoveredHighlightId}
            onHighlightHoverEnd={() => setHoveredHighlightId(null)}
            onClearActive={() => setActiveHighlightId(null)}
          />
        )}
      </div>
      {totalPages > 0 && (
        <div
          className={`fixed bottom-0 left-0 z-10 flex items-center justify-center gap-2 border-t border-slate-200 bg-white py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] ${sidebarOpen ? 'right-80' : 'right-0'}`}
        >
          {latestHighlight && (
            <button
              type="button"
              onClick={handleResumeReading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium hover:bg-slate-100 cursor-pointer"
              title={`Go to latest highlight on page ${latestHighlight.page_number}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Pick up where you left off
              {latestHighlight.page_number > 1 && (
                <span className="text-slate-500">(p. {latestHighlight.page_number})</span>
              )}
            </button>
          )}
          {latestHighlight && <div className="w-px h-5 bg-slate-200" />}
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
