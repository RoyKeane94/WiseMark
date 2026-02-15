import axios from 'axios';
import useAuthStore from '../stores/authStore';

const baseURL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: baseURL ? new URL('/api', baseURL).href : '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login/', { email, password }),
  register: (data) => api.post('/auth/register/', data),
  logout: () => api.post('/auth/logout/'),
  me: () => api.get('/auth/me/'),
};

export const projectsAPI = {
  list: () => api.get('/projects/'),
  get: (id) => api.get(`/projects/${id}/`),
  create: (data) => api.post('/projects/', data),
  update: (id, data) => api.patch(`/projects/${id}/`, data),
  delete: (id) => api.delete(`/projects/${id}/`),
};

export const documentsAPI = {
  list: (params) => api.get('/documents/', { params }),
  get: (id) => api.get(`/documents/${id}/`),
  create: (data) => api.post('/documents/', data),
  update: (id, data) => api.patch(`/documents/${id}/`, data),
  delete: (id) => api.delete(`/documents/${id}/`),
  highlights: (id) => api.get(`/documents/${id}/highlights/`),
  createHighlight: (documentId, data) =>
    api.post(`/documents/${documentId}/highlights/`, data),
  updateHighlight: (documentId, highlightId, data) =>
    api.patch(`/documents/${documentId}/highlights/${highlightId}/`, data),
};
