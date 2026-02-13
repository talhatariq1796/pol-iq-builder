import { AnalysisResult as BaseAnalysisResult } from '../../types/geospatial-ai-types';
import { VisualizationType } from '../../config/dynamic-layers';

/**
 * Enhanced version of AnalysisResult with additional properties needed for visualizations
 */
export interface EnhancedAnalysisResult extends BaseAnalysisResult {
  // Core properties used throughout the system
  intent: string;
  relevantLayers: string[];
  relevantFields?: string[]; 
  comparisonParty?: string; 
  queryType: string;
  confidence: number;
  explanation: string;
  
  // Optional properties for specific analyses
  topN?: number;
  isCrossGeography?: boolean;
  originalQueryType?: string;
  trendsKeyword?: string;
  populationLookup?: Map<string, number>;
  reasoning?: string;
  
  // Properties for visualizations
  metrics?: { r: number; pValue?: number };
  correlationMetrics?: { r: number; pValue?: number };
  thresholds?: Record<string, number>;
  
  // Properties for trends analysis
  timeframe?: string;
  searchType?: string;
  category?: string;
  
  // Additional visualization properties
  visualizationType?: VisualizationType;
}

/**
 * Factory function to ensure type safety when creating enhanced analysis results
 */
export function createEnhancedAnalysisResult(base: Partial<EnhancedAnalysisResult>): EnhancedAnalysisResult {
  return {
    // Default values for required BaseAnalysisResult properties
    type: base.type || 'single',
    summary: base.summary || '',
    
    // Default values for required EnhancedAnalysisResult properties
    intent: base.intent || '',
    relevantLayers: base.relevantLayers || [],
    queryType: base.queryType || 'distribution',
    confidence: base.confidence || 0,
    explanation: base.explanation || '',
    
    // Copy all other properties
    ...base
  };
}

/**
 * Use this to type-cast an AnalysisResult object to EnhancedAnalysisResult
 */
export function enhanceAnalysisResult(result: any): EnhancedAnalysisResult {
  return createEnhancedAnalysisResult(result as Partial<EnhancedAnalysisResult>);
} 