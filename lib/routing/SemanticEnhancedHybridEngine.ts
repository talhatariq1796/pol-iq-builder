/**
 * Semantic Enhanced Hybrid Routing Engine
 * 
 * Combines the robust validation and structure of HybridRoutingEngine
 * with the semantic understanding power of SemanticRouter for optimal
 * query routing that handles both structured and creative queries.
 */

import { HybridRoutingEngine, HybridRoutingResult } from './HybridRoutingEngine';
import { semanticRouter } from '../analysis/SemanticRouter';
import { DatasetContext } from './types/ContextTypes';
import { QueryScope } from './types/DomainTypes';
import { BaseIntent } from './types/BaseIntentTypes';
// Lazy import to break circular dependency
import type { MultiEndpointAnalysisEngine, MultiEndpointAnalysisOptions, MultiEndpointAnalysisResult } from '../analysis/MultiEndpointAnalysisEngine';

export interface SemanticEnhancedResult extends HybridRoutingResult {
  semantic_verification?: {
    used: boolean;
    semantic_confidence?: number;
    semantic_endpoint?: string;
    confidence_boost?: number;
    reasoning: string;
  };
  multi_target_detection?: {
    is_multi_target: boolean;
    target_variables?: string[];
    analysis_type?: string;
    confidence?: number;
    routing_strategy?: 'single' | 'multi_target';
    fallback_used?: boolean;
  };
  multiTargetResult?: MultiEndpointAnalysisResult;
}

export class SemanticEnhancedHybridEngine {
  private hybridEngine: HybridRoutingEngine;
  private multiTargetEngine: MultiEndpointAnalysisEngine | null = null;
  private useSemanticEnhancement: boolean = true;
  private semanticThreshold: number = 0.3;
  private multiTargetThreshold: number = 0.6;
  private enableMultiTargetDetection: boolean = true;
  
  constructor() {
    this.hybridEngine = new HybridRoutingEngine();
    // Lazy load MultiEndpointAnalysisEngine to break circular dependency
    this.initializeSemanticEnhancement();
  }

  /**
   * Lazy load MultiEndpointAnalysisEngine to break circular dependency
   */
  private async getMultiTargetEngine(): Promise<MultiEndpointAnalysisEngine> {
    if (this.multiTargetEngine === null) {
      try {
        const { MultiEndpointAnalysisEngine } = await import('../analysis/MultiEndpointAnalysisEngine');
        this.multiTargetEngine = new MultiEndpointAnalysisEngine();
      } catch (error) {
        console.error('[SemanticEnhancedHybrid] Failed to load MultiEndpointAnalysisEngine:', error);
        throw new Error('Failed to initialize multi-target analysis capabilities');
      }
    }
    return this.multiTargetEngine;
  }

  /**
   * Initialize semantic enhancement asynchronously
   */
  private async initializeSemanticEnhancement(): Promise<void> {
    try {
  console.log('[SemanticEnhancedHybrid] Initializing semantic enhancement...');
  // Attempt to initialize semantic router on all environments (tests may mock semanticRouter)
  await semanticRouter.initialize();
  this.useSemanticEnhancement = semanticRouter.isReady();
  console.log('[SemanticEnhancedHybrid] Semantic enhancement ready:', this.useSemanticEnhancement);
    } catch (error) {
      // If embeddings/local init fails (common in test/server env), still enable semantic
      // enhancement so that the SemanticRouter can apply its keyword-based fallback.
      console.warn('[SemanticEnhancedHybrid] Failed to initialize semantic enhancement (embeddings may be unavailable):', error);
      this.useSemanticEnhancement = true; // allow semanticRouter.route() to run and fallback to keywords
    }
  }

  /**
   * Apply explicit routing rules for queries that consistently mismatch
   * These rules are applied BEFORE the standard routing logic
   */
  private applyExplicitRoutingRules(query: string): SemanticEnhancedResult | null {
    const lowerQuery = query.toLowerCase().trim();

    // Rule 1: Demographics queries with "what are the demographics"
    if (
      lowerQuery.includes('what are the demographics') ||
      (lowerQuery.includes('demographics of') && lowerQuery.includes('area'))
    ) {
      return this.createExplicitResult(
        '/demographic-analysis',
        'Explicit rule: Direct demographic inquiry',
        query
      );
    }

    // Rule 2: Development potential with "what is the development potential"
    if (
      lowerQuery.includes('what is the development potential') ||
      (lowerQuery.includes('development potential of') && lowerQuery.includes('area'))
    ) {
      return this.createExplicitResult(
        '/development-potential-analysis',
        'Explicit rule: Direct development potential inquiry',
        query
      );
    }

    // Rule 3: Development suitability with "suitable" + "development"
    if (
      (lowerQuery.includes('suitable') && lowerQuery.includes('development')) ||
      (lowerQuery.includes('how suitable') && lowerQuery.includes('area'))
    ) {
      return this.createExplicitResult(
        '/development-potential-analysis',
        'Explicit rule: Development suitability inquiry',
        query
      );
    }

    // Rule 4: Growth potential with "what is the growth potential"
    if (
      lowerQuery.includes('what is the growth potential') ||
      (lowerQuery.includes('growth potential of') && lowerQuery.includes('area'))
    ) {
      return this.createExplicitResult(
        '/growth-potential-analysis',
        'Explicit rule: Direct growth potential inquiry',
        query
      );
    }

    return null; // No explicit rule matched
  }

  /**
   * Create a SemanticEnhancedResult for explicit routing rules
   */
  private createExplicitResult(
    endpoint: string,
    reasoning: string,
    query: string
  ): SemanticEnhancedResult {
    return {
      endpoint,
      confidence: 1.0,
      success: true,
      reasoning: [reasoning, 'Query matched explicit routing rule', 'Bypassed standard routing logic'],
      validation: {
        scope: QueryScope.IN_SCOPE,
        confidence: 1.0,
        reasons: ['Explicit routing rule applied']
      },
      routing_layers: {
        validation: {
          scope: QueryScope.IN_SCOPE,
          confidence: 1.0,
          reasons: ['Explicit rule validation']
        },
        base_intent: {
          primary_intent: BaseIntent.COMPARATIVE_ANALYSIS,
          confidence: 1.0,
          secondary_intents: [],
          matched_categories: 1,
          reasoning: ['Explicit routing rule']
        },
        domain_enhancement: {},
        context_boost: {},
        final_decision: null
      },
      user_response: {
        type: 'success',
        message: `Query routed via explicit rule to ${endpoint}`,
        endpoint,
        confidence: 1.0
      },
      processing_time: 0,
      metadata: {
        query_signature: 'explicit_rule',
        domain_used: 'real_estate',
        layers_executed: ['explicit_routing']
      },
      semantic_verification: {
        used: false,
        reasoning: 'Explicit routing rule bypassed semantic verification'
      },
      multi_target_detection: {
        is_multi_target: false,
        routing_strategy: 'single',
        confidence: 0
      }
    };
  }

  /**
   * Route query using hybrid system with semantic enhancement and multi-target detection
   */
  async route(
    query: string,
    datasetContext?: DatasetContext
  ): Promise<SemanticEnhancedResult> {
    // Step -1: Apply explicit routing rules for known problematic queries
    const explicitRoute = this.applyExplicitRoutingRules(query);
    if (explicitRoute) {
      console.log(`[SemanticEnhancedHybrid] Explicit routing rule applied: ${explicitRoute.endpoint}`);
      return explicitRoute;
    }

    // Step 0: Early detection of temporal market queries
    const isTemporalQuery = this.isTemporalMarketQuery(query);

    // Step 1: Detect if query needs multi-target analysis
    const multiTargetDetection = this.enableMultiTargetDetection ?
      await this.detectMultiTargetQuery(query) : null;
    
    // Step 2: Route to multi-target service if detected
    if (multiTargetDetection?.is_multi_target && (multiTargetDetection.confidence ?? 0) >= this.multiTargetThreshold) {
      return this.routeToMultiTargetService(query, datasetContext, multiTargetDetection);
    }

    // Step 3: Use hybrid system for primary routing (single-target)
    const hybridResult = await this.hybridEngine.route(query, datasetContext);
    
    // Step 3.5: Apply temporal query override if needed
    if (isTemporalQuery) {
      // Always route temporal queries to market-trend-analysis for consistency (real estate endpoints)
      if (hybridResult.endpoint !== '/market-trend-analysis') {
        console.log(`[SemanticEnhancedHybrid] Temporal query detected, overriding ${hybridResult.endpoint} routing to /market-trend-analysis`);
        const originalEndpoint = hybridResult.endpoint;
        hybridResult.endpoint = '/market-trend-analysis';
        hybridResult.confidence = Math.max(0.75, hybridResult.confidence || 0);
        hybridResult.reasoning.push(`Temporal query override: routed to market trend analysis (was ${originalEndpoint})`);
      }
    }
    
    // Initialize enhanced result
    const enhancedResult: SemanticEnhancedResult = {
      ...hybridResult,
      semantic_verification: {
        used: false,
        reasoning: 'Semantic enhancement not applied'
      },
      multi_target_detection: multiTargetDetection || {
        is_multi_target: false,
        routing_strategy: 'single',
        confidence: 0
      }
    };

    // Step 4: Apply semantic enhancement if conditions are met (but skip for temporal overrides)
    if (this.shouldApplySemanticEnhancement(query, hybridResult) && !isTemporalQuery) {
      try {
        const semanticEnhancement = await this.applySemanticEnhancement(query, hybridResult);
        enhancedResult.semantic_verification = semanticEnhancement;
        
        // Apply confidence boost if semantic verification agrees
        if (semanticEnhancement.confidence_boost && semanticEnhancement.confidence_boost > 0) {
          enhancedResult.confidence = Math.min(1.0, 
            (enhancedResult.confidence || 0) + semanticEnhancement.confidence_boost
          );
        }
        // If semantic suggests a different endpoint with sufficient confidence, prefer it
        if (semanticEnhancement.semantic_endpoint && typeof semanticEnhancement.semantic_confidence === 'number') {
          const sc = semanticEnhancement.semantic_confidence || 0;
          if (semanticEnhancement.semantic_endpoint !== hybridResult.endpoint && sc >= this.semanticThreshold) {
            enhancedResult.endpoint = semanticEnhancement.semantic_endpoint;
            enhancedResult.reasoning = enhancedResult.reasoning.concat([`Semantic override: chose ${semanticEnhancement.semantic_endpoint} (${(sc*100).toFixed(1)}% semantic confidence)`]);
            enhancedResult.success = true;
            enhancedResult.confidence = Math.min(1.0, sc);
          }
        }
        
      } catch (error) {
        console.warn('[SemanticEnhancedHybrid] Semantic enhancement failed:', error);
        enhancedResult.semantic_verification = {
          used: true,
          reasoning: `Semantic enhancement failed: ${error}`
        };
      }
    }

    return enhancedResult;
  }

  /**
   * Determine if semantic enhancement should be applied
   */
  private shouldApplySemanticEnhancement(
    query: string, 
    hybridResult: HybridRoutingResult
  ): boolean {
  if (!this.useSemanticEnhancement) return false;
    
    // Skip semantic enhancement for temporal queries that have been overridden
    if (this.isTemporalMarketQuery(query)) {
      return false;
    }
    
    // Apply semantic enhancement for:
    // 1. Creative/metaphorical queries
    // 2. Low confidence hybrid results
    // 3. Novel phrasing patterns
    // 4. Compound queries
    
    const isCreativeQuery = this.isCreativeQuery(query);
    const isLowConfidence = (hybridResult.confidence || 0) < 0.6;
    const isNovelPhrasing = this.hasNovelPhrasing(query);
    const isCompoundQuery = this.isCompoundQuery(query);
    
    return isCreativeQuery || isLowConfidence || isNovelPhrasing || isCompoundQuery;
  }

  /**
   * Apply semantic enhancement to improve routing confidence
   */
  private async applySemanticEnhancement(
    query: string, 
    hybridResult: HybridRoutingResult
  ): Promise<NonNullable<SemanticEnhancedResult['semantic_verification']>> {
    const semanticResult = await semanticRouter.route(query, {
      minConfidence: this.semanticThreshold,
      maxAlternatives: 2
    });

    const semanticEndpoint = semanticResult.endpoint;
    const semanticConfidence = semanticResult.confidence;
    
    // Check if semantic router agrees with hybrid result
    const endpointsMatch = hybridResult.endpoint === semanticEndpoint;
    const confidenceBoost = endpointsMatch ? 
      Math.min(0.2, semanticConfidence * 0.3) : // Boost if they agree
      0; // No boost if they disagree
    
    let reasoning: string;
    if (endpointsMatch) {
      reasoning = `Semantic router agrees: ${semanticEndpoint} (${(semanticConfidence * 100).toFixed(1)}% confidence)`;
    } else {
      reasoning = `Semantic router suggests different endpoint: ${semanticEndpoint} vs hybrid: ${hybridResult.endpoint}`;
    }

    return {
      used: true,
      semantic_confidence: semanticConfidence,
      semantic_endpoint: semanticEndpoint,
      confidence_boost: confidenceBoost,
      reasoning
    };
  }

  /**
   * Detect creative/metaphorical queries
   */
  private isCreativeQuery(query: string): boolean {
    const creativePatterns = [
      /story.*tell/i,
      /paint.*picture/i,
      /walk.*through/i,
      /dissect.*anatomy/i,
      /unpack.*dynamics/i,
      /decode.*pattern/i,
      /illuminate.*factor/i,
      /if.*could talk/i,
      /landscape of/i,
      // Real estate specific creative patterns
      /hottest.*markets?/i,
      /best.*places?.*invest/i,
      /where.*should.*buy/i,
      /market.*opportunities/i,
      /hidden.*gems/i,
      /emerging.*areas/i
    ];
    
    return creativePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect novel phrasing patterns
   */
  private hasNovelPhrasing(query: string): boolean {
    const novelPatterns = [
      /what would happen if/i,
      /help me understand/i,
      /can you break down/i,
      /show me which/i,
      /tell me about/i,
      /i want to understand/i,
      /help me identify/i,
      // Real estate specific novel phrasing
      /what.*time.*market/i,
      /average.*prices?.*in/i,
      /show.*price.*trend/i,
      /compare.*sold.*asking/i,
      /analyze.*rental.*opportunities/i,
      /where.*invest.*real.*estate/i,
      /market.*performance.*in/i
    ];
    
    return novelPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect temporal market queries that should route to time-on-market analysis
   */
  private isTemporalMarketQuery(query: string): boolean {
    // IMPORTANT: Exclude liquidity-related queries from temporal override
    // These should go to market-liquidity-analysis, not market-trend-analysis
    const liquidityPatterns = [
      /liquidity/i,
      /quickly.*properties.*sell/i,
      /fast.*properties.*sell/i,
      /properties.*sell.*quickly/i,
      /properties.*sell.*fast/i,
      /market.*velocity/i,  // This is a liquidity indicator, not a trend
      /turnover.*rate/i     // This is a liquidity indicator, not a trend
    ];

    if (liquidityPatterns.some(pattern => pattern.test(query))) {
      return false;  // Don't override liquidity queries
    }

    const temporalPatterns = [
      // Direct time on market patterns
      /time.*on.*market/i,
      /days.*on.*market/i,
      /\bdom\b/i,
      /\btom\b/i,

      // Selling time patterns
      /selling.*time/i,
      /time.*to.*sell/i,
      /how.*long.*sell/i,
      /how.*long.*market/i,
      /typical.*selling.*time/i,
      /average.*selling.*time/i,

      // Market timing patterns (trend-related only)
      /market.*timing/i,
      /selling.*duration/i,
      /property.*selling.*duration/i,

      // Property duration patterns
      /how.*long.*properties.*stay/i,
      /how.*long.*houses.*stay/i,

      // Market pace patterns (trend-related)
      /market.*pace/i,
      /sales.*pace/i,

      // Analysis patterns with temporal terms
      /time.*analysis/i,
      /selling.*analysis/i,
      /duration.*analysis/i,

      // Natural language patterns
      /what.*typical.*time/i,
      /what.*average.*time/i,
      /how.*long.*typically/i,
      /how.*long.*average/i,
      /show.*time.*market/i,
      /analyze.*time.*market/i
    ];

    return temporalPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect compound queries with multiple intents
   */
  private isCompoundQuery(query: string): boolean {
    const compoundIndicators = [
      / and also /i,
      / but also /i,
      / combined with /i,
      / along with /i,
      / as well as /i,
      / plus /i,
      / additionally /i,
      // Real estate specific compound indicators
      / and rental /i,
      / and price /i,
      / and investment /i,
      / with market /i,
      / plus trends /i,
      / including price /i,
      / vs asking /i
    ];
    
    return compoundIndicators.some(indicator => indicator.test(query));
  }

  /**
   * Detect if query requires multi-target analysis
   */
  private async detectMultiTargetQuery(query: string): Promise<NonNullable<SemanticEnhancedResult['multi_target_detection']>> {
    const lowerQuery = query.toLowerCase();
    
    // Multi-target indicators
    const multiTargetPatterns = [
      // Multiple analysis types in one query
      /compare.*and.*analyze/i,
      /show.*both.*and/i,
      /analyze.*plus.*forecast/i,
      /trend.*and.*prediction/i,
      /correlation.*with.*market/i,
      
      // Real estate specific multi-target patterns  
      /price.*and.*rental/i,
      /market.*trend.*and.*investment/i,
      /compare.*sold.*asking.*and.*time/i,
      /rental.*yield.*and.*appreciation/i,
      /investment.*opportunity.*and.*risk/i,
      /cma.*with.*market.*trends/i,
      /price.*prediction.*and.*market.*analysis/i,
      
      // Compound analysis indicators
      /multiple.*factors/i,
      /comprehensive.*analysis/i,
      /holistic.*view/i,
      /all.*aspects/i,
      /complete.*picture/i
    ];

    // Check for multiple target variables
    const targetVariables = this.extractTargetVariables(query);
    const hasMultipleTargets = targetVariables.length >= 2;
    
    // Check for pattern matches
    const patternMatch = multiTargetPatterns.some(pattern => pattern.test(query));
    
    // Determine analysis type
    const analysisType = this.determineAnalysisType(query);
    
    // Calculate confidence based on indicators
    let confidence = 0;
    if (hasMultipleTargets) confidence += 0.4;
    if (patternMatch) confidence += 0.3;
    if (this.isCompoundQuery(query)) confidence += 0.2;
    if (analysisType !== 'single') confidence += 0.1;
    
    const isMultiTarget = confidence >= this.multiTargetThreshold;
    
    console.log(`[SemanticEnhancedHybrid] Multi-target detection:`, {
      query: query.substring(0, 50) + '...',
      isMultiTarget,
      confidence,
      targetVariables,
      analysisType,
      hasMultipleTargets,
      patternMatch
    });

    return {
      is_multi_target: isMultiTarget,
      target_variables: targetVariables,
      analysis_type: analysisType,
      confidence,
      routing_strategy: isMultiTarget ? 'multi_target' : 'single',
      fallback_used: false
    };
  }

  /**
   * Route query to multi-target analysis service
   */
  private async routeToMultiTargetService(
    query: string,
    datasetContext?: DatasetContext,
    multiTargetDetection?: NonNullable<SemanticEnhancedResult['multi_target_detection']>
  ): Promise<SemanticEnhancedResult> {
    try {
      console.log(`[SemanticEnhancedHybrid] Routing to multi-target service:`, {
        targetVariables: multiTargetDetection?.target_variables,
        analysisType: multiTargetDetection?.analysis_type
      });

      // Prepare multi-target options
      const multiTargetOptions: MultiEndpointAnalysisOptions = {
        forceMultiEndpoint: true,
        maxEndpoints: 4, // Reasonable limit
        combinationStrategy: this.getCombinationStrategy(multiTargetDetection?.analysis_type),
        ...(datasetContext && { datasetContext })
      };

      // Execute multi-target analysis
      const multiTargetEngine = await this.getMultiTargetEngine();
      const multiTargetResult: MultiEndpointAnalysisResult = await multiTargetEngine.executeAnalysis(
        query, 
        multiTargetOptions
      );

      // Convert to SemanticEnhancedResult format
      const enhancedResult: SemanticEnhancedResult = {
        endpoint: multiTargetResult.endpoint,
        confidence: multiTargetResult.qualityMetrics?.analysisConfidence || 0.8,
        success: multiTargetResult.success,
        reasoning: [
          'Multi-target analysis executed successfully',
          `Endpoints used: ${multiTargetResult.endpointsUsed.join(', ')}`,
          `Strategy: ${multiTargetResult.mergeStrategy}`,
          `Records analyzed: ${multiTargetResult.compositeData?.totalRecords || 0}`
        ],
        validation: {
          scope: QueryScope.IN_SCOPE,
          confidence: 0.9,
          reasons: ['Multi-target analysis request validated']
        },
        routing_layers: {
          validation: { scope: QueryScope.IN_SCOPE, confidence: 0.9, reasons: ['Validation successful'] },
          base_intent: { 
            primary_intent: BaseIntent.COMPARATIVE_ANALYSIS,
            confidence: 0.9,
            secondary_intents: [],
            matched_categories: 1,
            reasoning: ['Multi-target analysis request']
          },
          domain_enhancement: {},
          context_boost: {},
          final_decision: null
        },
        user_response: {
          type: 'success',
          message: 'Multi-target analysis completed successfully',
          endpoint: multiTargetResult.endpoint,
          confidence: multiTargetResult.qualityMetrics?.analysisConfidence || 0.8
        },
        processing_time: multiTargetResult.performanceMetrics.totalAnalysisTime,
        metadata: {
          query_signature: 'multi_target_analysis',
          domain_used: 'real_estate',
          layers_executed: ['multi_target_detection', 'endpoint_execution', 'result_merging']
        },
        semantic_verification: {
          used: false,
          reasoning: 'Routed to multi-target service, semantic verification skipped'
        },
        multi_target_detection: {
          is_multi_target: true,
          target_variables: multiTargetDetection?.target_variables,
          analysis_type: multiTargetDetection?.analysis_type,
          confidence: multiTargetDetection?.confidence || 0.8,
          routing_strategy: 'multi_target',
          fallback_used: false
        },
        // Add multi-target specific data to result
        multiTargetResult: multiTargetResult
      };

      console.log(`[SemanticEnhancedHybrid] Multi-target routing successful:`, {
        endpoints: multiTargetResult.endpointsUsed.length,
        confidence: enhancedResult.confidence,
        executionTime: multiTargetResult.performanceMetrics.totalAnalysisTime
      });

      return enhancedResult;

    } catch (error) {
      console.warn(`[SemanticEnhancedHybrid] Multi-target routing failed:`, error);
      
      // Fallback to single-target routing
      return this.executeMultiTargetFallback(query, datasetContext, multiTargetDetection, error);
    }
  }

  /**
   * Execute fallback to single-target when multi-target fails
   */
  private async executeMultiTargetFallback(
    query: string,
    datasetContext?: DatasetContext,
    multiTargetDetection?: NonNullable<SemanticEnhancedResult['multi_target_detection']>,
    originalError?: any
  ): Promise<SemanticEnhancedResult> {
    console.log(`[SemanticEnhancedHybrid] Executing multi-target fallback to single-target routing`);
    
    try {
      // Use hybrid system for fallback
      const hybridResult = await this.hybridEngine.route(query, datasetContext);
      
      const enhancedResult: SemanticEnhancedResult = {
        ...hybridResult,
        reasoning: [
          ...hybridResult.reasoning,
          `Multi-target routing failed, fell back to single-target`,
          `Original error: ${originalError?.message || 'Unknown error'}`
        ],
        semantic_verification: {
          used: false,
          reasoning: 'Fallback routing, semantic verification skipped'
        },
        multi_target_detection: {
          ...multiTargetDetection,
          is_multi_target: false,
          routing_strategy: 'single',
          fallback_used: true
        } as NonNullable<SemanticEnhancedResult['multi_target_detection']>
      };

      // Apply semantic enhancement to fallback if needed
      if (this.shouldApplySemanticEnhancement(query, hybridResult)) {
        try {
          const semanticEnhancement = await this.applySemanticEnhancement(query, hybridResult);
          enhancedResult.semantic_verification = semanticEnhancement;
          
          if (semanticEnhancement.confidence_boost && semanticEnhancement.confidence_boost > 0) {
            enhancedResult.confidence = Math.min(1.0, 
              (enhancedResult.confidence || 0) + semanticEnhancement.confidence_boost
            );
          }
        } catch (semanticError) {
          console.warn('[SemanticEnhancedHybrid] Semantic enhancement in fallback failed:', semanticError);
        }
      }

      return enhancedResult;

    } catch (fallbackError) {
      // Final fallback - return basic error result with all required properties
      return {
        endpoint: '/analyze',
        confidence: 0.1,
        success: false,
        reasoning: [
          'Multi-target routing failed',
          'Single-target fallback also failed',
          `Errors: ${(originalError as any)?.message || 'Unknown error'}, ${(fallbackError as any)?.message || 'Unknown fallback error'}`
        ],
        validation: {
          scope: QueryScope.IN_SCOPE,
          confidence: 0.1,
          reasons: ['Fallback validation - all routing failed', 'Try a simpler query', 'Check query syntax']
        },
        routing_layers: {
          validation: {
            scope: QueryScope.IN_SCOPE,
            confidence: 0.1,
            reasons: ['Emergency fallback']
          },
          base_intent: {
            primary_intent: BaseIntent.COMPARATIVE_ANALYSIS,
            confidence: 0.1,
            secondary_intents: [],
            matched_categories: 0,
            reasoning: ['Default fallback intent']
          },
          domain_enhancement: null,
          context_boost: null,
          final_decision: null
        },
        user_response: {
          type: 'fallback' as const,
          message: 'Unable to route query - system fallback activated',
          endpoint: '/analyze',
          confidence: 0.1
        },
        processing_time: 0,
        metadata: {
          query_signature: 'fallback',
          domain_used: 'general',
          layers_executed: ['fallback'],
          early_exit: 'system_error'
        },
        semantic_verification: {
          used: false,
          reasoning: 'All routing methods failed'
        },
        multi_target_detection: {
          is_multi_target: false,
          routing_strategy: 'single',
          fallback_used: true,
          confidence: 0
        }
      };
    }
  }

  /**
   * Extract target variables from query
   */
  private extractTargetVariables(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const variables: string[] = [];
    
    // Real estate target variables
    const variablePatterns = {
      'price': ['price', 'cost', 'value', 'asking', 'sold'],
      'time_on_market': [
        'time on market', 'days on market', 'selling time', 
        'dom', 'tom', 'market timing', 'market velocity',
        'time to sell', 'selling duration', 'sales pace'
      ],
      'rental_yield': ['rental', 'rent', 'yield', 'income'],
      'market_trend': ['trend', 'growth', 'appreciation', 'forecast'],
      'investment_score': ['investment', 'opportunity', 'roi', 'return'],
      'risk_assessment': ['risk', 'volatility', 'stability'],
      'market_analysis': ['market analysis', 'cma', 'comparative'],
      'demographic_fit': ['demographic', 'population', 'target audience']
    };

    for (const [variable, keywords] of Object.entries(variablePatterns)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        variables.push(variable);
      }
    }

    return variables;
  }

  /**
   * Determine analysis type from query
   */
  private determineAnalysisType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('compare') || lowerQuery.includes('vs')) return 'comparison';
    if (lowerQuery.includes('predict') || lowerQuery.includes('forecast')) return 'prediction';
    if (lowerQuery.includes('trend') || lowerQuery.includes('change')) return 'trend';
    if (lowerQuery.includes('correlation') || lowerQuery.includes('relationship')) return 'correlation';
    if (lowerQuery.includes('investment') || lowerQuery.includes('opportunity')) return 'investment';
    if (lowerQuery.includes('rental') || lowerQuery.includes('yield')) return 'rental';
    if (lowerQuery.includes('cma') || lowerQuery.includes('comparative')) return 'cma';
    
    return 'single';
  }

  /**
   * Get combination strategy for multi-target analysis
   */
  private getCombinationStrategy(analysisType?: string): 'overlay' | 'comparison' | 'sequential' | 'correlation' {
    switch (analysisType) {
      case 'comparison': return 'comparison';
      case 'correlation': return 'correlation';
      case 'prediction':
      case 'trend': return 'sequential';
      default: return 'overlay';
    }
  }

  /**
   * Configure multi-target detection settings
   */
  public configureMultiTargetDetection(options: {
    enabled?: boolean;
    threshold?: number;
    maxEndpoints?: number;
  }): void {
    if (options.enabled !== undefined) {
      this.enableMultiTargetDetection = options.enabled;
    }
    if (options.threshold !== undefined) {
      this.multiTargetThreshold = Math.max(0, Math.min(1, options.threshold));
    }
    
    console.log(`[SemanticEnhancedHybrid] Multi-target detection configured:`, {
      enabled: this.enableMultiTargetDetection,
      threshold: this.multiTargetThreshold
    });
  }

  /**
   * Get routing statistics including multi-target metrics
   */
  public getRoutingStatistics(): any {
    return {
      semantic_enhancement: {
        enabled: this.useSemanticEnhancement,
        threshold: this.semanticThreshold
      },
      multi_target_detection: {
        enabled: this.enableMultiTargetDetection,
        threshold: this.multiTargetThreshold
      },
      supported_analysis_types: [
        'single', 'comparison', 'prediction', 'trend', 
        'correlation', 'investment', 'rental', 'cma'
      ],
      routing_strategies: ['single', 'multi_target']
    };
  }

  /**
   * Initialize the hybrid engine
   */
  async initialize(): Promise<void> {
    await this.hybridEngine.initialize();
    await this.initializeSemanticEnhancement();
    console.log('[SemanticEnhancedHybrid] Engine initialized with multi-target support');
  }
}

// Export singleton instance
export const semanticEnhancedHybridEngine = new SemanticEnhancedHybridEngine();