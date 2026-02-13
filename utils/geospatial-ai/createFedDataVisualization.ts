import { createVisualization } from '../visualizations';
import { CrossGeographyCorrelationVisualization } from '../visualizations/cross-geography-correlation-visualization';
import { CrossGeographyVisualizationOptions } from '../visualizations/cross-geography-correlation-visualization';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Query from '@arcgis/core/rest/support/Query';
import Graphic from '@arcgis/core/Graphic';

/**
 * Creates a cross-geography correlation visualization that compares data between
 * federal electoral districts and another geography type (e.g., census subdivisions)
 * 
 * @param options Configuration options for visualization creation
 * @returns The visualization layer ready to be added to the map
 */
export async function createFedDataVisualization({
  primaryLayer,               // Electoral district feature layer
  primaryField,               // Field in electoral data to analyze
  comparisonLayer,            // Census/other geography feature layer
  comparisonField,            // Field in comparison data to analyze
  displayAsPrimary = true,    // Display results on electoral districts (true) or comparison geography (false)
  visOptions = {}             // Additional visualization options
}: {
  primaryLayer: FeatureLayer | GraphicsLayer;
  primaryField: string;
  comparisonLayer: FeatureLayer | GraphicsLayer;
  comparisonField: string;
  displayAsPrimary?: boolean;
  visOptions?: CrossGeographyVisualizationOptions;
}): Promise<FeatureLayer | null> {
  try {
    console.log('Creating federal electoral district cross-geography visualization:', {
      primaryLayer: primaryLayer.title,
      primaryField,
      comparisonLayer: comparisonLayer.title,
      comparisonField,
      displayAsPrimary
    });

    // Fetch the features from both layers
    let primaryFeatures: Graphic[] = [];
    let comparisonFeatures: Graphic[] = [];
    
    // Handle different layer types for fetching features
    if (primaryLayer instanceof FeatureLayer) {
      // Query all features from the layer
      const query = new Query({
        where: "1=1",
        outFields: ["*"],
        returnGeometry: true
      });
      
      const results = await primaryLayer.queryFeatures(query);
      primaryFeatures = results.features;
    } else if (primaryLayer instanceof GraphicsLayer) {
      // For GraphicsLayer, get graphics directly
      primaryFeatures = primaryLayer.graphics.toArray();
    }
    
    if (comparisonLayer instanceof FeatureLayer) {
      // Query all features from the layer
      const query = new Query({
        where: "1=1",
        outFields: ["*"],
        returnGeometry: true
      });
      
      const results = await comparisonLayer.queryFeatures(query);
      comparisonFeatures = results.features;
    } else if (comparisonLayer instanceof GraphicsLayer) {
      // For GraphicsLayer, get graphics directly
      comparisonFeatures = comparisonLayer.graphics.toArray();
    }
    
    console.log('Fetched features for visualization:', {
      primaryFeatureCount: primaryFeatures.length,
      comparisonFeatureCount: comparisonFeatures.length
    });
    
    if (primaryFeatures.length === 0 || comparisonFeatures.length === 0) {
      console.error('No features found in one or both layers');
      return null;
    }
    
    // Determine the ID field for each geography type
    const primaryIdField = detectIdField(primaryFeatures, 'electoral');
    const comparisonIdField = detectIdField(comparisonFeatures, 'census');
    
    if (!primaryIdField || !comparisonIdField) {
      console.error('Could not detect ID fields for geography layers');
      return null;
    }
    
    // Create the cross-geography correlation visualization
    const visualization = new CrossGeographyCorrelationVisualization();
    
    const result = await visualization.create({
      layerName: `${displayAsPrimary ? 'Electoral' : 'Census'} Correlation: ${primaryField} vs ${comparisonField}`,
      features: displayAsPrimary ? primaryFeatures : comparisonFeatures,
      primaryLayerFeatures: primaryFeatures,
      primaryField,
      primaryGeographyType: 'electoral',
      primaryGeographyIdField: primaryIdField,
      comparisonLayerFeatures: comparisonFeatures,
      comparisonField,
      comparisonGeographyType: 'census',
      comparisonGeographyIdField: comparisonIdField
    }, {
      displayAsPrimary,
      ...visOptions
    });
    
    return result.layer;
  } catch (error) {
    console.error('Error creating federal electoral district visualization:', error);
    return null;
  }
}

/**
 * Helper function to detect the appropriate ID field for a geography type
 */
export function detectIdField(features: Graphic[], geographyType: 'electoral' | 'census' | 'municipal' | 'fsa' | 'other'): string | null {
  if (features.length === 0) {
    return null;
  }
  
  // Sample the first feature to check available fields
  const sampleFeature = features[0];
  const attributes = sampleFeature.attributes || {};
  const keys = Object.keys(attributes);
  
  // Common ID field patterns
  if (geographyType === 'electoral') {
    // Try common electoral district ID fields
    for (const candidate of ['FEDUID', 'FED_UID', 'feduid', 'fed_uid', 'FED_ID', 'fed_id', 'fedId']) {
      if (keys.includes(candidate)) {
        return candidate;
      }
    }
    
    // Fall back to name-based fields
    for (const candidate of ['FEDNAME', 'FED_NAME', 'fedname', 'fed_name', 'name', 'district_name']) {
      if (keys.includes(candidate)) {
        return candidate;
      }
    }
  } else if (geographyType === 'census') {
    // Try common census subdivision ID fields
    for (const candidate of ['CSDUID', 'CSD_UID', 'csduid', 'csd_uid', 'CSD_ID', 'csd_id']) {
      if (keys.includes(candidate)) {
        return candidate;
      }
    }
    
    // Fall back to name-based fields
    for (const candidate of ['CSDNAME', 'CSD_NAME', 'csdname', 'csd_name', 'name']) {
      if (keys.includes(candidate)) {
        return candidate;
      }
    }
  }
  
  // Last resort: just return the first string field that has 'id' or 'name' in it
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('id') && typeof attributes[key] === 'string') {
      return key;
    }
  }
  
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('name') && typeof attributes[key] === 'string') {
      return key;
    }
  }
  
  // If no appropriate ID field is found, return null
  console.warn(`Could not detect ID field for ${geographyType} geography`);
  return null;
} 