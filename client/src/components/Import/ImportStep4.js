import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  RocketLaunchIcon,
  DocumentDuplicateIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { templateAPI } from '../../services/api';
import { useApp } from '../../context/AppContext';
import LoadingSpinner from '../Common/LoadingSpinner';
import { createDeploymentStream } from '../../services/api';

function ImportStep4({ onBack, data, onReset }) {
  const { apiKey, showSuccess, setError } = useApp();
  const navigate = useNavigate();
  const [selectedAction, setSelectedAction] = useState('deploy'); // 'deploy' or 'save'
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [deploymentInProgress, setDeploymentInProgress] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(null);

  // Save as template mutation
  const saveTemplateMutation = useMutation(templateAPI.create, {
    onSuccess: (response) => {
      showSuccess(`Template "${templateName}" created successfully`);
      navigate('/templates');
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    const templateData = {
      name: templateName,
      description: templateDescription,
      industry: 'Imported',
      config: {
        properties: {
          [data.objectType]: data.configuration.properties || []
        },
        pipelines: data.configuration.pipelines || {},
        lifecycleStages: data.configuration.lifecycleStages || {}
      }
    };

    saveTemplateMutation.mutate(templateData);
  };

  const handleDeploy = () => {
    if (!clientName.trim()) {
      setError('Client name is required');
      return;
    }

    if (!apiKey) {
      setError('HubSpot API key is required');
      return;
    }

    setDeploymentInProgress(true);
    setDeploymentProgress({ step: 'Initializing deployment...', percentage: 0 });

    const deploymentData = {
      clientName,
      config: {
        properties: {
          [data.objectType]: data.configuration.properties || []
        },
        propertyGroups: data.configuration.propertyGroups || [],
        pipelines: data.configuration.pipelines || {},
        lifecycleStages: data.configuration.lifecycleStages || {}
      },
      apiKey
    };

    createDeploymentStream(
      deploymentData,
      (progressData) => {
        setDeploymentProgress(progressData);
      },
      (error) => {
        setError(error.message);
        setDeploymentInProgress(false);
      },
      (result) => {
        setDeploymentInProgress(false);
        if (result.success) {
          showSuccess('Deployment completed successfully!');
          navigate(`/deployments/${result.deploymentId}`);
        }
      }
    );
  };

  const configuration = data.configuration;
  const estimatedTime = data.estimatedTime;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Deploy or Save Configuration
        </h3>
        <p className="text-sm text-gray-600">
          Your configuration is ready! You can deploy it directly to HubSpot or save it as a reusable template.
        </p>
      </div>

      {/* Configuration Summary */}
      <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
          <h4 className="text-sm font-medium text-green-800">Configuration Ready</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-green-800">Properties:</span>
            <span className="ml-2 text-green-700">{configuration.summary?.totalProperties || 0}</span>
          </div>
          <div>
            <span className="font-medium text-green-800">Groups:</span>
            <span className="ml-2 text-green-700">{configuration.summary?.groupsNeeded || 0}</span>
          </div>
          <div>
            <span className="font-medium text-green-800">Object Type:</span>
            <span className="ml-2 text-green-700 capitalize">{data.objectType}s</span>
          </div>
          <div>
            <span className="font-medium text-green-800">Est. Time:</span>
            <span className="ml-2 text-green-700">{estimatedTime?.estimatedSeconds || 0}s</span>
          </div>
        </div>
      </div>

      {/* Property Types Breakdown */}
      {configuration.summary?.propertyTypes && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Property Types</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {configuration.summary.propertyTypes.map((type) => (
              <div key={type.type} className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-gray-900 capitalize">{type.type}</div>
                <div className="text-lg font-bold text-gray-700">{type.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Selection */}
      <div className="mb-6">
        <div className="flex space-x-4 mb-4">
          <button
            type="button"
            onClick={() => setSelectedAction('deploy')}
            className={`flex-1 flex items-center justify-center px-4 py-3 border rounded-lg text-sm font-medium ${
              selectedAction === 'deploy'
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <RocketLaunchIcon className="h-5 w-5 mr-2" />
            Deploy to HubSpot
          </button>
          <button
            type="button"
            onClick={() => setSelectedAction('save')}
            className={`flex-1 flex items-center justify-center px-4 py-3 border rounded-lg text-sm font-medium ${
              selectedAction === 'save'
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
            Save as Template
          </button>
        </div>

        {/* Deploy Form */}
        {selectedAction === 'deploy' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name for this deployment"
                className="input-field"
                disabled={deploymentInProgress}
              />
            </div>

            {!apiKey && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  Please configure your HubSpot API key before deploying.
                </p>
              </div>
            )}

            {estimatedTime && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex items-center mb-2">
                  <ClockIcon className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">Estimated Deployment Time</span>
                </div>
                <div className="text-sm text-blue-700">
                  <p>Total: ~{estimatedTime.estimatedSeconds} seconds</p>
                  <ul className="mt-1 text-xs space-y-1">
                    <li>• {estimatedTime.breakdown.groups}</li>
                    <li>• {estimatedTime.breakdown.properties}</li>
                    <li>• {estimatedTime.breakdown.overhead}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Template Form */}
        {selectedAction === 'save' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter a descriptive name for this template"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe what this template is used for..."
                rows={3}
                className="input-field"
              />
            </div>
          </div>
        )}
      </div>

      {/* Deployment Progress */}
      {deploymentInProgress && deploymentProgress && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <LoadingSpinner className="mr-2" />
            <h4 className="text-sm font-medium text-blue-800">Deployment in Progress</h4>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-sm text-blue-700 mb-1">
              <span>{deploymentProgress.step || 'Processing...'}</span>
              <span>{deploymentProgress.percentage || 0}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${deploymentProgress.percentage || 0}%` }}
              />
            </div>
          </div>
          {deploymentProgress.details && (
            <p className="text-xs text-blue-600">{deploymentProgress.details}</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button 
          onClick={onBack} 
          className="btn-secondary"
          disabled={deploymentInProgress}
        >
          Back
        </button>
        <div className="flex space-x-3">
          <button 
            onClick={onReset} 
            className="btn-secondary"
            disabled={deploymentInProgress}
          >
            Start Over
          </button>
          {selectedAction === 'deploy' ? (
            <button
              onClick={handleDeploy}
              disabled={!clientName.trim() || !apiKey || deploymentInProgress}
              className="btn-primary"
            >
              {deploymentInProgress ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  Deploying...
                </>
              ) : (
                <>
                  <RocketLaunchIcon className="h-4 w-4 mr-2" />
                  Deploy to HubSpot
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || saveTemplateMutation.isLoading}
              className="btn-primary"
            >
              {saveTemplateMutation.isLoading ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                  Save Template
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportStep4;