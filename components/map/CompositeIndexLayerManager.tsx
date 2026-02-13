/**
 * Component to manage client-side composite index layers
 * Integrates with the LayerList widget to show calculated composite indexes
 */

import React, { useEffect, useRef } from 'react';
import { CompositeIndexLayerService } from '@/lib/services/CompositeIndexLayerService';
import { compositeIndexLayerConfigs } from '@/config/layers_housing_2025';
import type { ClientSideCompositeLayerConfig } from '@/types/layers';

interface CompositeIndexLayerManagerProps {
  view: __esri.MapView;
  visible: boolean;
  baseHousingLayer?: __esri.FeatureLayer; // Reference to the housing layer for geometry
}

export default function CompositeIndexLayerManager({ 
  view, 
  visible, 
  baseHousingLayer 
}: CompositeIndexLayerManagerProps) {
  const layerServiceRef = useRef<CompositeIndexLayerService | null>(null);
  const createdLayersRef = useRef<Map<string, __esri.FeatureLayer>>(new Map());

  useEffect(() => {
    if (!view || !baseHousingLayer) return;

    // Initialize the layer service
    layerServiceRef.current = new CompositeIndexLayerService(baseHousingLayer);

    // Create composite index layers when visible
    if (visible) {
      createCompositeIndexLayers();
    } else {
      removeCompositeIndexLayers();
    }

    return () => {
      removeCompositeIndexLayers();
    };
  }, [view, visible, baseHousingLayer]);

  const createCompositeIndexLayers = async () => {
    if (!layerServiceRef.current || !view) return;

    console.log('[CompositeIndexLayerManager] Creating composite index layers...');

    try {
      // Create all composite index layers
      const layers = await layerServiceRef.current.createAllCompositeIndexLayers();
      
      // Add to map and track
      layers.forEach((layer, index) => {
        const config = compositeIndexLayerConfigs[index] as ClientSideCompositeLayerConfig;
        
        // Configure layer properties from config
        layer.title = config.name;
        layer.visible = config.visible ?? true;
        layer.listMode = config.skipLayerList ? 'hide' : 'show';
        
        // Add to map
        view.map.add(layer);
        
        // Track created layer
        createdLayersRef.current.set(config.id, layer);
        
        console.log(`[CompositeIndexLayerManager] Created layer: ${config.name}`);
      });

    } catch (error) {
      console.error('[CompositeIndexLayerManager] Error creating composite index layers:', error);
    }
  };

  const removeCompositeIndexLayers = () => {
    if (!view) return;

    console.log('[CompositeIndexLayerManager] Removing composite index layers...');
    
    // Remove all tracked layers from map
    createdLayersRef.current.forEach((layer, layerId) => {
      try {
        view.map.remove(layer);
        console.log(`[CompositeIndexLayerManager] Removed layer: ${layerId}`);
      } catch (error) {
        console.error(`[CompositeIndexLayerManager] Error removing layer ${layerId}:`, error);
      }
    });

    // Clear tracking
    createdLayersRef.current.clear();
  };

  const toggleLayerVisibility = (layerId: string, visible: boolean) => {
    const layer = createdLayersRef.current.get(layerId);
    if (layer) {
      layer.visible = visible;
    }
  };

  const getCreatedLayer = (layerId: string): __esri.FeatureLayer | undefined => {
    return createdLayersRef.current.get(layerId);
  };

  // Expose methods for external control
  useEffect(() => {
    // Attach methods to window for debugging or external access
    (window as any).compositeIndexLayerManager = {
      toggleLayer: toggleLayerVisibility,
      getLayer: getCreatedLayer,
      recreateLayers: createCompositeIndexLayers,
      removeLayers: removeCompositeIndexLayers
    };
  }, []);

  // This component doesn't render any UI - it's purely for layer management
  return null;
}