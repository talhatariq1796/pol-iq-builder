// Feature optimization utility for reducing data payload size
// and efficiently separating geometry from attributes for analysis

import { QueryAnalysis } from "@/lib/analytics/query-analysis";

/**
 * Result of optimizing features for analysis
 */
export interface OptimizedFeatureResult {
  features: Array<{
    type: string;
    layerId?: string;
    features: Array<{
      type: string;
      geometry?: any;
      properties: Record<string, any>;
    }>;
    metadata?: {
      count: number;
      rendererField: string;
      fields: string[];
      hasThematicValue: boolean;
      geometryPreserved: boolean;
    };
  }>;
  totalFeatures: number;
  timestamp: string;
  isComplete: boolean;
  error?: string;
  context?: {
    query: string;
    analysisType: string;
    zipCodeCount?: number;
    requiredFields?: string[];
    rendererField?: string;
    additionalContext?: Record<string, any>;
  };
  layerId?: string;
  layerName?: string;
  layerType?: string;
  geographicLevel?: string;
}

interface OptimizedFeatureOptions {
  includeFields?: string[];  // Specific fields to include
  excludeFields?: string[];  // Fields to explicitly exclude
  metadataFields?: string[]; // Fields to use in metadata calculations
  addLayerMetadata?: boolean; // Whether to include layer metadata
  renderField?: string;      // Field to ensure is used in visualization
  removeGeometry?: boolean;  // Whether to remove geometry data to reduce payload size
}

// Common interface for analysis context with QueryAnalysis compatibility
export interface AnalysisContext {
  query: string;
  analysisType: QueryAnalysis['queryType'] | string;  // Compatible with QueryAnalysis.queryType
  region?: string;
  additionalContext?: Record<string, any>;
  note?: string;
  requiredFields?: string[];
  populationLookup?: Map<string, number>; // Add population lookup
  // Additional fields from QueryAnalysis for compatibility
  intent?: QueryAnalysis['intent'];
  confidence?: number;
  layers?: Array<{
    layerId: string;
    relevance: number;
    matchMethod: string;
    confidence: number;
    reasons: string[];
  }>;
  timeframe?: string;
  relevantLayers?: string[];
  explanation?: string;
}

interface OptimizedFeature {
  type: string;
  properties: Record<string, any>;
}

interface OptimizedFeatureCollection {
  type: string;
  features: OptimizedFeature[];
  metadata?: {
    count: number;
    rendererField: string;
    fields: string[];
    hasThematicValue: boolean;
    geometryPreserved: boolean;
  };
}

interface OptimizedResult {
  features: OptimizedFeatureCollection[];
  totalFeatures: number;
  timestamp: string;
  isComplete: boolean;
  context: {
    query: string;
    analysisType: string;
    error?: string;
  };
  layerId?: string;
  layerName?: string;
  layerType?: string;
}

/**
 * Creates an optimized version of feature data by removing geometries
 * and only including essential attributes for analysis
 */
export function optimizeFeatures(
  features: any[],
  layerConfig: any,
  options: OptimizedFeatureOptions
): OptimizedFeatureResult {
  try {
    const {
      includeFields = [], 
      excludeFields = [],
      metadataFields = [],
      addLayerMetadata = true,
      renderField,
      removeGeometry = true // Default to false to preserve geometry
    } = options;

    // Get the renderer field from options, layer config, or use a default
    const rendererField = renderField || layerConfig?.rendererField || 'value';
    
    console.log('[OptimizeFeatures Helper] Using renderer field:', rendererField);
    console.log('[OptimizeFeatures Helper] Received options.includeFields:', includeFields);
    console.log('[OptimizeFeatures Helper] Geometry will be ' + (removeGeometry ? 'removed' : 'preserved'));

    // Collect a sample of unique feature property/attribute keys
    const featureAttrs: Array<Set<string>> = [];
    const includedAttrs: Array<Record<string, any>> = [];
    
    // Process feature attributes to gather metadata and optimize storage
    // Use a smaller sample size for performance on large datasets
    const sampleSize = Math.min(features.length, 100);
    const sampleFeatures = features.slice(0, sampleSize);
    
    // --- Enhanced feature processing ---
    for (const feature of sampleFeatures) {
      // Get attributes from either attributes or properties
      const attrs = { ...feature.attributes, ...feature.properties };
      
      // Create a set of keys for metadata
      const attrKeys = new Set<string>(Object.keys(attrs));
      featureAttrs.push(attrKeys);
      
      // Prepare the optimized attribute object
      const included: Record<string, any> = {};
      
      // Always include renderField and thematic_value as these are critical for visualization
      // and AI analysis alignment
      if (rendererField && attrs[rendererField] !== undefined) {
        included[rendererField] = attrs[rendererField];
      }
      
      // Always ensure thematic_value exists, copy from rendererField if needed
      if (attrs.thematic_value !== undefined) {
        included.thematic_value = attrs.thematic_value;
      } else if (rendererField && attrs[rendererField] !== undefined) {
        // If thematic_value is missing but rendererField exists, copy the value
        included.thematic_value = attrs[rendererField];
      }
      
      // Process the include fields
      for (const field of includeFields) {
        if (field === rendererField || field === 'thematic_value') continue; // Already handled
        
        if (attrs[field] !== undefined) {
          included[field] = attrs[field];
        }
      }
      
      includedAttrs.push(included);
    }
    
    console.log('[OptimizeFeatures Helper] Sample of included fields:', 
      includedAttrs.length > 0 ? Object.keys(includedAttrs[0]) : []);
    
    // Make sure all features in the dataset have the required fields
    // Especially thematic_value which is critical for visualization
    const optimizedFeatures = features.map(feature => {
      // Get attributes from either attributes or properties
      const attrs = { ...feature.attributes, ...feature.properties };
      
      // Create a new properties object for GeoJSON output
      const properties: Record<string, any> = {};
      
      // Always include renderer field and thematic_value
      if (rendererField && attrs[rendererField] !== undefined) {
        properties[rendererField] = attrs[rendererField];
      }
      
      // Ensure thematic_value exists, derive from rendererField if needed
      if (attrs.thematic_value !== undefined) {
        properties.thematic_value = attrs.thematic_value;
      } else if (rendererField && attrs[rendererField] !== undefined) {
        // Copy renderer field value to thematic_value
        properties.thematic_value = attrs[rendererField];
      }
      
      // Include all other specified fields
      for (const field of includeFields) {
        if (field === rendererField || field === 'thematic_value') continue; // Already handled
        
        const fieldExists = attrs[field] !== undefined;
        if (fieldExists && !excludeFields.includes(field)) {
          properties[field] = attrs[field];
        }
      }
      
      // Keep the original geometry unless removeGeometry is true
      let geometry = removeGeometry ? null : feature.geometry;
      
      // If original geometry is in the properties, use it as a fallback
      if (!removeGeometry && !geometry && feature.properties?._originalEsriGeometry) {
        geometry = feature.properties._originalEsriGeometry;
      }
      
      return {
        type: 'Feature',
        geometry,
        properties
      };
    });
    
    // Return the optimized result with a thematic_value validation flag
    const finalResult = {
      features: [
        {
          type: 'FeatureCollection',
          features: optimizedFeatures,
          metadata: {
            count: optimizedFeatures.length,
            rendererField,
            fields: [...new Set([...includeFields, rendererField, 'thematic_value'])],
            hasThematicValue: optimizedFeatures.some((f: { properties?: Record<string, any> }) => 
              f.properties && f.properties.thematic_value !== undefined
            ),
            geometryPreserved: !removeGeometry
          }
        }
      ],
      totalFeatures: features.length,
      timestamp: new Date().toISOString(),
      isComplete: true
    };
    
    console.log('[OptimizeFeatures Helper] Optimization complete:', {
      originalCount: features.length,
      optimizedCount: optimizedFeatures.length,
      rendererField,
      hasThematicValue: finalResult.features[0].metadata.hasThematicValue,
      geometryPreserved: !removeGeometry
    });
    
    return finalResult;
  } catch (error) {
    console.error('Error in optimizeFeatures:', error);
    return {
      features: [],
      totalFeatures: 0,
      timestamp: new Date().toISOString(),
      isComplete: false,
      error: error instanceof Error ? error.message : 'Unknown error in optimizeFeatures'
    };
  }
}

// Helper to find a suitable identifier field
function getIdentifierField(attributes: Record<string, any> | undefined | null, layerConfig?: any): string {
  // If attributes is undefined or null, return Unknown
  if (!attributes) {
    return 'Unknown';
  }

  // Make sure we can safely access Object.keys
  try {
    if (typeof attributes !== 'object' || attributes === null) {
      console.warn('Invalid attributes object:', attributes);
      return 'Unknown';
    }
  } catch (e) {
    console.error('Error accessing attributes:', e);
    return 'Unknown';
  }

  // First check for specified display or ID fields in layer config
  if (layerConfig) {
    // Try display field first
    if (layerConfig.displayField && attributes[layerConfig.displayField] !== undefined) {
      return String(attributes[layerConfig.displayField] || '');
    }
    
    // Then try objectId field
    if (layerConfig.objectIdField && attributes[layerConfig.objectIdField] !== undefined) {
      return String(attributes[layerConfig.objectIdField] || '');
    }
    
    // Then try any fields specifically marked for identification in config
    if (layerConfig.fields) {
      const idFields = layerConfig.fields
        .filter((f: any) => f.type === 'id' || f.isIdentifier || f.isPrimary)
        .map((f: any) => f.name);
      
      for (const field of idFields) {
        if (field && attributes[field] !== undefined) {
          return String(attributes[field] || '');
        }
      }
    }
  }

  // Common name fields (fallback) - removed FEDNAME
  const nameFields = ['NAME', 'CSDNAME', 'name', 'Name', 'title', 'PLACENAME', 'DESCRIPTION'];
  // Common ID fields (fallback) - removed FEDUID
  const idFields = ['OBJECTID', 'FID', 'CSDUID', 'id', 'ID', 'CODE', 'UID'];
  
  // Try name fields first
  for (const field of nameFields) {
    if (attributes[field] !== undefined) {
      return String(attributes[field] || '');
    }
  }
  
  // Try ID fields next
  for (const field of idFields) {
    if (attributes[field] !== undefined) {
      return String(attributes[field] || '');
    }
  }
  
  return 'Unknown';
}

// Helper to generate metadata
function generateMetadata(
  features: any[], 
  metadataFields: string[],
  rendererField: string,
  layerConfig: any
) {
  const statsFields = [rendererField, ...metadataFields].filter(Boolean);
  const metadata: Record<string, any> = {
    rendererField,
    fieldType: 'numeric',
    description: layerConfig?.description || `Data for ${layerConfig?.name || 'unknown layer'}`,
    totalFeatures: features.length,
    validFeatures: features.filter(f => 
      f && (f.attributes || f.properties) && !f.placeholder
    ).length
  };
  
  // Calculate statistics for each field
  statsFields.forEach(field => {
    if (!field) return;
    
    try {
      const values = features
        .filter(f => {
          // Get attributes from either attributes or properties
          const attrs = f?.attributes || f?.properties || {};
          return (
            f && 
            attrs && 
            attrs[field] !== undefined && 
            attrs[field] !== null &&
            !isNaN(Number(attrs[field])) && 
            !f.placeholder
          );
        })
        .map(f => {
          // Get the value from attributes or properties
          const attrs = f?.attributes || f?.properties || {};
          return Number(attrs[field]);
        })
        .filter(v => typeof v === 'number' && !isNaN(v));
      
      if (values.length > 0) {
        metadata[`${field}_min`] = Math.min(...values);
        metadata[`${field}_max`] = Math.max(...values);
        metadata[`${field}_avg`] = values.reduce((sum, val) => sum + val, 0) / values.length;
        metadata[`${field}_count`] = values.length;
      } else {
        // Set default values if no valid values found
        metadata[`${field}_min`] = 0;
        metadata[`${field}_max`] = 0;
        metadata[`${field}_avg`] = 0;
        metadata[`${field}_count`] = 0;
      }
    } catch (error) {
      console.warn(`Error calculating statistics for field ${field}:`, error);
      metadata[`${field}_error`] = 'Error calculating statistics';
    }
  });
  
  return metadata;
}

// Helper to check blob size
export function checkBlobSize(data: any, maxSizeMB = 100): boolean {
  try {
    const stringified = typeof data === 'string' ? data : JSON.stringify(data);
    const bytes = new TextEncoder().encode(stringified).length;
    const sizeMB = bytes / 1024 / 1024;
    return sizeMB <= maxSizeMB;
  } catch (error) {
    console.error('[Feature Optimization] Error checking blob size:', error);
    return false;
  }
}

/**
 * Creates an optimized version of feature data for analysis, with support for QueryAnalysis
 * This function can be imported dynamically in components
 */
export async function optimizeAnalysisFeatures(
  features: any[],
  layerConfig: any,
  context: AnalysisContext | QueryAnalysis
): Promise<OptimizedFeatureResult> {
  try {
    // Convert QueryAnalysis to AnalysisContext if needed
    const analysisContext: AnalysisContext = isQueryAnalysis(context) 
      ? convertQueryAnalysisToContext(context)
      : context;
    
    // Determine fields to include based on analysis type
    const includeFields = determineFieldsToInclude(analysisContext, layerConfig);
    
    // Create options for the optimizer
    const optimizeOptions: OptimizedFeatureOptions = {
      includeFields,
      removeGeometry: false, // Keep geometry for visualization
      renderField: layerConfig?.rendererField || 'value',
      addLayerMetadata: true
    };
    
    // Call the base optimizer with our options
    const result = optimizeFeatures(features, layerConfig, optimizeOptions);
    
    // Enhance the result with context information
    result.context = {
      query: analysisContext.query,
      analysisType: analysisContext.analysisType,
      requiredFields: includeFields,
      rendererField: optimizeOptions.renderField
    };
    
    // Add layer information if available
    if (layerConfig) {
      result.layerId = layerConfig.id || '';
      result.layerName = layerConfig.name || '';
      result.layerType = layerConfig.type || '';
    }
    
    return result;
  } catch (error) {
    console.error('[Feature Optimization] Error optimizing features:', error);
    // Return error result
    return {
      features: [],
      totalFeatures: 0,
      timestamp: new Date().toISOString(),
      isComplete: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Helper to check if an object is a QueryAnalysis
 */
function isQueryAnalysis(obj: any): obj is QueryAnalysis {
  return obj && 
    typeof obj === 'object' && 
    'queryType' in obj && 
    'entities' in obj && 
    'intent' in obj;
}

/**
 * Convert a QueryAnalysis object to an AnalysisContext
 */
function convertQueryAnalysisToContext(analysis: QueryAnalysis): AnalysisContext {
  return {
    query: analysis.explanation || '',
    analysisType: analysis.queryType || 'unknown',
    intent: analysis.intent,
    confidence: analysis.confidence,
    timeframe: analysis.timeframe,
    relevantLayers: analysis.relevantLayers,
    explanation: analysis.explanation,
    requiredFields: analysis.relevantFields,
    populationLookup: analysis.populationLookup,
    additionalContext: {
      entities: analysis.entities,
      comparisonParty: analysis.comparisonParty,
      topN: analysis.topN,
      isCrossGeography: analysis.isCrossGeography,
      originalQueryType: analysis.originalQueryType,
      trendsKeyword: analysis.trendsKeyword,
      metrics: analysis.metrics,
      thresholds: analysis.thresholds
    }
  };
}

/**
 * Determine which fields to include based on the analysis type
 */
function determineFieldsToInclude(context: AnalysisContext, layerConfig: any): string[] {
  const baseFields = ['OBJECTID', 'FID', 'NAME', 'NAME_ALIAS', 'STATE_NAME', 'COUNTY', 'CITY'];
  const rendererField = layerConfig?.rendererField || 'value';
  
  // Always include the renderer field and any required fields from the analysis
  const fields = [...baseFields, rendererField];
  
  if (context.requiredFields && context.requiredFields.length > 0) {
    fields.push(...context.requiredFields);
  }
  
  // Include specific fields based on analysis type
  switch (context.analysisType) {
    case 'correlation':
      fields.push('population', 'median_income', 'households');
      break;
    case 'trend':
    case 'trends':
      fields.push('year', 'date', 'timestamp', 'period', 'value');
      break;
    case 'distribution':
      fields.push('population', 'density', 'area');
      break;
    case 'topN':
      fields.push('rank', 'score', 'rating');
      break;
  }
  
  // Return unique fields only
  return [...new Set(fields)];
} 