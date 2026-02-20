import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsAPI } from '../lib/api';
import { HIGHLIGHT_COLOR_KEYS, HIGHLIGHT_COLORS } from '../lib/colors';
import { text, border, bg, btnPrimary } from '../lib/theme';
import { X, Plus } from 'lucide-react';

const INPUT_NAME_PREFIX = 'color_label_';

function sortKeysByOrder(keys, order) {
  if (!order?.length) return keys;
  return [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export default function ColorLabelsModal({ colorLabels = {}, presetColors = [], documentId, onSave, onClose }) {
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const presetKeys = presetColors?.map((c) => c.key) ?? HIGHLIGHT_COLOR_KEYS;
  const [documentColorKeys, setDocumentColorKeys] = useState(() => {
    const keys = Object.keys(colorLabels || {});
    return keys.length > 0 ? keys : (presetKeys.length > 0 ? [...presetKeys] : [...HIGHLIGHT_COLOR_KEYS]);
  });

  useEffect(() => {
    const keys = Object.keys(colorLabels || {});
    const defaultKeys = presetColors?.length ? presetColors.map((c) => c.key) : HIGHLIGHT_COLOR_KEYS;
    setDocumentColorKeys(keys.length > 0 ? keys : [...defaultKeys]);
  }, [documentId, colorLabels]);

  const updateDoc = useMutation({
    mutationFn: (data) => documentsAPI.update(documentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      onSave?.();
    },
    onError: (err) => {
      console.error('Failed to save color labels', err?.response?.data ?? err);
    },
  });

  const handleRemoveColor = (key) => {
    setDocumentColorKeys((prev) => prev.filter((k) => k !== key));
  };

  const handleAddColor = (key) => {
    if (documentColorKeys.includes(key)) return;
    setDocumentColorKeys((prev) => sortKeysByOrder([...prev, key], presetKeys));
  };

  const availableToAdd = presetKeys.filter((k) => !documentColorKeys.includes(k));
  const maxColors = presetColors?.length ?? 5;
  const canAddMore = documentColorKeys.length < maxColors && availableToAdd.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!documentId) return;
    const form = formRef.current;
    if (!form) return;
    const payload = {};
    documentColorKeys.forEach((key) => {
      const input = form.elements.namedItem(INPUT_NAME_PREFIX + key);
      const v = input && 'value' in input ? String(input.value).trim() : '';
      payload[key] = v;
    });
    updateDoc.mutate({ color_labels: payload });
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 ${bg.surface} rounded-xl shadow-xl border ${border.default} w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2 border-b border-slate-200 shrink-0">
          <h3 className={`text-base font-semibold ${text.heading}`}>Colours in this document</h3>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="p-5 space-y-4 overflow-auto flex-1 min-h-0">
          {documentColorKeys.map((key) => {
            const col = HIGHLIGHT_COLORS[key];
            const presetCol = presetColors?.find((c) => c.key === key);
            const defaultName = presetCol?.display_name ?? col?.name ?? key;
            const hex = presetCol?.hex ?? col?.hex ?? col?.solid ?? '#94a3b8';
            const initialValue = (colorLabels && colorLabels[key]) ?? '';
            return (
              <div key={key} className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full shrink-0 border-2 border-slate-200"
                  style={{ backgroundColor: hex }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      id={INPUT_NAME_PREFIX + key}
                      name={INPUT_NAME_PREFIX + key}
                      type="text"
                      defaultValue={initialValue}
                      placeholder={defaultName}
                      className={`w-full rounded-lg border ${border.default} px-3 py-2 text-sm ${text.body} placeholder:${text.muted} outline-none focus:ring-2 focus:ring-slate-300`}
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveColor(key);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveColor(key);
                      }}
                      className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors select-none"
                      title="Remove this colour from the document"
                      aria-label="Remove colour"
                    >
                      <X className="w-4 h-4 pointer-events-none" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {canAddMore && (
            <div className="pt-2 border-t border-slate-200">
              <p className={`text-xs ${text.muted} mb-2`}>Add a colour</p>
              <div className="flex flex-wrap gap-2">
                {availableToAdd.map((key) => {
                  const col = HIGHLIGHT_COLORS[key];
                  const presetCol = presetColors?.find((c) => c.key === key);
                  const hex = presetCol?.hex ?? col?.hex ?? col?.solid ?? '#94a3b8';
                  const label = presetCol?.display_name ?? col?.label ?? key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleAddColor(key)}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className="h-5 w-5 rounded-full border border-slate-200 shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <span>{label}</span>
                      <Plus className="w-4 h-4 text-slate-400" strokeWidth={2} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {documentColorKeys.length === 0 && (
            <p className={`text-sm ${text.muted}`}>No colours in this document. Add one above to use for highlights.</p>
          )}
          {updateDoc.isError && (
            <p className="text-sm text-red-600">
              {updateDoc.error?.response?.data?.detail ?? updateDoc.error?.message ?? 'Failed to save. Try again.'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2 shrink-0">
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

  if (typeof document === 'undefined' || !document.body) return modalContent;
  return createPortal(modalContent, document.body);
}
