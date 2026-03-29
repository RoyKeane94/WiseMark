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
  requestCode: (email, intent, data = {}) => api.post('/auth/request-code/', { email, intent, ...data }),
  verifyCode: (email, code, data = {}) => api.post('/auth/verify-code/', { email, code, ...data }),
  logout: () => api.post('/auth/logout/'),
  me: () => api.get('/auth/me/'),
  deleteAccount: () => api.post('/auth/me/delete/'),
  reportError: (data) => api.post('/auth/report-error/', data),
  createCheckoutSession: (email) => api.post('/auth/create-checkout-session/', { email }),
  verifyCheckout: (sessionId) => api.post('/auth/verify-checkout/', { session_id: sessionId }),
  createUpgradeCheckoutSession: () => api.post('/auth/billing/create-upgrade-session/'),
  verifyUpgradeSession: (sessionId) => api.post('/auth/billing/verify-upgrade/', { session_id: sessionId }),
  cancelSubscription: () => api.post('/auth/billing/cancel-subscription/'),
};

export const projectsAPI = {
  list: () => api.get('/projects/'),
  get: (id) => api.get(`/projects/${id}/`),
  create: (data) => api.post('/projects/', data),
  update: (id, data) => api.patch(`/projects/${id}/`, data),
  delete: (id) => api.delete(`/projects/${id}/`),
};

export const lensesAPI = {
  list: () => api.get('/lenses/'),
  get: (id) => api.get(`/lenses/${id}/`),
  create: (data) => api.post('/lenses/', data),
  update: (id, data) => api.patch(`/lenses/${id}/`, data),
  delete: (id) => api.delete(`/lenses/${id}/`),
  addColor: (lensId, data) => api.post(`/lenses/${lensId}/colors/`, data),
  updateColor: (lensId, colorId, data) =>
    api.patch(`/lenses/${lensId}/colors/${colorId}/`, data),
  removeColor: (lensId, colorId) =>
    api.delete(`/lenses/${lensId}/colors/${colorId}/`),
};

export const libraryAPI = {
  get: () => api.get('/library/'),
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
  /** Permanently remove a removed PDF and all its highlights/notes. Only for docs with deleted_at set. */
  remove: (id) => api.post(`/documents/${id}/remove/`),
  /** Generate (or return existing) public share link for a document's summary. */
  sharePublic: (id) => api.post(`/documents/${id}/share/`),
  highlights: (id) => api.get(`/documents/${id}/highlights/`),
  createHighlight: (documentId, data) =>
    api.post(`/documents/${documentId}/highlights/`, data),
  updateHighlight: (documentId, highlightId, data) =>
    api.patch(`/documents/${documentId}/highlights/${highlightId}/`, data),
  deleteHighlight: (documentId, highlightId) =>
    api.delete(`/documents/${documentId}/highlights/${highlightId}/`),
};

export const publicDocumentsAPI = {
  getSummary: (token) => api.get(`/public/documents/${token}/summary/`),
  /** Get PDF bytes for a shared document by token. Returns ArrayBuffer. */
  getPdf: (token) =>
    api.get(`/public/documents/${token}/pdf/`, { responseType: 'arraybuffer' }),
};
