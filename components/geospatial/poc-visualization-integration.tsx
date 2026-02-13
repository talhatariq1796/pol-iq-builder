// components/geospatial/poc-visualization-integration.tsx
import { useState, useEffect } from 'react';
import { PocDataAdapter, UniversalData } from '@/lib/data-adapters/poc-data-adapter';
import { PocDualMapToggle } from '@/components/map/PocDualMapToggle';

export const PocVisualizationIntegration = () => {
  const [universalData, setUniversalData] = useState<UniversalData | null>(null);
  const [showDualMap, setShowDualMap] = useState(false);

  // Hook into existing visualization creation
  useEffect(() => {
    const handleVisualizationCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { visualizationResult } = customEvent.detail;
      
      if (visualizationResult?.layer?.source) {
        try {
          // Convert ESRI data to universal format
          const esriData = {
            features: Array.from(visualizationResult.layer.source),
            layerName: visualizationResult.layer.title,
            rendererField: visualizationResult.layer.renderer?.field
          };

          const converted = PocDataAdapter.fromEsriVisualization(esriData);
          setUniversalData(converted);
          setShowDualMap(true);
          
          console.log('POC: Successfully converted visualization data:', {
            originalFeatures: esriData.features.length,
            convertedFeatures: converted.features.length,
            fields: converted.fields.length
          });
        } catch (error) {
          console.error('POC: Failed to convert visualization data:', error);
        }
      }
    };

    // Listen for visualization events
    window.addEventListener('visualizationCreated', handleVisualizationCreated);
    
    return () => {
      window.removeEventListener('visualizationCreated', handleVisualizationCreated);
    };
  }, []);

  // Manual trigger for testing
  const handleTestWithSampleData = () => {
    const sampleData = {
      features: [
        {
          attributes: {
            OBJECTID: 1,
            NAME: 'Test Location',
            VALUE: 100,
            CATEGORY: 'High'
          },
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749]
          }
        }
      ],
      layerName: 'Test Visualization',
      rendererField: 'VALUE'
    };

    const converted = PocDataAdapter.fromEsriVisualization(sampleData);
    setUniversalData(converted);
    setShowDualMap(true);
  };

  if (!showDualMap || !universalData) {
    return (
      <div className="poc-integration-container mt-4 p-4 border border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">🧪 POC: Dual Map Integration</h3>
          <p className="text-gray-600 mb-4">
            Waiting for visualization to be created...
          </p>
          <button
            onClick={handleTestWithSampleData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Test with Sample Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="poc-integration-container mt-4 p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">🧪 POC: Dual Map View</h3>
        <button
          onClick={() => setShowDualMap(false)}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          ✕ Close
        </button>
      </div>
      
      <PocDualMapToggle
        data={universalData}
        esriMapComponent={
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100 rounded border">
            <div className="text-center">
              <div className="text-3xl mb-2">📊</div>
              <p className="text-lg font-medium text-gray-700">Current ESRI Visualization</p>
              <p className="text-sm text-gray-500 mt-1">
                Your existing map visualization appears here
              </p>
              <div className="mt-3 text-xs text-gray-400">
                <p>Layer: {universalData.metadata.title}</p>
                <p>Features: {universalData.features.length}</p>
              </div>
            </div>
          </div>
        }
        height={400}
      />
      
      <div className="mt-3 text-xs text-gray-500">
        <strong>POC Status:</strong> Successfully converted {universalData.features.length} features 
        with {universalData.fields.length} fields from ESRI to universal format.
      </div>
    </div>
  );
}; 