/**
 * ClusterManager Stub
 *
 * Minimal stub for the clustering module. The political app doesn't use
 * property clustering, but some legacy real estate components still import it.
 *
 * This stub prevents build errors while the full CMA functionality is deprecated.
 */

export interface ClusterConfig {
  radius: number;
  minPoints: number;
  maxZoom?: number;
  maxZoomLevel?: number;
  extent?: [number, number, number, number];
  strategy?: 'adaptive' | 'grid' | 'density';
  gridSize?: number;
  densityThreshold?: number;
}

export interface ClusterAttributes {
  price?: {
    mean: number;
    min: number;
    max: number;
  };
  [key: string]: any;
}

export interface Cluster {
  id: string;
  count: number;
  features: any[];
  centroid: { x: number; y: number };
  attributes?: ClusterAttributes;
}

export interface ClusterOptions {
  zoom?: number;
  extent?: [number, number, number, number];
}

class ClusterManagerStub {
  async clusterFeatures(
    features: any[],
    config: ClusterConfig,
    options?: ClusterOptions
  ): Promise<Cluster[]> {
    // Return empty clusters - clustering disabled in political app
    // In production, this would return actual cluster data
    console.warn('[ClusterManager] Clustering is disabled in the political app');
    return [];
  }
}

export const clusterManager = new ClusterManagerStub();
export default clusterManager;
