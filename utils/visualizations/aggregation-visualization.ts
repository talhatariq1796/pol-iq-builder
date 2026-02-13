import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, VisualizationOptions } from './base-visualization';
import Color from '@arcgis/core/Color';
import ClassBreakInfo from '@arcgis/core/renderers/support/ClassBreakInfo';
import { isFinite } from 'lodash';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import { StandardizedLegendData } from '@/types/legend';

export interface AggregationData {
  features: __esri.Graphic[];
  field: string;
  breaks: number[];
  labels?: string[];
  layerName: string;
}

export class AggregationVisualization extends BaseVisualization<AggregationData> {
  protected renderer: Renderer;
  protected title: string;

  constructor() {
    super();
    this.renderer = new ClassBreaksRenderer({
      field: '',
      defaultSymbol: new SimpleFillSymbol({
        color: [200, 200, 200, 0.5],
        outline: {
          color: [128, 128, 128, 0.5],
          width: 0.5
        }
      }),
      classBreakInfos: []
    });
    this.title = 'Aggregated Data';
  }

  private validateInputData(data: AggregationData): void {
    console.log('=== Validating Aggregation Input Data ===');
    const startTime = performance.now();

    const validation = {
      hasFeatures: !!data.features?.length,
      featureCount: data.features?.length || 0,
      hasField: !!data.field,
      hasBreaks: !!data.breaks?.length,
      breakCount: data.breaks?.length || 0,
      validationTimeMs: 0
    };

    console.log('Input validation:', validation);

    if (!validation.hasFeatures) {
      throw new Error('No features provided for aggregation visualization');
    }

    if (!validation.hasField) {
      throw new Error('Field is required for aggregation visualization');
    }

    if (!validation.hasBreaks) {
      throw new Error('Break points are required for aggregation visualization');
    }

    validation.validationTimeMs = performance.now() - startTime;
    console.log('Input validation complete:', {
      validationTimeMs: validation.validationTimeMs.toFixed(2)
    });
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
      if (feature.geometry?.type === 'polygon') {
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
      throw new Error('No features have valid polygon geometries');
    }

    if (validation.spatialReferences.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(validation.spatialReferences));
    }
  }

  private validateFieldValues(features: __esri.Graphic[], field: string): void {
    console.log('=== Validating Field Values ===');
    const startTime = performance.now();

    const stats = {
      total: features.length,
      valid: 0,
      invalid: 0,
      nullCount: 0,
      min: Infinity,
      max: -Infinity,
      sum: 0
    };

    features.forEach((feature, index) => {
      const value = feature.attributes[field];
      if (typeof value === 'number' && !isNaN(value)) {
        stats.valid++;
        stats.min = Math.min(stats.min, value);
        stats.max = Math.max(stats.max, value);
        stats.sum += value;
      } else if (value === null || value === undefined) {
        stats.nullCount++;
      } else {
        stats.invalid++;
        console.warn(`Invalid field value at index ${index}:`, value);
      }
    });

    console.log('Field value statistics:', {
      ...stats,
      mean: stats.valid > 0 ? stats.sum / stats.valid : 0,
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });

    if (stats.valid === 0) {
      throw new Error(`No valid values found for field: ${field}`);
    }
  }

  private validateBreaks(breaks: number[], fieldStats: { min: number; max: number }): void {
    console.log('=== Validating Break Points ===');
    const startTime = performance.now();

    const validation = {
      total: breaks.length,
      valid: 0,
      invalid: [] as number[],
      ordered: true,
      coversRange: true,
      validationTimeMs: 0
    };

    // Check if breaks are in ascending order
    for (let i = 1; i < breaks.length; i++) {
      if (breaks[i] <= breaks[i - 1]) {
        validation.ordered = false;
        break;
      }
    }

    // Check if breaks cover the data range
    if (breaks[0] > fieldStats.min || breaks[breaks.length - 1] < fieldStats.max) {
      validation.coversRange = false;
    }

    // Validate each break point
    breaks.forEach((breakValue, index) => {
      if (typeof breakValue === 'number' && isFinite(breakValue)) {
        validation.valid++;
      } else {
        validation.invalid.push(index);
      }
    });

    validation.validationTimeMs = performance.now() - startTime;
    console.log('Break point validation:', {
      ...validation,
      validationTimeMs: validation.validationTimeMs.toFixed(2)
    });

    if (!validation.ordered) {
      throw new Error('Break points must be in ascending order');
    }

    if (!validation.coversRange) {
      console.warn('Break points do not fully cover the data range');
    }

    if (validation.valid === 0) {
      throw new Error('No valid break points provided');
    }
  }

  async create(data: AggregationData, options?: VisualizationOptions): Promise<{
    layer: FeatureLayer;
    extent: Extent;
  }> {
    const startTime = performance.now();
    console.log('=== Aggregation Visualization Create ===');

    // Validate input data
    this.validateInputData(data);
    this.validateFeatures(data.features);
    this.validateFieldValues(data.features, data.field);

    // Get field statistics for break validation
    const fieldStats = {
      min: Math.min(...data.features.map(f => f.attributes[data.field]).filter(v => typeof v === 'number' && !isNaN(v))),
      max: Math.max(...data.features.map(f => f.attributes[data.field]).filter(v => typeof v === 'number' && !isNaN(v)))
    };

    // Validate break points
    this.validateBreaks(data.breaks, fieldStats);

    // Create color ramp
    const colors = [
      [237, 248, 251],
      [204, 236, 230],
      [153, 216, 201],
      [102, 194, 164],
      [65, 174, 118],
      [35, 139, 69],
      [0, 109, 44]
    ];

    // Create class breaks
    console.log('=== Creating Class Breaks ===');
    const classBreakStartTime = performance.now();
    const classBreakInfos = data.breaks.map((breakValue, index) => {
      const nextBreak = data.breaks[index + 1];
      return new ClassBreakInfo({
        minValue: breakValue,
        maxValue: nextBreak || Number.MAX_VALUE,
        symbol: new SimpleFillSymbol({
          color: new Color(colors[Math.min(index, colors.length - 1)]),
          outline: {
            color: [128, 128, 128, 0.5],
            width: 0.5
          }
        }),
        label: data.labels?.[index] || `${breakValue.toLocaleString()} - ${(nextBreak || '∞').toLocaleString()}`
      });
    });

    console.log('Class breaks created:', {
      count: classBreakInfos.length,
      processingTimeMs: (performance.now() - classBreakStartTime).toFixed(2)
    });

    // Update renderer
    (this.renderer as ClassBreaksRenderer).field = data.field;
    (this.renderer as ClassBreaksRenderer).classBreakInfos = classBreakInfos;

    // Create feature layer
    console.log('=== Creating Feature Layer ===');
    const layerStartTime = performance.now();

    const layer = new FeatureLayer({
      title: options?.title || this.title,
      source: data.features,
      renderer: this.renderer,
      spatialReference: new SpatialReference({ wkid: 102100 }),
    });

    try {
      await layer.load();
      
      console.log('Layer created successfully:', {
        id: layer.id,
        title: layer.title,
        loaded: layer.loaded,
        geometryType: layer.geometryType,
        features: data.features.length,
        spatialReference: layer.spatialReference?.wkid,
        creationTimeMs: (performance.now() - layerStartTime).toFixed(2)
      });

      // Calculate extent from all features
      console.log('=== Calculating Extent ===');
      const extentStartTime = performance.now();
      
      let xmin = Infinity;
      let ymin = Infinity;
      let xmax = -Infinity;
      let ymax = -Infinity;
      let hasValidExtent = false;

      data.features.forEach(feature => {
        if (feature.geometry?.extent) {
          const extent = feature.geometry.extent;
          if (isFinite(extent.xmin) && isFinite(extent.ymin) && 
              isFinite(extent.xmax) && isFinite(extent.ymax)) {
            xmin = Math.min(xmin, extent.xmin);
            ymin = Math.min(ymin, extent.ymin);
            xmax = Math.max(xmax, extent.xmax);
            ymax = Math.max(ymax, extent.ymax);
            hasValidExtent = true;
          }
        }
      });

      let extent = hasValidExtent ? new Extent({
        xmin,
        ymin,
        xmax,
        ymax,
        spatialReference: { wkid: 102100 }
      }) : layer.fullExtent;

      console.log('Extent calculated:', extent ? {
        xmin: extent.xmin.toFixed(2),
        ymin: extent.ymin.toFixed(2),
        xmax: extent.xmax.toFixed(2),
        ymax: extent.ymax.toFixed(2),
        width: (extent.xmax - extent.xmin).toFixed(2),
        height: (extent.ymax - extent.ymin).toFixed(2),
        spatialReference: extent.spatialReference.wkid,
        calculationTimeMs: (performance.now() - extentStartTime).toFixed(2)
      } : 'No extent available');

      const totalTime = performance.now() - startTime;
      console.log('=== Aggregation Visualization Complete ===');
      console.log('Performance summary:', {
        totalTimeMs: totalTime.toFixed(2),
        validationTimeMs: (classBreakStartTime - startTime).toFixed(2),
        classBreakTimeMs: (performance.now() - classBreakStartTime).toFixed(2),
        layerTimeMs: (extentStartTime - layerStartTime).toFixed(2),
        extentTimeMs: (performance.now() - extentStartTime).toFixed(2)
      });

      // Ensure we never return a null extent
      if (!extent) {
        // Create a default extent if none exists
        extent = new Extent({
          xmin: -20000000,
          ymin: -20000000,
          xmax: 20000000,
          ymax: 20000000,
          spatialReference: { wkid: 102100 }
        });
        console.warn('Using default extent because actual extent was null or undefined');
      }

      return { layer, extent };
    } catch (err) {
      console.error('Error creating layer:', err);
      const error = err as Error;
      throw new Error(`Failed to create aggregation layer: ${error.message}`);
    }
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getLegendInfo(): StandardizedLegendData {
    // Use base class method for consistent legend generation
    return this.convertRendererToLegendData(
      this.title,
      'class-breaks',
      'Aggregated data distribution'
    );
  }
} 