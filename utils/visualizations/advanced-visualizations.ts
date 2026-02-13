import { DEFAULT_FILL_ALPHA } from "./constants";
import { Renderer, SimpleRenderer, ClassBreaksRenderer, UniqueValueRenderer, HeatmapRenderer } from '@arcgis/core/renderers';
import { Feature } from '@/types/visualization';

export interface AdvancedVisualizationOptions {
  features: Feature[];
  field: string;
  targetField?: string;
  classificationMethod?: 'natural-breaks' | 'equal-interval' | 'quantile' | 'standard-deviation';
  numClasses?: number;
  colorScheme?: 'sequential' | 'diverging' | 'categorical';
}

export class AdvancedVisualizations {
  static createHeatmapRenderer(options: AdvancedVisualizationOptions): Renderer {
    return new HeatmapRenderer({
      field: options.field,
      colorStops: [
        { ratio: 0, color: [0, 0, 255, 0] },
        { ratio: 0.5, color: [0, 255, 0, 0.5] },
        { ratio: 1, color: [255, 0, 0, 0.8] }
      ],
      radius: 20,
      maxDensity: 100,
      minDensity: 0
    });
  }

  static createQuantileRenderer(options: AdvancedVisualizationOptions): Renderer {
    const values = options.features.map(f => f.attributes[options.field] as number);
    const sortedValues = [...values].sort((a, b) => a - b);
    const numClasses = options.numClasses || 5;
    const breakPoints = this.calculateQuantileBreaks(sortedValues, numClasses);

    return new ClassBreaksRenderer({
      field: options.field,
      classBreakInfos: breakPoints.map((breakPoint, index) => ({
        minValue: breakPoint.min,
        maxValue: breakPoint.max,
        symbol: {
          type: 'simple-fill',
          color: this.getColorForClass(index, numClasses, options.colorScheme || 'sequential'),
          outline: { color: [0, 0, 0, 0], width: 0 }
        }
      }))
    });
  }

  static createStandardDeviationRenderer(options: AdvancedVisualizationOptions): Renderer {
    const values = options.features.map(f => f.attributes[options.field] as number);
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);
    const breakPoints = [
      { min: -Infinity, max: mean - 2 * stdDev },
      { min: mean - 2 * stdDev, max: mean - stdDev },
      { min: mean - stdDev, max: mean },
      { min: mean, max: mean + stdDev },
      { min: mean + stdDev, max: mean + 2 * stdDev },
      { min: mean + 2 * stdDev, max: Infinity }
    ];

    return new ClassBreaksRenderer({
      field: options.field,
      classBreakInfos: breakPoints.map((breakPoint, index) => ({
        minValue: breakPoint.min,
        maxValue: breakPoint.max,
        symbol: {
          type: 'simple-fill',
          color: this.getColorForClass(index, breakPoints.length, 'diverging'),
          outline: { color: [0, 0, 0, 0], width: 0 }
        }
      }))
    });
  }

  static createBivariateRenderer(options: AdvancedVisualizationOptions): Renderer {
    if (!options.targetField || !options.field) {
      throw new Error('Both field and target field are required for bivariate visualization');
    }

    const xValues = options.features.map(f => f.attributes[options.field] as number);
    const yValues = options.features.map(f => f.attributes[options.targetField!] as number);
    const xMean = this.calculateMean(xValues);
    const yMean = this.calculateMean(yValues);
    const xStdDev = this.calculateStandardDeviation(xValues);
    const yStdDev = this.calculateStandardDeviation(yValues);

    return new UniqueValueRenderer({
      field: 'bivariate_category',
      uniqueValueInfos: [
        {
          value: 'high-high',
          symbol: {
            type: 'simple-fill',
            color: [255, 0, 0, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }
        },
        {
          value: 'high-low',
          symbol: {
            type: 'simple-fill',
            color: [255, 165, 0, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }
        },
        {
          value: 'low-high',
          symbol: {
            type: 'simple-fill',
            color: [0, 165, 255, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }
        },
        {
          value: 'low-low',
          symbol: {
            type: 'simple-fill',
            color: [0, 0, 255, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }
        }
      ]
    });
  }

  private static calculateQuantileBreaks(values: number[], numClasses: number) {
    const sortedValues = [...values].sort((a, b) => a - b);
    const breakPoints = [];
    const step = sortedValues.length / numClasses;

    for (let i = 0; i < numClasses; i++) {
      const startIndex = Math.floor(i * step);
      const endIndex = Math.floor((i + 1) * step);
      breakPoints.push({
        min: sortedValues[startIndex],
        max: sortedValues[endIndex - 1]
      });
    }

    return breakPoints;
  }

  private static calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private static calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squareDiffs = values.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  private static getColorForClass(index: number, total: number, scheme: 'sequential' | 'diverging' | 'categorical'): number[] {
    switch (scheme) {
      case 'sequential':
        return this.getSequentialColor(index, total);
      case 'diverging':
        return this.getDivergingColor(index, total);
      case 'categorical':
        return this.getCategoricalColor(index, total);
      default:
        return this.getSequentialColor(index, total);
    }
  }

  private static getSequentialColor(index: number, total: number): number[] {
    const hue = (index / total) * 120; // Green to Red
    return this.hslToRgb(hue, 70, 50);
  }

  private static getDivergingColor(index: number, total: number): number[] {
    const center = total / 2;
    const distance = Math.abs(index - center);
    const hue = index < center ? 240 - (distance / center) * 120 : 120 + (distance / center) * 120;
    return this.hslToRgb(hue, 70, 50);
  }

  private static getCategoricalColor(index: number, total: number): number[] {
    const hue = (index / total) * 360;
    return this.hslToRgb(hue, 70, 50);
  }

  private static hslToRgb(h: number, s: number, l: number): number[] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)), DEFAULT_FILL_ALPHA];
  }
} 