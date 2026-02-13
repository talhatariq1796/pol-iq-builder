// src/lib/analytics/analysisEngine.ts
import Graphic from "@arcgis/core/Graphic";

export interface AnalysisResult {
  summary: string;
  insights: string[];
  patterns: {
    type: 'cluster' | 'outlier' | 'trend';
    description: string;
    significance: number;
  }[];
  statistics: {
    basic: BasicStats;
    distribution: DistributionStats;
    spatial: SpatialStats;
  };
  metadata?: {
    timestamp: number;
    version: string;
    processingTime: number;
  };
}

interface BasicStats {
  mean: number;
  median: number;
  stdDev: number;
  quartiles: number[];
}

interface DistributionStats {
  skewness: number;
  kurtosis: number;
  isNormal: boolean;
}

interface SpatialStats {
  clusters: {
    high: string[];
    low: string[];
  };
  outliers: string[];
  globalTrends: string[];
}

export class AnalysisEngine {
  calculateBasicStats(features: __esri.Graphic[]): BasicStats {
    if (!features.length) {
      throw new Error('No features provided for analysis');
    }

    const values = features.map(f => f.attributes.thematic_value);
    values.sort((a, b) => a - b);
    
    const mean = values.reduce((a, b) => a + b) / values.length;
    const median = values[Math.floor(values.length / 2)];
    
    const stdDev = Math.sqrt(
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
    );

    const quartiles = [
      values[Math.floor(values.length * 0.25)],
      median,
      values[Math.floor(values.length * 0.75)]
    ];

    return { mean, median, stdDev, quartiles };
  }

  analyzeDistribution(features: __esri.Graphic[]): DistributionStats {
    if (!features.length) {
      throw new Error('No features provided for distribution analysis');
    }

    const values = features.map(f => f.attributes.thematic_value);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
    );

    // Calculate skewness
    const skewness = values.reduce(
      (acc, val) => acc + Math.pow((val - mean) / stdDev, 3),
      0
    ) / values.length;

    // Calculate kurtosis
    const kurtosis = values.reduce(
      (acc, val) => acc + Math.pow((val - mean) / stdDev, 4),
      0
    ) / values.length - 3;

    // Test for normality using Jarque-Bera test
    const jbTest = values.length * (Math.pow(skewness, 2) / 6 + Math.pow(kurtosis, 2) / 24);
    const isNormal = jbTest < 5.99; // 95% confidence level

    return { skewness, kurtosis, isNormal };
  }

  analyzeSpatialPatterns(features: __esri.Graphic[]): SpatialStats {
    if (!features.length) {
      throw new Error('No features provided for spatial analysis');
    }

    const basicStats = this.calculateBasicStats(features);
    const threshold = basicStats.stdDev;

    // Identify clusters and outliers
    const clusters = {
      high: [] as string[],
      low: [] as string[]
    };
    const outliers: string[] = [];
    const globalTrends: string[] = [];

    // Group features by district
    const districtGroups = features.reduce((acc, feature) => {
      const district = feature.attributes.admin3_name;
      if (!acc[district]) acc[district] = [];
      acc[district].push(feature);
      return acc;
    }, {} as Record<string, __esri.Graphic[]>);

    // Analyze patterns within districts
    Object.entries(districtGroups).forEach(([district, districtFeatures]) => {
      const districtMean = districtFeatures.reduce(
        (sum, f) => sum + f.attributes.thematic_value, 
        0
      ) / districtFeatures.length;

      if (Math.abs(districtMean - basicStats.mean) > threshold) {
        if (districtMean > basicStats.mean) {
          clusters.high.push(district);
        } else {
          clusters.low.push(district);
        }
      }

      // Identify outliers within districts
      districtFeatures.forEach(feature => {
        if (Math.abs(feature.attributes.thematic_value - districtMean) > threshold * 2) {
          outliers.push(feature.attributes.admin4_name);
        }
      });
    });

    // Analyze global trends (e.g., north-south, east-west patterns)
    const northSouth = this.analyzeDirectionalTrend(features, 'lat');
    const eastWest = this.analyzeDirectionalTrend(features, 'lon');
    
    if (northSouth) globalTrends.push(northSouth);
    if (eastWest) globalTrends.push(eastWest);

    return { clusters, outliers, globalTrends };
  }

  private analyzeDirectionalTrend(
    features: __esri.Graphic[], 
    direction: 'lat' | 'lon'
  ): string | null {
    try {
      // Simplified trend analysis
      const sorted = [...features].sort((a, b) => {
        const aCoord = a.geometry?.extent?.center?.[direction === 'lat' ? 'latitude' : 'longitude'] ?? 0;
        const bCoord = b.geometry?.extent?.center?.[direction === 'lat' ? 'latitude' : 'longitude'] ?? 0;
        return aCoord - bCoord;
      });

      const lowValues = sorted.slice(0, Math.floor(sorted.length / 3));
      const highValues = sorted.slice(-Math.floor(sorted.length / 3));

      const lowMean = lowValues.reduce((sum, f) => sum + f.attributes.thematic_value, 0) / lowValues.length;
      const highMean = highValues.reduce((sum, f) => sum + f.attributes.thematic_value, 0) / highValues.length;

      if (Math.abs(highMean - lowMean) > 10) {
        const trend = highMean > lowMean ? 'increasing' : 'decreasing';
        const direction_text = direction === 'lat' ? 'south to north' : 'west to east';
        return `Pet ownership tends to be ${trend} from ${direction_text}`;
      }

      return null;
    } catch (error) {
      console.error('Error analyzing directional trend:', error);
      return null;
    }
  }

  async analyzeFeatures(features: __esri.Graphic[]): Promise<AnalysisResult> {
    try {
      const basicStats = this.calculateBasicStats(features);
      const distribution = this.analyzeDistribution(features);
      const spatial = this.analyzeSpatialPatterns(features);

      // Generate insights based on the analysis
      const insights: string[] = [];

      // Basic statistical insights
      if (basicStats.stdDev > 15) {
        insights.push("There is significant variation in pet ownership across areas");
      }

      // Distribution insights
      if (distribution.skewness > 1) {
        insights.push("Pet ownership is skewed towards higher values");
      } else if (distribution.skewness < -1) {
        insights.push("Pet ownership is skewed towards lower values");
      }

      // Spatial insights
      if (spatial.clusters.high.length > 0) {
        insights.push(`High pet ownership clusters found in: ${spatial.clusters.high.join(', ')}`);
      }
      if (spatial.outliers.length > 0) {
        insights.push(`Notable outliers detected in: ${spatial.outliers.join(', ')}`);
      }

      // Pattern detection
      const patterns = [
        ...spatial.globalTrends.map(trend => ({
          type: 'trend' as const,
          description: trend,
          significance: 0.8
        })),
        ...spatial.clusters.high.map(cluster => ({
          type: 'cluster' as const,
          description: `High-value cluster in ${cluster}`,
          significance: 0.9
        }))
      ];

      // Generate summary
      const summary = `Analysis of ${features.length} areas shows an average pet ownership rate of ${basicStats.mean.toFixed(1)}%, 
        ranging from ${basicStats.quartiles[0].toFixed(1)}% to ${basicStats.quartiles[2].toFixed(1)}%. 
        ${spatial.clusters.high.length > 0 ? `Notable high-ownership clusters were found in ${spatial.clusters.high.join(', ')}.` : ''}
        ${spatial.globalTrends.length > 0 ? spatial.globalTrends[0] : ''}`;

      return {
        summary,
        insights,
        patterns,
        statistics: {
          basic: basicStats,
          distribution,
          spatial
        }
      };
    } catch (error) {
      console.error('Error in analyzeFeatures:', error);
      throw new Error('Failed to analyze features');
    }
  }
}