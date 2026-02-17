import { useState, useRef, useEffect } from 'react';

export default function EditNotePopover({ position, initialValue = '', onSave, onClose }) {
  const [value, setValue] = useState(initialValue);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, position]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [position]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave(value.trim());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, onSave, onClose]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[1001] w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
      style={{
        left: position.x,
        top: position.y + 6,
        transform: 'translateX(-50%)',
        animation: 'pickerIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a note..."
        rows={3}
        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200 mb-2"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(value.trim())}
          className="rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
