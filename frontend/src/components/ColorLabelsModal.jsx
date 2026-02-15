import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsAPI } from '../lib/api';
import { HIGHLIGHT_COLOR_KEYS, HIGHLIGHT_COLORS } from '../lib/colors';
import { text, border, bg, btnPrimary } from '../lib/theme';

export default function ColorLabelsModal({ colorLabels = {}, documentId, onSave, onClose }) {
  const queryClient = useQueryClient();
  const [labels, setLabels] = useState({});

  useEffect(() => {
    setLabels({ ...colorLabels });
  }, [colorLabels]);

  const updateDoc = useMutation({
    mutationFn: (data) => documentsAPI.update(documentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      onSave?.();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = {};
    HIGHLIGHT_COLOR_KEYS.forEach((key) => {
      const v = labels[key];
      if (typeof v === 'string' && v.trim()) cleaned[key] = v.trim();
    });
    updateDoc.mutate({ color_labels: cleaned });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className={`${bg.surface} rounded-xl shadow-xl border ${border.default} w-full max-w-md mx-4 overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2 border-b border-slate-200">
          <h3 className={`text-base font-semibold ${text.heading}`}>Customize topic names</h3>
          <p className={`text-xs ${text.muted} mt-0.5`}>
            Change what each colour means for this document (e.g. Orange → Legal DD).
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {HIGHLIGHT_COLOR_KEYS.map((key) => {
            const col = HIGHLIGHT_COLORS[key];
            const defaultName = col?.name || key;
            return (
              <div key={key} className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full shrink-0 border-2 border-slate-200"
                  style={{ backgroundColor: col?.hex ?? col?.solid }}
                />
                <div className="flex-1 min-w-0">
                  <label className={`text-xs ${text.muted} block mb-0.5`}>
                    {col?.label ?? key} (default: {defaultName})
                  </label>
                  <input
                    type="text"
                    value={labels[key] ?? ''}
                    onChange={(e) => setLabels((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={defaultName}
                    className={`w-full rounded-lg border ${border.default} px-3 py-2 text-sm ${text.body} placeholder:${text.muted} outline-none focus:ring-2 focus:ring-slate-300`}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={updateDoc.isPending}>
              {updateDoc.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
