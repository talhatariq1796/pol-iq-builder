import { useRef, useEffect, useState } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';

interface RealEstateLayerState {
  activeLayer: FeatureLayer | null;
  soldLayer: FeatureLayer | null;
  propertyGroupLayer: GroupLayer | null;
  isLoading: boolean;
  clusteringEnabled: boolean;
  toggleClustering: () => void;
  toggleLayerVisibility: (layerType: 'active' | 'sold', visible: boolean) => void;
  clustersData: Map<string, any[]>;
}

/**
 * Hook to access real estate layer state externally
 * This provides a way to interact with layers created by RealEstatePointLayerManager
 */
export const useRealEstateLayerState = (mapView?: __esri.MapView): RealEstateLayerState => {
  const [activeLayer, setActiveLayer] = useState<FeatureLayer | null>(null);
  const [soldLayer, setSoldLayer] = useState<FeatureLayer | null>(null);
  const [propertyGroupLayer, setPropertyGroupLayer] = useState<GroupLayer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(true);
  const clustersDataRef = useRef<Map<string, any[]>>(new Map());

  // Find layers in the map
  useEffect(() => {
    if (!mapView) return;

    const findLayers = () => {
      const groupLayer = mapView.map.layers.find(layer => 
        layer.id === 'real-estate-properties-group'
      ) as GroupLayer;

      if (groupLayer) {
        setPropertyGroupLayer(groupLayer);
        
        const activeLyr = groupLayer.layers.find(layer => 
          layer.id === 'active-properties-layer'
        ) as FeatureLayer;
        
        const soldLyr = groupLayer.layers.find(layer => 
          layer.id === 'sold-properties-layer'
        ) as FeatureLayer;

        setActiveLayer(activeLyr || null);
        setSoldLayer(soldLyr || null);
      }
    };

    // Initial search
    findLayers();

    // Listen for layer changes
    const layerWatcher = mapView.map.layers.on('change', findLayers);

    return () => {
      layerWatcher.remove();
    };
  }, [mapView]);

  const toggleClustering = () => {
    setClusteringEnabled(!clusteringEnabled);
    // Note: This requires coordination with RealEstatePointLayerManager
    // Could dispatch custom events here
    window.dispatchEvent(new CustomEvent('toggle-clustering', {
      detail: { enabled: !clusteringEnabled }
    }));
  };

  const toggleLayerVisibility = (layerType: 'active' | 'sold', visible: boolean) => {
    const layer = layerType === 'active' ? activeLayer : soldLayer;
    if (layer) {
      layer.visible = visible;
    }
  };

  return {
    activeLayer,
    soldLayer,
    propertyGroupLayer,
    isLoading,
    clusteringEnabled,
    toggleClustering,
    toggleLayerVisibility,
    clustersData: clustersDataRef.current
  };
};