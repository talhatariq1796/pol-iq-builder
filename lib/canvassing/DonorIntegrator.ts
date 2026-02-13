/**
 * Donor Integrator
 *
 * Cross-tool integration connecting donor analysis to canvassing operations.
 * Provides lapsed donor targeting, walk list enrichment, and donor recovery workflows.
 *
 * Key Features:
 * - Identify geographic clusters of lapsed donors
 * - Create canvassing turfs for donor re-engagement
 * - Enrich walk lists with donor status information
 * - Track donor recovery via door-to-door canvassing
 * - Recommend scripts based on donor profiles
 */

import type { CanvassingTurf, CanvassingPrecinct, CanvassingUniverse } from './types';
import type { LapsedDonor, DonorCluster, DonorProfile, ZIPAggregate } from '../donor/types';

/**
 * Donor status classification for walk list enrichment
 */
export type DonorType = 'grassroots' | 'major' | 'recurring' | 'lapsed' | 'prospect' | 'none';

/**
 * Donor-enriched address for walk lists
 */
export interface DonorEnrichedAddress {
  address: string;
  precinct: string;
  precinctId: string;

  // Voter data
  voterName?: string;
  registeredParty?: string;
  voterScore?: number;

  // Donor data (if match found)
  isDonor: boolean;
  donorType: DonorType;
  donorId?: string;
  lastGiftDate?: string;
  lastGiftAmount?: number;
  lifetimeTotal?: number;
  recoveryScore?: number; // For lapsed donors (0-100)
  upgradeScore?: number;  // For current donors (0-100)

  // Canvassing guidance
  recommendedScript: string;
  conversationTips: string[];
  specialHandling?: string;
  priority: number; // 1-5, 5 = highest priority
}

/**
 * Donor targeting options for turf creation
 */
export interface DonorTargetingOptions {
  // Filter options
  donorTypes: DonorType[];
  minRecoveryScore?: number;
  minLifetimeTotal?: number;
  minDaysLapsed?: number;
  maxDaysLapsed?: number;
  party?: 'DEM' | 'REP' | 'all';

  // Clustering options
  minDonorsPerCluster?: number;
  maxRadiusKm?: number;

  // Turf options
  targetDoorsPerTurf?: number;
  includeNonDonors?: boolean;
}

/**
 * Donor recovery turf - specialized turf for donor re-engagement
 */
export interface DonorRecoveryTurf extends CanvassingTurf {
  donorTargeting: {
    totalDonors: number;
    lapsedDonors: number;
    avgRecoveryScore: number;
    estimatedRecoveryValue: number;
    donorTypes: Record<DonorType, number>;
  };
  enrichedAddresses: DonorEnrichedAddress[];
}

/**
 * Result from donor canvassing session
 */
export interface DonorCanvassingResult {
  donorId: string;
  contactDate: string;
  contactType: 'door' | 'phone' | 'mail';
  result: 'recovered' | 'declined' | 'not_home' | 'moved' | 'refused' | 'pending';
  pledgeAmount?: number;
  actualAmount?: number;
  followUpRequired: boolean;
  notes?: string;
  volunteerId: string;
}

/**
 * Summary of donor recovery campaign
 */
export interface DonorRecoverySummary {
  universeId: string;
  universeName: string;
  dateRange: { start: string; end: string };

  // Target stats
  totalDonorsTargeted: number;
  totalAddressesVisited: number;
  totalContactsMade: number;

  // Results
  donorsRecovered: number;
  recoveryRate: number;
  totalPledged: number;
  totalCollected: number;

  // Comparison
  doorRecoveryRate: number;
  historicalMailRate?: number;
  historicalPhoneRate?: number;

  // Breakdown by type
  byDonorType: Record<DonorType, {
    targeted: number;
    recovered: number;
    rate: number;
  }>;

  // Insights
  insights: string[];
  recommendations: string[];
}

/**
 * Donor Integrator - Cross-tool integration for donor-aware canvassing
 */
export class DonorIntegrator {
  /**
   * Find geographic clusters of lapsed donors
   *
   * @param lapsedDonors - Array of lapsed donor records
   * @param options - Clustering options
   * @returns Array of donor clusters with geographic info
   */
  static findDonorClusters(
    lapsedDonors: LapsedDonor[],
    options?: {
      minDonorsPerCluster?: number;
      maxRadiusKm?: number;
    }
  ): DonorCluster[] {
    const minDonors = options?.minDonorsPerCluster ?? 5;
    const clusters: DonorCluster[] = [];

    // Group donors by ZIP code
    const byZip = new Map<string, LapsedDonor[]>();
    for (const donor of lapsedDonors) {
      const existing = byZip.get(donor.zipCode) || [];
      existing.push(donor);
      byZip.set(donor.zipCode, existing);
    }

    // Create clusters from ZIP groups that meet minimum threshold
    let clusterId = 1;
    for (const [zipCode, donors] of byZip) {
      if (donors.length < minDonors) {
        continue;
      }

      const totalHistoricalValue = donors.reduce((sum, d) => sum + d.totalHistoricalAmount, 0);
      const avgRecoveryScore = donors.reduce((sum, d) => sum + d.recoveryScore, 0) / donors.length;
      const estimatedRecoveryValue = donors.reduce((sum, d) => sum + d.estimatedRecoveryAmount, 0);

      // Determine recommended approach based on donor profile
      const recommendedApproach = this.getClusterApproach(donors);

      clusters.push({
        clusterId: `cluster_${clusterId++}`,
        centerZip: zipCode,
        city: donors[0].city,
        donorCount: donors.length,
        totalHistoricalValue,
        avgRecoveryScore: Math.round(avgRecoveryScore),
        estimatedRecoveryValue,
        donorIds: donors.map(d => d.donorId),
        recommendedApproach,
      });
    }

    // Sort by estimated recovery value (highest first)
    clusters.sort((a, b) => b.estimatedRecoveryValue - a.estimatedRecoveryValue);

    return clusters;
  }

  /**
   * Create donor recovery turfs from clusters
   *
   * @param clusters - Donor clusters to convert to turfs
   * @param precincts - Available precincts for turf assignment
   * @param options - Turf creation options
   * @returns Array of donor recovery turfs
   */
  static createDonorRecoveryTurfs(
    clusters: DonorCluster[],
    precincts: CanvassingPrecinct[],
    lapsedDonors: LapsedDonor[],
    options?: DonorTargetingOptions
  ): DonorRecoveryTurf[] {
    const targetDoors = options?.targetDoorsPerTurf ?? 50;
    const turfs: DonorRecoveryTurf[] = [];

    // Create donor lookup
    const donorByZip = new Map<string, LapsedDonor[]>();
    for (const donor of lapsedDonors) {
      const existing = donorByZip.get(donor.zipCode) || [];
      existing.push(donor);
      donorByZip.set(donor.zipCode, existing);
    }

    for (const cluster of clusters) {
      // Find precincts that overlap with this cluster's ZIP
      const clusterPrecincts = precincts.filter(p =>
        this.precinctOverlapsZip(p, cluster.centerZip)
      );

      if (clusterPrecincts.length === 0) {
        continue;
      }

      // Get donors for this cluster
      const clusterDonors = donorByZip.get(cluster.centerZip) || [];

      // Calculate donor stats
      const donorTypes: Record<DonorType, number> = {
        grassroots: 0,
        major: 0,
        recurring: 0,
        lapsed: clusterDonors.length,
        prospect: 0,
        none: 0,
      };

      // Enrich addresses
      const enrichedAddresses = clusterDonors.map(donor =>
        this.enrichAddressForDonor(donor)
      );

      // Create turf
      const turf: DonorRecoveryTurf = {
        turfId: `donor_${cluster.clusterId}`,
        turfName: `Donor Recovery - ${cluster.city} ${cluster.centerZip}`,
        precinctIds: clusterPrecincts.map(p => p.precinctId),
        estimatedDoors: Math.min(targetDoors, clusterDonors.length),
        estimatedHours: Math.ceil(clusterDonors.length / 30), // ~30 doors/hour
        doorsPerHour: 30,
        density: 'suburban', // Assume suburban for donor targeting
        priority: this.calculateDonorTurfPriority(cluster),
        avgGotvPriority: 0.5, // Donor turfs neutral on GOTV
        avgPersuasionOpportunity: 0.3, // Focus on donor recovery, not persuasion

        donorTargeting: {
          totalDonors: clusterDonors.length,
          lapsedDonors: clusterDonors.length,
          avgRecoveryScore: cluster.avgRecoveryScore,
          estimatedRecoveryValue: cluster.estimatedRecoveryValue,
          donorTypes,
        },
        enrichedAddresses,
      };

      turfs.push(turf);
    }

    return turfs;
  }

  /**
   * Enrich walk list addresses with donor information
   *
   * @param precincts - Precincts in the canvassing universe
   * @param donorProfiles - All donor profiles
   * @param zipAggregates - ZIP-level donor aggregates
   * @returns Enriched addresses with donor info
   */
  static enrichWalkList(
    precincts: CanvassingPrecinct[],
    donorProfiles: DonorProfile[],
    zipAggregates: Map<string, ZIPAggregate>
  ): DonorEnrichedAddress[] {
    const enrichedAddresses: DonorEnrichedAddress[] = [];

    // Create donor lookup by ZIP
    const donorsByZip = new Map<string, DonorProfile[]>();
    for (const donor of donorProfiles) {
      const existing = donorsByZip.get(donor.zipCode) || [];
      existing.push(donor);
      donorsByZip.set(donor.zipCode, existing);
    }

    for (const precinct of precincts) {
      // For each precinct, estimate ZIP codes (simplified)
      // In production, would use address-level matching
      const precinctZips = this.getPrecinctZips(precinct);

      for (const zipCode of precinctZips) {
        const donors = donorsByZip.get(zipCode) || [];
        const aggregate = zipAggregates.get(zipCode);

        for (const donor of donors) {
          const donorType = this.classifyDonorType(donor);

          enrichedAddresses.push({
            address: `${zipCode} Area`,
            precinct: precinct.precinctName,
            precinctId: precinct.precinctId,

            isDonor: true,
            donorType,
            donorId: donor.donorId,
            lastGiftDate: donor.lastContributionDate,
            lastGiftAmount: donor.avgContribution,
            lifetimeTotal: donor.totalContributed,
            recoveryScore: donor.segment === 'lapsed' ? this.calculateRecoveryScore(donor) : undefined,
            upgradeScore: donor.segment !== 'lapsed' ? this.calculateUpgradeScore(donor) : undefined,

            recommendedScript: this.getRecommendedScript(donorType, donor),
            conversationTips: this.getConversationTips(donorType, donor),
            specialHandling: this.getSpecialHandling(donor),
            priority: this.calculateAddressPriority(donor, aggregate),
          });
        }

        // Add non-donor addresses if ZIP has potential
        if (aggregate && aggregate.prospectScore > 50) {
          enrichedAddresses.push({
            address: `${zipCode} Prospect Area`,
            precinct: precinct.precinctName,
            precinctId: precinct.precinctId,

            isDonor: false,
            donorType: 'prospect',

            recommendedScript: 'voter_outreach',
            conversationTips: [
              'Standard voter contact - no known donor history',
              'If engaged, mention giving opportunity',
            ],
            priority: 2,
          });
        }
      }
    }

    // Sort by priority
    enrichedAddresses.sort((a, b) => b.priority - a.priority);

    return enrichedAddresses;
  }

  /**
   * Get recommended script based on donor type
   */
  static getRecommendedScript(donorType: DonorType, donor?: DonorProfile | LapsedDonor): string {
    switch (donorType) {
      case 'lapsed':
        return 'lapsed_donor_reengagement';
      case 'major':
        return 'major_donor_stewardship';
      case 'recurring':
        return 'recurring_donor_thank_you';
      case 'grassroots':
        return 'upgrade_prospect_cultivation';
      case 'prospect':
        return 'voter_outreach_with_ask';
      default:
        return 'voter_outreach';
    }
  }

  /**
   * Get conversation tips based on donor type
   */
  static getConversationTips(donorType: DonorType, donor?: DonorProfile | LapsedDonor): string[] {
    const tips: string[] = [];

    switch (donorType) {
      case 'lapsed':
        tips.push('Warm approach: "We noticed it\'s been a while since we connected..."');
        tips.push('Ask about their experience and any concerns');
        tips.push('Share recent campaign impact stories');
        if (donor && 'lastGiftAmount' in donor) {
          tips.push(`Previous gift: $${donor.lastGiftAmount} - consider similar ask`);
        }
        tips.push('Offer multiple ways to re-engage (donate, volunteer, event)');
        break;

      case 'major':
        tips.push('Be brief and respectful - major donors value their time');
        tips.push('Focus on appreciation, not asks');
        tips.push('Mention exclusive updates or upcoming events');
        tips.push('Offer direct line to campaign leadership');
        break;

      case 'recurring':
        tips.push('Thank them for ongoing support');
        tips.push('Share impact of their recurring gifts');
        tips.push('Don\'t ask for upgrade unless they bring it up');
        tips.push('Confirm they\'re receiving communication preferences');
        break;

      case 'grassroots':
        tips.push('Appreciate their support, however small');
        tips.push('Share how grassroots donors make a difference');
        tips.push('Mention opportunities to increase impact (recurring, upgrade)');
        tips.push('Keep it conversational, not transactional');
        break;

      case 'prospect':
        tips.push('Start with voter concerns, not fundraising');
        tips.push('If conversation goes well, mention ways to support');
        tips.push('Provide campaign info first, ask comes later');
        tips.push('Note engagement level for follow-up');
        break;

      default:
        tips.push('Standard voter contact');
        tips.push('Listen for issues and concerns');
    }

    return tips;
  }

  /**
   * Get special handling instructions for donor
   */
  static getSpecialHandling(donor: DonorProfile | LapsedDonor): string | undefined {
    const total = 'totalContributed' in donor ? donor.totalContributed : donor.totalHistoricalAmount;

    if (total >= 10000) {
      return 'MAJOR DONOR - Be brief, be respectful, focus on appreciation';
    }

    if (total >= 5000) {
      return 'High-value donor - Prioritize relationship over transaction';
    }

    const segment = 'segment' in donor ? donor.segment : 'lapsed';
    if (segment === 'at_risk') {
      return 'At-risk donor - Focus on re-engagement, ask about concerns';
    }

    if (segment === 'champion') {
      return 'Champion donor - VIP treatment, mention leadership opportunities';
    }

    return undefined;
  }

  /**
   * Record result from donor canvassing
   */
  static recordDonorContact(result: DonorCanvassingResult): void {
    // In production, would persist to DonorStore
    // For now, log for tracking
    console.log('Donor contact recorded:', {
      donorId: result.donorId,
      result: result.result,
      pledgeAmount: result.pledgeAmount,
    });
  }

  /**
   * Generate summary of donor recovery campaign
   */
  static generateRecoverySummary(
    universe: CanvassingUniverse,
    results: DonorCanvassingResult[],
    targetedDonors: LapsedDonor[]
  ): DonorRecoverySummary {
    const recovered = results.filter(r => r.result === 'recovered');
    const totalPledged = recovered.reduce((sum, r) => sum + (r.pledgeAmount || 0), 0);
    const totalCollected = recovered.reduce((sum, r) => sum + (r.actualAmount || 0), 0);

    const recoveryRate = targetedDonors.length > 0
      ? (recovered.length / targetedDonors.length) * 100
      : 0;

    // Group results by donor type
    const byType: Record<DonorType, { targeted: number; recovered: number; rate: number }> = {
      grassroots: { targeted: 0, recovered: 0, rate: 0 },
      major: { targeted: 0, recovered: 0, rate: 0 },
      recurring: { targeted: 0, recovered: 0, rate: 0 },
      lapsed: { targeted: targetedDonors.length, recovered: recovered.length, rate: recoveryRate },
      prospect: { targeted: 0, recovered: 0, rate: 0 },
      none: { targeted: 0, recovered: 0, rate: 0 },
    };

    // Generate insights
    const insights: string[] = [];
    if (recoveryRate >= 20) {
      insights.push(`Excellent recovery rate of ${recoveryRate.toFixed(1)}% - door-to-door is effective`);
    } else if (recoveryRate >= 10) {
      insights.push(`Good recovery rate of ${recoveryRate.toFixed(1)}% - competitive with other channels`);
    } else {
      insights.push(`Recovery rate of ${recoveryRate.toFixed(1)}% - consider optimizing approach`);
    }

    if (totalPledged > totalCollected) {
      insights.push(`$${totalPledged - totalCollected} in pledges still outstanding - follow up needed`);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const notHomeRate = results.filter(r => r.result === 'not_home').length / results.length * 100;
    if (notHomeRate > 30) {
      recommendations.push('High not-home rate - consider evening/weekend shifts');
    }

    const refusedRate = results.filter(r => r.result === 'refused').length / results.length * 100;
    if (refusedRate > 15) {
      recommendations.push('High refusal rate - review script and training');
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      universeId: universe.id,
      universeName: universe.name,
      dateRange: {
        start: thirtyDaysAgo.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },

      totalDonorsTargeted: targetedDonors.length,
      totalAddressesVisited: results.length,
      totalContactsMade: results.filter(r => r.result !== 'not_home').length,

      donorsRecovered: recovered.length,
      recoveryRate,
      totalPledged,
      totalCollected,

      doorRecoveryRate: recoveryRate,
      historicalMailRate: 5, // Industry benchmarks
      historicalPhoneRate: 8,

      byDonorType: byType,
      insights,
      recommendations,
    };
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Determine recommended approach for a cluster
   */
  private static getClusterApproach(donors: LapsedDonor[]): string {
    const avgAmount = donors.reduce((sum, d) => sum + d.avgGift, 0) / donors.length;
    const avgRecovery = donors.reduce((sum, d) => sum + d.recoveryScore, 0) / donors.length;

    if (avgAmount >= 500 && avgRecovery >= 60) {
      return 'High-value priority: Personal visits with senior volunteers';
    }

    if (avgRecovery >= 70) {
      return 'High recovery potential: Focus on relationship rebuilding';
    }

    if (avgAmount >= 200) {
      return 'Mid-level outreach: Emphasize campaign progress and impact';
    }

    return 'Grassroots re-engagement: Community-focused messaging';
  }

  /**
   * Check if precinct overlaps with ZIP code (simplified)
   */
  private static precinctOverlapsZip(precinct: CanvassingPrecinct, zipCode: string): boolean {
    // In production, would use actual geographic intersection
    // For now, use jurisdiction-based heuristic
    return precinct.jurisdiction.includes(zipCode.slice(0, 3));
  }

  /**
   * Get ZIP codes for a precinct (simplified)
   */
  private static getPrecinctZips(precinct: CanvassingPrecinct): string[] {
    // In production, would use geographic lookup
    // For now, return placeholder based on Ingham County
    const inghamZips = ['48823', '48824', '48826', '48864', '48906', '48910', '48911', '48912', '48915', '48917'];
    return inghamZips.slice(0, 3); // Return first 3 as sample
  }

  /**
   * Classify donor type from profile
   */
  private static classifyDonorType(donor: DonorProfile): DonorType {
    if (donor.segment === 'lapsed') {
      return 'lapsed';
    }

    if (donor.totalContributed >= 5000) {
      return 'major';
    }

    if (donor.contributionCount >= 10) {
      return 'recurring';
    }

    if (donor.totalContributed > 0) {
      return 'grassroots';
    }

    return 'prospect';
  }

  /**
   * Calculate recovery score for donor profile
   */
  private static calculateRecoveryScore(donor: DonorProfile): number {
    let score = 0;

    // Base on RFM scores
    score += donor.frequencyScore * 10; // 10-50 points
    score += donor.monetaryScore * 8;   // 8-40 points

    // Boost for recent activity
    if (donor.recencyScore >= 3) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Calculate upgrade score for current donors
   */
  private static calculateUpgradeScore(donor: DonorProfile): number {
    let score = 0;

    // Recent donors more upgradeable
    score += donor.recencyScore * 10;

    // Frequent donors show commitment
    score += donor.frequencyScore * 8;

    // Mid-level monetary = upgrade potential
    if (donor.monetaryScore === 3 || donor.monetaryScore === 4) {
      score += 20; // Sweet spot for upgrades
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Calculate priority for address
   */
  private static calculateAddressPriority(
    donor: DonorProfile | LapsedDonor,
    aggregate?: ZIPAggregate
  ): number {
    let priority = 3; // Default mid-priority

    const total = 'totalContributed' in donor ? donor.totalContributed : donor.totalHistoricalAmount;

    // Major donors = highest priority
    if (total >= 5000) {
      priority = 5;
    } else if (total >= 1000) {
      priority = 4;
    }

    // High recovery score increases priority
    const recoveryScore = 'recoveryScore' in donor ? donor.recoveryScore : 50;
    if (recoveryScore >= 70) {
      priority = Math.min(5, priority + 1);
    }

    // ZIP with high donor density = prioritize
    if (aggregate && aggregate.donorDensity > 10) {
      priority = Math.min(5, priority + 1);
    }

    return priority;
  }

  /**
   * Calculate priority for donor turf
   */
  private static calculateDonorTurfPriority(cluster: DonorCluster): number {
    // Priority 1 = highest (most urgent)
    // Based on recovery value and score

    if (cluster.estimatedRecoveryValue >= 10000 && cluster.avgRecoveryScore >= 70) {
      return 1;
    }

    if (cluster.estimatedRecoveryValue >= 5000 || cluster.avgRecoveryScore >= 60) {
      return 2;
    }

    if (cluster.estimatedRecoveryValue >= 2000) {
      return 3;
    }

    return 4;
  }

  /**
   * Enrich address for a lapsed donor
   */
  private static enrichAddressForDonor(donor: LapsedDonor): DonorEnrichedAddress {
    return {
      address: `${donor.zipCode} - ${donor.city}`,
      precinct: 'Unknown', // Would be resolved via address lookup
      precinctId: '',

      isDonor: true,
      donorType: 'lapsed',
      donorId: donor.donorId,
      lastGiftDate: donor.lastGiftDate,
      lastGiftAmount: donor.lastGiftAmount,
      lifetimeTotal: donor.totalHistoricalAmount,
      recoveryScore: donor.recoveryScore,

      recommendedScript: this.getRecommendedScript('lapsed'),
      conversationTips: this.getConversationTips('lapsed'),
      specialHandling: donor.totalHistoricalAmount >= 5000
        ? 'High-value lapsed donor - prioritize relationship'
        : undefined,
      priority: donor.priority === 'high' ? 5 : donor.priority === 'medium' ? 4 : 3,
    };
  }
}
