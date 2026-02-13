import React, { useEffect, useRef, useState } from 'react';
import { UniversalData, EsriToKeplerAdapter } from '@/lib/data-adapters/esri-to-kepler-adapter';

interface KeplerMapViewProps {
  data: UniversalData;
  height: number;
  width: number;
  onError?: (error: Error) => void;
}

export const KeplerMapView: React.FC<KeplerMapViewProps> = ({ 
  data, 
  height, 
  width, 
  onError 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keplerInstance, setKeplerInstance] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadKepler = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        setIsLoading(true);
        setError(null);

        // Dynamic imports to avoid SSR issues
        const [
          { default: KeplerGl },
          { addDataToMap },
          { createStore, combineReducers },
          { default: keplerGlReducer },
          { Provider },
          { createRoot }
        ] = await Promise.all([
          import('@kepler.gl/components'),
          import('@kepler.gl/actions'),
          import('redux'),
          import('@kepler.gl/reducers'),
          import('react-redux'),
          import('react-dom/client')
        ]);

        if (!isMounted) return;

        // Create Redux store
        const reducers = combineReducers({
          keplerGl: keplerGlReducer
        });

        const store = createStore(reducers, {});

        // Convert data to Kepler format
        const keplerData = EsriToKeplerAdapter.toKeplerFormat(data);
        const keplerConfig = EsriToKeplerAdapter.createKeplerConfig(data);

        // Create Kepler component
        const KeplerComponent = () => {
          useEffect(() => {
            // Add data to map
            store.dispatch(addDataToMap({
              datasets: {
                info: { 
                  id: 'visualization-data', 
                  label: data.metadata.title 
                },
                data: keplerData
              },
              options: { 
                centerMap: true, 
                readOnly: false 
              },
              config: keplerConfig.config
            }));
          }, []);

          return (
            <KeplerGl
              id="split-screen-kepler"
              width={width}
              height={height}
              mapboxApiAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              theme="light"
            />
          );
        };

        // Render to container
        if (containerRef.current && isMounted) {
          const root = createRoot(containerRef.current);
          root.render(
            <Provider store={store}>
              <KeplerComponent />
            </Provider>
          );
          
          setKeplerInstance(root);
          setIsLoading(false);
        }
      } catch (err) {
        if (!isMounted) return;
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to load Kepler.gl';
        setError(errorMessage);
        setIsLoading(false);
        
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    };

    loadKepler();

    return () => {
      isMounted = false;
      if (keplerInstance) {
        try {
          keplerInstance.unmount();
        } catch (err) {
          console.warn('Error unmounting Kepler instance:', err);
        }
      }
    };
  }, [data, height, width, onError]);

  if (isLoading) {
    return (
      <div 
        style={{ width, height }}
        className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading Kepler.gl...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        style={{ width, height }}
        className="flex items-center justify-center bg-red-50 border border-red-200 rounded"
      >
        <div className="text-center p-4">
          <div className="text-red-600 mb-2">⚠️ Error Loading Kepler.gl</div>
          <p className="text-sm text-red-500">{error}</p>
          <button 
            onClick={() => {
              // Reset error state and trigger re-render
              setError(null);
              setIsLoading(true);
              // Force component to re-initialize by changing a key or state
              setKeplerInstance(null);
            }}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      style={{ width, height }}
      className="kepler-map-container"
    />
  );
};

export default KeplerMapView; 