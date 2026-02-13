import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { VisualizationType } from './types/visualization';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import { Polygon, Point } from '@arcgis/core/geometry';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import ClassBreakInfo from '@arcgis/core/renderers/support/ClassBreakInfo';
import * as geometryEngineAsync from '@arcgis/core/geometry/geometryEngineAsync';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Graphic from '@arcgis/core/Graphic';

interface SpatialStatistics {
  moransI: number;
  getisOrdG: number;
  hotspots: number;
  coldspots: number;
  outliers: number;
}

export interface CorrelationResult {
  pearson: number;
  spearman: number;
  kendall: number;
  pValue: number;
  spatialStats: SpatialStatistics;
}

interface FieldStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  missingValues: number;
}

export interface CorrelationOptions {
  method?: 'pearson' | 'spearman' | 'kendall' | 'all';
  includeSpatialStats?: boolean;
  confidenceLevel?: number;
  outlierThreshold?: number;
  batchSize?: number;
}

export class CorrelationService {
  private static correlationCache = new Map<string, CorrelationResult>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly DEFAULT_BATCH_SIZE = 100;

  private static getCacheKey(
    layer: FeatureLayer,
    primaryField: string,
    comparisonField: string,
    options: CorrelationOptions
  ): string {
    return `${layer.id}-${primaryField}-${comparisonField}-${JSON.stringify(options)}`;
  }

  /**
   * Calculate correlation between two fields in a feature layer
   */
  public static async calculateCorrelation(
    layer: FeatureLayer,
    primaryField: string,
    comparisonField: string
  ): Promise<CorrelationResult> {
    const features = await this.getValidFeatures(layer, primaryField, comparisonField);
    const { x, y } = this.getValidValuePairs(features, primaryField, comparisonField);

    const pearson = this.calculatePearson(features, primaryField, comparisonField);
    const spearman = this.calculateSpearman(features, primaryField, comparisonField);
    const kendall = this.calculateKendall(features, primaryField, comparisonField);

    // Calculate p-value using t-test
    const n = x.length;
    const r = pearson;
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const pValue = 2 * (1 - this.tCDF(Math.abs(t), n - 2));

    // Calculate spatial statistics
    const spatialStats = await this.calculateSpatialStats(features, primaryField, comparisonField);

    return {
      pearson,
      spearman,
      kendall,
      pValue,
      spatialStats
    };
  }

  private static isValidValue(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  private static validateFeature(feature: __esri.Graphic): {
    isValid: boolean;
    reason?: string;
    primaryValue?: number;
    comparisonValue?: number;
  } {
    if (!feature.attributes) {
      return { isValid: false, reason: 'Missing attributes' };
    }

    const attrs = feature.attributes;
    const primaryValue = attrs.primary_value || attrs.value;
    const comparisonValue = attrs.comparison_value || attrs.comparisonValue;

    if (!this.isValidValue(primaryValue)) {
      return { 
        isValid: false, 
        reason: `Invalid primary value: ${primaryValue}`,
        primaryValue,
        comparisonValue
      };
    }

    if (!this.isValidValue(comparisonValue)) {
      return { 
        isValid: false, 
        reason: `Invalid comparison value: ${comparisonValue}`,
        primaryValue,
        comparisonValue
      };
    }

    return { 
      isValid: true,
      primaryValue,
      comparisonValue
    };
  }

  private static async validateAndProcessFeatures(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string,
    batchSize: number
  ): Promise<{ validFeatures: __esri.Graphic[]; fieldStats: { primary: FieldStats; comparison: FieldStats } }> {
    console.log('[CorrelationService] Validating features:', {
      totalFeatures: features.length,
      primaryField,
      comparisonField,
      batchSize
    });

    const validFeatures: __esri.Graphic[] = [];
    const primaryValues: number[] = [];
    const comparisonValues: number[] = [];
    const validationErrors: Record<string, number> = {};

    // Process features in batches
    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      await Promise.all(batch.map(async (feature) => {
        try {
          const validation = this.validateFeature(feature);
          
          if (validation.isValid && validation.primaryValue !== undefined && validation.comparisonValue !== undefined) {
            validFeatures.push(feature);
            primaryValues.push(validation.primaryValue);
            comparisonValues.push(validation.comparisonValue);
          } else {
            validationErrors[validation.reason || 'unknown'] = (validationErrors[validation.reason || 'unknown'] || 0) + 1;
            console.warn(`Invalid feature ${feature.attributes?.OBJECTID}:`, validation);
          }
        } catch (error) {
          console.warn(`Error processing feature ${feature.attributes?.OBJECTID}:`, error);
          validationErrors['processing_error'] = (validationErrors['processing_error'] || 0) + 1;
        }
      }));
    }

    // Log validation summary
    console.log('[CorrelationService] Feature validation summary:', {
      totalFeatures: features.length,
      validFeatures: validFeatures.length,
      invalidFeatures: features.length - validFeatures.length,
      validationErrors
    });

    // Ensure we have enough valid features for correlation
    if (validFeatures.length < 3) {
      throw new Error(
        `Insufficient valid features for correlation analysis. ` +
        `Found ${validFeatures.length} valid features, minimum required is 3. ` +
        `Validation errors: ${JSON.stringify(validationErrors)}`
      );
    }

    // Calculate field statistics
    const fieldStats = {
      primary: this.calculateFieldStats(primaryValues),
      comparison: this.calculateFieldStats(comparisonValues)
    };

    return { validFeatures, fieldStats };
  }

  private static calculateFieldStats(values: number[]): FieldStats {
    if (values.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        missingValues: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length;

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev: Math.sqrt(variance),
      missingValues: 0 // We already filtered out missing values
    };
  }

  private static async calculateCorrelationInternal(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string,
    options: CorrelationOptions
  ): Promise<CorrelationResult> {
    // Calculate Pearson correlation (always included)
    const pearson = this.calculatePearson(features, primaryField, comparisonField);
    
    const result: CorrelationResult = {
      pearson,
      spearman: this.calculateSpearman(features, primaryField, comparisonField),
      kendall: this.calculateKendall(features, primaryField, comparisonField),
      pValue: this.calculatePValue(pearson, features.length),
      spatialStats: await this.calculateSpatialStats(features, primaryField, comparisonField)
    };

    // Calculate spatial statistics if requested
    if (options.includeSpatialStats) {
      const spatialStats = await this.calculateSpatialStats(
        features,
        primaryField,
        comparisonField
      );
      
      result.spatialStats = {
        moransI: spatialStats.moransI,
        getisOrdG: spatialStats.getisOrdG,
        hotspots: spatialStats.hotspots,
        coldspots: spatialStats.coldspots,
        outliers: spatialStats.outliers
      };
    }

    return result;
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private static calculatePearson(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string
  ): number {
    const pairs = features.map(f => ({
      x: f.attributes[primaryField],
      y: f.attributes[comparisonField]
    }));

    const n = pairs.length;
    if (n === 0) return NaN;
    
    // Calculate means
    const xMean = pairs.reduce((sum, pair) => sum + pair.x, 0) / n;
    const yMean = pairs.reduce((sum, pair) => sum + pair.y, 0) / n;
    
    // Calculate covariance and variances
    let covariance = 0;
    let xVariance = 0;
    let yVariance = 0;
    
    for (const pair of pairs) {
      const xDiff = pair.x - xMean;
      const yDiff = pair.y - yMean;
      covariance += xDiff * yDiff;
      xVariance += xDiff * xDiff;
      yVariance += yDiff * yDiff;
    }
    
    // Calculate Pearson correlation coefficient
    if (xVariance === 0 || yVariance === 0) return 0;
    return covariance / Math.sqrt(xVariance * yVariance);
  }

  /**
   * Calculate Spearman's rank correlation coefficient
   */
  private static calculateSpearman(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string
  ): number {
    const pairs = features.map(f => ({
      x: f.attributes[primaryField],
      y: f.attributes[comparisonField]
    }));
    
    // Create ranked versions of the data
    const rankedPairs = this.rankData(pairs);
    
    // Calculate Pearson correlation on ranked data
    return this.calculatePearson(
      rankedPairs.map(p => ({
        attributes: {
          [primaryField]: p.x,
          [comparisonField]: p.y
        }
      } as __esri.Graphic)),
      primaryField,
      comparisonField
    );
  }

  /**
   * Calculate Kendall's tau correlation coefficient
   */
  private static calculateKendall(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string
  ): number {
    const pairs = features.map(f => ({
      x: f.attributes[primaryField],
      y: f.attributes[comparisonField]
    }));

    const n = pairs.length;
    let concordant = 0;
    let discordant = 0;
    
    // Compare all pairs
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const pair1 = pairs[i];
        const pair2 = pairs[j];
        
        const xDiff = pair1.x - pair2.x;
        const yDiff = pair1.y - pair2.y;
        
        if (xDiff * yDiff > 0) concordant++;
        else if (xDiff * yDiff < 0) discordant++;
      }
    }
    
    // Calculate Kendall's tau
    const total = concordant + discordant;
    return total > 0 ? (concordant - discordant) / total : 0;
  }

  /**
   * Calculate spatial statistics (Moran's I and Getis-Ord G*)
   */
  private static async calculateSpatialStats(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string
  ): Promise<SpatialStatistics> {
    // Calculate Moran's I
    const moransI = this.calculateMoransI(features, primaryField);

    // Calculate Getis-Ord G*
    const getisOrdG = this.calculateGetisOrdG(features, primaryField);

    // Calculate hot/cold spots and outliers
    const { hotspots, coldspots, outliers } = this.identifySpatialPatterns(features, primaryField);

    return {
      moransI,
      getisOrdG,
      hotspots,
      coldspots,
      outliers
    };
  }

  /**
   * Calculate Moran's I statistic
   */
  private static calculateMoransI(
    features: __esri.Graphic[],
    field: string
  ): number {
    const n = features.length;
    const values = features.map(f => f.attributes[field]);
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    let sumWeights = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const zScoreI = values[i] - mean;
          const zScoreJ = values[j] - mean;
          numerator += zScoreI * zScoreJ;
          sumWeights += 1;
        }
      }
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    return (n / sumWeights) * (numerator / denominator);
  }

  /**
   * Calculate Getis-Ord G* statistic
   */
  private static calculateGetisOrdG(
    features: __esri.Graphic[],
    field: string
  ): number {
    const n = features.length;
    const values = features.map(f => f.attributes[field]);
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n
    );
    
    let sumWeightedValues = 0;
    let sumWeights = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          sumWeightedValues += values[j];
          sumWeights += 1;
        }
      }
    }
    
    return sumWeightedValues / (stdDev * Math.sqrt(
      (n * sumWeights - Math.pow(sumWeights, 2)) / (n - 1)
    ));
  }

  /**
   * Identify spatial patterns (hot spots, cold spots, outliers)
   */
  private static identifySpatialPatterns(
    features: __esri.Graphic[],
    primaryField: string
  ): {
    hotspots: number;
    coldspots: number;
    outliers: number;
  } {
    const values = features.map(f => f.attributes[primaryField] as number);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
    
    let hotspots = 0;
    let coldspots = 0;
    let outliers = 0;
    
    for (let i = 0; i < values.length; i++) {
      const zScore = (values[i] - mean) / stdDev;
      
      if (zScore > 2) {
        hotspots++;
      } else if (zScore < -2) {
        coldspots++;
      }
      
      if (Math.abs(zScore) > 3) {
        outliers++;
      }
    }
    
    return { hotspots, coldspots, outliers };
  }

  /**
   * Helper method to rank data for Spearman correlation
   */
  private static rankData(pairs: { x: number; y: number }[]): { x: number; y: number }[] {
    // Create sorted arrays for ranking
    const sortedX = [...pairs].sort((a, b) => a.x - b.x);
    const sortedY = [...pairs].sort((a, b) => a.y - b.y);
    
    // Create rank maps
    const xRanks = new Map<number, number>();
    const yRanks = new Map<number, number>();
    
    // Assign ranks, handling ties
    let currentRank = 1;
    while (currentRank <= sortedX.length) {
      const currentX = sortedX[currentRank - 1].x;
      const currentY = sortedY[currentRank - 1].y;
      
      // Count ties
      let xTies = 1;
      let yTies = 1;
      
      while (currentRank + xTies <= sortedX.length && 
             sortedX[currentRank + xTies - 1].x === currentX) {
        xTies++;
      }
      
      while (currentRank + yTies <= sortedY.length && 
             sortedY[currentRank + yTies - 1].y === currentY) {
        yTies++;
      }
      
      // Calculate average rank for ties
      const xRank = currentRank + (xTies - 1) / 2;
      const yRank = currentRank + (yTies - 1) / 2;
      
      // Assign ranks
      for (let i = 0; i < xTies; i++) {
        xRanks.set(sortedX[currentRank + i - 1].x, xRank);
      }
      
      for (let i = 0; i < yTies; i++) {
        yRanks.set(sortedY[currentRank + i - 1].y, yRank);
      }
      
      currentRank += Math.max(xTies, yTies);
    }
    
    // Create ranked pairs
    return pairs.map(pair => ({
      x: xRanks.get(pair.x) || 0,
      y: yRanks.get(pair.y) || 0
    }));
  }

  /**
   * Calculate p-value for correlation coefficient
   */
  private static calculatePValue(correlation: number, n: number): number {
    if (n <= 2) return 1;
    
    const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const df = n - 2;
    
    // Simplified p-value calculation using t-distribution
    return 2 * (1 - this.tCDF(Math.abs(t), df));
  }

  /**
   * Helper method for t-distribution CDF
   */
  private static tCDF(t: number, df: number): number {
    const x = (t + Math.sqrt(t * t + df)) / (2 * Math.sqrt(t * t + df));
    return this.betaCDF(x, df / 2, df / 2);
  }

  /**
   * Helper method for inverse normal CDF
   */
  private static inverseNormalCDF(p: number): number {
    // Simplified approximation
    const a1 = -39.6968302866538;
    const a2 = 220.946098424521;
    const a3 = -275.928510446969;
    const a4 = 138.357751867269;
    const a5 = -30.6647980661472;
    const a6 = 2.50662827745924;
    
    const b1 = -54.4760987982241;
    const b2 = 161.585836858041;
    const b3 = -155.698979859887;
    const b4 = 66.8013118877197;
    const b5 = -13.2806815528857;
    
    const c1 = -0.00778489400243029;
    const c2 = -0.322396458041136;
    const c3 = -2.40075827716184;
    const c4 = -2.54973253934373;
    const c5 = 4.37466414146497;
    const c6 = 2.93816398269878;
    
    const d1 = 0.00778469570904146;
    const d2 = 0.32246712907004;
    const d3 = 2.445134137143;
    const d4 = 3.75440866190742;
    
    const p_low = 0.02425;
    const p_high = 1 - p_low;
    
    let q, r;
    
    if (p < p_low) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else if (p <= p_high) {
      q = p - 0.5;
      r = q * q;
      return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
  }

  /**
   * Helper method for regularized beta function
   */
  private static betaRegularized(x: number, a: number, b: number): number {
    // Simplified approximation
    const epsilon = 1e-10;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let am = 1;
    let bm = 1;
    let bz = 1 - qab * x / qap;
    
    for (let m = 1; m <= 100; m++) {
      const em = m;
      const tem = em + em;
      let d = em * (b - em) * x / ((qam + tem) * (a + tem));
      const ap = am + d * bm;
      const bp = bm + d / ap;
      d = -(a + em) * (qab + em) * x / ((a + tem) * (qap + tem));
      const app = ap + d * bp;
      const bpp = bp + d / app;
      const oldBm = bm;
      am = ap / bpp;
      bm = bp / bpp;
      bz = bz * am;
      
      if (Math.abs(bm - oldBm) < epsilon * Math.abs(bm)) {
        return bz;
      }
    }
    
    return bz;
  }

  /**
   * Get features from a layer
   */
  private static async getFeatures(layer: FeatureLayer): Promise<__esri.Graphic[]> {
    const query = layer.createQuery();
    query.outFields = ['*'];
    query.returnGeometry = true;
    return (await layer.queryFeatures(query)).features;
  }

  /**
   * Update layer renderer based on correlation results
   */
  static async updateLayerRenderer(
    layer: FeatureLayer,
    visualizationType: VisualizationType,
    primaryField: string,
    comparisonField: string
  ): Promise<void> {
    const features = await this.getFeatures(layer);
    const validPairs = this.getValidValuePairs(features, primaryField, comparisonField);
    
    switch (visualizationType) {
      case 'combined': {
        // Show combined correlation strength
        const renderer = new ClassBreaksRenderer({
          field: 'correlation',
          classBreakInfos: [
            { minValue: -1, maxValue: -0.7, symbol: this.createSymbol('#ff0000') },
            { minValue: -0.7, maxValue: -0.3, symbol: this.createSymbol('#ff6666') },
            { minValue: -0.3, maxValue: 0.3, symbol: this.createSymbol('#ffffff') },
            { minValue: 0.3, maxValue: 0.7, symbol: this.createSymbol('#66ff66') },
            { minValue: 0.7, maxValue: 1, symbol: this.createSymbol('#00ff00') }
          ]
        });
        layer.renderer = renderer;
        break;
      }

      case 'primary':
        // Show primary variable values
        layer.renderer = new ClassBreaksRenderer({
          field: primaryField,
          classBreakInfos: this.createClassBreaks(features, primaryField)
        });
        break;

      case 'comparison':
        // Show comparison variable values
        layer.renderer = new ClassBreaksRenderer({
          field: comparisonField,
          classBreakInfos: this.createClassBreaks(features, comparisonField)
        });
        break;

      case 'local': {
        // Show local correlation strength
        const localCorrelation = this.calculateLocalCorrelation(features, primaryField, comparisonField);
        layer.renderer = new ClassBreaksRenderer({
          field: 'local_correlation',
          classBreakInfos: [
            { minValue: -1, maxValue: -0.7, symbol: this.createSymbol('#ff0000') },
            { minValue: -0.7, maxValue: -0.3, symbol: this.createSymbol('#ff6666') },
            { minValue: -0.3, maxValue: 0.3, symbol: this.createSymbol('#ffffff') },
            { minValue: 0.3, maxValue: 0.7, symbol: this.createSymbol('#66ff66') },
            { minValue: 0.7, maxValue: 1, symbol: this.createSymbol('#00ff00') }
          ]
        });
        break;
      }

      case 'hotspots': {
        // Show hot/cold spots
        const { hotspots, coldspots } = this.identifySpatialPatterns(features, primaryField);
        layer.renderer = new UniqueValueRenderer({
          field: 'spatial_pattern',
          uniqueValueInfos: [
            { value: 'hot', symbol: this.createSymbol('#ff0000') },
            { value: 'cold', symbol: this.createSymbol('#0000ff') },
            { value: 'none', symbol: this.createSymbol('#ffffff') }
          ]
        });
        break;
      }

      case 'outliers': {
        // Show spatial outliers
        const outliers = this.identifyOutliers(features, primaryField, comparisonField);
        layer.renderer = new UniqueValueRenderer({
          field: 'is_outlier',
          uniqueValueInfos: [
            { value: 'outlier', symbol: this.createSymbol('#ff00ff') },
            { value: 'normal', symbol: this.createSymbol('#ffffff') }
          ]
        });
        break;
      }
    }
  }

  private static createSymbol(color: string): SimpleFillSymbol {
    return new SimpleFillSymbol({
      color: color,
      outline: {
        color: [0, 0, 0, 0.5],
        width: 1
      }
    });
  }

  private static createClassBreaks(features: __esri.Graphic[], field: string): ClassBreakInfo[] {
    const values = features.map(f => f.attributes[field]).filter(v => v !== null && v !== undefined);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const breaks = 5;
    
    return Array.from({ length: breaks }, (_, i) => {
      const breakInfo = new ClassBreakInfo();
      breakInfo.minValue = min + (range * i) / breaks;
      breakInfo.maxValue = min + (range * (i + 1)) / breaks;
      breakInfo.symbol = this.createSymbol(this.getColorForValue(i / breaks));
      breakInfo.label = `${breakInfo.minValue.toFixed(2)} - ${breakInfo.maxValue.toFixed(2)}`;
      return breakInfo;
    });
  }

  private static getColorForValue(value: number): string {
    const colors = ['#ff0000', '#ff6666', '#ffffff', '#66ff66', '#00ff00'];
    return colors[Math.floor(value * (colors.length - 1))];
  }

  private static calculateLocalCorrelation(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string
  ): number[] {
    // P1-29: Removed Math.random() placeholder
    // Local correlation requires neighborhood-based windowing calculation
    // For now, return null values until proper implementation is needed
    console.warn('calculateLocalCorrelation: This method requires proper neighborhood analysis implementation');
    return features.map(() => 0); // Return neutral correlation value instead of random
  }

  private static identifyOutliers(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string
  ): boolean[] {
    // P1-29: Removed Math.random() placeholder
    // Use proper statistical outlier detection instead
    const values = features.map(f => ({
      primary: f.attributes[primaryField],
      comparison: f.attributes[comparisonField]
    }));

    // Calculate z-scores for both fields
    const primaryMean = values.reduce((sum, v) => sum + v.primary, 0) / values.length;
    const comparisonMean = values.reduce((sum, v) => sum + v.comparison, 0) / values.length;

    const primaryStdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v.primary - primaryMean, 2), 0) / values.length
    );
    const comparisonStdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v.comparison - comparisonMean, 2), 0) / values.length
    );

    // Identify outliers using 3-sigma rule
    return values.map(v => {
      const primaryZScore = Math.abs((v.primary - primaryMean) / primaryStdDev);
      const comparisonZScore = Math.abs((v.comparison - comparisonMean) / comparisonStdDev);
      return primaryZScore > 3 || comparisonZScore > 3;
    });
  }

  private static getValidValuePairs(
    features: __esri.Graphic[],
    primaryField: string,
    comparisonField: string
  ): { x: number[]; y: number[] } {
    const x: number[] = [];
    const y: number[] = [];
    
    features.forEach(feature => {
      x.push(feature.attributes[primaryField]);
      y.push(feature.attributes[comparisonField]);
    });
    
    return { x, y };
  }

  static clearCache(): void {
    this.correlationCache.clear();
  }

  static removeFromCache(
    layer: FeatureLayer,
    primaryField?: string,
    comparisonField?: string
  ): void {
    const keysToDelete: string[] = [];
    
    this.correlationCache.forEach((_, key) => {
      const [layerId, primary, comparison] = key.split('-');
      
      if (layerId === layer.id) {
        if (!primaryField && !comparisonField) {
          keysToDelete.push(key);
        } else if (primaryField && primary === primaryField) {
          if (!comparisonField || comparison === comparisonField) {
            keysToDelete.push(key);
          }
        }
      }
    });

    keysToDelete.forEach(key => this.correlationCache.delete(key));
  }

  private static async getValidFeatures(
    layer: FeatureLayer,
    primaryField: string,
    comparisonField?: string
  ): Promise<__esri.Graphic[]> {
    const features = await this.getFeatures(layer);
    return features.filter(feature => {
      const primaryValue = feature.attributes[primaryField];
      if (!this.isValidValue(primaryValue)) return false;
      
      if (comparisonField) {
        const comparisonValue = feature.attributes[comparisonField];
        return this.isValidValue(comparisonValue);
      }
      
      return true;
    });
  }

  private static betaCDF(x: number, a: number, b: number): number {
    const bt = Math.exp(this.logBeta(a, b));
    return this.betaIncomplete(x, a, b) / bt;
  }

  private static logBeta(a: number, b: number): number {
    return this.logGamma(a) + this.logGamma(b) - this.logGamma(a + b);
  }

  private static logGamma(x: number): number {
    const cof = [
      76.18009172947146,
      -86.50532032941677,
      24.01409824083091,
      -1.231739572450155,
      0.1208650973866179e-2,
      -0.5395239384953e-5
    ];
    
    let y = x;
    let tmp = x + 5.5;
    tmp = (x + 0.5) * Math.log(tmp) - tmp;
    
    let ser = 1.00000000019001; // eslint-disable-line no-loss-of-precision -- Truncated slightly for precision linting
    
    for (let j = 0; j < 6; j++) {
      y += 1;
      ser += cof[j] / y;
    }
    
    return -tmp + Math.log(2.506628274631 * ser / x);
  }

  private static betaIncomplete(x: number, a: number, b: number): number {
    const bt = Math.exp(this.logBeta(a, b));
    if (x === 0 || x === 1) {
      return 0;
    }
    if (x < 0 || x > 1) {
      throw new Error('x must be between 0 and 1');
    }
    return this.betaContinuedFraction(x, a, b) * bt;
  }

  private static betaContinuedFraction(x: number, a: number, b: number): number {
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-30) {
      d = 1e-30;
    }
    d = 1 / d;
    let h = d;
    
    for (let m = 1; m <= 100; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) {
        d = 1e-30;
      }
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) {
        c = 1e-30;
      }
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) {
        d = 1e-30;
      }
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) {
        c = 1e-30;
      }
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 3e-7) {
        break;
      }
    }
    
    return h;
  }

  /**
   * Aggregate features from one geographic level to another
   */
  private static async aggregateFeatures(
    sourceFeatures: __esri.Graphic[],
    targetFeatures: __esri.Graphic[],
    field: string
  ): Promise<{ [key: string]: number }> {
    const aggregatedValues: { [key: string]: number } = {};
    
    // Process each source feature
    for (const sourceFeature of sourceFeatures) {
      if (!sourceFeature.geometry) continue;

      // Find intersecting target features by checking each target feature
      for (const targetFeature of targetFeatures) {
        if (!targetFeature.geometry) continue;

        const intersection = await geometryEngineAsync.intersect(
          sourceFeature.geometry as __esri.Polygon,
          targetFeature.geometry as __esri.Polygon
        ) as __esri.Polygon;
        
        if (intersection) {
          const sourceArea = await geometryEngineAsync.geodesicArea(sourceFeature.geometry as Polygon, 'square-meters');
          const intersectionArea = await geometryEngineAsync.geodesicArea(intersection, 'square-meters');
          const proportion = intersectionArea / sourceArea;
          
          const targetId = targetFeature.attributes.OBJECTID || targetFeature.attributes.FID;
          if (!aggregatedValues[targetId]) {
            aggregatedValues[targetId] = 0;
          }
          aggregatedValues[targetId] += sourceFeature.attributes[field] * proportion;
        }
      }
    }

    return aggregatedValues;
  }

  /**
   * Calculate correlation between two fields from different layers
   */
  public static async calculateCrossLayerCorrelation(
    primaryLayer: FeatureLayer,
    primaryField: string,
    comparisonLayer: FeatureLayer,
    comparisonField: string
  ): Promise<CorrelationResult> {
    // Get features from both layers
    const primaryFeatures = await this.getValidFeatures(primaryLayer, primaryField, comparisonField);
    const comparisonFeatures = await this.getValidFeatures(comparisonLayer, comparisonField, primaryField);

    // Convert features to proper Graphic objects
    const convertToGraphic = (feature: __esri.Graphic): Graphic => {
      return new Graphic({
        geometry: feature.geometry as __esri.Polygon,
        attributes: feature.attributes
      });
    };

    const primaryGraphics = primaryFeatures.map(convertToGraphic);
    const comparisonGraphics = comparisonFeatures.map(convertToGraphic);

    // Determine which layer has the larger geographic units
    const primaryAvgArea = await this.calculateAverageArea(primaryGraphics);
    const comparisonAvgArea = await this.calculateAverageArea(comparisonGraphics);

    let aggregatedValues: { [key: string]: number };
    let targetFeatures: Graphic[];
    let targetField: string;

    if (primaryAvgArea > comparisonAvgArea) {
      // Primary layer has larger units, aggregate comparison layer
      aggregatedValues = await this.aggregateFeatures(comparisonGraphics, primaryGraphics, comparisonField);
      targetFeatures = primaryGraphics;
      targetField = primaryField;
    } else {
      // Comparison layer has larger units, aggregate primary layer
      aggregatedValues = await this.aggregateFeatures(primaryGraphics, comparisonGraphics, primaryField);
      targetFeatures = comparisonGraphics;
      targetField = comparisonField;
    }

    // Create a new feature set with both values
    const combinedFeatures = targetFeatures.map(feature => {
      const id = feature.attributes.OBJECTID || feature.attributes.FID;
      return new Graphic({
        geometry: feature.geometry as __esri.Polygon,
        attributes: {
          ...feature.attributes,
          [primaryField]: feature.attributes[primaryField],
          [comparisonField]: aggregatedValues[id] || null
        }
      });
    });

    // Filter out features with missing values
    const validFeatures = combinedFeatures.filter(feature => 
      this.isValidValue(feature.attributes[primaryField]) && 
      this.isValidValue(feature.attributes[comparisonField])
    );

    // Calculate correlations
    const pearson = this.calculatePearson(validFeatures, primaryField, comparisonField);
    const spearman = this.calculateSpearman(validFeatures, primaryField, comparisonField);
    const kendall = this.calculateKendall(validFeatures, primaryField, comparisonField);
    const pValue = this.calculatePValue(pearson, validFeatures.length);
    const spatialStats = await this.calculateSpatialStats(validFeatures, primaryField, comparisonField);

    return {
      pearson,
      spearman,
      kendall,
      pValue,
      spatialStats
    };
  }

  private static async calculateAverageArea(features: Graphic[]): Promise<number> {
    if (features.length === 0) return 0;
    
    let totalArea = 0;
    for (const feature of features) {
      if (feature.geometry && feature.geometry.type === 'polygon') {
        const area = await geometryEngineAsync.geodesicArea(feature.geometry as Polygon, 'square-meters');
        totalArea += area;
      }
    }

    return totalArea / features.length;
  }
} 