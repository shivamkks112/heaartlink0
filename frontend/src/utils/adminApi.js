import axios from 'axios';
import { API } from '@/config/api';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

/**
 * Get auth token and user id for admin API calls
 */
function getAuthInfo() {
  const token = localStorage.getItem('heartlink_token') || '';
  let userId = '';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    userId = user.id || '';
  } catch (e) { /* ignore */ }
  return { token, userId };
}

/**
 * Build admin headers — sends both JWT token AND user ID for max compatibility
 */
function getAdminHeaders() {
  const { token, userId } = getAuthInfo();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['X-Admin-Id'] = userId;
  return headers;
}

/**
 * Add admin_uid query param as last-resort fallback
 */
function addAdminUid(config) {
  const { userId } = getAuthInfo();
  if (userId) {
    config.params = { ...config.params, admin_uid: userId };
  }
  return config;
}

function handleError(error) {
  if (error.response?.status === 401) {
    toast.error('Session expired. Please logout and login again.');
  } else if (error.response?.status === 403) {
    toast.error("You don't have admin access.");
  }
  throw error;
}

/**
 * Admin API wrapper — sends JWT token + X-Admin-Id header + admin_uid query param
 * Triple fallback ensures it works on Web, Android CapacitorHttp, and any edge case
 */
const adminApi = {
  get: (path, config = {}) => {
    config = addAdminUid(config);
    return axios.get(`${API}${path}`, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }).catch(handleError);
  },

  post: (path, data = null, config = {}) => {
    config = addAdminUid(config);
    return axios.post(`${API}${path}`, data, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }).catch(handleError);
  },

  put: (path, data = null, config = {}) => {
    config = addAdminUid(config);
    return axios.put(`${API}${path}`, data, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }).catch(handleError);
  },

  delete: (path, config = {}) => {
    config = addAdminUid(config);
    return axios.delete(`${API}${path}`, {
      ...config,
      headers: { ...getAdminHeaders(), ...config.headers },
    }).catch(handleError);
  },
};

export default adminApi;
