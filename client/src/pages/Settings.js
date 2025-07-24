import React from 'react';
import PageHeader from '../components/Common/PageHeader';

function Settings() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Settings"
        subtitle="Configure your automation platform preferences"
      />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Settings</h3>
          <p className="text-gray-500">Settings interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;