import { DEFAULT_FILL_ALPHA } from "./constants";
import { VisualizationType } from '@/config/dynamic-layers';
import { visualizationMappings } from '@/config/visualization-mapping';

export interface QueryIntent {
  type: string;
  fields: string[];
  geometryType?: string;
  timeRange?: {
    start: string;
    end: string;
  };
  filters?: Record<string, any>;
}

export interface VisualizationSuggestion {
  type: VisualizationType;
  confidence: number;
  reason: string;
  requiredFields: string[];
  defaultOptions: {
    opacity: number;
    showLegend: boolean;
    showLabels: boolean;
    clusteringEnabled: boolean;
  };
}

export function mapQueryToVisualizations(queryIntent: QueryIntent): VisualizationSuggestion[] {
  const suggestions: VisualizationSuggestion[] = [];
  
  // Find matching visualization mappings
  const matchingMappings = visualizationMappings.filter(mapping => {
    // Check if query type matches
    if (mapping.queryType !== queryIntent.type) {
      return false;
    }
    
    // Check if we have enough fields
    if (queryIntent.fields.length < mapping.requiredFields) {
      return false;
    }
    
    // Check if geometry type is supported
    if (queryIntent.geometryType && !mapping.supportedGeometryTypes.includes(queryIntent.geometryType)) {
      return false;
    }
    
    return true;
  });
  
  // Convert mappings to suggestions
  matchingMappings.forEach(mapping => {
    mapping.visualizationTypes.forEach(vizType => {
      // Calculate confidence based on various factors
      let confidence = 0.7; // Base confidence
      
      // Increase confidence if we have more fields than required
      if (queryIntent.fields.length > mapping.requiredFields) {
        confidence += 0.1;
      }
      
      // Increase confidence if we have time range for temporal visualizations
      if (queryIntent.timeRange && mapping.queryType === 'temporal') {
        confidence += 0.1;
      }
      
      // Increase confidence if we have filters for complex visualizations
      if (queryIntent.filters && Object.keys(queryIntent.filters).length > 0) {
        confidence += 0.1;
      }
      
      // Cap confidence at 0.95
      confidence = Math.min(confidence, 0.95);
      
      suggestions.push({
        type: vizType,
        confidence,
        reason: mapping.description,
        requiredFields: queryIntent.fields.slice(0, mapping.requiredFields),
        defaultOptions: mapping.defaultOptions
      });
    });
  });
  
  // Sort suggestions by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

export function getBestVisualization(queryIntent: QueryIntent): VisualizationSuggestion | null {
  const suggestions = mapQueryToVisualizations(queryIntent);
  return suggestions.length > 0 ? suggestions[0] : null;
}

export function getAlternativeVisualizations(queryIntent: QueryIntent): VisualizationSuggestion[] {
  const suggestions = mapQueryToVisualizations(queryIntent);
  return suggestions.slice(1); // Return all suggestions except the best one
} 