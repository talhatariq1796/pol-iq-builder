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

