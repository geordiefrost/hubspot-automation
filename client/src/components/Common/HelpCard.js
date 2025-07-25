import React from 'react';
import { InformationCircleIcon, QuestionMarkCircleIcon, LightBulbIcon } from '@heroicons/react/24/outline';

const ICON_MAP = {
  info: InformationCircleIcon,
  help: QuestionMarkCircleIcon,
  tip: LightBulbIcon
};

const COLOR_MAP = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  help: 'bg-purple-50 border-purple-200 text-purple-800',
  tip: 'bg-yellow-50 border-yellow-200 text-yellow-800'
};

function HelpCard({ type = 'info', title, children, className = '' }) {
  const Icon = ICON_MAP[type];
  const colorClasses = COLOR_MAP[type];

  return (
    <div className={`rounded-lg border p-4 ${colorClasses} ${className}`}>
      <div className="flex items-start">
        <Icon className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-2">{title}</h3>
          )}
          <div className="text-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpCard;