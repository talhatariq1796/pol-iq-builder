/**
 * Query Validator
 * 
 * Validates query scope and rejects out-of-domain requests gracefully
 */

import { DomainConfiguration, QueryScope, ValidationResult, QueryValidationConfig } from './types/DomainTypes';
 
interface ScopeAnalysis {
  length: number;
  word_count: number;
  has_question_words: boolean;
  has_action_words: boolean;
  has_subject_words: boolean;
  domain_term_count: number;
  rejection_pattern_matches: string[];
}

export class QueryValidator {
  /**
   * Validate query scope against domain configuration
   */
  validateQuery(query: string, domain: DomainConfiguration): ValidationResult {
  const analysis = this.analyzeQueryScope(query, domain);
    
    // CRITICAL FIX: Always accept predefined ANALYSIS_CATEGORIES queries
    if (this.isPredefinedAnalysisQuery(query)) {
      return {
        scope: QueryScope.IN_SCOPE,
        confidence: 0.95,
        reasons: ['Predefined analysis query - guaranteed valid']
      };
    }
    
    // Check for clear out-of-scope indicators
  const outOfScopeScore = this.calculateOutOfScopeScore(query, domain.validation);
  if (outOfScopeScore >= 0.6) {
      return {
        scope: QueryScope.OUT_OF_SCOPE,
        confidence: outOfScopeScore,
        reasons: [`Query appears to be about ${this.identifyMainTopic(query)}, which is outside our analysis domain`],
        redirect_message: this.generateRedirectMessage(query)
      };
    }
    
    // Early check for malformed queries
    if (this.isMalformed(query)) {
      return {
        scope: QueryScope.MALFORMED,
        confidence: 0.9,
        reasons: ['Query appears to be incomplete or malformed'],
        suggestions: [
          'Please provide a complete question',
          'Try using analysis terms like "analyze", "compare", or "show"',
          'Be specific about what you want to understand'
        ]
      };
    }

    // Single-word queries: ask for clarification unless a clear action like 'analyze'
    if (analysis.word_count === 1 && !/^analy(ze|sis)$/.test(query.toLowerCase())) {
      return {
        scope: QueryScope.BORDERLINE,
        confidence: 0.65,
        reasons: ['Single-word query lacks specificity'],
        suggestions: this.suggestAnalysisPhrasings(query)
      };
    }

    // Heuristic: very short, generic, or capability-style queries should be borderline
    if (
      (analysis.word_count <= 3 && analysis.has_action_words && !analysis.has_subject_words) ||
      this.isCapabilityStyleQuery(query) ||
      this.isGenericLowSpecificityQuery(query)
    ) {
      return {
        scope: QueryScope.BORDERLINE,
        confidence: 0.6,
        reasons: ['Query is too generic and lacks a specific analysis subject'],
        suggestions: this.suggestAnalysisPhrasings(query)
      };
    }

    // Check for domain relevance
  const domainRelevance = this.calculateDomainRelevance(query, domain.validation.domain_indicators);
  if (domainRelevance < 0.12) {  // Slightly lower threshold to accept clear-but-brief in-scope queries
      return {
    scope: domainRelevance < 0.05 ? QueryScope.OUT_OF_SCOPE : QueryScope.BORDERLINE,
        confidence: 1 - domainRelevance,
        reasons: ['Query lacks clear analysis intent or business context'],
        suggestions: this.suggestAnalysisPhrasings(query)
      };
    }
    
    // Query appears to be in scope
    return {
      scope: QueryScope.IN_SCOPE,
      confidence: domainRelevance,
      reasons: ['Query contains analysis intent and business context']
    };
  }

  /**
   * Analyze query scope comprehensively
   */
  private analyzeQueryScope(query: string, domain: DomainConfiguration): ScopeAnalysis {
    const queryLower = query.toLowerCase();
    
    return {
      length: query.length,
      word_count: queryLower.split(/\s+/).length,
      has_question_words: this.hasQuestionWords(queryLower),
      has_action_words: this.hasActionWords(queryLower, domain.validation.domain_indicators.required_actions),
      has_subject_words: this.hasSubjectWords(queryLower, domain.validation.domain_indicators.required_subjects),
      domain_term_count: this.countDomainTerms(queryLower, domain),
      rejection_pattern_matches: this.findRejectionPatterns(queryLower, domain.validation.rejection_patterns)
    };
  }

  /**
   * Calculate out-of-scope score
   */
  private calculateOutOfScopeScore(query: string, validation: QueryValidationConfig): number {
    const queryLower = query.toLowerCase();
    let outOfScopeScore = 0;
    
    // Check each rejection pattern category
    for (const [category, patterns] of Object.entries(validation.rejection_patterns)) {
      
      for (const pattern of (patterns as string[])) {
        if (queryLower.includes(pattern.toLowerCase())) {
          // Weight different categories differently
          const categoryWeight = this.getCategoryWeight(category);
          outOfScopeScore += categoryWeight;
        }
      }
    }

    // Additional heuristic out-of-scope detection for common topics
    const heuristics: Array<{ regex: RegExp; weight: number }> = [
      { regex: /\b(capital of|capital\s+city|what\s+is\s+the\s+capital)\b/i, weight: 0.7 },
      { regex: /\b(write(\s+me)?\s+a\s+story|poem|lyrics|fiction|dragons?)\b/i, weight: 0.8 },
      { regex: /\b(restaurant|restaurants|cook|cooking|recipe|ingredients?)\b/i, weight: 0.8 },
      { regex: /\b(relationship advice|dating advice|lose\s+weight|diet|exercise\s+plan)\b/i, weight: 0.8 },
      { regex: /\b(stock\s+market|stocks?|nasdaq|s&p|dow jones|bitcoin|crypto|ethereum|price\s+analysis)\b/i, weight: 0.7 },
      { regex: /\bweather\b/i, weight: 0.8 }
    ];
    for (const h of heuristics) {
      if (h.regex.test(query)) {
        outOfScopeScore = Math.max(outOfScopeScore, h.weight);
      }
    }
    
    return Math.min(1.0, outOfScopeScore);
  }

  /**
   * Get weight for different out-of-scope categories
   */
  private getCategoryWeight(category: string): number {
    const weights: { [key: string]: number } = {
      'personal_requests': 0.9,     // Very likely out of scope
      'technical_support': 0.8,    // Likely out of scope
      'general_knowledge': 0.7,    // Moderately out of scope
      'creative_tasks': 0.8        // Likely out of scope
    };
    
    return weights[category] || 0.5;
  }

  /**
   * Calculate domain relevance score
   */
  private calculateDomainRelevance(query: string, domainIndicators: QueryValidationConfig['domain_indicators']): number {
    const queryLower = query.toLowerCase();
    let relevanceScore = 0;
    
    // Check for required subjects (25% weight - reduced to allow for implicit context)
    const subjectMatches = domainIndicators.required_subjects.filter((subject: string) =>
      queryLower.includes(subject.toLowerCase())
    );
    if (subjectMatches.length > 0) {
      relevanceScore += 0.25 * (subjectMatches.length / domainIndicators.required_subjects.length);
      relevanceScore += 0.08; // Baseline bonus for having any subject words
    }
    
    // Check for required actions (35% weight)
    const actionMatches = domainIndicators.required_actions.filter((action: string) =>
      queryLower.includes(action.toLowerCase())
    );
    // Include implicit comparative/action phrases as valid actions (e.g., "stack up against", "vs")
    const implicitActionPatterns: RegExp[] = [
      /stack\s+up\s+against/i,
      /how\s+we\s+stack\s+up/i,
      /how\s+do\s+we\s+compare/i,
      /\b(vs\.?|versus)\b/i
    ];
    const hasImplicitAction = implicitActionPatterns.some(p => p.test(query));
    if (actionMatches.length > 0) {
      relevanceScore += 0.35 * (actionMatches.length / domainIndicators.required_actions.length);
      relevanceScore += 0.1; // Baseline bonus for having any action words
    } else if (hasImplicitAction) {
      // Grant a modest portion of action credit for implicit action phrasing
      relevanceScore += 0.18; // smaller than explicit action but enough to avoid false OOS
    }
    
    // Check for valid contexts (20% weight - reduced)
    const contextMatches = domainIndicators.valid_contexts.filter((context: string) =>
      queryLower.includes(context.toLowerCase())
    );
    if (contextMatches.length > 0) {
      relevanceScore += 0.20 * (contextMatches.length / domainIndicators.valid_contexts.length);
    }
    
    // Add implicit business context detection (20% weight)
    const implicitBusinessScore = this.detectImplicitBusinessContext(queryLower);
    relevanceScore += 0.20 * implicitBusinessScore;
    
    // Phrase-based boost for clear analysis phrasing (accept analyze/analysis variants)
    if (/\b(strategic|market|expansion|opportunit(y|ies))\b/.test(queryLower) && /\b(analysis|analyz(e|ing)?)\b/.test(queryLower)) {
      relevanceScore += 0.08; // small but decisive boost
    }

    // Co-occurrence boost for strategic phrasing (strategic + expansion/growth + opportunity)
    const hasStrategic = /\bstrategic\b/.test(queryLower);
    const hasExpansionOrGrowth = /\b(expansion|expand|growth|growing)\b/.test(queryLower);
    const hasOpportunity = /\bopportunit(y|ies)\b/.test(queryLower);
    if (hasStrategic && hasExpansionOrGrowth) {
      relevanceScore += 0.08;
    }
    if ((hasStrategic && hasOpportunity) || (hasExpansionOrGrowth && hasOpportunity)) {
      relevanceScore += 0.08;
    }
    
    return relevanceScore;
  }

  /**
   * Detect implicit business context from query patterns
   */
  private detectImplicitBusinessContext(queryLower: string): number {
    let contextScore = 0;
    let maxScore = 0;
    
    // Brand/company name patterns (weight: 0.4)
    maxScore += 0.4;
    const brandPatterns = [
      /\bh&r block\b/i, /\bturbotax\b/i, /\btaxact\b/i, /\bfreetaxusa\b/i,
      /\b[a-z]+\s+(tax|services?|software|solutions?|company|corp|inc|llc)\b/i,
      /\b(inc|corp|llc|ltd)\b/i
    ];
    if (brandPatterns.some(pattern => pattern.test(queryLower))) {
      contextScore += 0.4;
    }
    
    // Geographic analysis patterns (weight: 0.3)
    maxScore += 0.3;
    const geoPatterns = [
      /\b(county|city|state|region|area|territory|location|zone)\b/i,
      /\bbetween\s+[a-z\s]+\s+and\s+[a-z\s]+/i,  // "between X and Y"
      /\b[a-z]+\s+(county|city)\b/i,
      /\bin\s+[a-z\s]+/i
    ];
    if (geoPatterns.some(pattern => pattern.test(queryLower))) {
      contextScore += 0.3;
    }
    
    // Performance/business measurement patterns (weight: 0.3)
    maxScore += 0.3;
    const measurementPatterns = [
      /\b(usage|performance|metrics|results|success|effectiveness|rate|share|growth|trends?|insights|analysis)\b/i,
      /\b(best|top|highest|optimal|leading|superior|worst|lowest)\b/i,
      /\b(customers?|clients?|users?|consumers?|segments?|profiles?)\b/i
    ];
    if (measurementPatterns.some(pattern => pattern.test(queryLower))) {
      contextScore += 0.3;
    }
    
    return maxScore > 0 ? contextScore / maxScore : 0;
  }

  /**
   * Check if query is malformed
   */
  private isMalformed(query: string): boolean {
    const trimmed = query.trim();
    
    // Too short
    if (trimmed.length < 3) return true;
    
    // Only punctuation or special characters
    if (!/[a-zA-Z]/.test(trimmed)) return true;
    
    // Only one word and it's not a clear command
    const words = trimmed.split(/\s+/);
    if (words.length === 1 && !this.isSingleWordQuery(words[0])) return true;
    
    // Contains mostly numbers or symbols
    const alphaRatio = (trimmed.match(/[a-zA-Z]/g) || []).length / trimmed.length;
    if (alphaRatio < 0.3) return true;
    
    return false;
  }

  /**
   * Check if single word is a valid query
   */
  private isSingleWordQuery(word: string): boolean {
    const validSingleWords = [
      'analyze', 'analysis', 'demographics', 'competition', 'strategic',
      'insights', 'data', 'market', 'customers', 'trends', 'performance'
    ];
    
    return validSingleWords.includes(word.toLowerCase());
  }

  /**
   * Check for question words
   */
  private hasQuestionWords(queryLower: string): boolean {
    const questionWords = ['what', 'where', 'when', 'why', 'how', 'which', 'who'];
    return questionWords.some(word => queryLower.includes(word));
  }

  /**
   * Check for action words
   */
  private hasActionWords(queryLower: string, requiredActions: string[]): boolean {
    if (requiredActions.some(action => queryLower.includes(action.toLowerCase()))) {
      return true;
    }
    // Implicit comparative/action phrases
    const implicitActions = [
      /stack\s+up\s+against/i,
      /how\s+we\s+stack\s+up/i,
      /how\s+do\s+we\s+compare/i,
      /versus/i,
      /vs\.?/i
    ];
    return implicitActions.some(p => p.test(queryLower));
  }

  /**
   * Check for subject words
   */
  private hasSubjectWords(queryLower: string, requiredSubjects: string[]): boolean {
    return requiredSubjects.some(subject => queryLower.includes(subject.toLowerCase()));
  }

  /**
   * Count domain-specific terms
   */
  private countDomainTerms(queryLower: string, domain: DomainConfiguration): number {
    let count = 0;
    const allDomainTerms = [
      ...domain.vocabulary.domain_terms.primary,
      ...domain.vocabulary.domain_terms.secondary,
      ...domain.vocabulary.domain_terms.context
    ];
    
    for (const term of allDomainTerms) {
      if (queryLower.includes(term.toLowerCase())) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Find matching rejection patterns
   */
  private findRejectionPatterns(queryLower: string, rejectionPatterns: QueryValidationConfig['rejection_patterns']): string[] {
    const matches: string[] = [];
    
    for (const [category, patterns] of Object.entries(rejectionPatterns)) {
      for (const pattern of (patterns as string[])) {
        if (queryLower.includes(pattern.toLowerCase())) {
          matches.push(`${category}:${pattern}`);
        }
      }
    }
    
    return matches;
  }

  /**
   * Detect capability-style queries that ask what the system can do
   */
  private isCapabilityStyleQuery(query: string): boolean {
    const q = query.toLowerCase();
    const patterns = [
      /what\s+can\s+you\s+do\??/i,
      /tell\s+me\s+about\s+the\s+data/i,
      /show\s+me\s+information/i,
      /help\s+with\s+analysis/i,
      /data\s+insights/i,
      /^analyze$/i
    ];
    return patterns.some(p => p.test(q));
  }

  /**
   * Detect generic low-specificity queries lacking subjects
   */
  private isGenericLowSpecificityQuery(query: string): boolean {
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length <= 2) return true;
    const genericTerms = ['data', 'information', 'insights', 'analysis'];
    const hasGeneric = genericTerms.some(t => q.includes(t));
  const hasSpecificNouns = /(customer|market|demographic|competitive|competition|trend|cluster|brand|segment|region|area|location|positioning)/i.test(q);
    return hasGeneric && !hasSpecificNouns;
  }

  /**
   * Identify main topic of out-of-scope query
   */
  private identifyMainTopic(query: string): string {
    const queryLower = query.toLowerCase();
    
    const topicPatterns = {
      'weather': ['weather', 'temperature', 'rain', 'snow', 'forecast', 'climate'],
      'cooking': ['recipe', 'cook', 'food', 'ingredient', 'meal', 'dish'],
      'technical_support': ['fix', 'error', 'bug', 'troubleshoot', 'install', 'configure'],
      'health': ['health', 'medical', 'doctor', 'medicine', 'symptom', 'disease'],
      'entertainment': ['movie', 'music', 'game', 'show', 'entertainment'],
      'travel': ['travel', 'vacation', 'flight', 'hotel', 'trip'],
      'shopping': ['buy', 'purchase', 'store', 'shop', 'price', 'deal'],
      'education': ['learn', 'study', 'school', 'university', 'course'],
      'news': ['news', 'current events', 'politics', 'election'],
      'personal': ['personal', 'relationship', 'family', 'friend']
    };
    
    for (const [topic, patterns] of Object.entries(topicPatterns)) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        return topic.replace('_', ' ');
      }
    }
    
    return 'general information';
  }

  /**
   * Generate redirect message for out-of-scope queries
   */
  private generateRedirectMessage(query: string): string {
    const topic = this.identifyMainTopic(query);
    
    const redirectMap: { [key: string]: string } = {
      'weather': 'For weather information, try a weather service like Weather.com or your local weather app.',
      'cooking': 'For recipes and cooking advice, try food websites like AllRecipes, Food Network, or cooking apps.',
      'technical support': 'For technical support, please consult the relevant product documentation, support forum, or contact technical support directly.',
      'health': 'For health and medical advice, please consult with a healthcare professional or medical website like WebMD.',
      'entertainment': 'For entertainment recommendations, try platforms like IMDb, Spotify, or entertainment websites.',
      'travel': 'For travel planning, try travel websites like Expedia, TripAdvisor, or airline/hotel websites.',
      'shopping': 'For shopping and product information, try e-commerce sites like Amazon, product comparison sites, or retailer websites.',
      'education': 'For educational content, try educational platforms like Khan Academy, Coursera, or academic websites.',
      'news': 'For news and current events, try news websites like CNN, BBC, Reuters, or your preferred news source.',
      'personal': 'For personal advice, consider speaking with friends, family, or professional counselors.',
      'general information': 'For general information, try search engines like Google, reference sites like Wikipedia, or specialized knowledge bases.'
    };
    
    const specificMessage = redirectMap[topic];
    if (specificMessage) {
      return specificMessage;
    }
    
    return 'This query appears to be outside our business analysis domain. Please rephrase with analysis-focused terms like "analyze", "compare", or "evaluate" if you\'re seeking business insights.';
  }

  /**
   * Suggest analysis-oriented rephrasings
   */
  private suggestAnalysisPhrasings(query: string): string[] {
    const suggestions: string[] = [];
    
    if (this.containsLocationMentions(query)) {
      const location = this.extractLocation(query);
      if (location) {
        suggestions.push(`Try: "Analyze the ${location} market for business opportunities"`);
      }
    }
    
    if (this.containsComparisonTerms(query)) {
      const subjects = this.extractComparisonSubjects(query);
      if (subjects.length >= 2) {
        suggestions.push(`Try: "Compare performance between ${subjects.join(' and ')}"`);
      }
    }
    
    if (this.containsPerformanceTerms(query)) {
      const subject = this.extractPerformanceSubject(query);
      if (subject) {
        suggestions.push(`Try: "Evaluate performance metrics for ${subject}"`);
      }
    }
    
    // Always include general suggestions
    suggestions.push(
      'Try: "Analyze market insights for [your specific business area]"',
      'Include terms like "demographics", "competition", or "market trends"',
      'Specify a geographic area or customer segment for analysis'
    );
    
    return suggestions.slice(0, 4); // Limit to 4 suggestions
  }

  /**
   * Check if query contains location mentions
   */
  private containsLocationMentions(query: string): boolean {
    const locationPatterns = [
      /\b[A-Z][a-z]+\s+(city|county|state)\b/i,
      /\bin\s+[A-Z][a-z]+/i,
      /[A-Z][a-z]+,?\s*[A-Z]{2}\b/i // City, State format
    ];
    
    return locationPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Extract location from query
   */
  private extractLocation(query: string): string | null {
    const locationMatch = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
    return locationMatch ? locationMatch[1] : null;
  }

  /**
   * Check if query contains comparison terms
   */
  private containsComparisonTerms(query: string): boolean {
    const comparisonTerms = ['vs', 'versus', 'compare', 'between', 'and'];
    const queryLower = query.toLowerCase();
    return comparisonTerms.some(term => queryLower.includes(term));
  }

  /**
   * Extract comparison subjects
   */
  private extractComparisonSubjects(query: string): string[] {
    // Simple extraction - could be more sophisticated
    const matches = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g);
    return matches ? matches.slice(0, 2) : [];
  }

  /**
   * Check if query contains performance terms
   */
  private containsPerformanceTerms(query: string): boolean {
    const performanceTerms = ['performance', 'metrics', 'results', 'success', 'effectiveness'];
    const queryLower = query.toLowerCase();
    return performanceTerms.some(term => queryLower.includes(term));
  }

  /**
   * Extract performance subject
   */
  private extractPerformanceSubject(query: string): string | null {
    const subjectMatch = query.match(/(?:performance|metrics|results)\s+(?:of|for)\s+([a-zA-Z\s]+)/i);
    return subjectMatch ? subjectMatch[1].trim() : null;
  }

  /**
   * Check if query is from predefined ANALYSIS_CATEGORIES
   */
  private isPredefinedAnalysisQuery(query: string): boolean {
    // List of exact predefined queries from ANALYSIS_CATEGORIES that should always pass validation
    const predefinedQueries = [
      'Show me the top strategic markets for housing investment expansion',
      'Compare homeownership rates between Montreal and Quebec City', 
      'Show me the difference between homeownership and rental rates',
      'Which areas have the best demographics for housing development?',
      'Show me areas with ideal demographic profiles for housing markets',
      'Show me geographic clusters of similar housing markets',
      'Show me markets that have outliers with unique housing characteristics',
      'Show me areas with the best opportunities for housing development',
      'What if interest rates change - which housing markets would be most resilient?',
      'Which markets have the strongest interactions between demographics and housing demand?',
      'Which markets have the clearest housing market segmentation profiles?',
      'How do housing rankings change if we adjust income weights by 20%?',
      'What are the most important factors predicting housing market strength?',
      'How accurate are our predictions for housing market performance?',
      'Which AI model performs best for predicting housing trends in each area?',
      'Show me the highest confidence predictions using our best ensemble model',
      'What is the optimal AI algorithm for predictions in each geographic area?',
      'Which factors explain most of the variation in housing market performance?',
      'Where do all our AI models agree on housing market predictions?',
      'Which unusual market patterns represent the biggest business opportunities?',
      'How should we segment housing markets for targeted strategies?',
      'Provide comprehensive market insights for housing',
      'What market factors are most strongly correlated with homeownership rates?',
      'Show me housing market trend patterns and temporal analysis',
      'Which markets are most likely to grow for housing investment in the next year?'
    ];

    // Check for exact matches (case-insensitive)
    const queryLower = query.toLowerCase().trim();
    return predefinedQueries.some(predefined => 
      predefined.toLowerCase() === queryLower
    );
  }

  /**
   * Get validation summary for debugging
   */
  getValidationSummary(query: string, domain: DomainConfiguration): {
    query: string;
    validation_result: ValidationResult;
    analysis_details: ScopeAnalysis;
    recommendations: { redirect?: string } | { suggestions?: string[] } | { action: 'proceed_with_routing' };
  } {
    const validation = this.validateQuery(query, domain);
    const analysis = this.analyzeQueryScope(query, domain);
    
    return {
      query,
      validation_result: validation,
      analysis_details: analysis,
      recommendations: validation.scope === QueryScope.OUT_OF_SCOPE 
        ? { redirect: validation.redirect_message }
        : validation.scope === QueryScope.BORDERLINE
        ? { suggestions: validation.suggestions }
        : { action: 'proceed_with_routing' }
    };
  }
}