import axios from 'axios';
import { API } from '@/config/api';

/**
 * Get auth headers with JWT token
 */
function getAdminHeaders() {
  const token = localStorage.getItem('heartlink_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Admin API wrapper - automatically attaches JWT auth header
 * Usage: adminApi.get('/admin/stats') — path is relative to API base
 */
const adminApi = {
  get: (path, config = {}) =>
    axios.get(`${API}${path}`, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }),

  post: (path, data = null, config = {}) =>
    axios.post(`${API}${path}`, data, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }),

  put: (path, data = null, config = {}) =>
    axios.put(`${API}${path}`, data, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }),

  delete: (path, config = {}) =>
    axios.delete(`${API}${path}`, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }),
};

export default adminApi;
