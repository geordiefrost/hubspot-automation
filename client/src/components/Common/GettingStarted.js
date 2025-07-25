import React, { useState } from 'react';
import { 
  CheckCircleIcon, 
  XMarkIcon,
  KeyIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  RocketLaunchIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useApp } from '../../context/AppContext';

const STEPS = [
  {
    id: 1,
    title: 'Connect HubSpot Account',
    description: 'Add your HubSpot API key to connect your account',
    icon: KeyIcon,
    action: 'Connect API Key',
    completed: false
  },
  {
    id: 2, 
    title: 'Explore Templates',
    description: 'Browse pre-built templates for different industries',
    icon: DocumentTextIcon,
    action: 'View Templates',
    path: '/templates'
  },
  {
    id: 3,
    title: 'Import Your Data',
    description: 'Upload a CSV file and map your fields to HubSpot properties',
    icon: CloudArrowUpIcon,
    action: 'Start Import',
    path: '/import'
  },
  {
    id: 4,
    title: 'Deploy Configuration',
    description: 'Deploy your properties and configuration to HubSpot',
    icon: RocketLaunchIcon,
    action: 'Deploy Setup',
    path: '/deployments'
  }
];

function GettingStarted({ onClose }) {
  const { apiKey, setShowApiKeyModal } = useApp();
  const [dismissedSteps, setDismissedSteps] = useState(new Set());

  const handleStepAction = (step) => {
    if (step.id === 1) {
      setShowApiKeyModal(true);
    } else if (step.path) {
      window.location.href = step.path;
    }
  };

  const dismissStep = (stepId) => {
    setDismissedSteps(prev => new Set([...prev, stepId]));
  };

  const visibleSteps = STEPS.filter(step => !dismissedSteps.has(step.id));
  
  // Mark first step as completed if API key exists
  const stepsWithStatus = visibleSteps.map(step => ({
    ...step,
    completed: step.id === 1 ? !!apiKey : step.completed
  }));

  if (stepsWithStatus.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
          <p className="text-sm text-gray-600 mt-1">
            Follow these steps to set up your HubSpot automation
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        {stepsWithStatus.map((step, index) => {
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="flex items-start">
              <div className="flex-shrink-0 mr-4">
                {step.completed ? (
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Icon className="h-4 w-4 text-gray-500 mr-2" />
                    <h3 className={`text-sm font-medium ${step.completed ? 'text-green-800' : 'text-gray-900'}`}>
                      {step.title}
                    </h3>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {!step.completed && (
                      <button
                        onClick={() => handleStepAction(step)}
                        className="text-xs bg-primary-600 text-white px-3 py-1 rounded-md hover:bg-primary-700"
                      >
                        {step.action}
                      </button>
                    )}
                    <button
                      onClick={() => dismissStep(step.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mt-1 mr-8">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center text-xs text-gray-500">
          <InformationCircleIcon className="h-4 w-4 mr-1" />
          Need help? Check out our{' '}
          <button className="text-primary-600 hover:text-primary-700 underline ml-1">
            documentation
          </button>
        </div>
      </div>
    </div>
  );
}

export default GettingStarted;