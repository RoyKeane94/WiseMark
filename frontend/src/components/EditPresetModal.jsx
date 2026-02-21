import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { presetsAPI } from '../lib/api';
import { text, border, bg } from '../lib/theme';
import { X } from 'lucide-react';

const PALETTE = [
  '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#FB923C',
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
];

const MAX_COLORS = 10;

export default function EditPresetModal({ preset, documentId, onClose }) {
  const queryClient = useQueryClient();
  const colors = preset?.colors ?? [];
  const isSystem = !preset || preset.is_system;

  const [addingHex, setAddingHex] = useState(null);
  const [addingName, setAddingName] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['presets'] });
    queryClient.invalidateQueries({ queryKey: ['document', documentId] });
  };

  const addColor = useMutation({
    mutationFn: (data) => presetsAPI.addColor(preset.id, data),
    onSuccess: () => {
      invalidate();
      setAddingHex(null);
      setAddingName('');
    },
  });

  const removeColor = useMutation({
    mutationFn: (colorId) => presetsAPI.removeColor(preset.id, colorId),
    onSuccess: invalidate,
  });

  const updateColor = useMutation({
    mutationFn: ({ colorId, data }) => presetsAPI.updateColor(preset.id, colorId, data),
    onSuccess: invalidate,
  });

  const usedHexes = new Set(colors.map((c) => c.hex.toLowerCase()));
  const available = PALETTE.filter((h) => !usedHexes.has(h.toLowerCase()));

  const handleConfirmAdd = () => {
    if (!addingHex || !addingName.trim()) return;
    addColor.mutate({
      key: `custom_${Date.now()}`,
      display_name: addingName.trim(),
      hex: addingHex,
    });
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 cursor-pointer"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 ${bg.surface} rounded-xl shadow-xl border ${border.default} w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <h3 className={`text-base font-semibold ${text.heading}`}>Edit preset</h3>
          {preset && (
            <p className={`text-xs ${text.muted} mt-0.5`}>{preset.name}</p>
          )}
        </div>

        <div className="px-5 py-4 space-y-4 overflow-auto flex-1 min-h-0">
          {isSystem ? (
            <p className={`text-sm ${text.secondary}`}>
              System presets cannot be edited. Create a custom preset from Settings to customise colours.
            </p>
          ) : (
            <>
              {/* Current colours with editable labels */}
              <div>
                <p className={`text-xs ${text.muted} mb-2.5 uppercase tracking-wider font-medium`}>
                  Colours ({colors.length}/{MAX_COLORS})
                </p>
                <div className="space-y-2">
                  {colors.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full shrink-0 border-2 border-slate-200"
                        style={{ backgroundColor: c.hex }}
                      />
                      <input
                        type="text"
                        defaultValue={c.display_name}
                        placeholder="Label"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val && val !== c.display_name) {
                            updateColor.mutate({ colorId: c.id, data: { display_name: val } });
                          }
                        }}
                        className={`flex-1 min-w-0 rounded-lg border ${border.default} px-2.5 py-1.5 text-sm ${text.body} placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-200`}
                      />
                      {colors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeColor.mutate(c.id)}
                          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          disabled={removeColor.isPending}
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add colour */}
              {colors.length < MAX_COLORS && available.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  {addingHex ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full shrink-0 border-2 border-slate-300"
                          style={{ backgroundColor: addingHex }}
                        />
                        <input
                          type="text"
                          value={addingName}
                          onChange={(e) => setAddingName(e.target.value)}
                          placeholder="Label, e.g. Key Metrics"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmAdd(); }}
                          className={`flex-1 min-w-0 rounded-lg border ${border.default} px-2.5 py-1.5 text-sm ${text.body} placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-200`}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setAddingHex(null); setAddingName(''); }}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmAdd}
                          disabled={!addingName.trim() || addColor.isPending}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          {addColor.isPending ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={`text-xs ${text.muted} mb-2`}>Add a colour</p>
                      <div className="flex flex-wrap gap-2">
                        {available.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => { setAddingHex(hex); setAddingName(''); }}
                            className="w-7 h-7 rounded-full border-2 border-transparent hover:border-slate-400 transition-all hover:scale-110"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) return modalContent;
  return createPortal(modalContent, document.body);
}
