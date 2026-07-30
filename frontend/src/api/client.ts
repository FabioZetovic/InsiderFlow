import axios from 'axios';

export const TOKEN_KEY = 'insiderflow_token';
export const USER_KEY = 'insiderflow_user';

// API base URL comes from VITE_API_URL at build time (set in Vercel / .env), falling back to
// the local backend for dev. Must point at the deployed backend's /api for production.
const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');

export const client = axios.create({
  baseURL: `${API_BASE}/api`,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
