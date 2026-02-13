/**
 * Master AI Prompts Configuration for Real Estate Analysis Platform
 * 
 * Unified interface for all real estate analysis AI prompts including:
 * - Strategic analysis, trend analysis, comparative analysis
 * - Predictive modeling, rental market analysis, investment opportunities
 * - Sold listings, active listings, CMA analysis, market comparisons
 */

import { 
  REAL_ESTATE_ANALYSIS_PROMPTS, 
  AnalysisPromptConfig,
  customizePromptForData,
  getPromptForEndpoint as getRealEstatePrompt,
  getAllAnalysisTypes as getAllRealEstateTypes
} from './real-estate-analysis-prompts';

import {
  LISTING_ANALYSIS_PROMPTS,
  generateCMAPrompt,
  getListingPromptForEndpoint,
  getAllListingAnalysisTypes
} from './listing-analysis-prompts';

// ============================================================================
// UNIFIED PROMPT CONFIGURATION
// ============================================================================

export interface PromptGenerationContext {
  recordCount: number;
  spatialScope: string;
  targetVariable: string;
  avgValue: number;
  topAreas: Array<{name: string; value: number}>;
  marketData?: {
    avgDaysOnMarket?: number;
    soldVsAskingRatio?: number;
    inventoryLevel?: string;
    transactionVolume?: number;
  };
}

export interface AIPromptResponse {
  systemPrompt: string;
  analysisPrompt: string;
  contextPrompt: string;
  insightsPrompt: string;
  recommendationsPrompt: string;
  metricExplanations: Record<string, string>;
  businessContext: string;
}

// Combine all prompts into unified configuration
const UNIFIED_ANALYSIS_PROMPTS = {
  ...REAL_ESTATE_ANALYSIS_PROMPTS,
  ...LISTING_ANALYSIS_PROMPTS
};

// ============================================================================
// PROMPT GENERATION AND CUSTOMIZATION
// ============================================================================

/**
 * Generate complete AI prompt configuration for a specific endpoint
 */
export function generateAIPrompt(
  endpoint: string,
  context: PromptGenerationContext,
  customInstructions?: string
): AIPromptResponse | null {
  
  // Get base prompt configuration
  const basePrompt = getPromptConfiguration(endpoint);
  if (!basePrompt) {
    console.warn(`No prompt configuration found for endpoint: ${endpoint}`);
    return null;
  }

  // Customize prompt with context data
  const customizedPrompt = customizePromptForData(basePrompt, context);

  // Generate analysis prompt combining all components
  const analysisPrompt = buildComprehensiveAnalysisPrompt(customizedPrompt, context, customInstructions);

  return {
    systemPrompt: customizedPrompt.systemPrompt,
    analysisPrompt,
    contextPrompt: customizedPrompt.dataContextPrompt,
    insightsPrompt: customizedPrompt.insightsPrompt,
    recommendationsPrompt: customizedPrompt.recommendationsPrompt,
    metricExplanations: customizedPrompt.metricExplanations,
    businessContext: customizedPrompt.businessContext
  };
}

/**
 * Build comprehensive analysis prompt combining all sections
 */
function buildComprehensiveAnalysisPrompt(
  prompt: AnalysisPromptConfig,
  context: PromptGenerationContext,
  customInstructions?: string
): string {
  return `
# ${prompt.analysisType}

## Data Context
${prompt.dataContextPrompt}

## Analysis Instructions
${prompt.insightsPrompt}

## Recommendations Required
${prompt.recommendationsPrompt}

## Key Metrics Reference
${Object.entries(prompt.metricExplanations).map(([metric, explanation]) => 
  `• **${metric}**: ${explanation}`
).join('\n')}

## Business Context
${prompt.businessContext}

## Top Performing Areas for Reference
${context.topAreas.map((area, index) => 
  `${index + 1}. ${area.name}: ${area.value.toFixed(1)}`
).join('\n')}

${customInstructions ? `\n## Additional Instructions\n${customInstructions}` : ''}

---

Please provide a comprehensive analysis following the above framework, ensuring all insights are data-driven and recommendations are actionable for real estate investment and market positioning decisions.
`;
}

/**
 * Get prompt configuration for any endpoint
 */
export function getPromptConfiguration(endpoint: string): AnalysisPromptConfig | null {
  // Remove leading slash and normalize
  const normalizedEndpoint = endpoint.replace(/^\//, '');
  
  // Try real estate prompts first
  let config = getRealEstatePrompt(normalizedEndpoint);
  if (config) return config;
  
  // Try listing analysis prompts
  config = getListingPromptForEndpoint(normalizedEndpoint);
  if (config) return config;
  
  // Try alternative endpoint mappings
  const endpointMappings: Record<string, string> = {
    'strategic': 'strategic-analysis',
    'trend': 'trend-analysis', 
    'comparative': 'comparative-analysis',
    'competitive': 'comparative-analysis',
    'predictive': 'predictive-modeling',
    'prediction': 'predictive-modeling',
    'rental': 'rental-market-analysis',
    'investment': 'investment-opportunities',
    'sold': 'sold-listings-analysis',
    'active': 'active-listings-analysis',
    'cma': 'cma-analysis',
    'comparison': 'market-comparison-insights'
  };
  
  const mappedEndpoint = endpointMappings[normalizedEndpoint];
  if (mappedEndpoint) {
    return UNIFIED_ANALYSIS_PROMPTS[mappedEndpoint] || null;
  }
  
  return null;
}

// ============================================================================
// SPECIALIZED PROMPT GENERATORS
// ============================================================================

/**
 * Generate investment-focused prompt for strategic analysis
 */
export function generateInvestmentPrompt(
  markets: Array<{name: string; score: number; income: number; growth: number}>,
  investmentGoals: 'income' | 'appreciation' | 'balanced'
): string {
  const goalPrompts = {
    income: 'Focus on rental income potential, cash flow, and tenant demand sustainability.',
    appreciation: 'Emphasize capital appreciation potential, growth catalysts, and market momentum.',
    balanced: 'Balance rental income and appreciation potential for diversified returns.'
  };

  return `
Investment Analysis Request - ${investmentGoals.toUpperCase()} Strategy

MARKETS FOR ANALYSIS:
${markets.map(m => `• ${m.name}: Score ${m.score}/100, Income $${m.income.toLocaleString()}, Growth ${m.growth}%`).join('\n')}

INVESTMENT OBJECTIVE: ${goalPrompts[investmentGoals]}

Provide specific investment recommendations with:
1. Portfolio allocation percentages across markets
2. Expected return ranges and timeframes  
3. Risk assessment and mitigation strategies
4. Market entry timing and sequencing recommendations
`;
}

/**
 * Generate CMA-specific prompt with property details
 */
export function generatePropertyCMAPrompt(
  propertyDetails: {
    address: string;
    type: string;
    size: number;
    bedrooms: number;
    bathrooms: number;
    features: string[];
    listingPrice?: number;
  },
  marketContext: PromptGenerationContext
): string {
  return `
COMPARATIVE MARKET ANALYSIS REQUEST

Subject Property Details:
• Address: ${propertyDetails.address}
• Type: ${propertyDetails.type}
• Size: ${propertyDetails.size} sq ft
• Bedrooms: ${propertyDetails.bedrooms}
• Bathrooms: ${propertyDetails.bathrooms}
• Key Features: ${propertyDetails.features.join(', ')}
${propertyDetails.listingPrice ? `• Current/Proposed List Price: $${propertyDetails.listingPrice.toLocaleString()}` : ''}

Market Context:
• Geographic Area: ${marketContext.spatialScope}
• Market Analysis: ${marketContext.recordCount} comparable areas
• Average Market Score: ${marketContext.avgValue.toFixed(1)}

Provide detailed CMA including:
1. Estimated market value range with justification
2. Competitive positioning analysis
3. Pricing strategy recommendations
4. Market timing considerations
5. Investment potential assessment
`;
}

/**
 * Generate trend analysis prompt for timing decisions
 */
export function generateTimingAnalysisPrompt(
  markets: string[],
  timeHorizon: '6-months' | '1-year' | '2-years' | '5-years'
): string {
  const horizonPrompts = {
    '6-months': 'Focus on immediate market conditions and short-term momentum indicators.',
    '1-year': 'Analyze annual trends and seasonal patterns for near-term planning.',
    '2-years': 'Evaluate medium-term growth trends and market cycle positioning.',
    '5-years': 'Assess long-term growth potential and strategic market positioning.'
  };

  return `
Market Timing Analysis - ${timeHorizon.toUpperCase()} Investment Horizon

TARGET MARKETS: ${markets.join(', ')}

TIME HORIZON: ${horizonPrompts[timeHorizon]}

Provide timing-specific recommendations including:
1. Optimal entry timing for each market
2. Expected market conditions over the time horizon
3. Risk factors and market cycle considerations
4. Exit strategy timing for different investment approaches
`;
}

// ============================================================================
// ENDPOINT MAPPING AND UTILITIES
// ============================================================================

/**
 * Map analysis endpoint to appropriate prompt type
 */
export const ENDPOINT_PROMPT_MAPPING: Record<string, string> = {
  '/strategic-analysis': 'strategic-analysis',
  '/trend-analysis': 'trend-analysis',
  '/comparative-analysis': 'comparative-analysis',
  '/competitive-analysis': 'comparative-analysis',
  '/predictive-modeling': 'predictive-modeling',
  '/rental-analysis': 'rental-market-analysis',
  '/investment-analysis': 'investment-opportunities',
  '/sold-analysis': 'sold-listings-analysis',
  '/active-analysis': 'active-listings-analysis',
  '/cma-analysis': 'cma-analysis',
  '/market-comparison': 'market-comparison-insights',
  
  // Additional endpoint aliases
  '/analyze': 'strategic-analysis',
  '/strategic': 'strategic-analysis',
  '/trend': 'trend-analysis',
  '/comparative': 'comparative-analysis',
  '/competitive': 'comparative-analysis',
  '/prediction': 'predictive-modeling',
  '/rental': 'rental-market-analysis',
  '/investment': 'investment-opportunities',
  '/sold': 'sold-listings-analysis',
  '/active': 'active-listings-analysis',
  '/cma': 'cma-analysis'
};

/**
 * Get all available analysis types with descriptions
 */
export function getAvailableAnalysisTypes(): Array<{
  endpoint: string;
  type: string;
  description: string;
  category: 'market-analysis' | 'listing-analysis' | 'investment-analysis';
}> {
  return [
    // Market Analysis
    { endpoint: '/strategic-analysis', type: 'Strategic Investment Analysis', description: 'Investment potential and ROI assessment', category: 'market-analysis' },
    { endpoint: '/trend-analysis', type: 'Market Trend Analysis', description: 'Temporal patterns and momentum indicators', category: 'market-analysis' },
    { endpoint: '/comparative-analysis', type: 'Comparative Market Analysis', description: 'Multi-market comparison and ranking', category: 'market-analysis' },
    { endpoint: '/predictive-modeling', type: 'Market Prediction Analysis', description: 'Future performance forecasting', category: 'market-analysis' },
    
    // Investment Analysis  
    { endpoint: '/investment-analysis', type: 'Investment Opportunities', description: 'Opportunity identification and prioritization', category: 'investment-analysis' },
    { endpoint: '/rental-analysis', type: 'Rental Market Analysis', description: 'Rental yield and tenant demand assessment', category: 'investment-analysis' },
    
    // Listing Analysis
    { endpoint: '/sold-analysis', type: 'Sold Listings Analysis', description: 'Historical transaction performance', category: 'listing-analysis' },
    { endpoint: '/active-analysis', type: 'Active Listings Analysis', description: 'Current inventory and competition analysis', category: 'listing-analysis' },
    { endpoint: '/cma-analysis', type: 'Comparative Market Analysis (CMA)', description: 'Property-specific valuation and positioning', category: 'listing-analysis' },
    { endpoint: '/market-comparison', type: 'Market Comparison Insights', description: 'Comprehensive cross-market intelligence', category: 'listing-analysis' }
  ];
}

/**
 * Validate prompt configuration completeness
 */
export function validatePromptConfiguration(endpoint: string): {
  isValid: boolean;
  missingComponents: string[];
  suggestions: string[];
} {
  const config = getPromptConfiguration(endpoint);
  
  if (!config) {
    return {
      isValid: false,
      missingComponents: ['entire configuration'],
      suggestions: [`Create prompt configuration for endpoint: ${endpoint}`]
    };
  }

  const missingComponents: string[] = [];
  const suggestions: string[] = [];

  // Check required components
  if (!config.systemPrompt) missingComponents.push('systemPrompt');
  if (!config.dataContextPrompt) missingComponents.push('dataContextPrompt');
  if (!config.insightsPrompt) missingComponents.push('insightsPrompt');
  if (!config.recommendationsPrompt) missingComponents.push('recommendationsPrompt');
  if (!config.metricExplanations || Object.keys(config.metricExplanations).length === 0) {
    missingComponents.push('metricExplanations');
  }
  if (!config.businessContext) missingComponents.push('businessContext');

  // Generate suggestions
  if (missingComponents.length > 0) {
    suggestions.push(`Add missing components: ${missingComponents.join(', ')}`);
  }
  if (config.systemPrompt && config.systemPrompt.length < 100) {
    suggestions.push('Expand system prompt with more detailed expertise description');
  }
  if (Object.keys(config.metricExplanations).length < 3) {
    suggestions.push('Add more metric explanations for comprehensive analysis');
  }

  return {
    isValid: missingComponents.length === 0,
    missingComponents,
    suggestions
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Main prompt configurations
  REAL_ESTATE_ANALYSIS_PROMPTS,
  LISTING_ANALYSIS_PROMPTS,
  UNIFIED_ANALYSIS_PROMPTS as ALL_ANALYSIS_PROMPTS,
  
  // Utility functions
  customizePromptForData,
  generateCMAPrompt,
  getRealEstatePrompt,
  getListingPromptForEndpoint,
  getAllRealEstateTypes,
  getAllListingAnalysisTypes
};

// Default export
export default {
  generateAIPrompt,
  getPromptConfiguration,
  getAvailableAnalysisTypes,
  validatePromptConfiguration,
  generateInvestmentPrompt,
  generatePropertyCMAPrompt,
  generateTimingAnalysisPrompt,
  ALL_ANALYSIS_PROMPTS: UNIFIED_ANALYSIS_PROMPTS
};