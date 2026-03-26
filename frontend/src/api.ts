import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  timeout: 15_000
});

// Auto-redirect to login on session expiry
api.interceptors.response.use(
  res => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && window.location.pathname !== '/') {
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const getUser          = () => api.get('/auth/user');
export const logout           = () => api.post('/auth/logout');
export const scheduleEmails   = (formData: FormData) => api.post('/api/emails/schedule', formData);
export const getScheduledEmails = () => api.get('/api/emails/scheduled');
export const getSentEmails    = () => api.get('/api/emails/sent');

export default api;
