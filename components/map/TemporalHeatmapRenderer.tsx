'use client';

/**
 * Temporal Heatmap Renderer
 *
 * Renders map layers with time-series data visualization.
 * Supports:
 * - Standard value heatmap (for slider/animated modes)
 * - Momentum heatmap (rate of change visualization)
 * - Snapshot rendering (for comparison mode)
 *
 * Works with H3 hexagons, ZIP codes, precincts, or any polygon layer.
 */

import { useEffect, useRef, useCallback } from 'react';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import Color from '@arcgis/core/Color';

import type {
  TemporalVisualizationMode,
  TemporalDataPoint,
  MomentumConfig,
  TimePeriod,
} from './TemporalMapControls';

// ============================================================================
// Types
// ============================================================================

export interface TemporalRendererConfig {
  mode: TemporalVisualizationMode;
  valueField: string;           // Field name for values (e.g., 'total_amount')
  locationField: string;        // Field name for location ID (e.g., 'zip_code')
  currentPeriod: TimePeriod;
  momentumConfig?: MomentumConfig;
  colorScheme: 'blue' | 'green' | 'purple' | 'orange' | 'diverging';
  opacity?: number;
}

export interface TemporalHeatmapRendererProps {
  layer: __esri.FeatureLayer | __esri.GeoJSONLayer;
  config: TemporalRendererConfig;
  data: TemporalDataPoint[];
  comparisonData?: TemporalDataPoint[];  // For momentum mode
  onRendererApplied?: () => void;
}

// ============================================================================
// Color Schemes
// ============================================================================

const COLOR_SCHEMES = {
  // Standard value heatmaps
  blue: [
    [239, 246, 255, 0.9],  // blue-50
    [191, 219, 254, 0.9],  // blue-200
    [96, 165, 250, 0.9],   // blue-400
    [37, 99, 235, 0.9],    // blue-600
    [30, 64, 175, 0.9],    // blue-800
  ],
  green: [
    [240, 253, 244, 0.9],  // green-50
    [187, 247, 208, 0.9],  // green-200
    [74, 222, 128, 0.9],   // green-400
    [22, 163, 74, 0.9],    // green-600
    [21, 128, 61, 0.9],    // green-800
  ],
  purple: [
    [250, 245, 255, 0.9],  // purple-50
    [233, 213, 255, 0.9],  // purple-200
    [192, 132, 252, 0.9],  // purple-400
    [147, 51, 234, 0.9],   // purple-600
    [107, 33, 168, 0.9],   // purple-800
  ],
  orange: [
    [255, 247, 237, 0.9],  // orange-50
    [254, 215, 170, 0.9],  // orange-200
    [251, 146, 60, 0.9],   // orange-400
    [234, 88, 12, 0.9],    // orange-600
    [194, 65, 12, 0.9],    // orange-800
  ],
  // Diverging scheme for momentum (red to white to green)
  diverging: {
    strongDecline: [185, 28, 28, 0.9],    // red-700
    decline: [248, 113, 113, 0.9],        // red-400
    stable: [229, 231, 235, 0.9],         // gray-200
    growth: [74, 222, 128, 0.9],          // green-400
    strongGrowth: [21, 128, 61, 0.9],     // green-700
  },
};

// ============================================================================
// Renderer Creation Functions
// ============================================================================

/**
 * Create a renderer for standard value visualization
 */
function createValueRenderer(
  data: TemporalDataPoint[],
  config: TemporalRendererConfig
): ClassBreaksRenderer {
  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values.filter((v) => v > 0), 0);

  const colors = COLOR_SCHEMES[config.colorScheme as keyof typeof COLOR_SCHEMES];
  if (!Array.isArray(colors)) {
    throw new Error(`Invalid color scheme for value renderer: ${config.colorScheme}`);
  }

  // Create 5 class breaks
  const step = (maxValue - minValue) / 5;
  const breaks = [];

  for (let i = 0; i < 5; i++) {
    const minVal = minValue + step * i;
    const maxVal = minValue + step * (i + 1);
    const color = colors[i];

    breaks.push({
      minValue: minVal,
      maxValue: maxVal,
      symbol: new SimpleFillSymbol({
        color: new Color(color),
        outline: new SimpleLineSymbol({
          color: new Color([255, 255, 255, 0.5]),
          width: 0.5,
        }),
      }),
      label: `${formatValue(minVal)} - ${formatValue(maxVal)}`,
    });
  }

  return new ClassBreaksRenderer({
    field: config.valueField,
    classBreakInfos: breaks,
    defaultSymbol: new SimpleFillSymbol({
      color: new Color([200, 200, 200, 0.5]),
      outline: new SimpleLineSymbol({
        color: new Color([150, 150, 150, 0.5]),
        width: 0.5,
      }),
    }),
    defaultLabel: 'No data',
  });
}

/**
 * Create a renderer for momentum (rate of change) visualization
 */
function createMomentumRenderer(
  currentData: TemporalDataPoint[],
  priorData: TemporalDataPoint[],
  config: TemporalRendererConfig
): ClassBreaksRenderer {
  const thresholds = config.momentumConfig?.thresholds || {
    strongDecline: -20,
    decline: -5,
    growth: 5,
    strongGrowth: 20,
  };

  const divergingColors = COLOR_SCHEMES.diverging;

  // Create breaks for momentum visualization
  const breaks = [
    {
      minValue: -100,
      maxValue: thresholds.strongDecline,
      symbol: new SimpleFillSymbol({
        color: new Color(divergingColors.strongDecline),
        outline: new SimpleLineSymbol({
          color: new Color([255, 255, 255, 0.5]),
          width: 0.5,
        }),
      }),
      label: `Strong Decline (< ${thresholds.strongDecline}%)`,
    },
    {
      minValue: thresholds.strongDecline,
      maxValue: thresholds.decline,
      symbol: new SimpleFillSymbol({
        color: new Color(divergingColors.decline),
        outline: new SimpleLineSymbol({
          color: new Color([255, 255, 255, 0.5]),
          width: 0.5,
        }),
      }),
      label: `Decline (${thresholds.strongDecline}% to ${thresholds.decline}%)`,
    },
    {
      minValue: thresholds.decline,
      maxValue: thresholds.growth,
      symbol: new SimpleFillSymbol({
        color: new Color(divergingColors.stable),
        outline: new SimpleLineSymbol({
          color: new Color([150, 150, 150, 0.5]),
          width: 0.5,
        }),
      }),
      label: `Stable (${thresholds.decline}% to ${thresholds.growth}%)`,
    },
    {
      minValue: thresholds.growth,
      maxValue: thresholds.strongGrowth,
      symbol: new SimpleFillSymbol({
        color: new Color(divergingColors.growth),
        outline: new SimpleLineSymbol({
          color: new Color([255, 255, 255, 0.5]),
          width: 0.5,
        }),
      }),
      label: `Growth (${thresholds.growth}% to ${thresholds.strongGrowth}%)`,
    },
    {
      minValue: thresholds.strongGrowth,
      maxValue: 200, // Cap at 200% growth
      symbol: new SimpleFillSymbol({
        color: new Color(divergingColors.strongGrowth),
        outline: new SimpleLineSymbol({
          color: new Color([255, 255, 255, 0.5]),
          width: 0.5,
        }),
      }),
      label: `Strong Growth (> ${thresholds.strongGrowth}%)`,
    },
  ];

  return new ClassBreaksRenderer({
    field: 'momentum_pct', // This field needs to be added to the layer
    classBreakInfos: breaks,
    defaultSymbol: new SimpleFillSymbol({
      color: new Color([200, 200, 200, 0.5]),
      outline: new SimpleLineSymbol({
        color: new Color([150, 150, 150, 0.5]),
        width: 0.5,
      }),
    }),
    defaultLabel: 'No comparison data',
  });
}

// ============================================================================
// Data Update Functions
// ============================================================================

/**
 * Update layer features with temporal data
 * This is called when the time period changes
 */
export async function updateLayerWithTemporalData(
  layer: __esri.FeatureLayer,
  data: TemporalDataPoint[],
  config: TemporalRendererConfig,
  comparisonData?: TemporalDataPoint[]
): Promise<void> {
  // Create a map of location ID to values
  const dataMap = new Map(data.map((d) => [d.locationId, d]));
  const priorMap = comparisonData
    ? new Map(comparisonData.map((d) => [d.locationId, d]))
    : null;

  // Query all features and update their attributes
  const query = layer.createQuery();
  query.where = '1=1';
  query.outFields = ['*'];

  const featureSet = await layer.queryFeatures(query);

  const updates = featureSet.features.map((feature) => {
    const locationId = feature.attributes[config.locationField];
    const currentData = dataMap.get(locationId);
    const priorData = priorMap?.get(locationId);

    // Calculate values
    const value = currentData?.value || 0;
    let momentumPct = 0;

    if (priorData && priorData.value > 0) {
      momentumPct = ((value - priorData.value) / priorData.value) * 100;
    } else if (value > 0 && !priorData) {
      momentumPct = 100; // New location = 100% growth
    }

    // Update feature attributes
    feature.attributes[config.valueField] = value;
    feature.attributes['momentum_pct'] = momentumPct;
    feature.attributes['prior_value'] = priorData?.value || 0;
    feature.attributes['period'] = config.currentPeriod.key;

    return feature;
  });

  // Apply edits (if layer supports it) or use client-side rendering
  // @ts-ignore - ArcGIS FeatureLayer capabilities structure varies by version
  if (layer.capabilities?.editing?.supportsEditing || layer.capabilities?.operations?.supportsEditing) {
    await layer.applyEdits({ updateFeatures: updates });
  } else {
    // For non-editable layers, we need to use a different approach
    // Update the layer's renderer to use the new data
    console.log('[TemporalHeatmap] Layer does not support editing, updating renderer only');
  }
}

/**
 * Create a GeoJSON blob URL with temporal data merged in
 * Used for layers that don't support direct editing
 */
export function createTemporalGeoJSON(
  baseGeoJSON: GeoJSON.FeatureCollection,
  data: TemporalDataPoint[],
  config: TemporalRendererConfig,
  comparisonData?: TemporalDataPoint[]
): string {
  const dataMap = new Map(data.map((d) => [d.locationId, d]));
  const priorMap = comparisonData
    ? new Map(comparisonData.map((d) => [d.locationId, d]))
    : null;

  const updatedFeatures = baseGeoJSON.features.map((feature) => {
    const locationId = feature.properties?.[config.locationField];
    const currentData = dataMap.get(locationId);
    const priorData = priorMap?.get(locationId);

    const value = currentData?.value || 0;
    let momentumPct = 0;

    if (priorData && priorData.value > 0) {
      momentumPct = ((value - priorData.value) / priorData.value) * 100;
    } else if (value > 0 && !priorData) {
      momentumPct = 100;
    }

    return {
      ...feature,
      properties: {
        ...feature.properties,
        [config.valueField]: value,
        momentum_pct: momentumPct,
        prior_value: priorData?.value || 0,
        period: config.currentPeriod.key,
        ...currentData?.metadata,
      },
    };
  });

  const updatedGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: updatedFeatures,
  };

  const blob = new Blob([JSON.stringify(updatedGeoJSON)], { type: 'application/json' });
  return URL.createObjectURL(blob);
}

// ============================================================================
// Component
// ============================================================================

export function TemporalHeatmapRenderer({
  layer,
  config,
  data,
  comparisonData,
  onRendererApplied,
}: TemporalHeatmapRendererProps) {
  const prevConfigRef = useRef<TemporalRendererConfig | null>(null);

  // Apply renderer when config or data changes
  useEffect(() => {
    if (!layer || !data || data.length === 0) return;

    const applyRenderer = async () => {
      try {
        let renderer: ClassBreaksRenderer;

        if (config.mode === 'momentum' && comparisonData) {
          renderer = createMomentumRenderer(data, comparisonData, config);
        } else {
          renderer = createValueRenderer(data, config);
        }

        // Apply opacity
        if (config.opacity !== undefined) {
          layer.opacity = config.opacity;
        }

        // Apply renderer to layer
        layer.renderer = renderer;

        // Store config for comparison
        prevConfigRef.current = config;

        // Notify parent
        onRendererApplied?.();
      } catch (error) {
        console.error('[TemporalHeatmapRenderer] Error applying renderer:', error);
      }
    };

    applyRenderer();
  }, [layer, config, data, comparisonData]);

  // This component doesn't render anything - it just manages the layer renderer
  return null;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Generate popup template for temporal data
 */
export function createTemporalPopupTemplate(
  config: TemporalRendererConfig,
  includeHistory: boolean = false
): __esri.PopupTemplate {
  const PopupTemplate = require('@arcgis/core/PopupTemplate').default;

  const content: string[] = [
    `<div class="temporal-popup">`,
    `<p><strong>Period:</strong> {period}</p>`,
    `<p><strong>Current Value:</strong> {${config.valueField}:formatValue}</p>`,
  ];

  if (config.mode === 'momentum') {
    content.push(
      `<p><strong>Change:</strong> {momentum_pct}%</p>`,
      `<p><strong>Prior Value:</strong> {prior_value:formatValue}</p>`
    );
  }

  content.push(`</div>`);

  return new PopupTemplate({
    title: `{${config.locationField}}`,
    content: content.join('\n'),
    fieldInfos: [
      {
        fieldName: config.valueField,
        format: { digitSeparator: true, places: 0 },
      },
      {
        fieldName: 'momentum_pct',
        format: { places: 1 },
      },
      {
        fieldName: 'prior_value',
        format: { digitSeparator: true, places: 0 },
      },
    ],
  });
}

export default TemporalHeatmapRenderer;
