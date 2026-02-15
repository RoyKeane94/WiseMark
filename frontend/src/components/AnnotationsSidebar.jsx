import { useState, useMemo } from 'react';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_KEYS, getColorDisplayName } from '../lib/colors';
import { text, border, bg } from '../lib/theme';
import { FileText, Search } from 'lucide-react';

export default function AnnotationsSidebar({
  highlights,
  colorLabels,
  activeHighlightId,
  onScrollToPage,
  onHighlightClick,
  onHighlightHover,
  onHighlightHoverEnd,
  onClearActive,
  documentId,
  onHighlightNoteUpdate,
}) {
  const [colorFilter, setColorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');

  const filtered = useMemo(() => {
    let list = highlights || [];
    if (colorFilter !== 'all') {
      list = list.filter((h) => h.color === colorFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (h) =>
          (h.highlighted_text && h.highlighted_text.toLowerCase().includes(q)) ||
          (h.note?.content && h.note.content.toLowerCase().includes(q))
      );
    }
    return list;
  }, [highlights, colorFilter, searchQuery]);

  const handleStartEditNote = (h) => {
    setEditingNoteId(h.id);
    setEditingNoteValue(h.note?.content ?? '');
  };
  const handleSaveNote = async () => {
    if (editingNoteId == null || !documentId || !onHighlightNoteUpdate) {
      setEditingNoteId(null);
      return;
    }
    await onHighlightNoteUpdate(editingNoteId, editingNoteValue.trim() || '');
    setEditingNoteId(null);
  };
  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  return (
    <div className={`w-80 shrink-0 flex flex-col border-l ${border.default} ${bg.surface}`}>
      <div className={`px-4 pt-5 pb-0 border-b ${border.default}`}>
        <h2 className={`text-[15px] font-semibold ${text.heading} mb-1`}>Annotations</h2>
        <p className={`text-xs ${text.muted} mb-4`}>
          {filtered.length} highlight{filtered.length !== 1 ? 's' : ''}
          {highlights?.length !== filtered.length && ` of ${highlights?.length || 0}`}
        </p>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            type="button"
            onClick={() => { setColorFilter('all'); onClearActive?.(); }}
            className={`text-[11px] font-semibold px-3 py-1 rounded-full border cursor-pointer transition-colors ${
              colorFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : `border-slate-200 ${text.secondary} hover:bg-slate-50`
            }`}
          >
            All
          </button>
          {HIGHLIGHT_COLOR_KEYS.map((key) => {
            const count = (highlights || []).filter((h) => h.color === key).length;
            if (count === 0) return null;
            const def = HIGHLIGHT_COLORS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setColorFilter(colorFilter === key ? 'all' : key); onClearActive?.(); }}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all ${
                  colorFilter === key ? 'border-slate-800 scale-105' : 'border-transparent'
                }`}
                style={{
                  backgroundColor: colorFilter === key ? (def.hex ?? def.solid) : `${def.hex ?? def.solid}25`,
                  color: colorFilter === key ? 'white' : (def.hex ?? def.solid),
                }}
                title={getColorDisplayName(key, colorLabels)}
              >
                {count}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
            strokeWidth={2}
          />
          <input
            type="text"
            placeholder="Search highlights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-8 pr-3 py-1.5 text-xs border ${border.default} rounded-lg bg-slate-50 outline-none ${text.body} placeholder:${text.muted}`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-5">
        {!highlights?.length ? (
          <div className={`py-8 text-center ${text.muted} text-sm`}>
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No highlights yet.</p>
            <p className="mt-1 text-xs">Select text on the document to create your first highlight.</p>
          </div>
        ) : !filtered.length ? (
          <div className={`py-6 text-center ${text.muted} text-sm`}>
            No matching highlights.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((h) => {
              const def = HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow;
              const noteContent = h.note?.content;
              const isActive = activeHighlightId != null && String(h.id) === String(activeHighlightId);
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    className={`w-full text-left rounded-[10px] p-3 transition-all cursor-pointer border ${
                      isActive ? 'border-slate-300' : 'border-transparent hover:border-slate-200'
                    } ${isActive ? (def.rgbaSoft ? '' : '') : 'hover:bg-slate-50'}`}
                    style={isActive && def.rgbaSoft ? { backgroundColor: def.rgbaSoft } : undefined}
                    onClick={() => {
                      onHighlightClick?.(h.id);
                      onScrollToPage?.(h.page_number);
                    }}
                    onMouseEnter={() => onHighlightHover?.(h.id)}
                    onMouseLeave={onHighlightHoverEnd}
                  >
                    <div className="flex gap-2.5">
                      <div
                        className="w-0.5 min-h-9 shrink-0 rounded-full transition-opacity"
                        style={{
                          backgroundColor: def.hex ?? def.solid,
                          opacity: isActive ? 1 : 0.6,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs leading-snug ${text.body} line-clamp-3`}
                        >
                          {h.highlighted_text || '(No text captured)'}
                        </p>
                      </div>
                    </div>
                    {editingNoteId === h.id ? (
                      <div className="mt-2 pl-3.5 space-y-1.5">
                        <textarea
                          value={editingNoteValue}
                          onChange={(e) => setEditingNoteValue(e.target.value)}
                          placeholder="Add a comment..."
                          rows={2}
                          className={`w-full text-[11.5px] border ${border.default} rounded-lg px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-slate-300 ${text.body}`}
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={handleSaveNote}
                            className="text-[11px] font-medium px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditNote}
                            className="text-[11px] font-medium px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {noteContent && (
                          <p
                            className={`text-[11.5px] ${text.muted} mt-2 pl-3.5 leading-snug italic`}
                          >
                            {noteContent}
                          </p>
                        )}
                        {documentId && onHighlightNoteUpdate && (
                          <button
                            type="button"
                            onClick={() => handleStartEditNote(h)}
                            className="mt-1.5 pl-3.5 text-[11px] text-slate-500 hover:text-slate-700"
                          >
                            {noteContent ? 'Edit comment' : 'Add comment'}
                          </button>
                        )}
                      </>
                    )}
                    <div className="mt-2 pl-3.5 flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{
                          color: def.hex ?? def.solid,
                          backgroundColor: `${def.hex ?? def.solid}12`,
                        }}
                      >
                        {getColorDisplayName(h.color, colorLabels)}
                      </span>
                      <span className="text-[10px] text-slate-400">p.{h.page_number}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
