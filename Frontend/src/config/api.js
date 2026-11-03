// src/config/api.js — Normalized API Base URL
let rawApi = import.meta.env.VITE_API_URL || '';

// Remove trailing slash if present
if (rawApi.endsWith('/')) {
  rawApi = rawApi.slice(0, -1);
}

// Auto-prefix https:// if the user provided domain without protocol (e.g. "medicare-backend.up.railway.app")
if (rawApi && !rawApi.startsWith('http://') && !rawApi.startsWith('https://')) {
  rawApi = `https://${rawApi}`;
}

export const API_BASE_URL = rawApi;
export default API_BASE_URL;
