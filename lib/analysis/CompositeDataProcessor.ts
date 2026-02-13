/**
 * CompositeDataProcessor - Advanced processing for multi-endpoint analysis
 * 
 * Handles complex analysis across multiple endpoints:
 * 1. Cross-endpoint insights generation
 * 2. Composite scoring and ranking
 * 3. Strategic recommendations
 * 4. Risk-opportunity analysis
 */

import { ProcessedAnalysisData } from './types';
import { MergedDataset } from './DatasetMerger';
import { MultiEndpointResult } from './MultiEndpointRouter';

export interface CompositeInsight {
  location: string;
  primaryScore: number;
  insights: {
    competitive: CompetitiveInsight;
    demographic: DemographicInsight;
    spatial: SpatialInsight;
    predictive: PredictiveInsight;
    risk: RiskInsight;
  };
  compositeScores: {
    opportunityScore: number;
    riskScore: number;
    investmentScore: number;
    marketPotential: number;
    competitiveAdvantage: number;
  };
  recommendations: Recommendation[];
  confidence: number;
}

export interface CompetitiveInsight {
  nikeMarketShare: number;
  adidasMarketShare: number;
  marketGap: number;
  competitivePosition: 'dominant' | 'competitive' | 'trailing' | 'opportunity';
  brandPreferenceStrength: number;
}

export interface DemographicInsight {
  targetDemographicFit: number;
  incomeLevel: 'high' | 'medium' | 'low';
  ageProfile: 'young' | 'mixed' | 'mature';
  householdCharacteristics: string;
  economicStability: number;
}

export interface SpatialInsight {
  clusterMembership: string;
  similarAreas: string[];
  geographicAdvantages: string[];
  locationQuality: number;
}

export interface PredictiveInsight {
  growthPotential: number;
  marketTrends: 'growing' | 'stable' | 'declining';
  futureOpportunity: number;
  timeHorizon: string;
}

export interface RiskInsight {
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  volatility: number;
  stabilityScore: number;
}

export interface Recommendation {
  type: 'market_entry' | 'product_focus' | 'competitive_strategy' | 'risk_mitigation' | 'investment_timing';
  priority: 'high' | 'medium' | 'low';
  action: string;
  reasoning: string;
  expectedImpact: number;
  timeframe: string;
  confidence: number;
}

export interface CompositeAnalysisResult extends ProcessedAnalysisData {
  compositeInsights: CompositeInsight[];
  strategicSummary: StrategicSummary;
  crossEndpointCorrelations: Record<string, number>;
  qualityMetrics: {
    dataCompleteness: number;
    analysisConfidence: number;
    spatialCoverage: number;
  };
}

export interface StrategicSummary {
  topOpportunities: string[];
  highestRiskAreas: string[];
  competitiveGaps: string[];
  recommendedActions: Recommendation[];
  keyInsights: string[];
  marketOverview: {
    totalMarketPotential: number;
    averageCompetition: number;
    growthOutlook: string;
  };
}

export class CompositeDataProcessor {
  
  /**
   * Process merged multi-endpoint data into composite insights
   */
  async processCompositeAnalysis(
    mergedData: MergedDataset,
    multiResult: MultiEndpointResult
  ): Promise<CompositeAnalysisResult> {
    
    // Handle both MergedDataset format and RawAnalysisResult format
    const recordsArray = (mergedData as any).mergedRecords || (mergedData as any).results || [];
    
    console.log(`[CompositeDataProcessor] Processing composite analysis for ${recordsArray.length} locations`);
    
    try {
      // Generate composite insights for each location
      const compositeInsights = await Promise.all(
        recordsArray.map((record: any) => this.generateCompositeInsight(record, mergedData))
      );

      // Calculate cross-endpoint correlations
      const crossEndpointCorrelations = this.calculateCrossEndpointCorrelations(mergedData);

      // Generate strategic summary
      const strategicSummary = this.generateStrategicSummary(compositeInsights);

      // Create final result
      const result: CompositeAnalysisResult = {
        type: 'composite',
        summary: `Composite analysis of ${compositeInsights.length} locations`,
        statistics: {
          total: compositeInsights.length,
          mean: compositeInsights.reduce((sum, i) => sum + i.compositeScores.investmentScore, 0) / compositeInsights.length,
          median: 0, // Would need to calculate properly
          min: Math.min(...compositeInsights.map(i => i.compositeScores.investmentScore)),
          max: Math.max(...compositeInsights.map(i => i.compositeScores.investmentScore)),
          stdDev: 0 // Would need to calculate properly
        },
        targetVariable: 'investmentScore',
        records: compositeInsights.map(insight => ({
          area_id: insight.location,
          area_name: insight.location,
          value: insight.compositeScores.investmentScore,
          properties: {
            opportunityScore: insight.compositeScores.opportunityScore,
            riskScore: insight.compositeScores.riskScore,
            confidence: insight.confidence,
            keyFactors: this.generateKeyInsights(compositeInsights)
          }
        })),
        totalRecords: compositeInsights.length,
        
        // Composite-specific data
        compositeInsights,
        strategicSummary,
        crossEndpointCorrelations,
        qualityMetrics: {
          dataCompleteness: mergedData.qualityMetrics.dataCompleteness,
          analysisConfidence: this.calculateAnalysisConfidence(mergedData, compositeInsights),
          spatialCoverage: mergedData.qualityMetrics.spatialCoverage
        }
      };

      console.log(`[CompositeDataProcessor] Composite analysis complete:`, {
        insights: compositeInsights.length,
        topOpportunities: strategicSummary.topOpportunities.length,
        recommendations: strategicSummary.recommendedActions.length
      });

      return result;

    } catch (error) {
      console.error(`[CompositeDataProcessor] Processing failed:`, error);
      throw new Error(`Composite analysis failed: ${error}`);
    }
  }

  /**
   * Generate comprehensive insight for a single location
   */
  private async generateCompositeInsight(
    record: any, 
    mergedData: MergedDataset
  ): Promise<CompositeInsight> {
    
    const location = record.FSA_ID || record.location || 'unknown';

    // Extract insights from different endpoint data
    const competitive = this.extractCompetitiveInsight(record);
    const demographic = this.extractDemographicInsight(record);
    const spatial = this.extractSpatialInsight(record, mergedData);
    const predictive = this.extractPredictiveInsight(record);
    const risk = this.extractRiskInsight(record);

    // Calculate composite scores
    const compositeScores = this.calculateCompositeScores({
      competitive, demographic, spatial, predictive, risk
    });

    // Generate recommendations
    const recommendations = this.generateLocationRecommendations({
      competitive, demographic, spatial, predictive, risk
    }, compositeScores);

    // Calculate overall confidence
    const confidence = this.calculateInsightConfidence(record, mergedData);

    return {
      location,
      primaryScore: compositeScores.investmentScore,
      insights: { competitive, demographic, spatial, predictive, risk },
      compositeScores,
      recommendations,
      confidence
    };
  }

  /**
   * Extract competitive insights from record
   */
  private extractCompetitiveInsight(record: any): CompetitiveInsight {
    const nike = record.value_Nike_preference || 0;
    const adidas = record.value_Adidas_preference || 0;
    const marketGap = Math.max(0, 1 - nike - adidas);
    
    let competitivePosition: CompetitiveInsight['competitivePosition'];
    if (nike > 0.4) competitivePosition = 'dominant';
    else if (nike > 0.25) competitivePosition = 'competitive';
    else if (nike > 0.15) competitivePosition = 'trailing';
    else competitivePosition = 'opportunity';

    return {
      nikeMarketShare: nike,
      adidasMarketShare: adidas,
      marketGap,
      competitivePosition,
      brandPreferenceStrength: Math.max(nike, adidas)
    };
  }

  /**
   * Extract demographic insights from record
   */
  private extractDemographicInsight(record: any): DemographicInsight {
    const income = record.value_AVGHINC_CY || 0;
    const age = record.value_MEDAGE_CY || 0;
    const households = record.value_TOTHH_CY || 0;
    
    const incomeLevel = income > 80000 ? 'high' : income > 50000 ? 'medium' : 'low';
    const ageProfile = age < 35 ? 'young' : age > 50 ? 'mature' : 'mixed';
    
    const targetFit = this.calculateDemographicFit(income, age, households);
    const economicStability = this.calculateEconomicStability(record);

    return {
      targetDemographicFit: targetFit,
      incomeLevel,
      ageProfile,
      householdCharacteristics: `${households.toLocaleString()} households, avg age ${age}`,
      economicStability
    };
  }

  /**
   * Extract spatial insights from record
   */
  private extractSpatialInsight(record: any, mergedData: MergedDataset): SpatialInsight {
    const clusterId = record.cluster_id || 'unknown';
    const location = record.FSA_ID || record.location;
    
    // Find similar areas in same cluster
    const records = (mergedData as any).mergedRecords || (mergedData as any).results || [];
    const similarAreas = records
      .filter((r: any) => r.cluster_id === clusterId && r.FSA_ID !== location)
      .slice(0, 5)
      .map((r: any) => r.FSA_ID);

    const geographicAdvantages = this.identifyGeographicAdvantages(record);
    const locationQuality = this.calculateLocationQuality(record);

    return {
      clusterMembership: clusterId,
      similarAreas,
      geographicAdvantages,
      locationQuality
    };
  }

  /**
   * Extract predictive insights from record
   */
  private extractPredictiveInsight(record: any): PredictiveInsight {
    const growthPotential = record.predicted_growth || record.growth_potential || 0;
    const trendIndicator = record.trend_direction || 0;
    
    const marketTrends = trendIndicator > 0.1 ? 'growing' : 
                        trendIndicator < -0.1 ? 'declining' : 'stable';

    return {
      growthPotential,
      marketTrends,
      futureOpportunity: growthPotential * 0.8 + (trendIndicator * 0.2),
      timeHorizon: '3-5 years'
    };
  }

  /**
   * Extract risk insights from record
   */
  private extractRiskInsight(record: any): RiskInsight {
    const volatility = record.market_volatility || record.economic_volatility || 0;
    const stabilityScore = 1 - volatility;
    
    const riskLevel = volatility > 0.7 ? 'high' : volatility > 0.3 ? 'medium' : 'low';
    const riskFactors = this.identifyRiskFactors(record);

    return {
      riskLevel,
      riskFactors,
      volatility,
      stabilityScore
    };
  }

  /**
   * Calculate composite scores
   */
  private calculateCompositeScores(insights: {
    competitive: CompetitiveInsight;
    demographic: DemographicInsight;
    spatial: SpatialInsight;
    predictive: PredictiveInsight;
    risk: RiskInsight;
  }) {
    
    // Opportunity Score (0-1)
    const opportunityScore = (
      insights.competitive.marketGap * 0.3 +
      insights.demographic.targetDemographicFit * 0.25 +
      insights.spatial.locationQuality * 0.2 +
      insights.predictive.growthPotential * 0.25
    );

    // Risk Score (0-1)
    const riskScore = insights.risk.volatility;

    // Investment Score (risk-adjusted opportunity)
    const investmentScore = opportunityScore * (1 - riskScore * 0.5);

    // Market Potential
    const marketPotential = (
      insights.competitive.marketGap * 0.4 +
      insights.predictive.futureOpportunity * 0.4 +
      insights.demographic.targetDemographicFit * 0.2
    );

    // Competitive Advantage
    const competitiveAdvantage = Math.max(0, 
      insights.competitive.nikeMarketShare - insights.competitive.adidasMarketShare
    );

    return {
      opportunityScore,
      riskScore,
      investmentScore,
      marketPotential,
      competitiveAdvantage
    };
  }

  /**
   * Generate location-specific recommendations
   */
  private generateLocationRecommendations(
    insights: any,
    scores: any
  ): Recommendation[] {
    
    const recommendations: Recommendation[] = [];

    // High opportunity recommendations
    if (scores.opportunityScore > 0.7) {
      recommendations.push({
        type: 'market_entry',
        priority: 'high',
        action: 'Consider immediate market entry',
        reasoning: 'High opportunity score with favorable conditions',
        expectedImpact: scores.opportunityScore,
        timeframe: '6-12 months',
        confidence: 0.8
      });
    }

    // Competitive strategy
    if (insights.competitive.competitivePosition === 'trailing') {
      recommendations.push({
        type: 'competitive_strategy',
        priority: 'medium',
        action: 'Focus on differentiation and targeted marketing',
        reasoning: 'Currently trailing in market share',
        expectedImpact: 0.6,
        timeframe: '12-18 months',
        confidence: 0.7
      });
    }

    // Risk mitigation
    if (scores.riskScore > 0.6) {
      recommendations.push({
        type: 'risk_mitigation',
        priority: 'high',
        action: 'Implement risk monitoring and contingency planning',
        reasoning: 'High risk factors detected',
        expectedImpact: 0.5,
        timeframe: '3-6 months',
        confidence: 0.9
      });
    }

    return recommendations;
  }

  /**
   * Generate strategic summary across all locations
   */
  private generateStrategicSummary(insights: CompositeInsight[]): StrategicSummary {
    
    // Sort by investment score
    const sortedByInvestment = [...insights].sort((a, b) => b.compositeScores.investmentScore - a.compositeScores.investmentScore);
    const sortedByRisk = [...insights].sort((a, b) => b.compositeScores.riskScore - a.compositeScores.riskScore);
    const sortedByGap = [...insights].sort((a, b) => b.insights.competitive.marketGap - a.insights.competitive.marketGap);

    // Extract top opportunities and risks
    const topOpportunities = sortedByInvestment.slice(0, 10).map(i => i.location);
    const highestRiskAreas = sortedByRisk.slice(0, 5).map(i => i.location);
    const competitiveGaps = sortedByGap.slice(0, 8).map(i => i.location);

    // Aggregate recommendations
    const allRecommendations = insights.flatMap(i => i.recommendations);
    const prioritizedRecommendations = this.prioritizeRecommendations(allRecommendations);

    // Calculate market overview
    const totalMarketPotential = insights.reduce((sum, i) => sum + i.compositeScores.marketPotential, 0);
    const averageCompetition = insights.reduce((sum, i) => sum + i.insights.competitive.brandPreferenceStrength, 0) / insights.length;
    const avgGrowth = insights.reduce((sum, i) => sum + i.insights.predictive.growthPotential, 0) / insights.length;
    
    const growthOutlook = avgGrowth > 0.1 ? 'positive' : avgGrowth < -0.1 ? 'challenging' : 'stable';

    return {
      topOpportunities,
      highestRiskAreas,
      competitiveGaps,
      recommendedActions: prioritizedRecommendations,
      keyInsights: this.generateKeyInsights(insights),
      marketOverview: {
        totalMarketPotential,
        averageCompetition,
        growthOutlook
      }
    };
  }

  /**
   * Helper methods
   */
  private calculateDemographicFit(income: number, age: number, households: number): number {
    // Normalized scoring for athletic demographic fit
    const incomeScore = Math.min(income / 100000, 1);
    const ageScore = age >= 18 && age <= 45 ? 1 : 0.5;
    const densityScore = Math.min(households / 20000, 1);
    
    return (incomeScore * 0.4 + ageScore * 0.4 + densityScore * 0.2);
  }

  private calculateEconomicStability(record: any): number {
    const factors = [
      Math.min((record.value_AVGHINC_CY || 0) / 80000, 1),
      1 - (record.unemployment_rate || 0),
      Math.min((record.value_TOTPOP_CY || 0) / 50000, 1)
    ];
    
    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }

  private identifyGeographicAdvantages(record: any): string[] {
    const advantages: string[] = [];
    
    if (record.population_density > 1000) advantages.push('High population density');
    if (record.transit_access) advantages.push('Good transit access');
    if (record.retail_density > 0.5) advantages.push('Established retail corridor');
    if (record.income_growth > 0.05) advantages.push('Growing income levels');
    
    return advantages;
  }

  private calculateLocationQuality(record: any): number {
    const factors = [
      Math.min((record.value_TOTPOP_CY || 0) / 50000, 1),
      Math.min((record.retail_density || 0), 1),
      record.accessibility_score || 0.5,
      1 - (record.crime_rate || 0.2)
    ];
    
    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }

  private identifyRiskFactors(record: any): string[] {
    const risks: string[] = [];
    
    if (record.economic_volatility > 0.5) risks.push('Economic volatility');
    if (record.crime_rate > 0.3) risks.push('High crime rate');
    if (record.unemployment_rate > 0.08) risks.push('High unemployment');
    if (record.market_saturation > 0.8) risks.push('Market saturation');
    
    return risks;
  }

  private calculateCrossEndpointCorrelations(mergedData: MergedDataset): Record<string, number> {
    // Calculate correlations between key metrics from different endpoints
    const correlations: Record<string, number> = {};
    
    const records = (mergedData as any).mergedRecords || (mergedData as any).results || [];
    if (records.length < 10) return correlations;

    // Example correlations
    correlations['competition_vs_demographics'] = this.calculateCorrelation(
      records.map((r: any) => r.value_Nike_preference || 0),
      records.map((r: any) => r.value_AVGHINC_CY || 0)
    );

    correlations['risk_vs_opportunity'] = this.calculateCorrelation(
      records.map((r: any) => r.market_volatility || 0),
      records.map((r: any) => r.predicted_growth || 0)
    );

    return correlations;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const n = x.length;
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }
    
    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateAnalysisConfidence(
    mergedData: MergedDataset, 
    insights: CompositeInsight[]
  ): number {
    const dataQuality = mergedData.qualityMetrics.dataCompleteness;
    const spatialCoverage = mergedData.qualityMetrics.spatialCoverage;
    const avgInsightConfidence = insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length;
    
    return (dataQuality * 0.4 + spatialCoverage * 0.3 + avgInsightConfidence * 0.3);
  }

  private calculateInsightConfidence(record: any, mergedData: MergedDataset): number {
    const nonNullFields = Object.values(record).filter(v => v !== null && v !== undefined).length;
    const totalPossibleFields = Object.keys(mergedData.fieldMapping).length;
    
    return totalPossibleFields > 0 ? nonNullFields / totalPossibleFields : 0.5;
  }

  private prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    return recommendations
      .sort((a, b) => {
        // Sort by priority then by expected impact
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        return priorityDiff !== 0 ? priorityDiff : b.expectedImpact - a.expectedImpact;
      })
      .slice(0, 10); // Top 10 recommendations
  }

  private generateKeyInsights(insights: CompositeInsight[]): string[] {
    const keyInsights: string[] = [];
    
    const avgOpportunity = insights.reduce((sum, i) => sum + i.compositeScores.opportunityScore, 0) / insights.length;
    const highOpportunityCount = insights.filter(i => i.compositeScores.opportunityScore > 0.7).length;
    const dominantPositions = insights.filter(i => i.insights.competitive.competitivePosition === 'dominant').length;
    
    keyInsights.push(`Average market opportunity score: ${(avgOpportunity * 100).toFixed(1)}%`);
    keyInsights.push(`${highOpportunityCount} locations show high opportunity potential`);
    keyInsights.push(`Nike holds dominant position in ${dominantPositions} markets`);
    
    return keyInsights;
  }

  private extractCompositeFields(insight: CompositeInsight): string[] {
    return [
      'location',
      'primaryScore',
      'opportunityScore',
      'riskScore',
      'investmentScore',
      'marketPotential',
      'competitiveAdvantage',
      'confidence'
    ];
  }
} 