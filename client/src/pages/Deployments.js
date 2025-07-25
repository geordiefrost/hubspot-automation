import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { 
  EyeIcon, 
  ArrowPathIcon,
  FunnelIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  XCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { deploymentAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import HelpCard from '../components/Common/HelpCard';

function Deployments() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch deployments with filters
  const { data: deploymentsData, isLoading, refetch } = useQuery(
    ['deployments', statusFilter, searchTerm, currentPage],
    () => deploymentAPI.list({
      status: statusFilter,
      search: searchTerm,
      page: currentPage,
      limit: 10
    }),
    {
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: statusFilter === 'in_progress' ? 5000 : false, // Auto-refresh for active deployments
    }
  );

  const deployments = deploymentsData?.data?.deployments || [];
  const pagination = deploymentsData?.data?.pagination || {};

  const statusOptions = [
    { value: 'all', label: 'All Deployments', icon: null },
    { value: 'completed', label: 'Completed', icon: CheckCircleIcon, color: 'text-green-600' },
    { value: 'in_progress', label: 'In Progress', icon: ClockIcon, color: 'text-yellow-600' },
    { value: 'failed', label: 'Failed', icon: XCircleIcon, color: 'text-red-600' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    refetch();
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Deployments"
        subtitle="Monitor and manage HubSpot property deployments"
      >
        <button
          onClick={() => refetch()}
          className="btn-secondary flex items-center"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </PageHeader>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Help Section */}
        <div className="mb-6">
          <HelpCard type="info" title="Deployment Management">
            <p className="mb-3">
              Track the progress of your HubSpot property deployments. Each deployment creates 
              custom properties and groups in your HubSpot account based on your imported data mappings.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <strong>Deployment Process:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Property groups are created first</li>
                  <li>• Individual properties are created next</li>
                  <li>• Progress is tracked in real-time</li>
                  <li>• Detailed logs show each step</li>
                </ul>
              </div>
              <div>
                <strong>Status Meanings:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• <strong className="text-yellow-600">In Progress:</strong> Currently deploying</li>
                  <li>• <strong className="text-green-600">Completed:</strong> Successfully finished</li>
                  <li>• <strong className="text-red-600">Failed:</strong> Encountered errors</li>
                </ul>
              </div>
            </div>
          </HelpCard>
        </div>

        {/* Filters and Search */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Status Filter */}
            <div className="flex items-center space-x-4">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <div className="flex space-x-2">
                {statusOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setStatusFilter(option.value);
                        setCurrentPage(1);
                      }}
                      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        statusFilter === option.value
                          ? 'bg-primary-100 text-primary-700 border border-primary-200'
                          : 'text-gray-700 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      {Icon && <Icon className={`h-4 w-4 mr-1 ${option.color || 'text-gray-400'}`} />}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by client name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>
              <button type="submit" className="ml-2 btn-primary">
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Deployments List */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <p className="text-gray-500">Loading deployments...</p>
          </div>
        ) : deployments.length > 0 ? (
          <>
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Properties
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {deployments.map((deployment) => (
                      <DeploymentRow key={deployment.id} deployment={deployment} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing page {pagination.currentPage} of {pagination.totalPages} 
                  ({pagination.totalItems} total deployments)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!pagination.hasPreviousPage}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No deployments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by importing data and creating your first deployment.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <div className="mt-6">
                <Link to="/import" className="btn-primary">
                  Import Data to Deploy
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DeploymentRow({ deployment }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'in_progress':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {deployment.clientName}
            </div>
            <div className="text-sm text-gray-500">
              ID: {deployment.id.slice(0, 8)}...
            </div>
          </div>
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          {getStatusIcon(deployment.status)}
          <span className={`ml-2 ${getStatusBadge(deployment.status)}`}>
            {deployment.status.replace('_', ' ')}
          </span>
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
            <div
              className={`h-2 rounded-full ${
                deployment.status === 'completed' ? 'bg-green-500' :
                deployment.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${deployment.progress}%` }}
            />
          </div>
          <span className="text-sm text-gray-900">{deployment.progress}%</span>
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <div>
          <div className="font-medium">{deployment.summary.totalProperties} properties</div>
          <div className="text-gray-500">{deployment.summary.propertyGroups} groups</div>
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {deployment.duration || '—'}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(deployment.createdAt)}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <Link
          to={`/deployments/${deployment.id}`}
          className="text-primary-600 hover:text-primary-900 flex items-center justify-end"
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          View Details
        </Link>
      </td>
    </tr>
  );
}

export default Deployments;