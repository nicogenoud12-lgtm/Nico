import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

api.interceptors.response.use(
  res => res,
  err => {
    console.error('[API]', err?.response?.status, err?.response?.data || err.message);
    return Promise.reject(err);
  }
);
