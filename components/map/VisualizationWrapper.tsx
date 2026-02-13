import React, { useState, useEffect, useRef } from 'react';
import { EsriToKeplerAdapter, UniversalData } from '@/lib/data-adapters/esri-to-kepler-adapter';
import SplitScreenDragBar from './SplitScreenDragBar';
import KeplerMapView from './KeplerMapView';
import SimpleKeplerView from './SimpleKeplerView';
import KeplerErrorBoundary from './KeplerErrorBoundary';

interface VisualizationWrapperProps {
  children: React.ReactNode;
  mapView: __esri.MapView | null;
  containerHeight?: number;
  sidebarWidth?: number;
  visualizationResult?: any; // Pass visualization result from parent
}

export const VisualizationWrapper: React.FC<VisualizationWrapperProps> = ({
  children,
  mapView,
  containerHeight = 600,
  sidebarWidth = 600,
  visualizationResult
}) => {
  const [visualizationData, setVisualizationData] = useState<UniversalData | null>(null);
  const [showSplitScreen, setShowSplitScreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState(100); // Start at 100% (fully right)
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Monitor for visualization result changes from parent
  useEffect(() => {
    // Wrap everything in try-catch to prevent any errors from causing refresh
    try {
      if (visualizationResult?.layer?.source) {
    
        
        try {
          // Convert to universal data format
          const universalData = EsriToKeplerAdapter.fromVisualizationResult(visualizationResult);
          
          setVisualizationData(universalData);
          setShowSplitScreen(true);
          setError(null);
          
          console.log('✅ [SPLIT] Data converted successfully:', universalData.features.length, 'features');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to convert visualization';
          console.error('❌ [SPLIT] Conversion error:', errorMessage);
          setError(errorMessage);
          // Don't show split screen if conversion fails
          setShowSplitScreen(false);
        }
      } else {
        // No visualization result, hide split screen
        setShowSplitScreen(false);
        setVisualizationData(null);
        setError(null);
        setDragPosition(100); // Reset to full ESRI view
      }
    } catch (err) {
      console.error('💥 [SPLIT] Unexpected error:', err);
      // Reset to safe state
      setShowSplitScreen(false);
      setVisualizationData(null);
      setError(null);
      setDragPosition(100);
    }
  }, [visualizationResult]);

  // Handle drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - containerRect.left;
    const percentage = (relativeX / containerRect.width) * 100;
    
    // Constrain between 0% and 100%
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    setDragPosition(clampedPercentage);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle mouse events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Handle Kepler errors
  const handleKeplerError = (error: Error) => {
    console.error('[VisualizationWrapper] Kepler error:', error);
    setError(error.message);
    // On Kepler error, hide split screen to prevent page refresh
    setShowSplitScreen(false);
    setDragPosition(100); // Reset to full ESRI view
  };

  // Calculate the available width (excluding sidebar)
  const availableWidth = typeof window !== 'undefined' ? window.innerWidth - sidebarWidth - 64 : 800; // 64px for left toolbar

  // If we have visualization data, show the map with drag bar at sidebar boundary
  if (showSplitScreen && visualizationData) {
    return (
      <div className="relative w-full h-full">
        {error && (
          <div className="absolute top-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-10">
            <strong>Visualization Error:</strong> {error}
          </div>
        )}
        
        <div 
          ref={containerRef}
          className="relative w-full h-full overflow-hidden"
          style={{ height: containerHeight }}
        >
          {/* ESRI Map (takes up the available space minus Kepler width) */}
          <div 
            className="absolute top-0 left-0 h-full transition-all duration-100 ease-out"
            style={{ 
              width: `${(dragPosition / 100) * availableWidth}px`
            }}
          >
            {children}
          </div>

          {/* Kepler Map (appears from the right, between map and sidebar) */}
          {dragPosition < 100 && (
            <div 
              className="absolute top-0 h-full transition-all duration-100 ease-out"
              style={{ 
                left: `${(dragPosition / 100) * availableWidth}px`,
                width: `${((100 - dragPosition) / 100) * availableWidth}px`
              }}
            >
              <div className="w-full h-full">
                {/* Kepler component with proper width */}
                <div className="w-full h-full">
                  {/* Temporarily use SimpleKeplerView while debugging Kepler.gl loading */}
                  <SimpleKeplerView
                    data={visualizationData}
                    height={containerHeight}
                    width={((100 - dragPosition) / 100) * availableWidth}
                    onError={handleKeplerError}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Drag Bar - positioned at the boundary */}
          <div
            className={`absolute top-0 h-full w-1 bg-blue-500 cursor-col-resize transition-all duration-100 ease-out hover:w-2 hover:bg-blue-600 ${
              isDragging ? 'w-2 bg-blue-600' : ''
            }`}
            style={{ 
              left: `${(dragPosition / 100) * availableWidth - 2}px`
            }}
            onMouseDown={handleMouseDown}
          >
            {/* Drag Handle */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors">
              <div className="w-1 h-8 bg-white rounded-full opacity-60"></div>
            </div>
          </div>

          {/* Instructions Overlay */}
          {dragPosition > 95 && (
            <div 
              className="absolute top-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm flex items-center space-x-2 animate-pulse"
              style={{ right: `${sidebarWidth + 20}px` }}
            >
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Drag the bar left to reveal Kepler.gl view</span>
            </div>
          )}

          {/* View Indicators */}
          <div className="absolute bottom-4 left-4 flex space-x-2">
            <div className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              dragPosition > 50 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              📊 ESRI ({Math.round(dragPosition)}%)
            </div>
            {dragPosition < 100 && (
              <div className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                dragPosition < 50 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                🌍 Kepler ({Math.round(100 - dragPosition)}%)
              </div>
            )}
          </div>

          {/* Reset Button */}
          {dragPosition < 100 && (
            <div className="absolute bottom-4 right-4">
              <button
                onClick={() => setDragPosition(100)}
                className="bg-gray-800 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors"
              >
                Reset to ESRI
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: show normal map view
  return <>{children}</>;
};

export default VisualizationWrapper; 