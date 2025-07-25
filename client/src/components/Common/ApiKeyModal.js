import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon, ExternalLinkIcon } from '@heroicons/react/24/outline';
import { useApp } from '../../context/AppContext';
import { validationAPI } from '../../services/api';
import LoadingSpinner from './LoadingSpinner';
import HelpCard from './HelpCard';

function ApiKeyModal({ isOpen, onClose }) {
  const { apiKey, setApiKey, showSuccess, setError } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(apiKey || '');
      setValidationResult(null);
    }
  }, [isOpen, apiKey]);

  const validateApiKey = async (key) => {
    if (!key || key.length < 10) {
      setValidationResult({ valid: false, error: 'API key is too short' });
      return;
    }

    setIsValidating(true);
    try {
      const response = await validationAPI.validateApiKey(key);
      setValidationResult({
        valid: response.data.valid,
        accountInfo: response.data.accountInfo,
        error: response.data.error,
      });
    } catch (error) {
      setValidationResult({
        valid: false,
        error: error.message || 'Failed to validate API key',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.trim();
    setInputValue(value);
    setValidationResult(null);
    
    // Auto-validate after user stops typing
    if (value) {
      const timeoutId = setTimeout(() => {
        validateApiKey(value);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  };

  const handleSave = () => {
    if (validationResult?.valid) {
      setApiKey(inputValue);
      showSuccess('API key saved successfully');
      onClose();
    } else if (inputValue === '') {
      setApiKey('');
      showSuccess('API key cleared');
      onClose();
    } else {
      setError('Please enter a valid API key');
    }
  };

  const handleClear = () => {
    setInputValue('');
    setValidationResult(null);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed z-10 inset-0 overflow-y-auto"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-medium text-gray-900">
                Configure HubSpot API Key
              </Dialog.Title>
              <p className="mt-1 text-sm text-gray-500">
                Enter your HubSpot Private App access token to enable automation features.
              </p>
            </div>
            <button
              type="button"
              className="ml-3 h-7 w-7 bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onClick={onClose}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Help Instructions */}
          <div className="mt-6">
            <HelpCard type="info" title="How to get your HubSpot API Key">
              <ol className="space-y-2 text-sm">
                <li><strong>1.</strong> Go to your HubSpot account settings</li>
                <li><strong>2.</strong> Navigate to <strong>Integrations → Private Apps</strong></li>
                <li><strong>3.</strong> Click <strong>"Create a private app"</strong></li>
                <li><strong>4.</strong> Give it a name like "Automation Platform"</li>
                <li><strong>5.</strong> In the <strong>Scopes</strong> tab, select:
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• CRM (all permissions)</li>
                    <li>• Settings (read/write)</li>
                  </ul>
                </li>
                <li><strong>6.</strong> Click <strong>"Create app"</strong> and copy your access token</li>
              </ol>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <a 
                  href="https://developers.hubspot.com/docs/api/private-apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                >
                  <ExternalLinkIcon className="h-4 w-4 mr-1" />
                  View HubSpot Documentation
                </a>
              </div>
            </HelpCard>
          </div>

          {/* API Key Input */}
          <div className="mt-6">
            <label htmlFor="api-key" className="block text-sm font-medium text-gray-700">
              API Key <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 mb-2">
              Paste your HubSpot Private App access token here (starts with "pat-")
            </p>
            <div className="mt-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                id="api-key"
                name="api-key"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="input-field pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>

            {/* Validation Status */}
            <div className="mt-3 min-h-[60px]">
              {isValidating && (
                <div className="flex items-center text-sm text-gray-600">
                  <LoadingSpinner className="mr-2" />
                  Validating API key...
                </div>
              )}

              {validationResult && !isValidating && (
                <div className={`p-3 rounded-md ${
                  validationResult.valid 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {validationResult.valid ? (
                    <div>
                      <div className="flex items-center">
                        <div className="h-2 w-2 bg-green-400 rounded-full mr-2" />
                        <span className="text-sm font-medium text-green-800">Valid API Key</span>
                      </div>
                      {validationResult.accountInfo && (
                        <div className="mt-2 text-sm text-green-700">
                          <p><strong>Portal ID:</strong> {validationResult.accountInfo.portalId}</p>
                          {validationResult.accountInfo.domain && (
                            <p><strong>Domain:</strong> {validationResult.accountInfo.domain}</p>
                          )}
                          {validationResult.accountInfo.timeZone && (
                            <p><strong>Timezone:</strong> {validationResult.accountInfo.timeZone}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center">
                        <div className="h-2 w-2 bg-red-400 rounded-full mr-2" />
                        <span className="text-sm font-medium text-red-800">Invalid API Key</span>
                      </div>
                      <p className="mt-1 text-sm text-red-700">{validationResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Help Text */}
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <h4 className="text-sm font-medium text-blue-800 mb-2">How to get your API key:</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Go to your HubSpot account settings</li>
                <li>Navigate to Integrations → Private Apps</li>
                <li>Create a new private app or select an existing one</li>
                <li>Ensure it has the required scopes for CRM objects and settings</li>
                <li>Copy the access token and paste it here</li>
              </ol>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={handleClear}
              className="btn-secondary"
              disabled={!inputValue}
            >
              Clear
            </button>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn-primary"
                disabled={inputValue && !validationResult?.valid}
              >
                Save API Key
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export default ApiKeyModal;