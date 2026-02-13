import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import SceneView from '@arcgis/core/views/SceneView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import { createFedDataVisualization } from './createFedDataVisualization';
import { BaseLayerConfig, LayerMetadata } from '../../types/layers';

// Type definition for the view with goTo method
type ViewWithGoTo = MapView | SceneView;

interface GeographyLayerGroup {
  [key: string]: FeatureLayer[];
}

// Add window interface definition to make TypeScript happy
declare global {
  interface Window {
    layerUtils?: {
      loadLayers?: () => Promise<FeatureLayer[]>;
    };
  }
}

/**
 * Gets all available layers from the global utility if available
 */
async function getLayers(): Promise<FeatureLayer[]> {
  if (window.layerUtils?.loadLayers) {
    return window.layerUtils.loadLayers();
  }
  return [];
}

/**
 * Handle a cross-geography query by creating appropriate visualizations 
 * comparing data across different geography types
 */
export async function handleCrossGeographyQuery(
  query: string, 
  map: Map, 
  view: ViewWithGoTo
): Promise<boolean> {
  console.log('Processing cross-geography query:', query);
  
  // Get all layers from the map
  const mapLayers = map.layers.toArray().filter((l): l is FeatureLayer => l instanceof FeatureLayer);
  console.log('Found layers:', mapLayers.map(l => l.title));
  
  // Detect if this is a cross-geography comparison by checking layer metadata
  const layersWithDifferentGeographies = detectDifferentGeographyLayers(mapLayers);
  
  if (!layersWithDifferentGeographies) {
    console.log('No suitable layers found for cross-geography comparison');
    return false;
  }
  
  const { primaryLayer, comparisonLayer } = layersWithDifferentGeographies;
  console.log('Selected layers for comparison:', {
    primary: primaryLayer.title,
    comparison: comparisonLayer.title
  });
  
  // Extract fields for comparison based on layer metadata and attributes
  const { primaryField, comparisonField } = await extractFieldsFromLayers(primaryLayer, comparisonLayer);
  
  if (!primaryField || !comparisonField) {
    console.log('Could not determine fields for comparison');
    return false;
  }
  
  console.log('Selected fields:', { primaryField, comparisonField });
  
  // Create the cross-geography visualization
  const resultLayer = await createFedDataVisualization({
    primaryLayer,
    primaryField,
    comparisonLayer,
    comparisonField,
    displayAsPrimary: shouldDisplayAsPrimary(primaryLayer, comparisonLayer),
    visOptions: {
      opacity: 0.8,
      visible: true
    }
  });
  
  if (!resultLayer) {
    console.log('Failed to create cross-geography visualization');
    return false;
  }
  
  // Add the layer to the map and zoom to it
  map.add(resultLayer);
  
  if (resultLayer.fullExtent) {
    view.goTo(resultLayer.fullExtent);
  }
  
  console.log('Successfully created cross-geography visualization');
  return true;
}

/**
 * Detects if there are layers with different geographic levels that can be compared
 */
export function detectDifferentGeographyLayers(layers: FeatureLayer[]): { 
  primaryLayer: FeatureLayer; 
  comparisonLayer: FeatureLayer; 
} | null {
  // Group layers by their geographic level
  const layersByGeography: GeographyLayerGroup = {};
  
  for (const layer of layers) {
    if (!layer.loaded || !layer.title) continue;

    const geographicLevel = getGeographicLevel(layer);
    if (geographicLevel) {
      layersByGeography[geographicLevel] = layersByGeography[geographicLevel] || [];
      layersByGeography[geographicLevel].push(layer);
    }
  }
  
  const geographyLevels = Object.keys(layersByGeography);
  if (geographyLevels.length < 2) {
    return null;
  }
  
  // Find two layers with different geographic levels that can be compared
  for (let i = 0; i < geographyLevels.length; i++) {
    for (let j = i + 1; j < geographyLevels.length; j++) {
      const level1 = geographyLevels[i];
      const level2 = geographyLevels[j];
      
      const layer1 = layersByGeography[level1]?.[0];
      const layer2 = layersByGeography[level2]?.[0];
      
      if (layer1 && layer2 && canCompareGeographies(layer1, layer2)) {
        return {
          primaryLayer: layer1,
          comparisonLayer: layer2
        };
      }
    }
  }
  
  return null;
}

/**
 * Gets the geographic level of a layer from its metadata
 */
export function getGeographicLevel(layer: FeatureLayer): string | null {
  const config = (layer as any).config as BaseLayerConfig;
  
  // Try to get from layer properties
  if (config?.geographicLevel) {
    return config.geographicLevel;
  }
  
  // Try to get from metadata
  const metadata = config?.metadata;
  if (metadata) {
    // Check spatial coverage
    if (metadata.coverage?.spatial) {
      return metadata.coverage.spatial;
    }
    
    // Check tags for geographic indicators
    if (metadata.tags?.length) {
      const geographicTag = metadata.tags.find(tag => 
        tag.toLowerCase().includes('geography') || 
        tag.toLowerCase().includes('boundary') ||
        tag.toLowerCase().includes('region') ||
        tag.toLowerCase().includes('area')
      );
      if (geographicTag) {
        return geographicTag;
      }
    }
  }
  
  // Try to infer from layer title
  const title = layer.title?.toLowerCase() || '';
  if (title.includes('boundary') || title.includes('region') || title.includes('area')) {
    return title;
  }
  
  return null;
}

/**
 * Determines if two layers can be meaningfully compared based on their metadata
 */
function canCompareGeographies(layer1: FeatureLayer, layer2: FeatureLayer): boolean {
  const config1 = (layer1 as any).config as BaseLayerConfig;
  const config2 = (layer2 as any).config as BaseLayerConfig;
  
  // Check if layers have overlapping spatial coverage
  const coverage1 = config1?.metadata?.coverage?.spatial;
  const coverage2 = config2?.metadata?.coverage?.spatial;
  if (coverage1 && coverage2 && coverage1 !== coverage2) {
    return true;
  }
  
  // Check if layers have compatible geometry types
  const geom1 = config1?.metadata?.geometryType;
  const geom2 = config2?.metadata?.geometryType;
  if (geom1 && geom2 && (
    (geom1.includes('polygon') && geom2.includes('polygon')) ||
    (geom1 === 'point' && geom2.includes('polygon')) ||
    (geom2 === 'point' && geom1.includes('polygon'))
  )) {
    return true;
  }
  
  // Check if layers have different but related tags
  const tags1 = config1?.metadata?.tags || [];
  const tags2 = config2?.metadata?.tags || [];
  const hasRelatedTags = tags1.some(tag1 => 
    tags2.some(tag2 => tag1 !== tag2 && areTagsRelated(tag1, tag2))
  );
  
  return hasRelatedTags;
}

/**
 * Determines if two tags are related for geographic comparison
 */
function areTagsRelated(tag1: string, tag2: string): boolean {
  const t1 = tag1.toLowerCase();
  const t2 = tag2.toLowerCase();
  
  const geographicPairs = [
    ['administrative', 'statistical'],
    ['boundary', 'region'],
    ['urban', 'rural'],
    ['city', 'district'],
    ['local', 'regional'],
    ['demographic', 'administrative']
  ] as const;
  
  return geographicPairs.some(([a, b]) => 
    (t1.includes(a) && t2.includes(b)) || (t1.includes(b) && t2.includes(a))
  );
}

/**
 * Extracts appropriate fields for comparison from the layers
 */
async function extractFieldsFromLayers(
  primaryLayer: FeatureLayer,
  comparisonLayer: FeatureLayer
): Promise<{ primaryField: string | null; comparisonField: string | null }> {
  const config1 = (primaryLayer as any).config as BaseLayerConfig;
  const config2 = (comparisonLayer as any).config as BaseLayerConfig;
  
  // Try to get renderer fields first
  let primaryField = config1?.rendererField;
  let comparisonField = config2?.rendererField;
  
  if (primaryField && comparisonField) {
    return { primaryField, comparisonField };
  }
  
  // If renderer fields not available, look for numeric fields in the layer
  const fields1 = await primaryLayer.load().then(() => primaryLayer.fields);
  const fields2 = await comparisonLayer.load().then(() => comparisonLayer.fields);
  
  const numericFields1 = fields1?.filter(f => f.type === 'double' || f.type === 'integer') || [];
  const numericFields2 = fields2?.filter(f => f.type === 'double' || f.type === 'integer') || [];
  
  // Use the first numeric field if no better option
  primaryField = primaryField || numericFields1[0]?.name;
  comparisonField = comparisonField || numericFields2[0]?.name;
  
  return { primaryField, comparisonField };
}

/**
 * Determines which layer's geography should be used for display
 */
function shouldDisplayAsPrimary(primaryLayer: FeatureLayer, comparisonLayer: FeatureLayer): boolean {
  const config1 = (primaryLayer as any).config as BaseLayerConfig;
  const config2 = (comparisonLayer as any).config as BaseLayerConfig;
  
  // Prefer polygon over point
  if (config1?.metadata?.geometryType?.includes('polygon') && 
      config2?.metadata?.geometryType === 'point') {
    return true;
  }
  
  if (config2?.metadata?.geometryType?.includes('polygon') && 
      config1?.metadata?.geometryType === 'point') {
    return false;
  }
  
  // Prefer higher completeness
  const completeness1 = config1?.metadata?.dataQuality?.completeness || 0;
  const completeness2 = config2?.metadata?.dataQuality?.completeness || 0;
  if (Math.abs(completeness1 - completeness2) > 0.1) {
    return completeness1 > completeness2;
  }
  
  // Default to primary layer
  return true;
}

/**
 * Finds an existing layer or loads it if not already in the map
 */
async function findOrLoadLayer(
  map: Map, 
  geographyType: 'electoral' | 'census' | 'municipal' | 'fsa' | 'other'
): Promise<FeatureLayer | GraphicsLayer | null> {
  // Check if the layer already exists in the map
  for (let i = 0; i < map.layers.length; i++) {
    const layer = map.layers.getItemAt(i);
    
    // Skip layers that aren't feature layers
    if (!(layer instanceof FeatureLayer) && !(layer instanceof GraphicsLayer)) {
      continue;
    }
    
    // Check if this layer matches the geography type
    const title = layer.title?.toLowerCase() || '';
    
    if (geographyType === 'electoral' &&
        (title.includes('electoral') || title.includes('district') || title.includes('precinct'))) {
      return layer;
    } else if (geographyType === 'census' && 
               (title.includes('census') || title.includes('subdivision') || title.includes('division'))) {
      return layer;
    } else if (geographyType === 'municipal' && 
               (title.includes('municipal') || title.includes('city') || title.includes('town'))) {
      return layer;
    } else if (geographyType === 'fsa' && 
               (title.includes('fsa') || title.includes('postal'))) {
      return layer;
    }
  }
  
  // If we didn't find the layer, try to load it
  try {
    const layers = await getLayers();
    
    if (geographyType === 'electoral') {
      const electoralLayer = layers.find((l: FeatureLayer) => 
        l.title?.toLowerCase().includes('electoral') || 
        l.title?.toLowerCase().includes('district') || 
        l.title?.toLowerCase().includes('precinct'));
      
      if (electoralLayer) {
        map.add(electoralLayer);
        return electoralLayer;
      }
    } else if (geographyType === 'census') {
      const censusLayer = layers.find((l: FeatureLayer) => 
        l.title?.toLowerCase().includes('census') || 
        l.title?.toLowerCase().includes('subdivision') || 
        l.title?.toLowerCase().includes('division'));
      
      if (censusLayer) {
        map.add(censusLayer);
        return censusLayer;
      }
    }
    
    // If we still can't find a layer, return null
    return null;
  } catch (error) {
    console.error('Error loading layers:', error);
    return null;
  }
}

/**
 * Gets the primary identifier field for a layer
 */
function getPrimaryIdField(layer: FeatureLayer | GraphicsLayer): string {
  if (layer instanceof FeatureLayer) {
    // Try to get the objectIdField if available
    if (layer.objectIdField) {
      return layer.objectIdField;
    }
    
    // Or check for common ID fields in the fields array
    const commonIdFields = ['OBJECTID', 'FID', 'ID', 'OID', 'id'];
    
    if (layer.fields) {
      for (const field of layer.fields) {
        if (commonIdFields.includes(field.name)) {
          return field.name;
        }
      }
    }
  }
  
  // Default fallback
  return 'OBJECTID';
}

/**
 * Query features from a layer
 */
async function queryLayerFeatures(layer: FeatureLayer | GraphicsLayer): Promise<any[]> {
  if (layer instanceof FeatureLayer) {
    try {
      const query = layer.createQuery();
      query.where = '1=1'; // Get all features
      query.outFields = ['*'];
      query.returnGeometry = true;
      
      const result = await layer.queryFeatures(query);
      
      return result.features.map(feature => ({
        attributes: feature.attributes,
        geometry: feature.geometry ? feature.geometry.toJSON() : null
      }));
    } catch (error) {
      console.error('Error querying features:', error);
      return [];
    }
  } else if (layer instanceof GraphicsLayer) {
    // For graphics layers, just return the graphics
    return layer.graphics.toArray().map(graphic => ({
      attributes: graphic.attributes || {},
      geometry: graphic.geometry ? graphic.geometry.toJSON() : null
    }));
  }
  
  return [];
} 