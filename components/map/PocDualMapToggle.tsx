// components/map/PocDualMapToggle.tsx
import React, { useState } from 'react';
import { UniversalData } from '@/lib/data-adapters/poc-data-adapter';
import { PocKeplerView } from './PocKeplerView';
import { PocEsriView } from './PocEsriView';

interface PocDualMapToggleProps {
  data: UniversalData;
  height: number;
  esriMapComponent?: React.ReactNode; // Keep for backward compatibility
}

export const PocDualMapToggle: React.FC<PocDualMapToggleProps> = ({ 
  data, 
  height, 
  esriMapComponent 
}) => {
  const [activeView, setActiveView] = useState<'esri' | 'kepler'>('esri');

  return (
    <div className="w-full">
      {/* Toggle Controls */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setActiveView('esri')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'esri'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🗺️ ESRI View
        </button>
        <button
          onClick={() => setActiveView('kepler')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'kepler'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🌍 Kepler View
        </button>
      </div>

      {/* Map Container */}
      <div className="w-full border rounded-lg overflow-hidden">
        {activeView === 'esri' ? (
          // Use the new ESRI component if no custom component provided
          esriMapComponent || <PocEsriView data={data} height={height} />
        ) : (
          <PocKeplerView data={data} height={height} />
        )}
      </div>

      {/* View Info */}
      <div className="mt-3 text-sm text-gray-600">
        <p>
          <strong>Current View:</strong> {activeView === 'esri' ? 'ESRI ArcGIS' : 'Kepler.gl'}
        </p>
        <p>
          <strong>Data:</strong> {data.features.length} features with {data.fields.length} fields
        </p>
      </div>
    </div>
  );
}; 