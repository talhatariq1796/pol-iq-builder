/**
 * Market Intelligence Module
 * Provides trend analysis, competitive analysis, and investment insights
 */

export interface TrendAnalysis {
  priceDirection: 'increasing' | 'decreasing' | 'stable';
  velocity: number; // % change per month
  marketCycle: 'peak' | 'decline' | 'trough' | 'recovery';
  confidence: number; // 0-1
  dataPoints: number;
  timeframe: string;
}

export interface CompetitiveAnalysis {
  marketShare: number; // % of total listings
  positioning: 'premium' | 'mid-market' | 'value';
  competitorCount: number;
  averageTimeOnMarket: number;
  priceCompetitiveness: number; // -1 to 1 (below to above market)
}

export interface InvestmentInsight {
  riskScore: number; // 0-100
  opportunityRating: number; // 0-100
  expectedReturn: number; // % annual
  holdingPeriod: number; // months
  liquidityScore: number; // 0-100
  recommendation: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
}

export interface MarketIntelligenceReport {
  trend: TrendAnalysis;
  competitive: CompetitiveAnalysis;
  investment: InvestmentInsight;
  generatedAt: Date;
  subjectProperty?: {
    address: string;
    price: number;
    propertyType: string;
  };
}

export class MarketIntelligence {
  /**
   * Analyze price trends from time-series data
   */
  public analyzeTrend(timeSeriesData: TimeSeriesDataPoint[]): TrendAnalysis {
    if (timeSeriesData.length < 2) {
      return {
        priceDirection: 'stable',
        velocity: 0,
        marketCycle: 'trough',
        confidence: 0,
        dataPoints: timeSeriesData.length,
        timeframe: 'insufficient data'
      };
    }

    // Sort by date
    const sorted = [...timeSeriesData].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate velocity (monthly change rate)
    const firstPrice = sorted[0].averagePrice;
    const lastPrice = sorted[sorted.length - 1].averagePrice;
    const monthsDiff = this.getMonthsDifference(
      new Date(sorted[0].date),
      new Date(sorted[sorted.length - 1].date)
    );
    const velocity = monthsDiff > 0
      ? ((lastPrice - firstPrice) / firstPrice / monthsDiff) * 100
      : 0;

    // Determine price direction
    let priceDirection: TrendAnalysis['priceDirection'];
    if (Math.abs(velocity) < 0.5) {
      priceDirection = 'stable';
    } else if (velocity > 0) {
      priceDirection = 'increasing';
    } else {
      priceDirection = 'decreasing';
    }

    // Determine market cycle using peak/trough detection
    const marketCycle = this.detectMarketCycle(sorted);

    // Calculate confidence based on data consistency
    const confidence = this.calculateTrendConfidence(sorted);

    return {
      priceDirection,
      velocity,
      marketCycle,
      confidence,
      dataPoints: sorted.length,
      timeframe: `${monthsDiff} months`
    };
  }

  /**
   * Analyze competitive positioning in the market
   */
  public analyzeCompetitivePosition(
    subjectPrice: number,
    marketData: CompetitiveMarketData
  ): CompetitiveAnalysis {
    const totalListings = marketData.totalListings;
    const subjectListings = marketData.subjectListings;
    const marketShare = totalListings > 0
      ? (subjectListings / totalListings) * 100
      : 0;

    // Determine positioning based on price percentile
    const pricePercentile = this.calculatePercentile(
      subjectPrice,
      marketData.allPrices
    );

    let positioning: CompetitiveAnalysis['positioning'];
    if (pricePercentile >= 75) {
      positioning = 'premium';
    } else if (pricePercentile >= 25) {
      positioning = 'mid-market';
    } else {
      positioning = 'value';
    }

    // Calculate price competitiveness (-1 to 1)
    const avgMarketPrice = this.calculateAverage(marketData.allPrices);
    const priceCompetitiveness = avgMarketPrice > 0
      ? (subjectPrice - avgMarketPrice) / avgMarketPrice
      : 0;

    return {
      marketShare,
      positioning,
      competitorCount: marketData.competitorCount,
      averageTimeOnMarket: marketData.avgDaysOnMarket,
      priceCompetitiveness: Math.max(-1, Math.min(1, priceCompetitiveness))
    };
  }

  /**
   * Generate investment insights and recommendations
   */
  public generateInvestmentInsight(
    propertyData: PropertyInvestmentData,
    marketData: MarketIntelligenceData
  ): InvestmentInsight {
    // Calculate risk score (0-100, higher = more risk)
    const riskScore = this.calculateRiskScore(propertyData, marketData);

    // Calculate opportunity rating (0-100, higher = better opportunity)
    const opportunityRating = this.calculateOpportunityRating(
      propertyData,
      marketData
    );

    // Expected return calculation
    const expectedReturn = this.calculateExpectedReturn(
      propertyData,
      marketData
    );

    // Recommended holding period
    const holdingPeriod = this.calculateOptimalHoldingPeriod(marketData);

    // Liquidity score (ease of selling)
    const liquidityScore = this.calculateLiquidityScore(propertyData, marketData);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      riskScore,
      opportunityRating,
      expectedReturn
    );

    return {
      riskScore,
      opportunityRating,
      expectedReturn,
      holdingPeriod,
      liquidityScore,
      recommendation
    };
  }

  /**
   * Generate comprehensive market intelligence report
   */
  public generateReport(
    subjectProperty: {
      address: string;
      price: number;
      propertyType: string;
    },
    timeSeriesData: TimeSeriesDataPoint[],
    competitiveData: CompetitiveMarketData,
    investmentData: PropertyInvestmentData,
    marketData: MarketIntelligenceData
  ): MarketIntelligenceReport {
    return {
      trend: this.analyzeTrend(timeSeriesData),
      competitive: this.analyzeCompetitivePosition(
        subjectProperty.price,
        competitiveData
      ),
      investment: this.generateInvestmentInsight(investmentData, marketData),
      generatedAt: new Date(),
      subjectProperty
    };
  }

  // Helper methods

  private getMonthsDifference(start: Date, end: Date): number {
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    return yearDiff * 12 + monthDiff;
  }

  private detectMarketCycle(
    sorted: TimeSeriesDataPoint[]
  ): TrendAnalysis['marketCycle'] {
    if (sorted.length < 3) return 'trough';

    const recentData = sorted.slice(-6); // Last 6 periods
    const prices = recentData.map(d => d.averagePrice);

    // Simple peak/trough detection
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const currentPrice = prices[prices.length - 1];
    const priceRange = maxPrice - minPrice;

    if (priceRange === 0) return 'trough';

    const position = (currentPrice - minPrice) / priceRange;

    if (position >= 0.85) return 'peak';
    if (position <= 0.15) return 'trough';

    // Check direction
    const recentTrend = prices[prices.length - 1] - prices[0];
    return recentTrend > 0 ? 'recovery' : 'decline';
  }

  private calculateTrendConfidence(sorted: TimeSeriesDataPoint[]): number {
    if (sorted.length < 2) return 0;

    // Calculate R-squared for linear trend
    const n = sorted.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = sorted.map(d => d.averagePrice);

    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    let ssRes = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - xMean;
      const yDiff = yValues[i] - yMean;
      ssRes += yDiff * yDiff;
    }

    // Calculate regression
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) * (xValues[i] - xMean);
    }
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Calculate R-squared
    let ssReg = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * xValues[i] + intercept;
      ssReg += (predicted - yMean) * (predicted - yMean);
    }

    const rSquared = ssTot !== 0 ? ssReg / ssTot : 0;
    return Math.max(0, Math.min(1, rSquared));
  }

  private calculatePercentile(value: number, values: number[]): number {
    if (values.length === 0) return 50;
    const sorted = [...values].sort((a, b) => a - b);
    const belowCount = sorted.filter(v => v < value).length;
    return (belowCount / sorted.length) * 100;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateRiskScore(
    propertyData: PropertyInvestmentData,
    marketData: MarketIntelligenceData
  ): number {
    let riskScore = 50; // Base risk

    // Market volatility risk
    if (marketData.priceVolatility > 0.15) riskScore += 20;
    else if (marketData.priceVolatility < 0.05) riskScore -= 10;

    // Days on market risk
    if (propertyData.daysOnMarket > 90) riskScore += 15;
    else if (propertyData.daysOnMarket < 30) riskScore -= 10;

    // Price trend risk
    if (marketData.trendVelocity < -2) riskScore += 20;
    else if (marketData.trendVelocity > 2) riskScore -= 10;

    // Supply/demand risk
    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;
    if (supplyDemandRatio > 2) riskScore += 15;
    else if (supplyDemandRatio < 0.5) riskScore -= 15;

    return Math.max(0, Math.min(100, riskScore));
  }

  private calculateOpportunityRating(
    propertyData: PropertyInvestmentData,
    marketData: MarketIntelligenceData
  ): number {
    let opportunity = 50; // Base opportunity

    // Price below market average is opportunity
    if (propertyData.pricePercentile < 40) opportunity += 20;
    else if (propertyData.pricePercentile > 75) opportunity -= 15;

    // Strong market trend is opportunity
    if (marketData.trendVelocity > 1) opportunity += 15;

    // Low supply is opportunity
    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;
    if (supplyDemandRatio < 0.8) opportunity += 20;

    // Recent appreciation
    if (marketData.yoyAppreciation > 5) opportunity += 15;

    return Math.max(0, Math.min(100, opportunity));
  }

  private calculateExpectedReturn(
    propertyData: PropertyInvestmentData,
    marketData: MarketIntelligenceData
  ): number {
    // Base return on historical appreciation
    let expectedReturn = marketData.yoyAppreciation;

    // Adjust for current market cycle
    if (marketData.trendVelocity > 0) {
      expectedReturn *= 1.1; // Boost for uptrend
    } else if (marketData.trendVelocity < 0) {
      expectedReturn *= 0.8; // Reduce for downtrend
    }

    // Adjust for supply/demand
    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;
    if (supplyDemandRatio < 1) {
      expectedReturn *= 1.15; // Strong demand boost
    }

    return Math.max(-10, Math.min(30, expectedReturn));
  }

  private calculateOptimalHoldingPeriod(
    marketData: MarketIntelligenceData
  ): number {
    // Base holding period: 36 months
    let holdingPeriod = 36;

    // Adjust based on market cycle
    if (marketData.trendVelocity > 2) {
      holdingPeriod = 24; // Shorter in hot market
    } else if (marketData.trendVelocity < -1) {
      holdingPeriod = 48; // Longer in declining market
    }

    return holdingPeriod;
  }

  private calculateLiquidityScore(
    propertyData: PropertyInvestmentData,
    marketData: MarketIntelligenceData
  ): number {
    let liquidity = 50; // Base liquidity

    // Days on market factor
    if (marketData.avgDaysOnMarket < 30) liquidity += 25;
    else if (marketData.avgDaysOnMarket > 90) liquidity -= 25;

    // Supply/demand factor
    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;
    if (supplyDemandRatio < 1) liquidity += 25;
    else if (supplyDemandRatio > 2) liquidity -= 20;

    // Price competitiveness
    if (propertyData.pricePercentile < 50) liquidity += 15;

    return Math.max(0, Math.min(100, liquidity));
  }

  private generateRecommendation(
    riskScore: number,
    opportunityRating: number,
    expectedReturn: number
  ): InvestmentInsight['recommendation'] {
    const score = opportunityRating - riskScore + (expectedReturn * 2);

    if (score >= 40) return 'strong-buy';
    if (score >= 15) return 'buy';
    if (score >= -15) return 'hold';
    if (score >= -40) return 'sell';
    return 'strong-sell';
  }
}

// Supporting interfaces

export interface TimeSeriesDataPoint {
  date: string;
  averagePrice: number;
  medianPrice?: number;
  volume?: number;
}

export interface CompetitiveMarketData {
  totalListings: number;
  subjectListings: number;
  allPrices: number[];
  competitorCount: number;
  avgDaysOnMarket: number;
}

export interface PropertyInvestmentData {
  daysOnMarket: number;
  pricePercentile: number;
  propertyType: string;
  squareFeet?: number;
}

export interface MarketIntelligenceData {
  priceVolatility: number;
  trendVelocity: number;
  activeListings: number;
  soldListings: number;
  yoyAppreciation: number;
  avgDaysOnMarket: number;
}
