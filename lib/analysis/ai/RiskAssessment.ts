/**
 * Risk Assessment Matrix
 * Comprehensive risk analysis for real estate investments
 */

export interface RiskScore {
  overall: number; // 0-100
  category: 'low' | 'medium' | 'high' | 'critical';
  breakdown: {
    market: number;
    property: number;
    economic: number;
    liquidity: number;
  };
}

export interface MarketRisk {
  score: number; // 0-100
  factors: RiskFactor[];
  volatilityIndex: number;
  trendStability: number;
  concentrationRisk: number;
}

export interface PropertyRisk {
  score: number; // 0-100
  factors: RiskFactor[];
  conditionRisk: number;
  locationRisk: number;
  valueRisk: number;
}

export interface EconomicRisk {
  score: number; // 0-100
  factors: RiskFactor[];
  interestRateRisk: number;
  inflationRisk: number;
  employmentRisk: number;
}

export interface LiquidityRisk {
  score: number; // 0-100
  factors: RiskFactor[];
  marketDepth: number;
  averageDaysOnMarket: number;
  priceSensitivity: number;
}

export interface RiskFactor {
  name: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  description: string;
  mitigation?: string;
}

export interface RiskAssessmentReport {
  riskScore: RiskScore;
  marketRisk: MarketRisk;
  propertyRisk: PropertyRisk;
  economicRisk: EconomicRisk;
  liquidityRisk: LiquidityRisk;
  recommendations: string[];
  assessmentDate: Date;
}

export class RiskAssessment {
  /**
   * Calculate overall risk score
   */
  public calculateRiskScore(
    marketRisk: MarketRisk,
    propertyRisk: PropertyRisk,
    economicRisk: EconomicRisk,
    liquidityRisk: LiquidityRisk
  ): RiskScore {
    // Weighted average of risk components
    const overall = (
      marketRisk.score * 0.30 +
      propertyRisk.score * 0.25 +
      economicRisk.score * 0.25 +
      liquidityRisk.score * 0.20
    );

    // Determine risk category
    let category: RiskScore['category'];
    if (overall < 30) category = 'low';
    else if (overall < 55) category = 'medium';
    else if (overall < 75) category = 'high';
    else category = 'critical';

    return {
      overall: Math.round(overall),
      category,
      breakdown: {
        market: Math.round(marketRisk.score),
        property: Math.round(propertyRisk.score),
        economic: Math.round(economicRisk.score),
        liquidity: Math.round(liquidityRisk.score)
      }
    };
  }

  /**
   * Assess market risk factors
   */
  public assessMarketRisk(marketData: MarketRiskData): MarketRisk {
    const factors: RiskFactor[] = [];

    // Volatility risk
    const volatilityIndex = this.calculateVolatilityIndex(marketData.priceHistory);
    factors.push({
      name: 'Price Volatility',
      impact: volatilityIndex > 0.15 ? 'high' : volatilityIndex > 0.08 ? 'medium' : 'low',
      score: Math.min(100, volatilityIndex * 400),
      description: `Market volatility is ${(volatilityIndex * 100).toFixed(1)}%`,
      mitigation: volatilityIndex > 0.15
        ? 'Consider waiting for market stabilization'
        : 'Maintain adequate cash reserves'
    });

    // Trend stability
    const trendStability = this.calculateTrendStability(marketData.priceHistory);
    factors.push({
      name: 'Trend Stability',
      impact: trendStability < 0.4 ? 'high' : trendStability < 0.7 ? 'medium' : 'low',
      score: Math.round((1 - trendStability) * 100),
      description: `Market trend consistency: ${(trendStability * 100).toFixed(0)}%`,
      mitigation: 'Focus on long-term investment horizon'
    });

    // Supply/demand imbalance
    const supplyDemandRatio = marketData.activeListings / marketData.soldListings;
    const imbalanceRisk = Math.abs(supplyDemandRatio - 1) * 50;
    factors.push({
      name: 'Supply/Demand Balance',
      impact: imbalanceRisk > 40 ? 'high' : imbalanceRisk > 20 ? 'medium' : 'low',
      score: Math.min(100, imbalanceRisk),
      description: supplyDemandRatio > 1.2
        ? 'Oversupply condition detected'
        : supplyDemandRatio < 0.8
        ? 'Tight supply market'
        : 'Balanced market',
      mitigation: supplyDemandRatio > 1.2
        ? 'Price competitively and market aggressively'
        : 'Standard marketing approach'
    });

    // Market concentration risk
    const concentrationRisk = this.calculateConcentrationRisk(marketData);
    factors.push({
      name: 'Market Concentration',
      impact: concentrationRisk > 60 ? 'high' : concentrationRisk > 35 ? 'medium' : 'low',
      score: concentrationRisk,
      description: concentrationRisk > 50
        ? 'High dependency on specific property types or areas'
        : 'Diversified market',
      mitigation: 'Consider diversification across property types'
    });

    // Calculate overall market risk score
    const marketRiskScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

    return {
      score: Math.round(marketRiskScore),
      factors,
      volatilityIndex,
      trendStability,
      concentrationRisk
    };
  }

  /**
   * Assess property-specific risks
   */
  public assessPropertyRisk(propertyData: PropertyRiskData): PropertyRisk {
    const factors: RiskFactor[] = [];

    // Condition risk
    const conditionRisk = this.calculateConditionRisk(propertyData);
    factors.push({
      name: 'Property Condition',
      impact: conditionRisk > 60 ? 'high' : conditionRisk > 35 ? 'medium' : 'low',
      score: conditionRisk,
      description: propertyData.yearBuilt < 1980
        ? 'Older property may require significant maintenance'
        : 'Modern property with lower maintenance risk',
      mitigation: 'Budget for deferred maintenance and updates'
    });

    // Location risk
    const locationRisk = this.calculateLocationRisk(propertyData);
    factors.push({
      name: 'Location Quality',
      impact: locationRisk > 60 ? 'high' : locationRisk > 35 ? 'medium' : 'low',
      score: locationRisk,
      description: this.getLocationDescription(locationRisk),
      mitigation: locationRisk > 50
        ? 'Price accordingly or consider alternative markets'
        : 'Leverage location as selling point'
    });

    // Valuation risk
    const valueRisk = this.calculateValueRisk(propertyData);
    factors.push({
      name: 'Valuation Risk',
      impact: valueRisk > 70 ? 'critical' : valueRisk > 45 ? 'high' : valueRisk > 25 ? 'medium' : 'low',
      score: valueRisk,
      description: propertyData.pricePercentile > 85
        ? 'Property priced significantly above market median'
        : propertyData.pricePercentile < 15
        ? 'Below-market pricing may indicate issues'
        : 'Market-appropriate pricing',
      mitigation: 'Obtain independent appraisal for validation'
    });

    // Environmental/natural disaster risk
    if (propertyData.floodZone || propertyData.earthquakeZone || propertyData.wildFireZone) {
      const environmentalRisk = this.calculateEnvironmentalRisk(propertyData);
      factors.push({
        name: 'Environmental Hazards',
        impact: environmentalRisk > 60 ? 'high' : 'medium',
        score: environmentalRisk,
        description: 'Property located in natural hazard zone',
        mitigation: 'Obtain comprehensive insurance coverage'
      });
    }

    const propertyRiskScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

    return {
      score: Math.round(propertyRiskScore),
      factors,
      conditionRisk,
      locationRisk,
      valueRisk
    };
  }

  /**
   * Assess economic risks
   */
  public assessEconomicRisk(economicData: EconomicRiskData): EconomicRisk {
    const factors: RiskFactor[] = [];

    // Interest rate risk
    const interestRateRisk = this.calculateInterestRateRisk(economicData);
    factors.push({
      name: 'Interest Rate Environment',
      impact: interestRateRisk > 60 ? 'high' : interestRateRisk > 35 ? 'medium' : 'low',
      score: interestRateRisk,
      description: economicData.interestRate > 7
        ? 'Elevated interest rates reduce affordability'
        : economicData.interestRate < 4
        ? 'Favorable rate environment'
        : 'Moderate interest rate environment',
      mitigation: interestRateRisk > 50
        ? 'Lock in fixed-rate financing if possible'
        : 'Standard financing approach'
    });

    // Inflation risk
    const inflationRisk = this.calculateInflationRisk(economicData);
    factors.push({
      name: 'Inflation Pressure',
      impact: inflationRisk > 60 ? 'high' : inflationRisk > 35 ? 'medium' : 'low',
      score: inflationRisk,
      description: economicData.inflation > 5
        ? 'High inflation may pressure buyer affordability'
        : 'Inflation within normal range',
      mitigation: 'Real estate can hedge against inflation long-term'
    });

    // Employment risk
    const employmentRisk = this.calculateEmploymentRisk(economicData);
    factors.push({
      name: 'Employment Stability',
      impact: employmentRisk > 60 ? 'high' : employmentRisk > 35 ? 'medium' : 'low',
      score: employmentRisk,
      description: economicData.unemployment > 6
        ? 'Elevated unemployment may reduce demand'
        : 'Healthy employment market',
      mitigation: employmentRisk > 50
        ? 'Focus on stable employment sectors'
        : 'Standard approach'
    });

    // GDP growth risk
    if (economicData.gdpGrowth !== undefined) {
      const gdpRisk = economicData.gdpGrowth < 1 ? 60 : economicData.gdpGrowth < 2 ? 40 : 20;
      factors.push({
        name: 'Economic Growth',
        impact: gdpRisk > 50 ? 'high' : gdpRisk > 30 ? 'medium' : 'low',
        score: gdpRisk,
        description: economicData.gdpGrowth < 1
          ? 'Weak economic growth'
          : economicData.gdpGrowth > 3
          ? 'Strong economic expansion'
          : 'Moderate growth',
        mitigation: 'Monitor economic indicators quarterly'
      });
    }

    const economicRiskScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

    return {
      score: Math.round(economicRiskScore),
      factors,
      interestRateRisk,
      inflationRisk,
      employmentRisk
    };
  }

  /**
   * Assess liquidity risks
   */
  public assessLiquidityRisk(liquidityData: LiquidityRiskData): LiquidityRisk {
    const factors: RiskFactor[] = [];

    // Market depth
    const marketDepth = this.calculateMarketDepth(liquidityData);
    const marketDepthScore = (1 - marketDepth) * 100;
    factors.push({
      name: 'Market Depth',
      impact: marketDepth < 0.3 ? 'high' : marketDepth < 0.6 ? 'medium' : 'low',
      score: marketDepthScore,
      description: marketDepth < 0.4
        ? 'Shallow market with limited buyers'
        : 'Adequate market depth',
      mitigation: 'Expand marketing reach and consider incentives'
    });

    // Days on market
    const domRisk = this.calculateDaysOnMarketRisk(liquidityData);
    factors.push({
      name: 'Time to Sale',
      impact: domRisk > 60 ? 'high' : domRisk > 35 ? 'medium' : 'low',
      score: domRisk,
      description: liquidityData.avgDaysOnMarket > 90
        ? 'Extended selling periods expected'
        : liquidityData.avgDaysOnMarket < 30
        ? 'Quick sales typical'
        : 'Normal selling timeline',
      mitigation: domRisk > 50
        ? 'Price competitively and stage professionally'
        : 'Standard preparation'
    });

    // Price sensitivity
    const priceSensitivity = this.calculatePriceSensitivity(liquidityData);
    factors.push({
      name: 'Price Sensitivity',
      impact: priceSensitivity > 0.7 ? 'high' : priceSensitivity > 0.4 ? 'medium' : 'low',
      score: priceSensitivity * 100,
      description: priceSensitivity > 0.6
        ? 'Market highly sensitive to pricing'
        : 'Moderate price sensitivity',
      mitigation: 'Careful pricing strategy is critical'
    });

    // Transaction volume
    if (liquidityData.monthlyVolume !== undefined) {
      const volumeRisk = liquidityData.monthlyVolume < 10 ? 70
        : liquidityData.monthlyVolume < 30 ? 40
        : 20;

      factors.push({
        name: 'Transaction Volume',
        impact: volumeRisk > 60 ? 'high' : volumeRisk > 30 ? 'medium' : 'low',
        score: volumeRisk,
        description: liquidityData.monthlyVolume < 15
          ? 'Low transaction activity'
          : 'Active market',
        mitigation: 'Consider timing listing for peak season'
      });
    }

    const liquidityRiskScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

    return {
      score: Math.round(liquidityRiskScore),
      factors,
      marketDepth,
      averageDaysOnMarket: liquidityData.avgDaysOnMarket,
      priceSensitivity
    };
  }

  /**
   * Generate comprehensive risk assessment report
   */
  public generateRiskReport(
    marketData: MarketRiskData,
    propertyData: PropertyRiskData,
    economicData: EconomicRiskData,
    liquidityData: LiquidityRiskData
  ): RiskAssessmentReport {
    const marketRisk = this.assessMarketRisk(marketData);
    const propertyRisk = this.assessPropertyRisk(propertyData);
    const economicRisk = this.assessEconomicRisk(economicData);
    const liquidityRisk = this.assessLiquidityRisk(liquidityData);

    const riskScore = this.calculateRiskScore(
      marketRisk,
      propertyRisk,
      economicRisk,
      liquidityRisk
    );

    const recommendations = this.generateRecommendations(
      riskScore,
      marketRisk,
      propertyRisk,
      economicRisk,
      liquidityRisk
    );

    return {
      riskScore,
      marketRisk,
      propertyRisk,
      economicRisk,
      liquidityRisk,
      recommendations,
      assessmentDate: new Date()
    };
  }

  // Helper methods

  private calculateVolatilityIndex(priceHistory: number[]): number {
    if (priceHistory.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < priceHistory.length; i++) {
      returns.push((priceHistory[i] - priceHistory[i - 1]) / priceHistory[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateTrendStability(priceHistory: number[]): number {
    if (priceHistory.length < 3) return 0.5;

    // Calculate R-squared for linear trend
    const n = priceHistory.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = priceHistory;

    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) * (xValues[i] - xMean);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * xValues[i] + intercept;
      ssRes += Math.pow(yValues[i] - predicted, 2);
      ssTot += Math.pow(yValues[i] - yMean, 2);
    }

    const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
    return Math.max(0, Math.min(1, rSquared));
  }

  private calculateConcentrationRisk(marketData: MarketRiskData): number {
    // High concentration in single property type or area increases risk
    let concentration = 50; // Base

    if (marketData.propertyTypeDiversity < 0.3) {
      concentration += 25;
    }

    if (marketData.geographicDiversity < 0.4) {
      concentration += 25;
    }

    return Math.min(100, concentration);
  }

  private calculateConditionRisk(propertyData: PropertyRiskData): number {
    let risk = 0;

    const age = new Date().getFullYear() - propertyData.yearBuilt;

    if (age > 50) risk += 30;
    else if (age > 30) risk += 20;
    else if (age > 15) risk += 10;

    if (propertyData.condition === 'poor') risk += 40;
    else if (propertyData.condition === 'fair') risk += 20;
    else if (propertyData.condition === 'average') risk += 10;

    if (propertyData.deferredMaintenance) risk += 20;

    return Math.min(100, risk);
  }

  private calculateLocationRisk(propertyData: PropertyRiskData): number {
    let risk = 30; // Base

    if (propertyData.schoolRating < 5) risk += 20;
    else if (propertyData.schoolRating > 8) risk -= 10;

    if (propertyData.crimeIndex > 70) risk += 25;
    else if (propertyData.crimeIndex < 30) risk -= 10;

    if (propertyData.walkScore < 40) risk += 10;
    else if (propertyData.walkScore > 70) risk -= 10;

    return Math.max(0, Math.min(100, risk));
  }

  private calculateValueRisk(propertyData: PropertyRiskData): number {
    const percentile = propertyData.pricePercentile;

    if (percentile > 90 || percentile < 10) return 75;
    if (percentile > 80 || percentile < 20) return 50;
    if (percentile > 70 || percentile < 30) return 30;
    return 15;
  }

  private calculateEnvironmentalRisk(propertyData: PropertyRiskData): number {
    let risk = 0;

    if (propertyData.floodZone) risk += 35;
    if (propertyData.earthquakeZone) risk += 30;
    if (propertyData.wildFireZone) risk += 25;

    return Math.min(100, risk);
  }

  private getLocationDescription(locationRisk: number): string {
    if (locationRisk > 60) return 'Location concerns may impact value';
    if (locationRisk > 35) return 'Average location characteristics';
    return 'Strong location fundamentals';
  }

  private calculateInterestRateRisk(economicData: EconomicRiskData): number {
    const rate = economicData.interestRate;
    const historicalAvg = economicData.historicalAvgRate || 5.5;

    if (rate > historicalAvg + 2) return 75;
    if (rate > historicalAvg + 1) return 50;
    if (rate < historicalAvg - 1) return 20;
    return 35;
  }

  private calculateInflationRisk(economicData: EconomicRiskData): number {
    const inflation = economicData.inflation;

    if (inflation > 6) return 80;
    if (inflation > 4) return 55;
    if (inflation < 1) return 40;
    return 25;
  }

  private calculateEmploymentRisk(economicData: EconomicRiskData): number {
    const unemployment = economicData.unemployment;

    if (unemployment > 7) return 75;
    if (unemployment > 5) return 45;
    if (unemployment < 4) return 20;
    return 30;
  }

  private calculateMarketDepth(liquidityData: LiquidityRiskData): number {
    const ratio = liquidityData.soldListings / liquidityData.totalListings;
    return Math.min(1, ratio * 2); // 0-1 scale
  }

  private calculateDaysOnMarketRisk(liquidityData: LiquidityRiskData): number {
    const dom = liquidityData.avgDaysOnMarket;

    if (dom > 120) return 80;
    if (dom > 90) return 60;
    if (dom > 60) return 40;
    if (dom < 30) return 15;
    return 25;
  }

  private calculatePriceSensitivity(liquidityData: LiquidityRiskData): number {
    // Higher days on market = higher price sensitivity
    const dom = liquidityData.avgDaysOnMarket;
    const supplyRatio = liquidityData.totalListings / liquidityData.soldListings;

    let sensitivity = 0.5;

    if (dom > 90) sensitivity += 0.2;
    if (supplyRatio > 1.5) sensitivity += 0.2;

    return Math.min(1, sensitivity);
  }

  private generateRecommendations(
    riskScore: RiskScore,
    marketRisk: MarketRisk,
    propertyRisk: PropertyRisk,
    economicRisk: EconomicRisk,
    liquidityRisk: LiquidityRisk
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore.category === 'critical' || riskScore.category === 'high') {
      recommendations.push('Consider postponing transaction until conditions improve');
      recommendations.push('Obtain professional risk assessment and consultation');
    }

    if (marketRisk.score > 60) {
      recommendations.push('Implement conservative pricing strategy');
      recommendations.push('Maintain larger cash reserves for market downturns');
    }

    if (propertyRisk.score > 60) {
      recommendations.push('Conduct thorough property inspection');
      recommendations.push('Budget additional contingency for repairs');
    }

    if (economicRisk.score > 60) {
      recommendations.push('Lock in favorable financing terms if possible');
      recommendations.push('Monitor economic indicators closely');
    }

    if (liquidityRisk.score > 60) {
      recommendations.push('Plan for extended holding period');
      recommendations.push('Enhance marketing and presentation');
    }

    if (riskScore.category === 'low') {
      recommendations.push('Favorable risk profile supports proceeding with transaction');
      recommendations.push('Maintain standard due diligence practices');
    }

    return recommendations;
  }
}

// Supporting interfaces

export interface MarketRiskData {
  priceHistory: number[];
  activeListings: number;
  soldListings: number;
  propertyTypeDiversity: number; // 0-1
  geographicDiversity: number; // 0-1
}

export interface PropertyRiskData {
  yearBuilt: number;
  condition: 'excellent' | 'good' | 'average' | 'fair' | 'poor';
  pricePercentile: number;
  schoolRating: number; // 1-10
  crimeIndex: number; // 0-100
  walkScore: number; // 0-100
  deferredMaintenance?: boolean;
  floodZone?: boolean;
  earthquakeZone?: boolean;
  wildFireZone?: boolean;
}

export interface EconomicRiskData {
  interestRate: number;
  historicalAvgRate?: number;
  inflation: number;
  unemployment: number;
  gdpGrowth?: number;
}

export interface LiquidityRiskData {
  avgDaysOnMarket: number;
  totalListings: number;
  soldListings: number;
  monthlyVolume?: number;
}
