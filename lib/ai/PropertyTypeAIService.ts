/**
 * Property Type AI Service
 *
 * Routes AI prompts and insights based on property type (revenue vs residential).
 * Integrates RevenuePropertyAnalysisPrompts with existing AIInsightEngine.
 */

import type { CMAProperty } from '@/components/cma/types';
import { AIInsightEngine, type SectionInsight, type MarketMetrics, type PropertyData, type ComparableData } from '@/lib/pdf/ai/AIInsightEngine';
import { getRevenuePropertyPrompt, getResidentialPropertyPrompt, type PromptContext } from './prompts/RevenuePropertyAnalysisPrompts';
import { RevenuePropertyInsightsGenerator, type InsightsSummary } from './RevenuePropertyInsightsGenerator';
import { PropertyAnalysisRouter, type AnalysisContext } from '@/lib/analysis/PropertyAnalysisRouter';

/**
 * Property Type AI Service
 * Central service for property type-aware AI generation
 */
export class PropertyTypeAIService {
  private static instance: PropertyTypeAIService;
  private aiInsightEngine: AIInsightEngine;

  private constructor() {
    this.aiInsightEngine = new AIInsightEngine();
  }

  static getInstance(): PropertyTypeAIService {
    if (!PropertyTypeAIService.instance) {
      PropertyTypeAIService.instance = new PropertyTypeAIService();
    }
    return PropertyTypeAIService.instance;
  }

  /**
   * Generate AI prompt based on property type
   * Routes to revenue or residential prompts
   */
  generateAnalysisPrompt(
    property: CMAProperty,
    analysisType: 'cashFlow' | 'capRate' | 'expenses' | 'rental' | 'risk' | 'roi' | 'general',
    comparables?: CMAProperty[],
    neighborhoodData?: {
      name: string;
      averagePrice?: number;
      medianPrice?: number;
      vacancy_rate?: number;
    },
    marketStats?: {
      avgCapRate?: number;
      avgGIM?: number;
      avgNIM?: number;
    }
  ): string {
    // Check if property is revenue property
    const isRevenueProperty = property.isRevenueProperty || false;

    const context: PromptContext = {
      property,
      comparables,
      neighborhoodData,
      marketStats,
    };

    // Route based on property type
    if (isRevenueProperty && analysisType !== 'general') {
      console.log(`[PropertyTypeAIService] Using revenue property prompt: ${analysisType}`);
      return getRevenuePropertyPrompt(analysisType, context);
    } else {
      console.log(`[PropertyTypeAIService] Using residential property prompt`);
      return getResidentialPropertyPrompt(context);
    }
  }

  /**
   * Generate insights based on property type
   * Routes to revenue insights generator or residential AIInsightEngine
   */
  generateInsights(
    property: CMAProperty,
    comparables?: CMAProperty[],
    metrics?: MarketMetrics,
    historicalData?: any[]
  ): InsightsSummary | Record<string, SectionInsight[]> {
    const isRevenueProperty = property.isRevenueProperty || false;

    if (isRevenueProperty) {
      console.log('[PropertyTypeAIService] Generating revenue property insights');
      return RevenuePropertyInsightsGenerator.generateInsights(property, comparables, {
        avgCapRate: metrics?.absorptionRate, // Placeholder - should be actual cap rate avg
        avgGIM: undefined,
        avgNIM: undefined,
      });
    } else {
      console.log('[PropertyTypeAIService] Generating residential property insights');
      // Convert to format expected by AIInsightEngine
      const subjectProperty = this.mapToPropertyData(property);
      const comparableData = this.mapToComparableData(comparables || []);
      const marketMetrics = metrics || this.getDefaultMetrics();

      return this.aiInsightEngine.generateAllInsights(
        subjectProperty,
        comparableData,
        marketMetrics,
        historicalData
      );
    }
  }

  /**
   * Generate section-specific insights
   */
  generateSectionInsights(
    section: 'cover' | 'market' | 'property' | 'comparables' | 'pricing' | 'trends' | 'recommendations',
    property: CMAProperty,
    comparables?: CMAProperty[],
    metrics?: MarketMetrics
  ): SectionInsight[] {
    const isRevenueProperty = property.isRevenueProperty || false;

    if (isRevenueProperty) {
      // For revenue properties, return investment-focused insights
      const insights = this.generateInsights(property, comparables, metrics) as InsightsSummary;

      // Map revenue insights to SectionInsight format
      return insights.insights.map(insight => ({
        section,
        title: insight.title,
        content: insight.message,
        confidence: insight.impact === 'high' ? 'high' : insight.impact === 'medium' ? 'medium' : 'low',
        type: this.mapInsightType(insight.type),
        icon: this.getInsightIcon(insight.category),
        accentColor: this.getInsightColor(insight.type),
      }));
    } else {
      // For residential properties, use existing AIInsightEngine
      const subjectProperty = this.mapToPropertyData(property);
      const comparableData = this.mapToComparableData(comparables || []);
      const marketMetrics = metrics || this.getDefaultMetrics();

      switch (section) {
        case 'cover':
          return this.aiInsightEngine.generateCoverInsights(marketMetrics, subjectProperty);
        case 'market':
          return this.aiInsightEngine.generateMarketOverviewInsights(marketMetrics);
        case 'property':
          return this.aiInsightEngine.generatePropertyInsights(subjectProperty, comparableData, marketMetrics);
        case 'comparables':
          return this.aiInsightEngine.generateComparableInsights(subjectProperty, comparableData);
        case 'pricing':
          return this.aiInsightEngine.generatePricingInsights(subjectProperty, comparableData, marketMetrics);
        case 'trends':
          return this.aiInsightEngine.generateTrendsInsights(marketMetrics);
        case 'recommendations':
          return this.aiInsightEngine.generateRecommendationInsights(subjectProperty, comparableData, marketMetrics);
        default:
          return [];
      }
    }
  }

  /**
   * Get analysis context for property
   */
  getAnalysisContext(property: CMAProperty): AnalysisContext {
    return PropertyAnalysisRouter.route(property);
  }

  /**
   * Generate quick investment summary for revenue properties
   */
  generateInvestmentSummary(property: CMAProperty, comparables?: CMAProperty[]): string | null {
    if (!property.isRevenueProperty) return null;

    const insights = RevenuePropertyInsightsGenerator.generateInsights(property, comparables);
    return RevenuePropertyInsightsGenerator.generateQuickSummary(insights);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Map CMAProperty to PropertyData format
   */
  private mapToPropertyData(property: CMAProperty): PropertyData {
    return {
      address: property.address || 'Unknown Address',
      price: property.price || 0,
      sqft: property.squareFootage || 0,
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      yearBuilt: property.yearBuilt || 2000,
      lotSize: (property as any).lot_size,
      features: (property as any).features || [],
      condition: (property as any).condition,
    };
  }

  /**
   * Map CMAProperty array to ComparableData format
   */
  private mapToComparableData(comparables: CMAProperty[]): ComparableData {
    const properties = comparables.map(c => this.mapToPropertyData(c));

    const totalPricePerSqft = properties.reduce(
      (sum, p) => sum + (p.sqft > 0 ? p.price / p.sqft : 0),
      0
    );
    const avgPricePerSqft = properties.length > 0 ? totalPricePerSqft / properties.length : 0;

    const totalDaysOnMarket = comparables.reduce(
      (sum, c) => sum + ((c as any).time_on_market || 30),
      0
    );
    const avgDaysOnMarket = comparables.length > 0 ? totalDaysOnMarket / comparables.length : 30;

    const prices = properties.map(p => p.price).filter(p => p > 0);
    const priceRange = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
    };

    return {
      properties,
      avgPricePerSqft,
      avgDaysOnMarket,
      priceRange,
      avgSaleToListRatio: 0.98, // Default
    };
  }

  /**
   * Get default market metrics
   */
  private getDefaultMetrics(): MarketMetrics {
    return {
      avgDaysOnMarket: 30,
      medianPrice: 500000,
      pricePerSqft: 250,
      totalListings: 100,
      activeListings: 60,
      pendingListings: 25,
      soldListings: 15,
      inventoryMonths: 4.0,
      absorptionRate: 0.15,
      listToSaleRatio: 0.98,
      marketTrend: 'stable',
    };
  }

  /**
   * Map revenue insight type to SectionInsight type
   */
  private mapInsightType(type: 'positive' | 'warning' | 'neutral' | 'critical'): 'analysis' | 'recommendation' | 'observation' | 'prediction' {
    switch (type) {
      case 'critical':
      case 'warning':
        return 'recommendation';
      case 'positive':
        return 'observation';
      default:
        return 'analysis';
    }
  }

  /**
   * Get icon for insight category
   */
  private getInsightIcon(category: string): string {
    const iconMap: Record<string, string> = {
      cashFlow: '💰',
      valuation: '📊',
      expenses: '💸',
      risk: '⚠️',
      market: '📈',
      opportunity: '🎯',
    };
    return iconMap[category] || '📋';
  }

  /**
   * Get color for insight type
   */
  private getInsightColor(type: 'positive' | 'warning' | 'neutral' | 'critical'): { r: number; g: number; b: number } {
    switch (type) {
      case 'positive':
        return { r: 39, g: 174, b: 96 }; // Green
      case 'warning':
        return { r: 230, g: 126, b: 34 }; // Orange
      case 'critical':
        return { r: 231, g: 76, b: 60 }; // Red
      default:
        return { r: 0, g: 61, b: 121 }; // BHHS Blue
    }
  }
}

// Export singleton instance
export const propertyTypeAIService = PropertyTypeAIService.getInstance();
