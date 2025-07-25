import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { 
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  XCircleIcon,
  ChevronRightIcon,
  PlayIcon,
  ArrowPathIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { deploymentAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import HelpCard from '../components/Common/HelpCard';

function DeploymentDetail() {
  const { id } = useParams();
  const [realtimeProgress, setRealtimeProgress] = useState(null);

  // Fetch deployment details
  const { data: deploymentData, isLoading, refetch } = useQuery(
    ['deployment', id],
    () => deploymentAPI.getById(id),
    {
      staleTime: 30 * 1000,
      refetchInterval: (data) => {
        // Auto-refresh if deployment is in progress
        return data?.data?.status === 'in_progress' ? 5000 : false;
      },
    }
  );

  const deployment = deploymentData?.data;

  // Set up real-time updates for in-progress deployments
  useEffect(() => {
    if (!deployment || deployment.status !== 'in_progress') return;

    const eventSource = new EventSource(`/api/deployments/stream?deploymentId=${id}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setRealtimeProgress(data);
    };

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setRealtimeProgress(data);
    });

    eventSource.addEventListener('completed', () => {
      refetch();
      eventSource.close();
    });

    eventSource.addEventListener('failed', () => {
      refetch();
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [deployment?.status, id, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-full">
        <PageHeader title="Loading..." subtitle="" />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <p className="text-gray-500">Loading deployment details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="min-h-full">
        <PageHeader title="Deployment Not Found" subtitle="" />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <XCircleIcon className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Deployment not found</h3>
            <p className="mt-1 text-sm text-gray-500">
              The deployment you're looking for doesn't exist or has been deleted.
            </p>
            <div className="mt-6">
              <Link to="/deployments" className="btn-primary">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Deployments
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentProgress = realtimeProgress?.percentage || deployment.progress;

  return (
    <div className="min-h-full">
      <PageHeader
        title={`Deployment: ${deployment.clientName}`}
        subtitle={`Status: ${deployment.status.replace('_', ' ')} • ${deployment.configuration.totalProperties} properties`}
      >
        <div className="flex items-center space-x-3">
          <Link to="/deployments" className="btn-secondary flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to List
          </Link>
          {deployment.availableActions.map((action) => (
            <ActionButton key={action.action} action={action} deploymentId={id} />
          ))}
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Status Overview */}
        <div className="mb-8">
          <StatusOverview deployment={deployment} currentProgress={currentProgress} />
        </div>

        {/* Configuration Summary */}
        <div className="mb-8">
          <ConfigurationSummary configuration={deployment.configuration} />
        </div>

        {/* Real-time Progress (only for in-progress deployments) */}
        {deployment.status === 'in_progress' && realtimeProgress && (
          <div className="mb-8">
            <RealtimeProgress progress={realtimeProgress} />
          </div>
        )}

        {/* Execution Results */}
        <div className="mb-8">
          <ExecutionResults execution={deployment.execution} results={deployment.results} />
        </div>

        {/* Deployment Logs */}
        <div className="mb-8">
          <DeploymentLogs logs={deployment.logs} />
        </div>
      </div>
    </div>
  );
}

function StatusOverview({ deployment, currentProgress }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-8 w-8 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-8 w-8 text-red-500" />;
      case 'in_progress':
        return <ClockIcon className="h-8 w-8 text-yellow-500 animate-spin" />;
      default:
        return <ClockIcon className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'in_progress': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          {getStatusIcon(deployment.status)}
          <div className="ml-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {deployment.clientName}
            </h2>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(deployment.status)}`}>
              {deployment.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Progress</div>
          <div className="text-2xl font-bold text-gray-900">{currentProgress}%</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Deployment Progress</span>
          <span>{currentProgress}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              deployment.status === 'completed' ? 'bg-green-500' :
              deployment.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${currentProgress}%` }}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{deployment.configuration.totalProperties}</div>
          <div className="text-sm text-gray-500">Properties</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{deployment.configuration.totalGroups}</div>
          <div className="text-sm text-gray-500">Groups</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{deployment.duration || '—'}</div>
          <div className="text-sm text-gray-500">Duration</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{deployment.execution.errors}</div>
          <div className="text-sm text-gray-500">Errors</div>
        </div>
      </div>

      {/* Error Message */}
      {deployment.errorMessage && (
        <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-sm font-medium text-red-800">Error:</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{deployment.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

function ConfigurationSummary({ configuration }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration Summary</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Object Types</h4>
          <div className="space-y-2">
            {configuration.objectTypes.map(type => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">{type}</span>
                <span className="text-sm font-medium">{configuration.propertiesByType[type]} properties</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Property Groups</h4>
          <div className="space-y-2">
            {configuration.propertyGroups.map(group => (
              <div key={group.name} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{group.displayName}</span>
                <span className="text-sm font-medium">{group.propertyCount} properties</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RealtimeProgress({ progress }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center mb-2">
        <ClockIcon className="h-5 w-5 text-blue-600 mr-2 animate-spin" />
        <h3 className="font-medium text-blue-900">Live Progress Update</h3>
      </div>
      <p className="text-sm text-blue-800">{progress.message}</p>
      {progress.step && (
        <p className="text-xs text-blue-600 mt-1">Current step: {progress.step}</p>
      )}
    </div>
  );
}

function ExecutionResults({ execution, results }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Execution Results</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{execution.createdProperties}</div>
          <div className="text-sm text-green-800">Properties Created</div>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{execution.createdGroups}</div>
          <div className="text-sm text-blue-800">Groups Created</div>
        </div>
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{execution.errors}</div>
          <div className="text-sm text-red-800">Errors</div>
        </div>
      </div>

      {/* Created Properties */}
      {results.createdProperties.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Created Properties</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {results.createdProperties.map((property, index) => (
              <div key={property.name || index} className="text-sm text-gray-600 flex justify-between">
                <span>{property.name}</span>
                <span className="text-gray-400">{property.objectType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {results.errors.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Errors</h4>
          <div className="space-y-2">
            {results.errors.map((error, index) => (
              <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-sm font-medium text-red-800">{error.step}</div>
                <div className="text-sm text-red-700">{error.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeploymentLogs({ logs }) {
  const [expandedLogs, setExpandedLogs] = useState(false);
  const displayLogs = expandedLogs ? logs : logs.slice(0, 10);

  const getLogIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Deployment Logs</h3>
        {logs.length > 10 && (
          <button
            onClick={() => setExpandedLogs(!expandedLogs)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {expandedLogs ? 'Show Less' : `Show All ${logs.length} Logs`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {displayLogs.map((log) => (
          <div key={log.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-md">
            <div className="flex-shrink-0 mt-0.5">
              {getLogIcon(log.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{log.message}</p>
                <time className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </time>
              </div>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  {Object.entries(log.metadata).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionButton({ action, deploymentId }) {
  const getButtonStyle = (actionType) => {
    switch (actionType) {
      case 'retry':
        return 'btn-primary';
      case 'rollback':
        return 'btn-secondary';
      default:
        return 'btn-secondary';
    }
  };

  const getIcon = (actionType) => {
    switch (actionType) {
      case 'retry':
        return <ArrowPathIcon className="h-4 w-4 mr-2" />;
      case 'rollback':
        return <ArrowLeftIcon className="h-4 w-4 mr-2" />;
      case 'view_hubspot':
        return <EyeIcon className="h-4 w-4 mr-2" />;
      default:
        return <PlayIcon className="h-4 w-4 mr-2" />;
    }
  };

  const handleAction = () => {
    // TODO: Implement action handlers
    console.log(`Action ${action.action} for deployment ${deploymentId}`);
  };

  return (
    <button
      onClick={handleAction}
      className={`${getButtonStyle(action.action)} flex items-center`}
      title={action.description}
    >
      {getIcon(action.action)}
      {action.label}
    </button>
  );
}

export default DeploymentDetail;