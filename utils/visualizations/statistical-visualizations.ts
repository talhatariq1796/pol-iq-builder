import { DEFAULT_FILL_ALPHA } from "./constants";
import { Feature } from '@/types/visualization';
import { Renderer, ClassBreaksRenderer, SimpleRenderer } from '@arcgis/core/renderers';
import Color from '@arcgis/core/Color';
import { LayerConfig } from '@/types/layers';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

export interface StatisticalOptions {
  type: 'boxplot' | 'histogram' | 'scatterplot';
  confidenceInterval?: number;
  outlierDetection?: boolean;
  numBins?: number;
  colorScheme?: 'sequential' | 'diverging' | 'categorical';
}

export interface StatisticalData {
  features: Feature[];
  valueField: string;
  categoryField?: string;
  options: StatisticalOptions;
}

export class StatisticalVisualizations {
  public static createBoxplotRenderer(data: StatisticalData): Renderer {
    const { features, valueField, categoryField, options } = data;
    const values = features.map(f => f.attributes[valueField] as number);
    
    // Calculate statistics
    const stats = this.calculateBoxplotStatistics(values);
    
    // Create class breaks for the boxplot
    return new ClassBreaksRenderer({
      field: valueField,
      classBreakInfos: [
        {
          minValue: stats.min,
          maxValue: stats.q1,
          symbol: {
            type: 'simple-fill' as const,
            color: [200, 200, 200, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }
        },
        {
          minValue: stats.q1,
          maxValue: stats.median,
          symbol: {
            type: 'simple-fill' as const,
            color: [150, 150, 150, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }
        },
        {
          minValue: stats.median,
          maxValue: stats.q3,
          symbol: {
            type: 'simple-fill' as const,
            color: [100, 100, 100, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }
        },
        {
          minValue: stats.q3,
          maxValue: stats.max,
          symbol: {
            type: 'simple-fill' as const,
            color: [50, 50, 50, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }
        }
      ]
    });
  }

  public static createHistogramRenderer(data: StatisticalData): Renderer {
    const { features, valueField, options } = data;
    const values = features.map(f => f.attributes[valueField] as number);
    const numBins = options.numBins || 10;
    
    // Calculate histogram bins
    const bins = this.calculateHistogramBins(values, numBins);
    
    return new ClassBreaksRenderer({
      field: valueField,
      classBreakInfos: bins.map((bin, index) => ({
        minValue: bin.min,
        maxValue: bin.max,
        symbol: {
          type: 'simple-fill' as const,
          color: this.getColorForBin(index, numBins, options.colorScheme),
          outline: { color: [0, 0, 0, 0], width: 0 }
        }
      }))
    });
  }

  public static createScatterplotRenderer(data: StatisticalData): Renderer {
    const { features, valueField, categoryField, options } = data;
    
    // For scatterplot, we'll use a simple renderer with varying symbol sizes
    return new SimpleRenderer({
      symbol: {
        type: 'simple-marker' as const,
        size: 8,
        color: [0, 120, 212, DEFAULT_FILL_ALPHA],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    });
  }

  private static calculateBoxplotStatistics(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.calculateQuantile(sorted, 0.25);
    const median = this.calculateQuantile(sorted, 0.5);
    const q3 = this.calculateQuantile(sorted, 0.75);
    const iqr = q3 - q1;
    const min = Math.max(sorted[0], q1 - 1.5 * iqr);
    const max = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);

    return { min, q1, median, q3, max, iqr };
  }

  private static calculateHistogramBins(values: number[], numBins: number) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / numBins;

    return Array.from({ length: numBins }, (_, i) => ({
      min: min + (i * binWidth),
      max: min + ((i + 1) * binWidth),
      count: values.filter(v => v >= min + (i * binWidth) && v < min + ((i + 1) * binWidth)).length
    }));
  }

  private static calculateQuantile(sorted: number[], q: number): number {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
      return sorted[base];
    }
  }

  private static getColorForBin(index: number, total: number, scheme: string = 'sequential'): number[] {
    switch (scheme) {
      case 'diverging':
        return this.getDivergingColor(index, total);
      case 'categorical':
        return this.getCategoricalColor(index);
      default:
        return this.getSequentialColor(index, total);
    }
  }

  private static getSequentialColor(index: number, total: number): number[] {
    const hue = (index / total) * 240; // Blue to Red
    return this.hslToRgb(hue, 70, 50);
  }

  private static getDivergingColor(index: number, total: number): number[] {
    const hue = ((index / total) * 240) - 120; // Red to Blue
    return this.hslToRgb(hue, 70, 50);
  }

  private static getCategoricalColor(index: number): number[] {
    const hues = [0, 120, 240, 60, 300, 180]; // Red, Green, Blue, Yellow, Magenta, Cyan
    return this.hslToRgb(hues[index % hues.length], 70, 50);
  }

  private static hslToRgb(h: number, s: number, l: number): number[] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)), DEFAULT_FILL_ALPHA];
  }

  /**
   * Calculate correlation between two numeric fields from different layers
   */
  async calculateLayerCorrelation(
    layer1: FeatureLayer,
    field1: string,
    layer2: FeatureLayer,
    field2: string
  ): Promise<number> {
    try {
      const features1 = await layer1.queryFeatures({
        outFields: [field1],
        returnGeometry: false
      });

      const features2 = await layer2.queryFeatures({
        outFields: [field2],
        returnGeometry: false
      });

      const values1 = features1.features.map((f: any) => f.attributes[field1]);
      const values2 = features2.features.map((f: any) => f.attributes[field2]);

      return this.pearsonCorrelation(values1, values2);
    } catch (error) {
      console.error('Error calculating correlation:', error);
      return 0;
    }
  }

  /**
   * Calculate spatial overlap between two layers
   */
  async calculateLayerSpatialOverlap(
    layer1: FeatureLayer,
    layer2: FeatureLayer
  ): Promise<number> {
    try {
      const extent1 = await layer1.queryExtent();
      const extent2 = await layer2.queryExtent();

      const intersection = this.calculateExtentIntersection(extent1.extent, extent2.extent);
      const union = this.calculateExtentUnion(extent1.extent, extent2.extent);

      return intersection / union;
    } catch (error) {
      console.error('Error calculating spatial overlap:', error);
      return 0;
    }
  }

  /**
   * Calculate field differences between two layers
   */
  async calculateLayerFieldDifferences(
    layer1: FeatureLayer,
    layer2: FeatureLayer,
    commonFields: string[]
  ): Promise<Array<{ field: string; value1: number; value2: number; difference: number }>> {
    try {
      const features1 = await layer1.queryFeatures({
        outFields: commonFields,
        returnGeometry: false
      });

      const features2 = await layer2.queryFeatures({
        outFields: commonFields,
        returnGeometry: false
      });

      return commonFields.map(field => {
        const avg1 = this.calculateAverage(features1.features.map((f: any) => f.attributes[field]));
        const avg2 = this.calculateAverage(features2.features.map((f: any) => f.attributes[field]));
        
        return {
          field,
          value1: avg1,
          value2: avg2,
          difference: avg2 - avg1
        };
      });
    } catch (error) {
      console.error('Error calculating field differences:', error);
      return [];
    }
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    let sum_x = 0;
    let sum_y = 0;
    let sum_xy = 0;
    let sum_x2 = 0;
    let sum_y2 = 0;

    for (let i = 0; i < n; i++) {
      sum_x += x[i];
      sum_y += y[i];
      sum_xy += x[i] * y[i];
      sum_x2 += x[i] * x[i];
      sum_y2 += y[i] * y[i];
    }

    const numerator = n * sum_xy - sum_x * sum_y;
    const denominator = Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate average of numeric array
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Calculate intersection area of two extents
   */
  private calculateExtentIntersection(extent1: any, extent2: any): number {
    const xmin = Math.max(extent1.xmin, extent2.xmin);
    const ymin = Math.max(extent1.ymin, extent2.ymin);
    const xmax = Math.min(extent1.xmax, extent2.xmax);
    const ymax = Math.min(extent1.ymax, extent2.ymax);

    if (xmax < xmin || ymax < ymin) return 0;

    return (xmax - xmin) * (ymax - ymin);
  }

  /**
   * Calculate union area of two extents
   */
  private calculateExtentUnion(extent1: any, extent2: any): number {
    const xmin = Math.min(extent1.xmin, extent2.xmin);
    const ymin = Math.min(extent1.ymin, extent2.ymin);
    const xmax = Math.max(extent1.xmax, extent2.xmax);
    const ymax = Math.max(extent1.ymax, extent2.ymax);

    return (xmax - xmin) * (ymax - ymin);
  }

  calculateCorrelation(values1: number[], values2: number[]): number {
    if (values1.length !== values2.length || values1.length === 0) {
      return 0;
    }

    const mean1 = this.calculateMean(values1);
    const mean2 = this.calculateMean(values2);
    const stdDev1 = this.calculateStandardDeviation(values1, mean1);
    const stdDev2 = this.calculateStandardDeviation(values2, mean2);

    if (stdDev1 === 0 || stdDev2 === 0) {
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < values1.length; i++) {
      sum += ((values1[i] - mean1) * (values2[i] - mean2));
    }

    return sum / (values1.length * stdDev1 * stdDev2);
  }

  calculateSpatialOverlap(extents1: __esri.Extent[], extents2: __esri.Extent[]): number {
    if (extents1.length === 0 || extents2.length === 0) {
      return 0;
    }

    const intersection = this.calculateIntersection(extents1, extents2);
    const union = this.calculateUnion(extents1, extents2);

    return intersection / union;
  }

  calculateFieldDifferences(
    features1: __esri.Graphic[],
    features2: __esri.Graphic[],
    fields: string[]
  ): Array<{ field: string; value1: number; value2: number; difference: number }> {
    return fields.map(field => {
      const values1 = features1.map(f => f.attributes[field] as number);
      const values2 = features2.map(f => f.attributes[field] as number);

      const mean1 = this.calculateMean(values1);
      const mean2 = this.calculateMean(values2);

      return {
        field,
        value1: mean1,
        value2: mean2,
        difference: mean2 - mean1
      };
    });
  }

  calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
  }

  calculateStandardDeviation(values: number[], mean?: number): number {
    if (values.length === 0) return 0;
    const avg = mean ?? this.calculateMean(values);
    const squareDiffs = values.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    const avgSquareDiff = this.calculateMean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  private calculateIntersection(extents1: __esri.Extent[], extents2: __esri.Extent[]): number {
    // Simplified intersection calculation
    return Math.min(
      extents1.reduce((sum, ext) => sum + (ext.width * ext.height), 0),
      extents2.reduce((sum, ext) => sum + (ext.width * ext.height), 0)
    );
  }

  private calculateUnion(extents1: __esri.Extent[], extents2: __esri.Extent[]): number {
    // Simplified union calculation
    const area1 = extents1.reduce((sum, ext) => sum + (ext.width * ext.height), 0);
    const area2 = extents2.reduce((sum, ext) => sum + (ext.width * ext.height), 0);
    return area1 + area2 - this.calculateIntersection(extents1, extents2);
  }
} 