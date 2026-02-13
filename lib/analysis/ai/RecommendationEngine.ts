/**
 * Strategic Recommendations Engine
 * Provides pricing strategy, timing recommendations, and negotiation insights
 */

export interface PricingStrategy {
  recommendedPrice: number;
  strategy: 'aggressive' | 'competitive' | 'premium' | 'value';
  reasoning: string[];
  priceRange: {
    minimum: number;
    optimal: number;
    maximum: number;
  };
  expectedDaysOnMarket: number;
  expectedOfferCount: number;
}

export interface TimingRecommendation {
  bestMonthsToList: number[]; // Month numbers 1-12
  bestMonthsToBuy: number[];
  seasonalAdvantage: number; // -1 to 1
  marketMomentum: 'accelerating' | 'steady' | 'decelerating';
  urgencyScore: number; // 0-100
  reasoning: string[];
}

export interface NegotiationLeverage {
  buyerLeverage: number; // 0-100
  sellerLeverage: number; // 0-100
  marketPower: 'buyer' | 'seller' | 'balanced';
  keyFactors: {
    factor: string;
    impact: number; // -1 to 1
    description: string;
  }[];
  tacticalRecommendations: string[];
}

export interface InvestmentStrategy {
  strategy: 'buy-and-hold' | 'fix-and-flip' | 'rental' | 'speculative';
  horizon: number; // months
  targetReturn: number; // % annual
  riskLevel: 'low' | 'medium' | 'high';
  actionItems: string[];
  exitStrategy: string;
}

export interface StrategicRecommendations {
  pricing: PricingStrategy;
  timing: TimingRecommendation;
  negotiation: NegotiationLeverage;
  investment?: InvestmentStrategy;
  overallConfidence: number; // 0-100
}

export class RecommendationEngine {
  /**
   * Calculate optimal pricing strategy
   */
  public calculatePricingStrategy(
    subjectProperty: PropertyData,
    marketData: MarketAnalysisData,
    competitorData: CompetitorData[]
  ): PricingStrategy {
    // Calculate base price from comparable properties
    const basePrice = this.calculateBasePrice(subjectProperty, competitorData);

    // Adjust for market conditions
    const marketAdjustment = this.calculateMarketAdjustment(marketData);

    // Adjust for property features
    const featureAdjustment = this.calculateFeatureAdjustment(
      subjectProperty,
      competitorData
    );

    // Calculate optimal price
    const optimalPrice = basePrice * (1 + marketAdjustment + featureAdjustment);

    // Determine strategy based on goals and market
    const strategy = this.determineStrategy(
      subjectProperty,
      marketData,
      marketAdjustment
    );

    // Calculate price range
    const priceRange = this.calculatePriceRange(
      optimalPrice,
      strategy,
      marketData
    );

    // Estimate days on market
    const expectedDaysOnMarket = this.estimateDaysOnMarket(
      priceRange.optimal,
      basePrice,
      marketData
    );

    // Estimate offer count
    const expectedOfferCount = this.estimateOfferCount(
      priceRange.optimal,
      basePrice,
      marketData
    );

    // Generate reasoning
    const reasoning = this.generatePricingReasoning(
      strategy,
      marketAdjustment,
      featureAdjustment,
      marketData
    );

    return {
      recommendedPrice: Math.round(priceRange.optimal),
      strategy,
      reasoning,
      priceRange: {
        minimum: Math.round(priceRange.minimum),
        optimal: Math.round(priceRange.optimal),
        maximum: Math.round(priceRange.maximum)
      },
      expectedDaysOnMarket,
      expectedOfferCount
    };
  }

  /**
   * Generate timing recommendations
   */
  public generateTimingRecommendation(
    seasonalFactors: SeasonalFactorsData,
    marketTrend: MarketTrendData,
    propertyType: string
  ): TimingRecommendation {
    // Identify best months to list based on seasonal patterns
    const bestMonthsToList = this.identifyBestListingMonths(
      seasonalFactors,
      propertyType
    );

    // Identify best months to buy (inverse of selling)
    const bestMonthsToBuy = this.identifyBestBuyingMonths(
      seasonalFactors,
      propertyType
    );

    // Calculate seasonal advantage
    const currentMonth = new Date().getMonth() + 1;
    const seasonalAdvantage = this.calculateSeasonalAdvantage(
      currentMonth,
      seasonalFactors
    );

    // Determine market momentum
    const marketMomentum = this.determineMarketMomentum(marketTrend);

    // Calculate urgency score
    const urgencyScore = this.calculateUrgencyScore(
      seasonalAdvantage,
      marketMomentum,
      marketTrend
    );

    // Generate reasoning
    const reasoning = this.generateTimingReasoning(
      bestMonthsToList,
      marketMomentum,
      seasonalAdvantage,
      urgencyScore
    );

    return {
      bestMonthsToList,
      bestMonthsToBuy,
      seasonalAdvantage,
      marketMomentum,
      urgencyScore,
      reasoning
    };
  }

  /**
   * Analyze negotiation leverage
   */
  public analyzeNegotiationLeverage(
    propertyData: PropertyData,
    marketData: MarketAnalysisData,
    daysOnMarket: number
  ): NegotiationLeverage {
    const factors: NegotiationLeverage['keyFactors'] = [];

    // Supply/demand factor
    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;
    const supplyDemandImpact = this.calculateSupplyDemandImpact(supplyDemandRatio);
    factors.push({
      factor: 'Supply & Demand',
      impact: supplyDemandImpact,
      description: supplyDemandRatio < 1
        ? 'Strong demand favors sellers'
        : 'High supply favors buyers'
    });

    // Days on market factor
    const domImpact = this.calculateDaysOnMarketImpact(
      daysOnMarket,
      marketData.avgDaysOnMarket
    );
    factors.push({
      factor: 'Days on Market',
      impact: domImpact,
      description: daysOnMarket > marketData.avgDaysOnMarket
        ? 'Extended listing time favors buyers'
        : 'Quick listing favors sellers'
    });

    // Market trend factor
    const trendImpact = this.calculateTrendImpact(marketData.priceVelocity);
    factors.push({
      factor: 'Market Trend',
      impact: trendImpact,
      description: marketData.priceVelocity > 0
        ? 'Rising prices favor sellers'
        : 'Declining prices favor buyers'
    });

    // Price positioning factor
    const pricePercentile = this.calculatePercentile(
      propertyData.listPrice,
      marketData.comparablePrices
    );
    const priceImpact = this.calculatePricePositioningImpact(pricePercentile);
    factors.push({
      factor: 'Price Positioning',
      impact: priceImpact,
      description: pricePercentile > 75
        ? 'Premium pricing reduces seller power'
        : 'Competitive pricing strengthens seller position'
    });

    // Calculate overall leverage
    const sellerLeverage = this.calculateSellerLeverage(factors);
    const buyerLeverage = 100 - sellerLeverage;

    // Determine market power
    let marketPower: NegotiationLeverage['marketPower'];
    if (Math.abs(sellerLeverage - buyerLeverage) < 10) {
      marketPower = 'balanced';
    } else if (sellerLeverage > buyerLeverage) {
      marketPower = 'seller';
    } else {
      marketPower = 'buyer';
    }

    // Generate tactical recommendations
    const tacticalRecommendations = this.generateTacticalRecommendations(
      marketPower,
      factors,
      daysOnMarket
    );

    return {
      buyerLeverage,
      sellerLeverage,
      marketPower,
      keyFactors: factors,
      tacticalRecommendations
    };
  }

  /**
   * Generate investment strategy recommendation
   */
  public generateInvestmentStrategy(
    propertyData: PropertyData,
    marketData: MarketAnalysisData,
    investorProfile: InvestorProfile
  ): InvestmentStrategy {
    // Determine best strategy based on property and market
    const strategy = this.determineInvestmentStrategy(
      propertyData,
      marketData,
      investorProfile
    );

    // Calculate recommended horizon
    const horizon = this.calculateInvestmentHorizon(strategy, marketData);

    // Calculate target return
    const targetReturn = this.calculateTargetReturn(
      strategy,
      marketData,
      investorProfile.riskTolerance
    );

    // Determine risk level
    const riskLevel = this.determineRiskLevel(strategy, marketData);

    // Generate action items
    const actionItems = this.generateActionItems(strategy, propertyData);

    // Generate exit strategy
    const exitStrategy = this.generateExitStrategy(strategy, horizon);

    return {
      strategy,
      horizon,
      targetReturn,
      riskLevel,
      actionItems,
      exitStrategy
    };
  }

  /**
   * Generate comprehensive strategic recommendations
   */
  public generateComprehensiveRecommendations(
    propertyData: PropertyData,
    marketData: MarketAnalysisData,
    competitorData: CompetitorData[],
    seasonalFactors: SeasonalFactorsData,
    marketTrend: MarketTrendData,
    investorProfile?: InvestorProfile
  ): StrategicRecommendations {
    const pricing = this.calculatePricingStrategy(
      propertyData,
      marketData,
      competitorData
    );

    const timing = this.generateTimingRecommendation(
      seasonalFactors,
      marketTrend,
      propertyData.propertyType
    );

    const negotiation = this.analyzeNegotiationLeverage(
      propertyData,
      marketData,
      propertyData.daysOnMarket || 0
    );

    const investment = investorProfile
      ? this.generateInvestmentStrategy(propertyData, marketData, investorProfile)
      : undefined;

    // Calculate overall confidence based on data quality
    const overallConfidence = this.calculateOverallConfidence(
      marketData,
      competitorData.length
    );

    return {
      pricing,
      timing,
      negotiation,
      investment,
      overallConfidence
    };
  }

  // Helper methods

  private calculateBasePrice(
    subjectProperty: PropertyData,
    competitorData: CompetitorData[]
  ): number {
    if (competitorData.length === 0) {
      return subjectProperty.listPrice || 0;
    }

    // Use price per square foot from comparables
    const pricesPerSqFt = competitorData
      .filter(c => c.squareFeet > 0)
      .map(c => c.price / c.squareFeet);

    if (pricesPerSqFt.length === 0) {
      const avgPrice = competitorData.reduce((sum, c) => sum + c.price, 0) / competitorData.length;
      return avgPrice;
    }

    const avgPricePerSqFt = pricesPerSqFt.reduce((a, b) => a + b, 0) / pricesPerSqFt.length;
    return avgPricePerSqFt * subjectProperty.squareFeet;
  }

  private calculateMarketAdjustment(marketData: MarketAnalysisData): number {
    let adjustment = 0;

    // Price velocity adjustment
    if (marketData.priceVelocity > 2) {
      adjustment += 0.05; // 5% premium in hot market
    } else if (marketData.priceVelocity < -2) {
      adjustment -= 0.05; // 5% discount in declining market
    }

    // Supply/demand adjustment
    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;
    if (supplyDemandRatio < 0.8) {
      adjustment += 0.03; // Low supply premium
    } else if (supplyDemandRatio > 1.5) {
      adjustment -= 0.03; // High supply discount
    }

    return adjustment;
  }

  private calculateFeatureAdjustment(
    subjectProperty: PropertyData,
    competitorData: CompetitorData[]
  ): number {
    let adjustment = 0;

    const avgBedrooms = competitorData.reduce((sum, c) => sum + (c.bedrooms || 0), 0) / competitorData.length;
    const avgBathrooms = competitorData.reduce((sum, c) => sum + (c.bathrooms || 0), 0) / competitorData.length;

    // Bedroom adjustment
    if (subjectProperty.bedrooms > avgBedrooms) {
      adjustment += 0.02 * (subjectProperty.bedrooms - avgBedrooms);
    }

    // Bathroom adjustment
    if (subjectProperty.bathrooms > avgBathrooms) {
      adjustment += 0.03 * (subjectProperty.bathrooms - avgBathrooms);
    }

    return Math.max(-0.15, Math.min(0.15, adjustment));
  }

  private determineStrategy(
    propertyData: PropertyData,
    marketData: MarketAnalysisData,
    marketAdjustment: number
  ): PricingStrategy['strategy'] {
    const goal = propertyData.sellerGoal || 'balanced';

    if (goal === 'quick-sale' || marketData.priceVelocity < -1) {
      return 'aggressive';
    } else if (marketAdjustment > 0.03 || marketData.priceVelocity > 2) {
      return 'premium';
    } else if (marketData.activeListings > marketData.soldListings * 1.5) {
      return 'value';
    } else {
      return 'competitive';
    }
  }

  private calculatePriceRange(
    optimalPrice: number,
    strategy: PricingStrategy['strategy'],
    marketData: MarketAnalysisData
  ): { minimum: number; optimal: number; maximum: number } {
    let minMultiplier = 0.95;
    let maxMultiplier = 1.05;

    if (strategy === 'aggressive') {
      minMultiplier = 0.90;
      maxMultiplier = 0.98;
    } else if (strategy === 'premium') {
      minMultiplier = 0.98;
      maxMultiplier = 1.10;
    }

    return {
      minimum: optimalPrice * minMultiplier,
      optimal: optimalPrice,
      maximum: optimalPrice * maxMultiplier
    };
  }

  private estimateDaysOnMarket(
    recommendedPrice: number,
    basePrice: number,
    marketData: MarketAnalysisData
  ): number {
    const priceRatio = recommendedPrice / basePrice;
    let days = marketData.avgDaysOnMarket;

    // Adjust based on pricing
    if (priceRatio < 0.95) {
      days *= 0.7; // Aggressive pricing sells faster
    } else if (priceRatio > 1.05) {
      days *= 1.5; // Premium pricing takes longer
    }

    return Math.round(days);
  }

  private estimateOfferCount(
    recommendedPrice: number,
    basePrice: number,
    marketData: MarketAnalysisData
  ): number {
    const priceRatio = recommendedPrice / basePrice;
    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;

    let offers = 2; // Base expectation

    if (supplyDemandRatio < 0.8 && priceRatio < 1.0) {
      offers = 5; // Hot market with good pricing
    } else if (supplyDemandRatio > 1.5 || priceRatio > 1.1) {
      offers = 1; // Slow market or high pricing
    }

    return offers;
  }

  private generatePricingReasoning(
    strategy: PricingStrategy['strategy'],
    marketAdjustment: number,
    featureAdjustment: number,
    marketData: MarketAnalysisData
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`${strategy.charAt(0).toUpperCase() + strategy.slice(1)} pricing strategy recommended`);

    if (marketAdjustment > 0.03) {
      reasoning.push('Strong market conditions support premium pricing');
    } else if (marketAdjustment < -0.03) {
      reasoning.push('Market conditions suggest competitive pricing');
    }

    if (featureAdjustment > 0.05) {
      reasoning.push('Property features justify price premium');
    }

    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;
    if (supplyDemandRatio < 1) {
      reasoning.push('Low inventory supports higher pricing');
    }

    return reasoning;
  }

  private identifyBestListingMonths(
    seasonalFactors: SeasonalFactorsData,
    propertyType: string
  ): number[] {
    const monthlyScores: { month: number; score: number }[] = [];

    for (let month = 1; month <= 12; month++) {
      const multiplier = seasonalFactors.monthlyMultipliers[month] || 1.0;
      const score = multiplier * 100;
      monthlyScores.push({ month, score });
    }

    // Sort by score and return top 3 months
    return monthlyScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(m => m.month);
  }

  private identifyBestBuyingMonths(
    seasonalFactors: SeasonalFactorsData,
    propertyType: string
  ): number[] {
    const monthlyScores: { month: number; score: number }[] = [];

    for (let month = 1; month <= 12; month++) {
      const multiplier = seasonalFactors.monthlyMultipliers[month] || 1.0;
      const score = (2 - multiplier) * 100; // Inverse for buying
      monthlyScores.push({ month, score });
    }

    return monthlyScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(m => m.month);
  }

  private calculateSeasonalAdvantage(
    currentMonth: number,
    seasonalFactors: SeasonalFactorsData
  ): number {
    const multiplier = seasonalFactors.monthlyMultipliers[currentMonth] || 1.0;
    return (multiplier - 1.0) * 2; // Scale to -1 to 1
  }

  private determineMarketMomentum(
    marketTrend: MarketTrendData
  ): TimingRecommendation['marketMomentum'] {
    if (marketTrend.acceleration > 0.5) return 'accelerating';
    if (marketTrend.acceleration < -0.5) return 'decelerating';
    return 'steady';
  }

  private calculateUrgencyScore(
    seasonalAdvantage: number,
    marketMomentum: TimingRecommendation['marketMomentum'],
    marketTrend: MarketTrendData
  ): number {
    let score = 50; // Base

    if (seasonalAdvantage > 0.3) score += 20;
    if (marketMomentum === 'accelerating') score += 20;
    if (marketTrend.velocity > 2) score += 15;

    return Math.min(100, score);
  }

  private generateTimingReasoning(
    bestMonths: number[],
    momentum: TimingRecommendation['marketMomentum'],
    seasonalAdvantage: number,
    urgencyScore: number
  ): string[] {
    const reasoning: string[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    reasoning.push(`Best listing months: ${bestMonths.map(m => monthNames[m - 1]).join(', ')}`);
    reasoning.push(`Market momentum is ${momentum}`);

    if (seasonalAdvantage > 0.2) {
      reasoning.push('Current season favors listings');
    } else if (seasonalAdvantage < -0.2) {
      reasoning.push('Consider waiting for peak season');
    }

    if (urgencyScore > 70) {
      reasoning.push('High urgency - favorable conditions may not last');
    }

    return reasoning;
  }

  private calculateSupplyDemandImpact(ratio: number): number {
    if (ratio < 0.8) return 0.5; // Strong seller advantage
    if (ratio > 1.5) return -0.5; // Strong buyer advantage
    return 0; // Balanced
  }

  private calculateDaysOnMarketImpact(dom: number, avgDom: number): number {
    const ratio = dom / avgDom;
    if (ratio > 1.5) return -0.4; // Favor buyers
    if (ratio < 0.7) return 0.3; // Favor sellers
    return 0;
  }

  private calculateTrendImpact(velocity: number): number {
    return Math.max(-0.5, Math.min(0.5, velocity * 0.1));
  }

  private calculatePricePositioningImpact(percentile: number): number {
    if (percentile > 75) return -0.3;
    if (percentile < 25) return 0.3;
    return 0;
  }

  private calculatePercentile(value: number, values: number[]): number {
    if (values.length === 0) return 50;
    const sorted = [...values].sort((a, b) => a - b);
    const belowCount = sorted.filter(v => v < value).length;
    return (belowCount / sorted.length) * 100;
  }

  private calculateSellerLeverage(
    factors: NegotiationLeverage['keyFactors']
  ): number {
    const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0);
    const avgImpact = totalImpact / factors.length;
    return Math.round(50 + (avgImpact * 50));
  }

  private generateTacticalRecommendations(
    marketPower: NegotiationLeverage['marketPower'],
    factors: NegotiationLeverage['keyFactors'],
    daysOnMarket: number
  ): string[] {
    const recommendations: string[] = [];

    if (marketPower === 'seller') {
      recommendations.push('Consider multiple offers to drive competition');
      recommendations.push('Set firm deadlines for offers');
      recommendations.push('Avoid unnecessary concessions');
    } else if (marketPower === 'buyer') {
      recommendations.push('Request concessions or repairs');
      recommendations.push('Negotiate below asking price');
      recommendations.push('Include contingencies for protection');
    } else {
      recommendations.push('Focus on win-win negotiations');
      recommendations.push('Be prepared to compromise on minor points');
      recommendations.push('Emphasize strong qualifications or property readiness');
    }

    if (daysOnMarket > 60) {
      recommendations.push('Leverage extended listing time in negotiations');
    }

    return recommendations;
  }

  private determineInvestmentStrategy(
    propertyData: PropertyData,
    marketData: MarketAnalysisData,
    investorProfile: InvestorProfile
  ): InvestmentStrategy['strategy'] {
    if (investorProfile.goal === 'income') return 'rental';
    if (investorProfile.timeHorizon < 24) return 'fix-and-flip';
    if (marketData.priceVelocity > 3) return 'speculative';
    return 'buy-and-hold';
  }

  private calculateInvestmentHorizon(
    strategy: InvestmentStrategy['strategy'],
    marketData: MarketAnalysisData
  ): number {
    if (strategy === 'fix-and-flip') return 12;
    if (strategy === 'rental') return 60;
    if (strategy === 'speculative') return 24;
    return 36; // buy-and-hold
  }

  private calculateTargetReturn(
    strategy: InvestmentStrategy['strategy'],
    marketData: MarketAnalysisData,
    riskTolerance: string
  ): number {
    let baseReturn = marketData.yoyAppreciation || 5;

    if (strategy === 'fix-and-flip') baseReturn = 15;
    else if (strategy === 'rental') baseReturn = 8;
    else if (strategy === 'speculative') baseReturn = 20;

    if (riskTolerance === 'aggressive') baseReturn *= 1.2;
    else if (riskTolerance === 'conservative') baseReturn *= 0.8;

    return Math.round(baseReturn);
  }

  private determineRiskLevel(
    strategy: InvestmentStrategy['strategy'],
    marketData: MarketAnalysisData
  ): InvestmentStrategy['riskLevel'] {
    if (strategy === 'speculative' || marketData.priceVolatility > 0.15) {
      return 'high';
    } else if (strategy === 'rental' || marketData.priceVolatility < 0.05) {
      return 'low';
    }
    return 'medium';
  }

  private generateActionItems(
    strategy: InvestmentStrategy['strategy'],
    propertyData: PropertyData
  ): string[] {
    const items: string[] = [];

    if (strategy === 'fix-and-flip') {
      items.push('Conduct thorough inspection for renovation opportunities');
      items.push('Get multiple contractor quotes');
      items.push('Create detailed budget with 20% contingency');
    } else if (strategy === 'rental') {
      items.push('Research rental comps in the area');
      items.push('Calculate cash flow with 50% rule');
      items.push('Review landlord-tenant laws');
    }

    items.push('Secure financing pre-approval');
    items.push('Review property insurance options');

    return items;
  }

  private generateExitStrategy(
    strategy: InvestmentStrategy['strategy'],
    horizon: number
  ): string {
    if (strategy === 'fix-and-flip') {
      return `Complete renovations and list within ${horizon} months for maximum return`;
    } else if (strategy === 'rental') {
      return `Hold for positive cash flow, sell when appreciation reaches 25%+ over purchase price`;
    } else if (strategy === 'speculative') {
      return `Monitor market closely, exit when momentum slows or target return achieved`;
    }
    return `Hold for ${horizon} months, review market conditions quarterly`;
  }

  private calculateOverallConfidence(
    marketData: MarketAnalysisData,
    comparableCount: number
  ): number {
    let confidence = 70; // Base

    if (comparableCount >= 10) confidence += 15;
    else if (comparableCount < 5) confidence -= 15;

    if (marketData.dataQuality === 'high') confidence += 15;
    else if (marketData.dataQuality === 'low') confidence -= 20;

    return Math.max(0, Math.min(100, confidence));
  }
}

// Supporting interfaces

export interface PropertyData {
  listPrice: number;
  squareFeet: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  daysOnMarket?: number;
  sellerGoal?: 'quick-sale' | 'max-profit' | 'balanced';
}

export interface MarketAnalysisData {
  activeListings: number;
  soldListings: number;
  avgDaysOnMarket: number;
  priceVelocity: number;
  priceVolatility: number;
  yoyAppreciation?: number;
  comparablePrices: number[];
  dataQuality: 'high' | 'medium' | 'low';
}

export interface CompetitorData {
  price: number;
  squareFeet: number;
  bedrooms?: number;
  bathrooms?: number;
  daysOnMarket: number;
}

export interface SeasonalFactorsData {
  monthlyMultipliers: Record<number, number>;
}

export interface MarketTrendData {
  velocity: number;
  acceleration: number;
}

export interface InvestorProfile {
  goal: 'income' | 'appreciation' | 'both';
  timeHorizon: number; // months
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}
