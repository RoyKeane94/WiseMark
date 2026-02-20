import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { HIGHLIGHT_COLOR_KEYS, getColorDisplayName } from '../lib/colors';

// Fallback when no preset from API; colorKey is the backend value.
const CATEGORIES = [
  { colorKey: 'yellow', color: '#FBBF24', shortcut: '1' },
  { colorKey: 'green', color: '#34D399', shortcut: '2' },
  { colorKey: 'blue', color: '#60A5FA', shortcut: '3' },
  { colorKey: 'pink', color: '#F472B6', shortcut: '4' },
  { colorKey: 'orange', color: '#FB923C', shortcut: '5' },
];

/** Build picker categories from API preset colors or fallback to documentColorKeys + CATEGORIES. */
function buildCategories(presetColors, documentColorKeys) {
  if (presetColors?.length) {
    const sorted = [...presetColors].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return sorted.map((c, i) => ({
      colorKey: c.key,
      color: c.hex,
      shortcut: String(i + 1),
    }));
  }
  if (documentColorKeys?.length > 0) {
    return documentColorKeys
      .map((colorKey) => CATEGORIES.find((c) => c.colorKey === colorKey))
      .filter(Boolean);
  }
  return CATEGORIES;
}

export default function ColorPicker({ position, onSelect, onClose, colorLabels, documentColorKeys, presetColors = [] }) {
  const popupRef = useRef(null);
  const commentRef = useRef(null);
  const [activeColorKey, setActiveColorKey] = useState(null);
  const [comment, setComment] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const categories = useMemo(
    () => buildCategories(presetColors, documentColorKeys),
    [presetColors, documentColorKeys]
  );
  const safeCategories = categories.length > 0 ? categories : CATEGORIES;

  const getLabel = useCallback(
    (colorKey) => getColorDisplayName(colorKey, colorLabels, presetColors),
    [colorLabels, presetColors]
  );

  useEffect(() => {
    if (isExpanded && commentRef.current) {
      commentRef.current.focus();
    }
  }, [isExpanded]);

  const handleCategoryClick = useCallback(
    (cat) => {
      setActiveColorKey(cat.colorKey);
      if (!isExpanded) {
        onSelect(cat.colorKey, '');
        setJustSaved(true);
        setTimeout(() => onClose(), 400);
      }
    },
    [isExpanded, onSelect, onClose]
  );

  const handleSave = useCallback(() => {
    if (activeColorKey) {
      onSelect(activeColorKey, comment.trim() || undefined);
      setJustSaved(true);
      setTimeout(() => onClose(), 400);
    }
  }, [activeColorKey, comment, onSelect, onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (!isExpanded) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= safeCategories.length) {
          const cat = safeCategories[num - 1];
          if (cat) handleCategoryClick(cat);
        }
      }
      if (isExpanded && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, activeColorKey, comment, onClose, handleCategoryClick, handleSave, safeCategories]);

  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  useEffect(() => {
    setComment('');
    setActiveColorKey(null);
    setIsExpanded(false);
    setJustSaved(false);
  }, [position]);

  if (!position) return null;

  const activeCat = activeColorKey ? safeCategories.find((c) => c.colorKey === activeColorKey) : null;

  return (
    <div
      ref={popupRef}
      className="fixed z-[1000]"
      style={{
        left: position.x,
        top: position.y - 48,
        transform: 'translateX(-50%)',
        animation: 'pickerIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {justSaved ? (
        <div
          className="flex items-center gap-2 rounded-[10px] px-3.5 py-2 bg-white border border-slate-200 shadow-md"
        >
          <div
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full"
            style={{ background: activeCat?.color ?? '#64748b' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[13px] font-medium text-slate-800">Saved</span>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl bg-white border border-slate-200 shadow-lg"
          style={{
            width: isExpanded ? 280 : 'auto',
            transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="flex items-center gap-0.5 p-1.5">
            {safeCategories.map((cat, idx) => (
              <button
                key={cat.colorKey}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 transition-colors duration-150 hover:bg-slate-100"
                style={{
                  background: activeColorKey === cat.colorKey ? `${cat.color}25` : 'transparent',
                }}
              >
                  <div
                    className="h-4 w-4 rounded-full transition-[box-shadow,transform] duration-150"
                    style={{
                      background: cat.color,
                      boxShadow: activeColorKey === cat.colorKey ? `0 0 0 2px ${cat.color}80` : 'none',
                      transform: activeColorKey === cat.colorKey ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                </button>
            ))}

            <div className="mx-0.5 h-4 w-px bg-slate-200" />

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title="Add note"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 transition-colors duration-150 ${
                isExpanded ? 'bg-slate-100' : 'hover:bg-slate-100'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13 2.5H3C2.72386 2.5 2.5 2.72386 2.5 3V13C2.5 13.2761 2.72386 13.5 3 13.5H10L13.5 10V3C13.5 2.72386 13.2761 2.5 13 2.5Z"
                  stroke={isExpanded ? '#475569' : '#64748b'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M5.5 6H10.5" stroke={isExpanded ? '#475569' : '#64748b'} strokeWidth="1.2" strokeLinecap="round" />
                <path d="M5.5 8.5H8.5" stroke={isExpanded ? '#475569' : '#64748b'} strokeWidth="1.2" strokeLinecap="round" />
                <path
                  d="M10 13.5V10H13.5"
                  stroke={isExpanded ? '#475569' : '#64748b'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {isExpanded && (
            <div
              className="px-2 pb-2 border-t border-slate-100 pt-2"
              style={{ animation: 'expandIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {!activeCat && (
                <div className="px-1.5 pb-2 pt-1 text-[11px] text-slate-500">
                  Pick a category above, then add your note
                </div>
              )}

              {activeCat && (
                <div className="flex items-center gap-1.5 px-1.5 pb-2 pt-0.5">
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: activeCat.color }}
                  />
                  <span className="text-[11px] font-medium text-slate-600">
                    {getLabel(activeCat.colorKey)}
                  </span>
                </div>
              )}

              <textarea
                ref={commentRef}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
              />

              <div className="mt-1.5 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!activeCat}
                  className="rounded-lg border-0 px-3 py-1.5 text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-default transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
