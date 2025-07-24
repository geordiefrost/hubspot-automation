import React from 'react';
import PageHeader from '../components/Common/PageHeader';

function DeploymentDetail() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Deployment Detail"
        subtitle="View detailed deployment information"
      />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Deployment Detail</h3>
          <p className="text-gray-500">Deployment detail interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}

export default DeploymentDetail;