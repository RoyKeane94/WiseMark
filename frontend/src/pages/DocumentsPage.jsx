import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { documentsAPI } from '../lib/api';
import { getPDF, calculateHash, storePDF } from '../lib/db';
import { pageWrapper, text, bg, btnPrimary, btnIcon, border } from '../lib/theme';
import { Upload, Loader2, FileText, LogOut, Trash2 } from 'lucide-react';

export default function DocumentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const { data: rawDocuments, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await documentsAPI.list();
      return data;
    },
  });
  const documents = Array.isArray(rawDocuments) ? rawDocuments : rawDocuments?.results ?? [];

  const deleteDoc = useMutation({
    mutationFn: (id) => documentsAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) return;
    setUploadError('');
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hash = await calculateHash(arrayBuffer);
      await storePDF(hash, file.name, file.size, arrayBuffer);
      await documentsAPI.create({
        pdf_hash: hash,
        filename: file.name,
        file_size: file.size,
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (err) {
      setUploadError(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={`${pageWrapper} ${bg.page}`}>
      <header className="flex items-center justify-between mb-8">
        <h1 className={`text-xl font-semibold ${text.heading}`}>Documents</h1>
        <div className="flex items-center gap-2">
          <label className={`${btnPrimary} inline-flex items-center gap-2`}>
            <Upload className="w-4 h-4" />
            Upload PDF
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>
          <button type="button" onClick={handleLogout} className={btnIcon} title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {uploadError && (
        <p className="text-sm text-red-600 mb-4">{uploadError}</p>
      )}
      {uploading && (
        <p className="flex items-center gap-2 text-sm text-slate-600 mb-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className={`rounded-xl border ${border.default} p-8 text-center ${text.secondary}`}>
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No documents yet. Upload a PDF to get started.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className={`flex items-center justify-between rounded-lg border ${border.default} ${bg.surface} px-4 py-3 hover:bg-slate-50 cursor-pointer`}
            >
              <button
                type="button"
                className="flex-1 text-left min-w-0"
                onClick={() => navigate(`/document/${doc.id}`)}
              >
                <span className={`font-medium ${text.body} truncate block`}>{doc.filename}</span>
                <span className={`text-xs ${text.muted}`}>
                  {doc.file_size != null && `${(doc.file_size / 1024).toFixed(1)} KB`}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this document?')) deleteDoc.mutate(doc.id);
                }}
                className="p-2 text-slate-400 hover:text-red-600 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
