import { LayerProvider } from './base-layer-provider';
import { StandardLayerProvider } from './standard-layer-provider';

// Export all provider types
export * from './base-layer-provider';
export * from './standard-layer-provider';

/**
 * Registry of layer providers in priority order
 * The StandardLayerProvider will handle all layers including Google Trends
 */
export const layerProviders: LayerProvider[] = [
  new StandardLayerProvider(),
  // Add more providers as needed
];

/**
 * Get a provider that can handle the specified layer ID
 */
export function getProviderForLayer(layerId: string): LayerProvider {
  const provider = layerProviders.find(p => p.canHandle(layerId));
  
  if (!provider) {
    throw new Error(`No provider found for layer: ${layerId}`);
  }
  
  return provider;
} 