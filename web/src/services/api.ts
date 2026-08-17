import axios from 'axios';

export const API_BASE_URL = 'http://localhost:5000/api/auth';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor to attach access token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('medtrace_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to refresh token on 401 response
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(`${API_BASE_URL}/refresh-token`, {}, { withCredentials: true });
        if (refreshResponse.data.accessToken) {
          localStorage.setItem('medtrace_access_token', refreshResponse.data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        localStorage.removeItem('medtrace_access_token');
        localStorage.removeItem('medtrace_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
