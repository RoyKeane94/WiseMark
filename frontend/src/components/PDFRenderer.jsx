import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { HIGHLIGHT_COLORS, hexToRgba } from '../lib/colors';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const getDevicePixelRatio = () => typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

/** Build a single item bounds from a pdf.js text item (viewport coordinates). */
function getItemViewportBounds(item, tx) {
  const scaleY = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
  const scaleX = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);

  // Use the font size from the transform (scaleY) as the canonical height.
  // item.height is unreliable — it can be 0, or the full em-square which is too tall.
  const fontSize = scaleY;
  const height = fontSize;

  const width = typeof item.width === 'number' && item.width > 0
    ? item.width * scaleX
    : (item.str?.length || 1) * height * 0.5;

  const x = tx[4];
  // PDF text origin is at baseline. Shift up by ~85% of font size to get top of text.
  // Using full fontSize here overshoots; 0.85 accounts for typical ascender height.
  const y = tx[5] - fontSize * 0.85;

  return { x, y, w: width, h: height };
}

/** Build word-level spans from page getTextContent(). */
function buildSpansFromTextContent(content, viewportLayout, scale) {
  const measureCanvas =
    typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = measureCanvas?.getContext('2d');
  const allSpans = [];
  let lineIndex = 0;
  let lastY = -999;
  // Use a tolerance based on typical line height — words on the same line
  // can differ by a few pixels due to font metrics, superscripts, etc.
  const lineTolerance = 4;
  let spanIdx = 0;

  content.items.forEach((item) => {
    if (!item.str || item.str.trim() === '') return;
    const tx = pdfjsLib.Util.transform(viewportLayout.transform, item.transform);
    const b = getItemViewportBounds(item, tx);

    if (Math.abs(b.y - lastY) > lineTolerance) {
      lineIndex += 1;
      lastY = b.y;
    }

    const fontSize = b.h;
    const totalItemWidth =
      typeof item.width === 'number' && item.width > 0 ? item.width * scale : b.w;
    const tokens = item.str.split(/(\s+)/);

    if (!ctx || tokens.length === 0) {
      allSpans.push({
        id: spanIdx++,
        text: item.str,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        fontSize: b.h,
        lineIndex,
      });
      return;
    }

    ctx.font = `${fontSize}px sans-serif`;
    const tokenData = tokens.map((t) => ({
      text: t,
      measured: ctx.measureText(t).width,
      isSpace: /^\s+$/.test(t) || t === '',
    }));
    const totalMeasured = tokenData.reduce((s, t) => s + t.measured, 0);
    const scaleFactor = totalMeasured > 0 ? totalItemWidth / totalMeasured : 1;
    let offsetX = 0;

    tokenData.forEach((token) => {
      const tokenWidth = token.measured * scaleFactor;
      if (token.text === '' || token.isSpace) {
        offsetX += tokenWidth;
        return;
      }
      allSpans.push({
        id: spanIdx,
        text: token.text,
        x: b.x + offsetX,
        y: b.y,
        w: tokenWidth,
        h: fontSize,
        fontSize,
        lineIndex,
      });
      spanIdx += 1;
      offsetX += tokenWidth;
    });
  });
  return allSpans;
}

/** Group spans by lineIndex — consistent grouping everywhere. */
function groupByLineIndex(spans) {
  const lines = {};
  spans.forEach((s) => {
    const key = s.lineIndex ?? Math.round(s.y / 4) * 4;
    if (!lines[key]) lines[key] = [];
    lines[key].push(s);
  });
  return Object.values(lines);
}

/** Hit-test: find span at viewport coordinates (generous padding). */
function getSpanAtPoint(spans, pageX, pageY) {
  const padX = 4;
  const padY = 6;
  let best = null;
  let bestDist = Infinity;

  for (const span of spans) {
    const inY = pageY >= span.y - padY && pageY <= span.y + span.h + padY;
    if (!inY) continue;
    const inX = pageX >= span.x - padX && pageX <= span.x + span.w + padX;
    if (inX) return span;
    const dx = pageX < span.x ? span.x - pageX : pageX - (span.x + span.w);
    if (dx < bestDist && dx < 40) {
      bestDist = dx;
      best = span;
    }
  }
  return best;
}

/** Build highlighted text with proper spacing between words. */
function buildHighlightedTextWithSpacing(selectedSpans) {
  if (!selectedSpans.length) return '';
  let text = '';
  for (let i = 0; i < selectedSpans.length; i++) {
    const span = selectedSpans[i];
    if (i > 0) {
      const prev = selectedSpans[i - 1];
      const sameLine = Math.abs(span.y - prev.y) < 6;
      if (!sameLine) {
        text += ' ';
      } else {
        const gap = span.x - (prev.x + prev.w);
        if (gap > 1) text += ' ';
      }
    }
    text += span.text;
  }
  return text.trim();
}

/** Compute rects from spans in unscaled (PDF page) coordinates.
 *  Uses lineIndex grouping so each rect covers exactly one visual line. */
function getRectsFromSpans(spans, scale) {
  if (!spans.length) return [];
  const lines = groupByLineIndex(spans);
  return lines.map((lineSpans) => {
    const minX = Math.min(...lineSpans.map((s) => s.x));
    const maxX = Math.max(...lineSpans.map((s) => s.x + s.w));
    // Use median Y of spans on this line for stability
    const ys = lineSpans.map((s) => s.y);
    const y = ys.sort((a, b) => a - b)[Math.floor(ys.length / 2)];
    const h = Math.max(...lineSpans.map((s) => s.h));
    // Small padding for visual comfort — 2px top, 3px bottom
    const padTop = 2;
    const padBottom = 3;
    return {
      x: (minX - 1) / scale,
      y: (y - padTop) / scale,
      width: (maxX - minX + 2) / scale,
      height: (h + padTop + padBottom) / scale,
    };
  });
}

export default function PDFRenderer({
  pdfData,
  scale,
  highlights = [],
  hoveredHighlightId = null,
  activeHighlightId = null,
  selectionForPicker = null,
  lensColors: lensColorsProp = [],
  onSelectionComplete,
  onNumPages,
  onHighlightHover,
  onHighlightHoverEnd,
  onHighlightEdit,
  onHighlightDelete,
}) {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfData) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const dataCopy = pdfData.slice(0);
        const doc = await pdfjsLib.getDocument({ data: dataCopy }).promise;
        if (!cancelled) {
          setPdf(doc);
          setNumPages(doc.numPages);
          onNumPages?.(doc.numPages);
        }
      } catch (err) {
        console.error('Failed to load PDF', err);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [pdfData, onNumPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }
  if (!pdf) return null;

  return (
    <div className="flex flex-col items-center py-6 gap-4">
      {Array.from({ length: numPages }, (_, i) => (
        <PDFPage
          key={i}
          pdf={pdf}
          pageNumber={i + 1}
          scale={scale}
          pageHighlights={highlights.filter((h) => h.page_number === i + 1)}
          hoveredHighlightId={hoveredHighlightId}
          activeHighlightId={activeHighlightId}
          selectionForPicker={selectionForPicker}
          lensColors={lensColorsProp}
          onSelectionComplete={onSelectionComplete}
          onHighlightHover={onHighlightHover}
          onHighlightHoverEnd={onHighlightHoverEnd}
          onHighlightEdit={onHighlightEdit}
          onHighlightDelete={onHighlightDelete}
        />
      ))}
    </div>
  );
}

function PDFPage({
  pdf,
  pageNumber,
  scale,
  pageHighlights,
  hoveredHighlightId,
  activeHighlightId,
  selectionForPicker,
  lensColors = [],
  onSelectionComplete,
  onHighlightHover,
  onHighlightHoverEnd,
  onHighlightEdit,
  onHighlightDelete,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const overlayRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [spans, setSpans] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const selectionForPickerPrevRef = useRef(null);
  const hoverLeaveTimeoutRef = useRef(null);

  const handleHighlightLeave = useCallback(() => {
    if (hoverLeaveTimeoutRef.current) clearTimeout(hoverLeaveTimeoutRef.current);
    hoverLeaveTimeoutRef.current = setTimeout(() => {
      onHighlightHoverEnd?.();
      hoverLeaveTimeoutRef.current = null;
    }, 1000);
  }, [onHighlightHoverEnd]);

  const handleHighlightEnter = useCallback(
    (highlightId) => {
      if (hoverLeaveTimeoutRef.current) {
        clearTimeout(hoverLeaveTimeoutRef.current);
        hoverLeaveTimeoutRef.current = null;
      }
      onHighlightHover?.(highlightId);
    },
    [onHighlightHover]
  );

  useEffect(() => {
    return () => {
      if (hoverLeaveTimeoutRef.current) clearTimeout(hoverLeaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const page = await pdf.getPage(pageNumber);
      const dpr = getDevicePixelRatio();
      const viewportLayout = page.getViewport({ scale });
      const viewportRender = page.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      canvas.width = viewportRender.width;
      canvas.height = viewportRender.height;
      canvas.style.width = `${viewportLayout.width}px`;
      canvas.style.height = `${viewportLayout.height}px`;
      setDimensions({ width: viewportLayout.width, height: viewportLayout.height });
      await page.render({ canvasContext: ctx, viewport: viewportRender }).promise;
      const textContent = await page.getTextContent();
      if (cancelled) return;
      const spanList = buildSpansFromTextContent(textContent, viewportLayout, scale);
      setSpans(spanList);

      // Build invisible text layer for accessibility (not used for hit-testing)
      const layer = textLayerRef.current;
      if (!layer || cancelled) return;
      layer.innerHTML = '';
      layer.style.width = `${viewportLayout.width}px`;
      layer.style.height = `${viewportLayout.height}px`;
      spanList.forEach((s) => {
        const span = document.createElement('span');
        span.textContent = s.text;
        span.style.position = 'absolute';
        span.style.left = `${s.x}px`;
        span.style.top = `${s.y}px`;
        span.style.width = `${s.w}px`;
        span.style.height = `${s.h}px`;
        span.style.fontSize = `${s.fontSize}px`;
        span.style.fontFamily = 'sans-serif';
        span.style.color = 'transparent';
        span.style.whiteSpace = 'pre';
        span.style.pointerEvents = 'none';
        span.style.lineHeight = '1';
        layer.appendChild(span);
      });
    };
    render();
    return () => { cancelled = true; };
  }, [pdf, pageNumber, scale]);

  const selectedSpans = useMemo(() => {
    if (selectionForPicker && selectionForPicker.pageNumber === pageNumber) {
      const start = Math.min(selectionForPicker.spanStart, selectionForPicker.spanEnd);
      const end = Math.max(selectionForPicker.spanStart, selectionForPicker.spanEnd);
      return spans.filter((s) => s.id >= start && s.id <= end);
    }
    if (selectionStart == null || selectionEnd == null) return [];
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    return spans.filter((s) => s.id >= start && s.id <= end);
  }, [spans, selectionForPicker, pageNumber, selectionStart, selectionEnd]);

  useEffect(() => {
    if (selectionForPicker === null && selectionForPickerPrevRef.current?.pageNumber === pageNumber) {
      setSelectionStart(null);
      setSelectionEnd(null);
    }
    selectionForPickerPrevRef.current = selectionForPicker;
  }, [selectionForPicker, pageNumber]);

  const getPageCoords = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (!spans.length) return;
      const { x, y } = getPageCoords(e.clientX, e.clientY);
      const span = getSpanAtPoint(spans, x, y);
      if (span) {
        setSelectionStart(span.id);
        setSelectionEnd(span.id);
        setIsDragging(true);
      } else {
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    },
    [spans, getPageCoords]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const { x, y } = getPageCoords(e.clientX, e.clientY);
      const span = getSpanAtPoint(spans, x, y);
      if (span) setSelectionEnd(span.id);
    },
    [isDragging, spans, getPageCoords]
  );

  const handleMouseUp = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (!isDragging) return;
      setIsDragging(false);
      if (selectedSpans.length < 2) {
        setSelectionStart(null);
        setSelectionEnd(null);
        return;
      }
      if (!onSelectionComplete) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const positionData = { rects: getRectsFromSpans(selectedSpans, scale) };
      const highlightedText = buildHighlightedTextWithSpacing(selectedSpans);
      const lastSpan = selectedSpans[selectedSpans.length - 1];
      const pickerPosition = {
        x: rect.left + (lastSpan.x + lastSpan.w / 2),
        y: rect.top + (lastSpan.y - 8),
      };
      onSelectionComplete({
        pageNumber,
        position_data: positionData,
        highlighted_text: highlightedText,
        spanStart: Math.min(selectionStart, selectionEnd),
        spanEnd: Math.max(selectionStart, selectionEnd),
        pickerPosition,
      });
    },
    [isDragging, selectedSpans, selectionStart, selectionEnd, scale, pageNumber, onSelectionComplete]
  );

  useEffect(() => {
    const el = overlayRef.current || containerRef.current;
    if (!el) return;
    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mouseleave', handleMouseUp);
    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  const lineGroupsForSelection = useMemo(() => groupByLineIndex(selectedSpans), [selectedSpans]);

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      className="relative shadow-lg bg-white overflow-hidden select-none"
      style={{ width: dimensions.width || 0, height: dimensions.height || 0, cursor: 'text' }}
      title="Drag to highlight text"
    >
      <canvas ref={canvasRef} className="block w-full h-full" style={{ display: 'block' }} />

      {/* Highlight + selection overlay */}
      <div ref={overlayRef} className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
        {/* Saved highlights */}
        {pageHighlights.map((h) => {
          const rects = h.position_data?.rects || [];
          const lensC = (lensColors ?? []).find((c) => c.key === h.color);
          const color = HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow;
          const hex = lensC?.hex ?? color?.hex ?? color?.solid;
          const isHovered = hoveredHighlightId != null && String(h.id) === String(hoveredHighlightId);
          const isActive = activeHighlightId != null && String(h.id) === String(activeHighlightId);
          const bg = isHovered || isActive
            ? hexToRgba(hex, 0.38)
            : hexToRgba(hex, 0.18);
          const hasActions = onHighlightEdit || onHighlightDelete;
          let bbox = null;
          if (rects.length > 0) {
            const left = Math.min(...rects.map((r) => r.x)) * scale;
            const top = Math.min(...rects.map((r) => r.y)) * scale;
            const right = Math.max(...rects.map((r) => (r.x || 0) + (r.width || 0))) * scale;
            const bottom = Math.max(...rects.map((r) => (r.y || 0) + (r.height || 4))) * scale;
            bbox = { left, top, width: right - left, height: bottom - top };
          }
          if (!bbox) return null;
          return (
            <div
              key={h.id}
              className="absolute rounded-sm transition-colors duration-150 group"
              style={{
                left: bbox.left,
                top: bbox.top,
                width: bbox.width,
                height: bbox.height,
                pointerEvents: 'auto',
              }}
              onMouseEnter={() => handleHighlightEnter(h.id)}
              onMouseLeave={handleHighlightLeave}
            >
              {rects.map((r, i) => (
                <div
                  key={i}
                  className="absolute rounded-sm transition-colors duration-150"
                  style={{
                    left: (r.x || 0) * scale - bbox.left,
                    top: (r.y || 0) * scale - bbox.top,
                    width: Math.max(0, (r.width || 0) * scale),
                    height: Math.max(4, (r.height || 0) * scale),
                    backgroundColor: bg,
                    pointerEvents: 'none',
                  }}
                />
              ))}
              {hasActions && isHovered && bbox && (
                <div
                  className="absolute flex items-center gap-0.5 rounded-md border border-slate-200 bg-white shadow-sm z-10"
                  style={{
                    left: 0,
                    bottom: '100%',
                    marginBottom: 4,
                  }}
                  onMouseEnter={() => handleHighlightEnter(h.id)}
                  onMouseLeave={handleHighlightLeave}
                >
                  {onHighlightEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onHighlightEdit(h.id, e);
                      }}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-l-md transition-colors"
                      title="Edit note"
                      aria-label="Edit note"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  )}
                  {onHighlightDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onHighlightDelete(h.id);
                      }}
                      className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-r-md transition-colors"
                      title="Delete highlight"
                      aria-label="Delete highlight"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Active selection */}
        {lineGroupsForSelection.map((lineSpans, idx) => {
          const minX = Math.min(...lineSpans.map((s) => s.x));
          const maxX = Math.max(...lineSpans.map((s) => s.x + s.w));
          // Use median Y for stability
          const ys = lineSpans.map((s) => s.y).sort((a, b) => a - b);
          const y = ys[Math.floor(ys.length / 2)];
          const h = Math.max(...lineSpans.map((s) => s.h));
          const padTop = 2;
          const padBottom = 3;
          return (
            <div
              key={idx}
              className="absolute rounded-sm pointer-events-none"
              style={{
                left: `${minX - 1}px`,
                top: `${y - padTop}px`,
                width: `${maxX - minX + 2}px`,
                height: `${h + padTop + padBottom}px`,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
              }}
            />
          );
        })}
      </div>

      <div
        ref={textLayerRef}
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      />
    </div>
  );
}