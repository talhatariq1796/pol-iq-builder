// reference/geospatial-chat-interface-integration.ts
//
// =====================================================================
// This is a REFERENCE IMPLEMENTATION showing how to integrate the 
// dynamic layer system with the geospatial-chat-interface component
// =====================================================================

// --------------------------------------------------------------------
// PART 1: IMPORT CHANGES
// --------------------------------------------------------------------

// Add these imports to the top of geospatial-chat-interface.tsx
import { DynamicVisualizationFactory, createCompatibilityAdapter } from '../lib/DynamicVisualizationFactory';
import { 
  layerRegistry, 
  VisualizationType, 
  initializeLayerRegistry 
} from '../config/dynamic-layers';
import { baseLayerConfigs } from '../config/layers';
import type { LayerConfig } from '../types/layers';
import { AnalysisResult } from '../lib/analytics/types';

// --------------------------------------------------------------------
// PART 2: UPDATE FACTORY INITIALIZATION
// --------------------------------------------------------------------

// Placeholder declarations for missing names to satisfy linter for this reference file
declare let factoryRef: any;
declare let mapView: any;
declare let currentVisualizationLayer: any;
declare let onVisualizationLayerCreated: any;
declare function extractKeyword(query: string): string;
declare function validateExtent(extent: any): boolean;

interface ProcessedLayerResult {
  features: any[];
  layerId: string;
  // Add other properties as needed based on usage
}

interface VisualizationOptions {
  query?: string;
  fields?: string[];
  primaryField?: string;
  comparisonField?: string;
  comparisonParty?: string;
  thresholds?: any;
  metrics?: any;
  type?: VisualizationType;
  keyword?: string;
}

interface VisualizationResult {
  layer: any;
  extent: any;
  metrics?: any;
  // Add other properties as needed based on usage
}

// --------------------------------------------------------------------
// PART 1: DEFINE DynamicVisualizationFactory (if not already globally available or imported)
// This is a guess, assuming such a class exists and is needed by factoryRef.current
// If it's imported from elsewhere, that import should be added.
// --------------------------------------------------------------------

// --------------------------------------------------------------------
// PART 2: UPDATE FACTORY INITIALIZATION
// --------------------------------------------------------------------

// Update the initFactory function to use the DynamicVisualizationFactory:
const initFactory = async () => {
  try {
    if (!factoryRef.current && mapView && mapView.ready) {
      // Create new factory instance
      const factory = new DynamicVisualizationFactory();
      
      // Initialize with map view
      await factory.initialize(mapView);
      
      // Store in ref
      factoryRef.current = factory;
      
      // Initialize layer registry with existing configs from config/layers.ts (via dynamic-layers.ts)
      await initializeLayerRegistry(); // Changed from passing layerConfigsObject
    }
  } catch (e) {
    // TODO: Handle error appropriately or remove empty catch block if not needed
  }
};

// --------------------------------------------------------------------
// PART 3: UPDATE HANDLE VISUALIZATION FUNCTION
// --------------------------------------------------------------------

// Update the handleVisualization function to use the dynamic factory:
const handleVisualization = async (
  layerResults: ProcessedLayerResult[],
  analysis: AnalysisResult,
  genericVizOptions: Partial<VisualizationOptions> & { 
    query?: string; 
    primaryField?: string; 
    comparisonField?: string; 
    comparisonParty?: string; 
  }
): Promise<VisualizationResult> => {
  // Existing code for filtering layer results...
  const resultsWithFeatures = layerResults.filter(
    result => result.features && result.features.length > 0
  );
  
  // Handle no results case
  if (resultsWithFeatures.length === 0) {
    return { layer: null, extent: null };
  }
  
  // Initialize factory if needed
  if (!factoryRef.current) {
    try {
      await initFactory();
      if (!factoryRef.current) {
        throw new Error('Factory initialization failed');
      }
    } catch (err) {
      return { layer: null, extent: null };
    }
  }

  try {
    // Get primary layer ID from results
    const primaryLayerId = resultsWithFeatures[0]?.layerId;
    
    if (!primaryLayerId) {
      throw new Error('No layer ID available for visualization');
    }
    
    // Prepare fields from analysis result
    const fields = [];
    if (analysis.relevantFields?.length) {
      fields.push(...analysis.relevantFields);
    }
    
    // Prepare visualization options
    const vizOptions: VisualizationOptions = {
      query: genericVizOptions.query || '',
      fields: fields,
      primaryField: genericVizOptions.primaryField || analysis.relevantFields?.[0],
      comparisonField: genericVizOptions.comparisonField || analysis.relevantFields?.[1],
      thresholds: analysis.thresholds,
      metrics: analysis.metrics,
      // Add more options as needed
    };
    
    // Use the analysis query type to create the visualization
    const analysisType = analysis.queryType || 'distribution';
    
    // Create the visualization using our factory
    const visualizationResult = await factoryRef.current.createVisualization(
      analysisType,
      primaryLayerId,
      vizOptions
    );
    
    if (!visualizationResult.layer) {
      throw new Error('Failed to create visualization layer');
    }
    
    // Update current visualization layer reference
    currentVisualizationLayer.current = visualizationResult.layer;
    
    // Notify parent component through callback
    if (onVisualizationLayerCreated) {
      onVisualizationLayerCreated(visualizationResult.layer, true);
    }
    
    // Add to map if not already added
    if (mapView && !mapView.map.findLayerById(visualizationResult.layer.id)) {
      mapView.map.add(visualizationResult.layer);
    }
    
    // Set map extent if available
    if (visualizationResult.extent && validateExtent(visualizationResult.extent)) {
      mapView?.goTo(visualizationResult.extent);
    }
    
    // Return the visualization result
    return {
      layer: visualizationResult.layer,
      extent: visualizationResult.extent,
      metrics: visualizationResult.metrics
    };
  } catch (error) {
    return { layer: null, extent: null };
  }
};

// --------------------------------------------------------------------
// PART 4: UPDATE HANDLE TRENDS QUERY
// --------------------------------------------------------------------

// Update the handleTrendsQuery function to use the dynamic factory:
const handleTrendsQuery = async (query: string): Promise<{ 
  layer: __esri.FeatureLayer | null, 
  extent: __esri.Extent | null 
}> => {
  // Extract keyword from query
  const keyword = extractKeyword(query);
  
  // Get the googleTrends layer config from baseLayerConfigs array
  const googleTrendsConfig = baseLayerConfigs.find(l => l.id === 'googleTrends');
  if (!googleTrendsConfig) {
    throw new Error('Google Trends layer configuration not found');
  }

  // Find the matching virtual layer
  // Assuming virtualLayers is a property on the LayerConfig for googleTrends
  const virtualLayers = (googleTrendsConfig as any).virtualLayers;
  const virtualLayer = virtualLayers?.find((vl: any) => 
    vl.name.toLowerCase() === keyword.toLowerCase()
  );

  if (!virtualLayer) {
    throw new Error(`No trend data found for "${keyword}"`);
  }

  // Ensure factory is initialized
  if (!factoryRef.current) {
    await initFactory();
    if (!factoryRef.current) {
      throw new Error('Factory initialization failed');
    }
  }
  
  // Create visualization options for trends
  const vizOptions = {
    type: VisualizationType.TRENDS,
    fields: [virtualLayer.field],
    query: query,
    keyword: keyword
  };
  
  // Create visualization
  const result = await factoryRef.current.createVisualization(
    'trends',
    'googleTrends',
    vizOptions
  );
  
  return {
    layer: result.layer,
    extent: result.extent
  };
};

// ============================================================
// END OF REFERENCE IMPLEMENTATION
// ============================================================ 