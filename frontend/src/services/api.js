import axios from 'axios';

let csrfToken = null;
const unsafeMethods = new Set(['post', 'put', 'patch', 'delete']);

export const setCsrfToken = (token) => {
  csrfToken = token || null;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const workspaceId = localStorage.getItem('activeWorkspaceId');
  if (workspaceId) {
    config.headers['X-Workspace-Id'] = workspaceId;
  }

  if (unsafeMethods.has(config.method?.toLowerCase()) && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed';
    const requestError = new Error(message);
    requestError.code = error.response?.data?.code;
    requestError.details = error.response?.data?.errors || error.response?.data?.details || null;
    return Promise.reject(requestError);
  },
);

export default api;
