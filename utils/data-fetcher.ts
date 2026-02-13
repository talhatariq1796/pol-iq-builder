import { ProjectLayerConfig as ProjectConfig, LayerConfig, LayerGroup as GroupConfig } from "../types/layers";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import * as query from "@arcgis/core/rest/query";
import Query from "@arcgis/core/rest/support/Query";
import { AnalysisResult as BaseAnalysisResult } from "@/lib/analytics/types";

// Extend the base type to include the missing property
type AnalysisResult = BaseAnalysisResult & {
  sqlWhereClause?: string;
};

export interface LayerDataOptions {
  query: string;
  spatialFilter?: any;
  limit?: number;
  targetFields?: string[]; // Add target fields for filtering
  sqlWhere?: string; // Add custom SQL where clause
  minApplications?: number; // Minimum number of applications filter
}

export interface LayerDataResult {
  layerId: string;
  layerName: string;
  layerType: string;
  features: any[];
  error?: string;
  totalFeatures?: number; // Track total before any filtering
}

export interface DataFetcherOptions {
  projectConfig: ProjectConfig;
  analysisResult: AnalysisResult;
}

export async function fetchLayerData(
  layerIds: string[], 
  options: LayerDataOptions
): Promise<LayerDataResult[]> {
  console.log('[DataFetcher] Fetching data for specific layers:', layerIds, options);
  
  const results: LayerDataResult[] = [];
  
  try {
    // Import layer configuration
    const { createProjectConfig } = await import('@/adapters/layerConfigAdapter');
    const projectLayerConfig = createProjectConfig();
    
    // Build a map of individual layer configs for direct lookup
    const layerIdToConfigMap = new Map<string, any>();
    
    for (const group of projectLayerConfig.groups) {
      if (group.layers) {
        for (const layer of group.layers) {
          layerIdToConfigMap.set(layer.id, layer);
        }
      }
    }
    
    console.log(`[DataFetcher] Processing ${layerIds.length} specific layers:`, layerIds);
    
    for (const layerId of layerIds) {
      try {
        const layerConfig = layerIdToConfigMap.get(layerId);
        
        if (!layerConfig) {
          console.warn(`[DataFetcher] Layer config not found for: ${layerId}`);
          results.push({
            layerId,
            layerName: layerId,
            layerType: 'unknown',
            features: [],
            error: 'Layer configuration not found',
            totalFeatures: 0
          });
          continue;
        }
        
        // Create temporary layer for data fetching
        const FeatureLayer = (await import('@arcgis/core/layers/FeatureLayer')).default;
        const layer = new FeatureLayer({
          url: layerConfig.url,
          outFields: ['*']
        });
        
        // Build query with intelligent filtering based on THIS layer's field names
        const query = layer.createQuery();
        query.returnGeometry = true;
        query.outFields = ['*'];
        
        // Generate layer-specific where clause based on the layer's actual fields
        let whereClause = '1=1';
        
        // Get the actual field name for this layer (use rendererField as primary data field)
        const layerPrimaryField = layerConfig.rendererField || 'thematic_value';
        
        // For ranking queries (highest/lowest), filter out null/zero values on the primary field
        if (options.query && (options.query.toLowerCase().includes('highest') || options.query.toLowerCase().includes('lowest'))) {
          whereClause = `${layerPrimaryField} IS NOT NULL AND ${layerPrimaryField} > 0`;
        } else {
          // For other queries, just filter out null values
          whereClause = `${layerPrimaryField} IS NOT NULL`;
        }
        
        // Apply minimum applications filter if specified and this layer has a FREQUENCY field
        if (options.minApplications && options.minApplications > 1) {
          // Check if this layer has a FREQUENCY field (mortgage applications data)
          const hasFrequencyField = layerConfig.fields?.some((field: any) => 
            field.name === 'FREQUENCY' || field.name === 'frequency'
          );
          
          if (hasFrequencyField) {
            whereClause += ` AND FREQUENCY >= ${options.minApplications}`;
            console.log(`[DataFetcher] Applied minimum applications filter: FREQUENCY >= ${options.minApplications} for layer: ${layerId}`);
          }
        }
        
        // Note: We intentionally ignore options.sqlWhere as it contains field names 
        // from concept mapping that don't match this specific layer's field structure
        
        query.where = whereClause;
        
        // Remove arbitrary feature limits - get all relevant data for proper analysis
        // Only apply limit if explicitly specified for performance reasons
        if (options.limit && options.limit > 0) {
          query.num = options.limit;
          console.log(`[DataFetcher] Applying performance limit of ${options.limit} features to layer: ${layerId}`);
        }
        
        // Apply spatial filter if provided
        if (options.spatialFilter) {
          query.geometry = options.spatialFilter.geometry;
          query.spatialRelationship = options.spatialFilter.relationship || 'intersects';
        }
        
        console.log(`[DataFetcher] Executing query for ${layerId}:`, {
          where: whereClause,
          hasLimit: !!options.limit,
          hasSpatialFilter: !!options.spatialFilter
        });
        
        // Execute query
        const featureSet = await layer.queryFeatures(query);
        
        console.log(`[DataFetcher] Fetched ${featureSet.features.length} features for layer: ${layerId}`);
        
        // Get total count without limits for analysis context
        let totalFeatures = featureSet.features.length;
        if (options.limit && featureSet.features.length === options.limit) {
          // If we hit the limit, get the actual total count
          try {
            const countQuery = layer.createQuery();
            countQuery.where = whereClause;
            if (options.spatialFilter) {
              countQuery.geometry = options.spatialFilter.geometry;
              countQuery.spatialRelationship = options.spatialFilter.relationship || 'intersects';
            }
            const countResult = await layer.queryFeatureCount(countQuery);
            totalFeatures = countResult;
            console.log(`[DataFetcher] Total available features for ${layerId}: ${totalFeatures} (returned ${featureSet.features.length})`);
          } catch (countError) {
            console.warn(`[DataFetcher] Could not get total count for ${layerId}:`, countError);
          }
        }
        
        results.push({
          layerId,
          layerName: layerConfig.name,
          layerType: layerConfig.type || 'feature',
          totalFeatures,
          features: featureSet.features.map(feature => {
            // Ensure an ID field is present in properties and at the top level
            const idValue = feature.attributes.OBJECTID || feature.attributes.id || feature.attributes.ID || `${layerId}-${Date.now()}-${Math.random()}`;
            const props = {
              ...feature.attributes,
              ID: idValue, // Always include ID in properties
              layerId: layerId, // Add layerId to properties for tracking
              layerName: layerConfig.name // Add layerName for debugging
            };
            return {
              type: 'Feature',
              geometry: feature.geometry?.toJSON(),
              properties: props,
              ID: idValue // Also add ID at the top level
            };
          })
        });
        
      } catch (error) {
        console.error(`[DataFetcher] Error fetching data for layer ${layerId}:`, error);
        results.push({
          layerId,
          layerName: layerId,
          layerType: 'unknown',
          features: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          totalFeatures: 0
        });
      }
    }
    
  } catch (configError) {
    console.error('[DataFetcher] Error loading layer configuration:', configError);
    // Return empty results for all layers if config fails
    for (const layerId of layerIds) {
      results.push({
        layerId,
        layerName: layerId,
        layerType: 'unknown',
        features: [],
        error: 'Configuration loading failed',
        totalFeatures: 0
      });
    }
  }
  
  const totalFeaturesAcrossLayers = results.reduce((sum, result) => sum + (result.totalFeatures || 0), 0);
  const returnedFeaturesAcrossLayers = results.reduce((sum, result) => sum + result.features.length, 0);
  
  console.log('[DataFetcher] Summary:', {
    layersProcessed: results.length,
    totalAvailableFeatures: totalFeaturesAcrossLayers,
    totalReturnedFeatures: returnedFeaturesAcrossLayers,
    layersWithData: results.filter(r => r.features.length > 0).length,
    layersWithErrors: results.filter(r => r.error).length
  });
  
  return results;
}

/**
 * Fetches geographic data from ArcGIS FeatureLayers based on an analysis result.
 * This function dynamically builds queries for relevant layers.
 */
export async function fetchDataForAnalysis(
  options: DataFetcherOptions
): Promise<LayerDataResult[]> {
  const { projectConfig, analysisResult } = options;
  const { relevantLayers, sqlWhereClause } = analysisResult;

  if (!relevantLayers || relevantLayers.length === 0) {
    console.warn("[DataFetcher] No relevant layers identified for analysis.");
    return [];
  }

  const allLayers: LayerConfig[] = Object.values(projectConfig.layers);
  const layersToQuery = allLayers.filter(layer => relevantLayers.includes(layer.id));

  if (layersToQuery.length === 0) {
    console.warn("[DataFetcher] No matching layers found in config for:", relevantLayers);
    return [];
  }

  const promises: Promise<LayerDataResult>[] = layersToQuery.map(async (layerConfig: LayerConfig): Promise<LayerDataResult> => {
    try {
      const layer = new FeatureLayer({
        url: layerConfig.url,
        outFields: ["*"],
      });

      const queryParams = new Query({
        where: sqlWhereClause || "1=1",
        returnGeometry: true,
        outSpatialReference: { wkid: 4326 }, // Ensure WGS84 for consistency
      });

      const featureSet = await layer.queryFeatures(queryParams);

      return {
        layerId: layerConfig.id,
        features: featureSet.features,
        layerName: layerConfig.name,
        layerType: layerConfig.type || 'feature',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[DataFetcher] Failed to fetch data for layer ${layerConfig.id}:`,
        errorMessage
      );
      return {
        layerId: layerConfig.id,
        features: [],
        error: errorMessage,
        layerName: layerConfig.name || 'Unknown',
        layerType: layerConfig.type || 'unknown',
      };
    }
  });

  return Promise.all(promises);
} 