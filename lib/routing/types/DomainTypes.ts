/**
 * Domain Configuration Types
 * 
 * Configurable domain-specific vocabulary and routing rules
 */

export interface DomainConfiguration {
  domain: {
    name: string;
    version: string;
    description: string;
    created_date: Date;
    updated_date: Date;
  };
  
  // Vocabulary mappings from generic to domain-specific
  vocabulary: {
    // Entity type mappings
    entities: {
      geographic_unit: string[];     // ['areas', 'markets', 'regions', 'territories']
      customer_unit: string[];       // ['customers', 'clients', 'users', 'consumers']
      competitor_unit: string[];     // ['brands', 'companies', 'competitors', 'players']
      product_unit: string[];        // ['services', 'products', 'offerings', 'solutions']
    };
    
    // Quality and performance terms
    qualifiers: {
      performance: string[];         // ['best', 'top', 'highest', 'optimal', 'leading']
      comparison: string[];          // ['difference', 'gap', 'versus', 'compared to']
      measurement: string[];         // ['score', 'rating', 'index', 'metric', 'value']
    };
    
    // Domain-specific terminology (configurable)
    domain_terms: {
      primary: string[];             // ['tax', 'preparation', 'filing', 'return']
      secondary: string[];           // ['service', 'software', 'professional', 'DIY']
      context: string[];             // ['season', 'deadline', 'refund', 'audit']
    };
  };
  
  // Synonym and variation mappings
  synonyms: {
    [key: string]: string[];         // 'demographics': ['demo', 'population data', 'customer data']
  };
  
  // Anti-patterns to avoid confusion
  avoid_terms: {
    [endpoint: string]: string[];    // '/customer-profile': ['demographic analysis', 'population study']
  };

  // Endpoint mappings
  endpoint_mappings: {
    [endpoint: string]: DomainEndpointConfig;
  };

  // Validation rules for query scope
  validation: QueryValidationConfig;
}

export interface DomainEndpointConfig {
  display_name: string;
  description: string;
  primary_intents: string[];        // Base intents this endpoint serves
  required_fields?: string[];       // Dataset fields required for this endpoint
  boost_terms: string[];           // Terms that boost confidence for this endpoint
  penalty_terms: string[];         // Terms that reduce confidence for this endpoint
  confidence_threshold: number;     // Minimum confidence to route to this endpoint
}

export interface QueryValidationConfig {
  // Domain-specific validation rules
  domain_indicators: {
    required_subjects: string[];     // ['market', 'analysis', 'business', 'data']
    required_actions: string[];      // ['analyze', 'compare', 'evaluate', 'assess']
    valid_contexts: string[];        // ['geographic', 'demographic', 'competitive']
  };
  
  // Out-of-scope detection patterns
  rejection_patterns: {
    personal_requests: string[];     // ['recipe', 'cooking', 'personal advice']
    technical_support: string[];     // ['fix', 'troubleshoot', 'error', 'bug']
    general_knowledge: string[];     // ['weather', 'news', 'definition', 'explain']
    creative_tasks: string[];        // ['write', 'create', 'generate story']
  };
  
  // Confidence thresholds for different actions
  thresholds: {
    accept_threshold: number;        // Above this: route normally
    clarify_threshold: number;       // Above this: ask for clarification
    reject_threshold: number;        // Below this: reject gracefully
  };
}

export interface EnhancedQuery {
  original_query: string;
  normalized_query: string;
  expanded_terms: string[];
  entity_context: {
    [entityType: string]: string[];
  };
  domain_relevance: number;
  base_intent: any;                // From BaseIntentClassification
  processing_metadata: {
    processing_time: number;
    applied_synonyms: string[];
    expanded_entities: string[];
    relevance_factors: string[];
  };
}

export interface EndpointCandidate {
  endpoint: string;
  confidence: number;
  base_score: number;
  reasoning: string[];
  penalties?: Array<{
    type: string;
    score: number;
    reason: string;
  }>;
  boosts?: Array<{
    type: string;
    score: number;
    reason: string;
  }>;
}

export interface DomainAdaptationResult {
  enhanced_query: EnhancedQuery;
  candidates: EndpointCandidate[];
  domain_confidence: number;
  // Surface domain relevance directly for consumers/tests
  domain_relevance?: number;
  adaptation_metadata: {
    synonyms_applied: number;
    entities_expanded: number;
    domain_terms_matched: number;
    avoidance_penalties: number;
  };
}

export enum QueryScope {
  IN_SCOPE = 'in_scope',
  BORDERLINE = 'borderline',
  OUT_OF_SCOPE = 'out_of_scope',
  MALFORMED = 'malformed'
}

export interface ValidationResult {
  scope: QueryScope;
  confidence: number;
  reasons: string[];
  suggestions?: string[];
  redirect_message?: string;
}