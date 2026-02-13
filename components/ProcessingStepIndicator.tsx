import React from 'react';

interface ProcessingStep {
  id: string;
  status: string;
  icon: React.ReactNode;
  message: string;
  children?: React.ReactNode;
  timestamp?: number;
  details?: any;
}

const ProcessingStepIndicator: React.FC<{ step: ProcessingStep }> = ({ step }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
    <span>{step.icon}</span>
    <span style={{ fontWeight: 500 }}>{step.message}</span>
    <span style={{ color: '#888', fontSize: 12 }}>({step.status})</span>
  </div>
);

export default ProcessingStepIndicator; 