import { VisualizationType } from "../reference/dynamic-layers";

/**
 * Interface for the complexity scoring result
 */
export interface ComplexityScoreResult {
  score: number;
  requiresML: boolean;
  explanation: string[];
  queryType: 'simple' | 'complex' | 'predictive';
}

/**
 * Scores a query's complexity to determine whether it should be processed
 * by the rule-based system or the ML-based system.
 * 
 * @param query The natural language query string
 * @param visualizationType The classified visualization type (if available)
 * @returns ComplexityScoreResult with score and routing decision
 */
export function scoreQueryComplexity(
  query: string,
  visualizationType?: VisualizationType
): ComplexityScoreResult {
  const lowerQuery = query.toLowerCase().trim();
  
  // Initialize scoring variables
  let score = 0;
  const explanation: string[] = [];
  
  // 1. Check for number of parameters/variables
  const parameterCount = countRequestedParameters(lowerQuery);
  if (parameterCount > 2) {
    score += Math.min(parameterCount, 5);
    explanation.push(`Query requests ${parameterCount} parameters/variables (+${Math.min(parameterCount, 5)})`);
  }
  
  // 2. Check for statistical terminology
  const statsTerms = [
    'correlation', 'regression', 'p-value', 'significance', 'standard deviation',
    'variance', 'mean', 'median', 'quartile', 'percentile', 'distribution',
    'hypothesis', 'confidence interval', 'prediction', 'forecast'
  ];
  
  const foundStatsTerms = statsTerms.filter(term => lowerQuery.includes(term));
  if (foundStatsTerms.length > 0) {
    const statsScore = Math.min(foundStatsTerms.length * 2, 5);
    score += statsScore;
    explanation.push(`Query contains statistical terms: ${foundStatsTerms.join(', ')} (+${statsScore})`);
  }
  
  // 3. Check for temporal requirements
  const temporalTerms = [
    'predict', 'forecast', 'future', 'trend', 'next month', 'next year',
    'over time', 'historical trend', 'time series', 'seasonal', 'growth rate'
  ];
  
  const foundTemporalTerms = temporalTerms.filter(term => lowerQuery.includes(term));
  if (foundTemporalTerms.length > 0) {
    const temporalScore = Math.min(foundTemporalTerms.length * 2, 4);
    score += temporalScore;
    explanation.push(`Query contains temporal analysis terms: ${foundTemporalTerms.join(', ')} (+${temporalScore})`);
  }
  
  // 4. Check for spatial relationship complexity
  const spatialComplexityTerms = [
    'within', 'contains', 'intersects', 'buffer', 'nearest neighbor',
    'proximity', 'closest', 'furthest', 'adjacent', 'overlapping',
    'surrounding', 'between'
  ];
  
  const foundSpatialTerms = spatialComplexityTerms.filter(term => lowerQuery.includes(term));
  if (foundSpatialTerms.length > 0) {
    const spatialScore = Math.min(foundSpatialTerms.length, 3);
    score += spatialScore;
    explanation.push(`Query contains complex spatial relationships: ${foundSpatialTerms.join(', ')} (+${spatialScore})`);
  }
  
  // 5. Check for override keywords that always require ML
  const mlOverrideTerms = [
    'predict', 'forecast', 'anomaly', 'outlier', 'correlation', 'causation',
    'clusters of', 'pattern recognition', 'time series', 'trend analysis'
  ];
  
  const foundOverrideTerms = mlOverrideTerms.filter(term => lowerQuery.includes(term));
  const requiresMLOverride = foundOverrideTerms.length > 0;
  
  if (requiresMLOverride) {
    explanation.push(`Query contains terms that require ML processing: ${foundOverrideTerms.join(', ')} (override)`);
  }
  
  // 6. Adjust score based on visualization type
  if (visualizationType) {
    const complexVisualizations = [
      VisualizationType.HEATMAP,
      VisualizationType.CORRELATION,
      VisualizationType.CORRELATION,
      VisualizationType.FLOW
    ];
    
    if (complexVisualizations.includes(visualizationType)) {
      score += 2;
      explanation.push(`Visualization type ${visualizationType} typically requires complex analysis (+2)`);
    }
  }
  
  // Determine if ML processing is required
  const requiresML = score > 4 || requiresMLOverride;
  
  // Determine query type
  let queryType: 'simple' | 'complex' | 'predictive' = 'simple';
  if (foundTemporalTerms.some(term => ['predict', 'forecast', 'future'].includes(term))) {
    queryType = 'predictive';
  } else if (requiresML) {
    queryType = 'complex';
  }
  
  return {
    score,
    requiresML,
    explanation,
    queryType
  };
}

/**
 * Counts the number of parameters or variables requested in a query
 */
function countRequestedParameters(query: string): number {
  // Count comma-separated items
  const commaCount = (query.match(/,/g) || []).length;
  
  // Count "and" conjunctions (but avoid double-counting with commas)
  const andPattern = /\band\b(?![^,]*,)/g;
  const andCount = (query.match(andPattern) || []).length;
  
  // Count other parameter indicators
  const byPattern = /\bby\s+([a-z]+)/gi;
  const byMatches = query.match(byPattern) || [];
  
  // Combine counts, but ensure minimal count of 1
  return Math.max(1, commaCount + andCount + byMatches.length);
} 