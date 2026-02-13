/**
 * ProspectScorer - Real prospect scoring algorithm for donor analysis
 *
 * Implements a weighted scoring system to identify high-potential
 * prospect areas based on giving capacity, political alignment,
 * donor density, and engagement likelihood.
 *
 * Score Components (0-100 each):
 * - Giving Capacity (40%): Based on median household income
 * - Political Alignment (30%): Based on partisan lean matching target party
 * - Donor Density (20%): Inverse of existing donor penetration
 * - Engagement Likelihood (10%): Based on education and homeownership
 *
 * Final Score: Weighted average (0-100)
 */

import type {
  ZIPAggregate,
  ZIPDemographics,
} from './types';

export interface ProspectScoreComponents {
  givingCapacity: number;        // 0-100
  politicalAlignment: number;    // 0-100
  donorDensity: number;          // 0-100
  engagementLikelihood: number;  // 0-100
}

export interface ProspectScore {
  zipCode: string;
  totalScore: number;            // 0-100
  components: ProspectScoreComponents;
  rank?: number;
  estimatedPotential: number;    // Estimated $ potential
}

export interface ProspectScoringOptions {
  targetParty?: 'D' | 'R' | 'all';
  countyAvgDonorRate?: number;   // Donors per 1000 population
  countyAvgIncome?: number;      // Median income baseline
}

export class ProspectScorer {
  // Component weights (must sum to 1.0)
  private readonly WEIGHT_GIVING_CAPACITY = 0.40;
  private readonly WEIGHT_POLITICAL_ALIGNMENT = 0.30;
  private readonly WEIGHT_DONOR_DENSITY = 0.20;
  private readonly WEIGHT_ENGAGEMENT = 0.10;

  // Income thresholds for giving capacity scoring
  private readonly INCOME_THRESHOLDS = {
    low: 40000,      // Below this = low capacity (score 0-30)
    medium: 75000,   // Between low-medium = moderate (score 30-60)
    high: 100000,    // Between medium-high = good (score 60-80)
    veryHigh: 150000 // Above this = excellent (score 80-100)
  };

  /**
   * Calculate prospect score for a single ZIP code
   *
   * @param zipAggregate - ZIP aggregate data with donor statistics
   * @param demographics - Demographic data for the ZIP
   * @param options - Scoring options including target party
   * @returns ProspectScore with total score and component breakdown
   */
  calculateProspectScore(
    zipAggregate: ZIPAggregate,
    demographics: ZIPDemographics | null,
    options: ProspectScoringOptions = {}
  ): ProspectScore {
    const {
      targetParty = 'all',
      countyAvgDonorRate = 4.2, // Ingham County baseline
      countyAvgIncome = 60000,  // Michigan median
    } = options;

    // Default demographics if not provided
    const demo: ZIPDemographics = demographics || {
      zipCode: zipAggregate.zipCode,
      city: zipAggregate.city,
      state: zipAggregate.state,
      population: zipAggregate.donorCount * 50, // Rough estimate
      medianIncome: countyAvgIncome,
      medianAge: 40,
      collegePct: 30,
    };

    // Calculate each component score
    const givingCapacity = this.scoreGivingCapacity(demo.medianIncome);
    const politicalAlignment = this.scorePoliticalAlignment(
      zipAggregate,
      targetParty
    );
    const donorDensity = this.scoreDonorDensity(
      zipAggregate,
      demo,
      countyAvgDonorRate
    );
    const engagementLikelihood = this.scoreEngagementLikelihood(demo);

    // Calculate weighted total score
    const totalScore = Math.round(
      givingCapacity * this.WEIGHT_GIVING_CAPACITY +
      politicalAlignment * this.WEIGHT_POLITICAL_ALIGNMENT +
      donorDensity * this.WEIGHT_DONOR_DENSITY +
      engagementLikelihood * this.WEIGHT_ENGAGEMENT
    );

    // Estimate fundraising potential
    const estimatedPotential = this.estimatePotential(
      zipAggregate,
      demo,
      countyAvgDonorRate
    );

    return {
      zipCode: zipAggregate.zipCode,
      totalScore,
      components: {
        givingCapacity,
        politicalAlignment,
        donorDensity,
        engagementLikelihood,
      },
      estimatedPotential,
    };
  }

  /**
   * Score giving capacity based on median income (0-100)
   *
   * Scoring scale:
   * - < $40K: 0-30 (low capacity)
   * - $40K-$75K: 30-60 (moderate capacity)
   * - $75K-$100K: 60-80 (good capacity)
   * - $100K-$150K: 80-95 (high capacity)
   * - > $150K: 95-100 (excellent capacity)
   */
  private scoreGivingCapacity(medianIncome: number): number {
    const { low, medium, high, veryHigh } = this.INCOME_THRESHOLDS;

    if (medianIncome < low) {
      // Linear scale from 0 to 30 for incomes below $40K
      return Math.round((medianIncome / low) * 30);
    } else if (medianIncome < medium) {
      // Linear scale from 30 to 60 for incomes $40K-$75K
      const progress = (medianIncome - low) / (medium - low);
      return Math.round(30 + progress * 30);
    } else if (medianIncome < high) {
      // Linear scale from 60 to 80 for incomes $75K-$100K
      const progress = (medianIncome - medium) / (high - medium);
      return Math.round(60 + progress * 20);
    } else if (medianIncome < veryHigh) {
      // Linear scale from 80 to 95 for incomes $100K-$150K
      const progress = (medianIncome - high) / (veryHigh - high);
      return Math.round(80 + progress * 15);
    } else {
      // Cap at 100 for incomes above $150K
      return Math.min(100, Math.round(80 + (medianIncome - veryHigh) / 100000 * 20));
    }
  }

  /**
   * Score political alignment (0-100)
   *
   * For target party D:
   * - +50 partisan lean (100% DEM) = 100 score
   * - 0 partisan lean (50/50 split) = 50 score
   * - -50 partisan lean (100% REP) = 0 score
   *
   * For target party R: inverse of above
   * For 'all': always returns 50 (neutral)
   */
  private scorePoliticalAlignment(
    zipAggregate: ZIPAggregate,
    targetParty: 'D' | 'R' | 'all'
  ): number {
    if (targetParty === 'all') {
      return 50; // Neutral for non-partisan targeting
    }

    const totalPartyAmount = zipAggregate.demAmount + zipAggregate.repAmount;

    // No party data available - return neutral
    if (totalPartyAmount === 0) {
      return 50;
    }

    // Calculate partisan lean: -100 (all REP) to +100 (all DEM)
    const demShare = zipAggregate.demAmount / totalPartyAmount;
    const partisanLean = (demShare - 0.5) * 100; // Normalize to -50 to +50 range

    if (targetParty === 'D') {
      // Democratic targeting: +50 lean = 100 score, -50 lean = 0 score
      return Math.round(50 + partisanLean);
    } else {
      // Republican targeting: -50 lean = 100 score, +50 lean = 0 score
      return Math.round(50 - partisanLean);
    }
  }

  /**
   * Score donor density (0-100)
   *
   * Inverse scoring: Lower current density = higher prospect score
   * Low penetration means more untapped potential
   *
   * - Density 0-1 per 1000 (very low penetration): 90-100 score
   * - Density 1-3 per 1000 (low penetration): 70-90 score
   * - Density 3-5 per 1000 (average penetration): 40-70 score
   * - Density 5-10 per 1000 (high penetration): 10-40 score
   * - Density > 10 per 1000 (saturated): 0-10 score
   */
  private scoreDonorDensity(
    zipAggregate: ZIPAggregate,
    demographics: ZIPDemographics,
    countyAvgDonorRate: number
  ): number {
    // Calculate current donor rate per 1000 population
    const population = demographics.population || zipAggregate.donorCount * 50;
    const currentRate =
      population > 0 ? (zipAggregate.donorCount / population) * 1000 : 0;

    // Use county average as reference point
    const referenceRate = countyAvgDonorRate;

    if (currentRate === 0) {
      // No donors yet - maximum opportunity
      return 100;
    } else if (currentRate < 1) {
      // Very low penetration
      return Math.round(90 + (1 - currentRate) * 10);
    } else if (currentRate < 3) {
      // Low penetration
      const progress = (currentRate - 1) / 2;
      return Math.round(90 - progress * 20);
    } else if (currentRate < referenceRate) {
      // Below average penetration
      const progress = (currentRate - 3) / (referenceRate - 3);
      return Math.round(70 - progress * 30);
    } else if (currentRate < referenceRate * 2) {
      // Average to high penetration
      const progress = (currentRate - referenceRate) / referenceRate;
      return Math.round(40 - progress * 30);
    } else {
      // Saturated market
      return Math.max(0, Math.round(10 - (currentRate - referenceRate * 2)));
    }
  }

  /**
   * Score engagement likelihood (0-100)
   *
   * Based on education and demographic indicators
   * - College education % (weight 70%)
   * - Median age appropriateness (weight 30%)
   *
   * Higher education and prime donor age (35-65) = higher engagement
   */
  private scoreEngagementLikelihood(demographics: ZIPDemographics): number {
    // Education component (0-100)
    const collegePct = demographics.collegePct || 30; // Default to national avg
    const educationScore = Math.min(100, (collegePct / 50) * 100); // 50%+ college = 100

    // Age component (0-100)
    // Prime donor age: 35-65 years old
    const medianAge = demographics.medianAge || 40;
    let ageScore: number;

    if (medianAge < 25) {
      // Very young - low engagement
      ageScore = 30;
    } else if (medianAge < 35) {
      // Young - moderate engagement
      ageScore = 50 + (medianAge - 25) * 2;
    } else if (medianAge <= 65) {
      // Prime donor age - high engagement
      ageScore = 90;
    } else if (medianAge <= 75) {
      // Older but still engaged
      ageScore = 90 - (medianAge - 65) * 2;
    } else {
      // Very old - declining engagement
      ageScore = 60;
    }

    // Weighted combination: 70% education, 30% age
    return Math.round(educationScore * 0.7 + ageScore * 0.3);
  }

  /**
   * Estimate fundraising potential in dollars
   *
   * Calculates untapped potential based on gap between current
   * and expected donor participation at county average rates
   */
  private estimatePotential(
    zipAggregate: ZIPAggregate,
    demographics: ZIPDemographics,
    countyAvgDonorRate: number
  ): number {
    const population = demographics.population || zipAggregate.donorCount * 50;

    // Expected donors at county average rate
    const expectedDonors = (population / 1000) * countyAvgDonorRate;

    // Untapped donors
    const untappedDonors = Math.max(0, expectedDonors - zipAggregate.donorCount);

    // Use average contribution as baseline for potential
    const avgGift =
      zipAggregate.avgContribution > 0
        ? zipAggregate.avgContribution
        : 150; // Default $150 avg gift

    // Conservative estimate: 50% of average gift for prospects
    return Math.round(untappedDonors * avgGift * 0.5);
  }

  /**
   * Batch score multiple ZIP codes and rank them
   *
   * @param zipAggregates - Array of ZIP aggregates
   * @param demographicsMap - Map of ZIP codes to demographics
   * @param options - Scoring options
   * @returns Array of prospect scores sorted by rank (highest first)
   */
  scoreAndRank(
    zipAggregates: ZIPAggregate[],
    demographicsMap: Map<string, ZIPDemographics>,
    options: ProspectScoringOptions = {}
  ): ProspectScore[] {
    // Score all ZIPs
    const scores = zipAggregates.map((agg) => {
      const demo = demographicsMap.get(agg.zipCode) || null;
      return this.calculateProspectScore(agg, demo, options);
    });

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    // Assign ranks
    scores.forEach((score, index) => {
      score.rank = index + 1;
    });

    return scores;
  }

  /**
   * Format prospect score for display
   */
  formatProspectScore(score: ProspectScore): string {
    const { totalScore, components, estimatedPotential } = score;

    return [
      `ZIP ${score.zipCode}:`,
      `Total Score: ${totalScore}/100`,
      `Components:`,
      `  Giving Capacity: ${components.givingCapacity}/100`,
      `  Political Alignment: ${components.politicalAlignment}/100`,
      `  Donor Density: ${components.donorDensity}/100`,
      `  Engagement: ${components.engagementLikelihood}/100`,
      `Estimated Potential: $${estimatedPotential.toLocaleString()}`,
    ].join('\n');
  }
}
