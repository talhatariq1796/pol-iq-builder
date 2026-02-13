import { LayerConfig } from '../types/layers';
import { layers } from '../config/layers';
import { layerStateManager } from './layer-state-manager';

export interface QueryResult {
  features: any[];
  metadata: {
    totalFeatures: number;
    layers: string[];
    executionTime: number;
    spatialExtent?: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
  };
}

export interface QueryOptions {
  spatialFilter?: {
    geometry: any;
    spatialRel: 'intersects' | 'contains' | 'within' | 'touches';
  };
  temporalFilter?: {
    startDate: Date;
    endDate: Date;
  };
  attributeFilter?: {
    field: string;
    operator: '=' | '>' | '<' | '>=' | '<=' | '!=' | 'like' | 'in';
    value: any;
  }[];
  maxFeatures?: number;
  outFields?: string[];
  groupBy?: string[];
  orderBy?: {
    field: string;
    order: 'asc' | 'desc';
  }[];
}

export class QueryAnalyzer {
  private static instance: QueryAnalyzer;
  private queryCache: Map<string, QueryResult>;

  private constructor() {
    this.queryCache = new Map();
  }

  public static getInstance(): QueryAnalyzer {
    if (!QueryAnalyzer.instance) {
      QueryAnalyzer.instance = new QueryAnalyzer();
    }
    return QueryAnalyzer.instance;
  }

  public async executeQuery(
    layerIds: string[],
    options: QueryOptions
  ): Promise<QueryResult> {
    const startTime = performance.now();
    const queryKey = this.generateQueryKey(layerIds, options);

    // Check cache first
    if (this.queryCache.has(queryKey)) {
      return this.queryCache.get(queryKey)!;
    }

    const results: any[] = [];
    const layerResults = await Promise.all(
      layerIds.map(layerId => this.queryLayer(layerId, options))
    );

    // Combine results from all layers
    layerResults.forEach(layerResult => {
      results.push(...layerResult);
    });

    // Apply grouping if specified
    let processedResults = results;
    if (options.groupBy) {
      processedResults = this.groupResults(results, options.groupBy);
    }

    // Apply ordering if specified
    if (options.orderBy) {
      processedResults = this.orderResults(processedResults, options.orderBy);
    }

    // Apply max features limit
    if (options.maxFeatures) {
      processedResults = processedResults.slice(0, options.maxFeatures);
    }

    const result: QueryResult = {
      features: processedResults,
      metadata: {
        totalFeatures: processedResults.length,
        layers: layerIds,
        executionTime: performance.now() - startTime,
        spatialExtent: this.calculateSpatialExtent(processedResults)
      }
    };

    // Cache the result
    this.queryCache.set(queryKey, result);
    return result;
  }

  private async queryLayer(
    layerId: string,
    options: QueryOptions
  ): Promise<any[]> {
    const layer = layers[layerId];
    if (!layer) {
      throw new Error(`Layer ${layerId} not found`);
    }

    // Check layer access permissions
    if (!layerStateManager.getLayerState(layerId)?.visible) {
      return [];
    }

    // Construct query parameters
    const queryParams = new URLSearchParams();
    
    // Add spatial filter if specified
    if (options.spatialFilter) {
      queryParams.append('geometry', JSON.stringify(options.spatialFilter.geometry));
      queryParams.append('spatialRel', options.spatialFilter.spatialRel);
    }

    // Add temporal filter if specified
    if (options.temporalFilter) {
      queryParams.append('time', `${options.temporalFilter.startDate.toISOString()},${options.temporalFilter.endDate.toISOString()}`);
    }

    // Add attribute filters if specified
    if (options.attributeFilter) {
      const whereClause = this.buildWhereClause(options.attributeFilter);
      queryParams.append('where', whereClause);
    }

    // Add output fields if specified
    if (options.outFields) {
      queryParams.append('outFields', options.outFields.join(','));
    }

    // Execute the query
    try {
      const response = await fetch(`${layer.url}/query?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Query failed for layer ${layerId}`);
      }
      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error(`Error querying layer ${layerId}:`, error);
      return [];
    }
  }

  private buildWhereClause(filters: QueryOptions['attributeFilter']): string {
    if (!filters || filters.length === 0) return '1=1';

    return filters.map(filter => {
      const { field, operator, value } = filter;
      const formattedValue = typeof value === 'string' ? `'${value}'` : value;
      return `${field} ${operator} ${formattedValue}`;
    }).join(' AND ');
  }

  private groupResults(results: any[], groupBy: string[]): any[] {
    const groups = new Map<string, any[]>();

    results.forEach(result => {
      const groupKey = groupBy.map(field => result.attributes[field]).join('|');
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(result);
    });

    return Array.from(groups.entries()).map(([key, features]) => ({
      groupKey: key,
      features,
      count: features.length
    }));
  }

  private orderResults(
    results: any[],
    orderBy: QueryOptions['orderBy']
  ): any[] {
    if (!orderBy || orderBy.length === 0) return results;

    return [...results].sort((a, b) => {
      for (const { field, order } of orderBy) {
        const aValue = a.attributes[field];
        const bValue = b.attributes[field];

        if (aValue < bValue) return order === 'asc' ? -1 : 1;
        if (aValue > bValue) return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private calculateSpatialExtent(features: any[]): QueryResult['metadata']['spatialExtent'] {
    if (!features.length) return undefined;

    let xmin = Infinity;
    let ymin = Infinity;
    let xmax = -Infinity;
    let ymax = -Infinity;

    features.forEach(feature => {
      if (feature.geometry) {
        const { x, y } = feature.geometry;
        xmin = Math.min(xmin, x);
        ymin = Math.min(ymin, y);
        xmax = Math.max(xmax, x);
        ymax = Math.max(ymax, y);
      }
    });

    return { xmin, ymin, xmax, ymax };
  }

  private generateQueryKey(layerIds: string[], options: QueryOptions): string {
    return JSON.stringify({
      layers: layerIds,
      options
    });
  }

  public clearCache(): void {
    this.queryCache.clear();
  }
}

export const queryAnalyzer = QueryAnalyzer.getInstance(); 