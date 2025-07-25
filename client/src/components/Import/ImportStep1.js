import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from 'react-query';
import { 
  CloudArrowUpIcon, 
  DocumentTextIcon, 
  TableCellsIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { importAPI } from '../../services/api';
import { useApp } from '../../context/AppContext';
import LoadingSpinner from '../Common/LoadingSpinner';
import HelpCard from '../Common/HelpCard';
import { InfoTooltip } from '../Common/Tooltip';

const CONFIG_TYPES = [
  { value: 'custom-properties', label: 'Custom Properties', description: 'Create custom fields for HubSpot objects' },
  { value: 'property-groups', label: 'Property Groups', description: 'Organize properties into logical groups' },
  { value: 'deal-pipelines', label: 'Deal Pipelines', description: 'Configure sales process stages' },
  { value: 'ticket-pipelines', label: 'Ticket Pipelines', description: 'Set up customer support workflows' },
  { value: 'products', label: 'Products', description: 'Configure product catalog' },
];

function ImportStep1({ onComplete, data }) {
  const { setError } = useApp();
  const [configType, setConfigType] = useState(data.configType || 'custom-properties');
  const [importMethod, setImportMethod] = useState('upload'); // 'upload' or 'paste'
  const [csvData, setCsvData] = useState('');
  const [pasteData, setPasteData] = useState('');

  // CSV parsing mutation
  const csvMutation = useMutation(importAPI.parseCSV, {
    onSuccess: (response) => {
      onComplete({
        ...response.data,
        configType,
        importMethod: 'csv'
      });
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Excel paste parsing mutation
  const pasteMutation = useMutation(importAPI.parseExcelPaste, {
    onSuccess: (response) => {
      onComplete({
        ...response.data,
        configType,
        importMethod: 'paste'
      });
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCsvData(e.target.result);
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    multiple: false
  });

  const handleCsvUpload = () => {
    if (!csvData) {
      setError('Please select a CSV file first');
      return;
    }

    csvMutation.mutate({
      csvData,
      configType,
      delimiter: detectDelimiter(csvData)
    });
  };

  const handlePasteData = () => {
    if (!pasteData.trim()) {
      setError('Please paste some data first');
      return;
    }

    pasteMutation.mutate({
      pastedData: pasteData,
      configType
    });
  };

  const detectDelimiter = (data) => {
    const firstLine = data.split('\n')[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (tabCount > 0) return '\t';
    if (semicolonCount > commaCount) return ';';
    return ',';
  };

  // Template download functionality
  const handleDownloadTemplate = async (templateType) => {
    try {
      const response = await importAPI.downloadTemplate(templateType);
      
      // Create blob and download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${templateType}-template.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError(`Failed to download template: ${error.message}`);
    }
  };

  const isLoading = csvMutation.isLoading || pasteMutation.isLoading;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Import Configuration
        </h3>
        <p className="text-sm text-gray-600">
          Upload CSV files with HubSpot configuration data to set up custom properties, pipelines, and more. Download example templates below to get started.
        </p>
      </div>

      {/* Download Templates Section */}
      <div className="mb-6">
        <HelpCard type="tip" title="Download CSV Templates">
          <p className="text-sm mb-4">
            Download example CSV templates to see the correct format for each configuration type:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CONFIG_TYPES.map((config) => (
              <button
                key={config.value}
                onClick={() => handleDownloadTemplate(config.value)}
                className="text-left p-3 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">{config.label}</div>
                <div className="text-xs text-gray-600 mt-1">{config.description}</div>
                <div className="text-xs text-primary-600 mt-2 font-medium">Download Template</div>
              </button>
            ))}
          </div>
        </HelpCard>
      </div>

      {/* Step 1 Help Card */}
      <div className="mb-6">
        <HelpCard type="info" title="Step 1: Choose Configuration Type">
          <div className="space-y-3">
            <p>Select what type of HubSpot configuration you're importing, then upload your CSV file:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <strong>Configuration Types:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Custom Properties - Create custom fields</li>
                  <li>• Property Groups - Organize field sections</li>
                  <li>• Deal Pipelines - Sales process stages</li>
                  <li>• Ticket Pipelines - Support workflows</li>
                  <li>• Products - Product catalog setup</li>
                </ul>
              </div>
              <div>
                <strong>Upload Options:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• CSV files with headers required</li>
                  <li>• Download templates for correct format</li>
                  <li>• Supports .csv, .xls, .xlsx files</li>
                  <li>• Can paste data from Excel/Sheets</li>
                </ul>
              </div>
            </div>
          </div>
        </HelpCard>
      </div>

      {/* Configuration Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
          What type of configuration are you importing?
          <InfoTooltip 
            content="Choose the configuration type that matches your CSV file. Download templates above to see the required format." 
            className="ml-2"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONFIG_TYPES.map((type) => (
            <label
              key={type.value}
              className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                configType === type.value
                  ? 'border-primary-500 ring-2 ring-primary-500'
                  : 'border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="configType"
                value={type.value}
                checked={configType === type.value}
                onChange={(e) => setConfigType(e.target.value)}
                className="sr-only"
              />
              <div className="flex flex-1">
                <div className="flex flex-col">
                  <span className="block text-sm font-medium text-gray-900">
                    {type.label}
                  </span>
                  <span className="block text-sm text-gray-500">
                    {type.description}
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Import Method Selection */}
      <div className="mb-6">
        <div className="flex space-x-4 mb-4">
          <button
            type="button"
            onClick={() => setImportMethod('upload')}
            className={`flex-1 flex items-center justify-center px-4 py-2 border rounded-md text-sm font-medium ${
              importMethod === 'upload'
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <CloudArrowUpIcon className="h-5 w-5 mr-2" />
            Upload Configuration CSV
          </button>
          <button
            type="button"
            onClick={() => setImportMethod('paste')}
            className={`flex-1 flex items-center justify-center px-4 py-2 border rounded-md text-sm font-medium ${
              importMethod === 'paste'
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <TableCellsIcon className="h-5 w-5 mr-2" />
            Paste Configuration Data
          </button>
        </div>

        {/* CSV Upload */}
        {importMethod === 'upload' && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary-500 bg-primary-50'
                  : isDragReject
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-2">
                <p className="text-sm text-gray-600">
                  {isDragActive
                    ? 'Drop the configuration file here...'
                    : isDragReject
                    ? 'Please drop a valid CSV file'
                    : 'Drag and drop a configuration CSV file here, or click to select'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports .csv, .xls, .xlsx files up to 10MB
                </p>
              </div>
            </div>

            {csvData && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-center">
                  <DocumentTextIcon className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-sm text-green-800">
                    Configuration file loaded ({Math.round(csvData.length / 1024)}KB)
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleCsvUpload}
              disabled={!csvData || isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  Parsing CSV...
                </>
              ) : (
                'Parse Configuration Data'
              )}
            </button>
          </div>
        )}

        {/* Excel Paste */}
        {importMethod === 'paste' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste your configuration data here
              </label>
              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="Copy configuration data from Excel/Sheets and paste here..."
                rows={8}
                className="input-field resize-none font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Copy and paste configuration data from Excel/Google Sheets. Include column headers in the first row.
              </p>
            </div>

            <button
              onClick={handlePasteData}
              disabled={!pasteData.trim() || isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  Parsing Data...
                </>
              ) : (
                'Parse Pasted Data'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">Configuration Format Tips</h4>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Download templates above to see the required column format</li>
                <li>Include all required headers in the first row</li>
                <li>Use exact field names as shown in templates</li>
                <li>For dropdown options, separate values with commas</li>
                <li>Boolean fields should use "true" or "false"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportStep1;