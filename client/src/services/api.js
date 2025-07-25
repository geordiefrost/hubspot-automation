import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API key
api.interceptors.request.use(
  (config) => {
    const apiKey = localStorage.getItem('hubspot_api_key');
    if (apiKey && config.data && typeof config.data === 'object') {
      config.data.apiKey = apiKey;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    
    // Create a standardized error object
    const standardError = {
      message,
      status: error.response?.status,
      data: error.response?.data,
      isNetworkError: !error.response,
    };

    return Promise.reject(standardError);
  }
);

// API endpoints
export const templateAPI = {
  list: (params = {}) => api.get('/templates', { params }),
  getById: (id) => api.get('/templates', { params: { id } }),
  create: (data) => api.post('/templates', { action: 'create', ...data }),
  update: (id, data) => api.put('/templates', { ...data }, { params: { id } }),
  delete: (id) => api.delete('/templates', { params: { id } }),
  getIndustryTemplates: () => api.get('/templates', { params: { action: 'industry-templates' } }),
  getIndustryTemplate: (industry) => api.get('/templates', { params: { action: 'industry-template', industry } }),
  deployIndustryTemplate: (data) => api.post('/templates', { action: 'deploy-industry-template', ...data }),
};

export const deploymentAPI = {
  list: (params = {}) => api.get('/deployments', { params }),
  getById: (id) => api.get('/deployments', { params: { id } }),
  create: (data) => api.post('/deployments', { action: 'create', ...data }),
  getStats: () => api.get('/deployments', { params: { action: 'stats' } }),
  getStream: (deploymentId) => {
    return new EventSource(`/api/deployments?action=stream&deploymentId=${deploymentId}`);
  },
};

export const importAPI = {
  downloadTemplate: (configType) => api.get('/import', { 
    params: { action: 'download-template', configType },
    responseType: 'blob'
  }),
  parseCSV: (data) => api.post('/import', { action: 'parse-csv', ...data }),
  validateConfig: (data) => api.post('/import', { action: 'validate-config', ...data }),
  previewDeployment: (data) => api.post('/import', { action: 'preview-deployment', ...data }),
};

export const validationAPI = {
  validateApiKey: (apiKey) => api.post('/validate', { action: 'api-key', apiKey }),
};

// Utility functions
export const createDeploymentStream = (deploymentData, onMessage, onError, onComplete) => {
  const formData = new URLSearchParams(deploymentData);
  const eventSource = new EventSource(
    `${api.defaults.baseURL}/deployments?${formData}`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
      
      if (data.type === 'completed' || data.type === 'error') {
        eventSource.close();
        onComplete?.(data);
      }
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      onError?.(error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    eventSource.close();
    onError?.(error);
  };

  return eventSource;
};

// Export default api instance
export default api;