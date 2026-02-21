import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lensesAPI } from '../lib/api';
import { Plus, Trash2, Palette, X } from 'lucide-react';

const PALETTE = [
  '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#FB923C',
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
];

const MAX_COLORS = 5;
const MAX_CUSTOM_LENSES = 3;

export default function HighlightLensesSection() {
  const queryClient = useQueryClient();

  const [createStep, setCreateStep] = useState(0);
  const [newName, setNewName] = useState('');
  const [newColors, setNewColors] = useState([]);
  const [pickingHex, setPickingHex] = useState(null);
  const [pickingName, setPickingName] = useState('');

  const [addColorLensId, setAddColorLensId] = useState(null);
  const [addColorHex, setAddColorHex] = useState(null);
  const [addColorName, setAddColorName] = useState('');

  const [editingColor, setEditingColor] = useState(null);
  const [editingColorName, setEditingColorName] = useState('');

  const { data: lenses = [] } = useQuery({
    queryKey: ['lenses'],
    queryFn: async () => {
      const { data } = await lensesAPI.list();
      return data;
    },
  });

  const customLenses = lenses.filter((l) => !l.is_system);

  const resetCreate = () => {
    setCreateStep(0);
    setNewName('');
    setNewColors([]);
    setPickingHex(null);
    setPickingName('');
  };

  const createLens = useMutation({
    mutationFn: (data) => lensesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lenses'] });
      resetCreate();
    },
  });

  const deleteLens = useMutation({
    mutationFn: (id) => lensesAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lenses'] }),
  });

  const addColor = useMutation({
    mutationFn: ({ lensId, data }) => lensesAPI.addColor(lensId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lenses'] });
      setAddColorLensId(null);
      setAddColorHex(null);
      setAddColorName('');
    },
  });

  const removeColor = useMutation({
    mutationFn: ({ lensId, colorId }) => lensesAPI.removeColor(lensId, colorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lenses'] }),
  });

  const updateColor = useMutation({
    mutationFn: ({ lensId, colorId, displayName }) =>
      lensesAPI.updateColor(lensId, colorId, { display_name: displayName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lenses'] });
      setEditingColor(null);
      setEditingColorName('');
    },
  });

  const handleAddColorConfirm = () => {
    if (!addColorLensId || !addColorHex || !addColorName.trim()) return;
    addColor.mutate({
      lensId: addColorLensId,
      data: { key: `custom_${Date.now()}`, display_name: addColorName.trim(), hex: addColorHex },
    });
  };

  const usedHexesInNew = new Set(newColors.map((c) => c.hex.toLowerCase()));
  const availableForNew = PALETTE.filter((h) => !usedHexesInNew.has(h.toLowerCase()));

  const handleAddColorToNew = () => {
    if (!pickingHex || !pickingName.trim()) return;
    setNewColors((prev) => [
      ...prev,
      { key: `color_${Date.now()}_${prev.length}`, display_name: pickingName.trim(), hex: pickingHex },
    ]);
    setPickingHex(null);
    setPickingName('');
  };

  const handleRemoveNewColor = (idx) => {
    setNewColors((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    if (!newName.trim() || newColors.length < 1) return;
    createLens.mutate({ name: newName.trim(), colors: newColors });
  };

  return (
    <section className="p-6 bg-white border border-slate-200 rounded-xl">
      <h2 className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
        <Palette className="w-4 h-4 text-slate-500" />
        Highlight lenses
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Each lens has {MAX_COLORS} colour categories. You can create up to {MAX_CUSTOM_LENSES} custom lenses.
      </p>

      <ul className="space-y-2 mb-4">
        {lenses.map((l) => (
          <li key={l.id} className="py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-slate-800 truncate">{l.name}</span>
                {l.is_system && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">
                    Default
                  </span>
                )}
              </div>
              {!l.is_system && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete lens "${l.name}"?`)) deleteLens.mutate(l.id);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  title="Delete lens"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {(l.colors ?? []).map((c) => {
                const isEditing = editingColor?.lensId === l.id && editingColor?.colorId === c.id;
                return (
                  <div key={c.id} className="relative group flex items-center gap-1 bg-white rounded-full border border-slate-200 pl-1 pr-2 py-0.5 min-w-0">
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingColorName}
                        onChange={(e) => setEditingColorName(e.target.value)}
                        onBlur={() => {
                          const name = editingColorName.trim();
                          if (name && name !== c.display_name) {
                            updateColor.mutate({ lensId: l.id, colorId: c.id, displayName: name });
                          } else {
                            setEditingColor(null);
                            setEditingColorName('');
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const name = editingColorName.trim();
                            if (name) updateColor.mutate({ lensId: l.id, colorId: c.id, displayName: name });
                          }
                          if (e.key === 'Escape') { setEditingColor(null); setEditingColorName(''); }
                        }}
                        autoFocus
                        className="text-[11px] text-slate-600 bg-transparent border-0 outline-none focus:ring-0 min-w-[72px] max-w-[140px] py-0"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!l.is_system) {
                            setEditingColor({ lensId: l.id, colorId: c.id });
                            setEditingColorName(c.display_name);
                          }
                        }}
                        className={`text-[11px] text-slate-600 text-left truncate max-w-[120px] ${!l.is_system ? 'cursor-pointer hover:text-slate-800' : 'cursor-default'}`}
                      >
                        {c.display_name}
                      </button>
                    )}
                    {!l.is_system && (l.colors?.length ?? 0) > 1 && !isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeColor.mutate({ lensId: l.id, colorId: c.id });
                        }}
                        className="ml-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <X className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                );
              })}
              {!l.is_system && (l.colors?.length ?? 0) > 1 && (
                <p className="text-[10px] text-slate-400 italic mt-1">
                  Removing a colour will delete any highlights and comments using it.
                </p>
              )}
              {!l.is_system && (l.colors?.length ?? 0) < MAX_COLORS && (
                <button
                  type="button"
                  onClick={() => {
                    setAddColorLensId(l.id);
                    setAddColorHex(null);
                    setAddColorName('');
                  }}
                  className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors"
                  title="Add colour"
                >
                  <Plus className="w-3 h-3" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {customLenses.length < MAX_CUSTOM_LENSES && (
        <button
          type="button"
          onClick={() => setCreateStep(1)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          <Plus className="w-4 h-4" />
          Create lens
        </button>
      )}

      {createStep > 0 && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 cursor-pointer"
          onClick={() => !createLens.isPending && resetCreate()}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {createStep === 1 && (
              <>
                <h3 className="text-base font-semibold text-slate-800 mb-3">New lens</h3>
                <label className="block text-xs text-slate-500 mb-1">Lens name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Credit Analysis"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) setCreateStep(2); }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300 mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={resetCreate} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateStep(2)}
                    disabled={!newName.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}

            {createStep === 2 && (
              <>
                <h3 className="text-base font-semibold text-slate-800 mb-1">
                  Add colours ({newColors.length}/{MAX_COLORS})
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Pick up to {MAX_COLORS} colours and give each a label.
                </p>

                {newColors.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {newColors.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                        <span className="text-sm text-slate-700 flex-1 truncate">{c.display_name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewColor(i)}
                          className="text-slate-400 hover:text-red-500 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {newColors.length < MAX_COLORS && (
                  <>
                    {pickingHex ? (
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-6 h-6 rounded-full shrink-0 border-2 border-slate-200" style={{ backgroundColor: pickingHex }} />
                        <input
                          type="text"
                          value={pickingName}
                          onChange={(e) => setPickingName(e.target.value)}
                          placeholder="Label, e.g. Key Metrics"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddColorToNew(); }}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                        />
                        <button type="button" onClick={handleAddColorToNew} disabled={!pickingName.trim()} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50">
                          Add
                        </button>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <p className="text-xs text-slate-500 mb-2">Pick colour {newColors.length + 1} of {MAX_COLORS}</p>
                        <div className="flex flex-wrap gap-2">
                          {availableForNew.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => { setPickingHex(hex); setPickingName(''); }}
                              className="w-7 h-7 rounded-full shrink-0 transition-all border-2 border-transparent hover:border-slate-400 hover:scale-110"
                              style={{ background: hex }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setCreateStep(1); setNewColors([]); setPickingHex(null); setPickingName(''); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={newColors.length < 1 || createLens.isPending}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {createLens.isPending ? 'Creating…' : 'Create lens'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {addColorLensId && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 cursor-pointer"
          onClick={() => !addColor.isPending && setAddColorLensId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-800 mb-3">Add colour</h3>

            {!addColorHex ? (
              <>
                <p className="text-xs text-slate-500 mb-2">Pick a colour</p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const lens = lenses.find((l) => l.id === addColorLensId);
                    const used = new Set((lens?.colors ?? []).map((c) => c.hex.toLowerCase()));
                    return PALETTE.filter((h) => !used.has(h.toLowerCase()));
                  })().map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setAddColorHex(hex)}
                      className="w-7 h-7 rounded-full border-2 border-transparent hover:border-slate-400 transition-all hover:scale-110"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full shrink-0 border-2 border-slate-300"
                    style={{ backgroundColor: addColorHex }}
                  />
                  <input
                    type="text"
                    value={addColorName}
                    onChange={(e) => setAddColorName(e.target.value)}
                    placeholder="Label, e.g. Investment Risks"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddColorConfirm(); }}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  if (addColorHex) { setAddColorHex(null); setAddColorName(''); }
                  else setAddColorLensId(null);
                }}
                disabled={addColor.isPending}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {addColorHex ? 'Back' : 'Cancel'}
              </button>
              {addColorHex && (
                <button
                  type="button"
                  onClick={handleAddColorConfirm}
                  disabled={!addColorName.trim() || addColor.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {addColor.isPending ? 'Adding…' : 'Add'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
