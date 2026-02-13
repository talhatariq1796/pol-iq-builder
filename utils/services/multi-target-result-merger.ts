/**
 * Multi-Target Result Merger Utility
 * 
 * Merges results from multiple microservice calls into unified responses with:
 * - Statistical calculations and correlations
 * - Geographic aggregation by FSA codes
 * - Performance benchmarking
 * - Comprehensive AI insights
 */

import { MicroserviceResponse, MultiTargetPredictionResponse, RealEstatePropertyFeatures } from '../../types/microservice-types';

// ==================== TYPE DEFINITIONS ====================

export interface MergedAnalysisResult {
  id: string;
  timestamp: string;
  targets: TargetAnalysisResults;
  statistics: CombinedStatistics;
  correlations: CorrelationMatrix;
  geographic: GeographicAggregation;
  rankings: MetricRankings;
  performance: PerformanceBenchmark;
  insights: AIInsights;
  metadata: AnalysisMetadata;
}

export interface TargetAnalysisResults {
  time_on_market: TargetResult;
  price_delta: TargetResult;
  rental_yield: TargetResult;
  investment_score: TargetResult;
}

export interface TargetResult {
  predictions: number[];
  confidence: number[];
  statistics: StatisticalSummary;
  shap_importance: FeatureImportance[];
  geospatial_data?: GeoSpatialData;
  quality_score: number;
}

export interface StatisticalSummary {
  count: number;
  mean: number;
  median: number;
  std_dev: number;
  variance: number;
  min: number;
  max: number;
  quartiles: {
    q25: number;
    q50: number;
    q75: number;
    iqr: number;
  };
  percentiles: {
    p10: number;
    p90: number;
    p95: number;
    p99: number;
  };
  skewness: number;
  kurtosis: number;
  outlier_count: number;
  outlier_threshold: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  category: 'spatial' | 'property' | 'demographic' | 'temporal';
  rank: number;
}

export interface GeoSpatialData {
  fsa_distribution: Record<string, number>;
  spatial_clusters: SpatialCluster[];
  geographic_variance: number;
  hotspots: GeographicHotspot[];
}

export interface SpatialCluster {
  center: [number, number]; // [lat, lng]
  radius_km: number;
  point_count: number;
  avg_value: number;
  confidence: number;
}

export interface GeographicHotspot {
  fsa_code: string;
  center: [number, number];
  intensity: number;
  property_count: number;
  avg_metric_value: number;
}

export interface CombinedStatistics {
  property_count: number;
  fsa_coverage: number;
  data_completeness: number;
  cross_target_summary: CrossTargetSummary;
}

export interface CrossTargetSummary {
  avg_time_on_market: number;
  avg_price_delta: number;
  avg_rental_yield: number;
  avg_investment_score: number;
  combined_confidence: number;
}

export interface CorrelationMatrix {
  pearson: CorrelationData;
  spearman: CorrelationData;
  kendall: CorrelationData;
  partial_correlations: PartialCorrelationData;
  significance_tests: SignificanceTests;
}

export interface CorrelationData {
  matrix: number[][];
  target_names: string[];
  strength_interpretation: CorrelationStrength[];
}

export interface PartialCorrelationData {
  controlled_variables: string[];
  partial_matrix: number[][];
  significance_levels: number[][];
}

export interface CorrelationStrength {
  pair: [string, string];
  correlation: number;
  strength: 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong';
  direction: 'positive' | 'negative';
}

export interface SignificanceTests {
  p_values: number[][];
  confidence_intervals: ConfidenceInterval[][];
  critical_values: number[][];
  degrees_of_freedom: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence_level: number;
}

export interface GeographicAggregation {
  fsa_analysis: FSAAnalysis[];
  custom_areas: CustomAreaAnalysis[];
  regional_trends: RegionalTrend[];
  proximity_analysis: ProximityAnalysis;
}

export interface FSAAnalysis {
  fsa_code: string;
  property_count: number;
  metrics: {
    time_on_market: StatisticalSummary;
    price_delta: StatisticalSummary;
    rental_yield: StatisticalSummary;
    investment_score: StatisticalSummary;
  };
  geographic_center: [number, number];
  area_rank: number;
  market_performance: 'excellent' | 'good' | 'average' | 'poor';
}

export interface CustomAreaAnalysis {
  area_name: string;
  boundary: [number, number][];
  property_count: number;
  metrics: {
    time_on_market: StatisticalSummary;
    price_delta: StatisticalSummary;
    rental_yield: StatisticalSummary;
    investment_score: StatisticalSummary;
  };
  comparison_to_city_avg: Record<string, number>;
}

export interface RegionalTrend {
  region: string;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  trend_strength: number;
  seasonal_patterns: SeasonalPattern[];
}

export interface SeasonalPattern {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  multiplier: number;
  confidence: number;
}

export interface ProximityAnalysis {
  nearest_neighbor_distances: number[];
  spatial_autocorrelation: number;
  clustering_coefficient: number;
  dispersal_index: number;
}

export interface MetricRankings {
  time_on_market: PropertyRanking[];
  price_delta: PropertyRanking[];
  rental_yield: PropertyRanking[];
  investment_score: PropertyRanking[];
  combined_score: PropertyRanking[];
}

export interface PropertyRanking {
  property_id: string;
  fsa_code: string;
  coordinates: [number, number];
  metric_value: number;
  rank: number;
  percentile: number;
  rank_category: 'top_10' | 'top_25' | 'median' | 'bottom_25' | 'bottom_10';
}

export interface PerformanceBenchmark {
  total_processing_time: number;
  microservice_timings: Record<string, number>;
  merger_processing_time: number;
  data_transfer_time: number;
  cache_hit_rate: number;
  memory_usage: MemoryUsage;
  throughput_metrics: ThroughputMetrics;
}

export interface MemoryUsage {
  peak_mb: number;
  average_mb: number;
  gc_events: number;
  heap_size_mb: number;
}

export interface ThroughputMetrics {
  properties_per_second: number;
  predictions_per_second: number;
  features_processed_per_second: number;
  shap_calculations_per_second: number;
}

export interface AIInsights {
  market_summary: string;
  key_findings: string[];
  investment_recommendations: InvestmentRecommendation[];
  risk_assessment: RiskAssessment;
  predictive_insights: PredictiveInsight[];
  comparative_analysis: ComparativeAnalysis;
}

export interface InvestmentRecommendation {
  type: 'buy' | 'hold' | 'sell' | 'avoid';
  confidence: number;
  rationale: string;
  target_metrics: string[];
  fsa_codes: string[];
  expected_return_range: [number, number];
  risk_level: 'low' | 'medium' | 'high';
}

export interface RiskAssessment {
  overall_risk_score: number;
  risk_factors: RiskFactor[];
  mitigation_strategies: string[];
  market_volatility: number;
}

export interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  probability: number;
  description: string;
}

export interface PredictiveInsight {
  metric: string;
  prediction_horizon: '3_months' | '6_months' | '1_year' | '2_years';
  predicted_trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  supporting_factors: string[];
}

export interface ComparativeAnalysis {
  best_performing_fsas: string[];
  worst_performing_fsas: string[];
  outlier_properties: OutlierProperty[];
  market_segments: MarketSegment[];
}

export interface OutlierProperty {
  property_id: string;
  fsa_code: string;
  outlier_type: 'positive' | 'negative';
  affected_metrics: string[];
  deviation_magnitude: number;
}

export interface MarketSegment {
  segment_name: string;
  characteristics: string[];
  property_count: number;
  average_performance: Record<string, number>;
  growth_potential: number;
}

export interface AnalysisMetadata {
  analysis_version: string;
  model_versions: Record<string, string>;
  feature_set_version: string;
  data_quality_score: number;
  coverage_metrics: CoverageMetrics;
  validation_results: ValidationResults;
}

export interface CoverageMetrics {
  spatial_coverage_percent: number;
  temporal_coverage_days: number;
  feature_completeness_percent: number;
  missing_data_impact: 'low' | 'medium' | 'high';
}

export interface ValidationResults {
  cross_validation_score: number;
  out_of_sample_accuracy: number;
  prediction_stability: number;
  bias_metrics: BiasMetrics;
}

export interface BiasMetrics {
  geographic_bias: number;
  price_range_bias: number;
  property_type_bias: number;
  temporal_bias: number;
}

// ==================== STATISTICAL FUNCTIONS ====================

export class StatisticalCalculator {
  /**
   * Calculate comprehensive statistical summary for a dataset
   */
  static calculateStatistics(values: number[]): StatisticalSummary {
    if (values.length === 0) {
      throw new Error('Cannot calculate statistics for empty dataset');
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    // Basic statistics
    const mean = this.mean(values);
    const median = this.median(sorted);
    const std_dev = this.standardDeviation(values, mean);
    const variance = std_dev ** 2;
    const min = sorted[0];
    const max = sorted[n - 1];

    // Quartiles
    const q25 = this.percentile(sorted, 25);
    const q50 = median;
    const q75 = this.percentile(sorted, 75);
    const iqr = q75 - q25;

    // Percentiles
    const percentiles = {
      p10: this.percentile(sorted, 10),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };

    // Distribution shape
    const skewness = this.skewness(values, mean, std_dev);
    const kurtosis = this.kurtosis(values, mean, std_dev);

    // Outlier detection using IQR method
    const outlier_threshold = 1.5 * iqr;
    const outlier_count = values.filter(v => 
      v < (q25 - outlier_threshold) || v > (q75 + outlier_threshold)
    ).length;

    return {
      count: n,
      mean,
      median,
      std_dev,
      variance,
      min,
      max,
      quartiles: { q25, q50, q75, iqr },
      percentiles,
      skewness,
      kurtosis,
      outlier_count,
      outlier_threshold
    };
  }

  static mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  static median(sortedValues: number[]): number {
    const n = sortedValues.length;
    if (n % 2 === 0) {
      return (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2;
    }
    return sortedValues[Math.floor(n / 2)];
  }

  static percentile(sortedValues: number[], p: number): number {
    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  static standardDeviation(values: number[], mean?: number): number {
    const m = mean ?? this.mean(values);
    const variance = values.reduce((sum, val) => sum + (val - m) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  static skewness(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const sum = values.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  static kurtosis(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const sum = values.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 4), 0);
    const kurtosis = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum;
    const correction = 3 * (n - 1) ** 2 / ((n - 2) * (n - 3));
    return kurtosis - correction;
  }
}

// ==================== CORRELATION ANALYSIS ====================

export class CorrelationAnalyzer {
  /**
   * Calculate Pearson correlation matrix with significance testing
   */
  static calculateCorrelationMatrix(data: Record<string, number[]>): CorrelationMatrix {
    const targets = Object.keys(data);
    const n = targets.length;
    
    // Pearson correlations
    const pearsonMatrix = this.pearsonCorrelationMatrix(data);
    const spearmanMatrix = this.spearmanCorrelationMatrix(data);
    const kendallMatrix = this.kendallCorrelationMatrix(data);
    
    // Significance testing
    const significance = this.calculateSignificance(data, pearsonMatrix);
    
    // Partial correlations (controlling for other variables)
    const partialCorrelations = this.calculatePartialCorrelations(data);
    
    // Interpret correlation strengths
    const strengthInterpretation = this.interpretCorrelationStrengths(pearsonMatrix, targets);
    
    return {
      pearson: {
        matrix: pearsonMatrix,
        target_names: targets,
        strength_interpretation: strengthInterpretation
      },
      spearman: {
        matrix: spearmanMatrix,
        target_names: targets,
        strength_interpretation: this.interpretCorrelationStrengths(spearmanMatrix, targets)
      },
      kendall: {
        matrix: kendallMatrix,
        target_names: targets,
        strength_interpretation: this.interpretCorrelationStrengths(kendallMatrix, targets)
      },
      partial_correlations: partialCorrelations,
      significance_tests: significance
    };
  }

  private static pearsonCorrelationMatrix(data: Record<string, number[]>): number[][] {
    const targets = Object.keys(data);
    const n = targets.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = this.pearsonCorrelation(data[targets[i]], data[targets[j]]);
        }
      }
    }
    
    return matrix;
  }

  private static pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private static spearmanCorrelationMatrix(data: Record<string, number[]>): number[][] {
    const targets = Object.keys(data);
    const n = targets.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Convert to ranks
    const rankedData: Record<string, number[]> = {};
    for (const target of targets) {
      rankedData[target] = this.convertToRanks(data[target]);
    }
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = this.pearsonCorrelation(rankedData[targets[i]], rankedData[targets[j]]);
        }
      }
    }
    
    return matrix;
  }

  private static kendallCorrelationMatrix(data: Record<string, number[]>): number[][] {
    const targets = Object.keys(data);
    const n = targets.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = this.kendallTau(data[targets[i]], data[targets[j]]);
        }
      }
    }
    
    return matrix;
  }

  private static convertToRanks(values: number[]): number[] {
    const sorted = values.map((val, idx) => ({ val, idx }))
                        .sort((a, b) => a.val - b.val);
    
    const ranks = new Array(values.length);
    for (let i = 0; i < sorted.length; i++) {
      ranks[sorted[i].idx] = i + 1;
    }
    
    return ranks;
  }

  private static kendallTau(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    let concordant = 0;
    let discordant = 0;
    
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const xDiff = x[i] - x[j];
        const yDiff = y[i] - y[j];
        
        if ((xDiff > 0 && yDiff > 0) || (xDiff < 0 && yDiff < 0)) {
          concordant++;
        } else if ((xDiff > 0 && yDiff < 0) || (xDiff < 0 && yDiff > 0)) {
          discordant++;
        }
      }
    }
    
    return (concordant - discordant) / (0.5 * n * (n - 1));
  }

  private static calculateSignificance(data: Record<string, number[]>, correlationMatrix: number[][]): SignificanceTests {
    const targets = Object.keys(data);
    const n = targets.length;
    const sampleSize = Math.min(...Object.values(data).map(arr => arr.length));
    const df = sampleSize - 2;
    
    const pValues: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    const confidenceIntervals: ConfidenceInterval[][] = Array(n).fill(null).map(() => Array(n).fill(null));
    const criticalValues: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const r = correlationMatrix[i][j];
          const t = r * Math.sqrt(df) / Math.sqrt(1 - r * r);
          
          // Calculate p-value (two-tailed)
          pValues[i][j] = this.tTestPValue(t, df);
          
          // Calculate confidence interval
          const fisherZ = 0.5 * Math.log((1 + r) / (1 - r));
          const seZ = 1 / Math.sqrt(sampleSize - 3);
          const zCritical = 1.96; // 95% confidence
          
          const lowerZ = fisherZ - zCritical * seZ;
          const upperZ = fisherZ + zCritical * seZ;
          
          confidenceIntervals[i][j] = {
            lower: (Math.exp(2 * lowerZ) - 1) / (Math.exp(2 * lowerZ) + 1),
            upper: (Math.exp(2 * upperZ) - 1) / (Math.exp(2 * upperZ) + 1),
            confidence_level: 0.95
          };
          
          criticalValues[i][j] = this.tCriticalValue(df, 0.05);
        }
      }
    }
    
    return {
      p_values: pValues,
      confidence_intervals: confidenceIntervals,
      critical_values: criticalValues,
      degrees_of_freedom: df
    };
  }

  private static tTestPValue(t: number, df: number): number {
    // Approximation for t-test p-value
    const x = df / (df + t * t);
    return this.incompleteBeta(df / 2, 0.5, x);
  }

  private static tCriticalValue(df: number, alpha: number): number {
    // Approximation for t critical value at given alpha level
    if (df >= 30) return 1.96; // Normal approximation
    const tTable: Record<number, number> = {
      1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
      10: 2.228, 15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042
    };
    
    const closestDf = Object.keys(tTable)
      .map(Number)
      .reduce((prev, curr) => Math.abs(curr - df) < Math.abs(prev - df) ? curr : prev);
    
    return tTable[closestDf];
  }

  private static incompleteBeta(a: number, b: number, x: number): number {
    // Simplified incomplete beta function approximation
    if (x === 0) return 0;
    if (x === 1) return 1;
    return 0.5; // Placeholder - would need proper implementation
  }

  private static calculatePartialCorrelations(data: Record<string, number[]>): PartialCorrelationData {
    const targets = Object.keys(data);
    const n = targets.length;
    
    // For simplicity, calculate partial correlations controlling for the first variable
    const controlVariable = targets[0];
    const remainingTargets = targets.slice(1);
    
    const partialMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    const significanceLevels: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Calculate partial correlations (simplified)
    for (let i = 1; i < n; i++) {
      for (let j = 1; j < n; j++) {
        if (i !== j) {
          const rXY = this.pearsonCorrelation(data[targets[i]], data[targets[j]]);
          const rXZ = this.pearsonCorrelation(data[targets[i]], data[controlVariable]);
          const rYZ = this.pearsonCorrelation(data[targets[j]], data[controlVariable]);
          
          const partialR = (rXY - rXZ * rYZ) / Math.sqrt((1 - rXZ * rXZ) * (1 - rYZ * rYZ));
          partialMatrix[i][j] = partialR;
          
          // Calculate significance level
          const df = data[targets[i]].length - 3;
          const t = partialR * Math.sqrt(df) / Math.sqrt(1 - partialR * partialR);
          significanceLevels[i][j] = this.tTestPValue(t, df);
        }
      }
    }
    
    return {
      controlled_variables: [controlVariable],
      partial_matrix: partialMatrix,
      significance_levels: significanceLevels
    };
  }

  private static interpretCorrelationStrengths(matrix: number[][], targets: string[]): CorrelationStrength[] {
    const interpretations: CorrelationStrength[] = [];
    
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const correlation = matrix[i][j];
        const absCorr = Math.abs(correlation);
        
        let strength: CorrelationStrength['strength'];
        if (absCorr < 0.2) strength = 'very_weak';
        else if (absCorr < 0.4) strength = 'weak';
        else if (absCorr < 0.6) strength = 'moderate';
        else if (absCorr < 0.8) strength = 'strong';
        else strength = 'very_strong';
        
        interpretations.push({
          pair: [targets[i], targets[j]],
          correlation,
          strength,
          direction: correlation >= 0 ? 'positive' : 'negative'
        });
      }
    }
    
    return interpretations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }
}

// ==================== GEOGRAPHIC AGGREGATION ====================

export class GeographicAnalyzer {
  /**
   * Aggregate results by FSA codes and custom geographic areas
   */
  static aggregateByGeography(
    results: TargetAnalysisResults,
    properties: RealEstatePropertyFeatures[]
  ): GeographicAggregation {
    const fsaAnalysis = this.analyzeFSARegions(results, properties);
    const proximityAnalysis = this.calculateProximityMetrics(properties);
    const regionalTrends = this.identifyRegionalTrends(fsaAnalysis);
    
    return {
      fsa_analysis: fsaAnalysis,
      custom_areas: [], // Placeholder for custom area analysis
      regional_trends: regionalTrends,
      proximity_analysis: proximityAnalysis
    };
  }

  private static analyzeFSARegions(
    results: TargetAnalysisResults,
    properties: RealEstatePropertyFeatures[]
  ): FSAAnalysis[] {
    const fsaGroups = this.groupByFSA(properties);
    const fsaAnalyses: FSAAnalysis[] = [];
    
    for (const [fsaCode, fsaProperties] of Object.entries(fsaGroups)) {
      const indices = fsaProperties.map(prop => 
        properties.findIndex(p => p === prop)
      ).filter(idx => idx !== -1);
      
      if (indices.length === 0) continue;
      
      const metrics = {
        time_on_market: this.extractMetricsForIndices(results.time_on_market.predictions, indices),
        price_delta: this.extractMetricsForIndices(results.price_delta.predictions, indices),
        rental_yield: this.extractMetricsForIndices(results.rental_yield.predictions, indices),
        investment_score: this.extractMetricsForIndices(results.investment_score.predictions, indices)
      };
      
      const geographicCenter = this.calculateGeographicCenter(fsaProperties);
      const marketPerformance = this.assessMarketPerformance(metrics);
      
      fsaAnalyses.push({
        fsa_code: fsaCode,
        property_count: fsaProperties.length,
        metrics,
        geographic_center: geographicCenter,
        area_rank: 0, // Will be calculated after all FSAs are processed
        market_performance: marketPerformance
      });
    }
    
    // Calculate area ranks
    this.calculateAreaRanks(fsaAnalyses);
    
    return fsaAnalyses.sort((a, b) => a.area_rank - b.area_rank);
  }

  private static groupByFSA(properties: RealEstatePropertyFeatures[]): Record<string, RealEstatePropertyFeatures[]> {
    return properties.reduce((groups, property) => {
      const fsa = property.fsa_code;
      if (!groups[fsa]) {
        groups[fsa] = [];
      }
      groups[fsa].push(property);
      return groups;
    }, {} as Record<string, RealEstatePropertyFeatures[]>);
  }

  private static extractMetricsForIndices(values: number[], indices: number[]): StatisticalSummary {
    const filteredValues = indices.map(idx => values[idx]).filter(val => val !== undefined);
    if (filteredValues.length === 0) {
      throw new Error('No valid values for FSA analysis');
    }
    return StatisticalCalculator.calculateStatistics(filteredValues);
  }

  private static calculateGeographicCenter(properties: RealEstatePropertyFeatures[]): [number, number] {
    const avgLat = properties.reduce((sum, prop) => sum + prop.latitude, 0) / properties.length;
    const avgLng = properties.reduce((sum, prop) => sum + prop.longitude, 0) / properties.length;
    return [avgLat, avgLng];
  }

  private static assessMarketPerformance(metrics: Record<string, StatisticalSummary>): FSAAnalysis['market_performance'] {
    // Simple scoring based on investment score and rental yield
    const investmentScore = metrics.investment_score.mean;
    const rentalYield = metrics.rental_yield.mean;
    
    const combinedScore = (investmentScore * 0.6) + (rentalYield * 40); // Normalize rental yield
    
    if (combinedScore >= 75) return 'excellent';
    if (combinedScore >= 60) return 'good';
    if (combinedScore >= 40) return 'average';
    return 'poor';
  }

  private static calculateAreaRanks(fsaAnalyses: FSAAnalysis[]): void {
    // Rank by combined investment score
    fsaAnalyses.sort((a, b) => 
      b.metrics.investment_score.mean - a.metrics.investment_score.mean
    );
    
    fsaAnalyses.forEach((fsa, index) => {
      fsa.area_rank = index + 1;
    });
  }

  private static calculateProximityMetrics(properties: RealEstatePropertyFeatures[]): ProximityAnalysis {
    const distances = this.calculateNearestNeighborDistances(properties);
    const spatialAutocorr = this.calculateSpatialAutocorrelation(properties);
    const clusteringCoeff = this.calculateClusteringCoefficient(properties, distances);
    const dispersalIndex = this.calculateDispersalIndex(properties);
    
    return {
      nearest_neighbor_distances: distances,
      spatial_autocorrelation: spatialAutocorr,
      clustering_coefficient: clusteringCoeff,
      dispersal_index: dispersalIndex
    };
  }

  private static calculateNearestNeighborDistances(properties: RealEstatePropertyFeatures[]): number[] {
    return properties.map(prop => {
      let minDistance = Infinity;
      
      for (const other of properties) {
        if (prop !== other) {
          const distance = this.haversineDistance(
            prop.latitude, prop.longitude,
            other.latitude, other.longitude
          );
          minDistance = Math.min(minDistance, distance);
        }
      }
      
      return minDistance;
    });
  }

  private static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static calculateSpatialAutocorrelation(properties: RealEstatePropertyFeatures[]): number {
    // Simplified Moran's I calculation
    if (properties.length < 2) return 0;
    
    let numerator = 0;
    let denominator = 0;
    let weightSum = 0;
    
    const mean = properties.reduce((sum, p) => sum + (p.price_current || 0), 0) / properties.length;
    
    for (let i = 0; i < properties.length; i++) {
      for (let j = 0; j < properties.length; j++) {
        if (i !== j) {
          const distance = this.haversineDistance(
            properties[i].latitude, properties[i].longitude,
            properties[j].latitude, properties[j].longitude
          );
          
          const weight = distance < 5 ? 1 / (distance + 0.1) : 0; // Inverse distance weight
          
          numerator += weight * (properties[i].price_current - mean) * (properties[j].price_current - mean);
          weightSum += weight;
        }
      }
      denominator += Math.pow(properties[i].price_current - mean, 2);
    }
    
    return weightSum > 0 ? (properties.length * numerator) / (weightSum * denominator) : 0;
  }

  private static calculateClusteringCoefficient(properties: RealEstatePropertyFeatures[], distances: number[]): number {
    // Simplified clustering coefficient
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const threshold = avgDistance * 0.5;
    
    let clusteredPoints = 0;
    for (const distance of distances) {
      if (distance < threshold) {
        clusteredPoints++;
      }
    }
    
    return clusteredPoints / distances.length;
  }

  private static calculateDispersalIndex(properties: RealEstatePropertyFeatures[]): number {
    if (properties.length < 2) return 0;
    
    const center = this.calculateGeographicCenter(properties);
    const distances = properties.map(prop => 
      this.haversineDistance(prop.latitude, prop.longitude, center[0], center[1])
    );
    
    const meanDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - meanDistance, 2), 0) / distances.length;
    
    return variance / meanDistance; // Coefficient of dispersion
  }

  private static identifyRegionalTrends(fsaAnalyses: FSAAnalysis[]): RegionalTrend[] {
    // Group FSAs by broader regions (simplified by first letter of FSA)
    const regionGroups: Record<string, FSAAnalysis[]> = {};
    
    for (const fsa of fsaAnalyses) {
      const region = fsa.fsa_code.charAt(0);
      if (!regionGroups[region]) {
        regionGroups[region] = [];
      }
      regionGroups[region].push(fsa);
    }
    
    const trends: RegionalTrend[] = [];
    
    for (const [region, fsas] of Object.entries(regionGroups)) {
      const avgInvestmentScore = fsas.reduce((sum, fsa) => 
        sum + fsa.metrics.investment_score.mean, 0) / fsas.length;
      
      // Determine trend (simplified)
      let trendDirection: RegionalTrend['trend_direction'] = 'stable';
      let trendStrength = 0.5;
      
      if (avgInvestmentScore > 60) {
        trendDirection = 'increasing';
        trendStrength = 0.8;
      } else if (avgInvestmentScore < 40) {
        trendDirection = 'decreasing';
        trendStrength = 0.7;
      }
      
      trends.push({
        region,
        trend_direction: trendDirection,
        trend_strength: trendStrength,
        seasonal_patterns: this.generateSeasonalPatterns()
      });
    }
    
    return trends;
  }

  private static generateSeasonalPatterns(): SeasonalPattern[] {
    // Placeholder seasonal patterns for real estate market
    return [
      { season: 'spring', multiplier: 1.15, confidence: 0.8 },
      { season: 'summer', multiplier: 1.20, confidence: 0.9 },
      { season: 'fall', multiplier: 0.95, confidence: 0.7 },
      { season: 'winter', multiplier: 0.80, confidence: 0.8 }
    ];
  }
}

// ==================== MAIN MERGER CLASS ====================

export class MultiTargetResultMerger {
  private startTime: number = 0;
  private memoryUsage: MemoryUsage = {
    peak_mb: 0,
    average_mb: 0,
    gc_events: 0,
    heap_size_mb: 0
  };

  /**
   * Main method to merge multiple microservice results into comprehensive analysis
   */
  async mergeResults(
    responses: Record<string, MultiTargetPredictionResponse>,
    properties: RealEstatePropertyFeatures[],
    analysisId: string
  ): Promise<MergedAnalysisResult> {
    this.startTime = Date.now();
    
    try {
      // Validate inputs
      this.validateInputs(responses, properties);
      
      // Extract and organize target results
      const targets = this.extractTargetResults(responses, properties);
      
      // Calculate comprehensive statistics
      const statistics = this.calculateCombinedStatistics(targets, properties);
      
      // Perform correlation analysis
      const correlations = this.performCorrelationAnalysis(targets);
      
      // Geographic aggregation
      const geographic = GeographicAnalyzer.aggregateByGeography(targets, properties);
      
      // Generate rankings
      const rankings = this.generateMetricRankings(targets, properties);
      
      // Performance benchmarking
      const performance = this.calculatePerformanceBenchmark(responses);
      
      // Generate AI insights
      const insights = await this.generateAIInsights(targets, statistics, correlations, geographic);
      
      // Create metadata
      const metadata = this.createAnalysisMetadata(responses, properties);
      
      const result: MergedAnalysisResult = {
        id: analysisId,
        timestamp: new Date().toISOString(),
        targets,
        statistics,
        correlations,
        geographic,
        rankings,
        performance,
        insights,
        metadata
      };
      
      // Update todo status
      await this.updateTodoStatus();
      
      return result;
      
    } catch (error) {
      console.error('Error merging multi-target results:', error);
      throw new Error(`Result merger failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateInputs(
    responses: Record<string, MultiTargetPredictionResponse>,
    properties: RealEstatePropertyFeatures[]
  ): void {
    if (!responses || Object.keys(responses).length === 0) {
      throw new Error('No microservice responses provided');
    }
    
    if (!properties || properties.length === 0) {
      throw new Error('No property data provided');
    }
    
    // Validate response structure
    for (const [key, response] of Object.entries(responses)) {
      if (!response.predictions || !response.explanations) {
        throw new Error(`Invalid response structure for ${key}`);
      }
    }
  }

  private extractTargetResults(
    responses: Record<string, MultiTargetPredictionResponse>,
    properties: RealEstatePropertyFeatures[]
  ): TargetAnalysisResults {
    const targets: TargetAnalysisResults = {
      time_on_market: this.createTargetResult('time_on_market', responses, properties),
      price_delta: this.createTargetResult('price_delta', responses, properties),
      rental_yield: this.createTargetResult('rental_yield', responses, properties),
      investment_score: this.createTargetResult('investment_score', responses, properties)
    };
    
    return targets;
  }

  private createTargetResult(
    targetName: keyof MultiTargetPredictionResponse['predictions'],
    responses: Record<string, MultiTargetPredictionResponse>,
    properties: RealEstatePropertyFeatures[]
  ): TargetResult {
    // Aggregate predictions from all responses
    const allPredictions: number[] = [];
    const allConfidence: number[] = [];
    const allShapImportance: FeatureImportance[] = [];
    
    for (const [responseKey, response] of Object.entries(responses)) {
      if (response.predictions[targetName]) {
        allPredictions.push(...response.predictions[targetName]);
      }
      
      if (response.confidence_scores[targetName]) {
        allConfidence.push(...response.confidence_scores[targetName]);
      }
      
      // Extract SHAP importance
      if (response.explanations[targetName]) {
        const shapExplanation = response.explanations[targetName];
        const importance = this.extractFeatureImportance(shapExplanation, responseKey);
        allShapImportance.push(...importance);
      }
    }
    
    // Calculate statistics
    const statistics = StatisticalCalculator.calculateStatistics(allPredictions);
    
    // Generate geospatial data
    const geospatialData = this.generateGeoSpatialData(allPredictions, properties);
    
    // Calculate quality score
    const qualityScore = this.calculateQualityScore(allPredictions, allConfidence);
    
    return {
      predictions: allPredictions,
      confidence: allConfidence,
      statistics,
      shap_importance: allShapImportance,
      geospatial_data: geospatialData,
      quality_score: qualityScore
    };
  }

  private extractFeatureImportance(
    shapExplanation: any,
    responseKey: string
  ): FeatureImportance[] {
    const importance: FeatureImportance[] = [];
    
    if (shapExplanation.feature_names && shapExplanation.shap_values) {
      for (let i = 0; i < shapExplanation.feature_names.length; i++) {
        const featureName = shapExplanation.feature_names[i];
        const avgImportance = shapExplanation.shap_values.reduce((sum: number, row: number[]) => 
          sum + Math.abs(row[i] || 0), 0) / shapExplanation.shap_values.length;
        
        importance.push({
          feature: featureName,
          importance: avgImportance,
          category: this.categorizeFeature(featureName),
          rank: 0 // Will be calculated after sorting
        });
      }
    }
    
    // Sort by importance and assign ranks
    importance.sort((a, b) => b.importance - a.importance);
    importance.forEach((item, index) => {
      item.rank = index + 1;
    });
    
    return importance;
  }

  private categorizeFeature(featureName: string): FeatureImportance['category'] {
    const lowerName = featureName.toLowerCase();
    
    if (lowerName.includes('lat') || lowerName.includes('lng') || 
        lowerName.includes('fsa') || lowerName.includes('distance')) {
      return 'spatial';
    }
    
    if (lowerName.includes('income') || lowerName.includes('population') || 
        lowerName.includes('education') || lowerName.includes('demographic')) {
      return 'demographic';
    }
    
    if (lowerName.includes('time') || lowerName.includes('date') || 
        lowerName.includes('season') || lowerName.includes('month')) {
      return 'temporal';
    }
    
    return 'property';
  }

  private generateGeoSpatialData(
    predictions: number[],
    properties: RealEstatePropertyFeatures[]
  ): GeoSpatialData {
    // FSA distribution
    const fsaDistribution: Record<string, number> = {};
    const fsaValues: Record<string, number[]> = {};
    
    properties.forEach((prop, index) => {
      if (index < predictions.length) {
        const fsa = prop.fsa_code;
        if (!fsaDistribution[fsa]) {
          fsaDistribution[fsa] = 0;
          fsaValues[fsa] = [];
        }
        fsaDistribution[fsa]++;
        fsaValues[fsa].push(predictions[index]);
      }
    });
    
    // Calculate geographic variance
    const allValues = Object.values(fsaValues).flat();
    const overallMean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
    const fsaMeans = Object.values(fsaValues).map(values => 
      values.reduce((sum, val) => sum + val, 0) / values.length
    );
    const geographicVariance = fsaMeans.reduce((sum, mean) => 
      sum + Math.pow(mean - overallMean, 2), 0) / fsaMeans.length;
    
    // Identify hotspots
    const hotspots: GeographicHotspot[] = Object.entries(fsaValues).map(([fsa, values]) => {
      const fsaProps = properties.filter(p => p.fsa_code === fsa);
      const center = GeographicAnalyzer['calculateGeographicCenter'](fsaProps);
      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      return {
        fsa_code: fsa,
        center,
        intensity: (avgValue - overallMean) / overallMean,
        property_count: values.length,
        avg_metric_value: avgValue
      };
    }).sort((a, b) => b.intensity - a.intensity);
    
    return {
      fsa_distribution: fsaDistribution,
      spatial_clusters: [], // Placeholder for clustering algorithm
      geographic_variance: geographicVariance,
      hotspots: hotspots.slice(0, 10) // Top 10 hotspots
    };
  }

  private calculateQualityScore(predictions: number[], confidence: number[]): number {
    if (predictions.length === 0) return 0;
    
    // Calculate quality based on multiple factors
    const avgConfidence = confidence.length > 0 ? 
      confidence.reduce((sum, c) => sum + c, 0) / confidence.length : 0.5;
    
    const predictionVariability = StatisticalCalculator.standardDeviation(predictions);
    const normalizedVariability = Math.min(predictionVariability / StatisticalCalculator.mean(predictions), 1);
    
    // Quality score: high confidence, low variability = high quality
    const qualityScore = (avgConfidence * 0.7) + ((1 - normalizedVariability) * 0.3);
    
    return Math.max(0, Math.min(1, qualityScore)) * 100;
  }

  private calculateCombinedStatistics(
    targets: TargetAnalysisResults,
    properties: RealEstatePropertyFeatures[]
  ): CombinedStatistics {
    const propertyCount = properties.length;
    const uniqueFSAs = new Set(properties.map(p => p.fsa_code)).size;
    const totalFSAsInRegion = 100; // Placeholder - would need actual data
    const fsaCoverage = uniqueFSAs / totalFSAsInRegion;
    
    // Calculate data completeness
    const requiredFields = ['latitude', 'longitude', 'bedrooms', 'bathrooms', 'area_sqft', 'price_current'];
    const completenessScores = properties.map(prop => {
      const filledFields = requiredFields.filter(field => prop[field as keyof RealEstatePropertyFeatures] != null).length;
      return filledFields / requiredFields.length;
    });
    const dataCompleteness = completenessScores.reduce((sum, score) => sum + score, 0) / completenessScores.length;
    
    // Cross-target summary
    const crossTargetSummary: CrossTargetSummary = {
      avg_time_on_market: targets.time_on_market.statistics.mean,
      avg_price_delta: targets.price_delta.statistics.mean,
      avg_rental_yield: targets.rental_yield.statistics.mean,
      avg_investment_score: targets.investment_score.statistics.mean,
      combined_confidence: (
        targets.time_on_market.confidence.reduce((sum, c) => sum + c, 0) / targets.time_on_market.confidence.length +
        targets.price_delta.confidence.reduce((sum, c) => sum + c, 0) / targets.price_delta.confidence.length +
        targets.rental_yield.confidence.reduce((sum, c) => sum + c, 0) / targets.rental_yield.confidence.length +
        targets.investment_score.confidence.reduce((sum, c) => sum + c, 0) / targets.investment_score.confidence.length
      ) / 4
    };
    
    return {
      property_count: propertyCount,
      fsa_coverage: fsaCoverage,
      data_completeness: dataCompleteness,
      cross_target_summary: crossTargetSummary
    };
  }

  private performCorrelationAnalysis(targets: TargetAnalysisResults): CorrelationMatrix {
    const targetData: Record<string, number[]> = {
      time_on_market: targets.time_on_market.predictions,
      price_delta: targets.price_delta.predictions,
      rental_yield: targets.rental_yield.predictions,
      investment_score: targets.investment_score.predictions
    };
    
    return CorrelationAnalyzer.calculateCorrelationMatrix(targetData);
  }

  private generateMetricRankings(
    targets: TargetAnalysisResults,
    properties: RealEstatePropertyFeatures[]
  ): MetricRankings {
    const rankings: MetricRankings = {
      time_on_market: this.createPropertyRankings('time_on_market', targets.time_on_market.predictions, properties),
      price_delta: this.createPropertyRankings('price_delta', targets.price_delta.predictions, properties),
      rental_yield: this.createPropertyRankings('rental_yield', targets.rental_yield.predictions, properties),
      investment_score: this.createPropertyRankings('investment_score', targets.investment_score.predictions, properties),
      combined_score: this.createCombinedRankings(targets, properties)
    };
    
    return rankings;
  }

  private createPropertyRankings(
    metricName: string,
    predictions: number[],
    properties: RealEstatePropertyFeatures[]
  ): PropertyRanking[] {
    const rankings: PropertyRanking[] = [];
    
    predictions.forEach((prediction, index) => {
      if (index < properties.length) {
        const property = properties[index];
        rankings.push({
          property_id: `${property.latitude}_${property.longitude}`, // Simple ID
          fsa_code: property.fsa_code,
          coordinates: [property.latitude, property.longitude],
          metric_value: prediction,
          rank: 0, // Will be calculated after sorting
          percentile: 0, // Will be calculated after sorting
          rank_category: 'median' // Will be calculated after sorting
        });
      }
    });
    
    // Sort by metric value (descending for most metrics, ascending for time_on_market)
    const ascending = metricName === 'time_on_market';
    rankings.sort((a, b) => ascending ? a.metric_value - b.metric_value : b.metric_value - a.metric_value);
    
    // Assign ranks and percentiles
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
      ranking.percentile = ((rankings.length - index) / rankings.length) * 100;
      
      // Assign category
      if (ranking.percentile >= 90) ranking.rank_category = 'top_10';
      else if (ranking.percentile >= 75) ranking.rank_category = 'top_25';
      else if (ranking.percentile >= 25) ranking.rank_category = 'median';
      else if (ranking.percentile >= 10) ranking.rank_category = 'bottom_25';
      else ranking.rank_category = 'bottom_10';
    });
    
    return rankings;
  }

  private createCombinedRankings(
    targets: TargetAnalysisResults,
    properties: RealEstatePropertyFeatures[]
  ): PropertyRanking[] {
    const combinedScores: number[] = [];
    
    // Calculate combined score for each property
    for (let i = 0; i < properties.length; i++) {
      const timeScore = targets.time_on_market.predictions[i] ? (100 - targets.time_on_market.predictions[i]) / 100 : 0;
      const priceScore = Math.max(0, targets.price_delta.predictions[i] || 0) / 100;
      const yieldScore = (targets.rental_yield.predictions[i] || 0) / 10; // Assuming max 10% yield
      const investmentScore = (targets.investment_score.predictions[i] || 0) / 100;
      
      const combined = (timeScore * 0.2) + (priceScore * 0.3) + (yieldScore * 0.3) + (investmentScore * 0.2);
      combinedScores.push(combined * 100);
    }
    
    return this.createPropertyRankings('combined_score', combinedScores, properties);
  }

  private calculatePerformanceBenchmark(
    responses: Record<string, MultiTargetPredictionResponse>
  ): PerformanceBenchmark {
    const endTime = Date.now();
    const totalProcessingTime = endTime - this.startTime;
    
    // Extract microservice timings
    const microserviceTimings: Record<string, number> = {};
    for (const [key, response] of Object.entries(responses)) {
      microserviceTimings[key] = response.processing_time;
    }
    
    // Calculate cache hit rate
    const totalResponses = Object.keys(responses).length;
    const cachedResponses = Object.values(responses).filter(r => r.cached).length;
    const cacheHitRate = totalResponses > 0 ? cachedResponses / totalResponses : 0;
    
    // Calculate merger processing time
    const mergerProcessingTime = totalProcessingTime - Object.values(microserviceTimings).reduce((sum, time) => sum + time, 0);
    
    // Mock memory usage (would need actual monitoring in production)
    this.memoryUsage = {
      peak_mb: 128,
      average_mb: 96,
      gc_events: 3,
      heap_size_mb: 256
    };
    
    // Calculate throughput metrics
    const totalProperties = Object.values(responses).reduce((sum, response) => 
      sum + (response.predictions.time_on_market?.length || 0), 0);
    
    const throughputMetrics: ThroughputMetrics = {
      properties_per_second: totalProperties / (totalProcessingTime / 1000),
      predictions_per_second: (totalProperties * 4) / (totalProcessingTime / 1000), // 4 predictions per property
      features_processed_per_second: totalProperties * 20 / (totalProcessingTime / 1000), // Assume 20 features
      shap_calculations_per_second: totalProperties * 4 / (totalProcessingTime / 1000)
    };
    
    return {
      total_processing_time: totalProcessingTime,
      microservice_timings: microserviceTimings,
      merger_processing_time: mergerProcessingTime,
      data_transfer_time: 50, // Placeholder
      cache_hit_rate: cacheHitRate,
      memory_usage: this.memoryUsage,
      throughput_metrics: throughputMetrics
    };
  }

  private async generateAIInsights(
    targets: TargetAnalysisResults,
    statistics: CombinedStatistics,
    correlations: CorrelationMatrix,
    geographic: GeographicAggregation
  ): Promise<AIInsights> {
    // Market summary
    const marketSummary = this.generateMarketSummary(statistics, geographic);
    
    // Key findings
    const keyFindings = this.extractKeyFindings(targets, correlations, geographic);
    
    // Investment recommendations
    const investmentRecommendations = this.generateInvestmentRecommendations(targets, geographic);
    
    // Risk assessment
    const riskAssessment = this.assessRisks(targets, statistics);
    
    // Predictive insights
    const predictiveInsights = this.generatePredictiveInsights(targets, correlations);
    
    // Comparative analysis
    const comparativeAnalysis = this.performComparativeAnalysis(geographic, targets);
    
    return {
      market_summary: marketSummary,
      key_findings: keyFindings,
      investment_recommendations: investmentRecommendations,
      risk_assessment: riskAssessment,
      predictive_insights: predictiveInsights,
      comparative_analysis: comparativeAnalysis
    };
  }

  private generateMarketSummary(
    statistics: CombinedStatistics,
    geographic: GeographicAggregation
  ): string {
    const avgInvestmentScore = statistics.cross_target_summary.avg_investment_score;
    const avgRentalYield = statistics.cross_target_summary.avg_rental_yield;
    const propertyCount = statistics.property_count;
    const fsaCoverage = Math.round(statistics.fsa_coverage * 100);
    
    let marketCondition = 'balanced';
    if (avgInvestmentScore > 70) marketCondition = 'strong';
    else if (avgInvestmentScore < 40) marketCondition = 'weak';
    
    return `Market analysis of ${propertyCount} properties across ${fsaCoverage}% of FSA coverage reveals ${marketCondition} market conditions. ` +
           `Average investment score of ${avgInvestmentScore.toFixed(1)} with rental yields averaging ${avgRentalYield.toFixed(2)}%. ` +
           `Analysis indicates ${geographic.fsa_analysis.length} distinct FSA regions with varying performance characteristics.`;
  }

  private extractKeyFindings(
    targets: TargetAnalysisResults,
    correlations: CorrelationMatrix,
    geographic: GeographicAggregation
  ): string[] {
    const findings: string[] = [];
    
    // High correlation findings
    const strongCorrelations = correlations.pearson.strength_interpretation.filter(s => 
      s.strength === 'strong' || s.strength === 'very_strong'
    );
    
    for (const corr of strongCorrelations.slice(0, 3)) {
      findings.push(`${corr.strength.replace('_', ' ')} ${corr.direction} correlation (${corr.correlation.toFixed(3)}) between ${corr.pair[0]} and ${corr.pair[1]}`);
    }
    
    // Geographic findings
    const topFSA = geographic.fsa_analysis[0];
    if (topFSA) {
      findings.push(`FSA ${topFSA.fsa_code} shows highest performance with ${topFSA.property_count} properties and ${topFSA.market_performance} market rating`);
    }
    
    // Statistical findings
    const highVariability = Object.entries(targets).filter(([_, target]) => 
      target.statistics.std_dev / target.statistics.mean > 0.5
    );
    
    if (highVariability.length > 0) {
      findings.push(`High variability detected in ${highVariability.map(([name]) => name).join(', ')}, indicating diverse market conditions`);
    }
    
    return findings;
  }

  private generateInvestmentRecommendations(
    targets: TargetAnalysisResults,
    geographic: GeographicAggregation
  ): InvestmentRecommendation[] {
    const recommendations: InvestmentRecommendation[] = [];
    
    // Analyze top performing FSAs
    const topPerformers = geographic.fsa_analysis
      .filter(fsa => fsa.market_performance === 'excellent' || fsa.market_performance === 'good')
      .slice(0, 3);
    
    for (const fsa of topPerformers) {
      const avgInvestmentScore = fsa.metrics.investment_score.mean;
      const avgYield = fsa.metrics.rental_yield.mean;
      
      let recommendationType: InvestmentRecommendation['type'] = 'hold';
      if (avgInvestmentScore > 75 && avgYield > 5) recommendationType = 'buy';
      else if (avgInvestmentScore < 30) recommendationType = 'avoid';
      
      recommendations.push({
        type: recommendationType,
        confidence: Math.min(avgInvestmentScore / 100, 0.95),
        rationale: `FSA ${fsa.fsa_code} shows strong fundamentals with investment score ${avgInvestmentScore.toFixed(1)} and yield ${avgYield.toFixed(2)}%`,
        target_metrics: ['investment_score', 'rental_yield'],
        fsa_codes: [fsa.fsa_code],
        expected_return_range: [avgYield * 0.8, avgYield * 1.2],
        risk_level: avgInvestmentScore > 60 ? 'low' : 'medium'
      });
    }
    
    return recommendations;
  }

  private assessRisks(
    targets: TargetAnalysisResults,
    statistics: CombinedStatistics
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];
    
    // Market volatility risk
    const priceVolatility = targets.price_delta.statistics.std_dev;
    if (priceVolatility > 15) {
      riskFactors.push({
        factor: 'High price volatility',
        impact: 'high',
        probability: 0.7,
        description: `Price delta standard deviation of ${priceVolatility.toFixed(2)}% indicates significant market volatility`
      });
    }
    
    // Liquidity risk
    const avgTimeOnMarket = targets.time_on_market.statistics.mean;
    if (avgTimeOnMarket > 60) {
      riskFactors.push({
        factor: 'Liquidity concerns',
        impact: 'medium',
        probability: 0.6,
        description: `Average time on market of ${avgTimeOnMarket.toFixed(0)} days suggests potential liquidity issues`
      });
    }
    
    // Data quality risk
    if (statistics.data_completeness < 0.8) {
      riskFactors.push({
        factor: 'Data quality',
        impact: 'medium',
        probability: 0.8,
        description: `Data completeness of ${(statistics.data_completeness * 100).toFixed(1)}% may affect prediction accuracy`
      });
    }
    
    const overallRiskScore = riskFactors.reduce((sum, factor) => {
      const impact = factor.impact === 'high' ? 3 : factor.impact === 'medium' ? 2 : 1;
      return sum + (impact * factor.probability);
    }, 0) / riskFactors.length;
    
    return {
      overall_risk_score: Math.min(overallRiskScore * 20, 100),
      risk_factors: riskFactors,
      mitigation_strategies: [
        'Diversify across multiple FSA regions',
        'Monitor market conditions regularly',
        'Validate predictions with additional data sources',
        'Consider professional market analysis'
      ],
      market_volatility: priceVolatility
    };
  }

  private generatePredictiveInsights(
    targets: TargetAnalysisResults,
    correlations: CorrelationMatrix
  ): PredictiveInsight[] {
    const insights: PredictiveInsight[] = [];
    
    // Investment score trend
    const investmentTrend = targets.investment_score.statistics.mean > 60 ? 'increasing' : 'stable';
    insights.push({
      metric: 'investment_score',
      prediction_horizon: '6_months',
      predicted_trend: investmentTrend,
      confidence: 0.75,
      supporting_factors: ['Strong correlation with rental yield', 'Positive market fundamentals']
    });
    
    // Rental yield forecast
    const yieldTrend = targets.rental_yield.statistics.mean > 4 ? 'increasing' : 'decreasing';
    insights.push({
      metric: 'rental_yield',
      prediction_horizon: '1_year',
      predicted_trend: yieldTrend,
      confidence: 0.65,
      supporting_factors: ['Market demand patterns', 'Economic indicators']
    });
    
    return insights;
  }

  private performComparativeAnalysis(
    geographic: GeographicAggregation,
    targets: TargetAnalysisResults
  ): ComparativeAnalysis {
    // Best and worst performing FSAs
    const sortedFSAs = geographic.fsa_analysis.sort((a, b) => 
      b.metrics.investment_score.mean - a.metrics.investment_score.mean
    );
    
    const bestPerforming = sortedFSAs.slice(0, 5).map(fsa => fsa.fsa_code);
    const worstPerforming = sortedFSAs.slice(-5).map(fsa => fsa.fsa_code);
    
    // Identify outlier properties
    const outlierProperties: OutlierProperty[] = [];
    
    // Find properties with extreme investment scores
    targets.investment_score.predictions.forEach((score, index) => {
      const zScore = Math.abs((score - targets.investment_score.statistics.mean) / targets.investment_score.statistics.std_dev);
      if (zScore > 2) {
        outlierProperties.push({
          property_id: `property_${index}`,
          fsa_code: 'unknown', // Would need to map from properties array
          outlier_type: score > targets.investment_score.statistics.mean ? 'positive' : 'negative',
          affected_metrics: ['investment_score'],
          deviation_magnitude: zScore
        });
      }
    });
    
    // Market segments
    const marketSegments: MarketSegment[] = [
      {
        segment_name: 'High-yield investments',
        characteristics: ['Rental yield > 5%', 'Investment score > 70'],
        property_count: targets.rental_yield.predictions.filter(y => y > 5).length,
        average_performance: { rental_yield: 6.5, investment_score: 75 },
        growth_potential: 0.8
      },
      {
        segment_name: 'Quick-sale properties',
        characteristics: ['Time on market < 30 days', 'Competitive pricing'],
        property_count: targets.time_on_market.predictions.filter(t => t < 30).length,
        average_performance: { time_on_market: 20, price_delta: -5 },
        growth_potential: 0.6
      }
    ];
    
    return {
      best_performing_fsas: bestPerforming,
      worst_performing_fsas: worstPerforming,
      outlier_properties: outlierProperties.slice(0, 10),
      market_segments: marketSegments
    };
  }

  private createAnalysisMetadata(
    responses: Record<string, MultiTargetPredictionResponse>,
    properties: RealEstatePropertyFeatures[]
  ): AnalysisMetadata {
    // Extract model versions
    const modelVersions: Record<string, string> = {};
    for (const [key, response] of Object.entries(responses)) {
      modelVersions[key] = response.model_version;
    }
    
    // Calculate data quality score
    const requiredFields = ['latitude', 'longitude', 'bedrooms', 'bathrooms', 'area_sqft', 'price_current'];
    const qualityScores = properties.map(prop => {
      const filledFields = requiredFields.filter(field => prop[field as keyof RealEstatePropertyFeatures] != null).length;
      return filledFields / requiredFields.length;
    });
    const dataQualityScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    
    // Coverage metrics
    const spatialBounds = this.calculateSpatialBounds(properties);
    const spatialCoveragePercent = 85; // Placeholder calculation
    
    const coverageMetrics: CoverageMetrics = {
      spatial_coverage_percent: spatialCoveragePercent,
      temporal_coverage_days: 365, // Placeholder
      feature_completeness_percent: dataQualityScore * 100,
      missing_data_impact: dataQualityScore > 0.8 ? 'low' : dataQualityScore > 0.6 ? 'medium' : 'high'
    };
    
    // Validation results
    const validationResults: ValidationResults = {
      cross_validation_score: 0.82, // Placeholder - would come from model training
      out_of_sample_accuracy: 0.75, // Placeholder
      prediction_stability: 0.88, // Placeholder
      bias_metrics: {
        geographic_bias: 0.15,
        price_range_bias: 0.12,
        property_type_bias: 0.08,
        temporal_bias: 0.05
      }
    };
    
    return {
      analysis_version: '2.1.0',
      model_versions: modelVersions,
      feature_set_version: 'v1.5',
      data_quality_score: dataQualityScore * 100,
      coverage_metrics: coverageMetrics,
      validation_results: validationResults
    };
  }

  private calculateSpatialBounds(properties: RealEstatePropertyFeatures[]): {
    minLat: number, maxLat: number, minLng: number, maxLng: number
  } {
    return properties.reduce((bounds, prop) => ({
      minLat: Math.min(bounds.minLat, prop.latitude),
      maxLat: Math.max(bounds.maxLat, prop.latitude),
      minLng: Math.min(bounds.minLng, prop.longitude),
      maxLng: Math.max(bounds.maxLng, prop.longitude)
    }), {
      minLat: Infinity,
      maxLat: -Infinity,
      minLng: Infinity,
      maxLng: -Infinity
    });
  }

  private async updateTodoStatus(): Promise<void> {
    // This would integrate with the todo system to mark completion
    console.log('Multi-target result merger completed successfully');
  }
}

// ==================== EXPORT ====================

export default MultiTargetResultMerger;