import React from 'react';
import { UniversalData } from '@/lib/data-adapters/esri-to-kepler-adapter';

interface SimpleKeplerViewProps {
  data: UniversalData;
  height: number;
  width: number;
  onError?: (error: Error) => void;
}

export const SimpleKeplerView: React.FC<SimpleKeplerViewProps> = ({ 
  data, 
  height, 
  width, 
  onError 
}) => {
  return (
    <div 
      style={{ width, height }}
      className="bg-purple-50 border-l-2 border-purple-300 overflow-hidden"
    >
      <div className="p-4 h-full overflow-y-auto">
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-purple-800">
            🌍 Kepler.gl View
          </h3>
          <p className="text-sm text-purple-600">
            {data.metadata.title}
          </p>
          <p className="text-xs text-purple-500">
            {data.features.length} features • {data.metadata.visualizationType}
          </p>
        </div>

        {/* Data Preview */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-3 border border-purple-200">
            <h4 className="font-medium text-purple-800 mb-2">Fields</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {data.fields.slice(0, 6).map((field, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{field.displayName || field.name}</span>
                  <span className="text-purple-600 font-mono text-xs">{field.type}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 border border-purple-200">
            <h4 className="font-medium text-purple-800 mb-2">Sample Features</h4>
            <div className="space-y-2 text-sm">
              {data.features.slice(0, 3).map((feature, index) => (
                <div key={index} className="bg-purple-50 p-2 rounded">
                  <div className="font-medium text-purple-800">Feature {feature.id}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {Object.entries(feature.properties).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}:</span>
                        <span className="font-mono">{String(value).slice(0, 20)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kepler.gl Loading Status */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-yellow-800">
                Kepler.gl integration in progress...
              </span>
            </div>
            <p className="text-xs text-yellow-600 mt-1">
              This is a temporary preview. Working on full Kepler.gl integration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleKeplerView; 