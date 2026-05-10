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
  analyzeNutrition: (data) => api.post('/menu/analyze-nutrition', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  create: (data) => api.post('/menu', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/menu/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateStock: (id, stock) => api.patch(`/menu/${id}/stock`, { stock }),
  delete: (id) => api.delete(`/menu/${id}`),
  toggle: (id) => api.patch(`/menu/${id}/toggle`),
};

// ─── Order API ──────────────────────────────

export const orderAPI = {
  create: (data) => api.post('/orders', data),
  getMy: (params) => api.get('/orders/my', { params }),
  getAll: (params) => api.get('/orders', { params }),
  getOne: (id) => api.get(`/orders/${id}`),
  getQr: (id) => api.get(`/orders/${id}/qr`),
  scanQr: (qrPayload) => api.post('/orders/kitchen/qr/scan', { qrPayload }),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { newStatus: status }),
  getLiveQueue: () => api.get('/orders/live-queue'),
  getStats: () => api.get('/orders/stats/summary'),
  getKitchenStock: () => api.get('/orders/kitchen/stock'),
  addProducedStock: (menuItemId, quantity) => api.post('/orders/kitchen/produce', { menuItemId, quantity }),
};

// ─── Payment API ────────────────────────────

export const paymentAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verifyPayment: (data) => api.post('/payments/verify', data),
};

export const cartAPI = {
  holdItem: (menuItemId, quantity, holdMs) => api.post('/cart/hold', { menuItemId, quantity, holdMs }),
  releaseItem: (menuItemId) => api.delete(`/cart/hold/${menuItemId}`),
  clearHolds: () => api.delete('/cart/holds'),
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
  getMonthly: () => api.get('/nutrition/monthly'),
  updateGoals: (data) => api.put('/nutrition/goals', data),
  analyzeImage: (formData) => api.post('/nutrition/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  logMeal: (data) => api.post('/nutrition/log', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteMeal: (logId, mealId) => api.delete(`/nutrition/meal/${logId}/${mealId}`),
  updateMealQuantity: (logId, mealId, quantity) => api.patch(`/nutrition/meal/${logId}/${mealId}/quantity`, { quantity }),
};

// ─── Leaderboard API ──────────────────────────

export const leaderboardAPI = {
  getWidget: (period = 'weekly') => api.get('/leaderboard/widget', { params: { period } }),
  getFull: (category, page, limit, period = 'weekly') => api.get('/leaderboard/full', {
    params: { category, page, limit, period },
  }),
};

// ─── Admin API ──────────────────────────────

export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  updateRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getStats: (params) => api.get('/admin/stats', { params }),
  getCanteenStatus: () => api.get('/admin/canteen-status'),
  toggleCanteenStatus: (isLive) => api.patch('/admin/canteen-status', { isLive }),
  getCartHoldWindow: () => api.get('/admin/cart-hold-window'),
  updateCartHoldWindow: (data) => api.patch('/admin/cart-hold-window', data),
};

export default api;
