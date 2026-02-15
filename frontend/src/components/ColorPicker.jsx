import { useState, useRef, useEffect, useCallback } from 'react';
import { HIGHLIGHT_COLOR_KEYS, getColorDisplayName } from '../lib/colors';

// Order and hex match the new design; colorKey is the backend value.
const CATEGORIES = [
  { colorKey: 'yellow', color: '#FBBF24', shortcut: '1' },
  { colorKey: 'green', color: '#34D399', shortcut: '2' },
  { colorKey: 'blue', color: '#60A5FA', shortcut: '3' },
  { colorKey: 'pink', color: '#F472B6', shortcut: '4' },
  { colorKey: 'orange', color: '#FB923C', shortcut: '5' },
];

export default function ColorPicker({ position, onSelect, onClose, colorLabels }) {
  const popupRef = useRef(null);
  const commentRef = useRef(null);
  const [activeColorKey, setActiveColorKey] = useState(null);
  const [comment, setComment] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const getLabel = useCallback((colorKey) => getColorDisplayName(colorKey, colorLabels), [colorLabels]);

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
        if (num >= 1 && num <= 5) {
          const cat = CATEGORIES[num - 1];
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
  }, [isExpanded, activeColorKey, comment, onClose, handleCategoryClick, handleSave]);

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

  const activeCat = activeColorKey ? CATEGORIES.find((c) => c.colorKey === activeColorKey) : null;

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
          className="flex items-center gap-2 rounded-[10px] px-3.5 py-2"
          style={{
            background: '#1e293b',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full"
            style={{ background: activeCat?.color ?? '#64748b' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[13px] font-medium text-slate-200">Saved</span>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: '#1e293b',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
            width: isExpanded ? 280 : 'auto',
            transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="flex items-center gap-0.5 p-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.colorKey}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                title={`${getLabel(cat.colorKey)} (${cat.shortcut})`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 transition-[background] duration-150"
                style={{
                  background: activeColorKey === cat.colorKey ? `${cat.color}20` : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (activeColorKey !== cat.colorKey) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (activeColorKey !== cat.colorKey) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  className="h-4 w-4 rounded-full transition-[box-shadow,transform] duration-150"
                  style={{
                    background: cat.color,
                    boxShadow: activeColorKey === cat.colorKey ? `0 0 0 2px ${cat.color}60` : 'none',
                    transform: activeColorKey === cat.colorKey ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              </button>
            ))}

            <div className="mx-0.5 h-4 w-px bg-white/10" />

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title="Add note"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 transition-[background] duration-150"
              style={{
                background: isExpanded ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                if (!isExpanded) e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13 2.5H3C2.72386 2.5 2.5 2.72386 2.5 3V13C2.5 13.2761 2.72386 13.5 3 13.5H10L13.5 10V3C13.5 2.72386 13.2761 2.5 13 2.5Z"
                  stroke={isExpanded ? '#e2e8f0' : '#94a3b8'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M5.5 6H10.5" stroke={isExpanded ? '#e2e8f0' : '#94a3b8'} strokeWidth="1.2" strokeLinecap="round" />
                <path d="M5.5 8.5H8.5" stroke={isExpanded ? '#e2e8f0' : '#94a3b8'} strokeWidth="1.2" strokeLinecap="round" />
                <path
                  d="M10 13.5V10H13.5"
                  stroke={isExpanded ? '#e2e8f0' : '#94a3b8'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent transition-[background] duration-150 hover:bg-white/10"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M9 3L3 9M3 3L9 9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {isExpanded && (
            <div
              className="px-2 pb-2"
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
                    className="h-2 w-2 rounded-full"
                    style={{ background: activeCat.color }}
                  />
                  <span className="text-[11px] font-medium text-slate-400">
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
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[13px] leading-relaxed text-slate-200 outline-none transition-[border-color] placeholder:text-slate-500 focus:border-white/20"
              />

              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">⌘ Enter to save</span>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!activeCat}
                  className="rounded-md border-0 px-3 py-1 text-xs font-medium transition-all duration-150 disabled:cursor-default disabled:opacity-50"
                  style={{
                    background: activeCat ? activeCat.color : 'rgba(255,255,255,0.06)',
                    color: activeCat ? '#1e293b' : '#475569',
                    cursor: activeCat ? 'pointer' : 'default',
                  }}
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
