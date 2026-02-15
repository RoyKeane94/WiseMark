import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { documentsAPI } from '../lib/api';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_KEYS, getColorDisplayName } from '../lib/colors';
import { pageWrapper, headerBar, text, bg, btnPrimary, btnIcon, border } from '../lib/theme';
import { ArrowLeft, Loader2, ListOrdered, Layers } from 'lucide-react';

const SORT_SEQUENCE = 'sequence';
const SORT_TOPIC = 'topic';

export default function SummaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState(SORT_SEQUENCE);

  const { data: document, isLoading: docLoading, isError: docError } = useQuery({
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

  const colorLabels = document?.color_labels || {};

  const ordered = useMemo(() => {
    const list = [...(highlights || [])];
    if (sortBy === SORT_SEQUENCE) {
      list.sort((a, b) => {
        if (a.page_number !== b.page_number) return a.page_number - b.page_number;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      return list;
    }
    list.sort((a, b) => {
      const topicA = getColorDisplayName(a.color, colorLabels);
      const topicB = getColorDisplayName(b.color, colorLabels);
      if (topicA !== topicB) return topicA.localeCompare(topicB);
      if (a.page_number !== b.page_number) return a.page_number - b.page_number;
      return new Date(a.created_at) - new Date(b.created_at);
    });
    return list;
  }, [highlights, sortBy, colorLabels]);

  const byTopicOrdered = useMemo(() => {
    if (sortBy !== SORT_TOPIC) return [];
    const groups = {};
    (highlights || []).forEach((h) => {
      const topic = getColorDisplayName(h.color, colorLabels);
      if (!groups[topic]) groups[topic] = [];
      groups[topic].push(h);
    });
    HIGHLIGHT_COLOR_KEYS.forEach((key) => {
      const topic = getColorDisplayName(key, colorLabels);
      if (groups[topic]) {
        groups[topic].sort((a, b) => {
          if (a.page_number !== b.page_number) return a.page_number - b.page_number;
          return new Date(a.created_at) - new Date(b.created_at);
        });
      }
    });
    return HIGHLIGHT_COLOR_KEYS.map((key) => ({
      topic: getColorDisplayName(key, colorLabels),
      colorKey: key,
      items: groups[getColorDisplayName(key, colorLabels)] || [],
    })).filter((g) => g.items.length > 0);
  }, [highlights, sortBy, colorLabels]);

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

  if (docError || !document) {
    return (
      <div className={`${pageWrapper} flex flex-col items-center justify-center min-h-[50vh]`}>
        <h2 className={`text-lg font-semibold ${text.heading} mb-2`}>Document not found</h2>
        <button type="button" onClick={() => navigate(document?.project ? `/project/${document.project}` : '/')} className={btnPrimary}>
          Back to project
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bg.page}`}>
      <header className={`${headerBar} px-4 py-2.5 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(`/document/${id}`)} className={btnIcon}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className={`text-sm font-semibold ${text.heading}`}>Summary</h1>
            <p className={`text-xs ${text.muted} truncate max-w-[200px]`}>{document.filename}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          <button
            type="button"
            onClick={() => setSortBy(SORT_SEQUENCE)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              sortBy === SORT_SEQUENCE ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            Sequence
          </button>
          <button
            type="button"
            onClick={() => setSortBy(SORT_TOPIC)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              sortBy === SORT_TOPIC ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Topic
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6 max-w-3xl mx-auto w-full">
        {!highlights?.length ? (
          <div className={`py-12 text-center ${text.muted} text-sm`}>
            <p>No highlights yet.</p>
            <p className="mt-1">Select text in the document to create highlights, then return here for a summary.</p>
            <button
              type="button"
              onClick={() => navigate(`/document/${id}`)}
              className={`${btnPrimary} mt-4`}
            >
              Open document
            </button>
          </div>
        ) : sortBy === SORT_TOPIC && byTopicOrdered.length > 0 ? (
          <div className="space-y-8">
            {byTopicOrdered.map(({ topic, colorKey, items }) => {
              const def = HIGHLIGHT_COLORS[colorKey] || HIGHLIGHT_COLORS.yellow;
              return (
                <section key={topic}>
                  <h2 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: def.hex ?? def.solid }}
                    />
                    {topic}
                    <span className="text-slate-400 font-normal text-xs">({items.length})</span>
                  </h2>
                  <ul className="space-y-3">
                    {items.map((h) => (
                      <li
                        key={h.id}
                        className={`rounded-lg border ${border.default} ${bg.surface} p-4`}
                      >
                        <p className={`text-sm ${text.body} leading-snug`}>
                          {h.highlighted_text || '(No text captured)'}
                        </p>
                        {h.note?.content && (
                          <p className={`text-xs ${text.muted} mt-2 italic`}>{h.note.content}</p>
                        )}
                        <p className={`text-[11px] ${text.muted} mt-2`}>p.{h.page_number}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <ul className="space-y-3">
            {ordered.map((h) => {
              const def = HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow;
              const topic = getColorDisplayName(h.color, colorLabels);
              return (
                <li
                  key={h.id}
                  className={`rounded-lg border ${border.default} ${bg.surface} p-4 flex gap-3`}
                >
                  <div
                    className="w-1 min-h-8 rounded-full shrink-0"
                    style={{ backgroundColor: def.hex ?? def.solid }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${text.body} leading-snug`}>
                      {h.highlighted_text || '(No text captured)'}
                    </p>
                    {h.note?.content && (
                      <p className={`text-xs ${text.muted} mt-2 italic`}>{h.note.content}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{
                          color: def.hex ?? def.solid,
                          backgroundColor: `${def.hex ?? def.solid}18`,
                        }}
                      >
                        {topic}
                      </span>
                      <span className={`text-[11px] ${text.muted}`}>p.{h.page_number}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
