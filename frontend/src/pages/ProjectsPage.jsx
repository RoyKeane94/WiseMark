import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { projectsAPI, authAPI } from '../lib/api';
import { Loader2, LogOut } from 'lucide-react';

const COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

function formatLastOpened(updatedAt) {
  if (!updatedAt) return '—';
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function ProjectCard({ project, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const docCount = project.document_count ?? 0;
  const annCount = project.annotation_count ?? 0;
  const color = project.color && COLORS.includes(project.color) ? project.color : COLORS[project.id % COLORS.length];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(project.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(project.id)}
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-5 cursor-pointer transition-all duration-200"
      style={{
        boxShadow: hovered ? '0 4px 12px rgba(71,85,105,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        background: hovered ? '#f8fafc' : '#fff',
      }}
    >
      <div
        className="shrink-0 rounded-sm"
        style={{ width: 4, height: 48, background: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-base font-normal text-slate-900 truncate" style={{ fontFamily: "'Instrument Serif', serif" }}>
          {project.name}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[13px] text-slate-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {docCount} {docCount === 1 ? 'doc' : 'docs'}
          </span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            {annCount} {annCount === 1 ? 'annotation' : 'annotations'}
          </span>
        </div>
      </div>
      <div className="text-[13px] text-slate-400 whitespace-nowrap shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {formatLastOpened(project.updated_at)}
      </div>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={hovered ? '#475569' : '#cbd5e1'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 transition-colors"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

function NewProjectModal({ onClose, onCreate, isPending, defaultColorIndex = 0 }) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[defaultColorIndex % COLORS.length]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, selectedColor);
    setName('');
    setSelectedColor(COLORS[defaultColorIndex % COLORS.length]);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-1000 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-8 w-full max-w-[420px] shadow-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 text-xl font-normal text-slate-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
          New project
        </h2>
        <p className="mt-2 mb-6 text-sm text-slate-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Group related deal documents together.
        </p>
        <label className="block text-[13px] font-medium text-slate-600 mb-1.5 uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Project name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Meridian Healthcare CIM"
          autoFocus
          className="w-full px-3.5 py-2.5 text-[15px] border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-slate-600 transition-colors box-border"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        />
        <label className="block text-[13px] font-medium text-slate-600 mt-5 mb-2 uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Colour
        </label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedColor(c)}
              className="w-7 h-7 rounded-full shrink-0 transition-all border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              style={{
                background: c,
                borderColor: selectedColor === c ? '#1e293b' : 'transparent',
                outline: selectedColor === c ? '2px solid #fff' : 'none',
                outlineOffset: -4,
              }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2.5 mt-7" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:bg-slate-300 disabled:cursor-default hover:bg-slate-700"
            style={{ background: name.trim() && !isPending ? '#1e293b' : '#cbd5e1' }}
          >
            {isPending ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await authAPI.me();
      return data;
    },
  });

  const { data: rawProjects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await projectsAPI.list();
      return data;
    },
  });

  const projects = Array.isArray(rawProjects) ? rawProjects : rawProjects?.results ?? [];
  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDocs = projects.reduce((s, p) => s + (p.document_count ?? 0), 0);
  const totalAnnotations = projects.reduce((s, p) => s + (p.annotation_count ?? 0), 0);

  const createProject = useMutation({
    mutationFn: ({ name, color }) => projectsAPI.create({ name: name.trim(), color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowModal(false);
    },
  });

  const handleCreate = (name, color) => {
    createProject.mutate({ name, color });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const userInitial = (user?.email?.[0] || user?.username?.[0] || '?').toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 antialiased" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1e293b' }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Top bar — same as landing nav */}
      <header className="bg-white/92 backdrop-blur-md border-b border-slate-200 py-4 px-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-white text-xs font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            W
          </div>
          <span className="text-[1.05rem] font-semibold text-slate-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
            WiseMark
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/settings')}
            className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-[13px] font-semibold hover:bg-slate-600 transition-colors cursor-pointer"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
            title="Account settings"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[720px] mx-auto px-6 py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-start justify-between mb-2">
          <h1
            className="m-0 text-[28px] text-slate-950"
            style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 700, letterSpacing: '0.01em' }}
          >
            Projects
          </h1>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors hover:bg-slate-700"
            style={{ background: '#1e293b', fontFamily: "'DM Sans', sans-serif" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New project
          </button>
        </div>

        {/* Stats bar — small-caps label style */}
        <div className="flex items-center gap-3 text-xs text-slate-400 mb-6 uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
          <span>{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span>{totalDocs} document{totalDocs !== 1 ? 's' : ''}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span>{totalAnnotations} annotation{totalAnnotations !== 1 ? 's' : ''}</span>
        </div>

        {/* Search */}
        {projects.length > 3 && (
          <div className="relative mb-4">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search projects…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2.5 pl-9 pr-3.5 text-sm border border-slate-200 rounded-lg outline-none text-slate-800 bg-white box-border"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
        )}

        {/* Project list */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading projects…
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(id) => navigate(`/project/${id}`)}
              />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && searchQuery && (
          <div className="text-center py-12 text-slate-500 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No projects match &quot;{searchQuery}&quot;
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <div className="text-center py-16 text-slate-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-4"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <div className="text-base font-medium text-slate-600 mb-1.5">No projects yet</div>
            <div className="text-sm text-slate-500">Create a project to start organising your deal documents.</div>
          </div>
        )}
      </div>

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
          isPending={createProject.isPending}
          defaultColorIndex={projects.length % COLORS.length}
        />
      )}
    </div>
  );
}
