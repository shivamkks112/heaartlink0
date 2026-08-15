import axios from 'axios';
import { API } from '@/config/api';
import { toast } from 'sonner';

/**
 * Get auth headers with JWT token
 */
function getAdminHeaders() {
  const token = localStorage.getItem('heartlink_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Handle 401/403 errors from admin API
 */
function handleAdminError(error) {
  if (error.response?.status === 401) {
    toast.error('Session expired. Please logout and login again to access admin panel.');
  } else if (error.response?.status === 403) {
    toast.error('You don\'t have admin access.');
  }
  throw error;
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
    }).catch(handleAdminError),

  post: (path, data = null, config = {}) =>
    axios.post(`${API}${path}`, data, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }).catch(handleAdminError),

  put: (path, data = null, config = {}) =>
    axios.put(`${API}${path}`, data, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }).catch(handleAdminError),

  delete: (path, config = {}) =>
    axios.delete(`${API}${path}`, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }).catch(handleAdminError),
};

export default adminApi;
