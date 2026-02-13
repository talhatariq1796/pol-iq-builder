// services/data-retrieval-service.ts
import { 
  GeospatialFeature, 
  DataSourceConfig,
  DataRetrievalService,
  DataRetrievalError,
  LayerConfig
} from '../types/geospatial-ai-types';
import { layers } from '../config/layers';
import { validateLayerOperation } from '../utils/layer-validation';

interface SQLQueryConfig {
  sourceLayerId: string;
  sqlQuery: string;
}

export class ArcGISDataRetrieval implements DataRetrievalService {
  private agentType: string;
  private apiKey: string;
  private retryCount: number = 3;
  private retryDelay: number = 1000;

  constructor(
    agentType: string = 'siteAnalysis',
    apiKey: string = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || ''
  ) {
    if (!apiKey) {
      throw new DataRetrievalError('ArcGIS API key is required');
    }
    
    // Detailed API key logging
    console.log('API Key configuration:', {
      exists: !!apiKey,
      length: apiKey.length,
      prefix: apiKey.substring(0, 4) + '...',
      environment: {
        hasNextPublicKey: !!process.env.NEXT_PUBLIC_ARCGIS_API_KEY,
        nextPublicKeyLength: process.env.NEXT_PUBLIC_ARCGIS_API_KEY?.length || 0
      }
    });

    this.agentType = agentType;
    this.apiKey = apiKey;
  }

  // New method for executing SQL queries
  async executeSQL(sqlConfig: SQLQueryConfig): Promise<GeospatialFeature[]> {
    return this.retryOperation(async () => {
      try {
        // Validate SQL query
        if (!this.validateSQLQuery(sqlConfig.sqlQuery)) {
          throw new DataRetrievalError('Invalid SQL query');
        }

        // Validate layer operation
        const validation = validateLayerOperation(
          this.agentType,
          sqlConfig.sourceLayerId,
          'query'
        );

        if (!validation.valid) {
          throw new DataRetrievalError(
            validation.reason || 'Access validation failed'
          );
        }

        // Create query URL with SQL
        const queryParams = new URLSearchParams({
          where: sqlConfig.sqlQuery,
          outFields: '*',
          f: 'json',
          returnGeometry: 'true',
          token: this.apiKey
        });

        const layer = layers[sqlConfig.sourceLayerId];
        if (!layer) {
          throw new DataRetrievalError(`Invalid layer ID: ${sqlConfig.sourceLayerId}`);
        }

        const baseUrl = layer.url.endsWith('/') ? layer.url.slice(0, -1) : layer.url;
        const queryUrl = `${baseUrl}/query?${queryParams.toString()}`;

        // Execute query
        const response = await this.fetchWithTimeout(queryUrl, {
          method: 'GET'
        });

        if (!response.ok) {
          throw new DataRetrievalError('Failed to query feature service');
        }

        const data = await response.json();

        // Process and return features
        return this.processFeatures(data, layer as unknown as LayerConfig);

      } catch (error) {
        console.error('SQL Query Error:', {
          error,
          sqlQuery: sqlConfig.sqlQuery,
          layerId: sqlConfig.sourceLayerId
        });
        throw error instanceof DataRetrievalError 
          ? error 
          : new DataRetrievalError('Failed to execute SQL query');
      }
    });
  }

  private validateSQLQuery(query: string): boolean {
    // Basic SQL injection prevention
    const blacklistedPatterns = [
      /;\s*DROP/i,
      /;\s*DELETE/i,
      /;\s*INSERT/i,
      /;\s*UPDATE/i,
      /UNION\s+ALL/i,
      /UNION\s+SELECT/i
    ];

    return !blacklistedPatterns.some(pattern => pattern.test(query));
  }

  private constructQueryUrl(config: DataSourceConfig): string {
    if (!config.layerId) {
      throw new DataRetrievalError('Layer ID is required');
    }
    
    const layer = layers[config.layerId] as unknown as LayerConfig;
    if (!layer) {
      throw new DataRetrievalError(`Invalid layer ID: ${config.layerId}`);
    }

    // Define query parameters
    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      outFields: '*',
      returnGeometry: 'true',
      token: this.apiKey
    });

    // Check if this is a trends layer
    const isTrendsLayer = 
      (layer.id && layer.id.toLowerCase().includes('googletrends')) || 
      (layer.metadata?.tags && layer.metadata.tags.includes('trends'));

    // Add layer-specific constraints - don't limit Google Trends layers
    if (layer.performance?.maxFeatures && !isTrendsLayer) {
      params.append('resultRecordCount', layer.performance.maxFeatures.toString());
      console.log(`[constructQueryUrl] Using maxFeatures limit: ${layer.performance.maxFeatures} for layer ${layer.id}`);
    } else if (isTrendsLayer) {
      // For trends layers, request all available features
      console.log(`[constructQueryUrl] Google Trends layer detected. Not limiting result count for ${layer.id}`);
    }

    // Construct the final URL
    const baseUrl = layer.url.endsWith('/') ? layer.url.slice(0, -1) : layer.url;
    return `${baseUrl}/query?${params.toString()}`;
  }

  private async fetchWithTimeout(
    url: string, 
    options: RequestInit = {}, 
    timeout: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete('f');
      urlObj.searchParams.set('f', 'json');
      
      const response = await fetch(urlObj.toString(), {
        ...options,
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>, 
    retries: number = this.retryCount
  ): Promise<T> {
    const delays = [1000, 2000, 3000];

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === retries) throw error;
        await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
      }
    }

    throw new Error('All retry attempts failed');
  }

  async fetchData(config: DataSourceConfig): Promise<GeospatialFeature[]> {
    return this.retryOperation(async () => {
      try {
        const validation = validateLayerOperation(
          this.agentType, 
          config.layerId || '', 
          'query'
        );

        if (!validation.valid) {
          throw new DataRetrievalError(
            validation.reason || 'Access validation failed'
          );
        }

        const queryUrl = this.constructQueryUrl(config);
        const layer = layers[config.layerId || ''] as unknown as LayerConfig;
        const response = await this.fetchWithTimeout(queryUrl, {
          method: 'GET'
        });

        const data = await response.json();
        return this.processFeatures(data, layer);

      } catch (error) {
        throw error instanceof DataRetrievalError 
          ? error 
          : new DataRetrievalError('Failed to fetch data');
      }
    });
  }

  private processFeatures(data: any, layer: LayerConfig): GeospatialFeature[] {
    if (!data.features || !Array.isArray(data.features)) {
      throw new DataRetrievalError('Invalid response format: missing features array');
    }

    // Check if this is a trends layer where we want all features
    const isTrendsLayer = 
      (layer.id && layer.id.toLowerCase().includes('googletrends')) || 
      (layer.metadata?.tags && layer.metadata.tags.includes('trends')) ||
      ((layer.metadata as any)?.isGoogleTrendsLayer === true);

    // For trends layers, use all features without limiting
    if (isTrendsLayer) {
      console.log(`[DataRetrieval] Processing Google Trends layer with ${data.features.length} features (no limit)`);
      
      return data.features.map((feature: any) => {
        // Validate numeric fields for trends data
        const validatedAttributes = { ...feature.attributes };
        if (layer.fields) {
          layer.fields.forEach((field: any) => {
            if (
              field.type === 'single' ||
              field.type === 'double' ||
              field.type === 'long' ||
              field.type === 'small-integer' ||
              field.type === 'big-integer' ||
              field.type === 'integer'
            ) {
              const value = feature.attributes[field.name];
              // Ensure the value is a valid number
              validatedAttributes[field.name] = 
                value !== null && value !== undefined && !isNaN(value) 
                  ? Number(value) 
                  : 0; // Default to 0 for invalid numbers
            }
          });
        }
        
        return {
          id: feature.attributes.ID || feature.attributes.OBJECTID || String(Math.random()),
          geometry: {
            type: this.convertGeometryType(feature.geometry),
            coordinates: this.convertCoordinates(feature.geometry)
          },
          properties: {
            ...validatedAttributes,
            location: feature.attributes.ID
          }
        };
      });
    }

    // For regular layers, apply the normal limit
    const maxFeatures = layer.performance?.maxFeatures || 1000;
    const features = data.features.slice(0, maxFeatures);
    
    console.log(`[DataRetrieval] Processing regular layer with ${features.length} features (limited from ${data.features.length})`);

    return features.map((feature: any) => ({
      id: feature.attributes.ID || feature.attributes.OBJECTID || String(Math.random()),
      geometry: {
        type: this.convertGeometryType(feature.geometry),
        coordinates: this.convertCoordinates(feature.geometry)
      },
      properties: {
        ...feature.attributes,
        location: feature.attributes.ID
      }
    }));
  }

  private convertGeometryType(esriGeometry: any): string {
    if (!esriGeometry) return 'Point';

    const type = esriGeometry.type?.toLowerCase() || 'point';
    
    switch (type) {
      case 'point':
      case 'esrigeometrypoint':
        return 'Point';
      case 'polyline':
      case 'esrigeometrypolyline':
        return 'LineString';
      case 'polygon':
      case 'esrigeometrypolygon':
        return 'Polygon';
      default:
        console.warn('Unknown geometry type:', type);
        return 'Point';
    }
  }

  private convertCoordinates(esriGeometry: any): number[] | number[][] | number[][][] {
    if (!esriGeometry) {
      throw new Error('Invalid geometry: missing geometry data');
    }

    if (esriGeometry.x !== undefined && esriGeometry.y !== undefined) {
      return [esriGeometry.x, esriGeometry.y];
    } else if (esriGeometry.paths) {
      return esriGeometry.paths[0];
    } else if (esriGeometry.rings) {
      return esriGeometry.rings[0];
    }

    throw new Error(`Unsupported geometry structure: ${JSON.stringify(esriGeometry)}`);
  }
}