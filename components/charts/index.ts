/**
 * Charts Module
 *
 * Shared chart components for AI-driven visualization.
 * Export all chart types, utilities, and the data service.
 */

// Main Components
export { SharedChartPanel } from './SharedChartPanel';
export { ChartLegend, PartisanGradientLegend, SequentialGradientLegend } from './ChartLegend';
export { ChartTooltip, StandaloneTooltip } from './ChartTooltip';

// Animation Components & Utilities
export {
  AnimatedPanel,
  ChartSkeleton,
  AnimatedNumber,
  DataPointHoverEffect,
  ChartTransition,
  StaggeredList,
  PulseEffect,
  AnimatedTooltip,
  getRechartsAnimationProps,
  ANIMATION_DURATIONS,
  ANIMATION_EASINGS,
  panelVariants,
  expandVariants,
  contentVariants,
} from './ChartAnimations';
export type { RechartsAnimationProps } from './ChartAnimations';

// Data Service
export { ChartDataService, chartDataService } from './ChartDataService';

// Types
export type {
  ChartType,
  PoliticalMetric,
  GroupByField,
  ColorScheme,
  ChartConfig,
  ChartDataPoint,
  HistogramBin,
  TimeSeriesPoint,
  ChartCommandType,
  ChartCommand,
  ChartPreset,
  SharedChartPanelProps,
  BaseChartProps,
  HistogramChartProps,
  ScatterPlotProps,
  ColorScale,
} from './types';

// Type utilities
export {
  PARTISAN_COLORS,
  SEQUENTIAL_COLORS,
  CATEGORICAL_COLORS,
  COMPETITIVENESS_COLORS,
  getMetricLabel,
  getPartisanColor,
  formatChartValue,
} from './types';

// Presets
export {
  CHART_PRESETS,
  PRESET_METADATA,
  findMatchingPreset,
  getPresetConfig,
  getPresetsByCategory,
} from './presets';
export type { PresetMetadata } from './presets';
