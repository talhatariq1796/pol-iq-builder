/**
 * Recipient Filter for Campaign Contributions
 *
 * Filters contributions, committee contributions, and independent expenditures
 * by recipient (candidate or committee), party, office, location, and other criteria.
 */

import type { Contribution } from './types';
import type {
  CommitteeContributionData,
  CandidateAggregate,
  CommitteeAggregate,
} from './types-committee';
import type { Candidate, CandidateOffice, CandidateParty } from './CandidateRegistry';

/**
 * Filter options for recipient-based filtering
 */
export interface RecipientFilterOptions {
  // Candidate/Committee filters
  candidateIds?: string[];
  committeeIds?: string[];

  // Party filter
  party?: 'DEM' | 'REP' | 'ALL';

  // Office filter
  office?: CandidateOffice;

  // Geographic filters
  state?: string;
  district?: string;
  zipCodes?: string[];

  // Amount filters
  minAmount?: number;
  maxAmount?: number;

  // Date range filter
  dateRange?: {
    start: string; // ISO date
    end: string;   // ISO date
  };

  // Transaction type filter
  transactionType?: string;

  // Cycle filter
  cycle?: string;
}

/**
 * Filtered result with aggregates
 */
export interface FilteredContributionResult {
  contributions: Contribution[];
  totalAmount: number;
  donorCount: number;
  contributionCount: number;
  avgContribution: number;
  medianContribution: number;
}

/**
 * Filtered committee contribution result
 */
export interface FilteredCommitteeResult {
  candidates: CandidateAggregate[];
  committees: CommitteeAggregate[];
  totalAmount: number;
  candidateCount: number;
  committeeCount: number;
}

/**
 * Recipient Filter Service
 */
export class RecipientFilter {
  /**
   * Filter individual contributions by recipient and other criteria
   */
  filterContributions(
    contributions: Contribution[],
    options: RecipientFilterOptions
  ): FilteredContributionResult {
    let filtered = contributions;

    // Filter by candidate IDs (via committee lookup)
    if (options.candidateIds && options.candidateIds.length > 0) {
      const candidateIdSet = new Set(options.candidateIds);
      filtered = filtered.filter(
        (c) => c.candidateId && candidateIdSet.has(c.candidateId)
      );
    }

    // Filter by committee IDs
    if (options.committeeIds && options.committeeIds.length > 0) {
      const committeeIdSet = new Set(options.committeeIds);
      filtered = filtered.filter((c) => committeeIdSet.has(c.committeeId));
    }

    // Filter by party
    if (options.party && options.party !== 'ALL') {
      filtered = filtered.filter((c) => c.party === options.party);
    }

    // Filter by state
    if (options.state) {
      filtered = filtered.filter((c) => c.state === options.state);
    }

    // Filter by amount
    if (options.minAmount !== undefined) {
      filtered = filtered.filter((c) => c.amount >= options.minAmount!);
    }
    if (options.maxAmount !== undefined) {
      filtered = filtered.filter((c) => c.amount <= options.maxAmount!);
    }

    // Filter by date range
    if (options.dateRange) {
      const startDate = new Date(options.dateRange.start);
      const endDate = new Date(options.dateRange.end);
      filtered = filtered.filter((c) => {
        const contribDate = new Date(c.date);
        return contribDate >= startDate && contribDate <= endDate;
      });
    }

    // Filter by transaction type
    if (options.transactionType) {
      filtered = filtered.filter(
        (c) => c.transactionType === options.transactionType
      );
    }

    // Filter by cycle
    if (options.cycle) {
      filtered = filtered.filter((c) => c.electionCycle === options.cycle);
    }

    // Calculate aggregates
    const totalAmount = filtered.reduce((sum, c) => sum + c.amount, 0);
    const donorCount = new Set(
      filtered.map((c) => `${c.contributorName}-${c.zipCode}`)
    ).size;
    const contributionCount = filtered.length;
    const avgContribution =
      contributionCount > 0 ? totalAmount / contributionCount : 0;

    // Calculate median
    const sortedAmounts = filtered.map((c) => c.amount).sort((a, b) => a - b);
    const medianContribution =
      sortedAmounts.length > 0
        ? sortedAmounts[Math.floor(sortedAmounts.length / 2)]
        : 0;

    return {
      contributions: filtered,
      totalAmount,
      donorCount,
      contributionCount,
      avgContribution,
      medianContribution,
    };
  }

  /**
   * Filter committee contributions by recipient and criteria
   */
  filterCommitteeContributions(
    data: CommitteeContributionData,
    options: RecipientFilterOptions
  ): FilteredCommitteeResult {
    let candidates = Object.values(data.byCandidateId);
    let committees = Object.values(data.byCommitteeId);

    // Filter candidates
    if (options.candidateIds && options.candidateIds.length > 0) {
      const candidateIdSet = new Set(options.candidateIds);
      candidates = candidates.filter((c) => candidateIdSet.has(c.candidateId));
    }

    if (options.office) {
      candidates = candidates.filter((c) => c.office === options.office);
    }

    if (options.state) {
      candidates = candidates.filter((c) => c.state === options.state);
    }

    if (options.district) {
      candidates = candidates.filter((c) => c.district === options.district);
    }

    if (options.party && options.party !== 'ALL') {
      candidates = candidates.filter((c) => {
        const name = c.candidateName.toUpperCase();
        if (options.party === 'DEM') {
          return name.includes('DEM');
        } else if (options.party === 'REP') {
          return name.includes('REP');
        }
        return true;
      });
    }

    // Filter committees
    if (options.committeeIds && options.committeeIds.length > 0) {
      const committeeIdSet = new Set(options.committeeIds);
      committees = committees.filter((c) => committeeIdSet.has(c.committeeId));
    }

    // Calculate aggregates
    const totalAmount = candidates.reduce((sum, c) => sum + c.totalReceived, 0);
    const candidateCount = candidates.length;
    const committeeCount = committees.length;

    return {
      candidates,
      committees,
      totalAmount,
      candidateCount,
      committeeCount,
    };
  }

  /**
   * Filter independent expenditures by candidate
   */
  filterIndependentExpenditures(
    ieData: any,
    options: RecipientFilterOptions
  ): any {
    let candidates = Object.values(ieData.byCandidateId) as any[];

    // Filter by candidate IDs
    if (options.candidateIds && options.candidateIds.length > 0) {
      const candidateIdSet = new Set(options.candidateIds);
      candidates = candidates.filter((c) =>
        candidateIdSet.has(c.candidateId)
      );
    }

    // Filter by office
    if (options.office) {
      const officeStr = this.officeToString(options.office);
      candidates = candidates.filter((c) =>
        c.office.toLowerCase().includes(officeStr.toLowerCase())
      );
    }

    // Filter by state
    if (options.state) {
      candidates = candidates.filter((c) => c.state === options.state);
    }

    // Filter by party
    if (options.party && options.party !== 'ALL') {
      candidates = candidates.filter((c) => {
        const party = c.party.toUpperCase();
        return party.includes(options.party!);
      });
    }

    return {
      candidates,
      totalSupport: candidates.reduce((sum, c) => sum + c.supportSpending, 0),
      totalOppose: candidates.reduce((sum, c) => sum + c.opposeSpending, 0),
      candidateCount: candidates.length,
    };
  }

  /**
   * Get contributions for a specific candidate
   */
  getContributionsForCandidate(
    contributions: Contribution[],
    candidateId: string
  ): FilteredContributionResult {
    return this.filterContributions(contributions, {
      candidateIds: [candidateId],
    });
  }

  /**
   * Get contributions for a specific committee
   */
  getContributionsForCommittee(
    contributions: Contribution[],
    committeeId: string
  ): FilteredContributionResult {
    return this.filterContributions(contributions, {
      committeeIds: [committeeId],
    });
  }

  /**
   * Get contributions for a race (all candidates in race)
   */
  getContributionsForRace(
    contributions: Contribution[],
    candidateIds: string[]
  ): FilteredContributionResult {
    return this.filterContributions(contributions, {
      candidateIds,
    });
  }

  /**
   * Get small dollar contributions (< $200)
   */
  getSmallDollarContributions(
    contributions: Contribution[]
  ): FilteredContributionResult {
    return this.filterContributions(contributions, {
      maxAmount: 200,
    });
  }

  /**
   * Get large dollar contributions (>= $200)
   */
  getLargeDollarContributions(
    contributions: Contribution[]
  ): FilteredContributionResult {
    return this.filterContributions(contributions, {
      minAmount: 200,
    });
  }

  /**
   * Get contributions from a specific ZIP code
   */
  getContributionsFromZIP(
    contributions: Contribution[],
    zipCode: string
  ): Contribution[] {
    return contributions.filter((c) => c.zipCode === zipCode);
  }

  /**
   * Get contributions from a specific state
   */
  getContributionsFromState(
    contributions: Contribution[],
    state: string
  ): Contribution[] {
    return contributions.filter((c) => c.state === state);
  }

  // Helper methods

  private officeToString(office: CandidateOffice): string {
    switch (office) {
      case 'H':
        return 'House';
      case 'S':
        return 'Senate';
      case 'P':
        return 'President';
      default:
        return 'House';
    }
  }
}

// Export singleton instance
export const recipientFilter = new RecipientFilter();
