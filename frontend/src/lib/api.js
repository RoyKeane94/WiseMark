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
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
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
  deleteAccount: () => api.post('/auth/me/delete/'),
};

export const projectsAPI = {
  list: () => api.get('/projects/'),
  get: (id) => api.get(`/projects/${id}/`),
  create: (data) => api.post('/projects/', data),
  update: (id, data) => api.patch(`/projects/${id}/`, data),
  delete: (id) => api.delete(`/projects/${id}/`),
};

export const presetsAPI = {
  list: () => api.get('/presets/'),
  get: (id) => api.get(`/presets/${id}/`),
  create: (data) => api.post('/presets/', data),
  update: (id, data) => api.patch(`/presets/${id}/`, data),
  delete: (id) => api.delete(`/presets/${id}/`),
  addColor: (presetId, data) => api.post(`/presets/${presetId}/colors/`, data),
  updateColor: (presetId, colorId, data) =>
    api.patch(`/presets/${presetId}/colors/${colorId}/`, data),
  removeColor: (presetId, colorId) =>
    api.delete(`/presets/${presetId}/colors/${colorId}/`),
};

export const documentsAPI = {
  list: (params) => api.get('/documents/', { params }),
  get: (id) => api.get(`/documents/${id}/`),
  create: (data) => api.post('/documents/', data),
  /** Create document with PDF file (multipart). Use this so the server stores the PDF in Postgres. */
  createWithFile: (formData) => api.post('/documents/', formData),
  /** Get PDF bytes for a document (server-stored PDF). Returns ArrayBuffer. */
  getPdf: (id) =>
    api.get(`/documents/${id}/pdf/`, { responseType: 'arraybuffer' }),
  /** Upload PDF for a document that has none (e.g. opened on another device). File must match doc.pdf_hash. */
  uploadPdf: (id, formData) =>
    api.post(`/documents/${id}/upload_pdf/`, formData),
  update: (id, data) => api.patch(`/documents/${id}/`, data),
  delete: (id) => api.delete(`/documents/${id}/`),
  highlights: (id) => api.get(`/documents/${id}/highlights/`),
  createHighlight: (documentId, data) =>
    api.post(`/documents/${documentId}/highlights/`, data),
  updateHighlight: (documentId, highlightId, data) =>
    api.patch(`/documents/${documentId}/highlights/${highlightId}/`, data),
  deleteHighlight: (documentId, highlightId) =>
    api.delete(`/documents/${documentId}/highlights/${highlightId}/`),
};
