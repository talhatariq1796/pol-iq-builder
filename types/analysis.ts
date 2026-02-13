export interface AnalysisResult {
  intent: string;
  relevantLayers: string[];
  relevantFields?: string[];
  comparisonParty?: string;
  queryType: string;
  confidence: number;
  explanation: string;
  topN?: number;
  isCrossGeography?: boolean;
  originalQueryType?: string;
  originalQuery?: string;
  trendsKeyword?: string;
  populationLookup?: Map<string, number>;
  reasoning?: string;
  metrics?: { r: number; pValue?: number };
  correlationMetrics?: { r: number; pValue?: number };
  thresholds?: Record<string, number>;
  timeframe?: string;
  searchType?: string;
  category?: string;
  visualizationType?: string;
}

export interface VisualizationStrategy {
  title: string;
  description: string;
  targetVariable: string;
  correlationField?: string;
  rankingField?: string;
  distributionField?: string;
}

export interface EnhancedAnalysisResult {
  queryType: 'correlation' | 'ranking' | 'distribution' | 'default';
  visualizationStrategy: VisualizationStrategy;
  confidence: number;
  suggestedActions: string[];
  targetVariable?: string;
  relevantFields?: string[];
} 