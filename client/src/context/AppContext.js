import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// Initial state
const initialState = {
  apiKey: localStorage.getItem('hubspot_api_key') || '',
  currentDeployment: null,
  deploymentProgress: null,
  settings: {
    darkMode: localStorage.getItem('dark_mode') === 'true',
    notifications: localStorage.getItem('notifications') !== 'false',
    autoSave: localStorage.getItem('auto_save') !== 'false',
  },
  user: null,
  isLoading: false,
  error: null,
};

// Action types
const ActionTypes = {
  SET_API_KEY: 'SET_API_KEY',
  SET_CURRENT_DEPLOYMENT: 'SET_CURRENT_DEPLOYMENT',
  SET_DEPLOYMENT_PROGRESS: 'SET_DEPLOYMENT_PROGRESS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SET_USER: 'SET_USER',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_API_KEY:
      if (action.payload) {
        localStorage.setItem('hubspot_api_key', action.payload);
      } else {
        localStorage.removeItem('hubspot_api_key');
      }
      return {
        ...state,
        apiKey: action.payload,
      };

    case ActionTypes.SET_CURRENT_DEPLOYMENT:
      return {
        ...state,
        currentDeployment: action.payload,
      };

    case ActionTypes.SET_DEPLOYMENT_PROGRESS:
      return {
        ...state,
        deploymentProgress: action.payload,
      };

    case ActionTypes.UPDATE_SETTINGS:
      const newSettings = { ...state.settings, ...action.payload };
      
      // Persist settings to localStorage
      Object.entries(newSettings).forEach(([key, value]) => {
        localStorage.setItem(key.replace(/([A-Z])/g, '_$1').toLowerCase(), value.toString());
      });
      
      return {
        ...state,
        settings: newSettings,
      };

    case ActionTypes.SET_USER:
      return {
        ...state,
        user: action.payload,
      };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// Context
const AppContext = createContext();

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Actions
  const actions = {
    setApiKey: (apiKey) => {
      dispatch({ type: ActionTypes.SET_API_KEY, payload: apiKey });
    },

    setCurrentDeployment: (deployment) => {
      dispatch({ type: ActionTypes.SET_CURRENT_DEPLOYMENT, payload: deployment });
    },

    setDeploymentProgress: (progress) => {
      dispatch({ type: ActionTypes.SET_DEPLOYMENT_PROGRESS, payload: progress });
    },

    updateSettings: (settings) => {
      dispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: settings });
    },

    setUser: (user) => {
      dispatch({ type: ActionTypes.SET_USER, payload: user });
    },

    setLoading: (isLoading) => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: isLoading });
    },

    setError: (error) => {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error });
      if (error && state.settings.notifications) {
        toast.error(typeof error === 'string' ? error : error.message);
      }
    },

    clearError: () => {
      dispatch({ type: ActionTypes.CLEAR_ERROR });
    },

    showSuccess: (message) => {
      if (state.settings.notifications) {
        toast.success(message);
      }
    },

    showWarning: (message) => {
      if (state.settings.notifications) {
        toast(message, { icon: '⚠️' });
      }
    },
  };

  // API Key validation effect
  useEffect(() => {
    if (state.apiKey && state.apiKey.length > 0) {
      // You could add API key validation here
      console.log('API key updated:', state.apiKey.substring(0, 10) + '...');
    }
  }, [state.apiKey]);

  // Dark mode effect
  useEffect(() => {
    if (state.settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings.darkMode]);

  // Error handling effect
  useEffect(() => {
    if (state.error && state.settings.notifications) {
      console.error('App Error:', state.error);
    }
  }, [state.error, state.settings.notifications]);

  const value = {
    ...state,
    ...actions,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Selector hooks for performance
export function useApiKey() {
  const { apiKey } = useApp();
  return apiKey;
}

export function useSettings() {
  const { settings, updateSettings } = useApp();
  return { settings, updateSettings };
}

export function useDeployment() {
  const { currentDeployment, deploymentProgress, setCurrentDeployment, setDeploymentProgress } = useApp();
  return {
    currentDeployment,
    deploymentProgress,
    setCurrentDeployment,
    setDeploymentProgress,
  };
}

export function useNotifications() {
  const { showSuccess, showWarning, setError } = useApp();
  return { showSuccess, showWarning, setError };
}

export default AppContext;