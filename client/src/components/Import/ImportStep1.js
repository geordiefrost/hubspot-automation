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

const OBJECT_TYPES = [
  { value: 'contact', label: 'Contacts', description: 'People in your CRM' },
  { value: 'company', label: 'Companies', description: 'Organizations and businesses' },
  { value: 'deal', label: 'Deals', description: 'Sales opportunities' },
];

function ImportStep1({ onComplete, data }) {
  const { setError } = useApp();
  const [objectType, setObjectType] = useState(data.objectType || 'contact');
  const [importMethod, setImportMethod] = useState('upload'); // 'upload' or 'paste'
  const [csvData, setCsvData] = useState('');
  const [pasteData, setPasteData] = useState('');

  // CSV parsing mutation
  const csvMutation = useMutation(importAPI.parseCSV, {
    onSuccess: (response) => {
      onComplete({
        ...response.data,
        objectType,
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
        objectType,
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
      objectType,
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
      objectType
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

  const isLoading = csvMutation.isLoading || pasteMutation.isLoading;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Import Your Data
        </h3>
        <p className="text-sm text-gray-600">
          Upload a CSV file or paste data from Excel to get started. We'll analyze your data and suggest the best HubSpot property mappings.
        </p>
      </div>

      {/* Step 1 Help Card */}
      <div className="mb-6">
        <HelpCard type="info" title="Step 1: Choose Your Data">
          <div className="space-y-3">
            <p>Select what type of HubSpot records you're importing, then choose how to provide your data:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <strong>CSV Upload:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Best for large datasets (1000+ records)</li>
                  <li>• Supports .csv, .xls, .xlsx files</li>
                  <li>• Handles special characters properly</li>
                </ul>
              </div>
              <div>
                <strong>Excel Paste:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Quick for small datasets (&lt;500 records)</li>
                  <li>• Copy directly from Excel/Google Sheets</li>
                  <li>• Perfect for testing with sample data</li>
                </ul>
              </div>
            </div>
          </div>
        </HelpCard>
      </div>

      {/* Object Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What type of data are you importing?
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OBJECT_TYPES.map((type) => (
            <label
              key={type.value}
              className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                objectType === type.value
                  ? 'border-primary-500 ring-2 ring-primary-500'
                  : 'border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="objectType"
                value={type.value}
                checked={objectType === type.value}
                onChange={(e) => setObjectType(e.target.value)}
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
            Upload CSV File
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
            Paste Excel Data
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
                    ? 'Drop the CSV file here...'
                    : isDragReject
                    ? 'Please drop a valid CSV file'
                    : 'Drag and drop a CSV file here, or click to select'}
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
                    CSV file loaded ({Math.round(csvData.length / 1024)}KB)
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
                'Parse CSV Data'
              )}
            </button>
          </div>
        )}

        {/* Excel Paste */}
        {importMethod === 'paste' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste your Excel data here
              </label>
              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="Copy cells from Excel and paste here..."
                rows={8}
                className="input-field resize-none font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Copy and paste directly from Excel (Ctrl+C, then Ctrl+V). Include headers in the first row.
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
            <h4 className="text-sm font-medium text-blue-800">Data Format Tips</h4>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Include column headers in the first row</li>
                <li>Use descriptive field names (e.g., "First Name", "Email Address")</li>
                <li>Include sample data to help with field type detection</li>
                <li>For dropdown fields, use consistent values</li>
                <li>Date fields should use standard formats (YYYY-MM-DD)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportStep1;