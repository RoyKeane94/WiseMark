import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { libraryAPI, lensesAPI } from '../lib/api';
import AppHeader from '../components/AppHeader';
import { normalizePdfText } from '../lib/pdfText';
import { hexToRgba } from '../lib/colors';
import { headerBar, btnIcon, text, bg, border } from '../lib/theme';
import {
  Search,
  X,
  Copy,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  BarChart3,
  Loader2,
  Bookmark,
  Trash2,
} from 'lucide-react';

function highlightMatch(str, query) {
  if (!query || query.length < 2) return str;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = str.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-200 rounded-sm px-px">{part}</mark>
      : part
  );
}

const SAVED_SEARCHES_KEY = 'wisemark_saved_searches';

function loadSavedSearches() {
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [{ id: 's1', name: 'Margin compression', query: 'margin compression', filters: { categories: [] } }];
}

function saveSavedSearches(list) {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(list));
}

function ResultCard({ ann, query, hovered, onHover, onLeave, showDoc, onNavigate }) {
  const [copied, setCopied] = useState(false);
  const hex = ann.color_hex || '#94a3b8';

  const handleCopy = (e) => {
    e.stopPropagation();
    const copyText = `"${normalizePdfText(ann.highlighted_text)}"${ann.note?.content ? `\n  Note: ${normalizePdfText(ann.note.content)}` : ''}`;
    navigator.clipboard?.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const borderColor = hovered ? '#D1D9E2' : '#EDF0F4';
  return (
    <div
      onMouseEnter={() => onHover(ann.id)}
      onMouseLeave={onLeave}
      onClick={() => onNavigate(ann.document_id)}
      className="bg-white rounded-[10px] transition-all cursor-pointer"
      style={{
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${hex}`,
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
      }}
    >
      <div className="px-4 py-3.5">
        <p
          className={`text-xs leading-snug ${text.body} whitespace-pre-line`}
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          &ldquo;{highlightMatch(normalizePdfText(ann.highlighted_text), query)}&rdquo;
        </p>

        {ann.note?.content && (
          <p
            className={`mt-2 text-[11.5px] ${text.muted} leading-snug italic whitespace-pre-line`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {highlightMatch(normalizePdfText(ann.note.content), query)}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100 flex-wrap">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ color: hex, background: hexToRgba(hex, 0.08) }}
          >
            {ann.color_display_name}
          </span>
          <span className="text-[11px] font-medium text-slate-400">p.{ann.page_number}</span>

          {showDoc && (
            <>
              <span className="text-slate-200">&middot;</span>
              <span className="text-[11px] text-slate-500 font-medium truncate max-w-[220px] flex items-center gap-1">
                <FileText className="w-3 h-3 shrink-0" />
                {ann.document_name?.replace(/\.pdf$/i, '')}
              </span>
            </>
          )}
          <span className="text-slate-200">&middot;</span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <FolderOpen className="w-2.5 h-2.5 shrink-0" />
            {ann.project_name}
          </span>

          <div
            className="ml-auto flex gap-1 transition-opacity"
            style={{ opacity: hovered ? 1 : 0 }}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-50"
              style={{ color: copied ? '#16A34A' : '#64748B' }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightPanel({ results, colorMap }) {
  const catCounts = {};
  const docCounts = {};
  const projectCounts = {};

  results.forEach((a) => {
    catCounts[a.color] = (catCounts[a.color] || 0) + 1;
    docCounts[a.document_id] = (docCounts[a.document_id] || 0) + 1;
    projectCounts[a.project_id] = (projectCounts[a.project_id] || 0) + 1;
  });

  const topDocs = Object.entries(docCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  const maxCount = topDocs.length ? topDocs[0][1] : 1;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 mb-4">
      <div className="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-slate-600">
        <BarChart3 className="w-3.5 h-3.5" /> Search insights
      </div>

      <div className="flex gap-1 flex-wrap mb-2.5">
        {Object.entries(catCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([key, count]) => {
            const info = colorMap[key];
            const hex = info?.hex || '#94a3b8';
            return (
              <span
                key={key}
                className="text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1"
                style={{ color: hex, background: hexToRgba(hex, 0.08) }}
              >
                <strong>{count}</strong> {info?.name || key}
              </span>
            );
          })}
      </div>

      <div className="text-[11px] text-slate-500">
        <span className="font-semibold">Across {Object.keys(docCounts).length} documents</span>
        <span className="text-slate-400"> in {Object.keys(projectCounts).length} projects</span>
        <div className="mt-1.5 flex flex-col gap-1">
          {topDocs.map(([docId, count]) => {
            const ann = results.find((a) => a.document_id === Number(docId));
            return (
              <div key={docId} className="flex items-center gap-2">
                <div
                  className="h-1 rounded bg-slate-300"
                  style={{ width: Math.max(12, (count / maxCount) * 80) }}
                />
                <span className="text-[11px] text-slate-500 truncate max-w-[260px]">
                  {ann?.document_name?.replace(/\.pdf$/i, '')} ({count})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [projectFilters, setProjectFilters] = useState([]);
  const [groupBy, setGroupBy] = useState('flat');
  const [hoveredId, setHoveredId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: async () => {
      const { data } = await libraryAPI.get();
      return data;
    },
  });

  const { data: lensesData = [] } = useQuery({
    queryKey: ['lenses'],
    queryFn: async () => {
      const { data } = await lensesAPI.list();
      return data;
    },
  });

  const [selectedLensId, setSelectedLensId] = useState(null);
  const [savedSearches, setSavedSearches] = useState(loadSavedSearches);

  const highlights = data?.highlights || [];
  const projects = data?.projects || [];
  const lenses = lensesData;

  useEffect(() => { inputRef.current?.focus(); }, []);


  const selectedLens = useMemo(() => {
    if (selectedLensId == null) return null;
    return lenses.find((l) => l.id === selectedLensId) ?? null;
  }, [lenses, selectedLensId]);

  const colorMap = useMemo(() => {
    if (selectedLens?.colors?.length) {
      const m = {};
      selectedLens.colors.forEach((c) => {
        m[c.key] = { name: c.display_name || c.key, hex: c.hex || '#94a3b8' };
      });
      return m;
    }
    const m = {};
    highlights.forEach((h) => {
      if (!m[h.color]) {
        m[h.color] = { name: h.color_display_name, hex: h.color_hex };
      }
    });
    return m;
  }, [selectedLens, highlights]);

  const handleSearch = useCallback((q) => {
    setQuery(q);
    setActiveQuery(q);
  }, []);

  const applySavedSearch = useCallback((s) => {
    setQuery(s.query);
    setActiveQuery(s.query);
    if (s.filters?.categories?.length) setCategoryFilters(s.filters.categories);
    if (s.filters?.projects?.length) setProjectFilters(s.filters.projects);
  }, []);

  const saveCurrentSearch = useCallback(() => {
    const name = activeQuery || 'Untitled search';
    const newItem = {
      id: 's' + Date.now(),
      name,
      query: activeQuery,
      filters: { categories: [...categoryFilters], projects: [...projectFilters] },
    };
    const next = [...savedSearches.filter((s) => s.query !== activeQuery), newItem];
    setSavedSearches(next);
    saveSavedSearches(next);
  }, [activeQuery, categoryFilters, projectFilters, savedSearches]);

  const deleteSavedSearch = useCallback((id, e) => {
    e?.stopPropagation?.();
    const next = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(next);
    saveSavedSearches(next);
  }, [savedSearches]);

  const toggleCategory = useCallback((key) => {
    setCategoryFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const toggleProject = useCallback((id) => {
    setProjectFilters((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  }, []);

  const results = useMemo(() => {
    let r = highlights;
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      r = r.filter(
        (a) =>
          a.highlighted_text?.toLowerCase().includes(q) ||
          a.note?.content?.toLowerCase().includes(q) ||
          a.color_display_name?.toLowerCase().includes(q)
      );
    }
    if (categoryFilters.length > 0) {
      r = r.filter((a) => categoryFilters.includes(a.color));
    }
    if (projectFilters.length > 0) {
      r = r.filter((a) => projectFilters.includes(a.project_id));
    }
    return r;
  }, [highlights, activeQuery, categoryFilters, projectFilters]);

  const grouped = useMemo(() => {
    if (groupBy === 'document') {
      const g = {};
      results.forEach((a) => {
        if (!g[a.document_id]) g[a.document_id] = [];
        g[a.document_id].push(a);
      });
      return g;
    }
    if (groupBy === 'category') {
      const g = {};
      results.forEach((a) => {
        if (!g[a.color]) g[a.color] = [];
        g[a.color].push(a);
      });
      return g;
    }
    return null;
  }, [groupBy, results]);

  const hasActiveFilters = categoryFilters.length > 0 || projectFilters.length > 0;
  const resultsActive = activeQuery || hasActiveFilters;

  const totalDocs = useMemo(() => {
    const ids = new Set(highlights.map((h) => h.document_id));
    return ids.size;
  }, [highlights]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB]" style={{ fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <AppHeader showBack backTo="/app" />
      {/* Sticky header */}
      <div className="bg-white border-b border-slate-200 sticky top-[65px] z-40">
        <div className="max-w-[860px] mx-auto px-7 pt-4">
          {/* Top row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[17px] font-semibold text-slate-900 tracking-tight">Library</h1>
              <span className="text-xs text-slate-400 ml-1">
                {highlights.length} annotations across {totalDocs} documents
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2.5 bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-3.5 py-2.5 mb-3.5 focus-within:border-slate-400 transition-colors">
            <Search className="w-[18px] h-[18px] text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setActiveQuery(query); }}
              placeholder="Search across all your annotations..."
              className="border-0 bg-transparent outline-none text-[15px] text-slate-900 w-full placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setActiveQuery(''); }}
                className="bg-slate-200 rounded p-0.5 text-slate-500 hover:bg-slate-300 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setActiveQuery(query)}
              className="bg-slate-800 text-white rounded-lg px-4 py-1.5 text-[13px] font-medium hover:bg-slate-700 shrink-0"
            >
              Search
            </button>
          </div>

          {/* Saved searches */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Bookmark className="w-3 h-3" />
              Saved:
            </span>
            {savedSearches.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-0.5 group"
              >
                <button
                  onClick={() => applySavedSearch(s)}
                  className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full pl-3 pr-2 py-1 hover:border-slate-400 hover:text-slate-900 transition-colors"
                >
                  {s.name}
                </button>
                <button
                  onClick={(e) => deleteSavedSearch(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all"
                  title="Delete saved search"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            {resultsActive && (
              <button
                onClick={saveCurrentSearch}
                className="text-xs text-slate-500 border border-dashed border-slate-300 rounded-full px-3 py-1 hover:border-slate-400 hover:text-slate-700"
              >
                Save this search
              </button>
            )}
          </div>

          {/* Lens dropdown & filter pills */}
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            <div className="flex items-center gap-1.5 mr-1">
              <span className="text-[11px] text-slate-400 font-medium">Lens:</span>
              <select
                value={selectedLensId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedLensId(v === '' ? null : Number(v));
                }}
                className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer outline-none focus:ring-1 focus:ring-slate-300"
              >
                <option value="">No lens</option>
                {lenses.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            {Object.entries(colorMap).map(([key, info]) => {
              const active = categoryFilters.includes(key);
              const hex = info.hex;
              return (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border-[1.5px] transition-all"
                  style={{
                    borderColor: active ? hexToRgba(hex, 0.5) : '#E8ECF0',
                    background: active ? hexToRgba(hex, 0.08) : '#FAFBFC',
                    opacity: active ? 1 : (categoryFilters.length > 0 ? 0.4 : 0.7),
                  }}
                >
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: hex }} />
                  <span className="text-xs font-medium" style={{ color: active ? '#374151' : '#94A3B8' }}>
                    {info.name}
                  </span>
                </button>
              );
            })}

            {Object.keys(colorMap).length > 0 && projects.length > 0 && (
              <div className="w-px h-[18px] bg-slate-200 mx-1" />
            )}

            {projects.map((p) => {
              const active = projectFilters.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border-[1.5px] transition-all"
                  style={{
                    borderColor: active ? '#475569' : '#E8ECF0',
                    background: active ? '#F1F5F9' : '#FAFBFC',
                    opacity: active ? 1 : (projectFilters.length > 0 ? 0.4 : 0.7),
                  }}
                >
                  <FolderOpen className="w-2.5 h-2.5" />
                  <span className="text-xs font-medium" style={{ color: active ? '#1E293B' : '#94A3B8' }}>
                    {p.name}
                  </span>
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                onClick={() => { setCategoryFilters([]); setProjectFilters([]); }}
                className="text-xs text-slate-400 border border-dashed border-slate-300 rounded-full px-2.5 py-1 hover:text-slate-600"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative px-7 py-5 pb-20">
        {/* Main results - centered, fixed width */}
        <div className="max-w-[860px] mx-auto">
        {/* Results header */}
        {resultsActive && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-slate-500">
              <strong className="text-slate-900">{results.length}</strong> result{results.length !== 1 && 's'}
              {activeQuery && <> for &ldquo;<strong className="text-slate-900">{activeQuery}</strong>&rdquo;</>}
              {hasActiveFilters && <span className="text-slate-400"> (filtered)</span>}
            </span>

            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 cursor-pointer outline-none"
            >
              <option value="flat">No grouping</option>
              <option value="document">Group by document</option>
              <option value="category">Group by category</option>
            </select>
          </div>
        )}

        {/* Empty state */}
        {!resultsActive && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-[15px] text-slate-600 font-medium mb-1.5">
              Search across all your annotations
            </p>
            <p className="text-[13px] text-slate-400 max-w-[380px] mx-auto">
              Find patterns across deals, surface past insights, and build on your own analysis.
            </p>
          </div>
        )}

        {/* No results */}
        {resultsActive && results.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            No annotations match your search. Try different keywords or clear your filters.
          </div>
        )}

        {/* Flat results */}
        {resultsActive && groupBy === 'flat' && results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((ann) => (
              <ResultCard
                key={ann.id}
                ann={ann}
                query={activeQuery}
                hovered={hoveredId === ann.id}
                onHover={setHoveredId}
                onLeave={() => setHoveredId(null)}
                showDoc
                onNavigate={(docId) => navigate(`/document/${docId}`)}
              />
            ))}
          </div>
        )}

        {/* Grouped by document */}
        {resultsActive && groupBy === 'document' && grouped && (
          <div className="flex flex-col gap-5">
            {Object.entries(grouped).map(([docId, items]) => {
              const first = items[0];
              return (
                <div key={docId}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[13px] font-semibold text-slate-900">
                      {first?.document_name?.replace(/\.pdf$/i, '')}
                    </span>
                    <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 rounded">
                      {items.length}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <FolderOpen className="w-2.5 h-2.5" /> {first?.project_name}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((ann) => (
                      <ResultCard
                        key={ann.id}
                        ann={ann}
                        query={activeQuery}
                        hovered={hoveredId === ann.id}
                        onHover={setHoveredId}
                        onLeave={() => setHoveredId(null)}
                        showDoc={false}
                        onNavigate={(docId) => navigate(`/document/${docId}`)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grouped by category */}
        {resultsActive && groupBy === 'category' && grouped && (
          <div className="flex flex-col gap-5">
            {Object.entries(colorMap).map(([key, info]) => {
              const items = grouped[key];
              if (!items || items.length === 0) return null;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: info.hex }} />
                    <span className="text-[13px] font-semibold text-slate-900">{info.name}</span>
                    <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 rounded">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((ann) => (
                      <ResultCard
                        key={ann.id}
                        ann={ann}
                        query={activeQuery}
                        hovered={hoveredId === ann.id}
                        onHover={setHoveredId}
                        onLeave={() => setHoveredId(null)}
                        showDoc
                        onNavigate={(docId) => navigate(`/document/${docId}`)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Search insights - absolute overlay on right, does not shift main content */}
        {resultsActive && results.length > 3 && (
          <div className="absolute right-7 top-5 w-[260px]">
            <div className="sticky top-24">
              <InsightPanel results={results} colorMap={colorMap} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
