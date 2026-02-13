/**
 * UpgradeScorer - Score upgrade potential for existing donors
 *
 * Identifies donors giving below their capacity and scores their potential
 * for increased giving. These are often the highest-ROI fundraising targets.
 *
 * Scoring Formula (0-100):
 * - Gap Size (20 pts): Larger capacity gap = higher score
 * - Utilization (30 pts): Lower % of capacity used = more room to grow
 * - Recency (25 pts): Recent donors are engaged and ready to upgrade
 * - Frequency (15 pts): Frequent donors are committed
 * - Loyalty (10 pts): Multi-cycle donors are reliable
 *
 * Recommended Ask Logic:
 * - < 20% utilization: Ask for 3x current avg gift
 * - 20-50% utilization: Ask for 2x current avg gift
 * - 50-80% utilization: Ask for 1.5x current avg gift
 * - > 80% utilization: Focus on retention, not upgrade
 *
 * @module lib/donor/UpgradeScorer
 */

import type { DonorProfile } from './types';
import type { CapacityEstimate } from './CapacityModeler';

export interface UpgradeProspect {
  donorId: string;
  zipCode: string;
  city: string;

  // Current giving
  currentTotalGiven: number;
  currentAvgGift: number;
  lastGiftAmount: number;
  giftCount: number;

  // Capacity indicators
  estimatedCapacity: number;
  capacityConfidence: string;
  zipMedianIncome: number;
  occupation?: string;
  occupationCapacity: string;

  // Calculated potential
  currentUtilization: number;    // currentGiving / capacity (0-1)
  upgradeGap: number;            // capacity - currentGiving
  upgradeScore: number;          // 0-100 prioritization

  // Engagement indicators
  recencyScore: number;
  frequencyScore: number;
  loyaltyIndicator: boolean;     // Gave multiple cycles

  // Recommendation
  recommendedAsk: number;        // Suggested upgrade amount
  recommendedChannel: 'call' | 'event' | 'mail' | 'meeting';
  askRationale: string;
}

export interface UpgradeOptions {
  minCapacity?: number;          // Only score donors with capacity >= this
  minUtilizationGap?: number;    // Only include if utilization < this %
  minGiftCount?: number;         // Only include donors with N+ gifts
  targetParty?: 'DEM' | 'REP' | 'all';
}

export class UpgradeScorer {
  /**
   * Score a single donor's upgrade potential
   *
   * @param profile - Donor profile with RFM scores
   * @param capacity - Capacity estimate from CapacityModeler
   * @param zipMedianIncome - ZIP-level income for context
   * @param occupation - Donor occupation if available
   * @param occupationCapacity - Classified occupation capacity
   * @returns UpgradeProspect with score and recommendation
   */
  scoreUpgradePotential(
    profile: DonorProfile,
    capacity: CapacityEstimate,
    zipMedianIncome: number,
    occupation?: string,
    occupationCapacity: string = 'unknown'
  ): UpgradeProspect {
    // Calculate utilization
    const currentUtilization =
      capacity.estimatedAnnualCapacity > 0
        ? profile.totalContributed / capacity.estimatedAnnualCapacity
        : 0;

    const upgradeGap = Math.max(0, capacity.estimatedAnnualCapacity - profile.totalContributed);

    // Calculate upgrade score components
    const gapScore = this.scoreGapSize(upgradeGap);
    const utilizationScore = this.scoreUtilization(currentUtilization);
    const recencyComponent = this.scoreRecency(profile.recencyScore);
    const frequencyComponent = this.scoreFrequency(profile.frequencyScore);
    const loyaltyComponent = this.scoreLoyalty(profile);

    // Weighted total score
    const upgradeScore = Math.round(
      gapScore * 0.20 +
      utilizationScore * 0.30 +
      recencyComponent * 0.25 +
      frequencyComponent * 0.15 +
      loyaltyComponent * 0.10
    );

    // Determine loyalty indicator
    const loyaltyIndicator = this.isLoyal(profile);

    // Calculate recommended ask
    const { amount: recommendedAsk, rationale: askRationale } =
      this.calculateRecommendedAsk(profile, currentUtilization, capacity.estimatedAnnualCapacity);

    // Determine recommended channel
    const recommendedChannel = this.determineChannel(
      upgradeScore,
      recommendedAsk,
      profile.monetaryScore
    );

    // Get last gift amount (use avgContribution as proxy)
    const lastGiftAmount = profile.avgContribution;

    return {
      donorId: profile.donorId,
      zipCode: profile.zipCode,
      city: profile.city,
      currentTotalGiven: profile.totalContributed,
      currentAvgGift: profile.avgContribution,
      lastGiftAmount,
      giftCount: profile.contributionCount,
      estimatedCapacity: capacity.estimatedAnnualCapacity,
      capacityConfidence: capacity.confidenceLevel,
      zipMedianIncome,
      occupation,
      occupationCapacity,
      currentUtilization,
      upgradeGap,
      upgradeScore,
      recencyScore: profile.recencyScore,
      frequencyScore: profile.frequencyScore,
      loyaltyIndicator,
      recommendedAsk,
      recommendedChannel,
      askRationale,
    };
  }

  /**
   * Score gap size (0-100)
   * Larger gaps = higher scores (max 100 at $5K+ gap)
   */
  private scoreGapSize(gap: number): number {
    // Scale: $0 = 0, $1K = 20, $2K = 40, $5K+ = 100
    if (gap === 0) return 0;
    if (gap >= 5000) return 100;
    return Math.min(100, (gap / 1000) * 20);
  }

  /**
   * Score utilization (0-100)
   * Lower utilization = more room to grow = higher score
   */
  private scoreUtilization(utilization: number): number {
    // Inverse scoring: 0% = 100, 50% = 50, 100% = 0
    return Math.round((1 - Math.min(1, utilization)) * 100);
  }

  /**
   * Score recency (0-100)
   * Recent donors are engaged and ready for upgrade asks
   */
  private scoreRecency(recencyScore: number): number {
    // RFM score 1-5, map to 0-100
    // 5 (most recent) = 100, 1 (least recent) = 0
    return (recencyScore - 1) * 25;
  }

  /**
   * Score frequency (0-100)
   * Frequent donors are committed and responsive
   */
  private scoreFrequency(frequencyScore: number): number {
    // RFM score 1-5, map to 0-100
    // 5 (most frequent) = 100, 1 (least frequent) = 0
    return (frequencyScore - 1) * 25;
  }

  /**
   * Score loyalty (0-100)
   * Multi-cycle donors get bonus points
   */
  private scoreLoyalty(profile: DonorProfile): number {
    const isLoyal = this.isLoyal(profile);
    return isLoyal ? 100 : 0; // Binary: loyal = 100, not loyal = 0
  }

  /**
   * Determine if donor is loyal (gave in multiple years)
   */
  private isLoyal(profile: DonorProfile): boolean {
    const first = new Date(profile.firstContributionDate);
    const last = new Date(profile.lastContributionDate);
    const yearSpan = last.getFullYear() - first.getFullYear();

    // Loyal if they've given over 2+ years AND have 3+ contributions
    return yearSpan >= 2 && profile.contributionCount >= 3;
  }

  /**
   * Calculate recommended ask amount and rationale
   */
  private calculateRecommendedAsk(
    profile: DonorProfile,
    utilization: number,
    capacity: number
  ): { amount: number; rationale: string } {
    let multiplier: number;
    let rationale: string;

    if (utilization < 0.20) {
      // Very low utilization - ask for 3x
      multiplier = 3.0;
      rationale = `Donor giving well below capacity (<20% utilization). Ask for ${multiplier}x average gift to test ceiling.`;
    } else if (utilization < 0.50) {
      // Low utilization - ask for 2x
      multiplier = 2.0;
      rationale = `Donor at ${Math.round(utilization * 100)}% capacity. Ask for ${multiplier}x average gift for significant upgrade.`;
    } else if (utilization < 0.80) {
      // Moderate utilization - ask for 1.5x
      multiplier = 1.5;
      rationale = `Donor at ${Math.round(utilization * 100)}% capacity. Ask for ${multiplier}x average gift for modest upgrade.`;
    } else {
      // High utilization - minimal upgrade room
      multiplier = 1.2;
      rationale = `Donor near capacity (${Math.round(utilization * 100)}%). Focus on retention; small upgrade possible.`;
    }

    // Calculate ask amount
    const baseAsk = profile.avgContribution * multiplier;

    // Don't ask for more than remaining capacity
    const remainingCapacity = capacity - profile.totalContributed;
    const amount = Math.min(baseAsk, remainingCapacity);

    // Round to nearest $50 or $100
    const rounded = amount >= 500
      ? Math.round(amount / 100) * 100
      : Math.round(amount / 50) * 50;

    return { amount: Math.max(rounded, 50), rationale };
  }

  /**
   * Determine recommended solicitation channel
   */
  private determineChannel(
    upgradeScore: number,
    askAmount: number,
    monetaryScore: number
  ): 'call' | 'event' | 'mail' | 'meeting' {
    // High-value donors with high scores get personal attention
    if (askAmount >= 1000 && upgradeScore >= 70) {
      return 'meeting';
    }

    // High scores but moderate asks get phone calls
    if (upgradeScore >= 60 || askAmount >= 500) {
      return 'call';
    }

    // Mid-tier donors get invited to events
    if (monetaryScore >= 3 && upgradeScore >= 40) {
      return 'event';
    }

    // Lower priority gets mail/email
    return 'mail';
  }

  /**
   * Filter prospects based on criteria
   */
  filterProspects(
    prospects: UpgradeProspect[],
    options: UpgradeOptions = {}
  ): UpgradeProspect[] {
    const {
      minCapacity = 0,
      minUtilizationGap = 1.0,  // Default: include all (100% gap)
      minGiftCount = 1,
    } = options;

    return prospects.filter(p => {
      // Must have minimum capacity
      if (p.estimatedCapacity < minCapacity) return false;

      // Must have room to grow (utilization < threshold)
      if (p.currentUtilization >= minUtilizationGap) return false;

      // Must have minimum gift history
      if (p.giftCount < minGiftCount) return false;

      return true;
    });
  }

  /**
   * Sort prospects by score and rank them
   */
  rankProspects(prospects: UpgradeProspect[]): UpgradeProspect[] {
    // Sort by upgrade score descending
    return [...prospects].sort((a, b) => b.upgradeScore - a.upgradeScore);
  }

  /**
   * Get top N prospects
   */
  getTopProspects(prospects: UpgradeProspect[], limit: number = 100): UpgradeProspect[] {
    return this.rankProspects(prospects).slice(0, limit);
  }

  /**
   * Aggregate prospects by ZIP code for mapping
   */
  aggregateByZip(prospects: UpgradeProspect[]): Map<string, {
    prospectCount: number;
    totalGap: number;
    avgScore: number;
    totalCurrentGiving: number;
    totalCapacity: number;
  }> {
    const byZip = new Map<string, {
      prospectCount: number;
      totalGap: number;
      totalScore: number;
      totalCurrentGiving: number;
      totalCapacity: number;
    }>();

    for (const prospect of prospects) {
      const existing = byZip.get(prospect.zipCode) || {
        prospectCount: 0,
        totalGap: 0,
        totalScore: 0,
        totalCurrentGiving: 0,
        totalCapacity: 0,
      };

      existing.prospectCount += 1;
      existing.totalGap += prospect.upgradeGap;
      existing.totalScore += prospect.upgradeScore;
      existing.totalCurrentGiving += prospect.currentTotalGiven;
      existing.totalCapacity += prospect.estimatedCapacity;

      byZip.set(prospect.zipCode, existing);
    }

    // Calculate averages
    const result = new Map<string, {
      prospectCount: number;
      totalGap: number;
      avgScore: number;
      totalCurrentGiving: number;
      totalCapacity: number;
    }>();

    for (const [zip, data] of byZip.entries()) {
      result.set(zip, {
        prospectCount: data.prospectCount,
        totalGap: data.totalGap,
        avgScore: Math.round(data.totalScore / data.prospectCount),
        totalCurrentGiving: data.totalCurrentGiving,
        totalCapacity: data.totalCapacity,
      });
    }

    return result;
  }

  /**
   * Segment prospects by capacity tier
   */
  segmentByCapacity(prospects: UpgradeProspect[]): {
    high: UpgradeProspect[];
    medium: UpgradeProspect[];
    low: UpgradeProspect[];
  } {
    const high: UpgradeProspect[] = [];
    const medium: UpgradeProspect[] = [];
    const low: UpgradeProspect[] = [];

    for (const prospect of prospects) {
      if (prospect.estimatedCapacity >= 2000) {
        high.push(prospect);
      } else if (prospect.estimatedCapacity >= 500) {
        medium.push(prospect);
      } else {
        low.push(prospect);
      }
    }

    return { high, medium, low };
  }
}
