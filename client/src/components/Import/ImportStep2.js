import React from 'react';
import { useMutation } from 'react-query';
import { ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { importAPI } from '../../services/api';
import { useApp } from '../../context/AppContext';
import LoadingSpinner from '../Common/LoadingSpinner';

function ImportStep2({ onComplete, onBack, data }) {
  const { setError } = useApp();

  // Field analysis mutation
  const analysisMutation = useMutation(importAPI.analyseFields, {
    onSuccess: (response) => {
      onComplete({
        mappings: response.data.mappings,
        analysisRecommendations: response.data.recommendations,
        analysisSummary: response.data.summary
      });
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleAnalyze = () => {
    analysisMutation.mutate({
      headers: data.headers,
      sampleData: data.sampleData,
      objectType: data.objectType
    });
  };

  React.useEffect(() => {
    // Auto-analyze when component mounts
    if (data.headers.length > 0 && !analysisMutation.isLoading) {
      handleAnalyze();
    }
  }, [data.headers.length, analysisMutation.isLoading, handleAnalyze]);

  const isLoading = analysisMutation.isLoading;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Analyze Your Data
        </h3>
        <p className="text-sm text-gray-600">
          We're analyzing your {data.totalRows} rows of {data.objectType} data to suggest the best HubSpot property mappings.
        </p>
      </div>

      {/* Data Overview */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center">
            <ChartBarIcon className="h-5 w-5 text-gray-600 mr-2" />
            <span className="text-sm font-medium text-gray-900">Fields Found</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.headers.length}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center">
            <ChartBarIcon className="h-5 w-5 text-gray-600 mr-2" />
            <span className="text-sm font-medium text-gray-900">Sample Rows</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.sampleData.length}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center">
            <ChartBarIcon className="h-5 w-5 text-gray-600 mr-2" />
            <span className="text-sm font-medium text-gray-900">Total Rows</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalRows}</p>
        </div>
      </div>

      {/* Sample Data Preview */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Data Preview</h4>
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {data.headers.map((header, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.sampleData.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {data.headers.map((header, colIndex) => (
                      <td
                        key={colIndex}
                        className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap max-w-xs truncate"
                        title={row[header] || ''}
                      >
                        {row[header] || <span className="text-gray-400">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {data.sampleData.length > 5 && (
          <p className="text-xs text-gray-500 mt-2">
            Showing first 5 rows of {data.sampleData.length} sample rows
          </p>
        )}
      </div>

      {/* Analysis Status */}
      {isLoading ? (
        <div className="text-center py-8">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Analyzing Your Data</h4>
          <p className="text-sm text-gray-600">
            Our AI is examining your field names and sample data to suggest optimal HubSpot property mappings...
          </p>
          <div className="mt-4 max-w-md mx-auto">
            <div className="bg-gray-200 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full animate-pulse" style={{ width: '65%' }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Analyzing field patterns and data types...
            </p>
          </div>
        </div>
      ) : analysisMutation.error ? (
        <div className="text-center py-8">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Analysis Failed</h4>
          <p className="text-sm text-gray-600 mb-4">
            We encountered an error while analyzing your data. Please try again.
          </p>
          <div className="flex justify-center space-x-3">
            <button onClick={onBack} className="btn-secondary">
              Go Back
            </button>
            <button onClick={handleAnalyze} className="btn-primary">
              Retry Analysis
            </button>
          </div>
        </div>
      ) : null}

      {/* Navigation */}
      {!isLoading && !analysisMutation.error && (
        <div className="flex justify-between">
          <button onClick={onBack} className="btn-secondary">
            Back
          </button>
          <div className="text-sm text-gray-500">
            Analysis will continue automatically...
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportStep2;