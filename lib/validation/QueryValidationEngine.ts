/**
 * Query Validation Engine
 * 
 * Validates query routing accuracy for real estate platform.
 * Tests all queries from ANALYSIS_CATEGORIES
 * to ensure they route to the correct processors with proper confidence scores.
 */

import { semanticEnhancedHybridEngine } from '../routing/SemanticEnhancedHybridEngine';
import { ANALYSIS_CATEGORIES } from '../../components/chat/chat-constants';
import { ENDPOINT_PROCESSOR_MAP } from '../analysis/strategies/processors';

export interface QueryValidationResult {
  query: string;
  category: string;
  expectedEndpoint?: string;
  actualEndpoint: string;
  confidence: number;
  success: boolean;
  routing_time: number;
  semantic_verification_used: boolean;
  multi_target_detected: boolean;
  validation_errors: string[];
  processor_type?: string;
  reasoning: string[];
}

export interface ValidationReport {
  totalQueries: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageConfidence: number;
  averageRoutingTime: number;
  categoryBreakdown: Record<string, {
    total: number;
    successful: number;
    failed: number;
    averageConfidence: number;
  }>;
  processorCoverage: Record<string, number>;
  ambiguousRoutes: QueryValidationResult[];
  lowConfidenceRoutes: QueryValidationResult[];
  routingFailures: QueryValidationResult[];
  topProcessors: Array<{
    processor: string;
    count: number;
    averageConfidence: number;
  }>;
}

export interface QueryPatternAnalysis {
  patterns: Array<{
    pattern: RegExp;
    category: string;
    expectedProcessor: string;
    confidence: number;
    matches: string[];
  }>;
  ambiguousPatterns: Array<{
    pattern: string;
    conflictingProcessors: string[];
    affectedQueries: string[];
  }>;
  coverage: {
    totalPatterns: number;
    coveredQueries: number;
    uncoveredQueries: string[];
  };
}

export class QueryValidationEngine {
  private initialized: boolean = false;
  private validationResults: QueryValidationResult[] = [];
  private patternAnalysis: QueryPatternAnalysis | null = null;

  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the validation engine
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await semanticEnhancedHybridEngine.initialize();
      this.initialized = true;
      console.log('[QueryValidationEngine] Initialized successfully');
    }
  }

  /**
   * Validate all queries from chat constants
   */
  async validateAllQueries(): Promise<ValidationReport> {
    await this.initialize();
    
    console.log('[QueryValidationEngine] Starting comprehensive query validation...');
    const startTime = Date.now();
    
    this.validationResults = [];

    // Validate ANALYSIS_CATEGORIES
    for (const [category, queries] of Object.entries(ANALYSIS_CATEGORIES)) {
      for (const query of queries) {
        const result = await this.validateSingleQuery(query, category, 'ANALYSIS');
        this.validationResults.push(result);
      }
    }

    // TRENDS_CATEGORIES removed - only ANALYSIS_CATEGORIES is used

    const totalTime = Date.now() - startTime;
    console.log(`[QueryValidationEngine] Validation completed in ${totalTime}ms`);

    return this.generateValidationReport();
  }

  /**
   * Validate a single query
   */
  async validateSingleQuery(
    query: string, 
    category: string, 
    type: 'ANALYSIS' | 'TRENDS'
  ): Promise<QueryValidationResult> {
    const startTime = Date.now();
    let result: QueryValidationResult;

    try {
      const routingResult = await semanticEnhancedHybridEngine.route(query);
      const routingTime = Date.now() - startTime;

      // Determine expected endpoint based on category
      const expectedEndpoint = this.inferExpectedEndpoint(query, category);
      const processorType = ENDPOINT_PROCESSOR_MAP[routingResult.endpoint as keyof typeof ENDPOINT_PROCESSOR_MAP];

      // Validate routing quality
      const validationErrors = this.validateRoutingQuality(routingResult, expectedEndpoint);
      const isSuccessful = routingResult.success && validationErrors.length === 0;

      result = {
        query,
        category: `${type}/${category}`,
        expectedEndpoint,
        actualEndpoint: routingResult.endpoint || '',
        confidence: routingResult.confidence || 0,
        success: isSuccessful,
        routing_time: routingTime,
        semantic_verification_used: routingResult.semantic_verification?.used || false,
        multi_target_detected: routingResult.multi_target_detection?.is_multi_target || false,
        validation_errors: validationErrors,
        processor_type: processorType,
        reasoning: routingResult.reasoning || []
      };

      // Log interesting cases
      if (!isSuccessful || (routingResult.confidence || 0) < 0.5) {
        console.warn(`[QueryValidationEngine] Low confidence routing:`, {
          query: query.substring(0, 50) + '...',
          endpoint: routingResult.endpoint,
          confidence: routingResult.confidence,
          errors: validationErrors
        });
      }

    } catch (error) {
      const routingTime = Date.now() - startTime;
      
      result = {
        query,
        category: `${type}/${category}`,
        actualEndpoint: '/error',
        confidence: 0,
        success: false,
        routing_time: routingTime,
        semantic_verification_used: false,
        multi_target_detected: false,
        validation_errors: [`Routing failed: ${error}`],
        reasoning: ['Fatal routing error']
      };

      console.error(`[QueryValidationEngine] Query routing failed:`, {
        query: query.substring(0, 50) + '...',
        error: error instanceof Error ? error.message : error
      });
    }

    return result;
  }

  /**
   * Infer expected endpoint based on query content and category
   */
  private inferExpectedEndpoint(query: string, category: string): string | undefined {
    const lowerQuery = query.toLowerCase();
    const lowerCategory = category.toLowerCase();

    // Category-based routing expectations
    const categoryEndpointMap: Record<string, string> = {
      'comparative analysis': '/comparative-analysis',
      'market trends': '/trend-analysis',
      'property valuation & comparables': '/comparative-market-analysis',
      'market analysis': '/analyze',
      'strategic analysis': '/analyze',
      'real estate market analysis': '/market-trend-analysis',
      'rental market analysis': '/rental-market-analysis',
      'investment opportunities': '/investment-opportunities',
      'risk assessment': '/risk-analysis',
      'customer profiling': '/segment-profiling',
      'spatial clustering': '/spatial-clusters',
      'feature & property analysis': '/feature-interactions',
      'market consensus': '/consensus-analysis',
      'advanced pattern analysis': '/nonlinear-analysis',
      'property similarity': '/similarity-analysis',
      'feature selection & optimization': '/feature-selection-analysis',
      'market interpretability': '/interpretability-analysis',
      'quick analysis': '/speed-optimized-analysis'
    };

    // Check category mapping first
    if (categoryEndpointMap[lowerCategory]) {
      return categoryEndpointMap[lowerCategory];
    }

    // Content-based inference for queries
    if (lowerQuery.includes('compare') || lowerQuery.includes('vs')) {
      return '/comparative-analysis';
    }
    if (lowerQuery.includes('trend') || lowerQuery.includes('growth') || lowerQuery.includes('appreciation')) {
      return '/trend-analysis';
    }
    if (lowerQuery.includes('rental') || lowerQuery.includes('rent') || lowerQuery.includes('yield')) {
      return '/rental-market-analysis';
    }
    if (lowerQuery.includes('investment') || lowerQuery.includes('opportunity') || lowerQuery.includes('roi')) {
      return '/investment-opportunities';
    }
    if (lowerQuery.includes('risk') || lowerQuery.includes('volatility') || lowerQuery.includes('stability')) {
      return '/risk-analysis';
    }
    if (lowerQuery.includes('demographic') || lowerQuery.includes('buyer') || lowerQuery.includes('customer')) {
      return '/segment-profiling';
    }
    if (lowerQuery.includes('cluster') || lowerQuery.includes('geographic') || lowerQuery.includes('spatial')) {
      return '/spatial-clusters';
    }
    if (lowerQuery.includes('cma') || lowerQuery.includes('comparable') || lowerQuery.includes('similar properties')) {
      return '/comparative-market-analysis';
    }
    if (lowerQuery.includes('predict') || lowerQuery.includes('forecast') || lowerQuery.includes('future')) {
      return '/price-prediction-analysis';
    }

    // Default to general analysis if no specific pattern matches
    return '/analyze';
  }

  /**
   * Validate routing quality
   */
  private validateRoutingQuality(
    routingResult: any,
    expectedEndpoint?: string
  ): string[] {
    const errors: string[] = [];

    // Check if routing was successful
    if (!routingResult.success) {
      errors.push('Routing marked as unsuccessful');
    }

    // Check confidence levels
    const confidence = routingResult.confidence || 0;
    if (confidence < 0.3) {
      errors.push(`Very low confidence: ${(confidence * 100).toFixed(1)}%`);
    } else if (confidence < 0.5) {
      errors.push(`Low confidence: ${(confidence * 100).toFixed(1)}%`);
    }

    // Check for endpoint mismatch if expected endpoint is known
    if (expectedEndpoint && routingResult.endpoint !== expectedEndpoint) {
      // Only flag as error if confidence is high but endpoint is wrong
      if (confidence > 0.6) {
        errors.push(`High-confidence routing to unexpected endpoint: expected ${expectedEndpoint}, got ${routingResult.endpoint}`);
      }
    }

    // Check for missing processor mapping
    const processorType = ENDPOINT_PROCESSOR_MAP[routingResult.endpoint as keyof typeof ENDPOINT_PROCESSOR_MAP];
    if (!processorType) {
      errors.push(`No processor mapping found for endpoint: ${routingResult.endpoint}`);
    }

    // Check for empty reasoning
    if (!routingResult.reasoning || routingResult.reasoning.length === 0) {
      errors.push('No reasoning provided for routing decision');
    }

    return errors;
  }

  /**
   * Analyze query patterns for routing optimization
   */
  async analyzeQueryPatterns(): Promise<QueryPatternAnalysis> {
    await this.initialize();

    if (this.validationResults.length === 0) {
      await this.validateAllQueries();
    }

    console.log('[QueryValidationEngine] Analyzing query patterns...');

    const patterns: QueryPatternAnalysis['patterns'] = [];
    const ambiguousPatterns: QueryPatternAnalysis['ambiguousPatterns'] = [];
    const allQueries = this.validationResults.map(r => r.query);

    // Define common real estate query patterns
    const realEstatePatterns = [
      { pattern: /compare.*vs|compare.*and|compare.*between/i, category: 'Comparative', processor: '/comparative-analysis' },
      { pattern: /trend|growth|appreciation|forecast/i, category: 'Trends', processor: '/trend-analysis' },
      { pattern: /rental|rent|yield|income/i, category: 'Rental', processor: '/rental-market-analysis' },
      { pattern: /investment|opportunity|roi|return/i, category: 'Investment', processor: '/investment-opportunities' },
      { pattern: /risk|volatility|stability|downside/i, category: 'Risk', processor: '/risk-analysis' },
      { pattern: /demographic|buyer|customer|profile/i, category: 'Demographics', processor: '/segment-profiling' },
      { pattern: /cluster|geographic|spatial|similar/i, category: 'Spatial', processor: '/spatial-clusters' },
      { pattern: /cma|comparable|similar properties/i, category: 'CMA', processor: '/comparative-market-analysis' },
      { pattern: /predict|forecast|future|will/i, category: 'Prediction', processor: '/price-prediction-analysis' },
      { pattern: /price.*per.*square|average.*price|market.*value/i, category: 'Pricing', processor: '/analyze' },
      { pattern: /time.*on.*market|selling.*time|days.*market/i, category: 'Market Timing', processor: '/market-trend-analysis' },
      { pattern: /feature|amenity|characteristic|attribute/i, category: 'Features', processor: '/feature-interactions' },
      { pattern: /explain|why|understand|break.*down/i, category: 'Interpretability', processor: '/interpretability-analysis' },
      { pattern: /quick|fast|rapid|instant|speed/i, category: 'Quick Analysis', processor: '/speed-optimized-analysis' },
      { pattern: /consensus|agreement|multiple.*analyses/i, category: 'Consensus', processor: '/consensus-analysis' }
    ];

    // Analyze each pattern
    for (const { pattern, category, processor } of realEstatePatterns) {
      const matches = allQueries.filter(query => pattern.test(query));
      const routingResults = this.validationResults.filter(r => pattern.test(r.query));
      
      let totalConfidence = 0;
      let correctRoutes = 0;
      
      for (const result of routingResults) {
        totalConfidence += result.confidence;
        if (result.actualEndpoint === processor) {
          correctRoutes++;
        }
      }
      
      const averageConfidence = routingResults.length > 0 ? totalConfidence / routingResults.length : 0;
      const accuracy = routingResults.length > 0 ? correctRoutes / routingResults.length : 0;

      patterns.push({
        pattern,
        category,
        expectedProcessor: processor,
        confidence: accuracy,
        matches
      });
    }

    // Find ambiguous patterns (queries that could match multiple processors)
    const queryToProcessors = new Map<string, Set<string>>();
    
    for (const result of this.validationResults) {
      if (!queryToProcessors.has(result.query)) {
        queryToProcessors.set(result.query, new Set());
      }
      queryToProcessors.get(result.query)!.add(result.actualEndpoint);
    }

    // Identify patterns with conflicts
    for (const [query, processors] of queryToProcessors.entries()) {
      if (processors.size > 1) {
        const conflictingProcessors = Array.from(processors);
        ambiguousPatterns.push({
          pattern: query.length > 50 ? query.substring(0, 47) + '...' : query,
          conflictingProcessors,
          affectedQueries: [query]
        });
      }
    }

    // Calculate coverage
    const coveredQueries = patterns.reduce((acc, pattern) => acc + pattern.matches.length, 0);
    const uncoveredQueries = allQueries.filter(query => 
      !patterns.some(pattern => pattern.pattern.test(query))
    );

    this.patternAnalysis = {
      patterns,
      ambiguousPatterns,
      coverage: {
        totalPatterns: patterns.length,
        coveredQueries: coveredQueries,
        uncoveredQueries
      }
    };

    console.log(`[QueryValidationEngine] Pattern analysis complete: ${patterns.length} patterns, ${coveredQueries} queries covered`);

    return this.patternAnalysis;
  }

  /**
   * Generate comprehensive validation report
   */
  private generateValidationReport(): ValidationReport {
    console.log('[QueryValidationEngine] Generating validation report...');

    const totalQueries = this.validationResults.length;
    const successfulRoutes = this.validationResults.filter(r => r.success).length;
    const failedRoutes = totalQueries - successfulRoutes;
    
    const totalConfidence = this.validationResults.reduce((sum, r) => sum + r.confidence, 0);
    const averageConfidence = totalQueries > 0 ? totalConfidence / totalQueries : 0;
    
    const totalRoutingTime = this.validationResults.reduce((sum, r) => sum + r.routing_time, 0);
    const averageRoutingTime = totalQueries > 0 ? totalRoutingTime / totalQueries : 0;

    // Category breakdown
    const categoryBreakdown: ValidationReport['categoryBreakdown'] = {};
    for (const result of this.validationResults) {
      if (!categoryBreakdown[result.category]) {
        categoryBreakdown[result.category] = {
          total: 0,
          successful: 0,
          failed: 0,
          averageConfidence: 0
        };
      }
      
      const category = categoryBreakdown[result.category];
      category.total++;
      if (result.success) category.successful++;
      else category.failed++;
    }

    // Calculate average confidence per category
    for (const [categoryName, data] of Object.entries(categoryBreakdown)) {
      const categoryResults = this.validationResults.filter(r => r.category === categoryName);
      const categoryConfidence = categoryResults.reduce((sum, r) => sum + r.confidence, 0);
      data.averageConfidence = categoryResults.length > 0 ? categoryConfidence / categoryResults.length : 0;
    }

    // Processor coverage
    const processorCoverage: Record<string, number> = {};
    for (const result of this.validationResults) {
      processorCoverage[result.actualEndpoint] = (processorCoverage[result.actualEndpoint] || 0) + 1;
    }

    // Top processors by usage
    const topProcessors = Object.entries(processorCoverage)
      .map(([processor, count]) => {
        const processorResults = this.validationResults.filter(r => r.actualEndpoint === processor);
        const avgConfidence = processorResults.reduce((sum, r) => sum + r.confidence, 0) / processorResults.length;
        return { processor, count, averageConfidence: avgConfidence };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Problem cases
    const ambiguousRoutes = this.validationResults.filter(r => 
      r.confidence > 0.4 && r.confidence < 0.7
    );
    
    const lowConfidenceRoutes = this.validationResults.filter(r => 
      r.confidence < 0.5
    );
    
    const routingFailures = this.validationResults.filter(r => 
      !r.success || r.validation_errors.length > 0
    );

    const report: ValidationReport = {
      totalQueries,
      successfulRoutes,
      failedRoutes,
      averageConfidence,
      averageRoutingTime,
      categoryBreakdown,
      processorCoverage,
      ambiguousRoutes,
      lowConfidenceRoutes,
      routingFailures,
      topProcessors
    };

    console.log(`[QueryValidationEngine] Report generated: ${successfulRoutes}/${totalQueries} successful routes (${(successfulRoutes/totalQueries*100).toFixed(1)}%)`);

    return report;
  }

  /**
   * Test specific query patterns
   */
  async testQueryPattern(pattern: RegExp, expectedEndpoint: string): Promise<{
    matches: QueryValidationResult[];
    accuracy: number;
    averageConfidence: number;
  }> {
    await this.initialize();

    if (this.validationResults.length === 0) {
      await this.validateAllQueries();
    }

    const matches = this.validationResults.filter(r => pattern.test(r.query));
    const correctMatches = matches.filter(r => r.actualEndpoint === expectedEndpoint);
    
    const accuracy = matches.length > 0 ? correctMatches.length / matches.length : 0;
    const totalConfidence = matches.reduce((sum, r) => sum + r.confidence, 0);
    const averageConfidence = matches.length > 0 ? totalConfidence / matches.length : 0;

    return {
      matches,
      accuracy,
      averageConfidence
    };
  }

  /**
   * Get validation results
   */
  getValidationResults(): QueryValidationResult[] {
    return [...this.validationResults];
  }

  /**
   * Get pattern analysis results
   */
  getPatternAnalysis(): QueryPatternAnalysis | null {
    return this.patternAnalysis;
  }
}

// Export singleton instance
export const queryValidationEngine = new QueryValidationEngine();