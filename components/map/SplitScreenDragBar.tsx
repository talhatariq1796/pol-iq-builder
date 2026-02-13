import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UniversalData } from '@/lib/data-adapters/esri-to-kepler-adapter';
import KeplerMapView from './KeplerMapView';

interface SplitScreenDragBarProps {
  esriMapComponent: React.ReactNode;
  visualizationData: UniversalData;
  containerHeight: number;
  onError?: (error: Error) => void;
}

export const SplitScreenDragBar: React.FC<SplitScreenDragBarProps> = ({
  esriMapComponent,
  visualizationData,
  containerHeight,
  onError
}) => {
  const [dragPosition, setDragPosition] = useState(100); // Start at 100% (fully right)
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragBarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - containerRect.left;
    const percentage = (relativeX / containerRect.width) * 100;
    
    // Constrain between 0% and 100%
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    setDragPosition(clampedPercentage);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Calculate widths
  const esriWidth = `${dragPosition}%`;
  const keplerWidth = `${100 - dragPosition}%`;
  const showKepler = dragPosition < 100;

  return (
    <div 
      ref={containerRef}
      className="relative w-full bg-gray-100 overflow-hidden"
      style={{ height: containerHeight }}
    >
      {/* ESRI Map (Left/Main) */}
      <div 
        className="absolute top-0 left-0 h-full transition-all duration-100 ease-out"
        style={{ width: esriWidth }}
      >
        {esriMapComponent}
      </div>

      {/* Kepler Map (Right) - Only render when visible */}
      {showKepler && (
        <div 
          className="absolute top-0 right-0 h-full transition-all duration-100 ease-out"
          style={{ width: keplerWidth }}
        >
          <KeplerMapView
            data={visualizationData}
            height={containerHeight}
            width={parseInt(keplerWidth)}
            onError={onError}
          />
        </div>
      )}

      {/* Drag Bar */}
      <div
        ref={dragBarRef}
        className={`absolute top-0 h-full w-1 bg-blue-500 cursor-col-resize transition-all duration-100 ease-out hover:w-2 hover:bg-blue-600 ${
          isDragging ? 'w-2 bg-blue-600' : ''
        }`}
        style={{ left: `calc(${dragPosition}% - 2px)` }}
        onMouseDown={handleMouseDown}
      >
        {/* Drag Handle */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors">
          <div className="w-1 h-8 bg-white rounded-full opacity-60"></div>
        </div>
      </div>

      {/* Instructions Overlay - Only show when drag bar is visible */}
      {dragPosition > 95 && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm flex items-center space-x-2 animate-pulse">
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
        {showKepler && (
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
  );
};

export default SplitScreenDragBar; 