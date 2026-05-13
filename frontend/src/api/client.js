import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

// Agregar Bearer token en cada request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('auth_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  res => res,
  err => {
    console.error('[API]', err?.response?.status, err?.response?.data || err.message);
    if (err?.response?.status === 401) {
      // Dispara evento global; AuthContext lo escucha y hace logout
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);
