// src/utils/popupManager.ts

import PopupTemplate from "@arcgis/core/PopupTemplate";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { createEnhancedPopupTemplate } from '../components/map/enhancedPopupTemplate';
import { layers } from '@/config/layers';
import { createProjectConfig } from '@/adapters/layerConfigAdapter';
import { LayerConfig, LayerGroup } from '@/types/layers';

/**
 * Applies enhanced popups to all layers in the map
 * @param mapLayers Collection of feature layers in the map
 * @param view The map view
 * @param layerStates Layer states for enhanced popups
 */
export function applyEnhancedPopups(
  mapLayers: __esri.Collection<__esri.Layer>, 
  view: __esri.MapView,
  layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } }
): void {
  // Check if layerStates is ready
  if (!layerStates || Object.keys(layerStates).length === 0) {
    console.warn('Layer states not ready, skipping popup enhancement');
    return;
  }

  // Get all feature layers from the map
  const featureLayers = (mapLayers.toArray() as __esri.Layer[]).filter(layer => 
    layer.type === 'feature'
  ) as FeatureLayer[];
  
  if (featureLayers.length === 0) {
    console.warn('No feature layers found in map for popup enhancement');
    return;
  }
  
  // Get project config and convert layer groups to format needed by popup template
  const projectLayerConfig = createProjectConfig();
  const layerGroups: LayerGroup[] = projectLayerConfig.groups.map((group: LayerGroup) => {
    return {
      id: group.id,
      title: group.title,
      description: group.description,
      layers: group.layers?.filter((layer: LayerConfig) => !!layer) || [] // Filter out any undefined layers
    };
  });
  
  // Apply enhanced popups to each feature layer
  featureLayers.forEach(featureLayer => {
    try {
      // Find matching layer config
      if (!featureLayer.url) {
        console.warn('Layer has no URL');
        return;
      }
      const layerId = getLayerIdFromUrl(featureLayer.url);
      if (!layerId) {
        console.warn(`Could not find layer ID for URL: ${featureLayer.url}`);
        return;
      }
      
      const layerConfig = layers[layerId];
      if (!layerConfig) {
        console.warn(`Could not find layer config for ID: ${layerId}`);
        return;
      }
      

      
      // Create and apply enhanced popup template
      const popupTemplate = createEnhancedPopupTemplate(layerConfig, layerGroups, view, layerStates);
      featureLayer.popupTemplate = popupTemplate;
    } catch (error) {
      console.error(`Error applying enhanced popup to layer ${featureLayer.title}:`, error);
    }
  });
}

/**
 * Extracts layer ID from layer URL by matching against known layer URLs
 */
function getLayerIdFromUrl(url: string): string | null {
  if (!url) return null;

  // Normalize URL for comparison (remove trailing slashes, etc.)
  const normalizeUrl = (urlString: string): string => {
    return urlString.trim().replace(/\/+$/, '');
  };
  
  const normalizedUrl = normalizeUrl(url);
  
  // First pass: check for exact match with active layers
  const matches: string[] = [];
  const potentialMatches: {id: string, status: string, isPrimary?: boolean}[] = [];
  
  for (const [id, config] of Object.entries(layers)) {
    if (normalizeUrl(config.url) === normalizedUrl) {
      potentialMatches.push({
        id,
        status: config.status,
        isPrimary: config.isPrimary
      });
      
      // If we find an exact match with an active, primary layer, prioritize it
      if (config.status === 'active' && config.isPrimary) {
        console.log(`Found exact URL match with primary layer: ${id}`);
        return id;
      }
      
      // Otherwise add to matches for further filtering
      matches.push(id);
    }
  }
  
  // If we have matches, prioritize them
  if (matches.length > 0) {
    console.log(`Found ${matches.length} layers matching URL: ${normalizedUrl}`, potentialMatches);
    
    // Prioritize active layers
    const activeMatches = matches.filter(id => layers[id].status === 'active');
    if (activeMatches.length > 0) {
      // If FED_data is among active matches, prioritize it
      if (activeMatches.includes('FED_data')) {
        console.log('Prioritizing FED_data layer from active matches');
        return 'FED_data';
      }
      
      console.log(`Returning first active match: ${activeMatches[0]}`);
      return activeMatches[0];
    }
    
    console.log(`Returning first match: ${matches[0]}`);
    return matches[0];
  }
  
  // If exact match not found, try matching by service name pattern
  // Example: https://services8.arcgis.com/.../FeatureServer/5
  const urlPattern = /\/FeatureServer\/(\d+)$/;
  const match = normalizedUrl.match(urlPattern);
  
  if (match && match[1]) {
    const layerIndex = parseInt(match[1], 10);
    
    // Get base URL without the layer index
    const baseUrl = normalizedUrl.replace(urlPattern, '');
    
    // Find layers with matching base URL and check index
    for (const [id, config] of Object.entries(layers)) {
      if (!config.url) continue;
      
      const configBaseUrl = normalizeUrl(config.url).replace(urlPattern, '');
      if (configBaseUrl === baseUrl) {
        // Try to extract index from config URL
        const configMatch = config.url.match(urlPattern);
        if (configMatch && parseInt(configMatch[1], 10) === layerIndex) {
          console.log(`Found pattern-based match: ${id}`);
          return id;
        }
      }
    }
  }
  
  console.warn(`No matching layer found for URL: ${normalizedUrl}`);
  return null;
}