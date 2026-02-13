// components/map/PocEsriView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { UniversalData } from '@/lib/data-adapters/poc-data-adapter';

interface PocEsriViewProps {
  data: UniversalData;
  height: number;
}

export const PocEsriView: React.FC<PocEsriViewProps> = ({ data, height }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEsriMap = async () => {
      if (typeof window === 'undefined') {
        setStatus('Window not available (SSR)');
        return;
      }

      try {
        setStatus('Loading ESRI modules...');
        console.log('Starting ESRI map load...');

        // Dynamic import to avoid SSR issues
        const [Map, MapView, FeatureLayer, SimpleRenderer, SimpleMarkerSymbol, Point, Graphic, Extent] = await Promise.all([
          import('@arcgis/core/Map').then(m => m.default),
          import('@arcgis/core/views/MapView').then(m => m.default),
          import('@arcgis/core/layers/FeatureLayer').then(m => m.default),
          import('@arcgis/core/renderers/SimpleRenderer').then(m => m.default),
          import('@arcgis/core/symbols/SimpleMarkerSymbol').then(m => m.default),
          import('@arcgis/core/geometry/Point').then(m => m.default),
          import('@arcgis/core/Graphic').then(m => m.default),
          import('@arcgis/core/geometry/Extent').then(m => m.default)
        ]);

        setStatus('ESRI modules loaded ✓');
        console.log('ESRI modules loaded successfully');

        // Create features from universal data and calculate extent
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        const features = data.features.map((feature, index) => {
          const lng = feature.geometry?.type === 'Point' ? feature.geometry.coordinates[0] : 0;
          const lat = feature.geometry?.type === 'Point' ? feature.geometry.coordinates[1] : 0;
          
          // Update extent bounds
          minX = Math.min(minX, lng);
          maxX = Math.max(maxX, lng);
          minY = Math.min(minY, lat);
          maxY = Math.max(maxY, lat);
          
          const graphic = new Graphic({
            geometry: new Point({
              longitude: lng,
              latitude: lat
            }),
            attributes: {
              ...feature.properties,
              OBJECTID: index + 1
            }
          });
          console.log(`Created graphic ${index + 1}:`, graphic);
          return graphic;
        });

        // Create extent from calculated bounds
        const dataExtent = new Extent({
          xmin: minX - 0.5, // Add padding
          ymin: minY - 0.5,
          xmax: maxX + 0.5,
          ymax: maxY + 0.5,
          spatialReference: { wkid: 4326 }
        });

        setStatus('Features created ✓');
        console.log(`Created ${features.length} features with extent:`, dataExtent);

        // Create fields for the feature layer
        const fields = [
          {
            name: 'OBJECTID',
            type: 'oid' as const,
            alias: 'ObjectID'
          },
          ...data.fields.map(field => ({
            name: field.name,
            type: (field.type === 'number' ? 'double' : 
                  field.type === 'boolean' ? 'small-integer' : 'string') as 'double' | 'small-integer' | 'string',
            alias: field.displayName || field.name
          }))
        ];

        console.log('Fields created:', fields);

        // Create feature layer
        const featureLayer = new FeatureLayer({
          source: features,
          fields: fields,
          objectIdField: 'OBJECTID',
          geometryType: 'point',
          spatialReference: { wkid: 4326 },
          renderer: new SimpleRenderer({
            symbol: new SimpleMarkerSymbol({
              style: 'circle',
              color: [51, 51, 204, 0.9],
              size: 8,
              outline: {
                color: [255, 255, 255, 0.8],
                width: 1
              }
            })
          }),
          popupTemplate: {
            title: '{NAME}',
            content: data.fields.map(field => 
              `<b>${field.displayName || field.name}:</b> {${field.name}}`
            ).join('<br>')
          }
        });

        setStatus('Feature layer created ✓');
        console.log('Feature layer created:', featureLayer);

        // Create map
        const map = new Map({
          basemap: 'streets-navigation-vector',
          layers: [featureLayer]
        });

        setStatus('Map created ✓');
        console.log('Map created:', map);

        // Create map view
        if (!mapRef.current) {
          throw new Error('Map container not found');
        }

        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [(minX + maxX) / 2, (minY + maxY) / 2], // Center on data
          zoom: 6,
          constraints: {
            minZoom: 3,
            maxZoom: 20
          }
        });

        setStatus('Map view created ✓');
        console.log('Map view created:', view);

        // Wait for view to be ready and then zoom to extent
        view.when(() => {
          console.log('Map view ready, zooming to data extent...');
          
          // Use our calculated extent instead of layer.fullExtent
          if (dataExtent && features.length > 0) {
            view.goTo(dataExtent, { duration: 1000 }).then(() => {
              setStatus('Map loaded successfully ✓');
              console.log('Map fully loaded and zoomed to extent');
            }).catch(err => {
              console.warn('Could not zoom to extent:', err);
              setStatus('Map loaded (zoom failed) ✓');
            });
          } else {
            console.warn('No valid extent to zoom to');
            setStatus('Map loaded (no extent) ✓');
          }
        }).catch(err => {
          console.error('Map view failed to initialize:', err);
          setError(`Map view initialization failed: ${err.message}`);
        });

      } catch (error) {
        console.error('Failed to load ESRI map:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        setStatus('Failed to load ESRI map');
      }
    };

    loadEsriMap();
  }, [data, height]);

  if (error) {
    return (
      <div 
        style={{ width: '100%', height: `${height}px` }}
        className="flex items-center justify-center bg-red-50 border border-red-200 rounded"
      >
        <div className="text-center p-4">
          <p className="text-red-600 font-medium">Failed to load ESRI map</p>
          <p className="text-red-500 text-sm mt-1">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <div 
        ref={mapRef}
        className="absolute inset-0 w-full h-full border rounded"
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: `${height}px`,
          maxHeight: `${height}px`
        }}
      />
      
      {/* Status overlay */}
      <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-3 py-1 rounded text-sm z-10">
        {status}
      </div>
    </div>
  );
}; 