/**
 * Chart Types and Configurations
 *
 * Type definitions for the SharedChartPanel system.
 * These types enable AI-driven chart recommendations based on query patterns.
 */

// ============================================================================
// Chart Types
// ============================================================================

export type ChartType =
  | 'bar'           // Vertical bar chart
  | 'horizontalBar' // Horizontal bar (rankings)
  | 'line'          // Line chart
  | 'area'          // Area chart (filled line)
  | 'scatter'       // Scatter plot (correlations)
  | 'histogram'     // Distribution histogram
  | 'pie'           // Pie chart
  | 'donut'         // Donut chart
  | 'grouped'       // Grouped bar (side-by-side comparison)
  | 'stacked';      // Stacked bar (composition)

// ============================================================================
// Metrics
// ============================================================================

export type PoliticalMetric =
  // Targeting scores
  | 'partisan_lean'
  | 'turnout'
  | 'gotv_priority'
  | 'persuasion_opportunity'
  | 'swing_potential'
  | 'combined_score'
  // Demographics
  | 'population'
  | 'registered_voters'
  | 'median_income'
  | 'college_pct'
  | 'diversity_index'
  // Party affiliation
  | 'dem_affiliation_pct'
  | 'rep_affiliation_pct'
  | 'ind_affiliation_pct'
  // Donor metrics
  | 'donor_total'
  | 'donor_count'
  | 'avg_donation'
  // Counts
  | 'precinct_count';

export type GroupByField =
  | 'precinct'
  | 'municipality'
  | 'district'
  | 'state_house'
  | 'competitiveness'
  | 'targeting_strategy'
  | 'party'
  | 'month'
  | 'year';

export type ColorScheme =
  | 'partisan'      // Blue-Purple-Red diverging
  | 'sequential'    // Single-hue gradient
  | 'diverging'     // Two-color diverging
  | 'categorical'   // Distinct colors
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple';

// ============================================================================
// Chart Configuration
// ============================================================================

export interface ChartConfig {
  /** Chart type to render */
  type: ChartType;

  /** Chart title */
  title?: string;

  /** Chart subtitle/description */
  subtitle?: string;

  // Data configuration
  /** Primary metric to display */
  metric: PoliticalMetric;

  /** Secondary metric (for scatter plots, grouped bars) */
  secondaryMetric?: PoliticalMetric;

  /** How to group/aggregate data */
  groupBy?: GroupByField;

  /** For scatter plots: metric to determine point color */
  colorBy?: PoliticalMetric;

  /** For scatter plots: metric to determine point size */
  sizeBy?: PoliticalMetric;

  /** For stacked charts: field to stack by */
  stackBy?: GroupByField;

  /** Multiple metrics for grouped/stacked charts */
  metrics?: PoliticalMetric[];

  // Filtering & sorting
  /** Limit to top N results */
  limit?: number;

  /** Sort order */
  sortOrder?: 'asc' | 'desc';

  /** Filter to specific precincts */
  filterPrecincts?: string[];

  /** Filter to specific municipalities */
  filterMunicipalities?: string[];

  // Histogram options
  /** Number of bins for histogram */
  bins?: number;

  // Styling
  /** Color scheme to use */
  colorScheme?: ColorScheme;

  /** Show legend */
  showLegend?: boolean;

  /** Show tooltips on hover */
  showTooltip?: boolean;

  /** Show grid lines */
  showGrid?: boolean;

  /** Show data point markers (for line charts) */
  showMarkers?: boolean;

  /** Enable animations */
  animate?: boolean;

  /** Show summary statistics (count, avg, range) */
  showSummary?: boolean;

  /** Chart height in pixels */
  height?: number;
}

// ============================================================================
// Chart Data
// ============================================================================

export interface ChartDataPoint {
  /** Display name/label */
  name: string;

  /** Primary value */
  value: number;

  /** Secondary value (for scatter plots) */
  secondaryValue?: number;

  /** Value for color encoding */
  colorValue?: number;

  /** Value for size encoding */
  sizeValue?: number;

  /** Category for grouping */
  category?: string;

  /** Stack group */
  stack?: string;

  /** Raw data for tooltips */
  rawData?: Record<string, unknown>;
}

export interface HistogramBin {
  /** Bin start value */
  x0: number;

  /** Bin end value */
  x1: number;

  /** Count of items in bin */
  count: number;

  /** Percentage of total */
  percentage: number;

  /** Items in this bin (for drill-down) */
  items?: string[];
}

export interface TimeSeriesPoint {
  /** Date/time label */
  date: string;

  /** Primary value */
  value: number;

  /** Values by category (for stacked) */
  categories?: Record<string, number>;
}

// ============================================================================
// Chart Commands (AI Integration)
// ============================================================================

export type ChartCommandType = 'showChart' | 'hideChart' | 'updateChart';

export interface ChartCommand {
  /** Command type */
  type: ChartCommandType;

  /** Chart configuration (for showChart/updateChart) */
  config?: ChartConfig;

  /** Preset name (alternative to full config) */
  preset?: ChartPreset;
}

// ============================================================================
// Presets
// ============================================================================

export type ChartPreset =
  // Rankings
  | 'top_gotv_precincts'
  | 'top_swing_precincts'
  | 'top_persuasion_targets'
  | 'lowest_turnout_precincts'
  // Distributions
  | 'partisan_distribution'
  | 'turnout_distribution'
  | 'gotv_distribution'
  | 'population_by_municipality'
  | 'population_by_district'
  // Correlations
  | 'swing_vs_turnout'
  | 'income_vs_education'
  | 'gotv_vs_persuasion'
  | 'partisan_vs_turnout'
  // Comparisons
  | 'municipality_comparison'
  | 'district_comparison'
  | 'competitiveness_breakdown'
  // Composition
  | 'party_affiliation'
  | 'targeting_strategy_breakdown'
  | 'competitiveness_pie'
  // Temporal (donor data)
  | 'donor_trends'
  | 'donor_by_party';

// ============================================================================
// Component Props
// ============================================================================

export interface SharedChartPanelProps {
  /** Whether the panel is visible */
  visible?: boolean;

  /** Start collapsed */
  defaultCollapsed?: boolean;

  /** Panel position */
  position?: 'left' | 'right' | 'bottom';

  /** Current chart configuration */
  config?: ChartConfig | null;

  /** Chart data (if pre-loaded) */
  data?: ChartDataPoint[];

  /** Callback when panel is closed */
  onClose?: () => void;

  /** Callback when a data point is clicked */
  onDataPointClick?: (dataPoint: ChartDataPoint) => void;

  /** Callback to highlight precincts on map */
  onHighlightPrecincts?: (precinctNames: string[]) => void;

  /** Additional CSS classes */
  className?: string;
}

export interface BaseChartProps {
  /** Chart configuration */
  config: ChartConfig;

  /** Chart data */
  data: ChartDataPoint[];

  /** Chart height */
  height?: number;

  /** Click handler for data points */
  onClick?: (dataPoint: ChartDataPoint) => void;

  /** Hover handler */
  onHover?: (dataPoint: ChartDataPoint | null) => void;
}

export interface HistogramChartProps {
  config: ChartConfig;
  data: HistogramBin[];
  height?: number;
  onClick?: (bin: HistogramBin) => void;
}

export interface ScatterPlotProps {
  config: ChartConfig;
  data: ChartDataPoint[];
  height?: number;
  onClick?: (dataPoint: ChartDataPoint) => void;
}

// ============================================================================
// Color Utilities
// ============================================================================

export interface ColorScale {
  /** Get color for a value */
  getColor: (value: number) => string;

  /** Get color stops for legend */
  getStops: () => Array<{ value: number; color: string; label: string }>;
}

export const PARTISAN_COLORS = {
  strongD: '#1e40af',   // Dark blue (D+20 or more)
  leanD: '#3b82f6',     // Blue (D+5 to D+20)
  slightD: '#93c5fd',   // Light blue (D+0 to D+5)
  tossUp: '#a855f7',    // Purple (±5)
  slightR: '#fca5a5',   // Light red (R+0 to R+5)
  leanR: '#ef4444',     // Red (R+5 to R+20)
  strongR: '#b91c1c',   // Dark red (R+20 or more)
} as const;

export const SEQUENTIAL_COLORS = {
  blue: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e40af'],
  green: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#166534'],
  orange: ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c', '#c2410c'],
  purple: ['#faf5ff', '#e9d5ff', '#c084fc', '#9333ea', '#6b21a8'],
  teal: ['#f0fdfa', '#99f6e4', '#2dd4bf', '#0d9488', '#115e59'],
} as const;

export const CATEGORICAL_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#f97316', // Orange
] as const;

export const COMPETITIVENESS_COLORS = {
  safe_d: '#1e40af',
  likely_d: '#3b82f6',
  lean_d: '#93c5fd',
  toss_up: '#a855f7',
  lean_r: '#fca5a5',
  likely_r: '#ef4444',
  safe_r: '#b91c1c',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get display label for a metric
 */
export function getMetricLabel(metric: PoliticalMetric): string {
  const labels: Record<PoliticalMetric, string> = {
    partisan_lean: 'Partisan Lean',
    turnout: 'Turnout',
    gotv_priority: 'GOTV Priority',
    persuasion_opportunity: 'Persuasion Opportunity',
    swing_potential: 'Swing Potential',
    combined_score: 'Combined Score',
    population: 'Population',
    registered_voters: 'Registered Voters',
    median_income: 'Median Income',
    college_pct: 'College Education %',
    diversity_index: 'Diversity Index',
    dem_affiliation_pct: 'Democratic %',
    rep_affiliation_pct: 'Republican %',
    ind_affiliation_pct: 'Independent %',
    donor_total: 'Total Donations',
    donor_count: 'Donor Count',
    avg_donation: 'Avg Donation',
    precinct_count: 'Precinct Count',
  };
  return labels[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get color for partisan lean value
 */
export function getPartisanColor(value: number): string {
  if (value < -20) return PARTISAN_COLORS.strongD;
  if (value < -5) return PARTISAN_COLORS.leanD;
  if (value < 0) return PARTISAN_COLORS.slightD;
  if (value <= 5) return PARTISAN_COLORS.tossUp;
  if (value <= 10) return PARTISAN_COLORS.slightR;
  if (value <= 20) return PARTISAN_COLORS.leanR;
  return PARTISAN_COLORS.strongR;
}

/**
 * Format a value for display
 */
export function formatChartValue(value: number, metric: PoliticalMetric): string {
  if (metric === 'median_income' || metric === 'donor_total' || metric === 'avg_donation') {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }

  if (metric.endsWith('_pct') || metric === 'turnout' || metric === 'college_pct') {
    return `${value.toFixed(1)}%`;
  }

  if (metric === 'population' || metric === 'registered_voters' || metric === 'donor_count' || metric === 'precinct_count') {
    return value.toLocaleString();
  }

  if (metric === 'partisan_lean') {
    const prefix = value > 0 ? 'R+' : value < 0 ? 'D+' : '';
    return `${prefix}${Math.abs(value).toFixed(1)}`;
  }

  return value.toFixed(1);
}
