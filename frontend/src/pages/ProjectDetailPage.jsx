import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { documentsAPI, projectsAPI, authAPI } from '../lib/api';
import { calculateHash, storePDF } from '../lib/db';
import { Upload, Loader2, FileText, Trash2, Pencil, ArrowLeft, Check, X, LogOut } from 'lucide-react';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function formatUploadDate(createdAt) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await projectsAPI.get(projectId);
      return data;
    },
    enabled: !!projectId,
  });

  const { data: rawDocuments, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: async () => {
      const { data } = await documentsAPI.list({ project: projectId });
      return data;
    },
    enabled: !!projectId,
  });
  const documents = Array.isArray(rawDocuments) ? rawDocuments : rawDocuments?.results ?? [];

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', projectId] }),
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

  const cancelAddPdf = () => {
    setPendingFile(null);
    setPendingFilename('');
    setPendingFileData(null);
    setPendingColor(COLORS[0]);
    setUploadError('');
    uploadPayloadRef.current = null;
    setFileInputKey((k) => k + 1);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleUploadAndSave = async (e) => {
    e.preventDefault();
    const pid = projectId;
    const nameFromInput = pendingNameInputRef.current?.value?.trim();
    const name = nameFromInput || pendingFilename?.trim() || uploadPayloadRef.current?.suggestedName?.trim() || '';
    const data = uploadPayloadRef.current || pendingFileData;
    if (!pid) {
      setUploadError('Project not found.');
      return;
    }
    if (!name) {
      setUploadError('Please enter a name for the PDF.');
      return;
    }
    if (!data || !data.hash || !data.arrayBuffer) {
      setUploadError('File data missing. Please close and select the file again.');
      return;
    }
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
      // Cache in IndexedDB so viewer can use it without re-fetching
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
        || err.message
        || 'Upload failed';
      setUploadError(String(msg));
    } finally {
      setUploading(false);
    }
  };

  const startRename = (doc) => {
    setEditingId(doc.id);
    setEditName(doc.filename || '');
  };

  const saveRename = () => {
    if (editingId == null || !editName.trim()) {
      setEditingId(null);
      return;
    }
    updateDoc.mutate({ id: editingId, filename: editName.trim() });
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const startEditProjectName = () => {
    setProjectName(project?.name ?? '');
    setEditingProjectName(true);
  };

  const saveProjectName = () => {
    const name = projectName.trim();
    if (!name || name === project?.name) {
      setEditingProjectName(false);
      return;
    }
    updateProject.mutate({ id: projectId, name });
  };

  const cancelEditProjectName = () => {
    setEditingProjectName(false);
    setProjectName('');
  };

  const logout = useAuthStore((s) => s.logout);
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await authAPI.me();
      return data;
    },
  });
  const userInitial = (user?.email?.[0] || user?.username?.[0] || '?').toUpperCase();
  const projectColor = project?.color && COLORS.includes(project.color)
    ? project.color
    : project ? COLORS[project.id % COLORS.length] : COLORS[0];

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
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <header className="bg-white/92 backdrop-blur-md border-b border-slate-200 py-4 px-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            title="Back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-white text-xs font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            W
          </div>
          <span className="text-[1.05rem] font-semibold text-slate-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
            WiseMark
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => navigate('/app/settings')} className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-[13px] font-semibold hover:bg-slate-600 transition-colors cursor-pointer" title="Account settings">
            {userInitial}
          </button>
        </div>
      </header>

      <div className="max-w-[720px] mx-auto px-6 py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {editingProjectName ? (
              <>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900 min-w-0 flex-1 max-w-md text-[28px]"
                  style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 700, letterSpacing: '0.01em' }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveProjectName();
                    if (e.key === 'Escape') cancelEditProjectName();
                  }}
                />
                <button type="button" onClick={saveProjectName} className="p-2 text-green-600 hover:bg-slate-100 rounded-lg shrink-0" title="Save">
                  <Check className="w-5 h-5" />
                </button>
                <button type="button" onClick={cancelEditProjectName} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0" title="Cancel">
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <h1 className="m-0 text-[28px] text-slate-950 truncate" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 700, letterSpacing: '0.01em' }}>
                  {project.name}
                </h1>
                <button type="button" onClick={startEditProjectName} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg shrink-0" title="Edit project name">
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete project "${project.name}" and all its documents? This cannot be undone.`)) {
                      deleteProject.mutate(projectId);
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                  title="Delete project"
                  disabled={deleteProject.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={openFilePicker}
            disabled={uploading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors hover:bg-slate-700 shrink-0 disabled:opacity-70"
            style={{ background: '#1e293b', fontFamily: "'DM Sans', sans-serif" }}
          >
            <Upload className="w-4 h-4" />
            Add PDF
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 mb-6 uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
          <span>{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
        </div>
        <input
          key={fileInputKey}
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChosen}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />

        {uploadError && <p className="text-sm text-red-600 mb-4">{uploadError}</p>}
        {uploading && (
          <p className="flex items-center gap-2 text-sm text-slate-600 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
          </p>
        )}

        {docsLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Loader2 className="w-5 h-5 animate-spin" /> Loading PDFs…
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-8 text-center text-slate-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p>No PDFs in this project yet. Add a PDF above.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-[0_4px_12px_rgba(71,85,105,0.08)] hover:-translate-y-px cursor-pointer"
              >
                {editingId === doc.id ? (
                  <div className="flex items-center gap-2 px-5 py-3">
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
                    <button type="button" onClick={saveRename} className="p-2.5 text-green-600 hover:bg-slate-100 rounded-lg shrink-0" title="Save">
                      <Check className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={cancelRename} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0" title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-3 cursor-pointer" onClick={() => navigate(`/document/${doc.id}`)}>
                    <div className="shrink-0 rounded-sm" style={{ width: 4, height: 40, background: (doc.color && COLORS.includes(doc.color) ? doc.color : projectColor) }} />
                    <div className="flex-1 min-w-0 py-1 flex flex-col items-start gap-0.5">
                      <span className="text-base font-normal text-slate-900 truncate block w-full" style={{ fontFamily: "'Instrument Serif', serif" }}>
                        {doc.filename}
                      </span>
                      <span className="text-xs text-slate-400 block" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {doc.file_size != null && `${(doc.file_size / 1024).toFixed(1)} KB`}
                        {doc.file_size != null && formatUploadDate(doc.created_at) && ' · '}
                        {formatUploadDate(doc.created_at) ? `Uploaded ${formatUploadDate(doc.created_at)}` : null}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startRename(doc); }}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg shrink-0"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this PDF?')) deleteDoc.mutate(doc.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal: Name PDF before upload */}
      {pendingFile && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm" onClick={cancelAddPdf}>
          <div
            className="rounded-xl bg-white border border-slate-200 shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 text-xl font-normal text-slate-900 mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Name this PDF
            </h2>
            {!pendingFileData ? (
              <div className="flex items-center gap-2 text-slate-600 py-4">
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                <span>Reading file...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {uploadError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadError}</p>
                )}
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
                <label className="block text-[13px] font-medium text-slate-600 mb-2 uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Colour
                </label>
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
                <div className="flex justify-end gap-3 pt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <button
                    type="button"
                    onClick={cancelAddPdf}
                    disabled={uploading}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleUploadAndSave(e);
                    }}
                    disabled={uploading || !pendingFilename.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-white hover:bg-slate-700"
                    style={{ background: '#1e293b' }}
                  >
                    {uploading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Upload & save'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
