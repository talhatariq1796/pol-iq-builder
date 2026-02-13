import { DEFAULT_FILL_ALPHA } from "./constants";
import { Feature } from '@/types/visualization';
import { Renderer, ClassBreaksRenderer, SimpleRenderer } from '@arcgis/core/renderers';

export interface TimeSeriesOptions {
  timeField: string;
  valueField: string;
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  aggregation: 'sum' | 'average' | 'count';
  colorScheme?: 'sequential' | 'diverging' | 'categorical';
}

export interface TimeSeriesData {
  features: Feature[];
  options: TimeSeriesOptions;
}

export class TimeSeriesVisualizations {
  public static createTimeSeriesRenderer(data: TimeSeriesData): Renderer {
    const { features, options } = data;
    const { timeField, valueField, interval, aggregation } = options;

    // Group features by time interval
    const groupedData = this.groupByTimeInterval(features, timeField, interval);
    
    // Aggregate values for each time interval
    const aggregatedData = this.aggregateValues(groupedData, valueField, aggregation);
    
    // Create class breaks based on aggregated values
    return new ClassBreaksRenderer({
      field: valueField,
      classBreakInfos: this.createClassBreaks(aggregatedData, options.colorScheme)
    });
  }

  private static groupByTimeInterval(
    features: Feature[],
    timeField: string,
    interval: TimeSeriesOptions['interval']
  ): Map<string, Feature[]> {
    const grouped = new Map<string, Feature[]>();

    features.forEach(feature => {
      const date = new Date(feature.attributes[timeField] as string);
      let key: string;

      switch (interval) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        }
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = date.getFullYear().toString();
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(feature);
    });

    return grouped;
  }

  private static aggregateValues(
    groupedData: Map<string, Feature[]>,
    valueField: string,
    aggregation: TimeSeriesOptions['aggregation']
  ): { timeKey: string; value: number }[] {
    const result: { timeKey: string; value: number }[] = [];

    groupedData.forEach((features, timeKey) => {
      const values = features.map(f => f.attributes[valueField] as number);
      let aggregatedValue: number;

      switch (aggregation) {
        case 'sum':
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case 'average':
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        default:
          aggregatedValue = 0;
      }

      result.push({ timeKey, value: aggregatedValue });
    });

    return result.sort((a, b) => a.timeKey.localeCompare(b.timeKey));
  }

  private static createClassBreaks(
    aggregatedData: { timeKey: string; value: number }[],
    colorScheme: string = 'sequential'
  ) {
    const values = aggregatedData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const numBreaks = 5;
    const breakSize = range / numBreaks;

    return Array.from({ length: numBreaks }, (_, i) => ({
      minValue: min + (i * breakSize),
      maxValue: min + ((i + 1) * breakSize),
      symbol: {
        type: 'simple-fill' as const,
        color: this.getColorForBreak(i, numBreaks, colorScheme),
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    }));
  }

  private static getColorForBreak(index: number, total: number, scheme: string): number[] {
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
} 