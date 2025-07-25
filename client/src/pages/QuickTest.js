import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { PlusIcon, TrashIcon, PlayIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/Common/PageHeader';
import HelpCard from '../components/Common/HelpCard';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { deploymentAPI } from '../services/api';
import { useApp } from '../context/AppContext';

const FIELD_TYPES = [
  { value: 'string', label: 'Text Field', description: 'Single line text input' },
  { value: 'enumeration', label: 'Dropdown', description: 'Select from predefined options' },
  { value: 'number', label: 'Number', description: 'Numeric input field' },
  { value: 'bool', label: 'Yes/No', description: 'True/false checkbox' },
  { value: 'date', label: 'Date', description: 'Date picker field' },
];

const OBJECT_TYPES = [
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
  { value: 'deal', label: 'Deal' },
];

function QuickTest() {
  const { setError, setSuccess } = useApp();
  const [fields, setFields] = useState([
    {
      id: 1,
      name: '',
      label: '',
      type: 'string',
      objectType: 'contact',
      description: '',
      options: ''
    }
  ]);

  const deployMutation = useMutation(deploymentAPI.create, {
    onSuccess: (response) => {
      setSuccess(`Deployment started successfully! ID: ${response.data.deploymentId}`);
    },
    onError: (error) => {
      setError(`Deployment failed: ${error.message}`);
    },
  });

  const addField = () => {
    setFields([...fields, {
      id: Date.now(),
      name: '',
      label: '',
      type: 'string',
      objectType: 'contact',
      description: '',
      options: ''
    }]);
  };

  const removeField = (id) => {
    setFields(fields.filter(field => field.id !== id));
  };

  const updateField = (id, updates) => {
    setFields(fields.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  const handleDeploy = () => {
    // Validate fields
    const errors = [];
    fields.forEach((field, index) => {
      if (!field.name.trim()) errors.push(`Field ${index + 1}: Name is required`);
      if (!field.label.trim()) errors.push(`Field ${index + 1}: Label is required`);
      if (field.type === 'enumeration' && !field.options.trim()) {
        errors.push(`Field ${index + 1}: Dropdown options are required`);
      }
    });

    if (errors.length > 0) {
      setError(`Please fix these errors:\n${errors.join('\n')}`);
      return;
    }

    // Convert fields to HubSpot configuration format
    const properties = {};
    
    fields.forEach(field => {
      if (!properties[field.objectType]) {
        properties[field.objectType] = [];
      }

      const property = {
        name: field.name,
        label: field.label,
        type: field.type,
        fieldType: getFieldType(field.type),
        description: field.description || `Custom ${field.label} field`,
        groupName: 'custom_fields',
        options: field.type === 'enumeration' ? field.options.split(',').map(opt => opt.trim()) : undefined,
        required: false,
        unique: false
      };

      properties[field.objectType].push(property);
    });

    // Add a default property group
    const propertyGroups = [{
      name: 'custom_fields',
      displayName: 'Custom Fields',
      displayOrder: 1,
      description: 'Custom fields created via quick test'
    }];

    const config = {
      properties,
      propertyGroups
    };

    deployMutation.mutate({
      clientName: `Quick Test - ${new Date().toLocaleString()}`,
      config
    });
  };

  const getFieldType = (type) => {
    const mapping = {
      string: 'text',
      enumeration: 'select',
      number: 'number',
      bool: 'booleancheckbox',
      date: 'date'
    };
    return mapping[type] || 'text';
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Quick Field Test"
        subtitle="Quickly create and deploy a few test fields to HubSpot"
      />

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <HelpCard type="info" title="Simple Field Testing">
            <p className="text-sm mb-3">
              This is a simplified interface to quickly test field creation. Add a few fields below and click "Deploy to HubSpot" to test the basic functionality.
            </p>
            <div className="text-xs text-gray-600">
              <strong>What this will do:</strong> Create custom properties in your HubSpot account with a "Custom Fields" property group.
            </div>
          </HelpCard>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Test Fields</h3>
            <button
              onClick={addField}
              className="btn-secondary flex items-center"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Field
            </button>
          </div>

          <div className="space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-sm font-medium text-gray-900">Field {index + 1}</h4>
                  {fields.length > 1 && (
                    <button
                      onClick={() => removeField(field.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Name (API name) *
                    </label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(field.id, { name: e.target.value })}
                      placeholder="e.g., custom_lead_source"
                      className="input-field"
                    />
                    <p className="text-xs text-gray-500 mt-1">No spaces, use underscores</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Label (Display name) *
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="e.g., Lead Source"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Type
                    </label>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value })}
                      className="input-field"
                    >
                      {FIELD_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Object Type
                    </label>
                    <select
                      value={field.objectType}
                      onChange={(e) => updateField(field.id, { objectType: e.target.value })}
                      className="input-field"
                    >
                      {OBJECT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={field.description}
                      onChange={(e) => updateField(field.id, { description: e.target.value })}
                      placeholder="Brief description of this field"
                      className="input-field"
                    />
                  </div>

                  {field.type === 'enumeration' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dropdown Options *
                      </label>
                      <input
                        type="text"
                        value={field.options}
                        onChange={(e) => updateField(field.id, { options: e.target.value })}
                        placeholder="Option 1, Option 2, Option 3"
                        className="input-field"
                      />
                      <p className="text-xs text-gray-500 mt-1">Separate options with commas</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleDeploy}
              disabled={deployMutation.isLoading}
              className="btn-primary flex items-center"
            >
              {deployMutation.isLoading ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  Deploying...
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Deploy to HubSpot
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickTest;