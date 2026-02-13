/**
 * Hybrid Routing Engine
 * 
 * Integrates all routing layers into a cohesive system with proper query validation
 */

import { BaseIntentClassifier } from './BaseIntentClassifier';
import { DomainVocabularyAdapter } from './DomainVocabularyAdapter';
import { ContextEnhancementEngine } from './ContextEnhancementEngine';
import { QueryValidator } from './QueryValidator';
import { AdaptiveConfidenceManager } from './ConfidenceManager';
import { domainConfigLoader } from './DomainConfigurationLoader';

import { 
  DomainConfiguration, 
  QueryScope, 
  ValidationResult 
} from './types/DomainTypes';
import { 
  DatasetContext, 
  ContextuallyEnhancedCandidate 
} from './types/ContextTypes';
import { IntentClassification } from './types/BaseIntentTypes';

export interface HybridRoutingResult {
  success: boolean;
  endpoint?: string;
  confidence?: number;
  validation: ValidationResult;
  reasoning: string[];
  alternatives?: Array<{
    endpoint: string;
    confidence: number;
    description: string;
  }>;
  routing_layers: {
    validation: ValidationResult;
    base_intent: IntentClassification;
    domain_enhancement: any;
    context_boost: any;
    final_decision: ContextuallyEnhancedCandidate | null;
  };
  user_response: UserResponse;
  processing_time: number;
  metadata: {
    query_signature: string;
    domain_used: string;
    layers_executed: string[];
    early_exit?: string;
  };
}

export interface UserResponse {
  type: 'success' | 'clarification' | 'rejection' | 'fallback';
  message: string;
  endpoint?: string;
  confidence?: number;
  alternatives?: Array<{
    endpoint: string;
    confidence: number;
    description: string;
  }>;
  suggestions?: string[];
  help_resources?: Array<{
    title: string;
    url: string;
  }>;
}

export class HybridRoutingEngine {
  private baseIntentClassifier: BaseIntentClassifier;
  private domainAdapter: DomainVocabularyAdapter;
  private contextEngine: ContextEnhancementEngine;
  private queryValidator: QueryValidator;
  private confidenceManager: AdaptiveConfidenceManager;
  private responseGenerator: UserResponseGenerator;
  
  constructor() {
    this.baseIntentClassifier = new BaseIntentClassifier();
    this.domainAdapter = new DomainVocabularyAdapter();
    this.contextEngine = new ContextEnhancementEngine();
    this.queryValidator = new QueryValidator();
    this.confidenceManager = new AdaptiveConfidenceManager();
    this.responseGenerator = new UserResponseGenerator();
  }

  /**
   * Route a query through the hybrid system
   */
  async route(
    query: string, 
    datasetContext?: DatasetContext
  ): Promise<HybridRoutingResult> {
    const startTime = performance.now();
    const layersExecuted: string[] = [];
    const domain = domainConfigLoader.getActiveConfiguration();
    
    try {
      // Step 0: Query Validation (NEW)
      layersExecuted.push('validation');
      const validation = this.queryValidator.validateQuery(query, domain);
      
      // Early exit for clearly out-of-scope queries
  if (validation.scope === QueryScope.OUT_OF_SCOPE && validation.confidence >= 0.6) {
        return this.createEarlyExitResult(
          query, 
          validation, 
          layersExecuted, 
          startTime, 
          domain,
          'out_of_scope_rejection'
        );
      }
      
      // Step 1: Base Intent Classification
      layersExecuted.push('base_intent');
      const baseIntent = this.baseIntentClassifier.classifyIntent(query);
      
      // Step 2: Domain Vocabulary Enhancement
      layersExecuted.push('domain_adaptation');
      const adaptationResult = this.domainAdapter.adaptToDomain(query, baseIntent, domain);
      
      // Step 3: Context Enhancement (if dataset context available)
      let contextualCandidates: ContextuallyEnhancedCandidate[] = [];
      
      if (datasetContext) {
        layersExecuted.push('context_enhancement');
        contextualCandidates = await this.contextEngine.enhanceWithDatasetContext(
          adaptationResult.enhanced_query,
          adaptationResult.candidates,
          datasetContext
        );
      } else {
        // Convert domain candidates to contextual format without context
        contextualCandidates = adaptationResult.candidates.map(candidate => ({
          endpoint: candidate.endpoint,
          base_score: candidate.confidence,
          contextual_score: candidate.confidence,
          final_confidence: candidate.confidence,
          enhancements: [],
          field_requirements: { required: [], optional: [], coverage_score: 1.0 },
          historical_performance: { success_rate: 0.5, frequency: 0, avg_confidence: 0.5 },
          reasoning: candidate.reasoning
        }));
      }
      
      // Sort by final confidence
      contextualCandidates.sort((a, b) => b.final_confidence - a.final_confidence);
      
      // Step 4: Confidence Management and Final Decision
      layersExecuted.push('confidence_management');
      const topCandidate = contextualCandidates[0] || null;
      const recommendedAction = this.confidenceManager.getRecommendedAction(
        topCandidate?.final_confidence || 0,
        validation,
        contextualCandidates.slice(0, 3)
      );
      
      const endTime = performance.now();
      
      // Build routing result
      const routingResult: HybridRoutingResult = {
        success: recommendedAction.action === 'route' || recommendedAction.action === 'route_with_warning',
        endpoint: topCandidate?.endpoint,
        confidence: topCandidate?.final_confidence,
        validation: validation,
        reasoning: this.generateDetailedReasoning(topCandidate, adaptationResult.enhanced_query, baseIntent),
        alternatives: contextualCandidates.slice(1, 4).map(candidate => ({
          endpoint: candidate.endpoint,
          confidence: candidate.final_confidence,
          description: this.getEndpointDescription(candidate.endpoint)
        })),
        routing_layers: {
          validation: validation,
          base_intent: baseIntent,
          domain_enhancement: adaptationResult,
          context_boost: topCandidate?.enhancements || [],
          final_decision: topCandidate
        },
        user_response: {
          type: 'success',
          message: 'Processing...',
          endpoint: topCandidate?.endpoint,
          confidence: topCandidate?.final_confidence
        },
        processing_time: endTime - startTime,
        metadata: {
          query_signature: this.createQuerySignature(query),
          domain_used: domain.domain.name,
          layers_executed: layersExecuted
        }
      };
      
      // Set user response after building the result
      routingResult.user_response = this.responseGenerator.generateResponse(
        query, 
        routingResult, 
        validation, 
        recommendedAction
      );
      
      return routingResult;
      
    } catch (error) {
      return this.createErrorResult(query, error, layersExecuted, startTime, domain);
    }
  }

  /**
   * Create early exit result for rejected queries
   */
  private createEarlyExitResult(
    query: string,
    validation: ValidationResult,
    layersExecuted: string[],
    startTime: number,
    domain: DomainConfiguration,
    exitReason: string
  ): HybridRoutingResult {
    const endTime = performance.now();
    
    const dummyIntent = {
      primary_intent: 'general_exploration' as any,
      confidence: 0,
      secondary_intents: [],
      matched_categories: 0,
      reasoning: ['Early exit due to validation']
    };
    
    return {
      success: false,
      validation: validation,
      reasoning: ['Query rejected during validation phase'],
      routing_layers: {
        validation: validation,
        base_intent: dummyIntent,
        domain_enhancement: null,
        context_boost: null,
        final_decision: null
      },
      user_response: this.responseGenerator.generateRejectionResponse(query, validation),
      processing_time: endTime - startTime,
      metadata: {
        query_signature: this.createQuerySignature(query),
        domain_used: domain.domain.name,
        layers_executed: layersExecuted,
        early_exit: exitReason
      }
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(
    query: string,
    error: any,
    layersExecuted: string[],
    startTime: number,
    domain: DomainConfiguration
  ): HybridRoutingResult {
    const endTime = performance.now();
    
    console.error('[HybridRoutingEngine] Routing error:', error);
    
    const dummyValidation: ValidationResult = {
      scope: QueryScope.IN_SCOPE,
      confidence: 0.5,
      reasons: ['Error during routing']
    };
    
    const dummyIntent = {
      primary_intent: 'general_exploration' as any,
      confidence: 0,
      secondary_intents: [],
      matched_categories: 0,
      reasoning: ['Error occurred during processing']
    };
    
    return {
      success: false,
      endpoint: '/analyze', // Safe fallback
      confidence: 0.3,
      validation: dummyValidation,
      reasoning: [`Routing error: ${error.message}`, 'Falling back to general analysis'],
      routing_layers: {
        validation: dummyValidation,
        base_intent: dummyIntent,
        domain_enhancement: null,
        context_boost: null,
        final_decision: null
      },
      user_response: {
        type: 'fallback',
        message: 'I encountered an issue while analyzing your query, but I\'ll try to help with general market analysis.',
        endpoint: '/analyze',
        confidence: 0.3
      },
      processing_time: endTime - startTime,
      metadata: {
        query_signature: this.createQuerySignature(query),
        domain_used: domain.domain.name,
        layers_executed: layersExecuted,
        early_exit: 'error_fallback'
      }
    };
  }

  /**
   * Generate detailed reasoning chain
   */
  private generateDetailedReasoning(
    topCandidate: ContextuallyEnhancedCandidate | null,
    enhancedQuery: any,
    baseIntent: IntentClassification
  ): string[] {
    const reasoning: string[] = [];
    
    if (baseIntent) {
      reasoning.push(`Base intent: ${baseIntent.primary_intent} (${Math.round(baseIntent.confidence * 100)}% confidence)`);
      if (baseIntent.secondary_intents.length > 0) {
        reasoning.push(`Secondary intents: ${baseIntent.secondary_intents.map(si => si.intent).join(', ')}`);
      }
    }
    
    if (enhancedQuery) {
      if (enhancedQuery.domain_relevance > 0.3) {
        reasoning.push(`Domain relevance: ${Math.round(enhancedQuery.domain_relevance * 100)}%`);
      }
      if (Object.keys(enhancedQuery.entity_context).length > 0) {
        reasoning.push(`Entity context: ${Object.keys(enhancedQuery.entity_context).join(', ')}`);
      }
    }
    
    if (topCandidate) {
      reasoning.push(`Selected endpoint: ${topCandidate.endpoint} (${Math.round(topCandidate.final_confidence * 100)}% confidence)`);
      
      if (topCandidate.enhancements.length > 0) {
        const enhancementSummary = topCandidate.enhancements
          .map(e => `${e.type}: ${Math.round(e.impact * 100)}%`)
          .join(', ');
        reasoning.push(`Context enhancements: ${enhancementSummary}`);
      }
      
      reasoning.push(...topCandidate.reasoning.slice(0, 2)); // Add top reasoning from candidate
    }
    
    return reasoning;
  }

  /**
   * Get endpoint description
   */
  private getEndpointDescription(endpoint: string): string {
    const descriptions: { [key: string]: string } = {
      '/analyze': 'General market analysis and insights',
      '/strategic-analysis': 'Strategic opportunities and expansion analysis',
      '/demographic-insights': 'Population and demographic analysis',
      '/competitive-analysis': 'Market competition and positioning',
      '/customer-profile': 'Ideal customer profiles and personas',
      '/comparative-analysis': 'Compare performance between locations',
      '/brand-difference': 'Brand positioning and market differences',
      '/predictive-modeling': 'Future market predictions',
      '/spatial-clusters': 'Geographic market segmentation'
    };
    
    return descriptions[endpoint] || 'Specialized analysis';
  }

  /**
   * Create query signature for caching/history
   */
  private createQuerySignature(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .sort()
      .slice(0, 8) // Limit to 8 key words
      .join('_');
  }

  /**
   * Initialize the routing engine
   */
  async initialize(): Promise<void> {
    console.log('[HybridRoutingEngine] Initializing...');
    const startTime = performance.now();
    
    // Initialize domain configuration if not already loaded
    if (domainConfigLoader.getAllConfigurations().length === 0) {
      domainConfigLoader.initializeWithDefaults();
    }
    
    const endTime = performance.now();
    console.log(`[HybridRoutingEngine] Initialized in ${Math.round(endTime - startTime)}ms`);
  }

  /**
   * Test the routing engine with sample queries
   */
  async testRouting(queries: string[], datasetContext?: DatasetContext): Promise<Array<{
    query: string;
    result: HybridRoutingResult;
  }>> {
    const results = [];
    
    for (const query of queries) {
      const result = await this.route(query, datasetContext);
      results.push({ query, result });
    }
    
    return results;
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): any {
    return {
      confidence_manager_stats: this.confidenceManager.getPerformanceStats(),
      active_domain: domainConfigLoader.getConfigurationSummary(),
      available_domains: domainConfigLoader.getAllConfigurations().length
    };
  }
}

/**
 * User Response Generator
 */
class UserResponseGenerator {
  generateResponse(
    query: string,
    routingResult: HybridRoutingResult,
    validation: ValidationResult,
    recommendedAction: any
  ): UserResponse {
    switch (recommendedAction.action) {
      case 'reject':
        return this.generateRejectionResponse(query, validation);
      case 'request_clarification':
        return this.generateClarificationResponse(query, routingResult, validation);
      case 'fallback_with_explanation':
        return this.generateFallbackResponse(query, routingResult);
      case 'route_with_warning':
        return this.generateWarningResponse(query, routingResult);
      default:
        return this.generateSuccessResponse(query, routingResult);
    }
  }

  generateRejectionResponse(query: string, validation: ValidationResult): UserResponse {
    return {
      type: 'rejection',
      message: validation.redirect_message || "I can only help with business analysis queries. This request appears to be outside that domain.",
      suggestions: validation.suggestions || [
        "Try asking about market analysis, competitive insights, or demographic trends",
        "Rephrase using analysis terms like 'analyze', 'compare', or 'evaluate'",
        "Specify a business context or geographic area for analysis"
      ],
      help_resources: [
        { title: "Query Examples", url: "/help/query-examples" },
        { title: "Analysis Types", url: "/help/analysis-types" }
      ]
    };
  }

  generateClarificationResponse(
    query: string,
    routingResult: HybridRoutingResult,
    validation: ValidationResult
  ): UserResponse {
    return {
      type: 'clarification',
      message: "I'm not completely sure what type of analysis you're looking for. Could you clarify or choose from these options?",
      alternatives: routingResult.alternatives?.slice(0, 3),
      suggestions: validation.suggestions || [
        "Be more specific about what you want to analyze",
        "Include terms like 'demographics', 'competition', or 'market trends'",
        "Specify a geographic area or customer segment"
      ]
    };
  }

  generateFallbackResponse(query: string, routingResult: HybridRoutingResult): UserResponse {
    return {
      type: 'fallback',
      message: `I'll do my best to analyze this using ${this.getEndpointName(routingResult.endpoint || '/analyze')}, though I'm not completely confident this matches what you're looking for.`,
      endpoint: routingResult.endpoint,
      confidence: routingResult.confidence,
      alternatives: routingResult.alternatives?.slice(0, 2),
      suggestions: [
        "If this doesn't match your intent, try rephrasing your query",
        "Consider using more specific business terminology",
        "Let me know if you need a different type of analysis"
      ]
    };
  }

  generateWarningResponse(query: string, routingResult: HybridRoutingResult): UserResponse {
    return {
      type: 'success',
      message: `Routing to ${this.getEndpointName(routingResult.endpoint || '')} with ${Math.round((routingResult.confidence || 0) * 100)}% confidence. Let me know if this doesn't match what you're looking for.`,
      endpoint: routingResult.endpoint,
      confidence: routingResult.confidence
    };
  }

  generateSuccessResponse(query: string, routingResult: HybridRoutingResult): UserResponse {
    return {
      type: 'success',
      message: `Analyzing using ${this.getEndpointName(routingResult.endpoint || '')}`,
      endpoint: routingResult.endpoint,
      confidence: routingResult.confidence
    };
  }

  private getEndpointName(endpoint: string): string {
    const names: { [key: string]: string } = {
      '/analyze': 'General Analysis',
      '/strategic-analysis': 'Strategic Analysis',
      '/demographic-insights': 'Demographic Analysis',
      '/competitive-analysis': 'Competitive Analysis',
      '/customer-profile': 'Customer Profiling',
      '/comparative-analysis': 'Comparative Analysis',
      '/brand-difference': 'Brand Analysis'
    };
    
    return names[endpoint] || 'Specialized Analysis';
  }
}

// Export singleton instance
export const hybridRoutingEngine = new HybridRoutingEngine();