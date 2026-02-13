/**
 * Real Estate Multi-Target Routing Engine
 * 
 * Specialized routing engine for real estate queries that can handle
 * multiple target variables and point-based property data analysis.
 * 
 * Extends SemanticEnhancedHybridEngine with real estate specific:
 * - Multi-target variable routing
 * - Predefined real estate queries
 * - Point-based property data support
 * - Real estate domain knowledge
 */

import { SemanticEnhancedHybridEngine, SemanticEnhancedResult } from './SemanticEnhancedHybridEngine';
import { DatasetContext } from './types/ContextTypes';

export interface RealEstateRoutingResult extends SemanticEnhancedResult {
  multi_target_analysis?: {
    primary_target: string;
    secondary_targets: string[];
    analysis_type: string;
    supports_point_data: boolean;
  };
  real_estate_metadata?: {
    property_type_focus?: string;
    market_segment?: string;
    analysis_timeframe?: string;
    geographic_scope?: string;
  };
}

export interface MultiTargetConfiguration {
  primary_target: string;
  secondary_targets: string[];
  analysis_type: 'trend' | 'prediction' | 'comparison' | 'investment' | 'rental' | 'cma' | 'market';
  supports_point_data: boolean;
  required_fields?: string[];
  optional_fields?: string[];
}

export class RealEstateMultiTargetRouter extends SemanticEnhancedHybridEngine {
  private realEstateQueries: Map<string, MultiTargetConfiguration> = new Map();
  private pointDataSupport: boolean = true;

  constructor() {
    super();
    this.initializeRealEstateQueries();
    console.log('[RealEstateMultiTargetRouter] Initialized with real estate domain specialization');
  }

  /**
   * Enhanced routing for real estate queries with multi-target support
   */
  async route(
    query: string,
    datasetContext?: DatasetContext
  ): Promise<RealEstateRoutingResult> {
    // Step 1: Check for predefined real estate queries
    const predefinedQuery = this.matchPredefinedQuery(query);
    
    // Step 2: Use parent routing logic
    const baseResult = await super.route(query, datasetContext);
    
    // Step 3: Enhance with real estate specific analysis
    const enhancedResult: RealEstateRoutingResult = {
      ...baseResult,
      multi_target_analysis: predefinedQuery ? {
        primary_target: predefinedQuery.primary_target,
        secondary_targets: predefinedQuery.secondary_targets,
        analysis_type: predefinedQuery.analysis_type,
        supports_point_data: predefinedQuery.supports_point_data
      } : undefined,
      real_estate_metadata: this.extractRealEstateMetadata(query)
    };

    // Step 4: Override endpoint if we have a strong real estate match
    if (predefinedQuery && this.isHighConfidenceRealEstateQuery(query)) {
      enhancedResult.endpoint = this.getEndpointForAnalysisType(predefinedQuery.analysis_type);
      enhancedResult.confidence = Math.min(1.0, (enhancedResult.confidence || 0) + 0.3);
      enhancedResult.reasoning.push(`Real estate specialized routing: ${predefinedQuery.analysis_type} analysis`);
    }

    return enhancedResult;
  }

  /**
   * Initialize predefined real estate queries and their configurations
   */
  private initializeRealEstateQueries(): void {
    const queries = [
      // Time on Market Analysis
      {
        patterns: [
          "what's the average time on market",
          "how long do properties stay on market",
          "time on market analysis",
          "days on market",
          "average selling time"
        ],
        config: {
          primary_target: 'time_on_market',
          secondary_targets: ['listing_price', 'sold_price', 'price_delta'],
          analysis_type: 'trend' as const,
          supports_point_data: true,
          required_fields: ['time_on_market'],
          optional_fields: ['listing_date', 'sold_date', 'price_history']
        }
      },
      // Price Trend Analysis
      {
        patterns: [
          "show me price trends in montreal",
          "price trends",
          "market price analysis",
          "price movement",
          "property price trends",
          "housing price trends"
        ],
        config: {
          primary_target: 'price_trend_index',
          secondary_targets: ['median_price', 'price_change_pct', 'market_velocity'],
          analysis_type: 'trend' as const,
          supports_point_data: true,
          required_fields: ['price_trend_index'],
          optional_fields: ['historical_prices', 'market_indicators']
        }
      },
      // Price vs Asking Analysis
      {
        patterns: [
          "compare sold vs asking prices",
          "sold vs asking price analysis",
          "price difference analysis",
          "asking vs sold",
          "price variance analysis"
        ],
        config: {
          primary_target: 'price_delta',
          secondary_targets: ['asking_price', 'sold_price', 'negotiation_index'],
          analysis_type: 'comparison' as const,
          supports_point_data: true,
          required_fields: ['asking_price', 'sold_price'],
          optional_fields: ['days_on_market', 'price_history']
        }
      },
      // Rental Opportunity Analysis
      {
        patterns: [
          "analyze rental opportunities",
          "rental market analysis",
          "rental yield analysis",
          "rental investment opportunities",
          "rental roi analysis"
        ],
        config: {
          primary_target: 'rental_yield_index',
          secondary_targets: ['rental_income', 'rental_demand', 'tenant_profile'],
          analysis_type: 'rental' as const,
          supports_point_data: true,
          required_fields: ['rental_yield_index'],
          optional_fields: ['rental_rates', 'occupancy_rates', 'tenant_demographics']
        }
      },
      // Market Opportunity Analysis
      {
        patterns: [
          "real estate market opportunities",
          "market analysis",
          "property market potential",
          "home value analysis",
          "market hotspots"
        ],
        config: {
          primary_target: 'market_score',
          secondary_targets: ['value_projection', 'market_assessment', 'growth_potential'],
          analysis_type: 'market' as const,
          supports_point_data: true,
          required_fields: ['market_score'],
          optional_fields: ['market_growth', 'economic_indicators', 'demographic_trends']
        }
      },
      // Price Prediction Analysis
      {
        patterns: [
          "predict property prices",
          "price prediction",
          "future price forecast",
          "property value prediction",
          "market value forecast"
        ],
        config: {
          primary_target: 'predicted_price',
          secondary_targets: ['price_confidence', 'price_variance', 'trend_direction'],
          analysis_type: 'prediction' as const,
          supports_point_data: true,
          required_fields: ['predicted_price'],
          optional_fields: ['historical_data', 'market_factors', 'economic_indicators']
        }
      },
      // CMA Analysis
      {
        patterns: [
          "comparative market analysis",
          "cma analysis",
          "property comparison",
          "comparable sales analysis",
          "market value comparison"
        ],
        config: {
          primary_target: 'cma_score',
          secondary_targets: ['price_comparison', 'market_position', 'value_accuracy'],
          analysis_type: 'cma' as const,
          supports_point_data: true,
          required_fields: ['cma_score'],
          optional_fields: ['comparable_properties', 'adjustment_factors', 'market_conditions']
        }
      }
    ];

    // Store patterns and configurations
    queries.forEach(({ patterns, config }) => {
      patterns.forEach(pattern => {
        this.realEstateQueries.set(pattern.toLowerCase(), config);
      });
    });

    console.log(`[RealEstateMultiTargetRouter] Initialized ${this.realEstateQueries.size} predefined real estate queries`);
  }

  /**
   * Match query against predefined real estate patterns
   */
  private matchPredefinedQuery(query: string): MultiTargetConfiguration | null {
    const lowerQuery = query.toLowerCase();
    
    // Direct pattern match
    for (const [pattern, config] of this.realEstateQueries.entries()) {
      if (lowerQuery.includes(pattern)) {
        console.log(`[RealEstateMultiTargetRouter] Matched predefined query: "${pattern}"`);
        return config;
      }
    }

    // Fuzzy matching for similar queries
    return this.fuzzyMatchRealEstateQuery(lowerQuery);
  }

  /**
   * Fuzzy matching for real estate queries
   */
  private fuzzyMatchRealEstateQuery(query: string): MultiTargetConfiguration | null {
    const realEstateKeywords = {
      time_on_market: ['time', 'market', 'days', 'selling', 'average'],
      price_trends: ['price', 'trend', 'movement', 'change', 'forecast'],
      price_comparison: ['compare', 'vs', 'versus', 'difference', 'asking', 'sold'],
      rental_analysis: ['rental', 'rent', 'yield', 'income', 'tenant'],
      market_analysis: ['market', 'value', 'opportunity', 'potential', 'homeowner'],
      price_prediction: ['predict', 'forecast', 'future', 'estimate', 'projection'],
      cma_analysis: ['cma', 'comparative', 'comparison', 'comparable', 'comps']
    };

    let bestMatch: { type: string; score: number; config: MultiTargetConfiguration | null } = {
      type: '',
      score: 0,
      config: null
    };

    for (const [analysisType, keywords] of Object.entries(realEstateKeywords)) {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (query.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > bestMatch.score && score >= 2) { // Require at least 2 keyword matches
        bestMatch = {
          type: analysisType,
          score,
          config: this.getConfigForAnalysisType(analysisType)
        };
      }
    }

    if (bestMatch.config) {
      console.log(`[RealEstateMultiTargetRouter] Fuzzy matched: ${bestMatch.type} (score: ${bestMatch.score})`);
    }

    return bestMatch.config;
  }

  /**
   * Get configuration for analysis type
   */
  private getConfigForAnalysisType(analysisType: string): MultiTargetConfiguration | null {
    const configs: Record<string, MultiTargetConfiguration> = {
      time_on_market: {
        primary_target: 'time_on_market',
        secondary_targets: ['listing_price', 'sold_price'],
        analysis_type: 'trend',
        supports_point_data: true
      },
      price_trends: {
        primary_target: 'price_trend_index',
        secondary_targets: ['median_price', 'price_change_pct'],
        analysis_type: 'trend',
        supports_point_data: true
      },
      price_comparison: {
        primary_target: 'price_delta',
        secondary_targets: ['asking_price', 'sold_price'],
        analysis_type: 'comparison',
        supports_point_data: true
      },
      rental_analysis: {
        primary_target: 'rental_yield_index',
        secondary_targets: ['rental_income', 'rental_demand'],
        analysis_type: 'rental',
        supports_point_data: true
      },
      market_analysis: {
        primary_target: 'market_score',
        secondary_targets: ['value_projection', 'market_assessment'],
        analysis_type: 'market',
        supports_point_data: true
      },
      price_prediction: {
        primary_target: 'predicted_price',
        secondary_targets: ['price_confidence', 'price_variance'],
        analysis_type: 'prediction',
        supports_point_data: true
      },
      cma_analysis: {
        primary_target: 'cma_score',
        secondary_targets: ['price_comparison', 'market_position'],
        analysis_type: 'cma',
        supports_point_data: true
      }
    };

    return configs[analysisType] || null;
  }

  /**
   * Extract real estate metadata from query
   */
  private extractRealEstateMetadata(query: string): any {
    const lowerQuery = query.toLowerCase();
    
    return {
      property_type_focus: this.extractPropertyType(lowerQuery),
      market_segment: this.extractMarketSegment(lowerQuery),
      analysis_timeframe: this.extractTimeframe(lowerQuery),
      geographic_scope: this.extractGeographicScope(lowerQuery)
    };
  }

  /**
   * Extract property type from query
   */
  private extractPropertyType(query: string): string | undefined {
    const propertyTypes = ['single family', 'condo', 'townhouse', 'multi family', 'commercial', 'residential'];
    return propertyTypes.find(type => query.includes(type));
  }

  /**
   * Extract market segment from query
   */
  private extractMarketSegment(query: string): string | undefined {
    const segments = ['luxury', 'affordable', 'first time buyer', 'investor', 'family', 'senior'];
    return segments.find(segment => query.includes(segment));
  }

  /**
   * Extract timeframe from query
   */
  private extractTimeframe(query: string): string | undefined {
    if (query.includes('month')) return 'monthly';
    if (query.includes('quarter')) return 'quarterly';
    if (query.includes('year')) return 'yearly';
    if (query.includes('week')) return 'weekly';
    return undefined;
  }

  /**
   * Extract geographic scope from query
   */
  private extractGeographicScope(query: string): string | undefined {
    if (query.includes('neighborhood')) return 'neighborhood';
    if (query.includes('city')) return 'city';
    if (query.includes('region')) return 'region';
    if (query.includes('province') || query.includes('state')) return 'province';
    return undefined;
  }

  /**
   * Check if query has high confidence for real estate domain
   */
  private isHighConfidenceRealEstateQuery(query: string): boolean {
    const realEstateIndicators = [
      'property', 'real estate', 'housing', 'home', 'house',
      'rental', 'investment', 'market', 'price', 'value',
      'listing', 'sold', 'asking', 'cma', 'comparable'
    ];

    const lowerQuery = query.toLowerCase();
    const matchCount = realEstateIndicators.reduce((count, indicator) => {
      return count + (lowerQuery.includes(indicator) ? 1 : 0);
    }, 0);

    return matchCount >= 2; // High confidence with 2+ real estate indicators
  }

  /**
   * Get endpoint for analysis type
   */
  private getEndpointForAnalysisType(analysisType: string): string {
    const endpointMap: Record<string, string> = {
      trend: '/market-trend-analysis',
      prediction: '/price-prediction-analysis',
      comparison: '/comparative-analysis',
      rental: '/rental-market-analysis',
      market: '/market-opportunities',
      cma: '/comparative-market-analysis'
    };

    return endpointMap[analysisType] || '/analyze';
  }

  /**
   * Validate point-based data support
   */
  validatePointDataSupport(query: string, endpoint: string): boolean {
    // All real estate endpoints support point-based property data
    const realEstateEndpoints = [
      '/market-trend-analysis',
      '/price-prediction-analysis',
      '/rental-market-analysis',
      '/market-opportunities',
      '/comparative-market-analysis'
    ];

    return realEstateEndpoints.includes(endpoint) || this.pointDataSupport;
  }

  /**
   * Get supported target variables for endpoint
   */
  getSupportedTargetVariables(endpoint: string): string[] {
    const targetVariables: Record<string, string[]> = {
      '/market-trend-analysis': ['price_trend_index', 'time_on_market', 'price_delta', 'market_velocity'],
      '/price-prediction-analysis': ['predicted_price', 'price_confidence', 'price_variance', 'trend_direction'],
      '/rental-market-analysis': ['rental_yield_index', 'rental_demand', 'tenant_profile', 'rental_income'],
      '/market-opportunities': ['market_score', 'value_projection', 'market_assessment', 'growth_potential'],
      '/comparative-market-analysis': ['cma_score', 'price_comparison', 'market_position', 'value_accuracy']
    };

    return targetVariables[endpoint] || ['analysis_score'];
  }

  /**
   * Get real estate routing statistics
   */
  getRealEstateRoutingStats(): any {
    return {
      predefined_queries: this.realEstateQueries.size,
      point_data_support: this.pointDataSupport,
      supported_analysis_types: ['trend', 'prediction', 'comparison', 'rental', 'market', 'cma'],
      real_estate_endpoints: [
        '/market-trend-analysis',
        '/price-prediction-analysis', 
        '/rental-market-analysis',
        '/market-opportunities',
        '/comparative-market-analysis'
      ]
    };
  }
}

// Export singleton instance
export const realEstateMultiTargetRouter = new RealEstateMultiTargetRouter();