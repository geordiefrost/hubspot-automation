import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  PencilIcon,
  EyeIcon,
  ChevronDownIcon,
  ChevronRightIcon 
} from '@heroicons/react/24/outline';
import { importAPI } from '../../services/api';
import { useApp } from '../../context/AppContext';
import LoadingSpinner from '../Common/LoadingSpinner';

const HUBSPOT_TYPES = [
  { value: 'string', label: 'Text', fieldTypes: ['text', 'textarea'] },
  { value: 'number', label: 'Number', fieldTypes: ['number'] },
  { value: 'date', label: 'Date', fieldTypes: ['date'] },
  { value: 'datetime', label: 'Date & Time', fieldTypes: ['date'] },
  { value: 'enumeration', label: 'Dropdown', fieldTypes: ['select', 'radio', 'checkbox'] },
  { value: 'bool', label: 'Yes/No', fieldTypes: ['booleancheckbox'] },
  { value: 'phone_number', label: 'Phone', fieldTypes: ['phonenumber'] },
];

function ImportStep3({ onComplete, onBack, data }) {
  const { setError, showSuccess } = useApp();
  const [mappings, setMappings] = useState(data.mappings || []);
  const [editingMapping, setEditingMapping] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Validation mutation
  const validationMutation = useMutation(importAPI.validateMappings, {
    onSuccess: (response) => {
      if (response.data.isValid) {
        // Generate configuration
        previewMutation.mutate({
          mappings: mappings,
          objectType: data.objectType
        });
      } else {
        setError('Please fix the validation errors before continuing');
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Preview configuration mutation
  const previewMutation = useMutation(importAPI.previewConfiguration, {
    onSuccess: (response) => {
      onComplete({
        mappings: mappings,
        configuration: response.data.configuration,
        estimatedTime: response.data.estimatedDeploymentTime
      });
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleMappingChange = (index, field, value) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const handleTypeChange = (index, newType) => {
    const newMappings = [...mappings];
    const hubspotType = HUBSPOT_TYPES.find(t => t.value === newType);
    
    newMappings[index] = {
      ...newMappings[index],
      detectedType: {
        ...newMappings[index].detectedType,
        hubspotType: newType,
        fieldType: hubspotType?.fieldTypes[0] || 'text'
      }
    };

    // Clear enum options if not enumeration
    if (newType !== 'enumeration') {
      newMappings[index].enumOptions = [];
    }

    setMappings(newMappings);
  };

  const handleContinue = () => {
    validationMutation.mutate({
      mappings: mappings,
      objectType: data.objectType
    });
  };

  const toggleRowExpansion = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  const isLoading = validationMutation.isLoading || previewMutation.isLoading;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Review Property Mappings
        </h3>
        <p className="text-sm text-gray-600">
          Review and adjust the suggested property mappings. Fields with high confidence are ready to use, while others may need your review.
        </p>
      </div>

      {/* Summary Stats */}
      {data.analysisSummary && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-sm font-medium text-green-800">High Confidence</div>
            <div className="text-xl font-bold text-green-900">{data.analysisSummary.highConfidence}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="text-sm font-medium text-yellow-800">Medium Confidence</div>
            <div className="text-xl font-bold text-yellow-900">{data.analysisSummary.mediumConfidence}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-sm font-medium text-red-800">Low Confidence</div>
            <div className="text-xl font-bold text-red-900">{data.analysisSummary.lowConfidence}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm font-medium text-blue-800">Total Fields</div>
            <div className="text-xl font-bold text-blue-900">{data.analysisSummary.total}</div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.analysisRecommendations && data.analysisRecommendations.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Recommendations</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            {data.analysisRecommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <span className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full mr-2 mt-1.5"></span>
                {rec.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mappings Table */}
      <div className="mb-6">
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source Field
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  HubSpot Property
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mappings.map((mapping, index) => (
                <React.Fragment key={index}>
                  <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRowExpansion(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {expandedRows.has(index) ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {mapping.sourceField}
                      {mapping.isReserved && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Reserved
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <input
                        type="text"
                        value={mapping.suggestedName}
                        onChange={(e) => handleMappingChange(index, 'suggestedName', e.target.value)}
                        className="block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <select
                        value={mapping.detectedType?.hubspotType || 'string'}
                        onChange={(e) => handleTypeChange(index, e.target.value)}
                        className="block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
                      >
                        {HUBSPOT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(mapping.confidence)}`}>
                        {getConfidenceLabel(mapping.confidence)} ({Math.round(mapping.confidence * 100)}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <button
                        onClick={() => setEditingMapping(index)}
                        className="text-primary-600 hover:text-primary-500 mr-3"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleRowExpansion(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Row Details */}
                  {expandedRows.has(index) && (
                    <tr className="bg-gray-50">
                      <td colSpan="6" className="px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Sample Values</h5>
                            <div className="bg-white border rounded p-2 max-h-24 overflow-y-auto">
                              {mapping.sampleValues.length > 0 ? (
                                <ul className="text-xs text-gray-600 space-y-1">
                                  {mapping.sampleValues.slice(0, 5).map((value, i) => (
                                    <li key={i} className="truncate">{value}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-gray-400">No sample values</span>
                              )}
                            </div>
                          </div>
                          
                          {mapping.detectedType?.hubspotType === 'enumeration' && mapping.enumOptions.length > 0 && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Dropdown Options</h5>
                              <div className="bg-white border rounded p-2 max-h-24 overflow-y-auto">
                                <ul className="text-xs text-gray-600 space-y-1">
                                  {mapping.enumOptions.slice(0, 10).map((option, i) => (
                                    <li key={i} className="flex justify-between">
                                      <span>{option.label}</span>
                                      <span className="text-gray-400">{option.value}</span>
                                    </li>
                                  ))}
                                  {mapping.enumOptions.length > 10 && (
                                    <li className="text-gray-400">
                                      +{mapping.enumOptions.length - 10} more options
                                    </li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          )}
                          
                          <div className="md:col-span-2">
                            <h5 className="font-medium text-gray-900 mb-2">Property Details</h5>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-gray-500">Label:</span>
                                <input
                                  type="text"
                                  value={mapping.suggestedLabel}
                                  onChange={(e) => handleMappingChange(index, 'suggestedLabel', e.target.value)}
                                  className="ml-2 border-gray-300 rounded text-xs"
                                />
                              </div>
                              <div>
                                <span className="text-gray-500">Group:</span>
                                <span className="ml-2 text-gray-900">{mapping.groupName || 'Default'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Validation Errors */}
      {validationMutation.data && !validationMutation.data.data.isValid && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Validation Errors</h4>
              <ul className="mt-2 text-sm text-red-700 space-y-1">
                {validationMutation.data.data.errors.map((error, index) => (
                  <li key={index}>• {error.message || error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={isLoading}
          className="btn-primary"
        >
          {isLoading ? (
            <>
              <LoadingSpinner className="mr-2" />
              Validating...
            </>
          ) : (
            'Continue to Preview'
          )}
        </button>
      </div>
    </div>
  );
}

export default ImportStep3;