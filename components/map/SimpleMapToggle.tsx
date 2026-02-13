// components/map/SimpleMapToggle.tsx
import React, { useState } from 'react';

interface SimpleMapToggleProps {
  onToggle?: (view: 'standard' | 'kepler') => void;
}

export const SimpleMapToggle: React.FC<SimpleMapToggleProps> = ({ onToggle }) => {
  const [currentView, setCurrentView] = useState<'standard' | 'kepler'>('standard');

  const handleToggle = (view: 'standard' | 'kepler') => {
    setCurrentView(view);
    onToggle?.(view);
  };

  return (
    <div className="absolute top-4 left-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
      <div className="flex gap-1">
        <button
          onClick={() => handleToggle('standard')}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            currentView === 'standard'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📊 Standard
        </button>
        <button
          onClick={() => handleToggle('kepler')}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            currentView === 'kepler'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🌍 Kepler
        </button>
      </div>
    </div>
  );
}; 