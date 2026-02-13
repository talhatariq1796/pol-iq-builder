import Graphic from '@arcgis/core/Graphic';
import Extent from '@arcgis/core/geometry/Extent';
import type { LayerConfig } from '@/types/layers';
import type { GeometryObject } from '@/types/geospatial-ai-types';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import { createGeometry } from './geometry';

// Add type definition at top of file
interface GeometryWithSR {
  type: string;
  coordinates: number[] | number[][][];  // Allow both point and polygon coordinates
  spatialReference?: __esri.SpatialReference;
}

// Update GeospatialFeature interface
export interface GeospatialFeature {
  id: string;
  type: 'Feature';
  geometry: GeometryObject;
  properties: {
    [key: string]: any;
    layerId: string;
    layerName: string;
    layerType: string;
  };
}

interface ProcessedFeatures {
  layerId: string;
  features: GeospatialFeature[];
  extent: __esri.Extent | null;
  metadata: {
    processingTime: number;
    featureCount: number;
    errorCount: number;
    dataStructure?: string;
  };
}

interface ProcessingOptions {
  batchSize: number;
  maxParallelBatches: number;
  timeout: number;
}

const DEFAULT_OPTIONS: ProcessingOptions = {
  batchSize: 1000,
  maxParallelBatches: 4,
  timeout: 30000
};

export class FeatureProcessor {
  private processingCache: Map<string, ProcessedFeatures>;
  private options: ProcessingOptions;

  constructor(options: Partial<ProcessingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.processingCache = new Map();
  }

  async processInParallel(
    layers: LayerConfig[],
    query?: string
  ): Promise<ProcessedFeatures[]> {
    const startTime = performance.now();
    const results: ProcessedFeatures[] = [];

    try {
      // Process layers in parallel batches
      for (let i = 0; i < layers.length; i += this.options.maxParallelBatches) {
        const batch = layers.slice(i, i + this.options.maxParallelBatches);
        const batchPromises = batch.map(layer => this.processLayer(layer, query));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      console.log(`Processed ${layers.length} layers in ${performance.now() - startTime}ms`);
      return results;

    } catch (error) {
      console.error('Error in parallel processing:', error);
      throw error;
    }
  }

  private async processLayer(
    layer: LayerConfig,
    query?: string
  ): Promise<ProcessedFeatures> {
    const cacheKey = `${layer.id}-${query || ''}`;
    const cached = this.processingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = performance.now();
    let errorCount = 0;

    try {
      // Create feature layer
      const featureLayer = new FeatureLayer({
        url: layer.url,
        outFields: ["*"]
      });

      // Wait for layer to load
      await featureLayer.load();

      // Prepare query
      const queryParams = new Query({
        where: query || "1=1",
        outFields: ["*"],
        returnGeometry: true,
        outSpatialReference: { wkid: 102100 }
      });

      // Execute query with batching
      const features = await this.queryFeaturesBatched(featureLayer, queryParams);
      
      // Process features based on data structure type
      const processedFeatures = layer.dataStructure === 'field-based'
        ? await this.processFieldBasedFeatures(features, layer)
        : await this.processFeatures(features, layer);

      const result: ProcessedFeatures = {
        layerId: layer.id,
        features: processedFeatures.features,
        extent: processedFeatures.extent,
        metadata: {
          processingTime: performance.now() - startTime,
          featureCount: processedFeatures.features.length,
          errorCount,
          dataStructure: layer.dataStructure || 'separate'
        }
      };

      // Cache the result
      this.processingCache.set(cacheKey, result);

      return result;

    } catch (error) {
      console.error(`Error processing layer ${layer.id}:`, error);
      errorCount++;
      return {
        layerId: layer.id,
        features: [],
        extent: null,
        metadata: {
          processingTime: performance.now() - startTime,
          featureCount: 0,
          errorCount,
          dataStructure: layer.dataStructure || 'separate'
        }
      };
    }
  }

  private async queryFeaturesBatched(
    layer: __esri.FeatureLayer,
    query: __esri.Query
  ): Promise<__esri.Graphic[]> {
    const allFeatures: __esri.Graphic[] = [];
    let resultOffset = 0;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Update query for current batch
        query.num = this.options.batchSize;
        query.start = resultOffset;

        // Execute query
        const result = await layer.queryFeatures(query);
        
        if (!result.features || result.features.length === 0) {
          break;
        }

        allFeatures.push(...result.features);
        resultOffset += result.features.length;

        if (result.features.length < this.options.batchSize) {
          break;
        }
      }

      return allFeatures;

    } catch (error) {
      console.error('Error in batched query:', error);
      throw error;
    }
  }

  private async processFeatures(
    features: __esri.Graphic[],
    layer: LayerConfig
  ): Promise<{ features: GeospatialFeature[]; extent: __esri.Extent | null }> {
    try {
      // Process features in batches
      const processedFeatures: GeospatialFeature[] = [];
      let extent: __esri.Extent | null = null;

      for (let i = 0; i < features.length; i += this.options.batchSize) {
        const batch = features.slice(i, i + this.options.batchSize);
        
        const batchResults = await Promise.all(batch.map(feature => 
          this.processFeature(feature, layer)
        ));

        const validResults = batchResults.filter((f): f is GeospatialFeature => f !== null);
        processedFeatures.push(...validResults);

        // Update extent
        batch.forEach(feature => {
          if (feature.geometry?.extent) {
            if (!extent) {
              extent = feature.geometry.extent.clone();
            } else {
              extent.union(feature.geometry.extent);
            }
          }
        });
      }

      return {
        features: processedFeatures,
        extent
      };

    } catch (error) {
      console.error('Error processing features:', error);
      throw error;
    }
  }

  private async processFeature(
    feature: __esri.Graphic,
    layer: LayerConfig
  ): Promise<GeospatialFeature | null> {
    try {
      if (!feature.geometry) {
        return null;
      }

      // Convert ArcGIS geometry to GeoJSON geometry object
      const geojsonGeometry = feature.geometry.toJSON() as GeometryObject;
      
      // Ensure the geometry has the required properties
      if (!geojsonGeometry || !geojsonGeometry.type || !geojsonGeometry.coordinates) {
        console.warn('Invalid geometry conversion:', geojsonGeometry);
        return null;
      }

      return {
        id: feature.attributes.OBJECTID || `${layer.id}-${Date.now()}-${Math.random()}`,
        type: 'Feature',
        geometry: geojsonGeometry,
        properties: {
          ...feature.attributes,
          layerId: layer.id,
          layerName: layer.name || '',
          layerType: layer.type || 'unknown'
        }
      };
    } catch (error) {
      console.error('Error processing feature:', error);
      return null;
    }
  }

  /**
   * Process features for field-based data structure where a single layer contains
   * multiple data fields that should be treated as separate "logical" layers
   */
  private async processFieldBasedFeatures(
    features: __esri.Graphic[],
    layer: LayerConfig
  ): Promise<{ features: GeospatialFeature[]; extent: __esri.Extent | null }> {
    try {
      // Process features in batches
      const processedFeatures: GeospatialFeature[] = [];
      let extent: __esri.Extent | null = null;

      // Ensure fieldMappings exists
      const fieldMappings = layer.fieldMappings || {};
      
      for (let i = 0; i < features.length; i += this.options.batchSize) {
        const batch = features.slice(i, i + this.options.batchSize);
        
        const batchResults = await Promise.all(batch.map(feature => 
          this.processFieldBasedFeature(feature, layer, fieldMappings)
        ));

        const validResults = batchResults.filter((f): f is GeospatialFeature => f !== null);
        processedFeatures.push(...validResults);

        // Update extent
        batch.forEach(feature => {
          if (feature.geometry?.extent) {
            if (!extent) {
              extent = feature.geometry.extent.clone();
            } else {
              extent.union(feature.geometry.extent);
            }
          }
        });
      }

      return {
        features: processedFeatures,
        extent
      };

    } catch (error) {
      console.error('Error processing field-based features:', error);
      throw error;
    }
  }

  /**
   * Process a single feature for field-based data structure
   */
  private async processFieldBasedFeature(
    feature: __esri.Graphic,
    layer: LayerConfig,
    fieldMappings: Record<string, string>
  ): Promise<GeospatialFeature | null> {
    try {
      if (!feature.geometry) {
        return null;
      }

      // Convert ArcGIS geometry to GeoJSON geometry object
      const geojsonGeometry = feature.geometry.toJSON() as GeometryObject;
      
      // Ensure the geometry has the required properties
      if (!geojsonGeometry || !geojsonGeometry.type || !geojsonGeometry.coordinates) {
        console.warn('Invalid geometry conversion:', geojsonGeometry);
        return null;
      }

      // Process all mapped fields as properties
      const mappedProperties: Record<string, any> = {};
      
      // Add field mappings as properties with their logical names
      Object.entries(fieldMappings).forEach(([logicalName, fieldName]) => {
        mappedProperties[logicalName] = feature.attributes[fieldName];
      });

      return {
        id: feature.attributes.OBJECTID || `${layer.id}-${Date.now()}-${Math.random()}`,
        type: 'Feature',
        geometry: geojsonGeometry,
        properties: {
          ...feature.attributes,
          ...mappedProperties,
          layerId: layer.id,
          layerName: layer.name || '',
          layerType: layer.type || 'unknown',
          dataStructure: 'field-based'
        }
      };
    } catch (error) {
      console.error('Error processing field-based feature:', error);
      return null;
    }
  }

  clearCache(): void {
    this.processingCache.clear();
  }

  getCacheSize(): number {
    return this.processingCache.size;
  }

  getProcessingStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    this.processingCache.forEach((value, key) => {
      stats[key] = value.metadata.processingTime;
    });
    return stats;
  }
}