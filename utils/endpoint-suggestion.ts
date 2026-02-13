/**
 * Intelligent Endpoint Suggestion System
 * 
 * Analyzes user queries to suggest the most appropriate analysis endpoints
 * based on keywords, intent, and context patterns.
 */

interface EndpointSuggestion {
  endpointId: string;
  confidence: number;
  reasoning: string[];
  matchedKeywords: string[];
}

interface QueryAnalysisContext {
  previousQueries?: string[];
  selectedBrand?: string;
  dataContext?: 'geographic' | 'demographic' | 'temporal' | 'competitive';
}

// Comprehensive keyword mapping for intelligent endpoint suggestion
const ENDPOINT_KEYWORD_MAP = {
  '/analyze': {
    primary: ['analyze', 'overview', 'general', 'summary', 'insights', 'performance'],
    secondary: ['overall', 'total', 'main', 'primary', 'basic'],
    patterns: [/what.*(performance|doing)/i, /how.*(overall|generally)/i],
    weight: 1.0
  },
  '/spatial-clusters': {
    primary: ['cluster', 'similar', 'group', 'segment', 'alike', 'geographic'],
    secondary: ['area', 'region', 'spatial', 'location', 'nearby', 'pattern'],
    patterns: [/find.*similar/i, /group.*areas/i, /cluster.*analysis/i],
    weight: 1.2
  },
  '/competitive-analysis': {
    primary: ['vs', 'versus', 'compare', 'competition', 'competitive', 'against'],
    secondary: ['brand', 'competitor', 'market share', 'position', 'battle'],
    patterns: [/\w+\s+vs\s+\w+/i, /compare.*brand/i, /\w+\s+versus\s+\w+/i],
    weight: 1.3
  },
  '/demographic-insights': {
    primary: ['demographic', 'population', 'age', 'income', 'lifestyle', 'customer'],
    secondary: ['profile', 'segment', 'characteristics', 'who', 'people'],
    patterns: [/who.*buy/i, /demographic.*profile/i, /customer.*segment/i],
    weight: 1.2
  },
  '/market-risk': {
    primary: ['risk', 'danger', 'threat', 'vulnerable', 'exposure', 'safety'],
    secondary: ['market', 'economic', 'financial', 'stability', 'secure'],
    patterns: [/risk.*assessment/i, /how.*risky/i, /vulnerability.*analysis/i],
    weight: 1.4
  },
  '/trend-analysis': {
    primary: ['trend', 'over time', 'temporal', 'change', 'evolution', 'growth'],
    secondary: ['pattern', 'progression', 'development', 'movement', 'shift'],
    patterns: [/trend.*over/i, /change.*time/i, /growth.*pattern/i],
    weight: 1.3
  },
  '/penetration-optimization': {
    primary: ['opportunity', 'optimize', 'improve', 'potential', 'growth', 'expand'],
    secondary: ['untapped', 'underperform', 'increase', 'enhance', 'maximize'],
    patterns: [/optimization.*opportunity/i, /improve.*penetration/i, /growth.*potential/i],
    weight: 1.2
  },
  '/threshold-analysis': {
    primary: ['threshold', 'benchmark', 'target', 'goal', 'standard', 'criteria'],
    secondary: ['above', 'below', 'meet', 'exceed', 'achieve', 'performance'],
    patterns: [/above.*threshold/i, /meet.*target/i, /performance.*standard/i],
    weight: 1.1
  },
  '/anomaly-detection': {
    primary: ['anomaly', 'outlier', 'unusual', 'abnormal', 'strange', 'exception'],
    secondary: ['detect', 'identify', 'find', 'spot', 'discover', 'different'],
    patterns: [/anomaly.*detection/i, /unusual.*pattern/i, /outlier.*analysis/i],
    weight: 1.2
  }
};

/**
 * Suggests the most appropriate analysis endpoint based on query content
 */
export function suggestAnalysisEndpoint(
  query: string, 
  context?: QueryAnalysisContext
): EndpointSuggestion[] {
  const normalizedQuery = query.toLowerCase().trim();
  const suggestions: EndpointSuggestion[] = [];

  // Analyze each endpoint for relevance
  Object.entries(ENDPOINT_KEYWORD_MAP).forEach(([endpointId, config]) => {
    let score = 0;
    const reasoning: string[] = [];
    const matchedKeywords: string[] = [];

    // Primary keyword matching (high weight)
    config.primary.forEach(keyword => {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        score += 3 * config.weight;
        matchedKeywords.push(keyword);
        reasoning.push(`Strong keyword match: "${keyword}"`);
      }
    });

    // Secondary keyword matching (medium weight)
    config.secondary.forEach(keyword => {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        score += 1.5 * config.weight;
        matchedKeywords.push(keyword);
        reasoning.push(`Supporting keyword: "${keyword}"`);
      }
    });

    // Pattern matching (very high weight)
    config.patterns.forEach((pattern) => {
      if (pattern.test(query)) {
        score += 5 * config.weight;
        reasoning.push(`Pattern match: recognized query structure`);
      }
    });

    // Context-based scoring
    if (context) {
      score += calculateContextScore(endpointId, context, reasoning);
    }

    // Competitive analysis boost for brand comparisons
    if (endpointId === '/competitive-analysis') {
      const brandWords = extractBrandWords(query);
      if (brandWords.length >= 2) {
        score += 4;
        reasoning.push(`Multiple brands detected: ${brandWords.join(', ')}`);
      }
    }

    // Geographic clustering boost for location-related queries
    if (endpointId === '/spatial-clusters') {
      const locationWords = ['area', 'region', 'location', 'place', 'geographic', 'spatial'];
      const locationMatches = locationWords.filter(word => normalizedQuery.includes(word));
      if (locationMatches.length > 0) {
        score += 2;
        reasoning.push(`Geographic context detected`);
      }
    }

    // Only include endpoints with meaningful scores
    if (score > 0.5) {
      suggestions.push({
        endpointId,
        confidence: Math.min(score / 10, 1), // Normalize to 0-1
        reasoning,
        matchedKeywords
      });
    }
  });

  // Sort by confidence and return top suggestions
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5); // Return top 5 suggestions
}

/**
 * Calculate additional score based on query context
 */
function calculateContextScore(
  endpointId: string, 
  context: QueryAnalysisContext, 
  reasoning: string[]
): number {
  let contextScore = 0;

  // Previous query patterns
  if (context.previousQueries && context.previousQueries.length > 0) {
    const recentQueries = context.previousQueries.slice(-3).join(' ').toLowerCase();
    
    // If user has been asking competitive questions, boost competitive analysis
    if (endpointId === '/competitive-analysis' && 
        (recentQueries.includes('vs') || recentQueries.includes('compare'))) {
      contextScore += 1;
      reasoning.push('Recent competitive queries detected');
    }
    
    // If user has been asking about trends, boost trend analysis
    if (endpointId === '/trend-analysis' && 
        (recentQueries.includes('trend') || recentQueries.includes('over time'))) {
      contextScore += 1;
      reasoning.push('Recent temporal analysis pattern');
    }
  }

  // Data context influence
  if (context.dataContext) {
    const contextEndpointMap = {
      'geographic': ['/spatial-clusters', '/demographic-insights'],
      'demographic': ['/demographic-insights', '/segment-profiling'],
      'temporal': ['/trend-analysis', '/time-series-analysis'],
      'competitive': ['/competitive-analysis', '/market-risk']
    };

    if (contextEndpointMap[context.dataContext]?.includes(endpointId)) {
      contextScore += 0.5;
      reasoning.push(`Matches ${context.dataContext} data context`);
    }
  }

  return contextScore;
}

/**
 * Extract potential brand names from query
 */
function extractBrandWords(query: string): string[] {
  const commonBrands = [
    'nike', 'adidas', 'puma', 'reebok', 'new balance', 'converse', 
    'asics', 'jordan', 'under armour', 'skechers'
  ];
  
  const queryLower = query.toLowerCase();
  return commonBrands.filter(brand => queryLower.includes(brand));
}

/**
 * Get a quick endpoint suggestion with explanation
 */
export function getQuickEndpointSuggestion(query: string): {
  endpoint: string;
  confidence: number;
  explanation: string;
} {
  const suggestions = suggestAnalysisEndpoint(query);
  
  if (suggestions.length === 0) {
    return {
      endpoint: '/analyze',
      confidence: 0.5,
      explanation: 'No specific patterns detected, using general analysis'
    };
  }

  const topSuggestion = suggestions[0];
  return {
    endpoint: topSuggestion.endpointId,
    confidence: topSuggestion.confidence,
    explanation: topSuggestion.reasoning[0] || 'Best match based on query analysis'
  };
}

/**
 * Suggest alternative endpoints if the primary suggestion might not be suitable
 */
export function getAlternativeEndpoints(
  query: string, 
  primaryEndpoint: string
): EndpointSuggestion[] {
  const allSuggestions = suggestAnalysisEndpoint(query);
  
  return allSuggestions
    .filter(suggestion => suggestion.endpointId !== primaryEndpoint)
    .slice(0, 3); // Return top 3 alternatives
}

/**
 * Validate if a selected endpoint makes sense for the given query
 */
export function validateEndpointSelection(
  query: string, 
  selectedEndpoint: string
): {
  isValid: boolean;
  confidence: number;
  suggestions?: string[];
} {
  const suggestions = suggestAnalysisEndpoint(query);
  const selectedSuggestion = suggestions.find(s => s.endpointId === selectedEndpoint);
  
  if (!selectedSuggestion) {
    return {
      isValid: false,
      confidence: 0,
      suggestions: suggestions.slice(0, 2).map(s => s.endpointId)
    };
  }
  
  return {
    isValid: selectedSuggestion.confidence > 0.3,
    confidence: selectedSuggestion.confidence,
    suggestions: selectedSuggestion.confidence < 0.5 ? 
      suggestions.slice(0, 2).map(s => s.endpointId) : undefined
  };
} 