// src/components/map/initializeLayersWithPopups.ts

import { createEnhancedLayer } from '../LayerController/enhancedLayerCreation';
import { applyEnhancedPopups } from '../../utils/popupManager';
import { layers } from '@/config/layers';
import { createProjectConfig } from '@/adapters/layerConfigAdapter';
import { LayerConfig, LayerGroup, ProjectLayerConfig } from '@/types/layers';
import { LayerState } from '@/types/aitools';

/**
 * Initializes all map layers with enhanced popups
 * 
 * @param view The map view
 * @param config The project layer configuration
 * @returns Promise resolving to layer states map
 */
export async function initializeLayersWithPopups(
  view: __esri.MapView,
  config: ProjectLayerConfig
): Promise<Record<string, LayerState>> {
  try {
    console.log('Initializing layers with enhanced popups...');
    
    // Prepare layer groups for popup templates
    const layerGroups: LayerGroup[] = config.groups.map(group => {
      return {
        id: group.id,
        title: group.title,
        description: group.description,
        layers: group.layers?.filter(layer => !!layer) || []
      };
    });
    
    const layerStates: Record<string, LayerState> = {};
    const addedLayers: __esri.FeatureLayer[] = [];
    
    // Initialize each layer with enhanced popups
    for (const group of config.groups) {
      for (const layerConfig of (group.layers || [])) {
        try {
          console.log(`Creating layer: ${layerConfig.name}`);
          
          const [layer, features] = await createEnhancedLayer(layerConfig, layerGroups, view, layerStates);
          
          if (layer) {
            // ADDITIONAL SAFEGUARD: Force visible=false before adding to map
            layer.visible = false;
            console.log(`VISIBILITY_CHECK: Setting initial visibility to false for ${layerConfig.name} before adding to map`);
            
            // Add all layers to the map but ensure they're not visible by default
            view.map.add(layer);
            addedLayers.push(layer);
            
            // Determine if the layer should be visible initially
            const shouldBeVisible = config.defaultVisibility?.[layerConfig.id] || false;
            
            // Explicitly set visibility to false unless specified in defaultVisibility
            layer.visible = shouldBeVisible;
            
            // ADDITIONAL VERIFICATION: Double-check visibility after setting
            setTimeout(() => {
              console.log(`VISIBILITY_CHECK: Layer ${layerConfig.name} actual visibility=${layer.visible}, should be ${shouldBeVisible}`);
              if (layer.visible !== shouldBeVisible) {
                console.warn(`VISIBILITY_CHECK: Mismatch - forcing correct visibility`);
                layer.visible = shouldBeVisible;
              }
            }, 100);
            
            // Log visibility state
            console.log(`Added layer to map: ${layerConfig.name}, visible=${shouldBeVisible}`);
            
            layerStates[layerConfig.id] = {
              layer,
              visible: shouldBeVisible,
              loading: false,
              group: group.id,
              queryResults: {
                features: features.map((f, index) => ({
                  id: f.attributes.OBJECTID || f.attributes.id || `feature-${index}`,
                  type: 'Feature',
                  properties: f.attributes,
                  geometry: f.geometry ? {
                    type: f.geometry.type,
                    coordinates: f.geometry.toJSON().coordinates
                  } : {
                    type: 'point',
                    coordinates: [0, 0]
                  }
                })),
                fields: layer.fields || []
              },
              filters: []
            };
          } else {
            layerStates[layerConfig.id] = {
              layer: null,
              visible: false,
              loading: false,
              error: 'Failed to load layer',
              group: group.id,
              queryResults: {
                features: [],
                fields: []
              },
              filters: []
            };
          }
        } catch (error) {
          console.error(`Error initializing layer ${layerConfig.name}:`, error);
          layerStates[layerConfig.id] = {
            layer: null,
            visible: false,
            loading: false,
            error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            group: group.id,
            queryResults: {
              features: [],
              fields: []
            },
            filters: []
          };
        }
      }
    }

    // Apply correct layer ordering to all layers
    reorderLayers(view.map.layers);
    
    // FINAL VISIBILITY CHECK: Make sure all layers have the correct visibility before applying popups
    console.log('VISIBILITY_CHECK: Final verification before applying popups');
    addedLayers.forEach(layer => {
      const layerId = Object.keys(layerStates).find(id => layerStates[id].layer === layer);
      if (layerId) {
        const shouldBeVisible = layerStates[layerId].visible;
        if (layer.visible !== shouldBeVisible) {
          console.warn(`VISIBILITY_CHECK: Final correction for ${layer.title || layer.id}, forcing visible=${shouldBeVisible}`);
          layer.visible = shouldBeVisible;
        }
      }
    });
    
    // Apply enhanced popups to all layers in the map
    // DISABLED: Let popupEnhancer.ts handle popup templates to avoid conflicts
    // applyEnhancedPopups(view.map.layers, view, layerStates);
    
    console.log('Layer initialization with enhanced popups complete');
    return layerStates;
    
  } catch (error) {
    console.error('Error in layer initialization:', error);
    throw error;
  }
}

/**
 * Reorders layers to ensure proper display (polygons below points)
 */
function reorderLayers(layers: __esri.Collection<__esri.Layer>): void {
  try {
    const pointLayers: __esri.Layer[] = [];
    const otherLayers: __esri.Layer[] = [];

    layers.forEach(layer => {
      if (layer.type === 'feature') {
        const featureLayer = layer as __esri.FeatureLayer;
        if (featureLayer.geometryType === 'point') {
          pointLayers.push(layer);
        } else {
          otherLayers.push(layer);
        }
      } else {
        otherLayers.push(layer);
      }
    });

    layers.removeAll();
    otherLayers.forEach(layer => layers.add(layer));
    pointLayers.forEach(layer => layers.add(layer));
  } catch (error) {
    console.error('Error reordering layers:', error);
  }
}

/**
 * Updates all existing layers with enhanced popups
 */
export function updateAllLayerPopups(view: __esri.MapView, layerStates: Record<string, LayerState>): void {
  try {
    // Apply enhanced popups to all layers
    // DISABLED: Let popupEnhancer.ts handle popup templates to avoid conflicts
    // applyEnhancedPopups(view.map.layers, view, layerStates);
  } catch (error) {
    console.error('Error updating layer popups:', error);
  }
}

/**
 * Utility to toggle label visibility on all layers
 */
export function toggleAllLabels(view: __esri.MapView, visible: boolean): void {
  view.map.layers.forEach(layer => {
    if (layer.type === 'feature') {
      (layer as __esri.FeatureLayer).labelsVisible = visible;
    }
  });
}