'use client';

/**
 * MiniMapPanel - Lightweight map component for tool pages
 *
 * Part of Phase 3: Unified AI-First Architecture
 * Simplified map without analysis panel, for embedding in dashboards
 */

import React, { useState, useCallback } from 'react';
import PoliticalMapContainer from './PoliticalMapContainer';
import type { MapCommand } from '@/lib/ai-native/types';

interface PrecinctInfo {
  precinctId: string;
  precinctName: string;
  county: string;
  attributes?: Record<string, unknown>;
}

interface MiniMapPanelProps {
  /** Map command to execute */
  mapCommand?: MapCommand | null;
  /** Callback when precinct is selected */
  onPrecinctSelected?: (precinct: PrecinctInfo | null) => void;
  /** Height of the panel */
  height?: string | number;
  /** Show layer toggle buttons */
  showLayerToggle?: boolean;
  /** Default active layer */
  defaultLayer?: 'choropleth' | 'heatmap' | 'none';
  /** Default H3 metric */
  defaultMetric?: string;
  /** Called when map is ready */
  onMapReady?: () => void;
  /** Custom class name */
  className?: string;
}

export default function MiniMapPanel({
  mapCommand,
  onPrecinctSelected,
  height = '400px',
  showLayerToggle = true,
  defaultLayer = 'none',
  defaultMetric = 'partisan_lean',
  onMapReady,
  className = '',
}: MiniMapPanelProps) {
  const [isMapReady, setIsMapReady] = useState(false);

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    onMapReady?.();
  }, [onMapReady]);

  // Compute height style
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 ${className}`}
      style={{ height: heightStyle }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-[#33a852]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <span className="text-xs font-semibold text-gray-700">Map View</span>
        </div>

        {/* Ready indicator */}
        {isMapReady && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#33a852]" />
            <span className="text-xs text-gray-500">Ready</span>
          </div>
        )}
      </div>

      {/* Map container - takes remaining height */}
      <div className="relative" style={{ height: 'calc(100% - 41px)' }}>
        <PoliticalMapContainer
          height="100%"
          mapCommand={mapCommand}
          onPrecinctSelected={onPrecinctSelected}
          onMapReady={handleMapReady}
          enableAIMode={true}
        />
      </div>
    </div>
  );
}
