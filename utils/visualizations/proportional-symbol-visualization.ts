import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import SizeVariable from '@arcgis/core/renderers/visualVariables/SizeVariable';
import ColorVariable from '@arcgis/core/renderers/visualVariables/ColorVariable';
import { quantile } from 'd3-array';
import { StandardizedLegendData } from '@/types/legend';

export interface ProportionalSymbolData extends BaseVisualizationData {
  sizeField: string;
  colorField?: string;
  minSize?: number;
  maxSize?: number;
  minSymbolSize?: number;
  maxSymbolSize?: number;
  minColor?: number;
  maxColor?: number;
  sizeLabel?: string;
  colorLabel?: string;
  sizeBreaks?: number[];
  colorBreaks?: number[];
  layerName: string;
}

export class ProportionalSymbolVisualization extends BaseVisualization<ProportionalSymbolData> {
  protected renderer: Renderer;
  protected title: string = 'Proportional Symbol Analysis';
  private colorRamp = [
    [237, 248, 251],
    [179, 205, 227],
    [140, 150, 198],
    [136, 86, 167],
    [129, 15, 124]
  ];

  constructor() {
    super();
    this.renderer = new SimpleRenderer();
  }

  private calculateBreaks(values: number[], numBreaks: number = 5): number[] {
    const sortedValues = values.filter(v => v != null).sort((a, b) => a - b);
    return Array.from({length: numBreaks - 1}, (_, i) => {
      const p = (i + 1) / numBreaks;
      return quantile(sortedValues, p) || 0;
    });
  }

  private getColorFromValue(value: number, breaks: number[]): Color {
    const index = breaks.findIndex(b => value <= b);
    const colorValues = index === -1 ? 
      this.colorRamp[this.colorRamp.length - 1] : 
      this.colorRamp[index];
    return new Color(colorValues);
  }

  private validateFeatures(features: __esri.Graphic[]): void {
    console.log('=== Validating Features ===');
    const startTime = performance.now();

    const validation = {
      total: features.length,
      validGeometry: 0,
      validAttributes: 0,
      invalidGeometry: [] as number[],
      invalidAttributes: [] as number[],
      spatialReferences: new Set<number>()
    };

    features.forEach((feature, index) => {
      // Validate geometry
      if (feature.geometry?.type === 'point' || feature.geometry?.type === 'polygon') {
        validation.validGeometry++;
        if (feature.geometry.spatialReference?.wkid) {
          validation.spatialReferences.add(feature.geometry.spatialReference.wkid);
        }
      } else {
        validation.invalidGeometry.push(index);
      }

      // Validate attributes
      if (feature.attributes && Object.keys(feature.attributes).length > 0) {
        validation.validAttributes++;
      } else {
        validation.invalidAttributes.push(index);
      }
    });

    console.log('Feature validation results:', {
      ...validation,
      spatialReferences: Array.from(validation.spatialReferences),
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });

    if (validation.validGeometry === 0) {
      throw new Error('No features have valid geometries');
    }

    if (validation.spatialReferences.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(validation.spatialReferences));
    }
  }

  private validateFields(features: __esri.Graphic[], sizeField: string, colorField?: string): void {
    console.log('=== Validating Fields ===');
    const startTime = performance.now();

    const fieldStats = {
      size: {
        valid: 0,
        invalid: 0,
        min: Infinity,
        max: -Infinity,
        sum: 0,
        nullCount: 0
      },
      color: colorField ? {
        valid: 0,
        invalid: 0,
        min: Infinity,
        max: -Infinity,
        sum: 0,
        nullCount: 0
      } : undefined
    };

    features.forEach((feature, index) => {
      // Validate size field
      const sizeValue = feature.attributes[sizeField];
      if (typeof sizeValue === 'number' && !isNaN(sizeValue)) {
        fieldStats.size.valid++;
        fieldStats.size.min = Math.min(fieldStats.size.min, sizeValue);
        fieldStats.size.max = Math.max(fieldStats.size.max, sizeValue);
        fieldStats.size.sum += sizeValue;
      } else if (sizeValue === null || sizeValue === undefined) {
        fieldStats.size.nullCount++;
      } else {
        fieldStats.size.invalid++;
        console.warn(`Invalid size value at index ${index}:`, sizeValue);
      }

      // Validate color field if present
      if (colorField && fieldStats.color) {
        const colorValue = feature.attributes[colorField];
        if (typeof colorValue === 'number' && !isNaN(colorValue)) {
          fieldStats.color.valid++;
          fieldStats.color.min = Math.min(fieldStats.color.min, colorValue);
          fieldStats.color.max = Math.max(fieldStats.color.max, colorValue);
          fieldStats.color.sum += colorValue;
        } else if (colorValue === null || colorValue === undefined) {
          fieldStats.color.nullCount++;
        } else {
          fieldStats.color.invalid++;
          console.warn(`Invalid color value at index ${index}:`, colorValue);
        }
      }
    });

    console.log('Field validation results:', {
      size: {
        ...fieldStats.size,
        mean: fieldStats.size.valid > 0 ? fieldStats.size.sum / fieldStats.size.valid : 0
      },
      color: fieldStats.color ? {
        ...fieldStats.color,
        mean: fieldStats.color.valid > 0 ? fieldStats.color.sum / fieldStats.color.valid : 0
      } : undefined,
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });

    if (fieldStats.size.valid === 0) {
      throw new Error(`No valid numeric values found for size field "${sizeField}"`);
    }

    if (colorField && fieldStats.color?.valid === 0) {
      throw new Error(`No valid numeric values found for color field "${colorField}"`);
    }
  }

  private validateInputData(data: ProportionalSymbolData): void {
    console.log('=== Validating Input Data ===');
    const startTime = performance.now();

    const validation = {
      hasFeatures: !!data.features?.length,
      featureCount: data.features?.length || 0,
      hasSizeField: !!data.sizeField,
      hasColorField: !!data.colorField,
      hasSizeLabel: !!data.sizeLabel,
      hasColorLabel: !!data.colorLabel,
      hasSizeBreaks: !!data.sizeBreaks?.length,
      hasColorBreaks: !!data.colorBreaks?.length,
      minSize: data.minSize || 8,
      maxSize: data.maxSize || 48,
      validationTimeMs: 0
    };

    console.log('Input data validation:', validation);

    if (!validation.hasFeatures) {
      throw new Error('No features provided for visualization');
    }

    if (!validation.hasSizeField) {
      throw new Error('Size field is required for proportional symbol visualization');
    }

    if (validation.minSize >= validation.maxSize) {
      throw new Error(`Invalid size range: minSize (${validation.minSize}) must be less than maxSize (${validation.maxSize})`);
    }

    validation.validationTimeMs = performance.now() - startTime;
    console.log('Input validation complete:', {
      validationTimeMs: validation.validationTimeMs.toFixed(2)
    });
  }

  private validateBreaks(breaks: number[], fieldName: string): void {
    console.log(`=== Validating ${fieldName} Breaks ===`);
    const startTime = performance.now();

    if (!breaks?.length) {
      throw new Error(`No break points provided for ${fieldName}`);
    }

    // Check for valid numbers
    const invalidBreaks = breaks.filter(b => typeof b !== 'number' || isNaN(b));
    if (invalidBreaks.length > 0) {
      throw new Error(`Invalid break points found for ${fieldName}: ${invalidBreaks.join(', ')}`);
    }

    // Check for ascending order
    const isAscending = breaks.every((b, i) => i === 0 || b >= breaks[i - 1]);
    if (!isAscending) {
      throw new Error(`Break points for ${fieldName} must be in ascending order`);
    }

    // Check for duplicates
    const uniqueBreaks = new Set(breaks);
    if (uniqueBreaks.size !== breaks.length) {
      throw new Error(`Duplicate break points found for ${fieldName}`);
    }

    console.log(`${fieldName} breaks validation complete:`, {
      breakCount: breaks.length,
      min: breaks[0],
      max: breaks[breaks.length - 1],
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });
  }

  private validateSpatialReference(features: __esri.Graphic[]): void {
    console.log('=== Validating Spatial Reference ===');
    const startTime = performance.now();

    const spatialRefs = new Set<number>();
    features.forEach(feature => {
      if (feature.geometry?.spatialReference?.wkid) {
        spatialRefs.add(feature.geometry.spatialReference.wkid);
      }
    });

    if (spatialRefs.size === 0) {
      throw new Error('No spatial reference found in features');
    }

    if (spatialRefs.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(spatialRefs));
    }

    console.log('Spatial reference validation complete:', {
      uniqueRefs: spatialRefs.size,
      refs: Array.from(spatialRefs),
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });
  }

  protected calculateExtent(features: __esri.Graphic[]): __esri.Extent | null {
    if (!features.length) {
      console.warn('No features provided for extent calculation');
      return null;
    }

    console.log('=== Calculating Proportional Symbol Extent ===', {
      totalFeatures: features.length,
      geometryType: features[0].geometry?.type
    });

    let xMin = Infinity;
    let yMin = Infinity;
    let xMax = -Infinity;
    let yMax = -Infinity;
    let validCoordinates = 0;

    features.forEach((feature, index) => {
      if (!feature.geometry) {
        console.warn(`Feature ${index} has no geometry`);
        return;
      }

      const geometry = feature.geometry as any;
      
      // Handle point geometries
      if (geometry.type === 'point' && typeof geometry.x === 'number' && typeof geometry.y === 'number') {
        xMin = Math.min(xMin, geometry.x);
        yMin = Math.min(yMin, geometry.y);
        xMax = Math.max(xMax, geometry.x);
        yMax = Math.max(yMax, geometry.y);
        validCoordinates++;
      }
      // Handle polygon geometries
      else if (geometry.rings) {
        geometry.rings.forEach((ring: number[][]) => {
          ring.forEach(([x, y]) => {
            if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
              xMin = Math.min(xMin, x);
              yMin = Math.min(yMin, y);
              xMax = Math.max(xMax, x);
              yMax = Math.max(yMax, y);
              validCoordinates++;
            }
          });
        });
      }
    });

    if (validCoordinates > 0) {
      // Add padding for better visualization
      const padding = 0.1;
      const width = xMax - xMin;
      const height = yMax - yMin;
      const xPadding = width * padding;
      const yPadding = height * padding;

      const extent = new Extent({
        xmin: xMin - xPadding,
        ymin: yMin - yPadding,
        xmax: xMax + xPadding,
        ymax: yMax + yPadding,
        spatialReference: features[0]?.geometry?.spatialReference || { wkid: 102100 }
      });

      console.log('Extent calculated:', {
        xmin: extent.xmin,
        ymin: extent.ymin,
        xmax: extent.xmax,
        ymax: extent.ymax,
        spatialReference: extent.spatialReference.wkid
      });
      
      // Also set the extent property for compatibility
      this.extent = extent;
      return extent;
    } else {
      console.error('No valid coordinates found for extent calculation');
      return null;
    }
  }

  private calculateQuartileBreaks(values: number[]): number[] {
    if (!values.length) return [];
    
    // Sort values
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate quartile positions
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q2Index = Math.floor(sortedValues.length * 0.5);
    const q3Index = Math.floor(sortedValues.length * 0.75);
    
    // Get quartile values
    return [
      sortedValues[q1Index],  // 25th percentile
      sortedValues[q2Index],  // 50th percentile (median)
      sortedValues[q3Index]   // 75th percentile
    ];
  }

  async create(data: ProportionalSymbolData, options?: VisualizationOptions): Promise<VisualizationResult> {
    try {
      // Validate input data
      this.validateData(data);

      // Get all values for the size field
      const sizeValues = data.features
        .map(f => f.attributes?.[data.sizeField])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));

      if (!sizeValues.length) {
        throw new Error(`No valid numeric values found for size field "${data.sizeField}"`);
      }

      // Calculate quartile breaks
      const sizeBreaks = this.calculateQuartileBreaks(sizeValues);
      console.log('Size breaks calculated:', {
        min: Math.min(...sizeValues),
        breaks: sizeBreaks,
        max: Math.max(...sizeValues)
      });

      // Create renderer with quartile-based size variable
      const sizeVariable = new SizeVariable({
        field: data.sizeField,
        stops: [
          { value: Math.min(...sizeValues), size: data.minSymbolSize || 8 },
          { value: sizeBreaks[0], size: (data.minSymbolSize || 8) + (data.maxSymbolSize || 40) * 0.25 },
          { value: sizeBreaks[1], size: (data.minSymbolSize || 8) + (data.maxSymbolSize || 40) * 0.5 },
          { value: sizeBreaks[2], size: (data.minSymbolSize || 8) + (data.maxSymbolSize || 40) * 0.75 },
          { value: Math.max(...sizeValues), size: data.maxSymbolSize || 40 }
        ]
      });

      const colorVariable = data.colorField ? new ColorVariable({
        field: data.colorField,
        stops: [
          { value: data.minColor || 0, color: new Color(this.colorRamp[0]) },
          { value: data.maxColor || 100, color: new Color(this.colorRamp[4]) }
        ]
      }) : undefined;

      this.renderer = new SimpleRenderer({
        symbol: new SimpleMarkerSymbol({
          color: options?.symbolConfig?.color || [0, 122, 194, 0.8],
          outline: {
            color: options?.symbolConfig?.outline?.color || [0, 0, 0, 0], // No border
            width: 0
          }
        }),
        visualVariables: [
          sizeVariable,
          ...(colorVariable ? [colorVariable] : [])
        ]
      });

      // Initialize layer with original data
      await this.initializeLayer(data, options);

      if (!this.layer || !this.extent) {
        throw new Error('Failed to initialize layer or calculate extent');
      }

      // Update layer with renderer
      this.layer.renderer = this.renderer;

      return {
        layer: this.layer,
        extent: this.extent,
        renderer: this.renderer,
        legendInfo: this.getLegendInfo()
      };
    } catch (error) {
      console.error('Error in ProportionalSymbolVisualization.create:', error);
      throw error;
    }
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: "class-breaks",
      description: `Proportional symbols showing ${this.data?.sizeField || 'values'}`,
      items: [{
        label: 'Symbol',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'circle',
        size: 16
      }]
    };
  }

  protected processMicroserviceResponse(response: any): ProportionalSymbolData {
    const inputRecords = (response?.inputRecords || response?.records || response?.data || []);
    const features = inputRecords.map((record: any, index: number) => ({
      attributes: {
        ...record,
        ID: record.ID,
        OBJECTID: index + 1
      }
    }));
    return {
      features,
      sizeField: 'thematic_value',
      colorField: undefined,
      layerConfig: {
        fields: Object.keys(inputRecords[0] || {}).map(name => ({ name, type: typeof inputRecords[0][name] === 'number' ? 'double' : 'string' }))
      },
      layerName: 'Proportional Symbol Analysis',
    };
  }
} 