import type { LayerConfig } from '../../types/layers';

/**
 * Interface for layer providers that can create and handle different types of layers
 */
export interface LayerProvider {
  /**
   * Determines if this provider can handle the specified layer
   */
  canHandle(layerId: string): boolean;
  
  /**
   * Creates a layer based on the layer configuration and query
   * @param config Layer configuration
   * @param query User query that triggered the layer creation
   * @param options Additional options such as mapView
   * @returns An Esri FeatureLayer
   */
  createLayer(config: LayerConfig, query: string, options?: any): Promise<__esri.FeatureLayer>;
} 