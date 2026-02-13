/**
 * Clustering Types
 *
 * Stub types for clustering module (not used in political app).
 */

export interface GeospatialFeature {
  id: string | number;
  geometry: GeoJSON.Geometry | { type: string; coordinates: any };
  properties: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  type?: string;
}

export interface ClusterBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ClusterResult {
  clusters: Array<{
    id: string;
    features: GeospatialFeature[];
    centroid: [number, number];
    count: number;
  }>;
  unclustered: GeospatialFeature[];
}
