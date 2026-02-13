/**
 * Chart Presets
 *
 * Pre-configured chart configurations for common political analysis queries.
 * AI can reference these by name instead of building full configurations.
 */

import type { ChartConfig, ChartPreset } from './types';

// ============================================================================
// Ranking Presets (Horizontal Bar Charts)
// ============================================================================

const RANKING_PRESETS: Record<string, ChartConfig> = {
  top_gotv_precincts: {
    type: 'horizontalBar',
    title: 'Top GOTV Priority Precincts',
    subtitle: 'Precincts with highest potential for turnout mobilization',
    metric: 'gotv_priority',
    groupBy: 'precinct',
    limit: 10,
    sortOrder: 'desc',
    colorScheme: 'orange',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  top_swing_precincts: {
    type: 'horizontalBar',
    title: 'Most Competitive Precincts',
    subtitle: 'Precincts with highest swing potential',
    metric: 'swing_potential',
    groupBy: 'precinct',
    limit: 10,
    sortOrder: 'desc',
    colorScheme: 'purple',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  top_persuasion_targets: {
    type: 'horizontalBar',
    title: 'Top Persuasion Targets',
    subtitle: 'Precincts with highest persuasion opportunity',
    metric: 'persuasion_opportunity',
    groupBy: 'precinct',
    limit: 10,
    sortOrder: 'desc',
    colorScheme: 'purple',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  lowest_turnout_precincts: {
    type: 'horizontalBar',
    title: 'Lowest Turnout Precincts',
    subtitle: 'Precincts with lowest historical turnout',
    metric: 'turnout',
    groupBy: 'precinct',
    limit: 10,
    sortOrder: 'asc',
    colorScheme: 'sequential',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },
};

// ============================================================================
// Distribution Presets (Histograms)
// ============================================================================

const DISTRIBUTION_PRESETS: Record<string, ChartConfig> = {
  partisan_distribution: {
    type: 'histogram',
    title: 'Partisan Lean Distribution',
    subtitle: 'Distribution of precincts by partisan lean',
    metric: 'partisan_lean',
    bins: 10,
    colorScheme: 'partisan',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  turnout_distribution: {
    type: 'histogram',
    title: 'Turnout Distribution',
    subtitle: 'Distribution of precincts by average turnout',
    metric: 'turnout',
    bins: 8,
    colorScheme: 'green',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  gotv_distribution: {
    type: 'histogram',
    title: 'GOTV Priority Distribution',
    subtitle: 'Distribution of precincts by GOTV priority score',
    metric: 'gotv_priority',
    bins: 8,
    colorScheme: 'orange',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  population_by_municipality: {
    type: 'bar',
    title: 'Population by Municipality',
    subtitle: 'Total population across municipalities',
    metric: 'population',
    groupBy: 'municipality',
    sortOrder: 'desc',
    colorScheme: 'blue',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  population_by_district: {
    type: 'bar',
    title: 'Population by State House District',
    subtitle: 'Total population across state house districts',
    metric: 'population',
    groupBy: 'state_house',
    sortOrder: 'desc',
    colorScheme: 'categorical',
    showLegend: false,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },
};

// ============================================================================
// Correlation Presets (Scatter Plots)
// ============================================================================

const CORRELATION_PRESETS: Record<string, ChartConfig> = {
  swing_vs_turnout: {
    type: 'scatter',
    title: 'Swing Potential vs Turnout',
    subtitle: 'Relationship between competitiveness and voter turnout',
    metric: 'swing_potential',
    secondaryMetric: 'turnout',
    colorBy: 'partisan_lean',
    sizeBy: 'population',
    colorScheme: 'partisan',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  income_vs_education: {
    type: 'scatter',
    title: 'Income vs Education',
    subtitle: 'Correlation between median income and college education',
    metric: 'median_income',
    secondaryMetric: 'college_pct',
    colorBy: 'partisan_lean',
    sizeBy: 'population',
    colorScheme: 'partisan',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  gotv_vs_persuasion: {
    type: 'scatter',
    title: 'GOTV Priority vs Persuasion',
    subtitle: 'Comparing mobilization and persuasion opportunities',
    metric: 'gotv_priority',
    secondaryMetric: 'persuasion_opportunity',
    colorBy: 'combined_score',
    sizeBy: 'registered_voters',
    colorScheme: 'purple',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },

  partisan_vs_turnout: {
    type: 'scatter',
    title: 'Partisan Lean vs Turnout',
    subtitle: 'How partisanship relates to voter participation',
    metric: 'partisan_lean',
    secondaryMetric: 'turnout',
    colorBy: 'swing_potential',
    sizeBy: 'population',
    colorScheme: 'diverging',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },
};

// ============================================================================
// Comparison Presets (Grouped/Stacked Bars)
// ============================================================================

const COMPARISON_PRESETS: Record<string, ChartConfig> = {
  municipality_comparison: {
    type: 'grouped',
    title: 'Municipality Comparison',
    subtitle: 'Comparing key metrics across municipalities',
    metrics: ['gotv_priority', 'persuasion_opportunity', 'swing_potential'],
    groupBy: 'municipality',
    colorScheme: 'categorical',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    animate: true,
    metric: 'gotv_priority', // Default/primary metric
  },

  district_comparison: {
    type: 'grouped',
    title: 'District Comparison',
    subtitle: 'Comparing key metrics across state house districts',
    metrics: ['gotv_priority', 'persuasion_opportunity', 'swing_potential'],
    groupBy: 'state_house',
    colorScheme: 'categorical',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    animate: true,
    metric: 'gotv_priority',
  },

  competitiveness_breakdown: {
    type: 'stacked',
    title: 'Competitiveness by Municipality',
    subtitle: 'Distribution of competitiveness categories',
    metric: 'precinct_count',
    stackBy: 'competitiveness',
    groupBy: 'municipality',
    colorScheme: 'partisan',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    animate: true,
  },
};

// ============================================================================
// Composition Presets (Pie/Donut Charts)
// ============================================================================

const COMPOSITION_PRESETS: Record<string, ChartConfig> = {
  party_affiliation: {
    type: 'donut',
    title: 'Party Affiliation',
    subtitle: 'Voter registration by party',
    metrics: ['dem_affiliation_pct', 'rep_affiliation_pct', 'ind_affiliation_pct'],
    colorScheme: 'partisan',
    showLegend: true,
    showTooltip: true,
    animate: true,
    metric: 'dem_affiliation_pct', // Primary for type compat
  },

  targeting_strategy_breakdown: {
    type: 'pie',
    title: 'Targeting Strategy Distribution',
    subtitle: 'Precincts by recommended strategy',
    metric: 'precinct_count',
    groupBy: 'targeting_strategy',
    colorScheme: 'categorical',
    showLegend: true,
    showTooltip: true,
    animate: true,
  },

  competitiveness_pie: {
    type: 'pie',
    title: 'Competitiveness Breakdown',
    subtitle: 'Precincts by competitiveness category',
    metric: 'precinct_count',
    groupBy: 'competitiveness',
    colorScheme: 'partisan',
    showLegend: true,
    showTooltip: true,
    animate: true,
  },
};

// ============================================================================
// Temporal Presets (Line/Area Charts)
// ============================================================================

const TEMPORAL_PRESETS: Record<string, ChartConfig> = {
  donor_trends: {
    type: 'area',
    title: 'Donation Trends Over Time',
    subtitle: 'Monthly contribution totals',
    metric: 'donor_total',
    groupBy: 'month',
    stackBy: 'party',
    colorScheme: 'partisan',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    showMarkers: false,
    animate: true,
  },

  donor_by_party: {
    type: 'line',
    title: 'Donations by Party',
    subtitle: 'Contribution trends by party over time',
    metric: 'donor_total',
    groupBy: 'month',
    colorScheme: 'partisan',
    showLegend: true,
    showTooltip: true,
    showGrid: true,
    showMarkers: true,
    animate: true,
  },
};

// ============================================================================
// Combined Presets Map
// ============================================================================

export const CHART_PRESETS: Record<ChartPreset, ChartConfig> = {
  // Rankings
  ...RANKING_PRESETS,
  // Distributions
  ...DISTRIBUTION_PRESETS,
  // Correlations
  ...CORRELATION_PRESETS,
  // Comparisons
  ...COMPARISON_PRESETS,
  // Composition
  ...COMPOSITION_PRESETS,
  // Temporal
  ...TEMPORAL_PRESETS,
} as Record<ChartPreset, ChartConfig>;

// ============================================================================
// Preset Metadata (for AI recommendations)
// ============================================================================

export interface PresetMetadata {
  name: ChartPreset;
  category: 'ranking' | 'distribution' | 'correlation' | 'comparison' | 'composition' | 'temporal';
  description: string;
  queryPatterns: string[];
}

export const PRESET_METADATA: PresetMetadata[] = [
  // Rankings
  {
    name: 'top_gotv_precincts',
    category: 'ranking',
    description: 'Top 10 precincts with highest GOTV priority',
    queryPatterns: ['top gotv', 'best gotv', 'highest gotv', 'gotv targets', 'mobilization targets'],
  },
  {
    name: 'top_swing_precincts',
    category: 'ranking',
    description: 'Top 10 most competitive precincts',
    queryPatterns: ['top swing', 'most competitive', 'swing precincts', 'battleground'],
  },
  {
    name: 'top_persuasion_targets',
    category: 'ranking',
    description: 'Top 10 precincts for persuasion',
    queryPatterns: ['top persuasion', 'persuadable', 'persuasion targets'],
  },
  {
    name: 'lowest_turnout_precincts',
    category: 'ranking',
    description: 'Precincts with lowest voter turnout',
    queryPatterns: ['lowest turnout', 'worst turnout', 'low participation'],
  },

  // Distributions
  {
    name: 'partisan_distribution',
    category: 'distribution',
    description: 'Histogram of partisan lean across precincts',
    queryPatterns: ['partisan distribution', 'lean distribution', 'party breakdown'],
  },
  {
    name: 'turnout_distribution',
    category: 'distribution',
    description: 'Distribution of turnout rates',
    queryPatterns: ['turnout distribution', 'participation spread', 'turnout range'],
  },
  {
    name: 'population_by_municipality',
    category: 'distribution',
    description: 'Population across municipalities',
    queryPatterns: ['population by city', 'population by municipality', 'residents by area'],
  },

  // Correlations
  {
    name: 'swing_vs_turnout',
    category: 'correlation',
    description: 'Scatter plot of swing potential vs turnout',
    queryPatterns: ['swing vs turnout', 'competitiveness and turnout', 'relationship swing turnout'],
  },
  {
    name: 'income_vs_education',
    category: 'correlation',
    description: 'Correlation between income and education',
    queryPatterns: ['income vs education', 'income education correlation', 'wealth and education'],
  },
  {
    name: 'gotv_vs_persuasion',
    category: 'correlation',
    description: 'GOTV priority vs persuasion opportunity',
    queryPatterns: ['gotv vs persuasion', 'mobilization vs persuasion', 'targeting matrix'],
  },

  // Comparisons
  {
    name: 'municipality_comparison',
    category: 'comparison',
    description: 'Compare metrics across municipalities',
    queryPatterns: ['compare municipalities', 'city comparison', 'municipality metrics'],
  },
  {
    name: 'competitiveness_breakdown',
    category: 'comparison',
    description: 'Competitiveness categories by municipality',
    queryPatterns: ['competitiveness breakdown', 'safe vs swing', 'competitive analysis'],
  },

  // Composition
  {
    name: 'party_affiliation',
    category: 'composition',
    description: 'Voter registration by party',
    queryPatterns: ['party breakdown', 'registration by party', 'dem vs rep vs ind'],
  },
  {
    name: 'targeting_strategy_breakdown',
    category: 'composition',
    description: 'Precincts by targeting strategy',
    queryPatterns: ['strategy breakdown', 'targeting strategies', 'recommended strategies'],
  },

  // Temporal
  {
    name: 'donor_trends',
    category: 'temporal',
    description: 'Donation trends over time',
    queryPatterns: ['donor trends', 'donation over time', 'fundraising trends', 'contribution history'],
  },
];

/**
 * Find matching preset based on query text
 */
export function findMatchingPreset(query: string): ChartPreset | null {
  const lowerQuery = query.toLowerCase();

  for (const meta of PRESET_METADATA) {
    for (const pattern of meta.queryPatterns) {
      if (lowerQuery.includes(pattern)) {
        return meta.name;
      }
    }
  }

  return null;
}

/**
 * Get preset configuration by name
 */
export function getPresetConfig(preset: ChartPreset): ChartConfig | null {
  return CHART_PRESETS[preset] || null;
}

/**
 * Get all presets in a category
 */
export function getPresetsByCategory(category: PresetMetadata['category']): ChartPreset[] {
  return PRESET_METADATA
    .filter(m => m.category === category)
    .map(m => m.name);
}
