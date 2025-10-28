import axios from 'axios';

// 後端 URL：環境變數優先，再退回 localhost
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// 在每次請求加上 Bearer Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // 統一使用 'token'
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 401 時嘗試刷新 Token；失敗就導回登入
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const resp = await axios.post(`${API_BASE_URL}/token/refresh/`, { refresh: refreshToken });
          const { access } = resp.data || {};
          if (access) {
            localStorage.setItem('token', access);
            api.defaults.headers.Authorization = `Bearer ${access}`;
            original.headers.Authorization = `Bearer ${access}`;
            return api(original);
          }
        } catch (e) {
          // fallthrough to logout
        }
      }

      // 刷新失敗或沒有 refresh token → 強制登出
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// -------- Member API --------
export const memberAPI = {
  list: (params) => api.get('/member/', { params }),
  create: (data) => api.post('/member/', data),
  update: async (id, data) => {
    try {
      const response = await api.patch(`/member/${id}/`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  get: (id) => api.get(`/member/${id}/`),
  delete: (id) => api.delete(`/member/${id}/`),
};

// -------- User API --------
export const userAPI = {
  list: (params) => api.get('/users/', { params }),
  get: (id) => api.get(`/users/${id}/`),
  getCurrentUser: () => api.get('/users/me/'),
  getStaff: (params) =>
    api.get('/users/', { params: { ...params, is_staff: true } }),
  getAllForScheduling: (params) =>
    api.get('/users/', { params: { ...params, is_active: true } }),
};

// -------- Shift Type API --------
export const shiftAPI = {
  list: (params) => api.get('/shift/', { params }),
  create: (data) => api.post('/shift/', data),
  update: (id, data) => api.patch(`/shift/${id}/`, data),
  delete: (id) => api.delete(`/shift/${id}/`),
  get: (id) => api.get(`/shift/${id}/`),

  // 批量操作
  bulkCreate: (data) => api.post('/shift/bulk_create/', data),
  bulkUpdate: (data) => api.patch('/shift/bulk_update/', data),
  bulkDelete: (ids) => api.delete('/shift/bulk_delete/', { data: { ids } }),

  // 便利函式：產生 id -> shiftType 的映射（選用）
  async map(params) {
    const res = await this.list(params);
    const items = res.data?.results ?? res.data ?? [];
    const m = new Map();
    items.forEach(st => m.set(st.id, st));
    return m;
  },
};

// -------- Staff Shift API --------
export const staffShiftAPI = {
  list: (params) => api.get('/staffshift/', { params }),
  create: (data) => api.post('/staffshift/', data),
  update: (id, data) => api.patch(`/staffshift/${id}/`, data),
  delete: (id) => api.delete(`/staffshift/${id}/`),
  get: (id) => api.get(`/staffshift/${id}/`),

  // 日期範圍
  getByDateRange: (startDate, endDate, extraParams = {}) =>
    api.get('/staffshift/', {
      params: { start_date: startDate, end_date: endDate, ...extraParams },
    }),

  // 單日
  getByDate: (date, extraParams = {}) =>
    api.get('/staffshift/', { params: { shift_date: date, ...extraParams } }),

  // 我的班次
  getMyShifts: (params) => api.get('/staffshift/my_shifts/', { params }),

  // 指定用戶班次
  getUserShifts: (userId, params) =>
    api.get('/staffshift/', { params: { staff: userId, ...params } }),

  // 批量
  bulkCreate: (data) => api.post('/staffshift/bulk_create/', data),
  bulkUpdate: (data) => api.patch('/staffshift/bulk_update/', data),
  bulkDelete: (ids) => api.delete('/staffshift/bulk_delete/', { data: { ids } }),

  // 複製
  copyShifts: (fromDate, toDate, data) =>
    api.post('/staffshift/copy_shifts/', { from_date: fromDate, to_date: toDate, ...data }),

  // 檢查衝突
  checkConflicts: (data) => api.post('/staffshift/check_conflicts/', data),

  // 統計
  getStats: (params) => api.get('/staffshift/stats/', { params }),

  // 導出
  export: (params) =>
    api.get('/staffshift/export/', { params, responseType: 'blob' }),
};

// -------- Leave Request API --------
export const leaveRequestAPI = {
  list: (params) => api.get('/leaverequest/', { params }),
  create: (data) => api.post('/leaverequest/', data),
  update: (id, data) => api.patch(`/leaverequest/${id}/`, data),
  delete: (id) => api.delete(`/leaverequest/${id}/`),
  get: (id) => api.get(`/leaverequest/${id}/`),
  cancel: (id) => api.patch(`/leaverequest/${id}/`, { status: 'canceled' }),

  approve: (id, data) => api.patch(`/leaverequest/${id}/approve/`, data),
  reject: (id, data) => api.patch(`/leaverequest/${id}/reject/`, data),

  getMyRequests: (params) => api.get('/leaverequest/my_requests/', { params }),
  getPendingRequests: (params) =>
    api.get('/leaverequest/', { params: { status: 'pending', ...params } }),
};

// -------- Leave Balance API --------
export const leaveBalanceAPI = {
  get: () => api.get('/leavebalance/'),
  list: (params) => api.get('/leavebalance/', { params }),
  getByUser: (userId) => api.get(`/leavebalance/${userId}/`),
  update: (id, data) => api.patch(`/leavebalance/${id}/`, data),
  recalculate: (userId) => api.post(`/leavebalance/${userId}/recalculate/`),
  bulkUpdate: (data) => api.patch('/leavebalance/bulk_update/', data),
};

// -------- Wage API --------
export const wageAPI = {
  list: (params) => api.get('/wage/', { params }),
  create: (data) => api.post('/wage/', data),
  update: (id, data) => api.patch(`/wage/${id}/`, data),
  delete: (id) => api.delete(`/wage/${id}/`),
  get: (id) => api.get(`/wage/${id}/`),

  calculate: (params) => api.post('/wage/calculate/', params),
  getStats: (params) => api.get('/wage/stats/', { params }),
  export: (params) =>
    api.get('/wage/export/', { params, responseType: 'blob' }),

  bulkCreate: (data) => api.post('/wage/bulk_create/', data),
  bulkUpdate: (data) => api.patch('/wage/bulk_update/', data),
};

// -------- Auth API --------
export const authAPI = {
  login: (credentials) => api.post('/token/', credentials),
  refresh: (refresh) => api.post('/token/refresh/', { refresh }),
  logout: () => api.post('/logout/'),

  resetPassword: (email) => api.post('/password-reset/', { email }),
  resetPasswordConfirm: (data) => api.post('/password-reset/confirm/', data),
  resetPasswordValidate: (data) => api.post('/password-reset/validate/', data),

  changePassword: (data) => api.post('/change-password/', data),
  register: (data) => api.post('/register/', data),

  verifyToken: () => api.post('/token/verify/'),
  getUser: () => api.get('/user/'),
};

// -------- Notification API --------
export const notificationAPI = {
  list: (params) => api.get('/notifications/', { params }),
  markAsRead: (id) => api.patch(`/notifications/${id}/`, { is_read: true }),
  markAllAsRead: () => api.patch('/notifications/mark_all_read/'),
  delete: (id) => api.delete(`/notifications/${id}/`),
  getUnreadCount: () => api.get('/notifications/unread_count/'),
};

// -------- Settings API --------
export const settingsAPI = {
  get: () => api.get('/settings/'),
  update: (data) => api.patch('/settings/', data),

  getLeaveTypes: () => api.get('/settings/leave_types/'),
  updateLeaveTypes: (data) => api.patch('/settings/leave_types/', data),

  getHolidays: (params) => api.get('/settings/holidays/', { params }),
  updateHolidays: (data) => api.patch('/settings/holidays/', data),
};

export default api;