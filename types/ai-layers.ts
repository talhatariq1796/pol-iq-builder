// src/types/ai-layers.ts

import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { LayerState as BaseLayerState } from "./aitools";
import type { GeospatialFeature } from "./geospatial-ai-types";
import Graphic from "@arcgis/core/Graphic";
import Field from "@arcgis/core/layers/support/Field";
import Point from "@arcgis/core/geometry/Point";

/**
 * Layer field definition
 */
export interface LayerField {
  name: string;
  type: string;
  alias?: string;
  domain?: any;
  defaultValue?: any;
}

/**
 * Base query results interface
 */
export interface BaseQueryResults {
  features: (GeospatialFeature | Graphic)[];
  fields: any[];
}

/**
 * Extended query results structure
 */
export interface QueryResults {
  features: Graphic[];
  fields: Field[];
  hasQueryResults: boolean;
  featureCount: number;
}

/**
 * Layer-specific query results
 */
export interface LayerQueryResult {
  features: GeospatialFeature[];
  fields: LayerField[];
  error?: {
    message: string;
    details?: any;
  };
}

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  maxFeatures?: number;
  timeout?: number;
  spatialReference?: {
    wkid: number;
    latestWkid?: number;
  };
}

/**
 * Extended LayerState that includes all required properties
 */
export interface LayerState {
  visible: boolean;
  layer: __esri.Layer | __esri.FeatureLayer | null;
  loading: boolean;
  group: string;
  error?: string;
  filters: any[];
  queryResults?: BaseQueryResults;
}

/**
 * AI-specific layer state 
 */
export interface AILayerState extends Omit<LayerState, 'filters' | 'queryResults'> {
  layer: __esri.Layer | __esri.FeatureLayer;
  queryResults?: QueryResults;
  aiFilters?: Record<string, any>;
  analysisConfig?: AnalysisConfig;
}

/**
 * View state for spatial context
 */
export interface ViewState {
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference?: {
      wkid: number;
      latestWkid?: number;
    }
  };
  zoom?: number;
  scale?: number;
}

/**
 * Analysis context
 */
export interface AnalysisContext {
  timeRange?: {
    start: Date;
    end: Date;
  };
  spatialFilter?: {
    geometry: any;
    relation: 'intersects' | 'contains' | 'within';
  };
  attributeFilters?: Record<string, any>;
  config?: AnalysisConfig;
}

/**
 * Analysis results
 */
export interface AnalysisResults {
  features: GeospatialFeature[];
  summary?: {
    count: number;
    statistics?: Record<string, any>;
  };
  metadata?: {
    executionTime: number;
    processedFeatures: number;
  };
}

/**
 * Convert LayerState to AILayerState
 */
export const toAILayerState = (state: LayerState): AILayerState | null => {
  if (!state.layer) return null;

  return {
    visible: state.visible,
    layer: state.layer,
    loading: state.loading,
    group: state.group,
    error: state.error,
    queryResults: state.queryResults ? {
      features: state.queryResults.features.map(g => new Graphic({
        geometry: new Point({
          x: (g.geometry as any).x,
          y: (g.geometry as any).y,
          spatialReference: { wkid: 4326 }
        }),
        attributes: 'properties' in g ? g.properties : g.attributes
      })),
      fields: state.queryResults.fields,
      hasQueryResults: true,
      featureCount: state.queryResults.features.length
    } : undefined,
    aiFilters: {}
  };
};

/**
 * Convert AILayerState back to LayerState
 */
export const fromAILayerState = (state: AILayerState): LayerState => {
  return {
    visible: state.visible,
    layer: state.layer,
    loading: state.loading,
    group: state.group,
    error: state.error,
    filters: [],
    queryResults: state.queryResults
  };
};

/**
 * Create a new LayerState
 */
export const createLayerState = (
  layer: FeatureLayer,
  options: Partial<Omit<LayerState, 'layer'>> = {}
): LayerState => {
  return {
    visible: true,
    layer,
    loading: false,
    group: 'default',
    filters: [],
    ...options
  };
};

/**
 * Validate layer fields
 */
export const validateLayerFields = (
  layer: FeatureLayer,
  requiredFields: string[]
): { valid: boolean; missing: string[] } => {
  const layerFields = new Set(layer.fields?.map(f => f.name));
  const missing = requiredFields.filter(field => !layerFields.has(field));
  return {
    valid: missing.length === 0,
    missing
  };
};

/**
 * Create default analysis configuration
 */
export const createDefaultAnalysisConfig = (): AnalysisConfig => {
  return {
    maxFeatures: 1000,
    timeout: 30000,
    spatialReference: {
      wkid: 4326
    }
  };
};

/**
 * Check if a layer is ready for AI analysis
 */
export const isLayerAnalysisReady = (
  state: AILayerState
): { ready: boolean; reasons: string[] } => {
  const reasons: string[] = [];

  if (!state.layer) {
    reasons.push('Layer is not initialized');
  }

  if (state.loading) {
    reasons.push('Layer is currently loading');
  }

  if (state.error) {
    reasons.push(`Layer has an error: ${state.error}`);
  }

  return {
    ready: reasons.length === 0,
    reasons
  };
};

export interface ProcessedLayerState {
  layer: {
    id: string;
    title: string;
    url: string;
    geometryType: string;
    fields: Array<{
      name: string;
      type: string;
      alias: string;
    }>;
  };
  queryResults: QueryResults;
}

export interface AnalysisRequest {
  query: string;
  view?: __esri.MapView;
  layerStates?: Record<string, ProcessedLayerState>;
}