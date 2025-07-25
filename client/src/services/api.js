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
  getById: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  duplicate: (id, name) => api.post(`/templates/${id}/duplicate`, { name }),
  export: (id) => api.get(`/templates/${id}/export`),
  import: (data) => api.post('/templates/import', data),
  getIndustries: () => api.get('/templates/industries'),
};

export const deploymentAPI = {
  list: (params = {}) => api.get('/deployments', { params }),
  getById: (id) => api.get(`/deployments/${id}`),
  deploy: (data) => {
    // Return a function that creates the EventSource
    return () => {
      const eventSource = new EventSource(
        `${api.defaults.baseURL}/deployments?${new URLSearchParams(data)}`
      );
      return eventSource;
    };
  },
  deployPost: (data) => api.post('/deployments', data),
  rollback: (id, apiKey) => api.post(`/deployments/${id}/rollback`, { apiKey }),
  retry: (id, apiKey) => api.post(`/deployments/${id}/retry`, { apiKey }),
  validate: (data) => api.post('/deployments/validate', data),
  getStats: () => api.get('/deployments/stats'),
};

export const importAPI = {
  parseCSV: (data) => api.post('/import/csv', data),
  parseExcelPaste: (data) => api.post('/import/excel-paste', data),
  analyseFields: (data) => api.post('/import/analyse', data),
  validateMappings: (data) => api.post('/import/validate-mappings', data),
  previewConfiguration: (data) => api.post('/import/preview', data),
};

export const validationAPI = {
  validateApiKey: (apiKey) => api.post('/validate/api-key', { apiKey }),
  validatePropertyName: (data) => api.post('/validate/property-name', data),
  validatePipelineName: (data) => api.post('/validate/pipeline-name', data),
  validateConfiguration: (data) => api.post('/validate/configuration', data),
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