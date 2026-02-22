import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { documentsAPI, projectsAPI, lensesAPI } from '../lib/api';
import { calculateHash, storePDF } from '../lib/db';
import { Upload, Loader2, FileText, Trash2, Pencil, Check, X, ChevronRight } from 'lucide-react';
import AppHeader from '../components/AppHeader';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelative(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function DocumentCard({ doc, lensMap, projectColor, hovered, onHover, onLeave, onOpen, onRename, onDelete }) {
  const lens = lensMap[doc.highlight_preset] ?? lensMap._default;
  const lensColor = lens?.colors?.[0]?.hex ?? '#94a3b8';
  const accentColor = doc.color && COLORS.includes(doc.color) ? doc.color : projectColor;
  const annCount = doc.annotation_count ?? 0;

  return (
    <div
      onMouseEnter={() => onHover(doc.id)}
      onMouseLeave={onLeave}
      onClick={() => onOpen(doc.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(doc.id)}
      className="flex items-center gap-3.5 rounded-xl bg-white px-4 py-3.5 cursor-pointer transition-shadow duration-200"
      style={{
        borderTop: `1px solid ${hovered ? '#d1d5db' : '#e2e8f0'}`,
        borderRight: `1px solid ${hovered ? '#d1d5db' : '#e2e8f0'}`,
        borderBottom: `1px solid ${hovered ? '#d1d5db' : '#e2e8f0'}`,
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
        background: hovered ? '#fafbfc' : '#fff',
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="text-[14.5px] font-medium text-slate-900 truncate leading-snug"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {doc.filename?.replace(/\.pdf$/i, '')}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {lens && (
            <span
              className="text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{
                color: lensColor,
                background: `${lensColor}14`,
              }}
            >
              {lens.name}
            </span>
          )}
          {formatDate(doc.created_at) && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-[11.5px] text-slate-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {formatDate(doc.created_at)}
              </span>
            </>
          )}
          {doc.last_opened_at && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-[11.5px] text-slate-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Opened {formatRelative(doc.last_opened_at)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {annCount > 0 ? (
          <span className="text-xs font-medium text-slate-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {annCount} note{annCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-xs text-slate-300 italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No annotations
          </span>
        )}
      </div>

      <div
        className="flex items-center gap-0.5 shrink-0 transition-opacity duration-150"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRename(doc); }}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          title="Rename"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <ChevronRight
        className="w-4 h-4 shrink-0 transition-colors"
        style={{ color: hovered ? '#475569' : '#cbd5e1' }}
      />
    </div>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFilename, setPendingFilename] = useState('');
  const [pendingFileData, setPendingFileData] = useState(null);
  const [pendingColor, setPendingColor] = useState(COLORS[0]);
  const uploadPayloadRef = useRef(null);
  const pendingNameInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [sort, setSort] = useState('recent');
  const [dragOver, setDragOver] = useState(false);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => (await projectsAPI.get(projectId)).data,
    enabled: !!projectId,
  });

  const { data: rawDocuments, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: async () => (await documentsAPI.list({ project: projectId })).data,
    enabled: !!projectId,
  });
  const documents = Array.isArray(rawDocuments) ? rawDocuments : rawDocuments?.results ?? [];

  const { data: lenses = [] } = useQuery({
    queryKey: ['lenses'],
    queryFn: async () => (await lensesAPI.list()).data,
  });

  const lensMap = useMemo(() => {
    const map = {};
    lenses.forEach((l) => { map[l.id] = l; });
    const defaultLens = lenses.find((l) => l.is_system) ?? lenses[0];
    if (defaultLens) map._default = defaultLens;
    return map;
  }, [lenses]);

  const sorted = useMemo(() => {
    const list = [...documents];
    if (sort === 'recent') {
      list.sort((a, b) => {
        const aDate = a.last_opened_at || a.updated_at || a.created_at || '';
        const bDate = b.last_opened_at || b.updated_at || b.created_at || '';
        return bDate.localeCompare(aDate);
      });
    } else if (sort === 'uploaded') {
      list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } else if (sort === 'name') {
      list.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
    } else if (sort === 'annotations') {
      list.sort((a, b) => (b.annotation_count ?? 0) - (a.annotation_count ?? 0));
    }
    return list;
  }, [documents, sort]);

  const totalAnnotations = documents.reduce((s, d) => s + (d.annotation_count ?? 0), 0);

  const updateProject = useMutation({
    mutationFn: ({ id, name }) => projectsAPI.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingProjectName(false);
    },
  });

  const updateDoc = useMutation({
    mutationFn: ({ id, filename }) => documentsAPI.update(id, { filename }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      setEditingId(null);
      setEditName('');
    },
  });

  const deleteDoc = useMutation({
    mutationFn: (id) => documentsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      setPendingDeleteDoc(null);
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id) => projectsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/app', { replace: true });
    },
  });

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) return;
    setUploadError('');
    setPendingFile(file);
    const suggestedName = file.name.replace(/\.pdf$/i, '') || file.name;
    setPendingFilename(suggestedName);
    setPendingColor(COLORS[documents.length % COLORS.length]);
    setPendingFileData(null);
    uploadPayloadRef.current = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hash = await calculateHash(arrayBuffer);
      const data = { arrayBuffer, hash, size: file.size };
      setPendingFileData(data);
      uploadPayloadRef.current = { ...data, suggestedName };
    } catch (err) {
      setUploadError(err.message || 'Could not read file');
      setPendingFile(null);
      setPendingFilename('');
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.includes('pdf')) return;
    setUploadError('');
    setPendingFile(file);
    const suggestedName = file.name.replace(/\.pdf$/i, '') || file.name;
    setPendingFilename(suggestedName);
    setPendingColor(COLORS[documents.length % COLORS.length]);
    setPendingFileData(null);
    uploadPayloadRef.current = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hash = await calculateHash(arrayBuffer);
      const data = { arrayBuffer, hash, size: file.size };
      setPendingFileData(data);
      uploadPayloadRef.current = { ...data, suggestedName };
    } catch (err) {
      setUploadError(err.message || 'Could not read file');
      setPendingFile(null);
      setPendingFilename('');
    }
  };

  const cancelAddPdf = () => {
    setPendingFile(null);
    setPendingFilename('');
    setPendingFileData(null);
    setPendingColor(COLORS[0]);
    setUploadError('');
    uploadPayloadRef.current = null;
    setFileInputKey((k) => k + 1);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleUploadAndSave = async (e) => {
    e.preventDefault();
    const pid = projectId;
    const nameFromInput = pendingNameInputRef.current?.value?.trim();
    const name = nameFromInput || pendingFilename?.trim() || uploadPayloadRef.current?.suggestedName?.trim() || '';
    const data = uploadPayloadRef.current || pendingFileData;
    if (!pid) { setUploadError('Project not found.'); return; }
    if (!name) { setUploadError('Please enter a name for the PDF.'); return; }
    if (!data || !data.hash || !data.arrayBuffer) { setUploadError('File data missing. Please close and select the file again.'); return; }
    const filename = name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
    setUploadError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('project', String(pid));
      formData.append('filename', filename);
      formData.append('color', pendingColor);
      formData.append('file', new Blob([data.arrayBuffer]), filename);
      await documentsAPI.createWithFile(formData);
      await storePDF(data.hash, filename, data.size, data.arrayBuffer);
      queryClient.invalidateQueries({ queryKey: ['documents', pid] });
      setPendingFile(null);
      setPendingFilename('');
      setPendingFileData(null);
      uploadPayloadRef.current = null;
      setFileInputKey((k) => k + 1);
    } catch (err) {
      const msg = err.response?.data?.detail
        || (typeof err.response?.data === 'object' && Object.values(err.response?.data || {}).flat().join(' '))
        || err.message || 'Upload failed';
      setUploadError(String(msg));
    } finally {
      setUploading(false);
    }
  };

  const startRename = (doc) => { setEditingId(doc.id); setEditName(doc.filename || ''); };
  const saveRename = () => {
    if (editingId == null || !editName.trim()) { setEditingId(null); return; }
    updateDoc.mutate({ id: editingId, filename: editName.trim() });
  };
  const cancelRename = () => { setEditingId(null); setEditName(''); };

  const startEditProjectName = () => { setProjectName(project?.name ?? ''); setEditingProjectName(true); };
  const saveProjectName = () => {
    const name = projectName.trim();
    if (!name || name === project?.name) { setEditingProjectName(false); return; }
    updateProject.mutate({ id: projectId, name });
  };
  const cancelEditProjectName = () => { setEditingProjectName(false); setProjectName(''); };

  const projectColor = project?.color && COLORS.includes(project.color) ? project.color : project ? COLORS[project.id % COLORS.length] : COLORS[0];

  if (projectLoading || !project) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 antialiased" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1e293b' }}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <AppHeader showBack backTo="/app" />

      <div className="max-w-[720px] mx-auto px-6 py-10">
        {/* Project header */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {editingProjectName ? (
              <>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900 min-w-0 flex-1 max-w-md text-[28px]"
                  style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, letterSpacing: '-0.01em' }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveProjectName();
                    if (e.key === 'Escape') cancelEditProjectName();
                  }}
                />
                <button type="button" onClick={saveProjectName} className="p-2 text-green-600 hover:bg-slate-100 rounded-lg shrink-0" title="Save"><Check className="w-5 h-5" /></button>
                <button type="button" onClick={cancelEditProjectName} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0" title="Cancel"><X className="w-5 h-5" /></button>
              </>
            ) : (
              <h1 className="m-0 text-[26px] text-slate-900 truncate" style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                {project.name}
              </h1>
            )}
          </div>
          {!editingProjectName && (
            <div className="flex items-center gap-1.5 shrink-0 mt-1">
              <button type="button" onClick={startEditProjectName} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50" title="Edit project name">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setPendingDeleteProject(true)} disabled={deleteProject.isPending} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50" title="Delete project">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Stats — light grey sans, match Projects page */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span>{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
          <span className="text-slate-300">·</span>
          <span>{totalAnnotations} annotation{totalAnnotations !== 1 ? 's' : ''}</span>
        </div>

        {/* Sort + Add PDF row */}
        <div className="flex items-center justify-between mb-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 cursor-pointer outline-none"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <option value="recent">Recently opened</option>
            <option value="uploaded">Date uploaded</option>
            <option value="name">Name A–Z</option>
            <option value="annotations">Most annotated</option>
          </select>
          <button
            type="button"
            onClick={openFilePicker}
            disabled={uploading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors hover:bg-slate-700 disabled:opacity-70"
            style={{ background: '#1e293b' }}
          >
            <Upload className="w-4 h-4" />
            Add PDF
          </button>
        </div>

        <input key={fileInputKey} ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChosen} className="hidden" aria-hidden="true" tabIndex={-1} />

        {uploadError && <p className="text-sm text-red-600 mb-4">{uploadError}</p>}
        {uploading && (
          <p className="flex items-center gap-2 text-sm text-slate-600 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
          </p>
        )}

        {/* Document list */}
        {docsLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading PDFs…
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p>No PDFs in this project yet. Add a PDF above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorted.map((doc) =>
              editingId === doc.id ? (
                <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                  />
                  <button type="button" onClick={saveRename} className="p-2.5 text-green-600 hover:bg-slate-100 rounded-lg shrink-0" title="Save"><Check className="w-4 h-4" /></button>
                  <button type="button" onClick={cancelRename} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0" title="Cancel"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  lensMap={lensMap}
                  projectColor={projectColor}
                  hovered={hoveredId === doc.id}
                  onHover={setHoveredId}
                  onLeave={() => setHoveredId(null)}
                  onOpen={(id) => navigate(`/document/${id}`)}
                  onRename={startRename}
                  onDelete={(d) => setPendingDeleteDoc(d)}
                />
              )
            )}
          </div>
        )}

        {/* Drop zone */}
        {documents.length > 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={openFilePicker}
            className="mt-2 rounded-xl py-7 flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragOver ? '#2563eb' : '#e2e8f0'}`,
              background: dragOver ? '#eff6ff' : 'transparent',
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: dragOver ? '#dbeafe' : '#f1f5f9' }}
            >
              <Upload className="w-4 h-4 text-slate-400" />
            </div>
            <span
              className="text-[13px] font-medium transition-colors"
              style={{ color: dragOver ? '#2563eb' : '#94a3b8' }}
            >
              Drop a PDF here or click to upload
            </span>
          </div>
        )}
      </div>

      {/* Modal: Name PDF before upload */}
      {pendingFile && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm cursor-pointer" onClick={cancelAddPdf}>
          <div className="rounded-xl bg-white border border-slate-200 shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="m-0 text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>Name this PDF</h2>
            {!pendingFileData ? (
              <div className="flex items-center gap-2 text-slate-600 py-4">
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                <span>Reading file…</span>
              </div>
            ) : (
              <div className="space-y-4">
                {uploadError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadError}</p>}
                <input
                  ref={pendingNameInputRef}
                  type="text"
                  value={pendingFilename}
                  onChange={(e) => setPendingFilename(e.target.value)}
                  placeholder="Document name"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900"
                  autoFocus
                  disabled={uploading}
                />
                <label className="block text-[13px] font-medium text-slate-600 mb-2 uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Colour</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPendingColor(c)}
                      disabled={uploading}
                      className="w-7 h-7 rounded-full shrink-0 transition-all border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-60"
                      style={{
                        background: c,
                        borderColor: pendingColor === c ? '#1e293b' : 'transparent',
                        outline: pendingColor === c ? '2px solid #fff' : 'none',
                        outlineOffset: -4,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={cancelAddPdf} disabled={uploading} className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button
                    type="button"
                    onClick={handleUploadAndSave}
                    disabled={uploading || !pendingFilename.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-white hover:bg-slate-700"
                    style={{ background: '#1e293b' }}
                  >
                    {uploading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span> : 'Upload & save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete document modal */}
      {pendingDeleteDoc && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 cursor-pointer" onClick={() => !deleteDoc.isPending && setPendingDeleteDoc(null)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>Delete document?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete <strong>{pendingDeleteDoc.filename?.replace(/\.pdf$/i, '')}</strong> and all its annotations.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDeleteDoc(null)} disabled={deleteDoc.isPending} className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => deleteDoc.mutate(pendingDeleteDoc.id)} disabled={deleteDoc.isPending} className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-70">
                {deleteDoc.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete project modal */}
      {pendingDeleteProject && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 cursor-pointer" onClick={() => !deleteProject.isPending && setPendingDeleteProject(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>Delete project?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete <strong>{project.name}</strong> and all its documents. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDeleteProject(false)} disabled={deleteProject.isPending} className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => deleteProject.mutate(projectId)} disabled={deleteProject.isPending} className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-70">
                {deleteProject.isPending ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
