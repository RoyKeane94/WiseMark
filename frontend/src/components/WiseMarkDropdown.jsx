import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * WiseMark-styled dropdown. Options: [{ value, label }].
 * value can be string, number, or null.
 */
export default function WiseMarkDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  minWidth = '120px',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : placeholder;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border-[1.5px] border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-xs font-medium justify-between w-full"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          color: selected ? '#1E293B' : '#64748B',
          minWidth,
        }}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 py-1 bg-white rounded-[10px] border border-slate-200 shadow-lg"
          style={{ fontFamily: "'DM Sans', sans-serif", minWidth }}
        >
          {options.map((opt) => (
            <button
              key={opt.value ?? 'empty'}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors ${
                value === opt.value
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {value === opt.value ? (
                <Check className="w-3.5 h-3.5 shrink-0 text-slate-700" />
              ) : (
                <span className="w-3.5" />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
