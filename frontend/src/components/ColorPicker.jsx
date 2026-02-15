import { useEffect, useRef, useState } from 'react';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_KEYS, getColorDisplayName } from '../lib/colors';

export default function ColorPicker({ position, onSelect, onClose, colorLabels }) {
  const ref = useRef(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    setComment('');
  }, [position]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!position) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 flex flex-col rounded-xl bg-slate-900 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] min-w-[200px]"
      style={{
        left: position.x,
        top: position.y - 44,
        transform: 'translateX(-50%)',
        animation: 'pickerIn 0.12s ease',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {HIGHLIGHT_COLOR_KEYS.map((key) => {
          const col = HIGHLIGHT_COLORS[key];
          const name = getColorDisplayName(key, colorLabels);
          return (
            <button
              key={key}
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(key, comment.trim() || undefined); }}
              className="h-[26px] w-[26px] rounded-full border-2.5 border-transparent cursor-pointer transition-[transform,border-color] hover:scale-[1.18] hover:border-white/50"
              style={{ backgroundColor: col.hex ?? col.solid }}
              title={name}
            />
          );
        })}
        <div className="mx-0.5 h-[18px] w-px bg-slate-700" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="flex h-6 w-6 items-center justify-center rounded-full border-0 bg-slate-800 text-base leading-none text-slate-500 cursor-pointer hover:text-slate-300"
        >
          ×
        </button>
      </div>
      <label className="text-[11px] text-slate-400 mb-0.5 block">Add comment (optional)</label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Note on this highlight..."
        rows={2}
        className="w-full rounded-lg border border-slate-600 bg-slate-800 text-white text-xs placeholder-slate-500 px-2.5 py-1.5 resize-none outline-none focus:ring-1 focus:ring-slate-500"
      />
    </div>
  );
}
