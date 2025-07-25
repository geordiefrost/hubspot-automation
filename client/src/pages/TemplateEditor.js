import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import {
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  EyeIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { templateAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/Common/PageHeader';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import HelpCard from '../components/Common/HelpCard';

const PROPERTY_TYPES = [
  { value: 'string', label: 'Text', fieldTypes: ['text', 'textarea'] },
  { value: 'number', label: 'Number', fieldTypes: ['number'] },
  { value: 'date', label: 'Date', fieldTypes: ['date'] },
  { value: 'datetime', label: 'Date & Time', fieldTypes: ['date'] },
  { value: 'enumeration', label: 'Dropdown', fieldTypes: ['select', 'radio', 'checkbox'] },
  { value: 'bool', label: 'Yes/No', fieldTypes: ['booleancheckbox'] },
  { value: 'phone_number', label: 'Phone', fieldTypes: ['phonenumber'] },
];

const OBJECT_TYPES = [
  { value: 'contact', label: 'Contacts', description: 'People in your CRM' },
  { value: 'company', label: 'Companies', description: 'Organizations and businesses' },
  { value: 'deal', label: 'Deals', description: 'Sales opportunities' },
];

const PROPERTY_GROUPS = [
  'Contact Information',
  'Company Information', 
  'Financial Information',
  'Important Dates',
  'Custom Properties'
];

function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, setError } = useApp();
  const isEditing = Boolean(id && id !== 'new');

  // Template state
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    industry: '',
    isActive: true,
    config: {
      properties: {
        contact: [],
        company: [],
        deal: []
      },
      propertyGroups: [],
      pipelines: {},
      lifecycleStages: {}
    }
  });

  const [activeTab, setActiveTab] = useState('basic');
  const [selectedObjectType, setSelectedObjectType] = useState('contact');
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);

  // Load existing template if editing
  const { data: templateData, isLoading } = useQuery(
    ['template', id],
    () => templateAPI.getById(id),
    {
      enabled: isEditing,
      onSuccess: (data) => {
        if (data?.data) {
          setTemplate(data.data);
        }
      }
    }
  );

  // Save template mutation
  const saveTemplateMutation = useMutation(
    (templateData) => isEditing 
      ? templateAPI.update(id, templateData)
      : templateAPI.create(templateData),
    {
      onSuccess: () => {
        showSuccess(`Template ${isEditing ? 'updated' : 'created'} successfully`);
        navigate('/templates');
      },
      onError: (error) => {
        setError(error.message || `Failed to ${isEditing ? 'update' : 'create'} template`);
      }
    }
  );

  const handleSave = () => {
    if (!template.name.trim()) {
      setError('Template name is required');
      return;
    }

    // Validate that we have at least one property
    const totalProperties = Object.values(template.config.properties).reduce(
      (sum, props) => sum + props.length, 0
    );

    if (totalProperties === 0) {
      setError('Template must have at least one property');
      return;
    }

    saveTemplateMutation.mutate(template);
  };

  const addProperty = (propertyData) => {
    const newProperty = {
      id: Date.now().toString(),
      name: propertyData.name,
      label: propertyData.label,
      type: propertyData.type,
      fieldType: propertyData.fieldType,
      groupName: propertyData.groupName || 'Custom Properties',
      description: propertyData.description || '',
      hasUniqueValue: propertyData.hasUniqueValue || false,
      hidden: propertyData.hidden || false,
      displayOrder: template.config.properties[selectedObjectType].length,
      formField: true,
      options: propertyData.options || []
    };

    setTemplate(prev => ({
      ...prev,
      config: {
        ...prev.config,
        properties: {
          ...prev.config.properties,
          [selectedObjectType]: [...prev.config.properties[selectedObjectType], newProperty]
        }
      }
    }));

    setShowPropertyForm(false);
    setEditingProperty(null);
  };

  const updateProperty = (propertyId, updates) => {
    setTemplate(prev => ({
      ...prev,
      config: {
        ...prev.config,
        properties: {
          ...prev.config.properties,
          [selectedObjectType]: prev.config.properties[selectedObjectType].map(prop =>
            prop.id === propertyId ? { ...prop, ...updates } : prop
          )
        }
      }
    }));
  };

  const deleteProperty = (propertyId) => {
    setTemplate(prev => ({
      ...prev,
      config: {
        ...prev.config,
        properties: {
          ...prev.config.properties,
          [selectedObjectType]: prev.config.properties[selectedObjectType].filter(
            prop => prop.id !== propertyId
          )
        }
      }
    }));
  };

  const moveProperty = (propertyId, direction) => {
    const properties = template.config.properties[selectedObjectType];
    const currentIndex = properties.findIndex(prop => prop.id === propertyId);
    
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === properties.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newProperties = [...properties];
    [newProperties[currentIndex], newProperties[newIndex]] = [newProperties[newIndex], newProperties[currentIndex]];

    setTemplate(prev => ({
      ...prev,
      config: {
        ...prev.config,
        properties: {
          ...prev.config.properties,
          [selectedObjectType]: newProperties
        }
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-full">
        <PageHeader title="Loading..." subtitle="" />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <p className="text-gray-500">Loading template...</p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: DocumentDuplicateIcon },
    { id: 'properties', label: 'Properties', icon: Cog6ToothIcon },
    { id: 'preview', label: 'Preview', icon: EyeIcon }
  ];

  return (
    <div className="min-h-full">
      <PageHeader
        title={isEditing ? `Edit Template: ${template.name}` : 'Create New Template'}
        subtitle={isEditing ? 'Modify template configuration' : 'Build a reusable HubSpot setup template'}
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/templates')}
            className="btn-secondary flex items-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Templates
          </button>
          <button
            onClick={handleSave}
            disabled={saveTemplateMutation.isLoading}
            className="btn-primary flex items-center"
          >
            {saveTemplateMutation.isLoading ? (
              <>
                <LoadingSpinner className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Template' : 'Create Template'}
              </>
            )}
          </button>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Help Section */}
        <div className="mb-6">
          <HelpCard type="info" title="Template Editor Guide">
            <div className="space-y-3">
              <p>Create reusable HubSpot configurations that can be applied to multiple client accounts:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <strong>Basic Info:</strong>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Set template name and description</li>
                    <li>• Choose target industry</li>
                    <li>• Configure template settings</li>
                  </ul>
                </div>
                <div>
                  <strong>Properties:</strong>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Add custom HubSpot properties</li>
                    <li>• Configure field types and options</li>
                    <li>• Organize into property groups</li>
                  </ul>
                </div>
                <div>
                  <strong>Preview:</strong>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Review complete configuration</li>
                    <li>• See deployment summary</li>
                    <li>• Test template before saving</li>
                  </ul>
                </div>
              </div>
            </div>
          </HelpCard>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {activeTab === 'basic' && (
            <BasicInfoTab template={template} setTemplate={setTemplate} />
          )}
          
          {activeTab === 'properties' && (
            <PropertiesTab
              template={template}
              selectedObjectType={selectedObjectType}
              setSelectedObjectType={setSelectedObjectType}
              showPropertyForm={showPropertyForm}
              setShowPropertyForm={setShowPropertyForm}
              editingProperty={editingProperty}
              setEditingProperty={setEditingProperty}
              addProperty={addProperty}
              updateProperty={updateProperty}
              deleteProperty={deleteProperty}
              moveProperty={moveProperty}
            />
          )}
          
          {activeTab === 'preview' && (
            <PreviewTab template={template} />
          )}
        </div>
      </div>
    </div>
  );
}

function BasicInfoTab({ template, setTemplate }) {
  const industries = [
    'Real Estate', 'E-commerce', 'Technology', 'Healthcare', 'Consulting',
    'Education', 'Finance', 'Manufacturing', 'Marketing', 'Non-profit', 'Other'
  ];

  return (
    <div className="p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-6">Basic Information</h3>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Template Name *
          </label>
          <input
            type="text"
            value={template.name}
            onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Real Estate Agency Setup"
            className="input-field"
          />
          <p className="text-xs text-gray-500 mt-1">
            Choose a descriptive name that identifies the purpose of this template
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={template.description}
            onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this template does and when to use it..."
            rows={4}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Industry
          </label>
          <select
            value={template.industry}
            onChange={(e) => setTemplate(prev => ({ ...prev, industry: e.target.value }))}
            className="input-field"
          >
            <option value="">Select industry...</option>
            {industries.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={template.isActive}
            onChange={(e) => setTemplate(prev => ({ ...prev, isActive: e.target.checked }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
            Active template (available for use)
          </label>
        </div>
      </div>
    </div>
  );
}

function PropertiesTab({ 
  template, 
  selectedObjectType, 
  setSelectedObjectType,
  showPropertyForm,
  setShowPropertyForm,
  editingProperty,
  setEditingProperty,
  addProperty,
  updateProperty,
  deleteProperty,
  moveProperty
}) {
  const properties = template.config.properties[selectedObjectType] || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Properties Configuration</h3>
        <button
          onClick={() => setShowPropertyForm(true)}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Property
        </button>
      </div>

      {/* Object Type Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Object Type
        </label>
        <div className="flex space-x-4">
          {OBJECT_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setSelectedObjectType(type.value)}
              className={`flex-1 p-4 border rounded-lg text-left ${
                selectedObjectType === type.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">{type.label}</div>
              <div className="text-sm text-gray-500">{type.description}</div>
              <div className="text-xs text-gray-400 mt-1">
                {template.config.properties[type.value]?.length || 0} properties
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Properties List */}
      <div className="space-y-4">
        {properties.length > 0 ? (
          properties.map((property, index) => (
            <PropertyCard
              key={property.id}
              property={property}
              index={index}
              totalProperties={properties.length}
              onEdit={(prop) => {
                setEditingProperty(prop);
                setShowPropertyForm(true);
              }}
              onDelete={() => deleteProperty(property.id)}
              onMove={(direction) => moveProperty(property.id, direction)}
            />
          ))
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <Cog6ToothIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No properties yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add your first {selectedObjectType} property to get started
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowPropertyForm(true)}
                className="btn-primary flex items-center mx-auto"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Property
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Property Form Modal */}
      {showPropertyForm && (
        <PropertyFormModal
          property={editingProperty}
          onSave={addProperty}
          onClose={() => {
            setShowPropertyForm(false);
            setEditingProperty(null);
          }}
        />
      )}
    </div>
  );
}

function PropertyCard({ property, index, totalProperties, onEdit, onDelete, onMove }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h4 className="font-medium text-gray-900">{property.label}</h4>
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
              {property.type}
            </span>
            {property.groupName && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                {property.groupName}
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{property.name}</span>
            {property.description && (
              <span className="ml-2">{property.description}</span>
            )}
          </div>
          {property.options && property.options.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              Options: {property.options.map(opt => opt.label).join(', ')}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === totalProperties - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <ArrowDownIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onEdit(property)}
            className="p-1 text-blue-600 hover:text-blue-800"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-600 hover:text-red-800"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PropertyFormModal({ property, onSave, onClose }) {
  const isEditing = Boolean(property);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    type: 'string',
    fieldType: 'text',
    groupName: 'Custom Properties',
    description: '',
    hasUniqueValue: false,
    hidden: false,
    options: [],
    ...property
  });

  const [newOption, setNewOption] = useState({ label: '', value: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.label) {
      return;
    }

    // Generate property name from label if not manually set
    if (!isEditing && (!formData.name || formData.name === property?.name)) {
      const generatedName = formData.label
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '');
      
      setFormData(prev => ({ ...prev, name: generatedName }));
    }

    onSave(formData);
  };

  const addOption = () => {
    if (newOption.label && newOption.value) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, newOption]
      }));
      setNewOption({ label: '', value: '' });
    }
  };

  const removeOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const selectedType = PROPERTY_TYPES.find(t => t.value === formData.type);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {isEditing ? 'Edit Property' : 'Add New Property'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Label *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setFormData(prev => ({ 
                    ...prev, 
                    label,
                    name: isEditing ? prev.name : label
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, '_')
                      .replace(/_{2,}/g, '_')
                      .replace(/^_|_$/g, '')
                  }));
                }}
                placeholder="e.g., Company Size"
                className="input-field"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., company_size"
                className="input-field font-mono text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this property is used for..."
              rows={2}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const type = e.target.value;
                  const typeConfig = PROPERTY_TYPES.find(t => t.value === type);
                  setFormData(prev => ({ 
                    ...prev, 
                    type,
                    fieldType: typeConfig?.fieldTypes[0] || 'text'
                  }));
                }}
                className="input-field"
              >
                {PROPERTY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type
              </label>
              <select
                value={formData.fieldType}
                onChange={(e) => setFormData(prev => ({ ...prev, fieldType: e.target.value }))}
                className="input-field"
              >
                {(selectedType?.fieldTypes || ['text']).map(fieldType => (
                  <option key={fieldType} value={fieldType}>
                    {fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Group
            </label>
            <select
              value={formData.groupName}
              onChange={(e) => setFormData(prev => ({ ...prev, groupName: e.target.value }))}
              className="input-field"
            >
              {PROPERTY_GROUPS.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>

          {/* Enumeration Options */}
          {formData.type === 'enumeration' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dropdown Options
              </label>
              
              <div className="space-y-2 mb-3">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={option.label}
                      readOnly
                      className="input-field flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newOption.label}
                  onChange={(e) => setNewOption(prev => ({ 
                    ...prev, 
                    label: e.target.value,
                    value: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')
                  }))}
                  placeholder="Option label"
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="btn-secondary"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.hasUniqueValue}
                onChange={(e) => setFormData(prev => ({ ...prev, hasUniqueValue: e.target.checked }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-900">Require unique values</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.hidden}
                onChange={(e) => setFormData(prev => ({ ...prev, hidden: e.target.checked }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-900">Hidden property</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              {isEditing ? 'Update Property' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreviewTab({ template }) {
  const totalProperties = Object.values(template.config.properties).reduce(
    (sum, props) => sum + props.length, 0
  );

  return (
    <div className="p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-6">Template Preview</h3>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{totalProperties}</div>
          <div className="text-sm text-blue-800">Total Properties</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {Object.keys(template.config.properties).filter(
              key => template.config.properties[key].length > 0
            ).length}
          </div>
          <div className="text-sm text-green-800">Object Types</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {new Set(
              Object.values(template.config.properties)
                .flat()
                .map(prop => prop.groupName)
            ).size}
          </div>
          <div className="text-sm text-purple-800">Property Groups</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">
            ~{Math.ceil(totalProperties * 1.5 + 10)}s
          </div>
          <div className="text-sm text-orange-800">Est. Deploy Time</div>
        </div>
      </div>

      {/* Properties by Object Type */}
      {Object.entries(template.config.properties).map(([objectType, properties]) => {
        if (properties.length === 0) return null;
        
        return (
          <div key={objectType} className="mb-8">
            <h4 className="text-md font-medium text-gray-900 mb-4 capitalize">
              {objectType} Properties ({properties.length})
            </h4>
            
            <div className="space-y-3">
              {properties.map(property => (
                <div key={property.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">{property.label}</h5>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {property.type}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {property.groupName}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">{property.name}</span>
                    {property.description && (
                      <span className="ml-2">{property.description}</span>
                    )}
                  </div>
                  
                  {property.options && property.options.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Options:</div>
                      <div className="flex flex-wrap gap-1">
                        {property.options.map((option, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-50 text-gray-700">
                            {option.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {totalProperties === 0 && (
        <div className="text-center py-12">
          <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No properties configured</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add properties in the Properties tab to see the preview
          </p>
        </div>
      )}
    </div>
  );
}

export default TemplateEditor;