import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { documentsAPI, projectsAPI } from '../lib/api';
import { calculateHash, storePDF } from '../lib/db';
import { pageWrapper, text, bg, btnPrimary, btnIcon, border } from '../lib/theme';
import { Upload, Loader2, FileText, Trash2, Pencil, ArrowLeft, Check, X } from 'lucide-react';

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

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) return;
    setUploadError('');
    setPendingFile(file);
    const suggestedName = file.name.replace(/\.pdf$/i, '') || file.name;
    setPendingFilename(suggestedName);
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

  if (projectLoading || !project) {
    return (
      <div className={`${pageWrapper} ${bg.page} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className={`${pageWrapper} ${bg.page}`}>
      <header className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`flex items-center gap-2 ${text.secondary} hover:text-slate-900 ${btnIcon}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </header>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {editingProjectName ? (
            <>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xl font-semibold min-w-0 flex-1 max-w-md"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveProjectName();
                  if (e.key === 'Escape') cancelEditProjectName();
                }}
              />
              <button type="button" onClick={saveProjectName} className="p-2 text-green-600 hover:bg-slate-100 rounded" title="Save">
                <Check className="w-5 h-5" />
              </button>
              <button type="button" onClick={cancelEditProjectName} className="p-2 text-slate-500 hover:bg-slate-100 rounded" title="Cancel">
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <h1 className={`text-xl font-semibold ${text.heading}`}>{project.name}</h1>
              <button type="button" onClick={startEditProjectName} className="p-2 text-slate-400 hover:text-slate-600 rounded" title="Edit project name">
                <Pencil className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        <button type="button" onClick={openFilePicker} disabled={uploading} className={`${btnPrimary} inline-flex items-center gap-2`}>
          <Upload className="w-4 h-4" />
          Add PDF
        </button>
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
      </div>

      {/* Modal: Name PDF before upload */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={cancelAddPdf}>
          <div
            className={`rounded-xl ${bg.surface} border ${border.default} shadow-xl w-full max-w-md p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={`text-lg font-semibold ${text.heading} mb-4`}>Name this PDF</h2>
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
                <div className="flex justify-end gap-3 pt-2">
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
                    className={btnPrimary}
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

      {uploadError && <p className="text-sm text-red-600 mb-4">{uploadError}</p>}
      {uploading && (
        <p className="flex items-center gap-2 text-sm text-slate-600 mb-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
        </p>
      )}

      {docsLoading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading PDFs...
        </div>
      ) : documents.length === 0 ? (
        <div className={`rounded-xl border ${border.default} p-8 text-center ${text.secondary}`}>
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No PDFs in this project yet. Add a PDF above.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className={`rounded-lg border ${border.default} ${bg.surface} overflow-hidden`}
            >
              {editingId === doc.id ? (
                <div className="flex items-center gap-2 px-4 py-3">
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
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left py-1"
                    onClick={() => navigate(`/document/${doc.id}`)}
                  >
                    <span className={`font-medium ${text.body} truncate block`}>{doc.filename}</span>
                    <span className={`text-xs ${text.muted}`}>
                      {doc.file_size != null && `${(doc.file_size / 1024).toFixed(1)} KB`}
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startRename(doc)}
                      className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
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
                      className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
