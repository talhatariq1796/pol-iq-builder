import type MapView from '@arcgis/core/views/MapView';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import type { LayerConfig, ProjectLayerConfig, LayerGroup } from '@/types/layers';

export interface LayerState {
  id: string;
  name: string;
  layer: FeatureLayer | GeoJSONLayer | null;
  visible: boolean;
  opacity: number;
  order: number;
  group: string;
  loading: boolean;
  filters: any[];
  isVirtual: boolean;
  active: boolean;
  error?: string;
  subGroup?: string;
  config?: LayerConfig; // Store layer config for lazy loading
}

export interface LayerStatesMap {
  [key: string]: LayerState;
}

export interface LayerControllerRef {
  layerStates: LayerStatesMap;
  isInitialized: boolean;
  setVisibleLayers: (layers: string[]) => void;
  setLayerStates: (states: LayerStatesMap) => void;
  resetLayers: () => void;
}

export interface LayerControllerProps {
  view: MapView;
  config: ProjectLayerConfig;
  onLayerStatesChange?: (states: LayerStatesMap) => void;
  onLayerInitializationProgress?: (progress: { loaded: number; total: number }) => void;
  onInitializationComplete?: () => void;
  visible?: boolean;
}

export const isVirtualLayerConfig = (config: LayerConfig | ProjectLayerConfig): config is ProjectLayerConfig => {
  return 'isVirtual' in config && config.isVirtual === true;
}; 