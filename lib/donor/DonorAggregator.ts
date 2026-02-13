/**
 * Donor Aggregation and RFM Scoring Engine
 *
 * Aggregates political contributions by ZIP code and calculates
 * RFM (Recency, Frequency, Monetary) scores for donor segmentation.
 *
 * @module lib/donor/DonorAggregator
 */

import type {
  Contribution,
  ZIPAggregate,
  DonorProfile,
  DonorSummaryStats
} from './types';

/**
 * DonorAggregator class
 *
 * Provides methods for:
 * 1. Aggregating contributions by ZIP code
 * 2. Calculating RFM (Recency, Frequency, Monetary) scores
 * 3. Segmenting donors based on giving behavior
 * 4. Computing summary statistics
 */
export class DonorAggregator {
  /**
   * Aggregate contributions by ZIP code
   * Creates detailed ZIP-level statistics for donor concentration analysis
   *
   * @param contributions - Array of contribution records
   * @returns Map of ZIP code to aggregate statistics
   */
  aggregateByZIP(contributions: Contribution[]): Map<string, ZIPAggregate> {
    const byZIP = new Map<string, Contribution[]>();

    // Group contributions by ZIP code
    for (const c of contributions) {
      const existing = byZIP.get(c.zipCode) || [];
      existing.push(c);
      byZIP.set(c.zipCode, existing);
    }

    const aggregates = new Map<string, ZIPAggregate>();

    for (const [zip, contribs] of byZIP) {
      const amounts = contribs.map(c => c.amount);
      const donors = new Set(
        contribs.map(c => this.anonymizeId(c.contributorName, c.zipCode))
      );

      // Filter by party
      const demContribs = contribs.filter(c => c.party === 'DEM');
      const repContribs = contribs.filter(c => c.party === 'REP');
      const otherContribs = contribs.filter(c => c.party === 'other' || !c.party);

      const demDonors = new Set(
        demContribs.map(c => this.anonymizeId(c.contributorName, c.zipCode))
      );
      const repDonors = new Set(
        repContribs.map(c => this.anonymizeId(c.contributorName, c.zipCode))
      );

      // Calculate time-based metrics
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      const amountLast30Days = contribs
        .filter(c => new Date(c.date) >= thirtyDaysAgo)
        .reduce((sum, c) => sum + c.amount, 0);

      const amountLast90Days = contribs
        .filter(c => new Date(c.date) >= ninetyDaysAgo)
        .reduce((sum, c) => sum + c.amount, 0);

      const amountLast12Months = contribs
        .filter(c => new Date(c.date) >= yearAgo)
        .reduce((sum, c) => sum + c.amount, 0);

      // Calculate aggregates
      const totalAmount = amounts.reduce((a, b) => a + b, 0);
      const demAmount = demContribs.reduce((sum, c) => sum + c.amount, 0);
      const repAmount = repContribs.reduce((sum, c) => sum + c.amount, 0);
      const otherAmount = otherContribs.reduce((sum, c) => sum + c.amount, 0);

      aggregates.set(zip, {
        zipCode: zip,
        city: contribs[0].city,
        state: contribs[0].state || 'MI',

        totalAmount,
        donorCount: donors.size,
        contributionCount: contribs.length,
        avgContribution: totalAmount / contribs.length,
        medianContribution: this.median(amounts),

        demAmount,
        repAmount,
        otherAmount,
        demDonors: demDonors.size,
        repDonors: repDonors.size,

        amountLast30Days,
        amountLast90Days,
        amountLast12Months,

        topDonorCount: contribs.filter(c => c.amount >= 1000).length,
        maxSingleDonation: Math.max(...amounts),

        donorDensity: 0,  // Calculated with population data (external)
        avgCapacity: 0,   // Calculated with income data (external)
        prospectScore: 0, // Calculated later
      });
    }

    return aggregates;
  }

  /**
   * Calculate RFM scores for all donors
   * Returns DonorProfile for each unique donor with segmentation
   *
   * RFM Scoring:
   * - Recency (R): Days since last donation. Score 1-5 where 5 = most recent
   * - Frequency (F): Number of donations. Score 1-5 where 5 = most frequent
   * - Monetary (M): Total amount. Score 1-5 where 5 = highest value
   *
   * @param contributions - Array of contribution records
   * @returns Array of donor profiles with RFM scores and segments
   */
  calculateRFMScores(contributions: Contribution[]): DonorProfile[] {
    // Group contributions by donor
    const byDonor = new Map<string, Contribution[]>();
    for (const c of contributions) {
      const donorId = this.anonymizeId(c.contributorName, c.zipCode);
      const existing = byDonor.get(donorId) || [];
      existing.push(c);
      byDonor.set(donorId, existing);
    }

    // Calculate raw metrics for each donor
    const donorMetrics: Array<{
      id: string;
      recency: number;      // Days since last gift
      frequency: number;    // Number of gifts
      monetary: number;     // Total amount
      contribs: Contribution[];
    }> = [];

    const now = new Date();

    for (const [id, contribs] of byDonor) {
      const dates = contribs.map(c => new Date(c.date));
      const lastDate = new Date(Math.max(...dates.map(d => d.getTime())));
      const daysSinceLast = Math.floor(
        (now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      donorMetrics.push({
        id,
        recency: daysSinceLast,
        frequency: contribs.length,
        monetary: contribs.reduce((sum, c) => sum + c.amount, 0),
        contribs,
      });
    }

    // Calculate quintiles for scoring
    const recencies = donorMetrics.map(d => d.recency);
    const frequencies = donorMetrics.map(d => d.frequency);
    const monetaries = donorMetrics.map(d => d.monetary);

    const rQuintiles = this.quintiles(recencies);
    const fQuintiles = this.quintiles(frequencies);
    const mQuintiles = this.quintiles(monetaries);

    // Score each donor and create profiles
    return donorMetrics.map(d => {
      const rScore = this.scoreRecency(d.recency, rQuintiles);
      const fScore = this.scoreFrequency(d.frequency, fQuintiles);
      const mScore = this.scoreMonetary(d.monetary, mQuintiles);

      const sample = d.contribs[0];
      const dates = d.contribs.map(c => c.date).sort();

      // Determine likely party affiliation
      const demTotal = d.contribs
        .filter(c => c.party === 'DEM')
        .reduce((sum, c) => sum + c.amount, 0);
      const repTotal = d.contribs
        .filter(c => c.party === 'REP')
        .reduce((sum, c) => sum + c.amount, 0);
      const totalPartyAmount = demTotal + repTotal;

      let likelyParty: DonorProfile['likelyParty'];
      let partyConfidence: number;

      if (totalPartyAmount === 0) {
        likelyParty = 'unknown';
        partyConfidence = 0;
      } else if (demTotal > repTotal * 2) {
        likelyParty = 'DEM';
        partyConfidence = Math.abs(demTotal - repTotal) / totalPartyAmount;
      } else if (repTotal > demTotal * 2) {
        likelyParty = 'REP';
        partyConfidence = Math.abs(demTotal - repTotal) / totalPartyAmount;
      } else if (demTotal > 0 && repTotal > 0) {
        likelyParty = 'split';
        partyConfidence = 1 - Math.abs(demTotal - repTotal) / totalPartyAmount;
      } else {
        likelyParty = 'unknown';
        partyConfidence = 0;
      }

      return {
        donorId: d.id,
        zipCode: sample.zipCode,
        city: sample.city,
        h3Index: sample.h3Index,

        recencyScore: rScore,
        frequencyScore: fScore,
        monetaryScore: mScore,

        totalContributed: d.monetary,
        contributionCount: d.frequency,
        avgContribution: d.monetary / d.frequency,
        firstContributionDate: dates[0],
        lastContributionDate: dates[dates.length - 1],

        likelyParty,
        partyConfidence,

        segment: this.determineSegment(rScore, fScore, mScore),
      };
    });
  }

  /**
   * Get summary statistics across all contributions
   *
   * @param contributions - Array of contribution records
   * @returns Summary statistics object
   */
  getSummaryStats(contributions: Contribution[]): DonorSummaryStats {
    if (contributions.length === 0) {
      return {
        totalRaised: 0,
        uniqueDonors: 0,
        totalContributions: 0,
        avgGift: 0,
        medianGift: 0,
        largestGift: 0,
        demAmount: 0,
        repAmount: 0,
        otherAmount: 0,
        demPercent: 0,
        repPercent: 0,
        otherPercent: 0,
      };
    }

    const amounts = contributions.map(c => c.amount);
    const totalRaised = amounts.reduce((a, b) => a + b, 0);

    const donors = new Set(
      contributions.map(c => this.anonymizeId(c.contributorName, c.zipCode))
    );

    const demTotal = contributions
      .filter(c => c.party === 'DEM')
      .reduce((sum, c) => sum + c.amount, 0);

    const repTotal = contributions
      .filter(c => c.party === 'REP')
      .reduce((sum, c) => sum + c.amount, 0);

    const otherTotal = contributions
      .filter(c => c.party === 'other' || !c.party)
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      totalRaised,
      uniqueDonors: donors.size,
      totalContributions: contributions.length,
      avgGift: totalRaised / contributions.length,
      medianGift: this.median(amounts),
      largestGift: Math.max(...amounts),
      demAmount: demTotal,
      repAmount: repTotal,
      otherAmount: otherTotal,
      demPercent: totalRaised > 0 ? (demTotal / totalRaised) * 100 : 0,
      repPercent: totalRaised > 0 ? (repTotal / totalRaised) * 100 : 0,
      otherPercent: totalRaised > 0 ? (otherTotal / totalRaised) * 100 : 0,
    };
  }

  // =====================================================================
  // PRIVATE HELPER METHODS
  // =====================================================================

  /**
   * Score recency (days since last donation)
   * Lower days = higher score (5 = most recent)
   *
   * Uses quintile-based scoring where:
   * - Bottom 20% of days (most recent) = 5
   * - Top 20% of days (least recent) = 1
   */
  private scoreRecency(days: number, quintiles: number[]): number {
    if (days <= quintiles[0]) return 5;
    if (days <= quintiles[1]) return 4;
    if (days <= quintiles[2]) return 3;
    if (days <= quintiles[3]) return 2;
    return 1;
  }

  /**
   * Score frequency (number of donations)
   * More donations = higher score (5 = most frequent)
   *
   * Uses quintile-based scoring where:
   * - Top 20% of frequency = 5
   * - Bottom 20% of frequency = 1
   */
  private scoreFrequency(count: number, quintiles: number[]): number {
    if (count >= quintiles[3]) return 5;
    if (count >= quintiles[2]) return 4;
    if (count >= quintiles[1]) return 3;
    if (count >= quintiles[0]) return 2;
    return 1;
  }

  /**
   * Score monetary value (total amount)
   * Higher amount = higher score (5 = highest value)
   *
   * Uses quintile-based scoring where:
   * - Top 20% of total amount = 5
   * - Bottom 20% of total amount = 1
   */
  private scoreMonetary(amount: number, quintiles: number[]): number {
    if (amount >= quintiles[3]) return 5;
    if (amount >= quintiles[2]) return 4;
    if (amount >= quintiles[1]) return 3;
    if (amount >= quintiles[0]) return 2;
    return 1;
  }

  /**
   * Determine donor segment based on RFM scores
   *
   * Segmentation rules:
   * - Champion: R >= 4, F >= 4, M >= 4 (recent, frequent, high-value)
   * - Loyal: R >= 3, F >= 3, M >= 2 (regular mid-level)
   * - Potential: R >= 4, F <= 3 (recent but not frequent yet)
   * - At Risk: R <= 2, F >= 3, M >= 3 (were valuable, not recent)
   * - Lapsed: R <= 2 (not given recently)
   *
   * @param r - Recency score (1-5)
   * @param f - Frequency score (1-5)
   * @param m - Monetary score (1-5)
   * @returns Donor segment classification
   */
  private determineSegment(
    r: number,
    f: number,
    m: number
  ): DonorProfile['segment'] {
    // Champions: Recent, frequent, high-value
    if (r >= 4 && f >= 4 && m >= 4) return 'champion';

    // Loyal: Regular contributors
    if (r >= 3 && f >= 3 && m >= 2) return 'loyal';

    // Potential: Recent donors, not yet frequent
    if (r >= 4 && f <= 3) return 'potential';

    // At Risk: Were valuable, not recent
    if (r <= 2 && f >= 3 && m >= 3) return 'at_risk';

    // Lapsed: Not given recently
    if (r <= 2) return 'lapsed';

    // Default to potential
    return 'potential';
  }

  /**
   * Create anonymized donor ID
   * Uses stable hash for privacy while maintaining uniqueness
   *
   * Combines contributor name and ZIP code to create a unique,
   * non-reversible identifier that protects donor privacy while
   * allowing for tracking of individual giving patterns.
   *
   * @param name - Contributor name
   * @param zip - ZIP code
   * @returns Anonymized donor ID (base36 hash)
   */
  private anonymizeId(name: string, zip: string): string {
    const input = `${name.toLowerCase().trim()}|${zip}`;
    return this.simpleHash(input);
  }

  /**
   * Simple string hash function
   * Creates stable, non-reversible identifier
   *
   * Uses a basic hash algorithm that produces consistent results
   * for the same input while being computationally infeasible to reverse.
   *
   * @param str - Input string to hash
   * @returns Base36-encoded hash string
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;  // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Calculate median of numeric array
   *
   * @param arr - Array of numbers
   * @returns Median value
   */
  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate quintile breakpoints (20th, 40th, 60th, 80th percentiles)
   * Used for RFM scoring
   *
   * Returns four breakpoints that divide the data into five equal groups.
   * These are used to score donors on a 1-5 scale for each RFM dimension.
   *
   * @param arr - Array of numbers
   * @returns Array of four quintile breakpoints
   */
  private quintiles(arr: number[]): number[] {
    if (arr.length === 0) return [0, 0, 0, 0];
    const sorted = [...arr].sort((a, b) => a - b);
    return [0.2, 0.4, 0.6, 0.8].map(p => {
      const index = Math.floor(sorted.length * p);
      return sorted[Math.min(index, sorted.length - 1)];
    });
  }
}
