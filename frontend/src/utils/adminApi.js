import axios from 'axios';
import { API } from '@/config/api';
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';
import { toast } from 'sonner';

/**
 * Get auth token
 */
function getToken() {
  return localStorage.getItem('heartlink_token') || '';
}

/**
 * Native HTTP call for Capacitor (bypasses XMLHttpRequest patching issues)
 */
async function nativeRequest(method, path, data = null, params = null) {
  const token = getToken();
  const url = new URL(`${API}${path}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const options = {
    url: url.toString(),
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  };

  if (data && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
    options.data = data;
  }

  try {
    const response = await CapacitorHttp.request(options);
    if (response.status === 401) {
      toast.error('Session expired. Please logout and login again.');
      throw { response: { status: 401, data: response.data } };
    }
    if (response.status === 403) {
      toast.error("You don't have admin access.");
      throw { response: { status: 403, data: response.data } };
    }
    if (response.status >= 400) {
      throw { response: { status: response.status, data: response.data } };
    }
    return { data: response.data, status: response.status };
  } catch (err) {
    if (err.response) throw err;
    throw err;
  }
}

/**
 * Web HTTP call using axios
 */
function webRequest(method, path, data = null, config = {}) {
  const token = getToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...config.headers,
  };

  const axiosConfig = { ...config, headers };

  switch (method) {
    case 'get':
      return axios.get(`${API}${path}`, axiosConfig).catch(handleWebError);
    case 'post':
      return axios.post(`${API}${path}`, data, axiosConfig).catch(handleWebError);
    case 'put':
      return axios.put(`${API}${path}`, data, axiosConfig).catch(handleWebError);
    case 'delete':
      return axios.delete(`${API}${path}`, axiosConfig).catch(handleWebError);
    default:
      return axios.get(`${API}${path}`, axiosConfig).catch(handleWebError);
  }
}

function handleWebError(error) {
  if (error.response?.status === 401) {
    toast.error('Session expired. Please logout and login again.');
  } else if (error.response?.status === 403) {
    toast.error("You don't have admin access.");
  }
  throw error;
}

const isNative = Capacitor.isNativePlatform();

/**
 * Admin API - uses native HTTP on Android, axios on web
 */
const adminApi = {
  get: (path, config = {}) =>
    isNative
      ? nativeRequest('get', path, null, config.params)
      : webRequest('get', path, null, config),

  post: (path, data = null, config = {}) =>
    isNative
      ? nativeRequest('post', path, data, config.params)
      : webRequest('post', path, data, config),

  put: (path, data = null, config = {}) =>
    isNative
      ? nativeRequest('put', path, data, config.params)
      : webRequest('put', path, data, config),

  delete: (path, config = {}) =>
    isNative
      ? nativeRequest('delete', path, null, config.params)
      : webRequest('delete', path, null, config),
};

export default adminApi;
