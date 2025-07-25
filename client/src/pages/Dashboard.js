import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import {
  DocumentDuplicateIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { deploymentAPI, templateAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/Common/PageHeader';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import HelpCard from '../components/Common/HelpCard';
import GettingStarted from '../components/Common/GettingStarted';
import { InfoTooltip } from '../components/Common/Tooltip';

function Dashboard() {
  const { apiKey } = useApp();
  const [showGettingStarted, setShowGettingStarted] = useState(!apiKey);

  // Fetch deployment stats
  const { data: deploymentStats, isLoading: statsLoading } = useQuery(
    'deploymentStats',
    () => deploymentAPI.getStats(),
    {
      enabled: !!apiKey,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Fetch recent templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery(
    ['templates', { limit: 5 }],
    () => templateAPI.list({ limit: 5 }),
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  const stats = deploymentStats?.data || {};
  const templates = templatesData?.data?.templates || [];

  const quickActions = [
    {
      name: 'Create Template',
      description: 'Start building a new HubSpot setup template',
      href: '/templates/new',
      icon: DocumentDuplicateIcon,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Import Configuration',
      description: 'Upload configuration files to set up HubSpot properties',
      href: '/import',
      icon: CloudArrowUpIcon,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'View Deployments',
      description: 'Monitor active and completed deployments',
      href: '/deployments',
      icon: ArrowPathIcon,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="min-h-full">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your HubSpot automation platform"
      />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Getting Started Guide */}
        {showGettingStarted && (
          <GettingStarted onClose={() => setShowGettingStarted(false)} />
        )}

        {!apiKey ? (
          <>
            <ApiKeyPrompt />
            <div className="mt-6">
              <HelpCard type="info" title="What is HubSpot Setup Automation?">
                <p className="mb-3">
                  This platform helps you quickly set up HubSpot accounts for clients by:
                </p>
                <ul className="space-y-1 text-sm">
                  <li>• <strong>Importing configuration from CSV files</strong> - Upload property definitions, pipeline setups, etc.</li>
                  <li>• <strong>Creating custom properties</strong> - Automatically set up fields and groups in HubSpot</li>
                  <li>• <strong>Setting up pipelines</strong> - Configure sales and ticket processes for different industries</li>
                  <li>• <strong>Using templates</strong> - Pre-built configurations for common business types</li>
                </ul>
                <p className="mt-3 text-sm font-medium">
                  Get started by connecting your HubSpot API key above!
                </p>
              </HelpCard>
            </div>
          </>
        ) : (
          <>
            {/* Welcome back message */}
            <div className="mb-6">
              <HelpCard type="tip" title="Quick Actions">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <Link to="/import" className="text-sm bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 block">
                    <CloudArrowUpIcon className="h-5 w-5 mb-2 text-blue-600" />
                    <div className="font-medium">Import Configuration</div>
                    <div className="text-gray-600 text-xs">Upload configuration CSV files</div>
                  </Link>
                  <Link to="/templates" className="text-sm bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 block">
                    <DocumentDuplicateIcon className="h-5 w-5 mb-2 text-green-600" />
                    <div className="font-medium">Browse Templates</div>
                    <div className="text-gray-600 text-xs">Pre-built industry setups</div>
                  </Link>
                  <Link to="/deployments" className="text-sm bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 block">
                    <ArrowPathIcon className="h-5 w-5 mb-2 text-purple-600" />
                    <div className="font-medium">View Deployments</div>
                    <div className="text-gray-600 text-xs">Monitor active setups</div>
                  </Link>
                </div>
              </HelpCard>
            </div>

            {/* Stats Overview */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <h2 className="text-lg font-medium text-gray-900 mr-2">Overview</h2>
                  <InfoTooltip content="Statistics about your HubSpot automation deployments and overall platform usage" />
                </div>
                <button 
                  onClick={() => setShowGettingStarted(true)}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Show Getting Started Guide
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Deployments"
                  value={stats.totalDeployments || 0}
                  icon={ChartBarIcon}
                  loading={statsLoading}
                  tooltip="Total number of HubSpot configurations deployed to client accounts"
                />
                <StatCard
                  title="Success Rate"
                  value={`${stats.successRate || 0}%`}
                  icon={CheckCircleIcon}
                  iconColor="text-green-600"
                  loading={statsLoading}
                  tooltip="Percentage of deployments that completed successfully without errors"
                />
                <StatCard
                  title="Failed Deployments"
                  value={stats.statusCounts?.failed?.count || 0}
                  icon={ExclamationTriangleIcon}
                  iconColor="text-red-600"
                  loading={statsLoading}
                  tooltip="Deployments that encountered errors and could not complete"
                />
                <StatCard
                  title="In Progress"
                  value={stats.statusCounts?.in_progress?.count || 0}
                  icon={ClockIcon}
                  iconColor="text-yellow-600"
                  loading={statsLoading}
                  tooltip="Deployments currently running - these typically take 30-60 seconds"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {quickActions.map((action) => (
                  <Link
                    key={action.name}
                    to={action.href}
                    className="card hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="card-body">
                      <div className="flex items-center">
                        <div className={`p-3 rounded-lg ${action.bgColor}`}>
                          <action.icon className={`h-6 w-6 ${action.iconColor}`} />
                        </div>
                        <div className="ml-4">
                          <h3 className="text-sm font-medium text-gray-900">
                            {action.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Deployments */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Recent Deployments</h3>
                  <Link to="/deployments" className="text-sm text-primary-600 hover:text-primary-500">
                    View all
                  </Link>
                </div>
                <div className="card-body">
                  {statsLoading ? (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner />
                    </div>
                  ) : stats.recentDeployments?.length > 0 ? (
                    <div className="space-y-3">
                      {stats.recentDeployments.map((deployment) => (
                        <div key={deployment.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {deployment.clientName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(deployment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`badge ${getStatusBadgeClass(deployment.status)}`}>
                            {deployment.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No deployments yet
                    </p>
                  )}
                </div>
              </div>

              {/* Popular Templates */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Popular Templates</h3>
                  <Link to="/templates" className="text-sm text-primary-600 hover:text-primary-500">
                    View all
                  </Link>
                </div>
                <div className="card-body">
                  {templatesLoading ? (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner />
                    </div>
                  ) : templates.length > 0 ? (
                    <div className="space-y-3">
                      {templates.map((template) => (
                        <div key={template.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {template.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {template.industry || 'General'} • Used {template.usageCount} times
                            </p>
                          </div>
                          <Link
                            to={`/templates/${template.id}`}
                            className="text-primary-600 hover:text-primary-500 text-sm"
                          >
                            Edit
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No templates yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ApiKeyPrompt() {
  return (
    <div className="text-center py-12">
      <div className="mx-auto h-12 w-12 text-gray-400">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          />
        </svg>
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-900">No API Key Configured</h3>
      <p className="mt-1 text-sm text-gray-500">
        Configure your HubSpot API key to start using the automation platform.
      </p>
      <div className="mt-6">
        <button
          onClick={() => document.querySelector('[data-api-key-trigger]')?.click()}
          className="btn-primary"
        >
          Configure API Key
        </button>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, iconColor = 'text-primary-600', loading, tooltip }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate flex items-center">
                {title}
                {tooltip && <InfoTooltip content={tooltip} className="ml-1" />}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {loading ? <LoadingSpinner className="inline-block" /> : value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'completed':
      return 'badge-success';
    case 'failed':
      return 'badge-danger';
    case 'in_progress':
      return 'badge-warning';
    default:
      return 'badge-info';
  }
}

export default Dashboard;