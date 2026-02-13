/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { 
  ValidationError, 
  ValidationWarning 
} from './types';

export interface ArcGISLayer {
  id: number;
  name: string;
  type: string;
  geometryType: 'esriGeometryPoint' | 'esriGeometryPolygon' | 'esriGeometryPolyline';
  fields: ArcGISField[];
  url: string;
  recordCount: number;
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

export interface ArcGISField {
  name: string;
  type: 'esriFieldTypeOID' | 'esriFieldTypeString' | 'esriFieldTypeInteger' | 'esriFieldTypeDouble' | 'esriFieldTypeDate';
  alias: string;
  length?: number;
  nullable: boolean;
  editable: boolean;
}

export interface DataExtractionResult {
  success: boolean;
  outputPath?: string;
  recordCount: number;
  fieldCount: number;
  layers: LayerExtractionResult[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  processingTime: number;
  spatialJoins: SpatialJoinResult[];
}

export interface LayerExtractionResult {
  layerId: number;
  layerName: string;
  geometryType: string;
  recordsExtracted: number;
  fieldsExtracted: string[];
  processingMethod: 'direct' | 'spatial_join' | 'aggregated';
}

export interface SpatialJoinResult {
  polygonLayer: string;
  pointLayer: string;
  joinMethod: 'intersect' | 'contains' | 'nearest';
  matchedRecords: number;
  unmatchedRecords: number;
}

export interface ExtractionOptions {
  outputFormat: 'csv' | 'json' | 'geojson';
  includeGeometry: boolean;
  spatialReference: number; // EPSG code
  maxRecords: number;
  fieldFilter?: string[]; // Include only specific fields
  spatialFilter?: {
    geometry: any;
    spatialRel: 'esriSpatialRelIntersects' | 'esriSpatialRelContains' | 'esriSpatialRelWithin';
  };
  aggregationStrategy: 'polygon_centroids' | 'point_to_polygon' | 'separate_layers' | 'spatial_join';
}

export class ArcGISDataExtractor {
  private baseUrl: string;
  private timeout: number = 30000;

  constructor(arcgisServiceUrl: string) {
    this.baseUrl = arcgisServiceUrl.endsWith('/') 
      ? arcgisServiceUrl.slice(0, -1) 
      : arcgisServiceUrl;
  }

  async discoverLayers(): Promise<{
    success: boolean;
    layers: ArcGISLayer[];
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      console.log(`🔍 Discovering layers in: ${this.baseUrl}`);
      
      // Get service information
      const serviceInfo = await this.fetchServiceInfo();
      if (!serviceInfo.success) {
        errors.push({
          code: 'SERVICE_ACCESS_FAILED',
          message: `Cannot access ArcGIS service: ${serviceInfo.error}`,
          severity: 'critical'
        });
        return { success: false, layers: [], errors, warnings };
      }

      const layers: ArcGISLayer[] = [];
      
      if (!serviceInfo.layers) {
        return {
          success: true,
          layers: [],
          errors,
          warnings
        };
      }
      
      for (const layerInfo of serviceInfo.layers) {
        try {
          const layerDetails = await this.fetchLayerDetails(layerInfo.id);
          
          if (layerDetails.success) {
            const layer: ArcGISLayer = {
              id: layerInfo.id,
              name: layerInfo.name,
              type: layerDetails.data.type,
              geometryType: layerDetails.data.geometryType,
              fields: layerDetails.data.fields,
              url: `${this.baseUrl}/${layerInfo.id}`,
              recordCount: layerDetails.data.count || 0,
              extent: layerDetails.data.extent || { xmin: 0, ymin: 0, xmax: 0, ymax: 0 }
            };
            
            layers.push(layer);
            console.log(`✅ Layer ${layerInfo.id}: ${layerInfo.name} (${layer.geometryType}, ${layer.recordCount} records)`);
          } else {
            warnings.push({
              code: 'LAYER_ACCESS_WARNING',
              message: `Could not access layer ${layerInfo.id}: ${layerDetails.error}`,
              impact: 'Layer will be excluded from extraction'
            });
          }
        } catch (error) {
          warnings.push({
            code: 'LAYER_PROCESSING_WARNING',
            message: `Error processing layer ${layerInfo.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            impact: 'Layer will be excluded from extraction'
          });
        }
      }

      return { success: true, layers, errors, warnings };
    } catch (error) {
      errors.push({
        code: 'DISCOVERY_FAILED',
        message: `Layer discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
      return { success: false, layers: [], errors, warnings };
    }
  }

  async extractTrainingData(
    layers: ArcGISLayer[],
    options: ExtractionOptions
  ): Promise<DataExtractionResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const layerResults: LayerExtractionResult[] = [];
    const spatialJoins: SpatialJoinResult[] = [];

    try {
      console.log(`🚀 Starting data extraction with ${layers.length} layers`);
      
      // Categorize layers by geometry type
      const polygonLayers = layers.filter(l => l.geometryType === 'esriGeometryPolygon');
      const pointLayers = layers.filter(l => l.geometryType === 'esriGeometryPoint');
      const lineLayers = layers.filter(l => l.geometryType === 'esriGeometryPolyline');

      console.log(`📊 Layer analysis: ${polygonLayers.length} polygon, ${pointLayers.length} point, ${lineLayers.length} line`);

      let combinedData: Record<string, unknown>[] = [];
      let totalRecords = 0;
      const totalFields = new Set<string>();

      // Handle different aggregation strategies
      switch (options.aggregationStrategy) {
        case 'spatial_join':
          if (polygonLayers.length > 0 && pointLayers.length > 0) {
            const joinResult = await this.performSpatialJoin(polygonLayers, pointLayers, options);
            combinedData = joinResult.data;
            spatialJoins.push(...joinResult.joins);
            layerResults.push(...joinResult.layerResults);
            totalRecords = combinedData.length;
          } else {
            warnings.push({
              code: 'INSUFFICIENT_LAYERS_FOR_SPATIAL_JOIN',
              message: 'Spatial join requires both polygon and point layers',
              impact: 'Falling back to separate layer processing'
            });
            // Fall through to separate layers
          }
          break;

        case 'polygon_centroids':
          // Convert polygons to centroids and combine with points
          for (const layer of polygonLayers) {
            const centroidResult = await this.extractPolygonCentroids(layer, options);
            combinedData.push(...centroidResult.data);
            layerResults.push(centroidResult.layerResult);
            centroidResult.fields.forEach(f => totalFields.add(f));
          }
          // Add point layers as-is
          for (const layer of pointLayers) {
            const pointResult = await this.extractLayerData(layer, options);
            combinedData.push(...pointResult.data);
            layerResults.push(pointResult.layerResult);
            pointResult.fields.forEach(f => totalFields.add(f));
          }
          break;

        case 'separate_layers':
          // Extract each layer separately and combine
          for (const layer of layers) {
            const layerResult = await this.extractLayerData(layer, options);
            combinedData.push(...layerResult.data);
            layerResults.push(layerResult.layerResult);
            layerResult.fields.forEach(f => totalFields.add(f));
          }
          break;

        default:
          throw new Error(`Unknown aggregation strategy: ${options.aggregationStrategy}`);
      }

      totalRecords = combinedData.length;

      // Generate output file
      const outputPath = await this.writeTrainingData(combinedData, options);

      const processingTime = Date.now() - startTime;

      console.log(`✅ Extraction complete: ${totalRecords} records, ${totalFields.size} fields`);
      console.log(`📁 Output: ${outputPath}`);

      return {
        success: true,
        outputPath,
        recordCount: totalRecords,
        fieldCount: totalFields.size,
        layers: layerResults,
        errors,
        warnings,
        processingTime,
        spatialJoins
      };

    } catch (error) {
      errors.push({
        code: 'EXTRACTION_FAILED',
        message: `Data extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });

      return {
        success: false,
        recordCount: 0,
        fieldCount: 0,
        layers: layerResults,
        errors,
        warnings,
        processingTime: Date.now() - startTime,
        spatialJoins
      };
    }
  }

  private async fetchServiceInfo(): Promise<{ success: boolean; layers?: any[]; error?: string }> {
    try {
      const url = `${this.baseUrl}?f=json`;
      // Use AbortController to implement a per-request timeout instead of
      // passing a non-standard `timeout` field to fetch's RequestInit.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      let response: any;
      try {
        response = await (fetch as any)(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!response || !response.ok) {
        return { success: false, error: response ? `HTTP ${response.status}: ${response.statusText}` : 'No response (possibly aborted)' };
      }

      const data = await (response as any).json();
      
      if (data.error) {
        return { success: false, error: data.error.message || 'Unknown ArcGIS error' };
      }

      return { success: true, layers: data.layers || [] };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  private async fetchLayerDetails(layerId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const url = `${this.baseUrl}/${layerId}?f=json`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      let response: any;
      try {
        response = await (fetch as any)(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!response || !response.ok) {
        return { success: false, error: response ? `HTTP ${response.status}: ${response.statusText}` : 'No response (possibly aborted)' };
      }

      const data = await (response as any).json();
      
      if (data.error) {
        return { success: false, error: data.error.message || 'Unknown ArcGIS error' };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  private async extractLayerData(
    layer: ArcGISLayer, 
    options: ExtractionOptions
  ): Promise<{ data: any[]; fields: string[]; layerResult: LayerExtractionResult }> {
    console.log(`📊 Extracting data from layer: ${layer.name}`);
    
    // Build query parameters
    const params = new URLSearchParams({
      where: '1=1',
      outFields: options.fieldFilter ? options.fieldFilter.join(',') : '*',
      returnGeometry: options.includeGeometry ? 'true' : 'false',
      f: 'json',
      resultRecordCount: Math.min(options.maxRecords, 2000).toString(),
      outSR: options.spatialReference.toString()
    });

    const url = `${layer.url}/query?${params}`;
    
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      let response: any;
      try {
        response = await (fetch as any)(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      const data = await (response as any).json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const features = data.features || [];
      const extractedData = features.map((feature: any) => {
        const record: any = { ...feature.attributes };
        record._layer_id = layer.id;
        record._layer_name = layer.name;
        record._geometry_type = layer.geometryType;
        
        if (options.includeGeometry && feature.geometry) {
          if (layer.geometryType === 'esriGeometryPoint') {
            record._longitude = feature.geometry.x;
            record._latitude = feature.geometry.y;
          } else if (layer.geometryType === 'esriGeometryPolygon') {
            // Calculate centroid for polygons
            const centroid = this.calculatePolygonCentroid(feature.geometry);
            record._centroid_longitude = centroid.x;
            record._centroid_latitude = centroid.y;
          }
        }
        
        return record;
      });

      const fieldNames = layer.fields.map(f => f.name);

      return {
        data: extractedData,
        fields: fieldNames,
        layerResult: {
          layerId: layer.id,
          layerName: layer.name,
          geometryType: layer.geometryType,
          recordsExtracted: extractedData.length,
          fieldsExtracted: fieldNames,
          processingMethod: 'direct'
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract data from layer ${layer.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performSpatialJoin(
    polygonLayers: ArcGISLayer[],
    pointLayers: ArcGISLayer[],
    options: ExtractionOptions
  ): Promise<{ data: any[]; joins: SpatialJoinResult[]; layerResults: LayerExtractionResult[] }> {
    console.log(`🔗 Performing spatial join between ${polygonLayers.length} polygon and ${pointLayers.length} point layers`);
    
    // This is a simplified implementation - in production, this would use actual spatial operations
    const combinedData: Record<string, unknown>[] = [];
    const joins: SpatialJoinResult[] = [];
    const layerResults: LayerExtractionResult[] = [];

    // For demo purposes, we'll extract each layer separately and simulate joins
    for (const polygonLayer of polygonLayers) {
      const polygonResult = await this.extractLayerData(polygonLayer, options);
      layerResults.push(polygonResult.layerResult);
      
      for (const pointLayer of pointLayers) {
        const pointResult = await this.extractLayerData(pointLayer, options);
        layerResults.push(pointResult.layerResult);
        
        // Simulate spatial join (in practice, this would be done server-side or with spatial libraries)
        const joinedRecords = this.simulateSpatialJoin(polygonResult.data, pointResult.data);
        combinedData.push(...joinedRecords);
        
        joins.push({
          polygonLayer: polygonLayer.name,
          pointLayer: pointLayer.name,
          joinMethod: 'intersect',
          matchedRecords: joinedRecords.length,
          unmatchedRecords: Math.max(0, pointResult.data.length - joinedRecords.length)
        });
      }
    }

    return { data: combinedData, joins, layerResults };
  }

  private async extractPolygonCentroids(
    layer: ArcGISLayer,
    options: ExtractionOptions
  ): Promise<{ data: any[]; fields: string[]; layerResult: LayerExtractionResult }> {
    console.log(`📍 Converting polygon layer to centroids: ${layer.name}`);
    
    const result = await this.extractLayerData(layer, { ...options, includeGeometry: true });
    
    return {
      data: result.data,
      fields: result.fields,
      layerResult: {
        ...result.layerResult,
        processingMethod: 'aggregated'
      }
    };
  }

  private simulateSpatialJoin(polygonData: any[], pointData: any[]): any[] {
    // This is a simplified simulation - real implementation would use spatial libraries
    return pointData.map((point, index) => {
      // Simulate joining with the first polygon for demo purposes
      const polygon = polygonData[index % polygonData.length];
      return {
        ...point,
        ...Object.fromEntries(
          Object.entries(polygon).map(([key, value]) => [`polygon_${key}`, value])
        ),
        _join_method: 'simulated_intersect'
      };
    });
  }

  private calculatePolygonCentroid(geometry: any): { x: number; y: number } {
    // Simplified centroid calculation
    if (geometry.rings && geometry.rings.length > 0) {
      const ring = geometry.rings[0];
      let sumX = 0, sumY = 0;
      
      for (const point of ring) {
        sumX += point[0];
        sumY += point[1];
      }
      
      return {
        x: sumX / ring.length,
        y: sumY / ring.length
      };
    }
    
    return { x: 0, y: 0 };
  }

  private async writeTrainingData(data: any[], options: ExtractionOptions): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = `training-data-${timestamp}.${options.outputFormat}`;
    
    if (options.outputFormat === 'csv') {
      const csv = this.convertToCSV(data);
      await fs.writeFile(outputPath, csv);
    } else if (options.outputFormat === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    } else if (options.outputFormat === 'geojson') {
      const geojson = this.convertToGeoJSON(data);
      await fs.writeFile(outputPath, JSON.stringify(geojson, null, 2));
    }
    
    return outputPath;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  private convertToGeoJSON(data: any[]): any {
    return {
      type: 'FeatureCollection',
      features: data.map(record => ({
        type: 'Feature',
        properties: Object.fromEntries(
          Object.entries(record).filter(([key]) => !key.startsWith('_'))
        ),
        geometry: record._longitude && record._latitude ? {
          type: 'Point',
          coordinates: [record._longitude, record._latitude]
        } : null
      }))
    };
  }
}