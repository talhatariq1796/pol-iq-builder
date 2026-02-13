/**
 * ChartLegend
 *
 * Shared legend component for charts with support for different color schemes.
 */

'use client';

import React from 'react';
import type { ChartConfig, ChartDataPoint, ColorScheme } from './types';
import {
  PARTISAN_COLORS,
  SEQUENTIAL_COLORS,
  CATEGORICAL_COLORS,
  getPartisanColor,
} from './types';

// ============================================================================
// Props
// ============================================================================

interface ChartLegendProps {
  /** Chart configuration */
  config: ChartConfig;
  /** Chart data for categorical legends */
  data?: ChartDataPoint[];
  /** Custom color mapping */
  colorMap?: Record<string, string>;
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// ChartLegend Component
// ============================================================================

export function ChartLegend({
  config,
  data = [],
  colorMap,
  orientation = 'horizontal',
  className = '',
}: ChartLegendProps) {
  // Determine legend type based on config
  const legendItems = getLegendItems(config, data, colorMap);

  if (legendItems.length === 0) return null;

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={`
        ${isVertical ? 'flex flex-col gap-1' : 'flex flex-wrap gap-x-3 gap-y-1'}
        mt-2 text-xs text-gray-600 dark:text-gray-400
        ${className}
      `}
    >
      {legendItems.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="truncate max-w-[100px]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Partisan Gradient Legend
// ============================================================================

interface GradientLegendProps {
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Label for min value */
  minLabel?: string;
  /** Label for max value */
  maxLabel?: string;
  /** Show numeric values */
  showValues?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function PartisanGradientLegend({
  min = -40,
  max = 40,
  minLabel = 'D+40',
  maxLabel = 'R+40',
  showValues = true,
  className = '',
}: GradientLegendProps) {
  const stops = [
    { position: 0, color: PARTISAN_COLORS.strongD },
    { position: 25, color: PARTISAN_COLORS.leanD },
    { position: 45, color: PARTISAN_COLORS.slightD },
    { position: 50, color: PARTISAN_COLORS.tossUp },
    { position: 55, color: PARTISAN_COLORS.slightR },
    { position: 75, color: PARTISAN_COLORS.leanR },
    { position: 100, color: PARTISAN_COLORS.strongR },
  ];

  const gradientStyle = {
    background: `linear-gradient(to right, ${stops.map(s => `${s.color} ${s.position}%`).join(', ')})`,
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="h-3 w-full rounded" style={gradientStyle} />
      {showValues && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{minLabel}</span>
          <span>Even</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sequential Gradient Legend
// ============================================================================

interface SequentialLegendProps {
  /** Color scheme name */
  scheme: 'blue' | 'green' | 'orange' | 'purple' | 'teal';
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Label for metric */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

export function SequentialGradientLegend({
  scheme,
  min = 0,
  max = 100,
  label = '',
  className = '',
}: SequentialLegendProps) {
  const colors = SEQUENTIAL_COLORS[scheme] || SEQUENTIAL_COLORS.blue;

  const gradientStyle = {
    background: `linear-gradient(to right, ${colors.join(', ')})`,
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <div className="h-3 w-full rounded" style={gradientStyle} />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

interface LegendItem {
  label: string;
  color: string;
}

function getLegendItems(
  config: ChartConfig,
  data: ChartDataPoint[],
  colorMap?: Record<string, string>
): LegendItem[] {
  // Use custom color map if provided
  if (colorMap) {
    return Object.entries(colorMap).map(([label, color]) => ({ label, color }));
  }

  // For pie/donut charts, show data categories
  if ((config.type === 'pie' || config.type === 'donut') && data.length > 0) {
    const colors = getColorArray(config.colorScheme);
    return data.map((d, i) => ({
      label: d.name,
      color: colors[i % colors.length],
    }));
  }

  // For grouped/stacked charts, show categories
  if ((config.type === 'grouped' || config.type === 'stacked') && config.metrics) {
    const colors = getColorArray(config.colorScheme);
    return config.metrics.map((metric, i) => ({
      label: formatMetricLabel(metric),
      color: colors[i % colors.length],
    }));
  }

  // For partisan-colored charts
  if (config.colorScheme === 'partisan' || config.metric === 'partisan_lean') {
    return [
      { label: 'Strong D', color: PARTISAN_COLORS.strongD },
      { label: 'Lean D', color: PARTISAN_COLORS.leanD },
      { label: 'Toss-up', color: PARTISAN_COLORS.tossUp },
      { label: 'Lean R', color: PARTISAN_COLORS.leanR },
      { label: 'Strong R', color: PARTISAN_COLORS.strongR },
    ];
  }

  // For competitiveness
  if (config.groupBy === 'competitiveness') {
    return [
      { label: 'Safe D', color: PARTISAN_COLORS.strongD },
      { label: 'Likely D', color: PARTISAN_COLORS.leanD },
      { label: 'Lean D', color: PARTISAN_COLORS.slightD },
      { label: 'Toss-up', color: PARTISAN_COLORS.tossUp },
      { label: 'Lean R', color: PARTISAN_COLORS.slightR },
      { label: 'Likely R', color: PARTISAN_COLORS.leanR },
      { label: 'Safe R', color: PARTISAN_COLORS.strongR },
    ];
  }

  // Default - no legend needed for single-series charts
  return [];
}

function getColorArray(scheme: ColorScheme | undefined): string[] {
  switch (scheme) {
    case 'partisan':
      return [PARTISAN_COLORS.leanD, PARTISAN_COLORS.tossUp, PARTISAN_COLORS.leanR];
    case 'blue':
      return [...SEQUENTIAL_COLORS.blue];
    case 'green':
      return [...SEQUENTIAL_COLORS.green];
    case 'orange':
      return [...SEQUENTIAL_COLORS.orange];
    case 'purple':
      return [...SEQUENTIAL_COLORS.purple];
    case 'categorical':
    default:
      return [...CATEGORICAL_COLORS];
  }
}

function formatMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    gotv_priority: 'GOTV',
    persuasion_opportunity: 'Persuasion',
    swing_potential: 'Swing',
    partisan_lean: 'Partisan',
    combined_score: 'Combined',
    dem_affiliation_pct: 'Democratic',
    rep_affiliation_pct: 'Republican',
    ind_affiliation_pct: 'Independent',
  };
  return labels[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default ChartLegend;
