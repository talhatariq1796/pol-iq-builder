// src/utils/popupEnhancer.ts

import PopupTemplate from "@arcgis/core/PopupTemplate";
import { createEnhancedPopupTemplate } from '../components/map/enhancedPopupTemplate';
import { layers } from '@/config/layers';
import { LayerConfig, LayerGroup, LayerField } from '@/types/layers';
import { LayerField as GeospatialLayerField } from '../types/geospatial-ai-types';
import { LayerField as ConfigLayerField } from '../types/layers';
import { FieldMappingHelper } from './visualizations/field-mapping-helper';

/**
 * Enhances the popups for existing layers without loading or changing their visibility
 * Using a simpler, more robust approach
 * @param view The map view containing loaded layers
 * @param layerGroups The layer groups configuration
 */
export function enhanceExistingLayerPopups(
  view: __esri.MapView,
  layerGroups: LayerGroup[]
): void {
  if (!view || !view.map) {
    console.warn('Cannot enhance popups: No valid map view provided');
    return;
  }

  try {
    // Get all feature layers that are already loaded in the map
    const featureLayers = view.map.allLayers
      .filter(layer => layer.type === 'feature')
      .toArray() as __esri.FeatureLayer[];
    
    if (featureLayers.length === 0) {
      console.log('No feature layers found to enhance popups');
      return;
    }

    console.log(`Enhancing popups for ${featureLayers.length} existing layers`);
    
    // Apply simplified popup templates to each layer
    featureLayers.forEach(layer => {
      try {
        // First try to find by URL, then by name if URL matching fails
        let layerId = null;
        let config = null;
        
        if (layer.url) {
          layerId = getLayerIdFromUrl(layer.url);
          if (layerId && layers[layerId]) {
            config = layers[layerId];
          }
        }
        
        // If URL matching failed, try to find by layer name/title
        if (!config && layer.title) {
          layerId = getLayerIdFromName(layer.title);
          if (layerId && layers[layerId]) {
            config = layers[layerId];
          }
        }
        
        if (!config) {
          console.log(`No configuration found for layer "${layer.title}" - applying fallback popup`);
          // Apply a basic fallback popup instead of skipping
          applyFallbackPopup(layer);
          return;
        }
        
        // Apply a simple, reliable popup template that shows key attributes
        applySimplePopupTemplate(layer, config);
        
        console.log(`Enhanced popup applied to layer: ${layer.title}`);
      } catch (error) {
        console.error(`Error enhancing popup for layer ${layer.title}:`, error);
        // Apply fallback popup to ensure something works
        applyFallbackPopup(layer);
      }
    });
  } catch (error) {
    console.error('Error enhancing layer popups:', error);
  }
}

/**
 * Applies a simple, reliable popup template that shows attributes in a table
 */
function applySimplePopupTemplate(layer: __esri.FeatureLayer, config: LayerConfig): void {
  // Determine title field based on layer type
  const titleField = determineTitleField(config);
  const titleExpression = `{${titleField}}`;
  
  // Create a content array that will show key attributes
  const contentItems = [];
  
  // Add a title and description
  contentItems.push({
    type: "text",
    text: `<h3>${config.name}</h3>`
  });
  
  if (config.description) {
    contentItems.push({
      type: "text",
      text: `<p>${config.description}</p>`
    });
  }
  
  // Add fields display
  contentItems.push({
    type: "fields",
    fieldInfos: createFieldInfos(config.fields || [], titleField)
  });
  
  // Create the popup template
  const template = new PopupTemplate({
    title: titleExpression,
    content: contentItems,
    outFields: ["*"]
  });
  
  // Apply the template and ensure it overrides default behavior
  layer.popupTemplate = template;
  layer.popupEnabled = true;
  
  // Explicitly set outFields to prevent auto-popup behavior
  if (layer.outFields) {
    layer.outFields = ["*"];
  }
  
  // Clear any auto-generated popup template to prevent conflicts
  if ('createPopupTemplate' in layer && typeof layer.createPopupTemplate === 'function') {
    // Override the createPopupTemplate function to prevent auto-generation
    (layer as any).createPopupTemplate = () => template;
  }
  
  // Force the layer to use only our custom popup
  (layer as any).autoGeneratePopupTemplate = false;
}

/**
 * Applies a very basic fallback popup in case of errors
 */
function applyFallbackPopup(layer: __esri.FeatureLayer): void {
  try {
    // Create a simple popup that shows the layer name and basic fields
  const template = new PopupTemplate({
      title: layer.title || "Feature Details",
    content: [
        {
          type: "text",
          text: `<h4>${layer.title || 'Layer Information'}</h4>`
        },
      {
        type: "fields",
          fieldInfos: layer.fields?.slice(0, 10).map(field => ({
          fieldName: field.name,
          label: field.alias || field.name,
            visible: !field.name.toLowerCase().includes('objectid') && 
                     !field.name.toLowerCase().includes('shape__')
        })) || []
      }
    ]
  });
  
  layer.popupTemplate = template;
  layer.popupEnabled = true;
    
    // Explicitly set outFields to prevent auto-popup behavior
    if (layer.outFields) {
      layer.outFields = ["*"];
    }
    
    // Clear any auto-generated popup template to prevent conflicts
    if ('createPopupTemplate' in layer && typeof layer.createPopupTemplate === 'function') {
      // Override the createPopupTemplate function to prevent auto-generation
      (layer as any).createPopupTemplate = () => template;
    }
    
    // Force the layer to use only our custom popup
    (layer as any).autoGeneratePopupTemplate = false;
    
    console.log(`Applied fallback popup to layer: ${layer.title}`);
  } catch (error) {
    console.error(`Failed to apply fallback popup to layer ${layer.title}:`, error);
    // Last resort - disable popups for this layer
    layer.popupEnabled = false;
  }
}

/**
 * Applies label configuration to existing layers without changing visibility
 */
export function applyLayerLabels(view: __esri.MapView, showLabels: boolean): void {
  if (!view || !view.map) return;
  
  try {
    const featureLayers = view.map.allLayers
      .filter(layer => layer.type === 'feature')
      .toArray() as __esri.FeatureLayer[];
    
    featureLayers.forEach(layer => {
      // Only change labelsVisible property, nothing else
      if ('labelsVisible' in layer) {
        layer.labelsVisible = showLabels;
      }
    });
  } catch (error) {
    console.error('Error applying layer labels:', error);
  }
}

/**
 * Helper to find layer ID from URL by matching with known configurations
 */
function getLayerIdFromUrl(url: string): string | null {
  if (!url) return null;
  
  // Normalize URL for comparison
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
  
  // Try matching by pattern if exact match not found
  const urlPattern = /\/FeatureServer\/(\d+)$/;
  const match = normalizedUrl.match(urlPattern);
  
  if (match && match[1]) {
    const layerIndex = parseInt(match[1], 10);
    const baseUrl = normalizedUrl.replace(urlPattern, '');
    
    for (const [id, config] of Object.entries(layers)) {
      if (!config.url) continue;
      
      const configBaseUrl = normalizeUrl(config.url).replace(urlPattern, '');
      if (configBaseUrl === baseUrl) {
        const configMatch = config.url.match(urlPattern);
        if (configMatch && parseInt(configMatch[1], 10) === layerIndex) {
          console.log(`Found pattern-based match: ${id}`);
          return id;
        }
      }
    }
  }
  
  // URL matching failed - this is expected for grouped FeatureServer layers
  return null;
}

/**
 * Helper to find layer ID by matching layer name/title
 */
function getLayerIdFromName(layerName: string): string | null {
  if (!layerName) return null;
  
  // Normalize the layer name for comparison
  const normalizeName = (name: string): string => {
    return name.trim().toLowerCase();
  };
  
  const normalizedName = normalizeName(layerName);
  
  // First pass: exact name match
  for (const [id, config] of Object.entries(layers)) {
    if (normalizeName(config.name) === normalizedName) {
      console.log(`Found exact name match: ${id} for layer "${layerName}"`);
      return id;
    }
  }
  
  // Second pass: check if the layer name contains the config name or vice versa
  for (const [id, config] of Object.entries(layers)) {
    const configName = normalizeName(config.name);
    if (normalizedName.includes(configName) || configName.includes(normalizedName)) {
      console.log(`Found partial name match: ${id} for layer "${layerName}"`);
      return id;
    }
  }
  
  // Name matching failed - layer may not be configured
  return null;
}

// Helper function to convert config field type to geospatial field type
const convertFieldType = (type: string): GeospatialLayerField['type'] => {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
      return 'double';
    case 'date':
      return 'date';
    default:
      return 'string';
  }
};

// Helper function to determine the title field
const determineTitleField = (config: LayerConfig): string => {
  // First try nameField from config
  if (config.nameField) {
    return config.nameField;
  }

  // Then try renderer field
  if (config.rendererField) {
    return config.rendererField;
  }

  // Check configured fields for name-like fields
  if (config.fields) {
    const nameField = config.fields.find(f => 
      /name|title|label/i.test(f.name) || 
      (f.label && /name|title|label/i.test(f.label))
    );
    if (nameField) {
      return nameField.name;
    }
  }

  // Default based on layer type
  return config.type === 'point' ? 'name' : 'ID';
};

export const enhancePopupTemplate = (config: LayerConfig) => {
  const titleField = determineTitleField(config);
  
  return {
    title: `{${titleField}}`,
    content: [{
      type: "fields",
      fieldInfos: createFieldInfos(config.fields || [], titleField)
    }]
  };
};

const createFieldInfos = (fields: LayerField[], titleField: string) => {
  return fields.map(field => ({
    fieldName: field.name,
    label: field.label || FieldMappingHelper.getFriendlyFieldName(field.name) || field.name,
    visible: true,
    format: field.format
  }));
};