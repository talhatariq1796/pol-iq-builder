import { ConceptMap, AnalysisContext, AnalysisResult } from './analytics/types';
import { FIELD_ALIASES } from '../utils/field-aliases';
import { preferPercentage } from '../utils/field-utils';

// ============================================================================
// QUERY ANALYSIS SYSTEM - ENHANCED FOR GROUPED VARIABLES
// ============================================================================
//
// This system analyzes user queries to determine the appropriate visualization
// strategy and integrates seamlessly with the grouped variable detection system
// from concept-mapping.ts.
//
// HOW IT WORKS:
// 1. Query pattern detection - identifies keywords and patterns
// 2. Query type classification - determines analysis type (correlation, ranking, etc.)
// 3. Field prioritization - works with grouped variables from concept mapping
// 4. Visualization strategy selection - chooses appropriate chart/map type
//
// HOW TO EXTEND FOR NEW PROJECTS:
// 1. Add new query type patterns to QUERY_TYPE_PATTERNS
// 2. Add corresponding strategy mappings to queryTypeToStrategy
// 3. Update field mappings for your dataset in BRAND_FIELD_CODES
// 4. Test with sample queries from your domain

/**
 * Query Type to Visualization Strategy Mapping
 * 
 * This maps detected query types to their corresponding visualization strategies.
 * Easy to extend for new analysis types and visualization approaches.
 */
const queryTypeToStrategy: Record<string, string> = {
  'jointHigh': 'joint high',
  'correlation': 'bivariate', // PHASE 3: Redirect deprecated correlation to bivariate
  'choropleth': 'choropleth',
  'topN': 'ranking',
  'distribution': 'distribution',
  'comparison': 'bivariate', // CHANGE: comparison should be bivariate not multivariate for 2-variable queries
  'simple_display': 'simple_display',
  'bivariate': 'bivariate',
  'bivariateMap': 'bivariate', // PHASE 4: Explicit bivariate map requests
  'ranking': 'ranking',
  'temporal': 'temporal',
  'spatial': 'spatial',
  'difference': 'difference',
  'hotspot': 'hotspot',
  'multivariate': 'multivariate'
};

/**
 * Domain-Specific Field Categories
 * 
 * These define field categories for the current dataset (athletic shoes).
 * For a new project, update these categories to match your domain.
 */
const demographicFields = [
  'total_minority_population_pct',
  'visible_minority_population_pct',
  'population',
  'median_income',
  'disposable_income'
];

/**
 * Brand Field Codes for Current Dataset
 * 
 * This maps brand names to their specific field codes in the dataset.
 * 
 * FOR NEW PROJECTS: Replace these with your own field mappings.
 * Example for real estate: { 'luxury_homes': 'LUXURY_SALES_PCT', 'condos': 'CONDO_SALES_PCT' }
 */
const BRAND_FIELD_CODES: Record<string, string> = {
  'nike': 'MP30034A_B_P',
  'jordan': 'MP30032A_B_P',
  'converse': 'MP30031A_B_P',
  'adidas': 'MP30029A_B_P',
  'puma': 'MP30035A_B_P',
  'reebok': 'MP30036A_B_P',
  'newbalance': 'MP30033A_B_P',
  'new balance': 'MP30033A_B_P',
  'asics': 'MP30030A_B_P',
  'skechers': 'MP30037A_B_P'
} as const;

/**
 * Query Pattern Detection
 * 
 * These patterns help classify queries into different analysis types.
 * The patterns are checked in priority order - more specific patterns first.
 * 
 * PHASE 3 ENHANCEMENTS: Improved hotspot, bivariate, and correlation detection
 */
const QUERY_TYPE_PATTERNS = {
  // HIGHEST PRIORITY: Enhanced hotspot and cluster detection
  hotspot: /\b(hotspot|hot spot|hotspots|cluster|clusters|cold spot|coldspot|geographic.*cluster|find.*hotspot|identify.*cluster|detect.*cold|statistical\s+significance|statistically\s+significant|high.spending\s+areas?|significant\s+areas?|performance\s+areas?)\b/i,
  
  // HIGH PRIORITY: Explicit bivariate map requests (even with versus)
  bivariateMap: /\b(.+\s+(versus|vs\.?)\s+.+\s+in\s+bivariate\s+map)\b/i,
  
  // HIGH PRIORITY: Difference/vs comparisons (but not bivariate maps)
  difference: /\b(\w+\s+(vs\.?|versus)\s+\w+|compare\s+.+\s+(vs\.?|versus)\s+.+)(?!\s+in\s+bivariate\s+map)\b/i,
  
  // HIGH PRIORITY: Explicit bivariate analysis requests
  bivariate: /\b(bivariate|bivariate\s+(analysis|visualization)|alongside|side.by.side\s+analysis|correlate\s+.+\s+with\s+.+|relationship\s+between\s+.+\s+and\s+.+)\b/i,
  
  // HIGH PRIORITY: Multi-brand queries (3+ brands = multivariate)
  multivariate: /\b(all\s+major|multiple\s+brands?|comprehensive\s+comparison|compare\s+\w+,\s+\w+,\s+(and\s+)?\w+(\s+and\s+\w+)?(\s+together)?|(?:\w+\s*,\s*){2,}\w+(\s+and\s+\w+)?(\s+together)?)\b/i,
  
  // Joint high analysis (areas high in multiple variables)
  jointHigh: /\b(joint|both|areas?\s+(high|strong)\s+in\s+(both|all)|regions?\s+with\s+high\s+\w+\s+and\s+\w+|relative\s+interest)\b/i,
  
  // Ranking and top/bottom queries
  topN: /\b(top|bottom|highest|lowest|best|worst|leading|rank|ranking)\b/i,
  
  // Enhanced correlation detection (now maps to bivariate for deprecated correlation)
  correlation: /\b(correlat|relationship|vary\s+with|association|how\s+\w+\s+(vary|correlate|relate)\s+with|how\s+do\s+\w+\s+affect|correlation\s+between|between\s+\w+\s+and\s+\w+|participation\s+also\s+buy|regions\s+with\s+high\s+\w+\s+also)\b/i,
  
  // Distribution analysis
  distribution: /\b(distribution|spread|variance|range|quartile)\b/i,
  
  // Comparison analysis (typically 2 variables)
  comparison: /\b(compare|comparison|versus|vs\.?|difference|differ)\b/i,
  
  // Age demographics (maps to bivariate, not correlation)
  ageDemographics: /\b(younger\s+(regions?|areas?)|older\s+(regions?|areas?)|age\s+demographics?|generational)\b/i,
  
  // Simple display (single variable)
  simple: /\b(show|display|map|visualize)\b/i,
} as const;

// ============================================================================
// SYSTEMATIC FIELD MAPPING GENERATION
// ============================================================================
// Build field name mapping dynamically from all available field aliases
function buildFieldNameMap(): Record<string, string> {
  const fieldNameMap: Record<string, string> = {};
  
  // Process all field aliases to build reverse mapping
  Object.entries(FIELD_ALIASES).forEach(([alias, fieldCode]) => {
    const cleanAlias = alias.toLowerCase().trim();
    fieldNameMap[cleanAlias] = fieldCode;
    
    // Also map the field code to itself
    fieldNameMap[fieldCode.toLowerCase()] = fieldCode;
  });
  
  return fieldNameMap;
}

// Build the field name mapping
const FIELD_NAME_MAP = buildFieldNameMap();

/**
 * Enhanced Query Type Detection
 * 
 * This function analyzes query patterns to determine the most appropriate
 * analysis type. It prioritizes more specific patterns over general ones.
 * 
 * @param query - The user query string
 * @param conceptMap - Results from concept mapping (includes grouped variables)
 * @returns The detected query type from the AnalysisResult union type
 */
function detectQueryType(query: string, conceptMap: ConceptMap): AnalysisResult['queryType'] {
  const lowerQuery = query.toLowerCase();
  
  // Check patterns in priority order (most specific first)
  for (const [queryType, pattern] of Object.entries(QUERY_TYPE_PATTERNS)) {
    if (pattern.test(lowerQuery)) {
    //  console.log(`[QueryAnalyzer] Detected query type: ${queryType} via pattern match`);
      
      // PHASE 3: Special handling for deprecated correlation - redirect to bivariate
      if (queryType === 'correlation') {
        //  console.log(`[QueryAnalyzer] Correlation query detected - redirecting to bivariate analysis (correlation deprecated)`);
        return 'bivariate';
      }
      
      // Special handling for age demographics - maps to bivariate not correlation
      if (queryType === 'ageDemographics') {
      // console.log(`[QueryAnalyzer] Age demographics query mapped to bivariate analysis`);
        return 'bivariate';
      }
      
      // Special handling for multivariate detection
      if (queryType === 'multivariate') {
        // Verify we actually have 3+ matched fields, but be more flexible for 4+ brand comparisons
        if (conceptMap.matchedFields.length >= 3) {
         // console.log(`[QueryAnalyzer] Confirmed multivariate: ${conceptMap.matchedFields.length} fields detected`);
          return 'multivariate';
        } else if (conceptMap.matchedFields.length === 2 && /\b(comprehensive|compare.*,.*,.*and)\b/i.test(lowerQuery)) {
        //  console.log(`[QueryAnalyzer] Comprehensive comparison detected with 2 fields - treating as multivariate due to comprehensive intent`);
          return 'multivariate';
        } else {
        //  console.log(`[QueryAnalyzer] Multivariate pattern detected but only ${conceptMap.matchedFields.length} fields, falling through to other patterns`);
          continue; // Fall through to other patterns
        }
      }
      
      return queryType as AnalysisResult['queryType'];
    }
  }
  
  // Fallback: determine by number of matched fields from concept mapping
  if (conceptMap.matchedFields.length >= 3) {
  //  console.log(`[QueryAnalyzer] Fallback: ${conceptMap.matchedFields.length} fields detected -> multivariate`);
    return 'multivariate';
  } else if (conceptMap.matchedFields.length === 2) {
  //  console.log(`[QueryAnalyzer] Fallback: 2 fields detected -> comparison`);
    return 'comparison';
    } else {
  //  console.log(`[QueryAnalyzer] Fallback: ${conceptMap.matchedFields.length} field(s) detected -> simple`);
    return 'simple';
  }
}

/**
 * Field Prioritization Logic
 * 
 * When multiple fields are detected, this function determines which field
 * should be the primary target variable for analysis.
 * 
 * @param matchedFields - Array of field codes from concept mapping
 * @param query - The user query string for context
 * @returns The prioritized target field code
 */
function prioritizeFields(matchedFields: string[], query: string): string {
  if (matchedFields.length === 0) {
  //  console.log('[QueryAnalyzer] No matched fields, using default TOTPOP_CY');
    return 'TOTPOP_CY'; // Default fallback
  }
  
  if (matchedFields.length === 1) {
  //  console.log(`[QueryAnalyzer] Single field detected: ${matchedFields[0]}`);
    return matchedFields[0];
  }
  
  const lowerQuery = query.toLowerCase();
  
  // Priority 1: If query mentions specific brand, prioritize that brand's field
  for (const [brand, fieldCode] of Object.entries(BRAND_FIELD_CODES)) {
    if (lowerQuery.includes(brand) && matchedFields.includes(fieldCode)) {
    //  console.log(`[QueryAnalyzer] Prioritizing ${brand} field: ${fieldCode}`);
      return fieldCode;
    }
  }
  
  // Priority 2: Prefer percentage fields for better visualization
  const percentageField = matchedFields.find(field => field.endsWith('_P'));
  if (percentageField) {
    //console.log(`[QueryAnalyzer] Prioritizing percentage field: ${percentageField}`);
    return percentageField;
  }
  
  // Priority 3: Use first matched field
  //console.log(`[QueryAnalyzer] Using first matched field: ${matchedFields[0]}`);
  return matchedFields[0];
}

/**
 * Main Query Analysis Function
 * 
 * This is the primary entry point that takes a user query and concept mapping
 * results and produces a complete analysis result with visualization strategy.
 * 
 * @param query - The user query string
 * @param conceptMap - Results from concept mapping including grouped variables
 * @param context - Optional context from previous interactions
 * @returns Complete analysis result with query type and visualization strategy
 */
export async function analyzeQuery(
  query: string, 
  conceptMap: ConceptMap,
  context?: string
): Promise<AnalysisResult> {
 // console.log(`[QueryAnalyzer] Analyzing query: "${query}"`);
 // console.log(`[QueryAnalyzer] Concept map: ${conceptMap.matchedFields.length} fields, ${conceptMap.matchedLayers.length} layers`);
  
  // Step 1: Detect query type using enhanced pattern matching
  const queryType = detectQueryType(query, conceptMap);
  
  // Step 2: Prioritize fields for target variable selection
  const targetVariable = prioritizeFields(conceptMap.matchedFields, query);
  
  // Step 3: Apply field preference logic (percentage vs. raw counts)
  const preferredTargetVariable = preferPercentage(targetVariable);
  
  // Step 4: Determine visualization strategy
  const visualizationStrategy = queryTypeToStrategy[queryType] || 'simple_display';
  
  // Step 5: Build analysis result
  const analysisResult: AnalysisResult = {
    queryType,
    relevantFields: conceptMap.matchedFields,
    targetVariable: preferredTargetVariable,
    visualizationStrategy,
    confidence: conceptMap.confidence,
    // Required properties for AnalysisResult interface
    entities: conceptMap.matchedFields || [],
    intent: 'visualization_request' as const,
    layers: conceptMap.matchedLayers.map(layerId => ({
      layerId,
      relevance: 1.0,
      matchMethod: 'concept_mapping',
      confidence: conceptMap.confidence,
      reasons: ['Matched via concept mapping']
    })),
    timeframe: 'current',
    searchType: 'web' as const,
    relevantLayers: conceptMap.matchedLayers,
    explanation: `Detected ${queryType} query with ${conceptMap.matchedFields.length} fields`,
    originalQuery: query,
    originalQueryType: queryType
  };
  
  // Step 6: Log results for debugging and monitoring
  //console.log(`[QueryAnalyzer] Analysis complete:`);
  //console.log(`  Query Type: ${queryType}`);
  //console.log(`  Target Variable: ${preferredTargetVariable}`);
  //console.log(`  Visualization Strategy: ${visualizationStrategy}`);
  //console.log(`  Relevant Fields: ${conceptMap.matchedFields.join(', ')}`);
  //console.log(`  Confidence: ${conceptMap.confidence}`);
  
  return analysisResult;
}

/**
 * Utility Functions for External Integration
 */

/**
 * Check if a query is likely to be a ranking/top-N query
 */
export function isTopNQuery(query: string): boolean {
  return QUERY_TYPE_PATTERNS.topN.test(query.toLowerCase());
}

/**
 * Check if a query is likely to be a correlation query
 */
export function isCorrelationQuery(query: string): boolean {
  return QUERY_TYPE_PATTERNS.correlation.test(query.toLowerCase());
}

/**
 * Check if a query involves grouped variables (3+ fields)
 */
export function isGroupedVariableQuery(conceptMap: ConceptMap): boolean {
  return conceptMap.matchedFields.length >= 3;
}

/**
 * Get all available query types for documentation/testing
 */
export function getAvailableQueryTypes(): string[] {
  return Object.keys(QUERY_TYPE_PATTERNS);
}

/**
 * Validate that a field code exists in the current dataset
 */
export function isValidFieldCode(fieldCode: string): boolean {
  return Object.values(FIELD_ALIASES).includes(fieldCode) || 
         Object.values(BRAND_FIELD_CODES).includes(fieldCode);
} 