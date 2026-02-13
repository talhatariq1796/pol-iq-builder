/**
 * Domain Vocabulary Adapter
 * 
 * Maps generic intents to domain-specific contexts without hardcoding
 */

import { 
  DomainConfiguration, 
  EnhancedQuery, 
  EndpointCandidate, 
  DomainAdaptationResult,
  DomainEndpointConfig
} from './types/DomainTypes';
import { IntentClassification } from './types/BaseIntentTypes';

export class DomainVocabularyAdapter {
  /**
   * Enhance query with domain-specific vocabulary and context
   */
  enhanceQuery(
    query: string, 
    baseIntent: IntentClassification, 
    domain: DomainConfiguration
  ): EnhancedQuery {
    const startTime = performance.now();
    
    // Step 1: Replace domain-specific terms with generic equivalents
    const normalizedQuery = this.normalizeToGeneric(query, domain);
    
    // Step 2: Expand synonyms and variations
    const expandedTerms = this.expandSynonyms(normalizedQuery, domain.synonyms);
    
    // Step 3: Map entities to domain context
    const entityContext = this.mapEntitiesToDomain(expandedTerms, domain.vocabulary.entities);
    
  // Step 4: Apply domain-specific boosting
  const domainRelevance = this.calculateDomainRelevance(query, domain, expandedTerms);
    
    const endTime = performance.now();
    
    return {
      original_query: query,
      normalized_query: normalizedQuery,
      expanded_terms: expandedTerms,
      entity_context: entityContext,
      domain_relevance: domainRelevance,
      base_intent: baseIntent,
      processing_metadata: {
        processing_time: endTime - startTime,
        applied_synonyms: this.getAppliedSynonyms(query, normalizedQuery),
        expanded_entities: this.getExpandedEntities(entityContext),
        relevance_factors: this.getRelevanceFactors(query, domain)
      }
    };
  }

  /**
   * Generate endpoint candidates based on enhanced query
   */
  generateCandidates(
    enhancedQuery: EnhancedQuery, 
    domain: DomainConfiguration
  ): EndpointCandidate[] {
    const candidates: EndpointCandidate[] = [];
    
    for (const [endpoint, cfg] of Object.entries(domain.endpoint_mappings)) {
      const config = cfg as DomainEndpointConfig;
      const candidate = this.scoreEndpointCandidate(endpoint, config, enhancedQuery);
      candidates.push(candidate);
    }
    
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Apply avoidance filters to prevent cross-contamination
   */
  applyAvoidanceFilters(
    candidates: EndpointCandidate[], 
    domain: DomainConfiguration,
    originalQuery?: string
  ): EndpointCandidate[] {
    const original = (originalQuery || '').toLowerCase();
    return candidates.map(candidate => {
      const avoidTerms = domain.avoid_terms[candidate.endpoint] || [];
      const penaltyScore = this.calculateAvoidancePenalty(
        candidate.reasoning.join(' '), 
        avoidTerms,
        original
      );
      
      if (penaltyScore > 0) {
        return {
          ...candidate,
          confidence: candidate.confidence * (1 - penaltyScore),
          penalties: [
            ...(candidate.penalties || []),
            {
              type: 'avoidance',
              score: penaltyScore,
              reason: `Avoidance terms matched: ${avoidTerms.filter(term => 
                candidate.reasoning.join(' ').toLowerCase().includes(term.toLowerCase())
              ).join(', ')}`
            }
          ]
        };
      }
      
      return candidate;
    });
  }

  /**
   * Perform complete domain adaptation
   */
  adaptToDomain(
    query: string,
    baseIntent: IntentClassification,
    domain: DomainConfiguration
  ): DomainAdaptationResult {
    // Enhance query with domain context
    const enhancedQuery = this.enhanceQuery(query, baseIntent, domain);
    
    // Generate initial candidates
    let candidates = this.generateCandidates(enhancedQuery, domain);
    
  // Apply avoidance filters (consider original query as well)
  candidates = this.applyAvoidanceFilters(candidates, domain, query);
    
    // Calculate overall domain confidence
    const domainConfidence = this.calculateOverallDomainConfidence(
      enhancedQuery, 
      candidates
    );
    
    return {
      enhanced_query: enhancedQuery,
      candidates: candidates,
      domain_confidence: domainConfidence,
      domain_relevance: enhancedQuery.domain_relevance,
      adaptation_metadata: {
        synonyms_applied: enhancedQuery.processing_metadata.applied_synonyms.length,
        entities_expanded: enhancedQuery.processing_metadata.expanded_entities.length,
        domain_terms_matched: this.countDomainTermMatches(query, domain),
        avoidance_penalties: candidates.filter(c => c.penalties && c.penalties.length > 0).length
      }
    };
  }

  /**
   * Normalize query by replacing domain-specific terms with generic ones
   */
  private normalizeToGeneric(query: string, domain: DomainConfiguration): string {
    let normalized = query.toLowerCase();
    
    // Replace domain-specific terms with generic equivalents
    const allDomainTerms = [
      ...domain.vocabulary.domain_terms.primary,
      ...domain.vocabulary.domain_terms.secondary,
      ...domain.vocabulary.domain_terms.context
    ];
    
    for (const term of allDomainTerms) {
      // Replace domain terms with generic "business" or "service"
      const genericReplacement = this.getGenericReplacement(term);
      normalized = normalized.replace(new RegExp(`\\b${term}\\b`, 'gi'), genericReplacement);
    }
    
    return normalized;
  }

  /**
   * Get generic replacement for domain-specific term
   */
  private getGenericReplacement(term: string): string {
    const genericMap: { [key: string]: string } = {
      'tax': 'business',
      'preparation': 'service',
      'filing': 'process',
      'return': 'document',
      'refund': 'outcome',
      'season': 'period',
      'deadline': 'timeline',
      'audit': 'review',
      'software': 'product',
      'professional': 'service',
      'diy': 'self-service'
    };
    
    return genericMap[term.toLowerCase()] || 'service';
  }

  /**
   * Expand synonyms in query
   */
  private expandSynonyms(query: string, synonyms: { [key: string]: string[] }): string[] {
    const terms = query.toLowerCase().split(/\s+/);
    const expandedTerms = new Set(terms);
    
    for (const [key, synonymList] of Object.entries(synonyms)) {
      if (query.toLowerCase().includes(key.toLowerCase())) {
        synonymList.forEach(synonym => {
          expandedTerms.add(synonym.toLowerCase());
        });
      }
    }
    
    return Array.from(expandedTerms);
  }

  /**
   * Map entities to domain context
   */
  private mapEntitiesToDomain(
    expandedTerms: string[], 
  entities: DomainConfiguration['vocabulary']['entities']
  ): { [entityType: string]: string[] } {
    const entityContext: { [entityType: string]: string[] } = {};
    
    for (const [entityType, entityTerms] of Object.entries(entities)) {
      const matchedTerms = expandedTerms.filter(term => 
        (entityTerms as string[]).some(entityTerm => 
          term.includes(entityTerm.toLowerCase()) || 
          entityTerm.toLowerCase().includes(term)
        )
      );
      
      if (matchedTerms.length > 0) {
        entityContext[entityType] = matchedTerms;
      }
    }
    
    return entityContext;
  }

  /**
   * Calculate domain relevance score
   */
  private calculateDomainRelevance(
    query: string,
    domain: DomainConfiguration,
    expandedTerms?: string[]
  ): number {
    const queryLower = query.toLowerCase();
    let relevanceScore = 0;
    const domainTerms = domain.vocabulary.domain_terms;

    // Primary terms (highest weight)
    for (const term of domainTerms.primary) {
      if (queryLower.includes(term.toLowerCase())) {
        relevanceScore += 0.4;
      }
    }

    // Secondary terms (medium weight)
    for (const term of domainTerms.secondary) {
      if (queryLower.includes(term.toLowerCase())) {
        relevanceScore += 0.3;
      }
    }

    // Context terms (lower weight)
    for (const term of domainTerms.context) {
      if (queryLower.includes(term.toLowerCase())) {
        relevanceScore += 0.2;
      }
    }

    // Synonym key matches (broad business vocabulary)
    const synonymKeys = Object.keys(domain.synonyms || {});
    const allTerms = new Set<string>([...synonymKeys, ...(expandedTerms || [])]);
    for (const t of allTerms) {
      if (queryLower.includes(t.toLowerCase())) {
        relevanceScore += 0.05; // small incremental boosts
      }
    }

    return Math.min(1.0, relevanceScore);
  }

  /**
   * Score an endpoint candidate
   */
  private scoreEndpointCandidate(
    endpoint: string,
  config: DomainEndpointConfig,
  enhancedQuery: EnhancedQuery
  ): EndpointCandidate {
    let baseScore = 0;
    const reasoning: string[] = [];
    const boosts: Array<{ type: string; score: number; reason: string }> = [];
    
    // Score based on base intent match
    if (config.primary_intents.includes(enhancedQuery.base_intent.primary_intent)) {
      const intentBonus = 0.7; // Increased to strengthen clear intent alignment
      baseScore += intentBonus;
      reasoning.push(`Primary intent match: ${enhancedQuery.base_intent.primary_intent}`);
      boosts.push({
        type: 'intent_match',
        score: intentBonus,
        reason: 'Primary intent alignment'
      });
    }
    
    // Score based on boost terms - check both original query and expanded terms
    const queryText = enhancedQuery.expanded_terms.join(' ');
    const originalQuery = enhancedQuery.original_query.toLowerCase();
    const boostMatches = config.boost_terms.filter((term: string) =>
      queryText.includes(term.toLowerCase()) || originalQuery.includes(term.toLowerCase())
    );
    
    if (boostMatches.length > 0) {
      const boostScore = boostMatches.length * 0.4; // Increased to reward strong phrasing
      baseScore += boostScore;
      reasoning.push(`Boost terms: ${boostMatches.join(', ')}`);
      boosts.push({
        type: 'boost_terms',
        score: boostScore,
        reason: `Matched ${boostMatches.length} boost terms`
      });
    }
    
    // Penalty for penalty terms
    const penalties: Array<{ type: string; score: number; reason: string }> = [];
    const penaltyMatches = config.penalty_terms.filter((term: string) =>
      queryText.includes(term.toLowerCase())
    );
    
    if (penaltyMatches.length > 0) {
      const penaltyScore = penaltyMatches.length * 0.25; // Stronger penalty to curb cross-contamination
      baseScore -= penaltyScore;
      reasoning.push(`Penalty terms: ${penaltyMatches.join(', ')}`);
      penalties.push({
        type: 'penalty_terms',
        score: penaltyScore,
        reason: `Matched ${penaltyMatches.length} penalty terms`
      });
    }
    
    // Domain relevance bonus
    if (enhancedQuery.domain_relevance > 0.25) {
      const domainBonus = enhancedQuery.domain_relevance * 0.3; // Stronger domain relevance
      baseScore += domainBonus;
      reasoning.push(`Domain relevance: ${(enhancedQuery.domain_relevance * 100).toFixed(1)}%`);
      boosts.push({
        type: 'domain_relevance',
        score: domainBonus,
        reason: 'High domain relevance'
      });
    }
    
    // Additional targeted penalties to prevent strategic from hijacking demographic queries
    if (endpoint.includes('strategic') && (/\bdemographic(s)?\b|\bpopulation\b/i.test(originalQuery))) {
      const targetedPenalty = 0.5;
      baseScore -= targetedPenalty;
      reasoning.push('Targeted penalty: demographic intent detected');
      penalties.push({ type: 'targeted', score: targetedPenalty, reason: 'Demographic terms present' });
    }
    if (endpoint.includes('strategic') && (/\b(competitive|competition|positioning)\b/i.test(originalQuery))) {
      const targetedPenalty = 0.25;
      baseScore -= targetedPenalty;
      reasoning.push('Targeted penalty: competitive intent detected');
      penalties.push({ type: 'targeted', score: targetedPenalty, reason: 'Competitive terms present' });
    }

    // Brand difference targeted bonus when explicit brand-vs-brand comparison present
    if (endpoint.includes('brand-difference')) {
      const hasVsExplicit = /\b(vs\.?|versus)\b/i.test(originalQuery);
      // Also consider comparative phrasing without 'vs' but with two brand-like mentions
      const hasCompareContextOnly = /\b(compare|between)\b/i.test(originalQuery);
      // Require presence of at least two brand/company-like tokens to avoid generic usage
      const brandLikeGlobal = /(h&r\s*block|turbotax|taxact|freetaxusa|\binc\b|\bcorp\b|\bllc\b|\bbrand(s)?\b|\bcompany|\bcompanies|\bservice(s)?)/gi;
      const brandCount = (originalQuery.match(brandLikeGlobal) || []).length;
      if (brandCount >= 2 && (hasVsExplicit || hasCompareContextOnly)) {
        const targetedBonus = hasVsExplicit ? 0.7 : 0.5; // stronger when explicit vs/versus
        baseScore += targetedBonus;
        reasoning.push('Targeted bonus: explicit brand comparison');
        boosts.push({ type: 'targeted', score: targetedBonus, reason: hasVsExplicit ? 'Brand vs Brand (vs/versus)' : 'Brand vs Brand (compare/between)' });
      }
    }

    // Business context bonus - help queries that contain business language
  const businessContextBonus = this.calculateBusinessContextBonus(enhancedQuery.original_query);
    if (businessContextBonus > 0) {
      baseScore += businessContextBonus;
      reasoning.push(`Business context bonus: ${businessContextBonus.toFixed(3)}`);
      boosts.push({
        type: 'business_context',
        score: businessContextBonus,
        reason: 'Contains business analysis language'
      });
    }
    
    // Open-ended business query bonus - extra confidence for non-predefined business queries
  const openEndedBonus = this.calculateOpenEndedBusinessBonus(enhancedQuery.original_query);
    if (openEndedBonus > 0) {
      baseScore += openEndedBonus;
      reasoning.push(`Open-ended business bonus: ${openEndedBonus.toFixed(3)}`);
      boosts.push({
        type: 'open_ended_business',
        score: openEndedBonus,
        reason: 'Well-structured business analysis query'
      });
    }
    
    // Competitive tie-breakers and targeted boosts/penalties
  const hasCompetitivePhrasing = /\b(competitive|competition|competitive\s+positioning|positioning|stack\s+up\s+against)\b/i.test(originalQuery);
    const hasCompareContext = /\b(compare|between)\b/i.test(originalQuery);
    const hasVs = /\b(vs\.?|versus)\b/i.test(originalQuery);
  const brandRegexGlobal = /(h&r\s*block|turbotax|taxact|freetaxusa|\binc\b|\bcorp\b|\bllc\b|\bbrand(s)?\b|\bcompany|\bcompanies|\bservice(s)?)/gi;
  const brandMentions = (originalQuery.match(brandRegexGlobal) || []).length;

    // If query explicitly asks to compare competitive positioning, boost competitive endpoint
    if (endpoint.includes('competitive-analysis') && hasCompetitivePhrasing && hasCompareContext) {
      baseScore += 0.5;
      reasoning.push('Targeted bonus: compare competitive positioning');
      boosts.push({ type: 'targeted', score: 0.5, reason: 'Compare competitive positioning' });
    }

    // Damp strategic when competitive phrasing is present (tie-breaker)
    if (endpoint.includes('strategic') && hasCompetitivePhrasing) {
      baseScore -= 0.45;
      reasoning.push('Tie-breaker penalty: competitive phrasing present');
      penalties.push({ type: 'tiebreaker', score: 0.45, reason: 'Competitive phrasing present' });
    }

    // When brand-vs-brand is present, penalize competitive so brand-difference wins
    if (endpoint.includes('competitive-analysis') && brandMentions >= 2 && (hasVs || hasCompareContext)) {
      const penalty = hasVs ? 0.6 : 0.4; // stronger when explicit vs/versus
      baseScore -= penalty;
      reasoning.push('Targeted penalty: brand-vs-brand comparison should route to brand-difference');
      penalties.push({ type: 'tiebreaker', score: penalty, reason: hasVs ? 'Brand vs Brand (vs/versus)' : 'Brand vs Brand (compare/between)' });
    }

    // Brand-vs normalization: avoid 1.0 vs 1.0 ties by capping competitive and flooring brand-difference
    if (brandMentions >= 2 && (hasVs || hasCompareContext)) {
      if (endpoint.includes('competitive-analysis')) {
        const cap = hasVs ? 0.95 : 0.9; // keep competitive below brand-difference in explicit brand comparisons
        if (baseScore > cap) {
          const delta = baseScore - cap;
          baseScore = cap;
          reasoning.push('Tie-breaker cap: brand-vs-brand routes to brand-difference');
          penalties.push({ type: 'tiebreaker', score: delta, reason: 'Competitive capped in brand-vs-brand' });
        }
      } else if (endpoint.includes('brand-difference')) {
        const floor = hasVs ? 0.96 : 0.92; // ensure brand-difference edges out competitive
        if (baseScore < floor) {
          const delta = floor - baseScore;
          baseScore = floor;
          reasoning.push('Tie-breaker floor: favor brand-difference for brand-vs-brand');
          boosts.push({ type: 'tiebreaker', score: delta, reason: 'Brand-difference floored in brand-vs-brand' });
        }
      }
    }

    // Ensure score is within [0, 1]
    const confidence = Math.min(1.0, Math.max(0, baseScore));
    
    return {
      endpoint,
      confidence,
      base_score: baseScore,
      reasoning,
      boosts: boosts.length > 0 ? boosts : undefined,
      penalties: penalties.length > 0 ? penalties : undefined
    };
  }

  /**
   * Calculate avoidance penalty
   */
  private calculateAvoidancePenalty(reasoning: string, avoidTerms: string[], originalQuery?: string): number {
    if (avoidTerms.length === 0) return 0;
    
    const matchedTerms = avoidTerms.filter(term =>
      reasoning.toLowerCase().includes(term.toLowerCase()) || (originalQuery ? originalQuery.toLowerCase().includes(term.toLowerCase()) : false)
    );
    
    return matchedTerms.length > 0 ? Math.min(0.3, matchedTerms.length * 0.1) : 0;
  }

  /**
   * Calculate overall domain confidence
   */
  private calculateOverallDomainConfidence(
    enhancedQuery: EnhancedQuery,
    candidates: EndpointCandidate[]
  ): number {
    const topCandidate = candidates[0];
    const domainRelevance = enhancedQuery.domain_relevance;
    const intentConfidence = enhancedQuery.base_intent.confidence;
    const candidateConfidence = topCandidate ? topCandidate.confidence : 0;
    
  return Math.min(1.0, (domainRelevance * 0.3 + intentConfidence * 0.3 + candidateConfidence * 0.4));
  }

  /**
   * Get applied synonyms for metadata
   */
  private getAppliedSynonyms(original: string, normalized: string): string[] {
    if (original.toLowerCase() === normalized.toLowerCase()) {
      return [];
    }
    return ['synonyms_applied']; // Simplified for now
  }

  /**
   * Get expanded entities for metadata
   */
  private getExpandedEntities(entityContext: { [entityType: string]: string[] }): string[] {
    return Object.keys(entityContext);
  }

  /**
   * Get relevance factors for metadata
   */
  private getRelevanceFactors(query: string, domain: DomainConfiguration): string[] {
    const factors: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Check for domain term categories
    if (domain.vocabulary.domain_terms.primary.some(term => queryLower.includes(term.toLowerCase()))) {
      factors.push('primary_domain_terms');
    }
    
    if (domain.vocabulary.domain_terms.secondary.some(term => queryLower.includes(term.toLowerCase()))) {
      factors.push('secondary_domain_terms');
    }
    
    if (domain.vocabulary.domain_terms.context.some(term => queryLower.includes(term.toLowerCase()))) {
      factors.push('context_terms');
    }
    
    return factors;
  }

  /**
   * Count domain term matches for metadata
   */
  private countDomainTermMatches(query: string, domain: DomainConfiguration): number {
    const queryLower = query.toLowerCase();
    const allTerms = [
      ...domain.vocabulary.domain_terms.primary,
      ...domain.vocabulary.domain_terms.secondary,
      ...domain.vocabulary.domain_terms.context
    ];
    
    return allTerms.filter(term => queryLower.includes(term.toLowerCase())).length;
  }

  /**
   * Debug method to show adaptation process
   */
  debugAdaptation(
    query: string,
    baseIntent: IntentClassification,
    domain: DomainConfiguration
  ): {
    input: { query: string; base_intent: string; intent_confidence: number };
    processing: {
      normalized_query: string;
      expanded_terms: string[];
      entity_context: { [key: string]: string[] };
      domain_relevance: number;
    };
    candidates: Array<{
      endpoint: string;
      confidence: number;
      reasoning: string[];
      boosts: number;
      penalties: number;
    }>;
    metadata: DomainAdaptationResult['adaptation_metadata'];
  } {
    const result = this.adaptToDomain(query, baseIntent, domain);
    
    return {
      input: {
        query,
        base_intent: baseIntent.primary_intent,
        intent_confidence: baseIntent.confidence
      },
      processing: {
        normalized_query: result.enhanced_query.normalized_query,
        expanded_terms: result.enhanced_query.expanded_terms,
        entity_context: result.enhanced_query.entity_context,
        domain_relevance: result.enhanced_query.domain_relevance
      },
      candidates: result.candidates.map(c => ({
        endpoint: c.endpoint,
        confidence: c.confidence,
        reasoning: c.reasoning,
        boosts: c.boosts?.length || 0,
        penalties: c.penalties?.length || 0
      })),
      metadata: result.adaptation_metadata
    };
  }

  /**
   * Calculate business context bonus for queries that sound business-oriented
   */
  private calculateBusinessContextBonus(query: string): number {
    const queryLower = query.toLowerCase();
    let bonus = 0;
    
    // Business action words (+0.05 each)
    const businessActions = ['analyze', 'compare', 'identify', 'evaluate', 'assess', 'examine', 'understand', 'explore', 'break down', 'show me', 'help me', 'what', 'how', 'which', 'where'];
    for (const action of businessActions) {
      if (queryLower.includes(action)) {
        bonus += 0.05;
        break; // Only count once per category
      }
    }
    
    // Business subjects (+0.05)
    const businessSubjects = ['market', 'customer', 'performance', 'data', 'analysis', 'insights', 'patterns', 'trends', 'segments', 'areas', 'regions', 'characteristics', 'factors', 'dynamics'];
    for (const subject of businessSubjects) {
      if (queryLower.includes(subject)) {
        bonus += 0.05;
        break; // Only count once per category
      }
    }
    
    // Business qualifiers (+0.03)
    const businessQualifiers = ['best', 'top', 'high', 'low', 'most', 'different', 'similar', 'key', 'important', 'strategic', 'competitive'];
    for (const qualifier of businessQualifiers) {
      if (queryLower.includes(qualifier)) {
        bonus += 0.03;
        break; // Only count once per category
      }
    }
    
    return bonus;
  }

  /**
   * Calculate bonus for well-structured open-ended business queries
   */
  private calculateOpenEndedBusinessBonus(query: string): number {
    const queryLower = query.toLowerCase();
    
    // Check if this looks like a predefined query (skip bonus for those)
    const predefinedPatterns = [
      'show me the top strategic markets', 'compare red bull usage', 'market share difference',
      'best customer demographics', 'ideal customer personas', 'geographic clusters',
      'outliers with unique', 'best competitive positioning', 'pricing strategy',
      'strongest interactions', 'clearest customer segmentation', 'rankings change',
      'most important factors', 'how accurate are our predictions', 'ai model performs best',
      'highest confidence predictions', 'optimal ai algorithm', 'explain most of the variation',
      'all our ai models agree', 'unusual market patterns', 'segment energy drink markets',
      'comprehensive market insights', 'most strongly correlated', 'trend patterns',
      'most likely to grow'
    ];
    
    // If it matches predefined patterns, no bonus
    for (const pattern of predefinedPatterns) {
      if (queryLower.includes(pattern)) {
        return 0;
      }
    }
    
    let bonus = 0;
    
    // Well-structured question patterns get significant bonus
    const questionPatterns = [
      /^what\s+(patterns|story|factors|characteristics|would|are)/,
      /^how\s+(do|does|can|should)/,
      /^which\s+(areas|markets|segments|characteristics)/,
      /^show\s+me\s+(which|how|what)/,
      /^help\s+me\s+(identify|understand)/,
      /^can\s+you\s+(break\s+down|help|identify)/,
      /^i\s+want\s+to\s+(understand|see)/
    ];
    
    for (const pattern of questionPatterns) {
      if (pattern.test(queryLower)) {
        bonus += 0.25; // Larger bonus for well-formed questions (was 0.15)
        break;
      }
    }
    
    // Complex business language gets bonus
    const complexBusinessTerms = [
      'dynamics', 'characteristics', 'distinguishing', 'predictive', 
      'similar but untapped', 'clusters of similar', 'potential for growth',
      'seasonal trends affect', 'patterns emerge', 'break down', 'key factors'
    ];
    
    let complexTermCount = 0;
    for (const term of complexBusinessTerms) {
      if (queryLower.includes(term)) {
        complexTermCount++;
      }
    }
    
    if (complexTermCount > 0) {
      bonus += Math.min(0.1, complexTermCount * 0.03); // Up to 0.1 bonus
    }
    
    return bonus;
  }
}