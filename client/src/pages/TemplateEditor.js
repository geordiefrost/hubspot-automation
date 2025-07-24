import React from 'react';
import PageHeader from '../components/Common/PageHeader';

function TemplateEditor() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Template Editor"
        subtitle="Create and edit HubSpot setup templates"
      />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Template Editor</h3>
          <p className="text-gray-500">Template editor interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditor;