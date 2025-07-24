import React from 'react';
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
} from '@heroicons/react/24/outline';
import { deploymentAPI, templateAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/Common/PageHeader';
import LoadingSpinner from '../components/Common/LoadingSpinner';

function Dashboard() {
  const { apiKey } = useApp();

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
      name: 'Import Data',
      description: 'Upload CSV or paste Excel data to analyze',
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
        {!apiKey ? (
          <ApiKeyPrompt />
        ) : (
          <>
            {/* Stats Overview */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Deployments"
                  value={stats.totalDeployments || 0}
                  icon={ChartBarIcon}
                  loading={statsLoading}
                />
                <StatCard
                  title="Success Rate"
                  value={`${stats.successRate || 0}%`}
                  icon={CheckCircleIcon}
                  iconColor="text-green-600"
                  loading={statsLoading}
                />
                <StatCard
                  title="Failed Deployments"
                  value={stats.statusCounts?.failed?.count || 0}
                  icon={ExclamationTriangleIcon}
                  iconColor="text-red-600"
                  loading={statsLoading}
                />
                <StatCard
                  title="In Progress"
                  value={stats.statusCounts?.in_progress?.count || 0}
                  icon={ClockIcon}
                  iconColor="text-yellow-600"
                  loading={statsLoading}
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

function StatCard({ title, value, icon: Icon, iconColor = 'text-primary-600', loading }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
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