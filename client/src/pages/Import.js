import React, { useState } from 'react';
import { CloudArrowUpIcon, DocumentTextIcon, TableCellsIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/Common/PageHeader';
import HelpCard from '../components/Common/HelpCard';
import ImportStep1 from '../components/Import/ImportStep1';
import ImportStep2 from '../components/Import/ImportStep2';
import ImportStep3 from '../components/Import/ImportStep3';
import ImportStep4 from '../components/Import/ImportStep4';

const STEPS = [
  { id: 1, name: 'Upload Configuration', icon: CloudArrowUpIcon },
  { id: 2, name: 'Analyze Configuration', icon: DocumentTextIcon },
  { id: 3, name: 'Review Setup', icon: TableCellsIcon },
  { id: 4, name: 'Deploy Configuration', icon: ArrowRightIcon },
];

function Import() {
  const [currentStep, setCurrentStep] = useState(1);
  const [importData, setImportData] = useState({
    headers: [],
    sampleData: [],
    totalRows: 0,
    configType: 'custom-properties',
    mappings: [],
    configuration: null,
  });

  const resetImport = () => {
    setCurrentStep(1);
    setImportData({
      headers: [],
      sampleData: [],
      totalRows: 0,
      configType: 'custom-properties',
      mappings: [],
      configuration: null,
    });
  };

  const handleStepComplete = (stepData) => {
    setImportData(prev => ({ ...prev, ...stepData }));
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToStep = (step) => {
    if (step <= currentStep || step === 1) {
      setCurrentStep(step);
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Import Configuration"
        subtitle="Upload HubSpot configuration files to set up custom fields, pipelines, and properties"
      >
        {currentStep > 1 && (
          <button
            onClick={resetImport}
            className="btn-secondary"
          >
            Start Over
          </button>
        )}
      </PageHeader>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Import Process Overview */}
        {currentStep === 1 && (
          <div className="mb-8">
            <HelpCard type="info" title="How Configuration Import Works">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                <div className="text-center">
                  <CloudArrowUpIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-sm font-medium">1. Upload Configuration</div>
                  <div className="text-xs text-gray-600">CSV files with HubSpot setup data</div>
                </div>
                <div className="text-center">
                  <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-sm font-medium">2. Analyze Configuration</div>
                  <div className="text-xs text-gray-600">Validate properties and settings</div>
                </div>
                <div className="text-center">
                  <TableCellsIcon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <div className="text-sm font-medium">3. Review Setup</div>
                  <div className="text-xs text-gray-600">Preview HubSpot changes</div>
                </div>
                <div className="text-center">
                  <ArrowRightIcon className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <div className="text-sm font-medium">4. Deploy</div>
                  <div className="text-xs text-gray-600">Create configuration in HubSpot</div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>What you can import:</strong> Custom properties, property groups, deal pipelines, ticket pipelines, and product configurations. This does NOT import contact, company, or deal data.
                </p>
              </div>
            </HelpCard>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <nav aria-label="Progress">
            <ol className="flex items-center">
              {STEPS.map((step, stepIdx) => (
                <li
                  key={step.name}
                  className={`${
                    stepIdx !== STEPS.length - 1 ? 'pr-8 sm:pr-20' : ''
                  } relative`}
                >
                  {step.id < currentStep ? (
                    <button
                      onClick={() => goToStep(step.id)}
                      className="group flex items-center"
                    >
                      <span className="flex h-9 items-center">
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 group-hover:bg-primary-700">
                          <svg
                            className="h-5 w-5 text-white"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      </span>
                      <span className="ml-4 text-sm font-medium text-gray-900 group-hover:text-primary-700">
                        {step.name}
                      </span>
                    </button>
                  ) : step.id === currentStep ? (
                    <div className="flex items-center" aria-current="step">
                      <span className="flex h-9 items-center">
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-600 bg-white">
                          <step.icon className="h-4 w-4 text-primary-600" />
                        </span>
                      </span>
                      <span className="ml-4 text-sm font-medium text-primary-600">
                        {step.name}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="flex h-9 items-center">
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                          <step.icon className="h-4 w-4 text-gray-400" />
                        </span>
                      </span>
                      <span className="ml-4 text-sm font-medium text-gray-500">
                        {step.name}
                      </span>
                    </div>
                  )}

                  {stepIdx !== STEPS.length - 1 && (
                    <div className="absolute top-4 right-0 hidden h-0.5 w-full bg-gray-200 sm:block">
                      <div
                        className={`h-0.5 ${
                          step.id < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                        style={{ width: step.id < currentStep ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Step Content */}
        <div className="bg-white shadow rounded-lg">
          {currentStep === 1 && (
            <ImportStep1
              onComplete={handleStepComplete}
              data={importData}
            />
          )}
          {currentStep === 2 && (
            <ImportStep2
              onComplete={handleStepComplete}
              onBack={() => setCurrentStep(1)}
              data={importData}
            />
          )}
          {currentStep === 3 && (
            <ImportStep3
              onComplete={handleStepComplete}
              onBack={() => setCurrentStep(2)}
              data={importData}
            />
          )}
          {currentStep === 4 && (
            <ImportStep4
              onComplete={handleStepComplete}
              onBack={() => setCurrentStep(3)}
              data={importData}
              onReset={resetImport}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Import;