import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import ColorVariable from '@arcgis/core/renderers/visualVariables/ColorVariable';
import { VisualizationOptions, BaseVisualization, BaseVisualizationData, VisualizationResult } from './base-visualization';
import TimeInfo from '@arcgis/core/layers/support/TimeInfo';
import TimeExtent from '@arcgis/core/TimeExtent';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import { isFinite } from 'lodash';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import { StandardizedLegendData } from '@/types/legend';

interface TimeSeriesData extends BaseVisualizationData {
  timeField: string;
  valueField: string;
  interval: 'hour' | 'day' | 'month' | 'year';
  startTime?: Date;
  endTime?: Date;
}

export class TimeSeriesVisualization extends BaseVisualization<TimeSeriesData> {
  protected renderer: SimpleRenderer;
  private readonly intervalMilliseconds = {
    hour: 3600000,
    day: 86400000,
    month: 2592000000,
    year: 31536000000
  };
  protected title: string = 'Time Series Analysis';

  constructor() {
    super();
    this.renderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [0, 0, 0, 0],
        outline: {
          color: [128, 128, 128, 0.5],
          width: "0.5px"
        }
      }),
      visualVariables: [new ColorVariable({
        field: "value",
        stops: [
          { value: 0, color: [255, 255, 255, 0.5] },
          { value: 50, color: [255, 170, 0, DEFAULT_FILL_ALPHA] },
          { value: 100, color: [255, 0, 0, 0.9] }
        ]
      })]
    });
  }

  private validateInputData(data: TimeSeriesData): void {
    if (!data.features?.length) {
      throw new Error('No features provided for time series visualization');
    }

    if (!data.timeField) {
      throw new Error('Time field is required for time series visualization');
    }

    if (!data.valueField) {
      throw new Error('Value field is required for time series visualization');
    }

    if (!data.interval) {
      throw new Error('Valid interval is required for time series visualization');
    }
  }

  private validateFeatures(features: __esri.Graphic[], timeField: string, valueField: string): void {
    const validation = {
      total: features.length,
      validGeometry: 0,
      validTime: 0,
      validValue: 0,
      invalidGeometry: [] as number[],
      invalidTime: [] as number[],
      invalidValue: [] as number[],
      spatialReferences: new Set<number>(),
      geometryTypes: new Set<string>(),
      timeRange: {
        min: new Date(),
        max: new Date(0)
      },
      valueRange: {
        min: Infinity,
        max: -Infinity
      }
    };

    features.forEach((feature, index) => {
      // Validate geometry
      if (feature.geometry) {
        validation.validGeometry++;
        validation.geometryTypes.add(feature.geometry.type);
        if (feature.geometry.spatialReference?.wkid) {
          validation.spatialReferences.add(feature.geometry.spatialReference.wkid);
        }
      } else {
        validation.invalidGeometry.push(index);
      }

      // Validate time field
      const timeValue = feature.attributes[timeField];
      if (timeValue && !isNaN(new Date(timeValue).getTime())) {
        validation.validTime++;
        const time = new Date(timeValue);
        validation.timeRange.min = time < validation.timeRange.min ? time : validation.timeRange.min;
        validation.timeRange.max = time > validation.timeRange.max ? time : validation.timeRange.max;
      } else {
        validation.invalidTime.push(index);
      }

      // Validate value field
      const value = feature.attributes[valueField];
      if (typeof value === 'number' && isFinite(value)) {
        validation.validValue++;
        validation.valueRange.min = Math.min(validation.valueRange.min, value);
        validation.valueRange.max = Math.max(validation.valueRange.max, value);
      } else {
        validation.invalidValue.push(index);
      }
    });

    if (validation.validGeometry === 0) {
      throw new Error('No features have valid geometries');
    }

    if (validation.validTime === 0) {
      throw new Error('No features have valid time values');
    }

    if (validation.validValue === 0) {
      throw new Error('No features have valid value field values');
    }

    if (validation.spatialReferences.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(validation.spatialReferences));
    }
  }

  private calculateTimeExtent(data: TimeSeriesData): __esri.TimeExtent {
    const startTime = data.startTime || new Date();
    const endTime = data.endTime || new Date();
    const interval = this.intervalMilliseconds[data.interval];

    return new TimeExtent({
      start: startTime,
      end: new Date(endTime.getTime() + interval)
    });
  }

  private createPopupTemplate(data: TimeSeriesData): __esri.PopupTemplate {
    const dateFormat = this.getDateFormat(data.interval);

    return new PopupTemplate({
      title: "{DESCRIPTION}",
      content: [{
        type: "fields",
        fieldInfos: [
          {
            fieldName: data.timeField,
            label: "Time",
            format: {
              dateFormat
            }
          },
          {
            fieldName: data.valueField,
            label: "Value",
            format: {
              places: 2,
              digitSeparator: true
            }
          }
        ]
      }]
    });
  }

  private getDateFormat(interval: string): string {
    switch (interval) {
      case 'hour':
        return 'short-date-short-time';
      case 'day':
        return 'short-date';
      case 'month':
        return 'short-month-year';
      case 'year':
        return 'year';
      default:
        return 'short-date-short-time';
    }
  }

  protected async initializeLayer(data: TimeSeriesData, options: VisualizationOptions = {}): Promise<void> {
    // Validate input data
    this.validateInputData(data);
    this.validateFeatures(data.features, data.timeField, data.valueField);

    // Map interval to ArcGIS time unit
    const timeUnit = {
      'hour': 'hours',
      'day': 'days',
      'month': 'months',
      'year': 'years'
    }[data.interval] as 'hours' | 'days' | 'months' | 'years';

    // Create time info
    const timeInfo = new TimeInfo({
      startField: data.timeField,
      endField: data.timeField,
      interval: {
        unit: timeUnit,
        value: 1
      }
    });

    // Map features using base class method
    const mappedFeatures = data.features.map(feature => this.mapFeature(feature));

    // Create feature layer
    this.layer = new FeatureLayer({
      source: mappedFeatures,
      objectIdField: "OBJECTID",
      fields: this.createFields(mappedFeatures[0].attributes),
      renderer: this.renderer,
      timeInfo,
      popupTemplate: this.createPopupTemplate(data),
      opacity: options.opacity ?? 0.7,
      visible: options.visible ?? true,
      title: options.title || "Time Series Analysis",
      listMode: "show"
    });

    // Calculate extent using base class's method
    await this.calculateExtent(mappedFeatures);
  }

  async create(data: TimeSeriesData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    // Validate input data using base class method
    this.validateData(data);

    // Initialize layer using overridden initializeLayer method
    await this.initializeLayer(data, options);

    return {
      layer: this.layer!,
      extent: this.extent!,
      renderer: this.renderer,
      legendInfo: this.getLegendInfo()
    };
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: "class-breaks",
      description: "Time series visualization showing temporal patterns",
      items: [{
        label: 'Time Series',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 16
      }]
    };
  }
} 