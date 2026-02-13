import React from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { GeoProcessingStep } from '@/lib/analytics/types';

interface ProcessingIndicatorProps {
  step: GeoProcessingStep;
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ step }) => {
  const getStatusColor = () => {
    switch (step.status) {
      case 'complete': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'processing': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`flex items-center gap-2 text-xs ${getStatusColor()}`}>
      <div className="flex items-center">
        {step.status === 'processing' && (
          <Loader2 className={`h-3 w-3 animate-spin ${getStatusColor()}`} />
        )}
        {step.status === 'complete' && (
          <CheckCircle className={`h-3 w-3 ${getStatusColor()}`} />
        )}
        {step.status === 'error' && (
          <XCircle className={`h-3 w-3 ${getStatusColor()}`} />
        )}
        {step.status === 'pending' && (
          <div className="h-3 w-3 rounded-full border border-gray-300" />
        )}
      </div>
      <span>{step.name}: {step.message}</span>
    </div>
  );
};

export default ProcessingIndicator; 