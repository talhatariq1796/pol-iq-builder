import { DEFAULT_FILL_ALPHA } from "./constants";
import React from 'react';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import { BaseVisualization, VisualizationResult, BaseVisualizationData, VisualizationOptions } from './base-visualization';
import { createQuartileRenderer } from '../../utils/createQuartileRenderer';
import * as geometryEngineAsync from '@arcgis/core/geometry/geometryEngineAsync';
import * as projection from '@arcgis/core/geometry/projection';
import { isFinite } from 'lodash';
import {
  loadFeaturesProgressively,
  getCachedFeatureProcessing,
  calculateOptimizedExtent,
  performanceMonitoring,
  memoryManagement
} from '../performance-optimizations';
import { StandardizedLegendData } from '@/types/legend';
import { createPopupTemplateFromConfig } from '@/utils/popup-utils';
import { FieldMappingHelper } from './field-mapping-helper';

// Define FieldType to match ArcGIS expected types
type FieldType = "string" | "geometry" | "oid" | "double" | "small-integer" | "integer" | "big-integer" | "single" | "long" | "date" | "date-only" | "time-only" | "timestamp-offset" | "blob" | "raster" | "guid" | "global-id" | "xml";

// Define field properties type
interface FieldProperty {
  name: string;
  type: 'oid' | 'double' | 'string' | 'date' | 'geometry';
  alias?: string;
}

export interface JointHighData extends BaseVisualizationData {
  features: __esri.Graphic[];
  primaryField: string;
  comparisonField: string;
  layerId?: string;
  layerName: string;
  rendererField?: string;
  spatialReference?: __esri.SpatialReference;
  layerConfig?: {
    fields: Array<{
      name: string;
      label?: string;
      alias?: string;
      alternateNames?: string[];
      type: "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";
    }>;
  };
}

// Use the base VisualizationOptions interface for consistency
export interface JointHighVisualizationOptions extends VisualizationOptions {
  targetSR?: __esri.SpatialReference;
}

export class JointHighVisualization extends BaseVisualization<JointHighData> {
  protected renderer: ClassBreaksRenderer;
  protected data: JointHighData | null = null;
  protected options: JointHighVisualizationOptions = {};

  constructor() {
    super();
    this.renderer = new ClassBreaksRenderer({
      field: "joint_score",
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: 0.25,
          symbol: new SimpleFillSymbol({
            color: [255, 255, 178, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: "Low (0-25%)"
        },
        {
          minValue: 0.25,
          maxValue: 0.5,
          symbol: new SimpleFillSymbol({
            color: [254, 204, 92, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: "Low-Medium (25-50%)"
        },
        {
          minValue: 0.5,
          maxValue: 0.75,
          symbol: new SimpleFillSymbol({
            color: [253, 141, 60, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: "Medium-High (50-75%)"
        },
        {
          minValue: 0.75,
          maxValue: 1,
          symbol: new SimpleFillSymbol({
            color: [240, 59, 32, DEFAULT_FILL_ALPHA],
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: "High (75-100%)"
        }
      ]
    });
  }

  /**
   * Process feature data to prepare for visualization
   */
  private async processFeatures(
    features: any[],
    primaryField: string,
    comparisonField: string,
    targetSR?: __esri.SpatialReference
  ): Promise<Graphic[]> {
    const webMercator = targetSR || __esri.SpatialReference.WebMercator;
    
    console.log(`[JointHighViz processFeatures] Processing ${features.length} features`);
    console.log(`Primary field: ${primaryField}, Comparison field: ${comparisonField}`);

    // First pass: extract numeric values and calculate min/max
    let primaryMin = Infinity;
    let primaryMax = -Infinity;
    let comparisonMin = Infinity;
    let comparisonMax = -Infinity;
    let validCount = 0;

    // Track real features with numeric values for both fields
    const validFeatures = [];

    for (const feature of features) {
      const attrs = { ...(feature.attributes || {}), ...(feature.properties || {}) };
      
      // Only process features that have valid numeric values for both fields
      const primaryValue = this.parseNumericValue(attrs[primaryField], primaryField);
      const comparisonValue = this.parseNumericValue(attrs[comparisonField], comparisonField);

      if (primaryValue !== null && comparisonValue !== null) {
        validCount++;
        validFeatures.push({ feature, primaryValue, comparisonValue });
        
        // Update min/max
        primaryMin = Math.min(primaryMin, primaryValue);
        primaryMax = Math.max(primaryMax, primaryValue);
        comparisonMin = Math.min(comparisonMin, comparisonValue);
        comparisonMax = Math.max(comparisonMax, comparisonValue);
      }
    }

    if (validCount === 0) {
      console.warn(`[JointHighViz] No valid features with both ${primaryField} and ${comparisonField}`);
      return [];
    }

    // Calculate ranges for normalization
    const primaryRange = primaryMax - primaryMin;
    const comparisonRange = comparisonMax - comparisonMin;

    console.log(`[JointHighViz processFeatures] Stats: 
      Primary: min=${primaryMin}, max=${primaryMax}, range=${primaryRange}
      Comparison: min=${comparisonMin}, max=${comparisonMax}, range=${comparisonRange}
      Valid features: ${validCount} / ${features.length}`);

    // Second pass: calculate normalized values and joint score
    const validScores = [];

    for (const { feature, primaryValue, comparisonValue } of validFeatures) {
      // Normalize values to 0-1 range
      const normalizedPrimary = primaryRange > 0 
        ? (primaryValue - primaryMin) / primaryRange 
        : 0.5;
      
      const normalizedComparison = comparisonRange > 0
        ? (comparisonValue - comparisonMin) / comparisonRange
        : 0.5;
      
      // Calculate joint score (geometric mean of normalized values)
      const score = Math.sqrt(normalizedPrimary * normalizedComparison);
      
      validScores.push({ 
        feature, 
        score, 
        normalizedPrimary, 
        normalizedComparison,
        primaryValue,
        comparisonValue
      });
    }

    // Sort by joint score descending
    validScores.sort((a, b) => b.score - a.score);
    const top25Percent = Math.ceil(validScores.length * 0.25);
    const topFeatures = validScores.slice(0, top25Percent);

    console.log(`[JointHighViz processFeatures] Filtered to top ${topFeatures.length} features (25%)`);

    // Third pass: create graphics for top features
    const result: Graphic[] = [];
    let idx = 1;

    for (const { feature, score, normalizedPrimary, normalizedComparison } of topFeatures) {
      let geom = feature.geometry as __esri.Geometry;
      if (geom.spatialReference?.wkid !== targetSR?.wkid) {
        try {
          // Cast geometry to any to bypass TypeScript's geometry type validation
          const anyGeom = geom as any;
          const pg = await projection.project(anyGeom, targetSR);
          geom = Array.isArray(pg) ? pg[0] : pg;
        } catch {
          continue;
        }
      }
      
      if (!geom) continue;

      const attrs = { ...(feature.attributes || {}), ...(feature.properties || {}) };
      const outputAttrs: Record<string, any> = {
        OBJECTID: idx++,
        [(this.data as JointHighData).primaryField]: this.parseNumericValue(attrs[(this.data as JointHighData).primaryField], (this.data as JointHighData).primaryField, 0),
        [(this.data as JointHighData).comparisonField]: this.parseNumericValue(attrs[(this.data as JointHighData).comparisonField], (this.data as JointHighData).comparisonField, 0),
        normalized_primary: normalizedPrimary,
        normalized_comparison: normalizedComparison,
        joint_score: score
      };

      // Copy identifier fields if they exist
      ['FEDNAME', 'CSDNAME', 'CFSAUID', 'PRNAME', 'DESCRIPTION'].forEach(fld => {
        if (attrs[fld] !== undefined) outputAttrs[fld] = attrs[fld];
      });

      result.push(new Graphic({
        geometry: geom as any, // Cast to any to bypass TypeScript's strict typing
        attributes: outputAttrs
      }));
    }

    return result;
  }

  /**
   * Parse a value to a number, handling various formats
   */
  private parseNumericValue(value: any, fieldName: string, defaultValue: number | null = null): number | null {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    // If it's already a number, return it directly
    if (typeof value === 'number' && isFinite(value)) {
      return value;
    }
    
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      // Remove any non-numeric characters except decimal point and minus sign
      const cleaned = value.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed;
      }
    }
    
    console.warn(`[JointHighViz] Could not parse value '${value}' for field ${fieldName}`);
    return defaultValue;
  }

  async create(
    data: JointHighData,
    options: VisualizationOptions = {}
  ): Promise<VisualizationResult> {
    performanceMonitoring.startTimer('joint-high-visualization');
    console.log('[JointHighViz Create] Starting joint high visualization', {
      featureCount: data.features?.length,
      primaryField: data.primaryField,
      comparisonField: data.comparisonField,
      layerId: data.layerId
    });

    // Store input data and options
    this.data = data;
    this.options = options as JointHighVisualizationOptions;

    // Validate memory usage
    if (!memoryManagement.isMemoryUsageAcceptable(data.features)) {
      console.warn('[JointHighViz Create] Large dataset detected, applying optimizations');
    }

    // Process features with caching
    const processedGraphics = await getCachedFeatureProcessing(
      data.features,
      'joint-high-processing',
      async (features) => {
        return this.processFeatures(
          features,
          data.primaryField,
          data.comparisonField,
          (options as JointHighVisualizationOptions).targetSR
        );
      }
    );

    // Sort graphics by score
    const sortedGraphics = processedGraphics.sort((a: Graphic, b: Graphic) => {
      const scoreA = a.attributes.joint_score || 0;
      const scoreB = b.attributes.joint_score || 0;
      return scoreB - scoreA;
    });

    // Take top 25% of features
    const top25Percent = Math.ceil(sortedGraphics.length * 0.25);
    const topGraphics = sortedGraphics.slice(0, top25Percent);

    // Create layer with optimized extent calculation
    const layerTitle = options.title || 'Joint High Analysis';
    const objectIdField = 'OBJECTID';
    const geometryType = topGraphics[0]?.geometry?.type || 'polygon';
    const fields: FieldProperty[] = [
      { name: objectIdField, type: 'oid' },
      { name: 'joint_score', type: 'double' },
      { name: data.primaryField, type: 'double' },
      { name: data.comparisonField, type: 'double' }
    ];

    // Create layer
    const layer = new FeatureLayer({
      title: layerTitle,
      source: topGraphics,
      objectIdField,
      geometryType,
      fields,
      spatialReference: (options as JointHighVisualizationOptions).targetSR
    });

    // Apply renderer
    const rendererResult = await createQuartileRenderer({
      layer,
      field: 'joint_score',
      colorStops: [
        [239, 59, 44], // red (low)
        [255, 127, 0], // orange (medium)
        [158, 215, 152], // light green (high)
        [49, 163, 84] // green (very high)
      ],
      opacity: DEFAULT_FILL_ALPHA,
      outlineWidth: 0.5,
      outlineColor: [128, 128, 128]
    });

    if (rendererResult) {
      layer.renderer = rendererResult.renderer;
      this.renderer = rendererResult.renderer;
    }

    // Apply popup template
    if (options.popupConfig) {
      const popupTemplate = createPopupTemplateFromConfig(options.popupConfig);
      if (popupTemplate) {
        layer.popupTemplate = popupTemplate;
      }
    } else {
      // Use standardized popup with joint-high specific fields
      const popupFields = this.getPopupFields('joint-high');
      this.applyStandardizedPopup(
        layer,
        popupFields.barChartFields,
        popupFields.listFields,
        'joint-high'
      );
    }

    // Store the layer in the instance
    this.layer = layer;

    // Calculate extent using optimized method
    this.extent = await calculateOptimizedExtent(topGraphics, (options as JointHighVisualizationOptions).targetSR);

    // Load features progressively if dataset is large
    if (topGraphics.length > 1000) {
      await loadFeaturesProgressively(topGraphics, layer);
    }

    const duration = performanceMonitoring.endTimer('joint-high-visualization');
    performanceMonitoring.logPerformance('joint-high-visualization', duration);

    return {
      layer: this.layer,
      extent: this.extent,
      renderer: this.renderer,
      legendInfo: this.getLegendInfo()
    };
  }

  /**
   * Get standardized legend data
   */
  getLegendInfo(): StandardizedLegendData {
    // Use standardized field mapping for legend title
    const primaryFieldName = this.data?.primaryField ? FieldMappingHelper.getFriendlyFieldName(this.data.primaryField) : 'Primary';
    const comparisonFieldName = this.data?.comparisonField ? FieldMappingHelper.getFriendlyFieldName(this.data.comparisonField) : 'Comparison';
    const title = `Joint High: ${primaryFieldName} & ${comparisonFieldName}`;
    
    // Use base class method for consistent legend generation, but ensure proper structure
    const baseLegend = this.convertRendererToLegendData(
      title,
      'class-breaks',
      'Areas with high values in both metrics'
    );
    
    // Ensure all legend items have the required properties for MapLegend compatibility
    const itemsWithRequiredProps = baseLegend.items?.map(item => ({
      label: item.label,
      color: item.color,
      outlineColor: item.outlineColor || '#666666',
      shape: 'square' as const,
      size: 16
    }));
    
    return {
      ...baseLegend,
      items: itemsWithRequiredProps
    };
  }
}
