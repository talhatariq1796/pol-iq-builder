/**
 * Progress Heatmap Layer
 *
 * Visualizes canvassing progress as a heatmap.
 * Shows concentration of completed doors or contact rates.
 */

'use client';

import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl';
import type { HeatmapLayer } from 'react-map-gl';

export interface ProgressHeatmapLayerProps {
  progressData: Array<{
    turfId: string;
    centroid: [number, number]; // [lng, lat]
    doorsKnocked: number;
    contactsMade: number;
    contactRate: number;
    percentComplete: number;
  }>;
  metric?: 'doors' | 'contacts' | 'contact_rate' | 'completion';
  intensity?: number; // 0-1, default 0.5
  radius?: number; // pixels, default 30
  visible?: boolean;
}

// Color ramps for different metrics
const COLOR_RAMPS = {
  doors: [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    'rgba(33,102,172,0)',
    0.2,
    'rgb(103,169,207)',
    0.4,
    'rgb(209,229,240)',
    0.6,
    'rgb(253,219,199)',
    0.8,
    'rgb(239,138,98)',
    1,
    'rgb(178,24,43)',
  ],
  contacts: [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    'rgba(0,128,0,0)',
    0.2,
    'rgb(144,238,144)',
    0.4,
    'rgb(50,205,50)',
    0.6,
    'rgb(34,139,34)',
    0.8,
    'rgb(0,100,0)',
    1,
    'rgb(0,64,0)',
  ],
  contact_rate: [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    'rgba(255,255,0,0)',
    0.2,
    'rgb(255,255,128)',
    0.4,
    'rgb(255,215,0)',
    0.6,
    'rgb(255,165,0)',
    0.8,
    'rgb(255,140,0)',
    1,
    'rgb(255,69,0)',
  ],
  completion: [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    'rgba(128,128,128,0)',
    0.2,
    'rgb(200,200,200)',
    0.4,
    'rgb(173,216,230)',
    0.6,
    'rgb(135,206,235)',
    0.8,
    'rgb(70,130,180)',
    1,
    'rgb(0,0,139)',
  ],
};

export function ProgressHeatmapLayer({
  progressData,
  metric = 'doors',
  intensity = 0.5,
  radius = 30,
  visible = true,
}: ProgressHeatmapLayerProps) {
  // Convert progress data to GeoJSON points with weight
  const geojsonData = useMemo(() => {
    const features = progressData.map((item) => {
      let weight = 0;
      switch (metric) {
        case 'doors':
          weight = item.doorsKnocked;
          break;
        case 'contacts':
          weight = item.contactsMade;
          break;
        case 'contact_rate':
          weight = item.contactRate;
          break;
        case 'completion':
          weight = item.percentComplete;
          break;
      }

      return {
        type: 'Feature' as const,
        properties: {
          weight,
          turfId: item.turfId,
          doorsKnocked: item.doorsKnocked,
          contactsMade: item.contactsMade,
          contactRate: item.contactRate,
          percentComplete: item.percentComplete,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: item.centroid,
        },
      };
    });

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [progressData, metric]);

  // Heatmap layer config
  const heatmapLayer: HeatmapLayer = useMemo(
    () => ({
      id: 'progress-heatmap',
      type: 'heatmap',
      paint: {
        'heatmap-weight': ['get', 'weight'],
        'heatmap-intensity': intensity,
        'heatmap-radius': radius,
        'heatmap-opacity': 0.8,
        'heatmap-color': COLOR_RAMPS[metric] as any,
      },
    }),
    [metric, intensity, radius]
  );

  if (!visible || progressData.length === 0) return null;

  return (
    <Source id="progress-heatmap" type="geojson" data={geojsonData}>
      <Layer {...heatmapLayer} />
    </Source>
  );
}

// ============================================================================
// Legend Component
// ============================================================================

interface ProgressHeatmapLegendProps {
  metric: 'doors' | 'contacts' | 'contact_rate' | 'completion';
  className?: string;
}

const METRIC_LABELS = {
  doors: 'Doors Knocked',
  contacts: 'Contacts Made',
  contact_rate: 'Contact Rate',
  completion: 'Completion %',
};

const METRIC_DESCRIPTIONS = {
  doors: 'Concentration of doors knocked',
  contacts: 'Concentration of successful contacts',
  contact_rate: 'Contact rate intensity',
  completion: 'Percent completion concentration',
};

export function ProgressHeatmapLegend({
  metric,
  className = '',
}: ProgressHeatmapLegendProps) {
  // Extract RGB colors from the color ramp
  const getGradientColors = () => {
    const ramp = COLOR_RAMPS[metric];
    // Extract color strings from the ramp (skip the interpolation syntax)
    const colors: string[] = [];
    for (let i = 0; i < ramp.length; i++) {
      if (typeof ramp[i] === 'string' && (ramp[i] as string).startsWith('rgb')) {
        colors.push(ramp[i] as string);
      }
    }
    return colors;
  };

  const colors = getGradientColors();
  const gradient = `linear-gradient(to right, ${colors.join(', ')})`;

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <h3 className="font-semibold text-xs mb-2">{METRIC_LABELS[metric]}</h3>
      <p className="text-xs text-gray-600 mb-3">{METRIC_DESCRIPTIONS[metric]}</p>
      <div className="space-y-2">
        <div
          className="h-4 rounded border border-gray-300"
          style={{ background: gradient }}
        />
        <div className="flex justify-between text-xs text-gray-600">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Metric Selector Component
// ============================================================================

interface MetricSelectorProps {
  value: 'doors' | 'contacts' | 'contact_rate' | 'completion';
  onChange: (metric: 'doors' | 'contacts' | 'contact_rate' | 'completion') => void;
  className?: string;
}

export function MetricSelector({ value, onChange, className = '' }: MetricSelectorProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <label htmlFor="metric-select" className="block text-xs font-semibold mb-2">
        Heatmap Metric
      </label>
      <select
        id="metric-select"
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value as 'doors' | 'contacts' | 'contact_rate' | 'completion'
          )
        }
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33a852]"
      >
        <option value="doors">{METRIC_LABELS.doors}</option>
        <option value="contacts">{METRIC_LABELS.contacts}</option>
        <option value="contact_rate">{METRIC_LABELS.contact_rate}</option>
        <option value="completion">{METRIC_LABELS.completion}</option>
      </select>
      <p className="text-xs text-gray-600 mt-2">{METRIC_DESCRIPTIONS[value]}</p>
    </div>
  );
}

// ============================================================================
// Combined Control Panel Component
// ============================================================================

interface ProgressHeatmapControlsProps {
  metric: 'doors' | 'contacts' | 'contact_rate' | 'completion';
  onMetricChange: (metric: 'doors' | 'contacts' | 'contact_rate' | 'completion') => void;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  intensity?: number;
  onIntensityChange?: (intensity: number) => void;
  radius?: number;
  onRadiusChange?: (radius: number) => void;
  className?: string;
}

export function ProgressHeatmapControls({
  metric,
  onMetricChange,
  visible = true,
  onVisibilityChange,
  intensity = 0.5,
  onIntensityChange,
  radius = 30,
  onRadiusChange,
  className = '',
}: ProgressHeatmapControlsProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Metric Selector */}
      <MetricSelector value={metric} onChange={onMetricChange} />

      {/* Visibility and Settings Controls */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="space-y-3">
          {/* Visibility Toggle */}
          {onVisibilityChange && (
            <div className="flex items-center justify-between">
              <label htmlFor="layer-visible" className="text-xs font-medium">
                Show Heatmap
              </label>
              <input
                id="layer-visible"
                type="checkbox"
                checked={visible}
                onChange={(e) => onVisibilityChange(e.target.checked)}
                className="w-4 h-4 text-[#33a852] border-gray-300 rounded focus:ring-[#33a852]"
              />
            </div>
          )}

          {/* Intensity Slider */}
          {onIntensityChange && (
            <div>
              <label htmlFor="layer-intensity" className="text-xs font-medium block mb-1">
                Intensity: {Math.round(intensity * 100)}%
              </label>
              <input
                id="layer-intensity"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={intensity}
                onChange={(e) => onIntensityChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
              />
            </div>
          )}

          {/* Radius Slider */}
          {onRadiusChange && (
            <div>
              <label htmlFor="layer-radius" className="text-xs font-medium block mb-1">
                Radius: {radius}px
              </label>
              <input
                id="layer-radius"
                type="range"
                min="10"
                max="100"
                step="5"
                value={radius}
                onChange={(e) => onRadiusChange(parseInt(e.target.value, 10))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <ProgressHeatmapLegend metric={metric} />
    </div>
  );
}

export default ProgressHeatmapLayer;
