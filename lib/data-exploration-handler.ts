import { VisualizationType } from "../reference/dynamic-layers";
import { chatStateManager } from './chat-state-manager';

export interface DataPoint {
  id: string;
  coordinates?: [number, number];
  timestamp?: Date;
  attributes: Record<string, any>;
}

interface DataPattern {
  type: 'cluster' | 'trend' | 'outlier' | 'correlation';
  description: string;
  confidence: number;
  dataPoints: string[]; // IDs of points in the pattern
  metrics?: Record<string, number>;
}

interface DataSummary {
  totalPoints: number;
  categories: string[];
  timeRange?: [Date, Date];
  spatialBounds?: [number, number, number, number];
  patterns: DataPattern[];
  statistics: Record<string, {
    mean?: number;
    median?: number;
    mode?: any;
    min?: number;
    max?: number;
    distribution?: Record<string, number>;
  }>;
}

export class DataExplorationHandler {
  private dataPoints: Map<string, DataPoint> = new Map();
  private patterns: DataPattern[] = [];
  private summary: DataSummary;

  constructor() {
    this.summary = {
      totalPoints: 0,
      categories: [],
      patterns: [],
      statistics: {}
    };
  }

  /**
   * Updates the data context with new data points
   */
  updateDataContext(sessionId: string, points: DataPoint[]): void {
    // Clear existing data points
    this.dataPoints.clear();
    
    // Update internal data store
    points.forEach(point => this.dataPoints.set(point.id, point));
    
    // Generate new summary
    this.generateSummary();
    
    // Update chat state with new context
    chatStateManager.updateDataContext(sessionId, {
      visualizationType: this.determineVisualizationType(),
      dataSummary: {
        totalPoints: this.summary.totalPoints,
        categories: this.summary.categories,
        timeRange: this.summary.timeRange,
        spatialBounds: this.summary.spatialBounds
      },
      availableMetrics: this.getAvailableMetrics(),
      currentFilters: {}
    });
  }

  /**
   * Analyzes the data for patterns and insights
   */
  async analyzeData(sessionId: string): Promise<string> {
    const patterns = await this.detectPatterns();
    this.patterns = patterns;
    
    // Generate insights message
    const insights = this.generateInsightsMessage(patterns);
    
    // Add system message with insights
    chatStateManager.addMessage(sessionId, insights, 'system', {
      visualizationType: this.determineVisualizationType()
    });
    
    return insights;
  }

  /**
   * Suggests filters based on data patterns
   */
  suggestFilters(sessionId: string): string[] {
    const suggestions: string[] = [];
    
    // Suggest filters based on patterns
    this.patterns.forEach(pattern => {
      switch (pattern.type) {
        case 'cluster':
          suggestions.push(`Filter to show ${pattern.description}`);
          break;
        case 'trend':
          suggestions.push(`Focus on ${pattern.description}`);
          break;
        case 'outlier':
          suggestions.push(`Highlight ${pattern.description}`);
          break;
      }
    });
    
    return suggestions;
  }

  /**
   * Applies filters to the data
   */
  applyFilters(sessionId: string, filters: Record<string, any>): void {
    // Update current filters in chat state
    chatStateManager.updateDataContext(sessionId, {
      currentFilters: filters
    });
    
    // Reanalyze data with new filters
    this.analyzeData(sessionId);
  }

  private generateSummary(): void {
    const points = Array.from(this.dataPoints.values());
    
    this.summary = {
      totalPoints: points.length,
      categories: this.extractCategories(points),
      timeRange: this.calculateTimeRange(points),
      spatialBounds: this.calculateSpatialBounds(points),
      patterns: this.patterns,
      statistics: this.calculateStatistics(points)
    };
  }

  private async detectPatterns(): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];
    const points = Array.from(this.dataPoints.values());
    
    // Detect clusters
    const clusters = this.detectClusters(points);
    patterns.push(...clusters);
    
    // Detect trends
    const trends = this.detectTrends(points);
    patterns.push(...trends);
    
    // Detect outliers
    const outliers = this.detectOutliers(points);
    patterns.push(...outliers);
    
    return patterns;
  }

  /**
   * Detects spatial clusters in the dataset using a distance-based approach.
   * Uses an increased distance threshold (0.05) to form more meaningful clusters
   * and requires at least 3 points to form a cluster.
   * 
   * @param points - Array of data points with coordinates
   * @returns Array of detected clusters with center points and metrics
   * 
   * @example
   * // Detect clusters of property locations
   * const clusters = detectClusters(propertyData);
   */
  private detectClusters(points: DataPoint[]): DataPattern[] {
    const patterns: DataPattern[] = [];
    const pointsWithCoords = points.filter(p => p.coordinates);
    
    if (pointsWithCoords.length < 3) return patterns;
    
    // Increased distance threshold for clustering
    const CLUSTER_DISTANCE_THRESHOLD = 0.05; // Increased from 0.01
    
    const clusters: DataPoint[][] = [];
    const visited = new Set<string>();
    
    for (const point of pointsWithCoords) {
      if (visited.has(point.id)) continue;
      
      const cluster: DataPoint[] = [point];
      visited.add(point.id);
      
      // Find nearby points with increased threshold
      for (const other of pointsWithCoords) {
        if (visited.has(other.id)) continue;
        
        const distance = this.calculateDistance(point.coordinates!, other.coordinates!);
        if (distance < CLUSTER_DISTANCE_THRESHOLD) {
          cluster.push(other);
          visited.add(other.id);
        }
      }
      
      if (cluster.length >= 3) {
        clusters.push(cluster);
      }
    }
    
    // Convert clusters to patterns
    clusters.forEach(cluster => {
      const center = this.calculateClusterCenter(cluster);
      const description = `centered at (${center[0].toFixed(4)}, ${center[1].toFixed(4)})`;
      
      patterns.push({
        type: 'cluster',
        description,
        confidence: Math.min(0.7 + (cluster.length * 0.05), 0.95),
        dataPoints: cluster.map(p => p.id),
        metrics: {
          size: cluster.length,
          density: cluster.length / this.calculateClusterArea(cluster)
        }
      });
    });
    
    return patterns;
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;
    
    // Simple Euclidean distance (approximation)
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2));
  }

  private calculateClusterCenter(cluster: DataPoint[]): [number, number] {
    const coords = cluster.map(p => p.coordinates!);
    const sumLat = coords.reduce((sum, [lat]) => sum + lat, 0);
    const sumLon = coords.reduce((sum, [, lon]) => sum + lon, 0);
    
    return [
      sumLat / coords.length,
      sumLon / coords.length
    ];
  }

  private calculateClusterArea(cluster: DataPoint[]): number {
    const coords = cluster.map(p => p.coordinates!);
    const lats = coords.map(([lat]) => lat);
    const lons = coords.map(([, lon]) => lon);
    
    const width = Math.max(...lons) - Math.min(...lons);
    const height = Math.max(...lats) - Math.min(...lats);
    
    return width * height;
  }

  /**
   * Detects trends in time-series data by analyzing changes in numeric attributes.
   * Uses relaxed thresholds to catch subtle trends:
   * - Minimum slope: 0.000001 (very small changes over time)
   * - Minimum R-squared: 0.05 (weak but potentially meaningful relationships)
   * 
   * @param points - Array of data points with timestamps and numeric attributes
   * @returns Array of detected trends with confidence scores and metrics
   * 
   * @example
   * // Detect trends in property values over time
   * const trends = detectTrends(propertyData);
   */
  private detectTrends(points: DataPoint[]): DataPattern[] {
    const patterns: DataPattern[] = [];
    const pointsWithTime = points.filter(p => p.timestamp);
    if (pointsWithTime.length < 3) return patterns;
    
    // Sort points by timestamp
    const sortedPoints = [...pointsWithTime].sort((a, b) => 
        a.timestamp!.getTime() - b.timestamp!.getTime()
    );
    
    // Group points by attribute
    const attributeGroups = new Map<string, DataPoint[]>();
    sortedPoints.forEach(point => {
        Object.entries(point.attributes).forEach(([key, value]) => {
            if (typeof value === 'number') {
                if (!attributeGroups.has(key)) {
                    attributeGroups.set(key, []);
                }
                attributeGroups.get(key)!.push(point);
            }
        });
    });
    
    // Analyze trends with relaxed thresholds
    attributeGroups.forEach((groupPoints, attribute) => {
        const values = groupPoints.map(p => p.attributes[attribute] as number);
        const timestamps = groupPoints.map(p => p.timestamp!.getTime());
        const { slope, rSquared } = this.calculateLinearRegression(timestamps, values);
        
        // Relaxed thresholds for trend detection
        if (Math.abs(slope) > 0.000001 && rSquared > 0.05) {
            const trend = slope > 0 ? 'increasing' : 'decreasing';
            const startValue = values[0];
            const endValue = values[values.length - 1];
            const change = ((endValue - startValue) / startValue) * 100;
            
            patterns.push({
                type: 'trend',
                description: `${attribute} shows a ${trend} trend (${change.toFixed(1)}% change)`,
                confidence: Math.min(0.7 + (rSquared * 0.3), 0.95),
                dataPoints: groupPoints.map(p => p.id),
                metrics: {
                    slope,
                    rSquared,
                    changePercent: change
                }
            });
        }
    });
    
    return patterns;
  }

  private calculateLinearRegression(x: number[], y: number[]): { slope: number; rSquared: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (ssResidual / ssTotal);
    
    return { slope, rSquared };
  }

  private detectOutliers(points: DataPoint[]): DataPattern[] {
    const patterns: DataPattern[] = [];
    
    // Group points by attribute
    const attributeGroups = new Map<string, DataPoint[]>();
    points.forEach(point => {
      Object.entries(point.attributes).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (!attributeGroups.has(key)) {
            attributeGroups.set(key, []);
          }
          attributeGroups.get(key)!.push(point);
        }
      });
    });

    // Detect outliers for each numeric attribute
    attributeGroups.forEach((groupPoints, attribute) => {
      const values = groupPoints.map(p => p.attributes[attribute] as number);
      const { mean, stdDev } = this.calculateMeanAndStdDev(values);
      
      // Points more than 1.5 standard deviations from the mean are considered outliers
      const threshold = 1.5; // Lowered threshold for outlier detection
      const outliers = groupPoints.filter(point => {
        const value = point.attributes[attribute] as number;
        const zScore = Math.abs((value - mean) / stdDev);
        return zScore > threshold;
      });
      
      if (outliers.length > 0) {
        const outlierValues = outliers.map(p => p.attributes[attribute] as number);
        const minOutlier = Math.min(...outlierValues);
        const maxOutlier = Math.max(...outlierValues);
        
        patterns.push({
          type: 'outlier',
          description: `${outliers.length} outliers in ${attribute} (range: ${minOutlier.toFixed(1)} to ${maxOutlier.toFixed(1)})`,
          confidence: Math.min(0.7 + (outliers.length * 0.05), 0.95),
          dataPoints: outliers.map(p => p.id),
          metrics: {
            mean,
            stdDev,
            minOutlier,
            maxOutlier,
            outlierCount: outliers.length
          }
        });
      }
    });
    
    return patterns;
  }

  private calculateMeanAndStdDev(values: number[]): { mean: number; stdDev: number } {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    return { mean, stdDev };
  }

  private generateInsightsMessage(patterns: DataPattern[]): string {
    if (patterns.length === 0) {
      return "I don't see any significant patterns in the data yet.";
    }

    const insights = patterns.map(pattern => {
      switch (pattern.type) {
        case 'cluster':
          return `I found a cluster of ${pattern.dataPoints.length} points ${pattern.description}`;
        case 'trend':
          return `There's a trend showing ${pattern.description}`;
        case 'outlier':
          return `I noticed some outliers: ${pattern.description}`;
        case 'correlation':
          return `There's a correlation between ${pattern.description}`;
        default:
          return '';
      }
    }).filter(Boolean);

    return insights.join('. ') + '.';
  }

  private determineVisualizationType(): VisualizationType {
    const points = Array.from(this.dataPoints.values());
    
    // If we have temporal data, suggest trends
    if (points.some(p => p.timestamp)) {
      return VisualizationType.TRENDS;
    }
    
    // If we have spatial data, suggest scatter
    if (points.some(p => p.coordinates)) {
      return VisualizationType.SCATTER;
    }
    
    // Default to scatter
    return VisualizationType.SCATTER;
  }

  private getAvailableMetrics(): string[] {
    const points = Array.from(this.dataPoints.values());
    if (points.length === 0) return [];
    
    return Object.keys(points[0].attributes);
  }

  private extractCategories(points: DataPoint[]): string[] {
    const categories = new Set<string>();
    points.forEach(point => {
      Object.entries(point.attributes).forEach(([key, value]) => {
        if (typeof value === 'string') {
          categories.add(value);
        }
      });
    });
    return Array.from(categories);
  }

  private calculateTimeRange(points: DataPoint[]): [Date, Date] | undefined {
    const timestamps = points
      .map(p => p.timestamp)
      .filter((t): t is Date => t !== undefined);
    
    if (timestamps.length === 0) return undefined;
    
    return [
      new Date(Math.min(...timestamps.map(t => t.getTime()))),
      new Date(Math.max(...timestamps.map(t => t.getTime())))
    ];
  }

  private calculateSpatialBounds(points: DataPoint[]): [number, number, number, number] | undefined {
    const coordinates = points
      .map(p => p.coordinates)
      .filter((c): c is [number, number] => c !== undefined);
    
    if (coordinates.length === 0) return undefined;
    
    const lats = coordinates.map(c => c[0]);
    const lons = coordinates.map(c => c[1]);
    
    return [
      Math.min(...lats),
      Math.min(...lons),
      Math.max(...lats),
      Math.max(...lons)
    ];
  }

  private calculateStatistics(points: DataPoint[]): Record<string, any> {
    const stats: Record<string, any> = {};
    
    // Get all numeric attributes
    const numericAttributes = new Set<string>();
    points.forEach(point => {
      Object.entries(point.attributes).forEach(([key, value]) => {
        if (typeof value === 'number') {
          numericAttributes.add(key);
        }
      });
    });
    
    // Calculate statistics for each numeric attribute
    numericAttributes.forEach(attr => {
      const values = points
        .map(p => p.attributes[attr])
        .filter((v): v is number => typeof v === 'number');
      
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = this.calculateQuantile(sorted, 0.25);
        const q3 = this.calculateQuantile(sorted, 0.75);
        const iqr = q3 - q1;
        
        stats[attr] = {
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          median: this.calculateMedian(values),
          min: Math.min(...values),
          max: Math.max(...values),
          stdDev: this.calculateStdDev(values),
          q1,
          q3,
          iqr,
          skewness: this.calculateSkewness(values),
          kurtosis: this.calculateKurtosis(values),
          distribution: this.calculateDistribution(values)
        };
      }
    });
    
    // Calculate correlations between numeric attributes
    const correlations = this.calculateCorrelations(points, Array.from(numericAttributes));
    if (Object.keys(correlations).length > 0) {
      stats.correlations = correlations;
    }
    
    return stats;
  }

  /**
   * Calculates a quantile value from a sorted array of numbers.
   * Uses linear interpolation for more accurate results between data points.
   * 
   * @param sorted - Array of numbers sorted in ascending order
   * @param q - Quantile value between 0 and 1 (e.g., 0.25 for Q1, 0.5 for median, 0.75 for Q3)
   * @returns The calculated quantile value
   * 
   * @example
   * // Calculate Q1 (25th percentile)
   * const q1 = calculateQuantile([1, 2, 3, 4, 5], 0.25); // Returns 2
   */
  private calculateQuantile(sorted: number[], q: number): number {
    const n = sorted.length;
    if (n === 0) return NaN;
    
    // Handle edge cases
    if (q <= 0) return sorted[0];
    if (q >= 1) return sorted[n - 1];
    
    // Calculate position
    const pos = (n - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    
    // Handle edge cases
    if (base + 1 >= n) return sorted[base];
    
    // Linear interpolation
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  private calculateStdDev(values: number[]): number {
    if (values.length <= 1) {
      return 0; // Standard deviation is 0 for a single point or empty array
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1); // Use n-1 for sample standard deviation
    return Math.sqrt(variance);
  }

  /**
   * Calculates the skewness of a dataset using the Fisher-Pearson coefficient.
   * Positive skewness indicates a distribution with a longer right tail,
   * negative skewness indicates a distribution with a longer left tail.
   * 
   * @param values - Array of numeric values
   * @returns The skewness coefficient (0 for symmetric distribution)
   * 
   * @example
   * // Calculate skewness of a right-skewed distribution
   * const skew = calculateSkewness([1, 2, 2, 3, 4, 5, 6, 7, 8, 9]); // Returns positive value
   */
  private calculateSkewness(values: number[]): number {
    if (values.length < 3) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = this.calculateStdDev(values);
    const n = values.length;
    
    // Calculate cubed deviations
    const cubedDeviations = values.map(x => Math.pow((x - mean) / stdDev, 3));
    
    // Calculate skewness using Fisher-Pearson coefficient
    const skewness = (cubedDeviations.reduce((a, b) => a + b, 0) / n) * 
                    Math.sqrt(n * (n - 1)) / (n - 2);
    
    return skewness; // Keep original sign
  }

  private calculateKurtosis(values: number[]): number {
    if (values.length < 4) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = this.calculateStdDev(values);
    const n = values.length;
    
    const fourthMoment = values.reduce((sum, x) => sum + Math.pow((x - mean) / stdDev, 4), 0) / n;
    return fourthMoment - 3; // Excess kurtosis
  }

  private calculateDistribution(values: number[]): Record<string, number> {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
    const binSize = range / binCount;
    
    const distribution: Record<string, number> = {};
    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binSize;
      const binEnd = i === binCount - 1 ? max + 0.0001 : binStart + binSize; // Include the last value
      const binLabel = `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`;
      distribution[binLabel] = values.filter(v => v >= binStart && v < binEnd).length;
    }
    
    return distribution;
  }

  /**
   * Calculates correlations between numeric attributes in the dataset.
   * Only returns correlations that exceed the threshold (0.7) to focus on
   * meaningful relationships while avoiding perfect correlations.
   * 
   * @param points - Array of data points containing numeric attributes
   * @param attributes - List of attribute names to analyze
   * @returns Object containing correlation matrices for each attribute pair
   * 
   * @example
   * // Calculate correlations between 'age' and 'income'
   * const correlations = calculateCorrelations(points, ['age', 'income']);
   */
  private calculateCorrelations(points: DataPoint[], attributes: string[]): Record<string, Record<string, number>> {
    const correlations: Record<string, Record<string, number>> = {};
    const CORRELATION_THRESHOLD = 0.7; // Increased from 0.5
    
    for (let i = 0; i < attributes.length; i++) {
        const attr1 = attributes[i];
        correlations[attr1] = {};
        for (let j = i + 1; j < attributes.length; j++) {
            const attr2 = attributes[j];
            const values1 = points.map(p => p.attributes[attr1] as number);
            const values2 = points.map(p => p.attributes[attr2] as number);
            const correlation = this.calculatePearsonCorrelation(values1, values2);
            if (Math.abs(correlation) > CORRELATION_THRESHOLD && Math.abs(correlation) < 0.9999) {
                correlations[attr1][attr2] = correlation;
            }
        }
        if (Object.keys(correlations[attr1]).length === 0) {
            delete correlations[attr1];
        }
    }
    return correlations;
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }
}

// Export a singleton instance
export const dataExplorationHandler = new DataExplorationHandler(); 