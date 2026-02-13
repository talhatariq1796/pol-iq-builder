/**
 * Type definitions for donor analysis and fundraising intelligence
 *
 * This module defines the core data structures for analyzing campaign contributions,
 * donor behavior, and fundraising prospects. It supports FEC and state-level data.
 *
 * @module lib/donor/types
 */

export interface Contribution {
  id: string;                     // FEC SUB_ID or generated
  source: 'fec' | 'michigan_sos';

  // Contributor
  contributorName: string;
  city: string;
  state: string;
  zipCode: string;                // 5-digit
  employer?: string;
  occupation?: string;

  // Recipient
  committeeId: string;
  committeeName?: string;
  candidateId?: string;
  candidateName?: string;
  party?: 'DEM' | 'REP' | 'other';

  // Transaction
  amount: number;
  date: string;                   // ISO date
  transactionType: string;
  electionCycle: string;          // "2024", "2026"

  // Geocoding
  latitude?: number;
  longitude?: number;
  h3Index?: string;               // H3 Level 7
  precinctId?: string;            // If geocoded to precinct
}

export interface ZIPAggregate {
  zipCode: string;
  city: string;
  state: string;

  // Totals
  totalAmount: number;
  donorCount: number;
  contributionCount: number;
  avgContribution: number;
  medianContribution: number;

  // Party breakdown
  demAmount: number;
  repAmount: number;
  otherAmount: number;
  demDonors: number;
  repDonors: number;

  // Time-based
  amountLast30Days: number;
  amountLast90Days: number;
  amountLast12Months: number;

  // Top contributors (anonymized)
  topDonorCount: number;          // Donors giving $1000+
  maxSingleDonation: number;

  // Derived
  donorDensity: number;           // Donors per 1000 population
  avgCapacity: number;            // Based on income data
  prospectScore: number;          // 0-100
}

export interface DonorProfile {
  // Anonymized ID (hash of name + ZIP)
  donorId: string;

  // Location
  zipCode: string;
  city: string;
  h3Index?: string;

  // RFM Scores (1-5 each)
  recencyScore: number;           // 5 = donated in last 30 days
  frequencyScore: number;         // 5 = 10+ donations
  monetaryScore: number;          // 5 = top 20% by amount

  // Totals
  totalContributed: number;
  contributionCount: number;
  avgContribution: number;
  firstContributionDate: string;
  lastContributionDate: string;

  // Party (modeled from recipients)
  likelyParty: 'DEM' | 'REP' | 'split' | 'unknown';
  partyConfidence: number;

  // Segment
  segment: 'champion' | 'loyal' | 'potential' | 'at_risk' | 'lapsed' | 'prospect';
}

/**
 * Summary statistics for contribution data
 *
 * Provides high-level overview of fundraising performance across all data.
 */
export interface DonorSummaryStats {
  totalRaised: number;
  uniqueDonors: number;
  totalContributions: number;
  avgGift: number;
  medianGift: number;
  largestGift: number;
  demAmount: number;
  repAmount: number;
  otherAmount: number;
  demPercent: number;
  repPercent: number;
  otherPercent: number;
}

/**
 * ZIP code demographic data for prospect analysis
 *
 * Links census/demographic data to ZIP codes for capacity modeling.
 */
export interface ZIPDemographics {
  zipCode: string;
  city: string;
  state: string;
  population: number;
  medianIncome: number;
  medianAge?: number;
  collegePct?: number;
}

/**
 * Options for prospect area identification
 */
export interface ProspectOptions {
  minMedianIncome: number;
  minDonorGap: number;
  party?: 'DEM' | 'REP';
  includeLapsed?: boolean;
}

/**
 * Geographic area with high fundraising potential
 *
 * Identifies ZIP codes where current donor penetration is below average
 * for the demographic profile, indicating untapped fundraising opportunities.
 */
export interface ProspectArea {
  zipCode: string;
  city: string;
  medianIncome: number;
  population: number;
  currentDonorRate: number;
  avgDonorRate: number;
  gapPercent: number;
  potentialLow: number;
  potentialHigh: number;
  score: number;
}

/**
 * Segment information for display and strategy planning
 *
 * Provides actionable insights for each donor segment.
 */
export interface SegmentInfo {
  name: string;
  description: string;
  donorCount: number;
  totalAmount: number;
  avgGift: number;
  strategy: string;
}

/**
 * Donor segment classifications based on RFM analysis
 *
 * - champion: High R, F, M - best donors
 * - loyal: High F, M - regular supporters
 * - potential: High R or M - promising prospects
 * - at_risk: Low R, high F/M - need re-engagement
 * - lapsed: Very low R - lost donors
 * - prospect: New or low engagement - acquisition targets
 */
export type DonorSegment =
  | 'champion'
  | 'loyal'
  | 'potential'
  | 'at_risk'
  | 'lapsed'
  | 'prospect';

/**
 * RFM segment definitions and scoring thresholds
 *
 * Defines the rules for classifying donors into segments based on their
 * Recency, Frequency, and Monetary scores (each 1-5).
 *
 * Scoring methodology:
 * - Champion: R >= 4, F >= 4, M >= 4 (best donors)
 * - Loyal: F >= 4, M >= 4 (regular high-value donors)
 * - Potential: R >= 4 OR M >= 4 (recent or high-value but not frequent)
 * - At Risk: R <= 2, F >= 3, M >= 3 (previously good, now inactive)
 * - Lapsed: R = 1 (haven't given in a long time)
 * - Prospect: All others (new, low engagement, or inconsistent)
 */
export const RFM_SEGMENTS: Record<
  DonorSegment,
  {
    name: string;
    description: string;
    criteria: string;
    strategy: string;
    priority: number;
  }
> = {
  champion: {
    name: 'Champions',
    description: 'Best donors: recent, frequent, and high-value contributors',
    criteria: 'R >= 4, F >= 4, M >= 4',
    strategy:
      'VIP treatment, exclusive events, major gift asks, stewardship calls',
    priority: 1,
  },
  loyal: {
    name: 'Loyal Donors',
    description: 'Regular supporters who give frequently and generously',
    criteria: 'F >= 4, M >= 4',
    strategy:
      'Sustainer programs, monthly giving, upgrade asks, impact reports',
    priority: 2,
  },
  potential: {
    name: 'Potential Champions',
    description: 'Either recent or high-value donors with growth potential',
    criteria: 'R >= 4 OR M >= 4 (but not Champions or Loyal)',
    strategy:
      'Cultivation, engagement events, upgrade solicitations, personal touches',
    priority: 3,
  },
  at_risk: {
    name: 'At-Risk Donors',
    description: 'Previously strong donors who have gone quiet',
    criteria: 'R <= 2, F >= 3, M >= 3',
    strategy:
      'Re-engagement campaigns, feedback surveys, special appeals, impact stories',
    priority: 4,
  },
  lapsed: {
    name: 'Lapsed Donors',
    description: 'Former donors who have not given recently',
    criteria: 'R = 1',
    strategy:
      'Win-back campaigns, special offers, "we miss you" messaging, reactivation appeals',
    priority: 5,
  },
  prospect: {
    name: 'Prospects',
    description: 'New or inconsistent donors needing cultivation',
    criteria: 'All others',
    strategy:
      'Acquisition campaigns, welcome series, low-dollar asks, engagement content',
    priority: 6,
  },
};

/**
 * Type guard to check if a value is a valid DonorSegment
 */
export function isDonorSegment(value: string): value is DonorSegment {
  return [
    'champion',
    'loyal',
    'potential',
    'at_risk',
    'lapsed',
    'prospect',
  ].includes(value);
}

/**
 * Type guard to check if a value is a valid party code
 */
export function isPartyCode(
  value: string
): value is 'DEM' | 'REP' | 'other' {
  return ['DEM', 'REP', 'other'].includes(value);
}

/**
 * RFM Segment display information
 * Used by DonorDashboard for segment table rendering
 */
export interface RFMSegment {
  segment: DonorSegment;
  name: string;
  description: string;
  emoji: string;
  strategy: string;
  donorCount: number;
  totalAmount: number;
  avgGift: number;
}

/**
 * Filter options for the donor dashboard
 */
export interface DonorFilters {
  cycle: string;
  party: 'all' | 'DEM' | 'REP';
  view: 'table' | 'heatmap';
  minAmount?: number;
  maxAmount?: number;
  zipCodes?: string[];
}

/**
 * Occupation breakdown for ZIP detail view
 */
export interface OccupationSummary {
  occupation: string;
  donorCount: number;
  totalAmount: number;
  avgContribution: number;
}

/**
 * Monthly contribution trend data
 */
export interface MonthlyTrend {
  month: string;
  amount: number;
  contributionCount: number;
}

/**
 * ZIP code detail data for the detail panel
 * Combines aggregate data with additional context
 */
export interface ZIPDetailData {
  zipCode: string;
  city: string;
  state: string;
  aggregate: ZIPAggregate;
  topOccupations: OccupationSummary[];
  monthlyTrend: MonthlyTrend[];
  demographicProfile?: {
    population: number;
    medianIncome: number;
    medianAge?: number;
    collegePct?: number;
  };
}

/**
 * Lapsed donor information with recovery scoring
 */
export interface LapsedDonor {
  donorId: string;
  zipCode: string;
  city: string;
  lastGiftDate: string;
  lastGiftAmount: number;
  totalHistoricalAmount: number;
  giftCount: number;
  avgGift: number;
  likelyParty: 'DEM' | 'REP' | 'split';
  daysSinceLastGift: number;
  monthsSinceLastGift: number;
  historicalFrequencyScore: number;
  historicalMonetaryScore: number;
  recoveryScore: number;
  estimatedRecoveryAmount: number;
  recommendedChannel: 'phone' | 'mail' | 'door' | 'digital';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Geographic cluster of lapsed donors for targeted outreach
 */
export interface DonorCluster {
  clusterId: string;
  centerZip: string;
  city: string;
  donorCount: number;
  totalHistoricalValue: number;
  avgRecoveryScore: number;
  estimatedRecoveryValue: number;
  donorIds: string[];
  recommendedApproach: string;
}

/**
 * Lapsed donor analysis data
 */
export interface LapsedDonorData {
  metadata: {
    processedAt: string;
    criteria: {
      lastGaveBefore: string;
      notGivenSince: string;
      minHistoricalAmount: number;
      minHistoricalGifts: number;
      party: string;
    };
    totalLapsed: number;
    totalHistoricalValue: number;
    estimatedRecoveryValue: number;
    avgRecoveryScore: number;
    avgMonthsSinceLapse: number;
  };
  donors: LapsedDonor[];
}

/**
 * Upgrade prospect with capacity analysis
 */
export interface UpgradeProspect {
  donorId: string;
  zipCode: string;
  city: string;
  currentTotalGiven: number;
  currentAvgGift: number;
  lastGiftAmount: number;
  giftCount: number;
  estimatedCapacity: number;
  capacityConfidence: 'high' | 'medium' | 'low';
  zipMedianIncome: number;
  occupationCapacity: string;
  currentUtilization: number;
  upgradeGap: number;
  upgradeScore: number;
  recencyScore: number;
  frequencyScore: number;
  loyaltyIndicator: boolean;
  recommendedAsk: number;
  recommendedChannel: 'call' | 'email' | 'event';
  capacityTier: 'high' | 'medium' | 'low';
}

/**
 * Upgrade prospect analysis data
 */
export interface UpgradeProspectData {
  metadata: {
    processedAt: string;
    totalDonors: number;
    totalProspects: number;
    totalCurrentGiving: number;
    totalUpgradeGap: number;
    avgUpgradeScore: number;
  };
  prospects: UpgradeProspect[];
}

/**
 * Candidate fundraising summary
 */
export interface Candidate {
  candidateId: string;
  name: string;
  party: 'DEM' | 'REP' | 'OTHER';
  office: 'H' | 'S' | 'P';
  state: string;
  district: string;
  totalRaised: number;
  individualContributions: number;
  committeeContributions: number;
  ieSupport: number;
  ieOppose: number;
  netIE: number;
  totalInvestment: number;
  committeeDonorCount: number;
  topPACs: Array<{
    name: string;
    amount: number;
  }>;
}

/**
 * Candidate comparison result
 */
export interface ComparisonResult {
  candidate1: Candidate;
  candidate2: Candidate;
  metrics: {
    raisedDiff: number;
    raisedPct: number;
    donorDiff: number;
    avgGiftDiff: number;
    ieSupportDiff: number;
    totalInvestmentDiff: number;
  };
}

/**
 * Independent expenditure transaction
 */
export interface IndependentExpenditure {
  id: string;
  committeeId: string;
  committeeName: string;
  candidateId: string;
  candidateName: string;
  supportOppose: 'S' | 'O';
  amount: number;
  date: string;
  purpose: string;
  electionCycle: string;
}

/**
 * Independent expenditure analysis data
 */
export interface IndependentExpenditureData {
  metadata: {
    processedAt: string;
    totalSpending: number;
    totalSupport: number;
    totalOppose: number;
    raceCount: number;
  };
  byRace: Record<string, {
    candidateId: string;
    candidateName: string;
    totalIE: number;
    support: number;
    oppose: number;
    netIE: number;
    topSpenders: Array<{
      committeeId: string;
      committeeName: string;
      amount: number;
      supportOppose: 'S' | 'O';
    }>;
  }>;
  timeline: Array<{
    month: string;
    totalSpending: number;
    support: number;
    oppose: number;
  }>;
}
