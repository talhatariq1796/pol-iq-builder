import { DEFAULT_FILL_ALPHA } from "./constants";
import React from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import ColorVariable from '@arcgis/core/renderers/visualVariables/ColorVariable';
import { VisualizationOptions, BaseVisualization, BaseVisualizationData, VisualizationResult } from './base-visualization';
import FieldsContent from "@arcgis/core/popup/content/FieldsContent";
import PopupTemplate from "@arcgis/core/PopupTemplate";
//import type { CorrelationResult } from '@/types/correlation';
import type { LayerConfig } from '@/types/layers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Collection from '@arcgis/core/core/Collection';
import Graphic from '@arcgis/core/Graphic';
import { Geometry, Extent, SpatialReference, Point, Polygon, Multipoint, Polyline } from '@arcgis/core/geometry';
import { createQuartileRenderer } from '../createQuartileRenderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import * as projection from '@arcgis/core/geometry/projection';
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import * as geometryEngineAsync from '@arcgis/core/geometry/geometryEngineAsync';
import { isFinite } from 'lodash';
import { LayerField } from '../../types/geospatial-ai-types';
import Color from '@arcgis/core/Color';
import RBush from 'rbush';
// --- Linter Fix: Import createGeometry --- 
import { createGeometry } from '../geometry'; 
// --- End Linter Fix ---
// Comment out missing module for now
// import { calculateCorrelationScore } from './correlation-calculation'; 
import { createDefaultPopupConfig, createPopupTemplateFromConfig } from '@/utils/popup-utils';
import { PopupConfiguration } from '@/types/popup-config';
import { StandardizedLegendData, colorToRgba, getSymbolShape, getSymbolSize } from '@/types/legend';
import { LegendItem } from '@/components/MapLegend';
import { optimizeAnalysisFeatures } from '../feature-optimization';
import { 
  MicroserviceResponse, 
  isValidMicroserviceResponse, 
  isMicroserviceError,
  convertToVisualizationData 
} from '../../types/microservice-types';
import type { __esri } from '@arcgis/core';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import { layers } from '../../config/layers';
import { Renderer } from "@arcgis/core/renderers";
import MultiLayerAnalysis from '@arcgis/core/analysis/MultiLayerAnalysis';
import { Feature } from 'geojson';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import { FIELD_ALIASES } from '../field-aliases';
import { FieldMappingHelper } from './field-mapping-helper';
import OpacityVariable from '@arcgis/core/renderers/visualVariables/OpacityVariable';

// Mock implementation, as the original file is not accessible.
function getLayerConfigById(layerId: string): LayerConfig | undefined {
  if (!Array.isArray(layers)) return undefined;
  return layers.find((l: LayerConfig) => l.id === layerId);
}

// Mock implementation
function getLayerDisplayName(layerId: string): string {
    const config = getLayerConfigById(layerId);
    return config?.name ?? layerId;
}

// Define FieldType to match ArcGIS expected types
type FieldType = "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";

export interface CorrelationData extends BaseVisualizationData {
  features: Array<{
    attributes: {
      OBJECTID: number;
      primary_value: number;
      comparison_value: number;
      correlation_strength: number;
      [key: string]: any;
    };
    geometry?: GeometryType;
  }>;
  layerName: string;
  rendererField: string;
  primaryField: string;
  comparisonField: string;
  primaryLayerId: string;
  comparisonLayerId: string;
  layerConfig: {
    name: string;
    fields: Array<{
      name: string;
      type: FieldType;
    }>;
  };
}

// Define a union type for all possible geometry types
type GeometryType = Extent | Point | Polygon | Multipoint | Polyline;

interface FeatureWithProperties extends Graphic {
  properties?: { [key: string]: any };
  geometry: GeometryType;
  attributes: { [key: string]: any };  // Make attributes required to match Graphic interface
}

interface CorrelationVisualizationOptions extends VisualizationOptions {
  comparisonParty?: string;
  rendererField?: string;
}

// Update CorrelationOptions to match CorrelationVisualizationOptions
export interface CorrelationOptions {
  colorScheme?: string;  // Changed from string[] to string
  classificationMethod?: string;
  classificationBreaks?: number[];
  popupConfig?: PopupConfiguration;
}

interface NormalizedFeature {
  type: 'Feature';
  geometry: any;
  properties: {
    [key: string]: any;
    [key: `${string}_normalized`]: number;
  };
}

interface NormalizedData {
  features: NormalizedFeature[];
}

export class CorrelationVisualization extends BaseVisualization<CorrelationData> {
  protected renderer: ClassBreaksRenderer;
  protected options: CorrelationVisualizationOptions;
  protected data: CorrelationData | null;

  constructor() {
    super();
    this.data = null;
    this.options = {};
    this.renderer = new ClassBreaksRenderer({
      field: "correlation_score",
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

  private findVisualizationField(feature: FeatureWithProperties, fieldName: string): string {
    console.log('[CorrViz FindField] Finding visualization field:', {
      fieldName,
      availableFields: Object.keys(feature.attributes || {}),
      hasProperties: !!feature.properties,
      propertyFields: feature.properties ? Object.keys(feature.properties) : []
    });

    // Combine attributes and properties for searching
    const combinedAttrs = { ...(feature.attributes || {}), ...(feature.properties || {}) };

    // Only use the specified field
    if (combinedAttrs[fieldName] != null) {
      console.log(`[CorrViz FindField] Found specified field '${fieldName}'`);
      return fieldName;
    }

    // Provide detailed error message about why the field wasn't found
    const availableFields = Object.keys(combinedAttrs);
    let errorMessage = `Field '${fieldName}' not found for correlation analysis.\n`;
    errorMessage += `This field is required for the correlation analysis but is missing from the data.\n`;
    errorMessage += `Available fields: ${availableFields.join(', ')}\n`;
    
    // Add suggestions if there are similar field names
    const similarFields = availableFields.filter(field => 
      field.toLowerCase().includes(fieldName.toLowerCase()) || 
      fieldName.toLowerCase().includes(field.toLowerCase())
    );
    if (similarFields.length > 0) {
      errorMessage += `\nSimilar fields found: ${similarFields.join(', ')}`;
      errorMessage += `\nPlease verify the correct field name in your layer configuration.`;
    }

    throw new Error(errorMessage);
  }

  // Override the base validateData method
  protected validateData(data: CorrelationData): void {
    console.log('[CorrViz ValidateData] Validating correlation input data:', {
      featureCount: data.features?.length,
      primaryField: data.rendererField,
      comparisonField: data.rendererField,
      layerId: data.layerName
    });

    // Call the parent validateData first
    super.validateData(data);

    // Ensure features is an array
    if (!Array.isArray(data.features)) {
        throw new Error('Invalid data format: features must be an array');
    }

    // Check if there are features to validate fields against
    if (data.features.length === 0) {
        console.warn('[CorrViz ValidateData] No features provided for validation.');
        return; 
    }

    const sampleFeature = data.features[0];
    console.log('[CorrViz ValidateData] Sample feature attributes:', {
      availableFields: Object.keys(sampleFeature.attributes || {}),
      primaryField: data.rendererField,
      comparisonField: data.rendererField
    });

    // Validate that fields exist in features
    const primaryExists = data.features.some(f => {
      const attrs = f.attributes || {};
      const exists = attrs[data.rendererField] != null;
      if (!exists) {
        console.warn(`[CorrViz ValidateData] Primary field "${data.rendererField}" not found in feature. Available fields:`, Object.keys(attrs));
      }
      return exists;
    });

    const comparisonExists = data.features.some(f => {
      const attrs = f.attributes || {};
      const exists = attrs[data.rendererField] != null;
      if (!exists) {
        console.warn(`[CorrViz ValidateData] Comparison field "${data.rendererField}" not found in feature. Available fields:`, Object.keys(attrs));
      }
      return exists;
    });

    if (!primaryExists) {
      throw new Error(`Primary field "${data.rendererField}" not found in features`);
    }

    if (!comparisonExists) {
      throw new Error(`Comparison field "${data.rendererField}" not found in features`);
    }

    console.log('[CorrViz ValidateData] Field validation successful:', {
      primaryField: data.rendererField,
      comparisonField: data.rendererField
    });
  }

  private convertGeometry(geometry: any): any {
    if (!geometry) return null;

    // If it's already an ArcGIS geometry, return it
    if (geometry.type && geometry.spatialReference) {
      return geometry;
    }

    // Convert GeoJSON geometry to ArcGIS geometry
    switch (geometry.type) {
      case 'Point':
        return {
          type: 'point',
          x: geometry.coordinates[0],
          y: geometry.coordinates[1],
          spatialReference: { wkid: 4326 }
        };
      case 'Polygon':
        return {
          type: 'polygon',
          rings: geometry.coordinates,
          spatialReference: { wkid: 4326 }
        };
      case 'MultiPolygon':
        return {
          type: 'polygon',
          rings: geometry.coordinates.flat(),
          spatialReference: { wkid: 4326 }
        };
      default:
        console.warn('[CorrViz] Unsupported geometry type:', geometry.type);
        return null;
    }
  }

  private normalizeValue(value: number, min: number, max: number): number {
    if (min === max) return 0.5; // If all values are the same, return middle value
    return (value - min) / (max - min);
  }

  private normalizeFeatures(features: any[], fields: string[]): NormalizedData {
    // First pass: collect min/max values for each field
    const minMaxValues = fields.reduce((acc, field) => {
      acc[field] = { min: Infinity, max: -Infinity };
      return acc;
    }, {} as Record<string, { min: number; max: number }>);

    // Collect valid values for each field
    features.forEach(feature => {
      const values = feature.properties || feature.attributes || {};
      fields.forEach(field => {
        const value = this.parseNumericValue(values[field]);
        if (value !== null) {
          minMaxValues[field].min = Math.min(minMaxValues[field].min, value);
          minMaxValues[field].max = Math.max(minMaxValues[field].max, value);
        }
      });
    });

    // Second pass: normalize values
    const normalizedFeatures: NormalizedFeature[] = features.map(feature => {
      const values = feature.properties || feature.attributes || {};
      const normalizedProps: Record<string, any> = { ...values };

      fields.forEach(field => {
        const value = this.parseNumericValue(values[field]);
        if (value !== null) {
          normalizedProps[`${field}_normalized`] = this.normalizeValue(
            value,
            minMaxValues[field].min,
            minMaxValues[field].max
          );
        } else {
          normalizedProps[`${field}_normalized`] = null;
        }
      });

      return {
        type: 'Feature' as const,
        geometry: feature.geometry,
        properties: normalizedProps
      };
    });

    return { features: normalizedFeatures };
  }

  private parseNumericValue(value: any): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const cleanValue = value.replace(/,|%/g, '');
      const parsed = parseFloat(cleanValue);
      if (!isNaN(parsed)) {
        return value.includes('%') ? parsed / 100 : parsed;
      }
    }
    return null;
        }

  /**
   * Process raw features to ArcGIS Graphics with proper attributes and geometry
   * Following SingleLayerVisualization pattern
   */
  protected async processFeatures(features: any[]): Promise<Graphic[]> {
    if (!this.data) {
      console.warn('[CorrViz] No data available for processing features.');
      return [];
    }
    
    // Use the standardized field names supplied by VisualizationFactory
    const primaryField = 'primary_value';
    const comparisonField = 'comparison_value';

    // Filter out features that do not contain both numeric values
    const validFeatures = features.filter(feature => {
      const attrs = feature.attributes;
      if (!attrs) return false;
      const pVal = this.parseNumericValue(attrs[primaryField]);
      const cVal = this.parseNumericValue(attrs[comparisonField]);
      return pVal !== null && cVal !== null;
    });

    if (validFeatures.length < 2) {
      console.warn('[CorrViz] Not enough valid features to compute correlation (need at least 2).');
      return [];
    }

    // First convert all valid input features to ArcGIS Graphics (without correlation score)
    const graphics: Graphic[] = validFeatures.map((feature, idx) => {
      let geometry = feature.geometry;

      // Skip if no geometry
      if (!geometry) return null as unknown as Graphic;

      // Reproject to WebMercator if required
      if (geometry.spatialReference?.wkid !== SpatialReference.WebMercator.wkid) {
        try {
          const projected = projection.project(geometry as any, SpatialReference.WebMercator);
          geometry = Array.isArray(projected) ? projected[0] : projected;
        } catch (err) {
          console.warn('[CorrViz] Failed to project geometry', err);
        }
      }

      return new Graphic({
        geometry,
        attributes: {
          ...feature.attributes,
          OBJECTID: feature.attributes?.OBJECTID ?? idx + 1,
          // Ensure the standardized numeric fields exist
          primary_value: feature.attributes[primaryField],
          comparison_value: feature.attributes[comparisonField]
        }
      });
    }).filter(Boolean) as Graphic[];

    // Compute correlation scores across ALL graphics
    const scores = this.calculateCorrelationScores(graphics, primaryField, comparisonField);

    // Attach correlation_score attribute to each graphic (fallback to 0 if null/undefined)
    graphics.forEach((g, i) => {
      const score = scores[i];
      g.attributes.correlation_score = (score === null || score === undefined || isNaN(score)) ? 0 : score;
    });

    console.log(`[CorrViz] Processed ${graphics.length} graphics with correlation scores.`);

    return graphics;
  }

  private calculateCorrelationScores(
    features: Graphic[], // Expects processed Graphics
    field1: string,
    field2: string
  ): (number | null)[] {
    console.log(`[CorrViz] Calculating correlation scores with fields: ${field1}, ${field2}`);
    if (!features || features.length < 2) {
      return [];
    }

    const values1 = features.map(f => this.parseNumericValue(f.attributes?.[field1])).filter(v => v !== null) as number[];
    const values2 = features.map(f => this.parseNumericValue(f.attributes?.[field2])).filter(v => v !== null) as number[];

    if (values1.length !== values2.length || values1.length < 2) {
      console.warn('[CorrViz] Not enough data to calculate correlation scores reliably.');
      return features.map(() => 0.5); // Return a neutral score
    }

    const min1 = Math.min(...values1);
    const max1 = Math.max(...values1);
    const min2 = Math.min(...values2);
    const max2 = Math.max(...values2);

    const pearson = this.calculatePearsonCorrelation(values1, values2);
    console.log(`[CorrViz] Pearson correlation coefficient: ${pearson}`);

    return features.map(feature => {
      const val1 = this.parseNumericValue(feature.attributes?.[field1]);
      const val2 = this.parseNumericValue(feature.attributes?.[field2]);

      if (val1 === null || val2 === null) return null;

      // Normalize values to a 0-1 range
      const norm1 = max1 > min1 ? (val1 - min1) / (max1 - min1) : 0.5;
      const norm2 = max2 > min2 ? (val2 - min2) / (max2 - min2) : 0.5;
    
      // Signed score: positive when both normalized values move together, negative when they diverge.
      // Use simple signed difference to retain direction (range -1 to 1).
      const signedScore = norm1 - norm2; // positive -> primary higher than comparison, negative -> lower
      return signedScore;
    });
  }

  private calculatePearsonCorrelation(
    x: number[],
    y: number[]
  ): number {
    if (x.length !== y.length || x.length === 0) {
      return 0; // Return 0 if arrays are mismatched or empty
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Process microservice response into correlation visualization data
   * @param response The response from the microservice
   * @returns Processed data ready for correlation visualization
   * @throws Error if response is invalid or malformed
   */
  protected processMicroserviceResponse(response: any): CorrelationData {
    // Check if response is a microservice error
    if (isMicroserviceError(response)) {
      throw new Error(`Microservice error: ${response.error} (${response.error_type})`);
    }

    // 🆕 NEW: Handle bivariate correlation responses (Nike vs Adidas type queries)
    if (response.analysis_type === 'bivariate_correlation' && response.results) {
      console.log('[CorrViz] Processing bivariate correlation response:', {
        resultsCount: response.results.length,
        analysisType: response.analysis_type,
        correlationAnalysis: response.correlation_analysis
      });
      
      // Convert bivariate correlation results to visualization features
      const features = response.results.map((result: any, index: number) => ({
        attributes: {
          ID: result.ID || result.geo_id || result.ZIP_CODE,
          OBJECTID: index + 1,
          primary_value: result.primary_value,
          comparison_value: result.comparison_value,
          correlation_strength: result.correlation_strength,
          // Include all original field names for frontend compatibility
          ...result
        }
      }));

      return {
        features,
        layerName: `Bivariate Correlation Analysis`,
        rendererField: 'correlation_strength',
        primaryField: 'primary_value',
        comparisonField: 'comparison_value',
        primaryLayerId: '',
        comparisonLayerId: '',
        layerConfig: {
          name: `Bivariate Correlation Analysis`,
          fields: [
            { name: 'OBJECTID', type: 'oid' as FieldType },
            { name: 'ID', type: 'string' as FieldType },
            { name: 'primary_value', type: 'double' as FieldType },
            { name: 'comparison_value', type: 'double' as FieldType },
            { name: 'correlation_strength', type: 'double' as FieldType },
          ]
        }
      };
    }

    // Handle standard SHAP microservice responses
    if (!isValidMicroserviceResponse(response)) {
      throw new Error('Invalid microservice response format');
    }

    // Convert response to visualization data
    const data = convertToVisualizationData(response);

    // Assume response.inputRecords is an array of objects with all fields, including ID, in the same order as predictions
    const inputRecords = (response as any).inputRecords || (response as any).records || (response as any).data || [];

    // Create features array from predictions and SHAP values
    const features = data.predictions.map((prediction, index) => {
      const record = inputRecords[index] || {};
      const shapValues = data.shapValues[index] || [];
      const totalImpact = shapValues.reduce((sum, val) => sum + Math.abs(val), 0);
      return {
        attributes: {
          ID: record.ID, // <-- Add ID from the microservice data
          OBJECTID: index + 1,
          primary_value: prediction,
          comparison_value: totalImpact,
          correlation_strength: Math.abs(prediction - totalImpact),
          // Add SHAP values as additional attributes
          ...Object.fromEntries(
            data.featureNames.map((name, i) => [
              `shap_${name}`,
              shapValues[i] || 0
            ])
          ),
          ...record // Optionally include all other fields from the record
        }
      };
    });

    return {
      features,
      layerName: `Correlation Analysis (${data.modelType})`,
      rendererField: 'correlation_strength',
      primaryField: 'primary_value',  // Use default field names for microservice response
      comparisonField: 'comparison_value',  // Use default field names for microservice response
      primaryLayerId: '',  // Microservice responses don't have layer IDs
      comparisonLayerId: '',  // Microservice responses don't have layer IDs
      layerConfig: {
        name: `Correlation Analysis (${data.modelType})`,
        fields: [
          { name: 'OBJECTID', type: 'oid' as FieldType },
          { name: 'primary_value', type: 'double' as FieldType },
          { name: 'comparison_value', type: 'double' as FieldType },
          { name: 'correlation_strength', type: 'double' as FieldType },
          ...data.featureNames.map(name => ({
            name: `shap_${name}`,
            type: 'double' as FieldType
          })),
          { name: 'ID', type: 'string' as FieldType },
        ]
      }
    };
  }

  /**
   * Creates visualization directly from microservice response containing local correlation metrics.
   */
  async createFromMicroservice(response: any, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    // response expected shape: { features: [{ attributes: { OBJECTID, local_I, p_value, cluster } , geometry: {...}}] }

    const features = response.features as Graphic[] | undefined;
    if (!features || features.length === 0) {
      console.warn('[CorrelationVisualization] Empty feature list in microservice response – skipping visualization');
      return { layer: null, extent: null } as VisualizationResult;
    }

    // Attach features to layer
    const firstGeom = features[0]?.geometry as any;
    const layer = new FeatureLayer({
      title: options.title || 'Local Correlation',
      fields: [
        { name: 'OBJECTID', type: 'oid' },
        { name: 'local_I', type: 'double' },
        { name: 'p_value', type: 'double' },
        { name: 'cluster', type: 'small-integer' }
      ],
      objectIdField: 'OBJECTID',
      source: features,
      geometryType: (firstGeom?.type as any) ?? undefined,
      spatialReference: firstGeom?.spatialReference ?? undefined
    });

    // Create renderer based on local_I values with diverging color ramp
    const maxAbsI = Math.max(
      ...features.map((f: any) => Math.abs(f.attributes.local_I ?? 0))
    );

    const renderer = new ClassBreaksRenderer({
      field: 'local_I',
      legendOptions: { title: 'Local Correlation (I)' },
      classBreakInfos: [
        {
          minValue: -maxAbsI,
          maxValue: -maxAbsI * 0.6,
          symbol: new SimpleFillSymbol({ color: '#2166ac', outline: { color: [0, 0, 0, 0], width: 0 } }),
          label: '- High'
        },
        {
          minValue: -maxAbsI * 0.6,
          maxValue: -maxAbsI * 0.2,
          symbol: new SimpleFillSymbol({ color: '#4393c3', outline: { color: [0, 0, 0, 0], width: 0 } }),
          label: '- Moderate'
        },
        {
          minValue: -maxAbsI * 0.2,
          maxValue: maxAbsI * 0.2,
          symbol: new SimpleFillSymbol({ color: '#f7f7f7', outline: { color: [0, 0, 0, 0], width: 0 } }),
          label: 'No / Weak'
        },
        {
          minValue: maxAbsI * 0.2,
          maxValue: maxAbsI * 0.6,
          symbol: new SimpleFillSymbol({ color: '#f4a582', outline: { color: [0, 0, 0, 0], width: 0 } }),
          label: '+ Moderate'
        },
        {
          minValue: maxAbsI * 0.6,
          maxValue: maxAbsI,
          symbol: new SimpleFillSymbol({ color: '#b2182b', outline: { color: [0, 0, 0, 0], width: 0 } }),
          label: '+ High'
        }
      ],
      visualVariables: [
        new OpacityVariable({
          field: 'p_value',
          stops: [
            { value: 0.05, opacity: 1 },
            { value: 0.051, opacity: 0.15 }
          ]
        })
      ]
    });

    layer.renderer = renderer;

    // Popup template
    layer.popupTemplate = new PopupTemplate({
      title: '{NAME}',
      content: [
        {
          type: 'fields',
          fieldInfos: [
            { fieldName: 'local_I', label: 'Local Moran I' },
            { fieldName: 'p_value', label: 'p-value' },
            { fieldName: 'cluster', label: 'Cluster Type' }
          ]
        }
      ]
    });

    return {
      layer,
      extent: null,
      renderer
    } as VisualizationResult;
  }

  /**
   * Create method for generating correlation visualization
   * Following the same pattern as SingleLayerVisualization for consistency
   */
  async create(data: CorrelationData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    this.data = data; 
    const features = data.features;

    if (!features || !features.length) {
      console.error('[CorrelationVisualization] No features provided');
      return { layer: null, extent: null };
    }

    // Process features
    const graphics = await this.processFeatures(features);
    if (!graphics.length) {
      console.error('[CorrelationVisualization] No valid graphics after processing');
      return { layer: null, extent: null };
    }

    // Get all correlation scores and sort them
    const scores = graphics
      .map(g => g.attributes.correlation_score)
      .filter((score): score is number => typeof score === 'number' && !isNaN(score))
      .sort((a, b) => a - b);

    // Recompute quartile breaks using unique score values to prevent duplicate class ranges
    const uniq = Array.from(new Set(scores));
    uniq.sort((a,b)=>a-b);

    const pickPercentile = (p:number) => {
      if (uniq.length===0) return 0;
      const idx = (uniq.length - 1) * p;
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      if (lower === upper) return uniq[lower];
      return uniq[lower] + (uniq[upper] - uniq[lower]) * (idx - lower);
    };

    const q1 = pickPercentile(0.25);
    let q2 = pickPercentile(0.5);
    let q3 = pickPercentile(0.75);

    // Ensure strictly increasing break values to avoid 0-width classes
    if (q2 <= q1) q2 = uniq.find(v=>v>q1) ?? q1;
    if (q3 <= q2) q3 = uniq.find(v=>v>q2) ?? q2;

    const minScore = uniq[0] ?? 0;
    const maxScore = uniq[uniq.length-1] ?? 1;
      
    console.log('[CorrelationVisualization] Quartile breaks:', { q1, q2, q3, minScore, maxScore });

    // Ensure each graphic has a unique OBJECTID
    const graphicsWithIds = graphics.map((graphic, index) => {
        return new Graphic({
          geometry: graphic.geometry,
          attributes: {
            ...graphic.attributes,
          OBJECTID: index + 1
          }
        });
      });

    // Create layer with proper configuration
      const layer = new FeatureLayer({
      source: graphicsWithIds,
      title: options.title || 'Correlation',
      objectIdField: 'OBJECTID',
      fields: [
        { name: 'OBJECTID', type: 'oid' },
        { name: 'correlation_score', type: 'double' },
        { name: data.primaryField, type: 'double' },
        { name: data.comparisonField, type: 'double' }
      ],
      geometryType: 'polygon',
      popupEnabled: true
    });

    // Create and apply the renderer with joint-high color scheme and true quartile breaks
    const renderer = new ClassBreaksRenderer({
      field: "correlation_score",
        classBreakInfos: [
          {
          minValue: minScore,
          maxValue: q1,
          symbol: new SimpleFillSymbol({
            color: [215, 25, 28, DEFAULT_FILL_ALPHA], // red (lowest quartile)
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: `Low (${minScore.toFixed(2)} - ${q1.toFixed(2)})`
          },
          {
          minValue: q1,
          maxValue: q2,
          symbol: new SimpleFillSymbol({
            color: [244, 109, 67, DEFAULT_FILL_ALPHA], // orange-red (second quartile)
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: `Low-Medium (${q1.toFixed(2)} - ${q2.toFixed(2)})`
          },
          {
          minValue: q2,
          maxValue: q3,
          symbol: new SimpleFillSymbol({
            color: [253, 174, 97, DEFAULT_FILL_ALPHA], // yellow-orange (third quartile)
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: `Medium-High (${q2.toFixed(2)} - ${q3.toFixed(2)})`
          },
          {
          minValue: q3,
          maxValue: maxScore,
          symbol: new SimpleFillSymbol({
            color: [35, 139, 69, DEFAULT_FILL_ALPHA], // green (highest quartile)
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: `High (${q3.toFixed(2)} - ${maxScore.toFixed(2)})`
          }
        ],
      defaultSymbol: new SimpleFillSymbol({
        color: [220, 220, 220, DEFAULT_FILL_ALPHA],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }),
        defaultLabel: "No Data"
      });

    // Apply the renderer to the layer
    layer.renderer = renderer;
    this.renderer = renderer;
      
        // Store the layer
    this.layer = layer;
    
    // Apply popup template
    this.applyCorrelationPopupTemplate(layer);
      
    // Calculate extent from graphics
    const geometries = graphicsWithIds.map(g => g.geometry).filter(g => g != null);
    if (geometries.length > 0) {
      try {
        const extent = await geometryEngineAsync.union(geometries as any[]);
        this.extent = extent?.extent || null;
      } catch (error) {
        console.warn('[CorrelationVisualization] Error calculating extent:', error);
        this.extent = null;
      }
          } else {
            this.extent = null;
          }

    // Get legend info
    const legendInfo = this.getLegendInfo();
      
      return { 
        layer: this.layer, 
        extent: this.extent,
        renderer: this.renderer,
      legendInfo
      };
  }

  getLegendInfo(): StandardizedLegendData {
    const renderer = this.renderer;
    
    if (renderer.type === "class-breaks") {
      const classBreaksRenderer = renderer as ClassBreaksRenderer;
      
      // Use standardized field mapping for legend title
      const primaryFieldName = this.data ? FieldMappingHelper.getFriendlyFieldName(this.data.primaryField || '') : 'Primary';
      const comparisonFieldName = this.data ? FieldMappingHelper.getFriendlyFieldName(this.data.comparisonField || '') : 'Comparison';
      
      return {
        title: `${primaryFieldName} vs ${comparisonFieldName}`,
        type: 'class-breaks',
        description: 'Correlation strength between metrics',
        items: classBreaksRenderer.classBreakInfos.map(info => ({
          label: info.label ?? '',
          color: `rgba(${(info.symbol as SimpleFillSymbol).color.toRgba().join(',')})`
        }))
      };
    }

    return { title: 'Correlation', type: 'class-breaks', items: [] };
  }

  /**
   * Apply standardized popup template for correlation visualization
   */
  private applyCorrelationPopupTemplate(layer: FeatureLayer): void {
    if (this.options.popupConfig) {
      this.applyPopupTemplate(layer, this.options.popupConfig);
    } else {
      // Use standardized popup with correlation-specific fields
      const popupFields = this.getPopupFields('correlation');
      this.applyStandardizedPopup(
        layer,
        popupFields.barChartFields,
        popupFields.listFields,
        'correlation'
      );
    }
  }

  /**
   * Helper method to get display name for a layer
   */
  private getLayerDisplayName(type: 'primary' | 'comparison'): string | null {
    if (!this.data) return null;
    const layerId = type === 'primary' ? this.data.primaryLayerId : this.data.comparisonLayerId;
    const fieldName = type === 'primary' ? this.data.primaryField : this.data.comparisonField;

    // Try direct lookup by layerId first
    if (layerId && layers[layerId]) {
      return layers[layerId].name;
    }

    // Fallback: attempt to locate a layer that contains the field
    if (fieldName) {
      for (const cfg of Object.values(layers)) {
        if (cfg.fields?.some(f => f.name === fieldName)) {
          return cfg.name;
        }
      }

      // If still not found, prettify the field name
      const formatted = fieldName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
      return formatted.replace('Fsa', 'FSA').replace('Id', 'ID');
    }

    return null;
  }

  /**
   * Helper method to create the correct symbol based on geometry type.
   * @param geometryType The type of geometry ('point' or 'polygon').
   * @param color The color for the symbol.
   * @returns A SimpleMarkerSymbol for points or a SimpleFillSymbol for polygons.
   */
  private _getSymbolForGeometry(
    geometryType: "point" | "polygon", 
    color: any // Use 'any' to bypass the strict type check
  ): SimpleMarkerSymbol | SimpleFillSymbol {
    const symbolColor = (typeof color === 'string') ? new Color(color) : new Color(color as number[]);

    if (geometryType === 'point') {
        return new SimpleMarkerSymbol({
            color: symbolColor,
            size: '8px',
            outline: { color: [0, 0, 0, 0], width: 0 }
        });
    }
    return new SimpleFillSymbol({
        color: symbolColor,
        outline: { color: [0, 0, 0, 0], width: 0 }
    });
  }

  private _formatFieldName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /** Lookup label/alias for a field, fall back to prettified name */
  private _getFriendlyFieldName(layerId: string, fieldName: string): string {
    return FieldMappingHelper.getFriendlyFieldName(fieldName, layerId);
  }
}