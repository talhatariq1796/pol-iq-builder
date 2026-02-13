// src/config/layers/index.ts

// Re-export all types from types/layers.ts
export * from '../../types/layers';

// Re-export all configurations from config/layers.ts
export { 
  layers,
  concepts,
  getLayerConfigById
} from '../layers';

// Export layerGroups from adapter
import { createProjectConfig } from '../../adapters/layerConfigAdapter';
export const layerGroups = createProjectConfig().groups; 