/**
 * LapsedDonorAnalyzer - Identifies donors who gave in previous cycles but not recently
 *
 * This class analyzes donor profiles and contribution history to identify lapsed donors
 * (those who gave before but have stopped), scores their recovery potential, and provides
 * actionable insights for re-engagement campaigns.
 *
 * Key Features:
 * - Identifies lapsed donors based on contribution timing
 * - Scores recovery potential (0-100)
 * - Recommends outreach channel (door, phone, mail, digital)
 * - Provides geographic clustering for efficient outreach
 *
 * @module lib/donor/LapsedDonorAnalyzer
 */

import type { DonorProfile, Contribution } from './types';

/**
 * Criteria for identifying lapsed donors
 */
export interface LapsedDonorCriteria {
  lastGaveBefore: string;      // ISO date - must have given before this
  notGivenSince: string;       // ISO date - must NOT have given since this
  minHistoricalAmount?: number; // Minimum total historical giving
  minHistoricalGifts?: number;  // Minimum number of historical gifts
  party?: 'DEM' | 'REP' | 'ALL'; // Filter by party preference
}

/**
 * Lapsed donor with recovery scoring and recommendations
 */
export interface LapsedDonor {
  donorId: string;
  zipCode: string;
  city: string;

  // Historical giving
  lastGiftDate: string;
  lastGiftAmount: number;
  totalHistoricalAmount: number;
  giftCount: number;
  avgGift: number;
  likelyParty: string;

  // Lapse metrics
  daysSinceLastGift: number;
  monthsSinceLastGift: number;

  // RFM scores from profile
  historicalFrequencyScore: number;
  historicalMonetaryScore: number;

  // Recovery potential
  recoveryScore: number;          // 0-100
  estimatedRecoveryAmount: number; // Estimated $ if reactivated
  recommendedChannel: 'door' | 'phone' | 'mail' | 'digital';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Options for lapsed donor analysis
 */
export interface LapsedAnalysisOptions {
  criteria: LapsedDonorCriteria;
  includeGeoClustering?: boolean;
  minRecoveryScore?: number;
  maxDaysSinceLapse?: number;
}

export class LapsedDonorAnalyzer {
  /**
   * Identify lapsed donors from donor profiles and contributions
   *
   * @param profiles - Array of donor profiles
   * @param contributions - Array of contributions (for date filtering)
   * @param criteria - Criteria for identifying lapsed donors
   * @returns Array of LapsedDonor objects
   */
  identifyLapsedDonors(
    profiles: DonorProfile[],
    contributions: Contribution[],
    criteria: LapsedDonorCriteria
  ): LapsedDonor[] {
    const lapsedDonors: LapsedDonor[] = [];

    // Create contribution lookup by donor ID
    const contributionsByDonor = this.groupContributionsByDonor(contributions);

    const lastGaveBeforeDate = new Date(criteria.lastGaveBefore);
    const notGivenSinceDate = new Date(criteria.notGivenSince);
    const today = new Date();

    for (const profile of profiles) {
      // Get donor's contributions
      const donorContributions = contributionsByDonor.get(profile.donorId) || [];

      if (donorContributions.length === 0) continue;

      // Check if donor meets lapsed criteria
      const lastContributionDate = new Date(profile.lastContributionDate);

      // Must have given before the "lastGaveBefore" date
      const hasHistoricalGiving = donorContributions.some(
        (c) => new Date(c.date) < lastGaveBeforeDate
      );

      // Must NOT have given since the "notGivenSince" date
      const hasRecentGiving = donorContributions.some(
        (c) => new Date(c.date) >= notGivenSinceDate
      );

      if (!hasHistoricalGiving || hasRecentGiving) {
        continue; // Not lapsed
      }

      // Check minimum thresholds
      if (
        criteria.minHistoricalAmount &&
        profile.totalContributed < criteria.minHistoricalAmount
      ) {
        continue;
      }

      if (
        criteria.minHistoricalGifts &&
        profile.contributionCount < criteria.minHistoricalGifts
      ) {
        continue;
      }

      // Check party filter
      if (
        criteria.party &&
        criteria.party !== 'ALL' &&
        profile.likelyParty !== criteria.party &&
        profile.likelyParty !== 'split'
      ) {
        continue;
      }

      // Calculate days/months since last gift
      const daysSinceLastGift = Math.floor(
        (today.getTime() - lastContributionDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const monthsSinceLastGift = Math.floor(daysSinceLastGift / 30);

      // Calculate recovery score
      const recoveryScore = this.calculateRecoveryScore(
        profile,
        daysSinceLastGift,
        donorContributions
      );

      // Estimate recovery amount (conservative: 50% of historical average)
      const estimatedRecoveryAmount = Math.round(profile.avgContribution * 0.5);

      // Recommend channel
      const recommendedChannel = this.recommendChannel(
        profile.totalContributed,
        profile.zipCode
      );

      // Assign priority
      const priority = this.assignPriority(recoveryScore, profile.totalContributed);

      lapsedDonors.push({
        donorId: profile.donorId,
        zipCode: profile.zipCode,
        city: profile.city,
        lastGiftDate: profile.lastContributionDate,
        lastGiftAmount: this.getLastGiftAmount(donorContributions),
        totalHistoricalAmount: profile.totalContributed,
        giftCount: profile.contributionCount,
        avgGift: profile.avgContribution,
        likelyParty: profile.likelyParty,
        daysSinceLastGift,
        monthsSinceLastGift,
        historicalFrequencyScore: profile.frequencyScore,
        historicalMonetaryScore: profile.monetaryScore,
        recoveryScore,
        estimatedRecoveryAmount,
        recommendedChannel,
        priority,
      });
    }

    // Sort by recovery score descending
    lapsedDonors.sort((a, b) => b.recoveryScore - a.recoveryScore);

    return lapsedDonors;
  }

  /**
   * Calculate recovery score (0-100) based on donor characteristics
   *
   * Factors:
   * - Recency of lapse (20%): More recent lapse = higher score
   * - Historical frequency (25%): More frequent givers = higher score
   * - Historical monetary (30%): Higher givers = higher score
   * - Gift pattern consistency (15%): More consistent giving = higher score
   * - Time as donor (10%): Longer relationship = higher score
   */
  private calculateRecoveryScore(
    profile: DonorProfile,
    daysSinceLastGift: number,
    contributions: Contribution[]
  ): number {
    // 1. Recency of lapse (0-100)
    // Ideal: lapsed 6-12 months ago (not too fresh, not too stale)
    let recencyScore: number;
    const monthsSinceLapse = daysSinceLastGift / 30;

    if (monthsSinceLapse < 3) {
      // Too fresh - may not respond yet
      recencyScore = 40;
    } else if (monthsSinceLapse <= 6) {
      // Ideal window
      recencyScore = 100;
    } else if (monthsSinceLapse <= 12) {
      // Good window
      recencyScore = 90;
    } else if (monthsSinceLapse <= 18) {
      // Moderate window
      recencyScore = 70;
    } else if (monthsSinceLapse <= 24) {
      // Long lapse
      recencyScore = 50;
    } else {
      // Very long lapse - harder to recover
      recencyScore = Math.max(20, 50 - (monthsSinceLapse - 24) * 2);
    }

    // 2. Historical frequency score (1-5 to 0-100)
    const frequencyScore = (profile.frequencyScore / 5) * 100;

    // 3. Historical monetary score (1-5 to 0-100)
    const monetaryScore = (profile.monetaryScore / 5) * 100;

    // 4. Gift pattern consistency (0-100)
    const consistencyScore = this.calculateConsistencyScore(contributions);

    // 5. Time as donor (0-100)
    const tenureScore = this.calculateTenureScore(
      profile.firstContributionDate,
      profile.lastContributionDate
    );

    // Weighted average
    const totalScore =
      recencyScore * 0.2 +
      frequencyScore * 0.25 +
      monetaryScore * 0.3 +
      consistencyScore * 0.15 +
      tenureScore * 0.1;

    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }

  /**
   * Calculate consistency score based on gift pattern
   * More regular giving pattern = higher score
   */
  private calculateConsistencyScore(contributions: Contribution[]): number {
    if (contributions.length < 3) {
      return 50; // Not enough data
    }

    // Sort by date
    const sorted = [...contributions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate time gaps between contributions
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap =
        (new Date(sorted[i].date).getTime() -
          new Date(sorted[i - 1].date).getTime()) /
        (1000 * 60 * 60 * 24); // Days
      gaps.push(gap);
    }

    // Calculate coefficient of variation (std dev / mean)
    // Lower CV = more consistent
    const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    const variance =
      gaps.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;

    // Convert CV to 0-100 score (lower CV = higher score)
    // CV < 0.5 = very consistent (90-100)
    // CV 0.5-1.0 = moderately consistent (70-90)
    // CV 1.0-2.0 = somewhat consistent (40-70)
    // CV > 2.0 = inconsistent (0-40)
    let score: number;
    if (cv < 0.5) {
      score = 90 + (0.5 - cv) * 20;
    } else if (cv < 1.0) {
      score = 70 + (1.0 - cv) * 40;
    } else if (cv < 2.0) {
      score = 40 + (2.0 - cv) * 30;
    } else {
      score = Math.max(0, 40 - (cv - 2.0) * 10);
    }

    return Math.round(score);
  }

  /**
   * Calculate tenure score based on length of donor relationship
   */
  private calculateTenureScore(firstDate: string, lastDate: string): number {
    const first = new Date(firstDate);
    const last = new Date(lastDate);
    const months =
      (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 30);

    // Scoring:
    // < 6 months: 30-50 (new donor)
    // 6-12 months: 50-70 (establishing relationship)
    // 12-24 months: 70-85 (established donor)
    // 24-48 months: 85-95 (loyal donor)
    // > 48 months: 95-100 (long-term donor)

    if (months < 6) {
      return Math.round(30 + (months / 6) * 20);
    } else if (months < 12) {
      return Math.round(50 + ((months - 6) / 6) * 20);
    } else if (months < 24) {
      return Math.round(70 + ((months - 12) / 12) * 15);
    } else if (months < 48) {
      return Math.round(85 + ((months - 24) / 24) * 10);
    } else {
      return Math.min(100, Math.round(95 + (months - 48) / 48));
    }
  }

  /**
   * Recommend outreach channel based on donor value and geography
   *
   * Logic:
   * - High value ($500+) + any → Phone/mail
   * - Medium value ($100-$500) + high density → Door
   * - Medium value ($100-$500) + low density → Mail
   * - Low value (<$100) + any → Digital
   */
  private recommendChannel(
    totalAmount: number,
    zipCode: string
  ): 'door' | 'phone' | 'mail' | 'digital' {
    // For now, use simple value-based logic
    // TODO: Enhance with density data when clustering is implemented

    if (totalAmount >= 500) {
      return 'phone'; // High-value donors deserve personal contact
    } else if (totalAmount >= 200) {
      return 'mail'; // Medium-high value
    } else if (totalAmount >= 50) {
      return 'door'; // Medium value - good for canvassing
    } else {
      return 'digital'; // Low value - cost-effective digital outreach
    }
  }

  /**
   * Assign priority level based on recovery score and historical value
   */
  private assignPriority(
    recoveryScore: number,
    totalAmount: number
  ): 'high' | 'medium' | 'low' {
    // High priority: High score + high value
    if (recoveryScore >= 70 && totalAmount >= 200) {
      return 'high';
    }

    // Medium priority: Medium score or medium value
    if (recoveryScore >= 50 || totalAmount >= 100) {
      return 'medium';
    }

    // Low priority: Low score and low value
    return 'low';
  }

  /**
   * Get last gift amount from contributions array
   */
  private getLastGiftAmount(contributions: Contribution[]): number {
    if (contributions.length === 0) return 0;

    const sorted = [...contributions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return sorted[0].amount;
  }

  /**
   * Group contributions by donor ID
   */
  private groupContributionsByDonor(
    contributions: Contribution[]
  ): Map<string, Contribution[]> {
    const grouped = new Map<string, Contribution[]>();

    for (const contribution of contributions) {
      // Generate donor ID from contributor info (same as in donor profile generation)
      const donorId = this.generateDonorId(
        contribution.contributorName,
        contribution.zipCode
      );

      if (!grouped.has(donorId)) {
        grouped.set(donorId, []);
      }

      grouped.get(donorId)!.push(contribution);
    }

    return grouped;
  }

  /**
   * Generate donor ID from name and ZIP (matching profile generation)
   * Uses SHA256 hash as in process-fec-bulk.ts
   */
  private generateDonorId(name: string, zipCode: string): string {
    // Import crypto at runtime to avoid issues
    const crypto = require('crypto');
    const input = `${name.toLowerCase().trim()}|${zipCode}`;
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Format lapsed donor for display
   */
  formatLapsedDonor(donor: LapsedDonor): string {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(donor.totalHistoricalAmount);

    const lastGift = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(donor.lastGiftAmount);

    const estimatedRecovery = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(donor.estimatedRecoveryAmount);

    return [
      `Donor ID: ${donor.donorId}`,
      `Location: ${donor.city}, ${donor.zipCode}`,
      `Historical: ${amount} (${donor.giftCount} gifts, avg ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(donor.avgGift)})`,
      `Last Gift: ${lastGift} on ${donor.lastGiftDate} (${donor.monthsSinceLastGift} months ago)`,
      `Recovery Score: ${donor.recoveryScore}/100`,
      `Estimated Recovery: ${estimatedRecovery}`,
      `Recommended Channel: ${donor.recommendedChannel.toUpperCase()}`,
      `Priority: ${donor.priority.toUpperCase()}`,
    ].join('\n');
  }

  /**
   * Get summary statistics for lapsed donors
   */
  getSummary(lapsedDonors: LapsedDonor[]): {
    totalLapsed: number;
    totalHistoricalValue: number;
    avgHistoricalGift: number;
    totalEstimatedRecovery: number;
    byPriority: Record<string, number>;
    byChannel: Record<string, number>;
    avgRecoveryScore: number;
    avgMonthsSinceLapse: number;
  } {
    if (lapsedDonors.length === 0) {
      return {
        totalLapsed: 0,
        totalHistoricalValue: 0,
        avgHistoricalGift: 0,
        totalEstimatedRecovery: 0,
        byPriority: { high: 0, medium: 0, low: 0 },
        byChannel: { door: 0, phone: 0, mail: 0, digital: 0 },
        avgRecoveryScore: 0,
        avgMonthsSinceLapse: 0,
      };
    }

    const totalHistoricalValue = lapsedDonors.reduce(
      (sum, d) => sum + d.totalHistoricalAmount,
      0
    );

    const totalEstimatedRecovery = lapsedDonors.reduce(
      (sum, d) => sum + d.estimatedRecoveryAmount,
      0
    );

    const byPriority = lapsedDonors.reduce(
      (acc, d) => {
        acc[d.priority] = (acc[d.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byChannel = lapsedDonors.reduce(
      (acc, d) => {
        acc[d.recommendedChannel] = (acc[d.recommendedChannel] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const avgRecoveryScore =
      lapsedDonors.reduce((sum, d) => sum + d.recoveryScore, 0) /
      lapsedDonors.length;

    const avgMonthsSinceLapse =
      lapsedDonors.reduce((sum, d) => sum + d.monthsSinceLastGift, 0) /
      lapsedDonors.length;

    return {
      totalLapsed: lapsedDonors.length,
      totalHistoricalValue,
      avgHistoricalGift: totalHistoricalValue / lapsedDonors.length,
      totalEstimatedRecovery,
      byPriority,
      byChannel,
      avgRecoveryScore,
      avgMonthsSinceLapse,
    };
  }

  /**
   * Filter lapsed donors by criteria
   */
  filterLapsedDonors(
    lapsedDonors: LapsedDonor[],
    filters: {
      minRecoveryScore?: number;
      maxMonthsSinceLapse?: number;
      priority?: 'high' | 'medium' | 'low';
      channel?: 'door' | 'phone' | 'mail' | 'digital';
      party?: 'DEM' | 'REP' | 'ALL';
      zipCodes?: string[];
    }
  ): LapsedDonor[] {
    return lapsedDonors.filter((donor) => {
      if (
        filters.minRecoveryScore !== undefined &&
        donor.recoveryScore < filters.minRecoveryScore
      ) {
        return false;
      }

      if (
        filters.maxMonthsSinceLapse !== undefined &&
        donor.monthsSinceLastGift > filters.maxMonthsSinceLapse
      ) {
        return false;
      }

      if (filters.priority && donor.priority !== filters.priority) {
        return false;
      }

      if (
        filters.channel &&
        donor.recommendedChannel !== filters.channel
      ) {
        return false;
      }

      if (
        filters.party &&
        filters.party !== 'ALL' &&
        donor.likelyParty !== filters.party &&
        donor.likelyParty !== 'split'
      ) {
        return false;
      }

      if (
        filters.zipCodes &&
        filters.zipCodes.length > 0 &&
        !filters.zipCodes.includes(donor.zipCode)
      ) {
        return false;
      }

      return true;
    });
  }
}
