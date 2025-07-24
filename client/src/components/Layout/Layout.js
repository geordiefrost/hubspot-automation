import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  DocumentDuplicateIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  CogIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../../context/AppContext';
import ApiKeyModal from '../Common/ApiKeyModal';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Templates', href: '/templates', icon: DocumentDuplicateIcon },
  { name: 'Deployments', href: '/deployments', icon: ArrowPathIcon },
  { name: 'Import', href: '/import', icon: CloudArrowUpIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
];

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const location = useLocation();
  const { apiKey } = useApp();

  const isCurrentPage = (href) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const handleApiKeyClick = () => {
    setApiKeyModalOpen(true);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <XMarkIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent 
              navigation={navigation} 
              isCurrentPage={isCurrentPage}
              apiKey={apiKey}
              onApiKeyClick={handleApiKeyClick}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <SidebarContent 
            navigation={navigation} 
            isCurrentPage={isCurrentPage}
            apiKey={apiKey}
            onApiKeyClick={handleApiKeyClick}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </div>
  );
}

function SidebarContent({ navigation, isCurrentPage, apiKey, onApiKeyClick }) {
  return (
    <div className="flex flex-col h-0 flex-1 border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-hubspot-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900">
                HubSpot Automation
              </h1>
              <p className="text-xs text-gray-500">Bang Digital</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const current = isCurrentPage(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  current
                    ? 'bg-primary-100 border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-3 py-2 text-sm font-medium border-l-4 transition-colors duration-150`}
              >
                <item.icon
                  className={`${
                    current ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                  } mr-3 h-5 w-5 transition-colors duration-150`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* API Key Status */}
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <button
          onClick={onApiKeyClick}
          className="flex-shrink-0 w-full group block"
        >
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full ${apiKey ? 'bg-green-400' : 'bg-red-400'}`} />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                {apiKey ? 'API Key Set' : 'No API Key'}
              </p>
              <p className="text-xs text-gray-500">
                {apiKey ? 'Click to update' : 'Click to configure'}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

export default Layout;