import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('unifeast_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('unifeast_token');
      localStorage.removeItem('unifeast_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ───────────────────────────────

export const authAPI = {
  requestRegisterOtp: (data) => api.post('/auth/register/request', data),
  verifyRegisterOtp: (data) => api.post('/auth/register/verify', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (data) => api.post('/auth/google', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// ─── Menu API ───────────────────────────────

export const menuAPI = {
  getAll: (params) => api.get('/menu', { params }),
  getOne: (id) => api.get(`/menu/${id}`),
  create: (data) => api.post('/menu', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/menu/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/menu/${id}`),
  toggle: (id) => api.patch(`/menu/${id}/toggle`),
};

// ─── Order API ──────────────────────────────

export const orderAPI = {
  create: (data) => api.post('/orders', data),
  getMy: (params) => api.get('/orders/my', { params }),
  getAll: (params) => api.get('/orders', { params }),
  getOne: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  getStats: () => api.get('/orders/stats/summary'),
};

// ─── Pool API ───────────────────────────────

export const poolAPI = {
  getActive: () => api.get('/pools'),
  getOne: (id) => api.get(`/pools/${id}`),
  checkForItem: (menuItemId) => api.get(`/pools/check/${menuItemId}`),
  join: (data) => api.post('/pools/join', data),
  close: (id) => api.patch(`/pools/${id}/close`),
};

// ─── Nutrition API ──────────────────────────

export const nutritionAPI = {
  getDaily: (date) => api.get(`/nutrition/daily/${date}`),
  getWeekly: () => api.get('/nutrition/weekly'),
  logMeal: (data) => api.post('/nutrition/log', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteMeal: (logId, mealId) => api.delete(`/nutrition/meal/${logId}/${mealId}`),
};

// ─── Admin API ──────────────────────────────

export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  updateRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getStats: () => api.get('/admin/stats'),
};

export default api;
