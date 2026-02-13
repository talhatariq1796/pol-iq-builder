/**
 * Chart Data Service
 *
 * Transforms political data from PoliticalDataService into chart-ready formats.
 * Handles aggregation, grouping, and histogram bin calculations.
 */

import { PoliticalDataService } from '@/lib/services/PoliticalDataService';
import type {
  ChartConfig,
  ChartDataPoint,
  HistogramBin,
  TimeSeriesPoint,
  PoliticalMetric,
  GroupByField,
} from './types';

// ============================================================================
// Types
// ============================================================================

interface TargetingScoresPrecinct {
  precinct_id?: string;
  precinct_name?: string;
  registered_voters?: number;
  active_voters?: number;
  gotv_priority: number;
  gotv_classification: string;
  gotv_components: {
    support_strength: number;
    turnout_opportunity: number;
    voter_pool_weight: number;
  };
  persuasion_opportunity: number;
  persuasion_classification: string;
  persuasion_components: {
    margin_closeness: number;
    swing_factor: number;
    moderate_factor: number;
    independent_factor: number;
    low_engagement: number;
  };
  targeting_strategy: string;
  targeting_priority: number;
  combined_score: number;
  recommendation: string;
  political_scores?: {
    partisan_lean: number;
    swing_potential: number;
  };
  total_population?: number;
  population_age_18up?: number;
  median_household_income?: number;
  dem_affiliation_pct?: number;
  rep_affiliation_pct?: number;
  ind_affiliation_pct?: number;
  liberal_pct?: number;
  moderate_pct?: number;
  conservative_pct?: number;
  college_pct?: number;
  diversity_index?: number;
}

// ============================================================================
// Chart Data Service
// ============================================================================

export class ChartDataService {
  private static instance: ChartDataService;
  private dataService: PoliticalDataService;

  private constructor() {
    this.dataService = PoliticalDataService.getInstance();
  }

  static getInstance(): ChartDataService {
    if (!ChartDataService.instance) {
      ChartDataService.instance = new ChartDataService();
    }
    return ChartDataService.instance;
  }

  // ============================================================================
  // Main Data Methods
  // ============================================================================

  /**
   * Get chart data based on configuration
   */
  async getChartData(config: ChartConfig): Promise<ChartDataPoint[]> {
    const allScores = await this.dataService.getAllTargetingScores();

    switch (config.type) {
      case 'horizontalBar':
      case 'bar':
        return this.getBarChartData(allScores, config);

      case 'scatter':
        return this.getScatterData(allScores, config);

      case 'pie':
      case 'donut':
        return this.getPieChartData(allScores, config);

      case 'grouped':
      case 'stacked':
        return this.getGroupedData(allScores, config);

      case 'line':
      case 'area':
        return this.getTimeSeriesData(config);

      default:
        return this.getBarChartData(allScores, config);
    }
  }

  /**
   * Get histogram data for distribution charts
   */
  async getHistogramData(config: ChartConfig): Promise<HistogramBin[]> {
    const allScores = await this.dataService.getAllTargetingScores();
    const values: Array<{ value: number; name: string }> = [];

    for (const [name, scores] of Object.entries(allScores)) {
      const value = this.extractMetricValue(scores, config.metric);
      if (value !== null && !isNaN(value)) {
        values.push({ value, name });
      }
    }

    if (values.length === 0) return [];

    const numBins = config.bins || 8;
    const allValues = values.map(v => v.value);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const binWidth = (max - min) / numBins;

    const bins: HistogramBin[] = [];

    for (let i = 0; i < numBins; i++) {
      const x0 = min + i * binWidth;
      const x1 = min + (i + 1) * binWidth;

      const itemsInBin = values.filter(v => {
        if (i === numBins - 1) {
          return v.value >= x0 && v.value <= x1;
        }
        return v.value >= x0 && v.value < x1;
      });

      bins.push({
        x0,
        x1,
        count: itemsInBin.length,
        percentage: (itemsInBin.length / values.length) * 100,
        items: itemsInBin.map(item => item.name),
      });
    }

    return bins;
  }

  /**
   * Get time series data for temporal charts
   */
  async getTimeSeriesData(config: ChartConfig): Promise<ChartDataPoint[]> {
    // For now, return placeholder - will integrate with donor time series data
    // TODO: Integrate with actual time series data sources
    return [];
  }

  // ============================================================================
  // Bar Chart Data
  // ============================================================================

  private getBarChartData(
    allScores: Record<string, TargetingScoresPrecinct>,
    config: ChartConfig
  ): ChartDataPoint[] {
    const dataPoints: ChartDataPoint[] = [];

    // If groupBy is set, aggregate by that field
    if (config.groupBy && config.groupBy !== 'precinct') {
      return this.getAggregatedBarData(allScores, config);
    }

    // Otherwise, return precinct-level data
    for (const [name, scores] of Object.entries(allScores)) {
      const value = this.extractMetricValue(scores, config.metric);
      if (value === null || isNaN(value)) continue;

      dataPoints.push({
        name: this.formatPrecinctName(name),
        value,
        rawData: scores as unknown as Record<string, unknown>,
      });
    }

    // Sort and limit
    this.sortDataPoints(dataPoints, config.sortOrder || 'desc');

    if (config.limit) {
      return dataPoints.slice(0, config.limit);
    }

    return dataPoints;
  }

  private getAggregatedBarData(
    allScores: Record<string, TargetingScoresPrecinct>,
    config: ChartConfig
  ): ChartDataPoint[] {
    const grouped = new Map<string, { values: number[]; count: number; totalPop: number }>();

    for (const [name, scores] of Object.entries(allScores)) {
      const groupKey = this.getGroupKey(name, scores, config.groupBy!);
      if (!groupKey) continue;

      const value = this.extractMetricValue(scores, config.metric);
      if (value === null || isNaN(value)) continue;

      const existing = grouped.get(groupKey) || { values: [], count: 0, totalPop: 0 };
      existing.values.push(value);
      existing.count++;
      existing.totalPop += scores.total_population || 0;
      grouped.set(groupKey, existing);
    }

    const dataPoints: ChartDataPoint[] = [];

    for (const [groupKey, data] of grouped) {
      // Use population-weighted average for most metrics
      const avgValue = data.values.reduce((a, b) => a + b, 0) / data.values.length;

      dataPoints.push({
        name: groupKey,
        value: config.metric === 'population' ? data.totalPop : avgValue,
        rawData: { count: data.count, totalPop: data.totalPop },
      });
    }

    this.sortDataPoints(dataPoints, config.sortOrder || 'desc');

    if (config.limit) {
      return dataPoints.slice(0, config.limit);
    }

    return dataPoints;
  }

  // ============================================================================
  // Scatter Plot Data
  // ============================================================================

  private getScatterData(
    allScores: Record<string, TargetingScoresPrecinct>,
    config: ChartConfig
  ): ChartDataPoint[] {
    const dataPoints: ChartDataPoint[] = [];

    for (const [name, scores] of Object.entries(allScores)) {
      const primaryValue = this.extractMetricValue(scores, config.metric);
      const secondaryValue = config.secondaryMetric
        ? this.extractMetricValue(scores, config.secondaryMetric)
        : null;

      if (primaryValue === null || isNaN(primaryValue)) continue;
      if (config.secondaryMetric && (secondaryValue === null || isNaN(secondaryValue))) continue;

      const dataPoint: ChartDataPoint = {
        name: this.formatPrecinctName(name),
        value: primaryValue,
        secondaryValue: secondaryValue ?? undefined,
        rawData: scores as unknown as Record<string, unknown>,
      };

      // Add color and size values if configured
      if (config.colorBy) {
        dataPoint.colorValue = this.extractMetricValue(scores, config.colorBy) ?? undefined;
      }

      if (config.sizeBy) {
        dataPoint.sizeValue = this.extractMetricValue(scores, config.sizeBy) ?? undefined;
      }

      dataPoints.push(dataPoint);
    }

    return dataPoints;
  }

  // ============================================================================
  // Pie/Donut Chart Data
  // ============================================================================

  private getPieChartData(
    allScores: Record<string, TargetingScoresPrecinct>,
    config: ChartConfig
  ): ChartDataPoint[] {
    // If metrics array is provided (like party affiliation percentages)
    if (config.metrics && config.metrics.length > 0) {
      return this.getCompositionData(allScores, config);
    }

    // Otherwise, group by field and count
    if (!config.groupBy) return [];

    const counts = new Map<string, number>();

    for (const [name, scores] of Object.entries(allScores)) {
      const groupKey = this.getGroupKey(name, scores, config.groupBy);
      if (!groupKey) continue;

      counts.set(groupKey, (counts.get(groupKey) || 0) + 1);
    }

    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);

    return Array.from(counts.entries()).map(([key, count]) => ({
      name: this.formatCategoryName(key),
      value: count,
      rawData: { percentage: (count / total) * 100 },
    }));
  }

  private getCompositionData(
    allScores: Record<string, TargetingScoresPrecinct>,
    config: ChartConfig
  ): ChartDataPoint[] {
    // Calculate average percentages across all precincts
    const totals: Record<string, { sum: number; count: number }> = {};

    for (const metric of config.metrics || []) {
      totals[metric] = { sum: 0, count: 0 };
    }

    for (const scores of Object.values(allScores)) {
      for (const metric of config.metrics || []) {
        const value = this.extractMetricValue(scores, metric);
        if (value !== null && !isNaN(value)) {
          totals[metric].sum += value;
          totals[metric].count++;
        }
      }
    }

    return (config.metrics || []).map(metric => ({
      name: this.formatMetricName(metric),
      value: totals[metric].count > 0 ? totals[metric].sum / totals[metric].count : 0,
    }));
  }

  // ============================================================================
  // Grouped/Stacked Bar Data
  // ============================================================================

  private getGroupedData(
    allScores: Record<string, TargetingScoresPrecinct>,
    config: ChartConfig
  ): ChartDataPoint[] {
    if (!config.groupBy || !config.metrics || config.metrics.length === 0) {
      return [];
    }

    const grouped = new Map<string, Record<string, number[]>>();

    for (const [name, scores] of Object.entries(allScores)) {
      const groupKey = this.getGroupKey(name, scores, config.groupBy);
      if (!groupKey) continue;

      const existing = grouped.get(groupKey) || {};

      for (const metric of config.metrics) {
        const value = this.extractMetricValue(scores, metric);
        if (value !== null && !isNaN(value)) {
          existing[metric] = existing[metric] || [];
          existing[metric].push(value);
        }
      }

      grouped.set(groupKey, existing);
    }

    const dataPoints: ChartDataPoint[] = [];

    for (const [groupKey, metricValues] of grouped) {
      for (const metric of config.metrics) {
        const values = metricValues[metric] || [];
        const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

        dataPoints.push({
          name: groupKey,
          value: avgValue,
          category: this.formatMetricName(metric),
        });
      }
    }

    return dataPoints;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractMetricValue(scores: TargetingScoresPrecinct, metric: PoliticalMetric): number | null {
    switch (metric) {
      case 'partisan_lean':
        return scores.political_scores?.partisan_lean ?? null;
      case 'swing_potential':
        return scores.political_scores?.swing_potential ?? null;
      case 'gotv_priority':
        return scores.gotv_priority;
      case 'persuasion_opportunity':
        return scores.persuasion_opportunity;
      case 'combined_score':
        return scores.combined_score;
      case 'turnout':
        // Use turnout opportunity (inverse) as a proxy for actual turnout
        return scores.gotv_components?.turnout_opportunity
          ? 100 - scores.gotv_components.turnout_opportunity
          : null;
      case 'population':
        return scores.total_population ?? null;
      case 'registered_voters':
        return scores.registered_voters ?? null;
      case 'median_income':
        return scores.median_household_income ?? null;
      case 'college_pct':
        return scores.college_pct ?? null;
      case 'diversity_index':
        return scores.diversity_index ?? null;
      case 'dem_affiliation_pct':
        return scores.dem_affiliation_pct ?? null;
      case 'rep_affiliation_pct':
        return scores.rep_affiliation_pct ?? null;
      case 'ind_affiliation_pct':
        return scores.ind_affiliation_pct ?? null;
      case 'precinct_count':
        return 1; // Each precinct counts as 1
      default:
        return null;
    }
  }

  private getGroupKey(
    precinctName: string,
    scores: TargetingScoresPrecinct,
    groupBy: GroupByField
  ): string | null {
    switch (groupBy) {
      case 'precinct':
        return precinctName;
      case 'municipality':
        // Extract municipality from precinct name (format: "City, Precinct X")
        const parts = precinctName.split(',');
        return parts[0]?.trim() || precinctName;
      case 'competitiveness':
        return scores.gotv_classification || 'Unknown';
      case 'targeting_strategy':
        return scores.targeting_strategy || 'Unknown';
      case 'district':
      case 'state_house':
        // Would need boundary data to determine - for now return null
        return null;
      default:
        return null;
    }
  }

  private sortDataPoints(dataPoints: ChartDataPoint[], order: 'asc' | 'desc'): void {
    dataPoints.sort((a, b) => {
      const diff = a.value - b.value;
      return order === 'desc' ? -diff : diff;
    });
  }

  private formatPrecinctName(name: string): string {
    // Shorten long precinct names
    if (name.length > 30) {
      const parts = name.split(',');
      if (parts.length >= 2) {
        return `${parts[0].trim().slice(0, 15)}... P${parts[1].trim().replace(/\D/g, '')}`;
      }
      return name.slice(0, 27) + '...';
    }
    return name;
  }

  private formatCategoryName(category: string): string {
    // Convert snake_case to Title Case
    return category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private formatMetricName(metric: string): string {
    const labels: Record<string, string> = {
      partisan_lean: 'Partisan Lean',
      turnout: 'Turnout',
      gotv_priority: 'GOTV Priority',
      persuasion_opportunity: 'Persuasion',
      swing_potential: 'Swing Potential',
      combined_score: 'Combined Score',
      population: 'Population',
      registered_voters: 'Registered Voters',
      median_income: 'Median Income',
      college_pct: 'College %',
      diversity_index: 'Diversity',
      dem_affiliation_pct: 'Democratic',
      rep_affiliation_pct: 'Republican',
      ind_affiliation_pct: 'Independent',
      donor_total: 'Total Donations',
      donor_count: 'Donor Count',
      avg_donation: 'Avg Donation',
      precinct_count: 'Precinct Count',
    };
    return labels[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

// Export singleton
export const chartDataService = ChartDataService.getInstance();
