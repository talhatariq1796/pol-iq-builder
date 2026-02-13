/**
 * ChartTooltip
 *
 * Custom tooltip component for Recharts with political data formatting.
 */

'use client';

import React from 'react';
import { Tooltip } from 'recharts';
import type { ChartConfig, PoliticalMetric } from './types';
import { formatChartValue, getMetricLabel } from './types';

// Define tooltip payload types inline to avoid recharts export issues
interface TooltipPayload {
  value?: number;
  name?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
  color?: string;
}

// ============================================================================
// Props
// ============================================================================

interface ChartTooltipProps {
  /** Chart configuration for formatting */
  config: ChartConfig;
}

// ============================================================================
// Custom Tooltip Content
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  config: ChartConfig;
}

function CustomTooltipContent({ active, payload, label, config }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload as {
    name?: string;
    secondaryValue?: number;
    colorValue?: number;
    sizeValue?: number;
    bin?: { percentage: number };
    rawData?: { count?: number; totalPop?: number };
  } | undefined;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 text-sm max-w-[250px]">
      {/* Title/Label */}
      <p className="font-medium text-gray-900 dark:text-gray-100 mb-1 truncate">
        {data?.name || label || 'Unknown'}
      </p>

      {/* Values */}
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          const value = entry.value as number;
          const metric = getMetricForEntry(entry, config);

          return (
            <div key={index} className="flex items-center justify-between gap-2">
              <span className="text-gray-500 dark:text-gray-400">
                {getMetricLabel(metric)}:
              </span>
              <span className="font-medium" style={{ color: entry.color }}>
                {formatChartValue(value, metric)}
              </span>
            </div>
          );
        })}

        {/* Secondary value for scatter plots */}
        {config.type === 'scatter' && data?.secondaryValue !== undefined && config.secondaryMetric && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 dark:text-gray-400">
              {getMetricLabel(config.secondaryMetric)}:
            </span>
            <span className="font-medium">
              {formatChartValue(data.secondaryValue, config.secondaryMetric)}
            </span>
          </div>
        )}

        {/* Color value for scatter plots */}
        {config.type === 'scatter' && data?.colorValue !== undefined && config.colorBy && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 dark:text-gray-400">
              {getMetricLabel(config.colorBy)}:
            </span>
            <span className="font-medium">
              {formatChartValue(data.colorValue, config.colorBy)}
            </span>
          </div>
        )}

        {/* Size value for scatter plots */}
        {config.type === 'scatter' && data?.sizeValue !== undefined && config.sizeBy && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 dark:text-gray-400">
              {getMetricLabel(config.sizeBy)}:
            </span>
            <span className="font-medium">
              {formatChartValue(data.sizeValue, config.sizeBy)}
            </span>
          </div>
        )}

        {/* Histogram percentage */}
        {config.type === 'histogram' && data?.bin && (
          <div className="flex items-center justify-between gap-2 text-gray-500 dark:text-gray-400">
            <span>Percentage:</span>
            <span>{data.bin.percentage.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Additional info from raw data */}
      {data?.rawData && (
        <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {data.rawData.count !== undefined && (
            <span>Precincts: {data.rawData.count}</span>
          )}
          {data.rawData.totalPop !== undefined && data.rawData.totalPop > 0 && (
            <span className="ml-2">Pop: {Math.round(data.rawData.totalPop).toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  );
}

function getMetricForEntry(
  entry: { dataKey?: string | number; name?: string },
  config: ChartConfig
): PoliticalMetric {
  // For grouped/stacked charts, the dataKey might be the metric name
  if (typeof entry.dataKey === 'string' && isValidMetric(entry.dataKey)) {
    return entry.dataKey as PoliticalMetric;
  }

  // Default to config metric
  return config.metric;
}

function isValidMetric(key: string): boolean {
  const validMetrics = [
    'partisan_lean', 'turnout', 'gotv_priority', 'persuasion_opportunity',
    'swing_potential', 'combined_score', 'population', 'registered_voters',
    'median_income', 'college_pct', 'diversity_index', 'dem_affiliation_pct',
    'rep_affiliation_pct', 'ind_affiliation_pct', 'donor_total', 'donor_count',
    'avg_donation', 'precinct_count',
  ];
  return validMetrics.includes(key);
}

// ============================================================================
// ChartTooltip Component
// ============================================================================

export function ChartTooltip({ config }: ChartTooltipProps) {
  if (!config.showTooltip) return null;

  return (
    <Tooltip
      content={(props: Omit<CustomTooltipProps, 'config'>) => (
        <CustomTooltipContent {...props} config={config} />
      )}
      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
    />
  );
}

// ============================================================================
// Standalone Tooltip for External Use
// ============================================================================

interface StandaloneTooltipProps {
  /** Data point to display */
  data: {
    name: string;
    value: number;
    secondaryValue?: number;
    colorValue?: number;
    sizeValue?: number;
    rawData?: Record<string, unknown>;
  };
  /** Chart configuration for formatting */
  config: ChartConfig;
  /** Position */
  position?: { x: number; y: number };
  /** Additional CSS classes */
  className?: string;
}

export function StandaloneTooltip({
  data,
  config,
  position,
  className = '',
}: StandaloneTooltipProps) {
  const style = position
    ? { position: 'absolute' as const, left: position.x, top: position.y }
    : {};

  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 text-sm z-50 ${className}`}
      style={style}
    >
      <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{data.name}</p>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500 dark:text-gray-400">{getMetricLabel(config.metric)}:</span>
          <span className="font-medium">{formatChartValue(data.value, config.metric)}</span>
        </div>

        {data.secondaryValue !== undefined && config.secondaryMetric && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 dark:text-gray-400">
              {getMetricLabel(config.secondaryMetric)}:
            </span>
            <span className="font-medium">
              {formatChartValue(data.secondaryValue, config.secondaryMetric)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChartTooltip;
