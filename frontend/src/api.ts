import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Extend Axios config to include metadata
interface AxiosRequestConfigWithMetadata extends InternalAxiosRequestConfig {
  metadata?: { startTime: Date };
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for logging
api.interceptors.request.use(
  (config: AxiosRequestConfigWithMetadata) => {
    // Add timestamp for request tracking
    config.metadata = { startTime: new Date() };
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    // Log response time
    const config = response.config as AxiosRequestConfigWithMetadata;
    const duration = new Date().getTime() - (config.metadata?.startTime?.getTime() || 0);
    if (duration > 3000) {
      console.warn(`Slow API call: ${response.config.url} took ${duration}ms`);
    }
    return response;
  },
  (err: AxiosError) => {
    // Auto-redirect to login on session expiry
    if (err.response?.status === 401 && window.location.pathname !== '/') {
      window.location.href = '/';
    }
    
    // Log error for debugging
    console.error('API Error:', {
      url: err.config?.url,
      status: err.response?.status,
      message: err.message
    });
    
    return Promise.reject(err);
  }
);

export const getUser = () => api.get('/auth/user');
export const logout = () => api.post('/auth/logout');
export const scheduleEmails = (formData: FormData) => 
  api.post('/api/emails/schedule', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
export const getScheduledEmails = () => api.get('/api/emails/scheduled');
export const getSentEmails = () => api.get('/api/emails/sent');
export const cancelEmail = (id: string) => api.delete(`/api/emails/${id}`);
export const bulkCancelEmails = (emailIds: string[]) => 
  api.post('/api/emails/bulk-cancel', { emailIds });
export const retryFailedEmails = (emailIds: string[]) => 
  api.post('/api/emails/retry-failed', { emailIds });
export const getEmailStats = () => api.get('/api/emails/stats');
export const getTemplates = () => api.get('/api/emails/templates');
export const saveTemplate = (data: { name: string; subject: string; body: string }) => 
  api.post('/api/emails/templates', data);
export const deleteTemplate = (id: string) => api.delete(`/api/emails/templates/${id}`);

export default api;
