import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import {
  DocumentDuplicateIcon,
  PlusIcon,
  CloudArrowUpIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CogIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { templateAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/Common/PageHeader';
import HelpCard from '../components/Common/HelpCard';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const EXAMPLE_TEMPLATES = [
  {
    id: 'real-estate',
    name: 'Real Estate Agency',
    description: 'Complete HubSpot setup for real estate agencies with lead tracking, property management, and client pipelines.',
    industry: 'Real Estate',
    properties: 45,
    usageCount: 23,
    isPopular: true,
    lastUsed: '2024-01-15',
    features: ['Lead tracking', 'Property management', 'Commission tracking', 'Client pipeline']
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Store',
    description: 'Comprehensive setup for online stores with customer segmentation, order tracking, and marketing automation.',
    industry: 'E-commerce',
    properties: 38,
    usageCount: 17,
    isPopular: true,
    lastUsed: '2024-01-12',
    features: ['Customer segments', 'Order tracking', 'Product management', 'Marketing automation']
  },
  {
    id: 'saas',
    name: 'SaaS Platform',
    description: 'Tailored for software companies with subscription tracking, user onboarding, and churn analysis properties.',
    industry: 'Technology',
    properties: 52,
    usageCount: 31,
    isPopular: true,
    lastUsed: '2024-01-18',
    features: ['Subscription tracking', 'User onboarding', 'Churn analysis', 'Feature usage']
  },
  {
    id: 'consulting',
    name: 'Professional Services',
    description: 'Professional services template with project management, client relationship tracking, and billing properties.',
    industry: 'Consulting',
    properties: 29,
    usageCount: 12,
    isPopular: false,
    lastUsed: '2024-01-08',
    features: ['Project management', 'Time tracking', 'Client relationships', 'Billing & invoices']
  }
];

function Templates() {
  const { apiKey } = useApp();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showHelp, setShowHelp] = useState(true);

  // Fetch templates (commented out since API might not be fully implemented)
  // const { data: templatesData, isLoading } = useQuery(
  //   'templates',
  //   () => templateAPI.list(),
  //   { staleTime: 5 * 60 * 1000 }
  // );

  // Using example data for now
  const templates = EXAMPLE_TEMPLATES;
  const isLoading = false;

  const categories = [
    { id: 'all', label: 'All Templates', count: templates.length },
    { id: 'popular', label: 'Popular', count: templates.filter(t => t.isPopular).length },
    { id: 'real-estate', label: 'Real Estate', count: templates.filter(t => t.industry === 'Real Estate').length },
    { id: 'ecommerce', label: 'E-commerce', count: templates.filter(t => t.industry === 'E-commerce').length },
    { id: 'technology', label: 'Technology', count: templates.filter(t => t.industry === 'Technology').length },
    { id: 'consulting', label: 'Consulting', count: templates.filter(t => t.industry === 'Consulting').length }
  ];

  const filteredTemplates = templates.filter(template => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'popular') return template.isPopular;
    return template.industry.toLowerCase().replace(/[^a-z]/g, '-') === selectedCategory;
  });

  return (
    <div className="min-h-full">
      <PageHeader
        title="Templates"
        subtitle="Pre-built HubSpot configurations for different industries and use cases"
      >
        <Link to="/templates/new" className="btn-primary">
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Template
        </Link>
      </PageHeader>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Help Section */}
        {showHelp && (
          <div className="mb-8">
            <HelpCard type="info" title="What are HubSpot Setup Templates?">
              <div className="space-y-4">
                <p>
                  Templates are pre-configured HubSpot setups that save you time when setting up similar accounts. 
                  Instead of manually creating properties and pipelines each time, you can use or create templates 
                  that contain all the necessary configurations.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">How Templates Work:</h4>
                    <ul className="text-sm space-y-1">
                      <li>• <strong>Pre-built Properties:</strong> Industry-specific custom fields</li>
                      <li>• <strong>Smart Pipelines:</strong> Sales processes tailored to the business type</li>
                      <li>• <strong>Property Groups:</strong> Organized field collections for easy management</li>
                      <li>• <strong>Lifecycle Stages:</strong> Customer journey mapping</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">When to Use Templates:</h4>
                    <ul className="text-sm space-y-1">
                      <li>• <strong>Similar Clients:</strong> Multiple clients in the same industry</li>
                      <li>• <strong>Recurring Setups:</strong> Standardized configurations you use often</li>
                      <li>• <strong>Team Efficiency:</strong> Share proven setups with colleagues</li>
                      <li>• <strong>Best Practices:</strong> Apply proven HubSpot configurations</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                  <div className="flex items-start">
                    <CloudArrowUpIcon className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-800">Quick Start Options:</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Browse industry templates below, or <Link to="/import" className="underline font-medium">import your data</Link> to 
                        automatically generate a custom template based on your CSV fields.
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowHelp(false)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Hide this help section
                </button>
              </div>
            </HelpCard>
          </div>
        )}

        {!showHelp && (
          <div className="mb-6">
            <button 
              onClick={() => setShowHelp(true)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Show template help & guidance
            </button>
          </div>
        )}

        {/* Category Filters */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    selectedCategory === category.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {category.label}
                  <span className="ml-2 bg-gray-100 text-gray-900 rounded-full py-0.5 px-2 text-xs">
                    {category.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <p className="text-gray-500">Loading templates...</p>
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No templates found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedCategory === 'all' 
                ? "No templates available yet. Create your first template!"
                : `No templates found in the ${categories.find(c => c.id === selectedCategory)?.label} category.`
              }
            </p>
            <div className="mt-6">
              <Link to="/templates/new" className="btn-primary">
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Template
              </Link>
            </div>
          </div>
        )}

        {/* Getting Started Section */}
        {!apiKey && (
          <div className="mt-12">
            <HelpCard type="tip" title="Ready to Get Started?">
              <div className="space-y-3">
                <p>To use templates and deploy configurations to HubSpot, you'll need to connect your account:</p>
                <div className="flex items-center justify-between bg-white rounded-lg border border-yellow-200 p-4">
                  <div className="flex items-center">
                    <CogIcon className="h-8 w-8 text-yellow-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Connect Your HubSpot Account</h4>
                      <p className="text-sm text-gray-600">Add your API key to start deploying templates</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => document.querySelector('[data-api-key-trigger]')?.click()}
                    className="btn-primary"
                  >
                    Connect Now
                  </button>
                </div>
              </div>
            </HelpCard>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template }) {
  const getIndustryIcon = (industry) => {
    switch (industry) {
      case 'Real Estate': return BuildingOfficeIcon;
      case 'E-commerce': return CogIcon;
      case 'Technology': return CogIcon;
      case 'Consulting': return UserGroupIcon;
      default: return DocumentDuplicateIcon;
    }
  };

  const IndustryIcon = getIndustryIcon(template.industry);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-primary-100 p-2 rounded-lg mr-3">
              <IndustryIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                {template.name}
                {template.isPopular && (
                  <StarIcon className="h-4 w-4 text-yellow-500 ml-2 fill-current" />
                )}
              </h3>
              <p className="text-sm text-gray-500">{template.industry}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {template.description}
        </p>

        {/* Features */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Features</h4>
          <div className="flex flex-wrap gap-1">
            {template.features.map((feature, index) => (
              <span 
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-gray-100">
          <div>
            <div className="text-sm font-medium text-gray-900">{template.properties}</div>
            <div className="text-xs text-gray-500">Properties</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{template.usageCount}</div>
            <div className="text-xs text-gray-500">Times Used</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <Link 
            to={`/templates/${template.id}`}
            className="flex-1 btn-secondary text-center"
          >
            <EyeIcon className="h-4 w-4 mr-1" />
            View
          </Link>
          <Link 
            to={`/templates/${template.id}/edit`}
            className="flex-1 btn-primary text-center"
          >
            <PencilIcon className="h-4 w-4 mr-1" />
            Use Template
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Templates;