// components/map/PocKeplerView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { UniversalData, PocDataAdapter } from '@/lib/data-adapters/poc-data-adapter';

interface PocKeplerViewProps {
  data: UniversalData;
  height: number;
}

export const PocKeplerView: React.FC<PocKeplerViewProps> = ({ data, height }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadKepler = async () => {
      if (typeof window === 'undefined') {
        setStatus('Window not available (SSR)');
        return;
      }

      try {
        setStatus('Loading Kepler.gl modules...');
        console.log('Starting Kepler.gl load...');

        // Check for Mapbox token
        if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
          throw new Error('Mapbox token not found. Please set NEXT_PUBLIC_MAPBOX_TOKEN in your environment variables.');
        }

        // Import modules with timeout
        const importWithTimeout = async (importPromise: Promise<any>, name: string, timeout = 30000) => {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout loading ${name}`)), timeout);
          });
          
          return Promise.race([importPromise, timeoutPromise]);
        };

        // Load core modules with increased timeout
        let modules;
        try {
          // Try parallel loading first
          modules = await Promise.all([
            importWithTimeout(import('@kepler.gl/components'), 'KeplerGl components', 45000),
            importWithTimeout(import('@kepler.gl/actions'), 'KeplerGl actions', 30000),
            importWithTimeout(import('redux'), 'Redux', 15000),
            importWithTimeout(import('@kepler.gl/reducers'), 'KeplerGl reducers', 30000),
            importWithTimeout(import('react-redux'), 'React Redux', 15000),
            importWithTimeout(import('react-dom/client'), 'React DOM Client', 15000)
          ]);
        } catch (parallelError) {
          console.warn('Parallel loading failed, trying sequential loading:', parallelError);
          setStatus('Retrying with sequential loading...');
          
          // Fallback to sequential loading
          try {
            modules = [
              await importWithTimeout(import('@kepler.gl/components'), 'KeplerGl components', 60000),
              await importWithTimeout(import('@kepler.gl/actions'), 'KeplerGl actions', 30000),
              await importWithTimeout(import('redux'), 'Redux', 15000),
              await importWithTimeout(import('@kepler.gl/reducers'), 'KeplerGl reducers', 30000),
              await importWithTimeout(import('react-redux'), 'React Redux', 15000),
              await importWithTimeout(import('react-dom/client'), 'React DOM Client', 15000)
            ];
          } catch (sequentialError) {
            const errorMessage = sequentialError instanceof Error ? sequentialError.message : 'Unknown error';
            throw new Error(`Failed to load Kepler.gl modules: ${errorMessage}`);
          }
        }

        const [
          { default: KeplerGl },
          { addDataToMap },
          { createStore, combineReducers, applyMiddleware },
          { default: keplerGlReducer },
          { Provider },
          { createRoot }
        ] = modules;

        setStatus('Kepler.gl modules loaded ✓');
        console.log('Kepler.gl modules loaded successfully');

        // Create Redux store
        const reducers = combineReducers({
          keplerGl: keplerGlReducer
        });

        // Initialize store with empty kepler state for our instance
        const initialState = {
          keplerGl: {
            'poc-kepler': {}
          }
        };

        let store;
        try {
          // Try to load react-palm middleware (disabled for build compatibility)
          // @ts-ignore - react-palm types not available
          // const palmModule = await importWithTimeout(import('react-palm/tasks'), 'react-palm', 5000);
          const palmModule = null; // Fallback for build compatibility
          const middlewareArray: any[] = [];
          store = createStore(reducers, initialState, applyMiddleware(...middlewareArray));
          setStatus('Redux store created with middleware ✓');
        } catch (middlewareError) {
          console.warn('Failed to load react-palm middleware, using basic store:', middlewareError);
          store = createStore(reducers, initialState);
          setStatus('Redux store created (basic) ✓');
        }

        // Convert data to Kepler format
        const keplerData = PocDataAdapter.toKeplerFormat(data);
        console.log('Kepler data converted:', {
          fields: keplerData.fields?.length,
          rows: keplerData.rows?.length,
          sampleRow: keplerData.rows?.[0]
        });

        setStatus('Data converted ✓');

        // Create Kepler component
        const KeplerComponent = () => {
          const [dimensions, setDimensions] = React.useState({ width: 800, height });
          const [dataLoaded, setDataLoaded] = React.useState(false);
          const [keplerMounted, setKeplerMounted] = React.useState(false);

          React.useEffect(() => {
            // Calculate dimensions only once
            if (containerRef.current && !keplerMounted) {
              const rect = containerRef.current.getBoundingClientRect();
              const calculatedWidth = Math.max(rect.width || 800, 600);
              setDimensions({
                width: calculatedWidth,
                height: height
              });
              setKeplerMounted(true);
              console.log('Kepler dimensions calculated:', { width: calculatedWidth, height });
            }
          }, [keplerMounted]);

          React.useEffect(() => {
            // Load data after component is mounted and stable
            if (keplerMounted && dimensions.width > 0 && !dataLoaded) {
              const loadDataTimer = setTimeout(() => {
                console.log('Loading data into mounted Kepler.gl component...');
                
                const datasetConfig = {
                  datasets: [{
                    info: { 
                      id: 'poc-data', 
                      label: data.metadata.title || 'POC Data'
                    },
                    data: keplerData
                  }],
                  options: {
                    centerMap: true,
                    readOnly: false
                  }
                };

                // Use the correct action format for Kepler.gl
                const addDataAction = addDataToMap(datasetConfig);
                
                // Ensure the action targets the correct Kepler.gl instance
                const instanceAction = {
                  ...addDataAction,
                  meta: {
                    ...addDataAction.meta,
                    id: 'poc-kepler'
                  }
                };

                console.log('Dispatching action to mounted component:', instanceAction);
                store.dispatch(instanceAction);
                setDataLoaded(true);
                console.log('✅ Data loaded into mounted Kepler.gl component');

                // Verify data was loaded
                setTimeout(() => {
                  const state = store.getState();
                  console.log('Post-mount store state:', {
                    keplerGlState: state.keplerGl?.['poc-kepler'],
                    hasVisState: !!state.keplerGl?.['poc-kepler']?.visState,
                    datasets: state.keplerGl?.['poc-kepler']?.visState?.datasets || 'none',
                    layers: state.keplerGl?.['poc-kepler']?.visState?.layers || 'none'
                  });
                }, 500);
              }, 2000); // Increased delay to ensure stability

              return () => clearTimeout(loadDataTimer);
            }
          }, [keplerMounted, dimensions, dataLoaded]);

          // Prevent re-renders by memoizing the component
          const keplerElement = React.useMemo(() => {
            if (!keplerMounted || dimensions.width === 0) {
              return (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Initializing Kepler.gl...</p>
                  </div>
                </div>
              );
            }

            return (
              <KeplerGl
                id="poc-kepler"
                width={dimensions.width}
                height={dimensions.height}
                mapboxApiAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                theme="light"
                appName="POC Dual Map"
                version="v1"
                initialUiState={{
                  activeSidePanel: null,
                  currentModal: null,
                  readOnly: false
                }}
              />
            );
          }, [keplerMounted, dimensions.width, dimensions.height]);

          return (
            <div 
              style={{ 
                width: '100%', 
                height: `${height}px`,
                minHeight: `${height}px`,
                maxHeight: `${height}px`,
                overflow: 'hidden',
                position: 'relative'
              }}
              className="bg-gray-50"
            >
              {keplerElement}
              
              {/* Loading indicator */}
              {keplerMounted && !dataLoaded && (
                <div className="absolute top-12 left-2 bg-blue-100 bg-opacity-90 px-3 py-1 rounded text-sm z-10">
                  Loading data...
                </div>
              )}
            </div>
          );
        };

        setStatus('Rendering Kepler.gl ✓');

        // Create a stable container that won't re-render
        const stableContainer = containerRef.current;
        if (stableContainer) {
          // Clear any existing content
          stableContainer.innerHTML = '';
          
          const root = createRoot(stableContainer);
          
          // Render with error boundary
          root.render(
            <Provider store={store}>
              <div style={{ width: '100%', height: '100%' }}>
                <KeplerComponent />
              </div>
            </Provider>
          );
          setStatus('Kepler.gl loaded successfully ✓');
        } else {
          throw new Error('Container ref is null');
        }

      } catch (error) {
        console.error('Failed to load Kepler.gl:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        setStatus('Failed to load Kepler.gl');
      }
    };

    loadKepler();
  }, [data, height]);

  if (error) {
    return (
      <div 
        style={{ width: '100%', height: `${height}px` }}
        className="flex items-center justify-center bg-red-50 border border-red-200 rounded"
      >
        <div className="text-center p-4">
          <p className="text-red-600 font-medium">Failed to load Kepler.gl</p>
          <p className="text-red-500 text-sm mt-1">Error: {error}</p>
          {error.includes('Mapbox') && (
            <div className="mt-2 text-xs text-red-400">
              Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <div 
        ref={containerRef} 
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