import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { presetsAPI } from '../lib/api';
import { Plus, Trash2, Palette, X } from 'lucide-react';

const PALETTE = [
  '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#FB923C',
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
];

const MAX_COLORS = 10;

export default function HighlightPresetsSection() {
  const queryClient = useQueryClient();

  const [createStep, setCreateStep] = useState(0);
  const [newName, setNewName] = useState('');
  const [firstColorHex, setFirstColorHex] = useState(null);
  const [firstColorName, setFirstColorName] = useState('');

  const [addColorPresetId, setAddColorPresetId] = useState(null);
  const [addColorHex, setAddColorHex] = useState(null);
  const [addColorName, setAddColorName] = useState('');

  const [editingColor, setEditingColor] = useState(null);
  const [editingColorName, setEditingColorName] = useState('');

  const { data: presets = [] } = useQuery({
    queryKey: ['presets'],
    queryFn: async () => {
      const { data } = await presetsAPI.list();
      return data;
    },
  });

  const resetCreate = () => {
    setCreateStep(0);
    setNewName('');
    setFirstColorHex(null);
    setFirstColorName('');
  };

  const createPreset = useMutation({
    mutationFn: (data) => presetsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets'] });
      resetCreate();
    },
  });

  const deletePreset = useMutation({
    mutationFn: (id) => presetsAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['presets'] }),
  });

  const addColor = useMutation({
    mutationFn: ({ presetId, data }) => presetsAPI.addColor(presetId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets'] });
      setAddColorPresetId(null);
      setAddColorHex(null);
      setAddColorName('');
    },
  });

  const removeColor = useMutation({
    mutationFn: ({ presetId, colorId }) => presetsAPI.removeColor(presetId, colorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['presets'] }),
  });

  const updateColor = useMutation({
    mutationFn: ({ presetId, colorId, displayName }) =>
      presetsAPI.updateColor(presetId, colorId, { display_name: displayName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets'] });
      setEditingColor(null);
      setEditingColorName('');
    },
  });

  const handleCreate = () => {
    if (!newName.trim() || !firstColorHex || !firstColorName.trim()) return;
    createPreset.mutate({
      name: newName.trim(),
      colors: [{ key: `color_${Date.now()}`, display_name: firstColorName.trim(), hex: firstColorHex }],
    });
  };

  const handleAddConfirm = () => {
    if (!addColorPresetId || !addColorHex || !addColorName.trim()) return;
    addColor.mutate({
      presetId: addColorPresetId,
      data: { key: `custom_${Date.now()}`, display_name: addColorName.trim(), hex: addColorHex },
    });
  };

  return (
    <section className="mt-8 p-6 bg-white border border-slate-200 rounded-xl">
      <h2 className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
        <Palette className="w-4 h-4 text-slate-500" />
        Highlight presets
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Create custom colour presets for documents.
      </p>

      <ul className="space-y-2 mb-4">
        {presets.map((p) => (
          <li
            key={p.id}
            className="py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-100"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-slate-800 truncate">{p.name}</span>
                {p.is_system && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">
                    System
                  </span>
                )}
              </div>
              {!p.is_system && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete preset "${p.name}"?`)) deletePreset.mutate(p.id);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  title="Delete preset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Colour list */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {(p.colors ?? []).map((c) => {
                const isEditing = editingColor?.presetId === p.id && editingColor?.colorId === c.id;
                return (
                  <div key={c.id} className="relative group flex items-center gap-1 bg-white rounded-full border border-slate-200 pl-1 pr-2 py-0.5 min-w-0">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingColorName}
                        onChange={(e) => setEditingColorName(e.target.value)}
                        onBlur={() => {
                          const name = editingColorName.trim();
                          if (name && name !== c.display_name) {
                            updateColor.mutate({
                              presetId: p.id,
                              colorId: c.id,
                              displayName: name,
                            });
                          } else {
                            setEditingColor(null);
                            setEditingColorName('');
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const name = editingColorName.trim();
                            if (name) {
                              updateColor.mutate({
                                presetId: p.id,
                                colorId: c.id,
                                displayName: name,
                              });
                            }
                          }
                          if (e.key === 'Escape') {
                            setEditingColor(null);
                            setEditingColorName('');
                          }
                        }}
                        autoFocus
                        className="text-[11px] text-slate-600 bg-transparent border-0 outline-none focus:ring-0 min-w-[72px] max-w-[140px] py-0"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!p.is_system) {
                            setEditingColor({ presetId: p.id, colorId: c.id });
                            setEditingColorName(c.display_name);
                          }
                        }}
                        className={`text-[11px] text-slate-600 text-left truncate max-w-[120px] ${!p.is_system ? 'cursor-pointer hover:text-slate-800' : 'cursor-default'}`}
                      >
                        {c.display_name}
                      </button>
                    )}
                    {!p.is_system && (p.colors?.length ?? 0) > 1 && !isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeColor.mutate({ presetId: p.id, colorId: c.id });
                        }}
                        className="ml-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <X className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                );
              })}
              {!p.is_system && (p.colors?.length ?? 0) < MAX_COLORS && (
                <button
                  type="button"
                  onClick={() => {
                    setAddColorPresetId(p.id);
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

      <button
        type="button"
        onClick={() => setCreateStep(1)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      >
        <Plus className="w-4 h-4" />
        Create preset
      </button>

      {/* --- Create preset modal --- */}
      {createStep > 0 && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40"
          onClick={() => !createPreset.isPending && resetCreate()}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {createStep === 1 && (
              <>
                <h3 className="text-base font-semibold text-slate-800 mb-3">New preset</h3>
                <label className="block text-xs text-slate-500 mb-1">Preset name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Private Equity"
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
                <h3 className="text-base font-semibold text-slate-800 mb-1">Add your first colour</h3>
                <p className="text-xs text-slate-500 mb-3">Pick a colour, then give it a label.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PALETTE.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setFirstColorHex(hex)}
                      className="w-7 h-7 rounded-full shrink-0 transition-all border-2 focus:outline-none"
                      style={{
                        background: hex,
                        borderColor: firstColorHex === hex ? '#1e293b' : 'transparent',
                        transform: firstColorHex === hex ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                {firstColorHex && (
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-6 h-6 rounded-full shrink-0 border-2 border-slate-200" style={{ backgroundColor: firstColorHex }} />
                    <input
                      type="text"
                      value={firstColorName}
                      onChange={(e) => setFirstColorName(e.target.value)}
                      placeholder="Label, e.g. Key Metrics"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCreateStep(1)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!firstColorHex || !firstColorName.trim() || createPreset.isPending}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {createPreset.isPending ? 'Creating…' : 'Create preset'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- Add colour modal (for existing presets) --- */}
      {addColorPresetId && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40"
          onClick={() => !addColor.isPending && setAddColorPresetId(null)}
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
                    const preset = presets.find((p) => p.id === addColorPresetId);
                    const used = new Set((preset?.colors ?? []).map((c) => c.hex.toLowerCase()));
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
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddConfirm(); }}
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
                  else setAddColorPresetId(null);
                }}
                disabled={addColor.isPending}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {addColorHex ? 'Back' : 'Cancel'}
              </button>
              {addColorHex && (
                <button
                  type="button"
                  onClick={handleAddConfirm}
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
