import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { projectsAPI } from '../lib/api';
import { pageWrapper, text, bg, btnPrimary, btnIcon, border } from '../lib/theme';
import { FolderPlus, Loader2, LogOut, FolderOpen } from 'lucide-react';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: rawProjects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await projectsAPI.list();
      return data;
    },
  });
  const projects = Array.isArray(rawProjects) ? rawProjects : rawProjects?.results ?? [];

  const createProject = useMutation({
    mutationFn: (name) => projectsAPI.create({ name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNewName('');
      setAdding(false);
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleAddProject = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createProject.mutate(name);
  };

  return (
    <div className={`${pageWrapper} ${bg.page}`}>
      <header className="flex items-center justify-between mb-8">
        <h1 className={`text-xl font-semibold ${text.heading}`}>Projects</h1>
        <button type="button" onClick={handleLogout} className={btnIcon} title="Sign out">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={`flex items-center gap-2 mb-6 ${btnPrimary}`}
        >
          <FolderPlus className="w-4 h-4" />
          Add a project
        </button>
      ) : (
        <form onSubmit={handleAddProject} className="flex items-center gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900 flex-1 max-w-xs"
            autoFocus
          />
          <button type="submit" disabled={createProject.isPending} className={btnPrimary}>
            {createProject.isPending ? 'Adding...' : 'Add'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className={`rounded-xl border ${border.default} p-8 text-center ${text.secondary}`}>
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No projects yet. Add a project to get started, then add PDFs to it.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => navigate(`/project/${project.id}`)}
                className={`w-full flex items-center justify-between rounded-lg border ${border.default} ${bg.surface} px-4 py-3 hover:bg-slate-50 cursor-pointer text-left`}
              >
                <span className={`font-medium ${text.body}`}>{project.name}</span>
                <FolderOpen className="w-4 h-4 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
