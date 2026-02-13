/**
 * Candidate Fundraising Comparison Engine
 *
 * Performs head-to-head comparisons of fundraising performance between candidates.
 * Analyzes direct contributions, PAC support, grassroots metrics, and outside spending.
 */

import type { Contribution } from './types';
import type {
  CommitteeContributionData,
  CandidateAggregate,
} from './types-committee';
import type { Candidate, CandidateOffice } from './CandidateRegistry';
import { RecipientFilter } from './RecipientFilter';

/**
 * Candidate fundraising profile for comparison
 */
export interface CandidateFundraisingProfile {
  candidateId: string;
  name: string;
  party: string;

  // Fundraising totals
  totalRaised: number;
  individualAmount: number;
  committeeAmount: number;
  smallDollarAmount: number; // < $200
  largeDollarAmount: number; // >= $200

  // Donor metrics
  donorCount: number;
  avgContribution: number;
  medianContribution: number;
  repeatDonorPct: number;

  // Grassroots strength
  smallDollarPct: number; // % of total from small donors
  grassrootsScore: number; // 0-100 (based on small dollar %, donor count, avg contribution)

  // Geographic distribution
  inDistrictPct: number; // % from district (for House candidates)
  inStatePct: number; // % from state
  outOfStatePct: number; // % from out of state
  topZips: Array<{ zip: string; amount: number; donorCount: number }>;

  // Committee support
  pacAmount: number;
  partyAmount: number;
  topPacs: Array<{ name: string; amount: number }>;

  // Outside spending
  ieSupport: number;
  ieOppose: number;
  netIE: number;
  topSupporters: Array<{ name: string; amount: number }>;
  topOpposers: Array<{ name: string; amount: number }>;

  // Total investment (raised + IE support)
  totalInvestment: number;
}

/**
 * Comparison metrics showing advantage
 */
export interface ComparisonAdvantage {
  candidateId: string;
  candidateName: string;
  amount: number;
  percentage: number;
}

/**
 * Head-to-head comparison result
 */
export interface ComparisonResult {
  candidates: CandidateFundraisingProfile[];

  // Comparison metrics
  comparison: {
    totalRaisedAdvantage: ComparisonAdvantage;
    donorCountAdvantage: ComparisonAdvantage;
    avgContributionAdvantage: ComparisonAdvantage;
    grassrootsAdvantage: ComparisonAdvantage;
    outsideMoneyAdvantage: ComparisonAdvantage;
    totalInvestmentAdvantage: ComparisonAdvantage;
  };

  // Geographic comparison
  geographicComparison: {
    [zip: string]: {
      [candidateId: string]: number; // Amount raised from ZIP
    };
  };

  // Insights
  insights: string[];
}

/**
 * Race comparison (3+ candidates)
 */
export interface RaceComparison {
  raceKey: string;
  candidates: CandidateFundraisingProfile[];
  totalRaised: number;
  totalDonors: number;
  leaderboard: Array<{
    rank: number;
    candidateId: string;
    name: string;
    party: string;
    totalRaised: number;
    donorCount: number;
    advantage: number; // Difference from next candidate
  }>;
  insights: string[];
}

/**
 * Candidate leaderboard
 */
export interface CandidateLeaderboard {
  office?: CandidateOffice;
  state?: string;
  candidates: Array<{
    rank: number;
    candidateId: string;
    name: string;
    party: string;
    state: string;
    district?: string;
    totalRaised: number;
    donorCount: number;
    avgContribution: number;
    grassrootsScore: number;
    totalInvestment: number;
  }>;
}

/**
 * Comparison Engine Service
 */
export class ComparisonEngine {
  private recipientFilter: RecipientFilter;

  constructor() {
    this.recipientFilter = new RecipientFilter();
  }

  /**
   * Compare two candidates head-to-head
   */
  compareCandidates(
    candidates: Candidate[],
    contributions: Contribution[],
    committeeData: CommitteeContributionData,
    ieData: any
  ): ComparisonResult {
    if (candidates.length < 2) {
      throw new Error('At least 2 candidates required for comparison');
    }

    // Build profiles for each candidate
    const profiles = candidates.map((candidate) =>
      this.buildCandidateProfile(candidate, contributions, committeeData, ieData)
    );

    // Calculate comparison metrics
    const comparison = this.calculateComparison(profiles);

    // Build geographic comparison
    const geographicComparison = this.buildGeographicComparison(
      profiles,
      contributions
    );

    // Generate insights
    const insights = this.generateInsights(profiles, comparison);

    return {
      candidates: profiles,
      comparison,
      geographicComparison,
      insights,
    };
  }

  /**
   * Compare all candidates in a race
   */
  compareRaces(
    raceKeys: string[],
    candidates: Candidate[],
    contributions: Contribution[],
    committeeData: CommitteeContributionData,
    ieData: any
  ): RaceComparison[] {
    return raceKeys.map((raceKey) => {
      const raceCandidates = candidates.filter((c) => {
        const candidateRaceKey = `${c.state}-${c.office}-${(c.district || '00').padStart(2, '0')}`;
        return candidateRaceKey === raceKey;
      });

      return this.compareRace(
        raceKey,
        raceCandidates,
        contributions,
        committeeData,
        ieData
      );
    });
  }

  /**
   * Compare candidates in a single race
   */
  compareRace(
    raceKey: string,
    candidates: Candidate[],
    contributions: Contribution[],
    committeeData: CommitteeContributionData,
    ieData: any
  ): RaceComparison {
    const profiles = candidates.map((candidate) =>
      this.buildCandidateProfile(candidate, contributions, committeeData, ieData)
    );

    // Sort by total raised
    profiles.sort((a, b) => b.totalRaised - a.totalRaised);

    // Build leaderboard
    const leaderboard = profiles.map((profile, index) => ({
      rank: index + 1,
      candidateId: profile.candidateId,
      name: profile.name,
      party: profile.party,
      totalRaised: profile.totalRaised,
      donorCount: profile.donorCount,
      advantage:
        index < profiles.length - 1
          ? profile.totalRaised - profiles[index + 1].totalRaised
          : 0,
    }));

    const totalRaised = profiles.reduce((sum, p) => sum + p.totalRaised, 0);
    const totalDonors = profiles.reduce((sum, p) => sum + p.donorCount, 0);

    const insights = this.generateRaceInsights(profiles, leaderboard);

    return {
      raceKey,
      candidates: profiles,
      totalRaised,
      totalDonors,
      leaderboard,
      insights,
    };
  }

  /**
   * Get leaderboard for office or state
   */
  getLeaderboard(
    candidates: Candidate[],
    contributions: Contribution[],
    committeeData: CommitteeContributionData,
    ieData: any,
    options: { office?: CandidateOffice; state?: string }
  ): CandidateLeaderboard {
    let filtered = candidates;

    if (options.office) {
      filtered = filtered.filter((c) => c.office === options.office);
    }

    if (options.state) {
      filtered = filtered.filter((c) => c.state === options.state);
    }

    const profiles = filtered.map((candidate) =>
      this.buildCandidateProfile(candidate, contributions, committeeData, ieData)
    );

    // Sort by total raised
    profiles.sort((a, b) => b.totalRaised - a.totalRaised);

    const candidateList = profiles.map((profile, index) => ({
      rank: index + 1,
      candidateId: profile.candidateId,
      name: profile.name,
      party: profile.party,
      state: candidates.find((c) => c.candidateId === profile.candidateId)!
        .state,
      district: candidates.find((c) => c.candidateId === profile.candidateId)!
        .district,
      totalRaised: profile.totalRaised,
      donorCount: profile.donorCount,
      avgContribution: profile.avgContribution,
      grassrootsScore: profile.grassrootsScore,
      totalInvestment: profile.totalInvestment,
    }));

    return {
      office: options.office,
      state: options.state,
      candidates: candidateList,
    };
  }

  /**
   * Build complete fundraising profile for a candidate
   */
  private buildCandidateProfile(
    candidate: Candidate,
    contributions: Contribution[],
    committeeData: CommitteeContributionData,
    ieData: any
  ): CandidateFundraisingProfile {
    // Get individual contributions for this candidate
    const individualContribs = this.recipientFilter.getContributionsForCandidate(
      contributions,
      candidate.candidateId
    );

    // Get small/large dollar breakdown
    const smallDollar = this.recipientFilter.getSmallDollarContributions(
      individualContribs.contributions
    );
    const largeDollar = this.recipientFilter.getLargeDollarContributions(
      individualContribs.contributions
    );

    // Calculate repeat donor percentage
    const donorNames = individualContribs.contributions.map(
      (c) => `${c.contributorName}-${c.zipCode}`
    );
    const uniqueDonors = new Set(donorNames);
    const repeatDonorPct =
      uniqueDonors.size > 0
        ? ((donorNames.length - uniqueDonors.size) / uniqueDonors.size) * 100
        : 0;

    // Geographic distribution
    const { inStatePct, outOfStatePct, topZips } =
      this.calculateGeographicDistribution(
        individualContribs.contributions,
        candidate.state
      );

    // Get committee contributions
    const committeeAggregate = committeeData.byCandidateId[candidate.candidateId];
    const committeeAmount = committeeAggregate?.totalReceived || 0;
    const pacAmount = committeeAggregate?.byType.PAC || 0;
    const partyAmount = committeeAggregate?.byType.PARTY || 0;
    const topPacs =
      committeeAggregate?.topContributors.slice(0, 5).map((c) => ({
        name: c.committeeName,
        amount: c.amount,
      })) || [];

    // Get IE data
    const ieCandidate = ieData.byCandidateId[candidate.candidateId];
    const ieSupport = ieCandidate?.supportSpending || 0;
    const ieOppose = ieCandidate?.opposeSpending || 0;
    const netIE = ieCandidate?.netSpending || 0;
    const topSupporters =
      ieCandidate?.topSpenders
        .filter((s: any) => s.supportOppose === 'S')
        .slice(0, 5)
        .map((s: any) => ({
          name: s.committeeName,
          amount: s.amount,
        })) || [];
    const topOpposers =
      ieCandidate?.topSpenders
        .filter((s: any) => s.supportOppose === 'O')
        .slice(0, 5)
        .map((s: any) => ({
          name: s.committeeName,
          amount: s.amount,
        })) || [];

    // Calculate totals
    const individualAmount = individualContribs.totalAmount;
    const totalRaised = individualAmount + committeeAmount;
    const totalInvestment = totalRaised + ieSupport;

    // Calculate grassroots score
    const smallDollarPct =
      totalRaised > 0 ? (smallDollar.totalAmount / totalRaised) * 100 : 0;
    const grassrootsScore = this.calculateGrassrootsScore(
      smallDollarPct,
      individualContribs.donorCount,
      individualContribs.avgContribution
    );

    return {
      candidateId: candidate.candidateId,
      name: candidate.name,
      party: candidate.party,
      totalRaised,
      individualAmount,
      committeeAmount,
      smallDollarAmount: smallDollar.totalAmount,
      largeDollarAmount: largeDollar.totalAmount,
      donorCount: individualContribs.donorCount,
      avgContribution: individualContribs.avgContribution,
      medianContribution: individualContribs.medianContribution,
      repeatDonorPct,
      smallDollarPct,
      grassrootsScore,
      inDistrictPct: 0, // Would need precinct geocoding
      inStatePct,
      outOfStatePct,
      topZips,
      pacAmount,
      partyAmount,
      topPacs,
      ieSupport,
      ieOppose,
      netIE,
      topSupporters,
      topOpposers,
      totalInvestment,
    };
  }

  /**
   * Calculate comparison metrics
   */
  private calculateComparison(
    profiles: CandidateFundraisingProfile[]
  ): ComparisonResult['comparison'] {
    const [first, second] = profiles.sort((a, b) => b.totalRaised - a.totalRaised);

    const totalRaisedDiff = first.totalRaised - second.totalRaised;
    const totalRaisedPct =
      second.totalRaised > 0 ? (totalRaisedDiff / second.totalRaised) * 100 : 100;

    const donorCountDiff = first.donorCount - second.donorCount;
    const donorCountPct =
      second.donorCount > 0 ? (donorCountDiff / second.donorCount) * 100 : 100;

    const avgContribDiff = first.avgContribution - second.avgContribution;
    const avgContribPct =
      second.avgContribution > 0
        ? (avgContribDiff / second.avgContribution) * 100
        : 100;

    const grassrootsDiff = first.grassrootsScore - second.grassrootsScore;
    const grassrootsPct =
      second.grassrootsScore > 0
        ? (grassrootsDiff / second.grassrootsScore) * 100
        : 100;

    const outsideMoneyDiff =
      first.ieSupport + first.ieOppose - (second.ieSupport + second.ieOppose);
    const outsideMoneyPct =
      second.ieSupport + second.ieOppose > 0
        ? (outsideMoneyDiff / (second.ieSupport + second.ieOppose)) * 100
        : 100;

    const totalInvestmentDiff = first.totalInvestment - second.totalInvestment;
    const totalInvestmentPct =
      second.totalInvestment > 0
        ? (totalInvestmentDiff / second.totalInvestment) * 100
        : 100;

    return {
      totalRaisedAdvantage: {
        candidateId: first.candidateId,
        candidateName: first.name,
        amount: totalRaisedDiff,
        percentage: totalRaisedPct,
      },
      donorCountAdvantage: {
        candidateId: first.candidateId,
        candidateName: first.name,
        amount: donorCountDiff,
        percentage: donorCountPct,
      },
      avgContributionAdvantage: {
        candidateId:
          avgContribDiff > 0 ? first.candidateId : second.candidateId,
        candidateName: avgContribDiff > 0 ? first.name : second.name,
        amount: Math.abs(avgContribDiff),
        percentage: Math.abs(avgContribPct),
      },
      grassrootsAdvantage: {
        candidateId:
          grassrootsDiff > 0 ? first.candidateId : second.candidateId,
        candidateName: grassrootsDiff > 0 ? first.name : second.name,
        amount: Math.abs(grassrootsDiff),
        percentage: Math.abs(grassrootsPct),
      },
      outsideMoneyAdvantage: {
        candidateId:
          outsideMoneyDiff > 0 ? first.candidateId : second.candidateId,
        candidateName: outsideMoneyDiff > 0 ? first.name : second.name,
        amount: Math.abs(outsideMoneyDiff),
        percentage: Math.abs(outsideMoneyPct),
      },
      totalInvestmentAdvantage: {
        candidateId: first.candidateId,
        candidateName: first.name,
        amount: totalInvestmentDiff,
        percentage: totalInvestmentPct,
      },
    };
  }

  /**
   * Build geographic comparison
   */
  private buildGeographicComparison(
    profiles: CandidateFundraisingProfile[],
    contributions: Contribution[]
  ): ComparisonResult['geographicComparison'] {
    const geographicComparison: ComparisonResult['geographicComparison'] = {};

    profiles.forEach((profile) => {
      const candidateContribs = contributions.filter(
        (c) => c.candidateId === profile.candidateId
      );

      candidateContribs.forEach((contrib) => {
        if (!geographicComparison[contrib.zipCode]) {
          geographicComparison[contrib.zipCode] = {};
        }
        if (!geographicComparison[contrib.zipCode][profile.candidateId]) {
          geographicComparison[contrib.zipCode][profile.candidateId] = 0;
        }
        geographicComparison[contrib.zipCode][profile.candidateId] +=
          contrib.amount;
      });
    });

    return geographicComparison;
  }

  /**
   * Generate comparison insights
   */
  private generateInsights(
    profiles: CandidateFundraisingProfile[],
    comparison: ComparisonResult['comparison']
  ): string[] {
    const insights: string[] = [];
    const [first, second] = profiles;

    // Fundraising advantage
    if (comparison.totalRaisedAdvantage.percentage > 50) {
      insights.push(
        `${comparison.totalRaisedAdvantage.candidateName} has a commanding ${comparison.totalRaisedAdvantage.percentage.toFixed(0)}% fundraising advantage`
      );
    } else if (comparison.totalRaisedAdvantage.percentage > 20) {
      insights.push(
        `${comparison.totalRaisedAdvantage.candidateName} leads in fundraising by ${comparison.totalRaisedAdvantage.percentage.toFixed(0)}%`
      );
    } else {
      insights.push('Race is highly competitive in fundraising');
    }

    // Grassroots strength
    if (first.grassrootsScore > 70 && second.grassrootsScore < 50) {
      insights.push(
        `${first.name} shows strong grassroots support (${first.smallDollarPct.toFixed(0)}% small dollar)`
      );
    }

    // Outside spending
    if (Math.abs(comparison.outsideMoneyAdvantage.amount) > 1000000) {
      insights.push(
        `Heavy outside spending: ${comparison.outsideMoneyAdvantage.candidateName} has ${(comparison.outsideMoneyAdvantage.amount / 1000000).toFixed(1)}M more IE activity`
      );
    }

    return insights;
  }

  /**
   * Generate race insights
   */
  private generateRaceInsights(
    profiles: CandidateFundraisingProfile[],
    leaderboard: RaceComparison['leaderboard']
  ): string[] {
    const insights: string[] = [];

    if (leaderboard.length > 0) {
      const leader = leaderboard[0];
      insights.push(
        `${leader.name} (${leader.party}) leads with ${(leader.totalRaised / 1000000).toFixed(1)}M raised`
      );

      if (leaderboard.length > 1 && leader.advantage > 1000000) {
        insights.push(
          `${(leader.advantage / 1000000).toFixed(1)}M advantage over second place`
        );
      }
    }

    return insights;
  }

  /**
   * Calculate geographic distribution
   */
  private calculateGeographicDistribution(
    contributions: Contribution[],
    candidateState: string
  ): {
    inStatePct: number;
    outOfStatePct: number;
    topZips: Array<{ zip: string; amount: number; donorCount: number }>;
  } {
    const inState = contributions.filter((c) => c.state === candidateState);
    const totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);

    const inStateAmount = inState.reduce((sum, c) => sum + c.amount, 0);
    const inStatePct = totalAmount > 0 ? (inStateAmount / totalAmount) * 100 : 0;
    const outOfStatePct = 100 - inStatePct;

    // Top ZIPs
    const zipMap = new Map<string, { amount: number; donorCount: number }>();
    contributions.forEach((c) => {
      if (!zipMap.has(c.zipCode)) {
        zipMap.set(c.zipCode, { amount: 0, donorCount: 0 });
      }
      const zip = zipMap.get(c.zipCode)!;
      zip.amount += c.amount;
      zip.donorCount++;
    });

    const topZips = Array.from(zipMap.entries())
      .map(([zip, data]) => ({ zip, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return { inStatePct, outOfStatePct, topZips };
  }

  /**
   * Calculate grassroots score (0-100)
   */
  private calculateGrassrootsScore(
    smallDollarPct: number,
    donorCount: number,
    avgContribution: number
  ): number {
    // Score components
    const smallDollarScore = Math.min(100, smallDollarPct * 1.5); // 70% small = 100 score
    const donorCountScore = Math.min(100, (donorCount / 1000) * 100); // 1000 donors = 100 score
    const avgContributionScore = Math.max(
      0,
      100 - ((avgContribution - 50) / 500) * 100
    ); // Lower avg = higher score

    // Weighted average
    return (
      smallDollarScore * 0.5 +
      donorCountScore * 0.3 +
      avgContributionScore * 0.2
    );
  }
}

// Export singleton instance
export const comparisonEngine = new ComparisonEngine();
