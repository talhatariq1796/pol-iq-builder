/**
 * Candidate Registry for Fundraising Analysis
 *
 * Builds and maintains a comprehensive registry of candidates with aggregated
 * fundraising data from multiple sources (individual contributions, PAC contributions,
 * and independent expenditures).
 *
 * Data Sources:
 * - committee-contributions.json (byCandidateId)
 * - independent-expenditures.json (byCandidateId)
 * - contributions.json (individual contributions, linked via committee)
 * - committees.json (party lookup)
 */

import type {
  CandidateAggregate,
  CommitteeContributionData,
} from './types-committee';
import type { Contribution } from './types';

export type CandidateOffice = 'H' | 'S' | 'P';
export type CandidateParty = 'DEM' | 'REP' | 'OTHER' | 'UNKNOWN';

/**
 * Candidate information with aggregated fundraising totals
 */
export interface Candidate {
  candidateId: string;
  name: string;
  party: CandidateParty;
  office: CandidateOffice;
  state: string;
  district?: string;
  incumbentStatus?: 'incumbent' | 'challenger' | 'open';

  // Aggregated totals (from all sources)
  totalRaised: number;              // Individual + committee contributions
  individualContributions: number;  // From contributions.json
  committeeContributions: number;   // From committee-contributions.json
  ieSupport: number;                // Independent expenditures FOR candidate
  ieOppose: number;                 // Independent expenditures AGAINST candidate
  netIE: number;                    // ieSupport - ieOppose
  totalInvestment: number;          // totalRaised + ieSupport

  // Donor metrics
  individualDonorCount?: number;
  committeeDonorCount?: number;

  // Top contributors (from committee contributions)
  topPACs?: Array<{ name: string; amount: number }>;
}

/**
 * Race key format: "{state}-{office}-{district}"
 * Examples: "MI-H-07", "MI-S-00", "US-P-00"
 */
export type RaceKey = string;

/**
 * Independent Expenditure data by candidate
 */
interface IECandidateData {
  candidateId: string;
  candidateName: string;
  party: string;
  office: string;
  state: string;
  district: string;
  supportSpending: number;
  opposeSpending: number;
  netSpending: number;
  spenderCount: number;
  topSpenders: Array<{
    committeeId: string;
    committeeName: string;
    amount: number;
    supportOppose: 'S' | 'O';
  }>;
}

interface IndependentExpenditureData {
  metadata: {
    processedAt: string;
    source: string;
    cycles: string[];
    totalRecords: number;
    michiganRecords: number;
    totalSpending: number;
  };
  byCandidateId: Record<string, IECandidateData>;
}

/**
 * Registry metadata
 */
export interface RegistryMetadata {
  processedAt: string;
  source: string;
  candidateCount: number;
  totalRaised: number;
  totalIESpending: number;
}

/**
 * Candidate Registry - Main data structure
 */
export interface CandidateRegistryData {
  metadata: RegistryMetadata;
  candidates: Record<string, Candidate>;
  byRace: Record<RaceKey, string[]>; // candidateIds
}

/**
 * Candidate Registry Service
 * Loads and indexes candidate data from multiple sources
 */
export class CandidateRegistry {
  private registry: CandidateRegistryData | null = null;

  /**
   * Initialize registry by loading and merging all data sources
   */
  async initialize(): Promise<void> {
    if (this.registry) return; // Already initialized

    // Load all data sources
    const [committeeContribData, ieData, committees] = await Promise.all([
      fetch('/data/donors/committee-contributions.json').then(
        (r) => r.json() as Promise<CommitteeContributionData>
      ),
      fetch('/data/donors/independent-expenditures.json').then(
        (r) => r.json() as Promise<IndependentExpenditureData>
      ),
      fetch('/data/donors/committees.json').then((r) => r.json()),
    ]);

    this.registry = this.buildRegistry(committeeContribData, ieData);
  }

  /**
   * Build registry from committee contributions and IE data
   */
  private buildRegistry(
    committeeData: CommitteeContributionData,
    ieData: IndependentExpenditureData
  ): CandidateRegistryData {
    const candidates: Record<string, Candidate> = {};
    const byRace: Record<RaceKey, string[]> = {};
    let totalRaised = 0;
    let totalIESpending = 0;

    // Process committee contributions data
    Object.values(committeeData.byCandidateId).forEach((candData) => {
      const candidateId = candData.candidateId;
      const party = this.normalizeParty(candData.candidateName);
      const raceKey = this.buildRaceKey(
        candData.state,
        candData.office,
        candData.district
      );

      // Extract top PACs
      const topPACs = candData.topContributors
        .slice(0, 5)
        .map((contrib) => ({
          name: contrib.committeeName,
          amount: contrib.amount,
        }));

      candidates[candidateId] = {
        candidateId,
        name: candData.candidateName,
        party,
        office: candData.office,
        state: candData.state,
        district: candData.district,
        totalRaised: candData.totalReceived,
        individualContributions: 0, // Will update if we have individual data
        committeeContributions: candData.totalReceived,
        ieSupport: 0,
        ieOppose: 0,
        netIE: 0,
        totalInvestment: candData.totalReceived,
        committeeDonorCount: candData.contributorCount,
        topPACs,
      };

      totalRaised += candData.totalReceived;

      // Index by race
      if (!byRace[raceKey]) {
        byRace[raceKey] = [];
      }
      byRace[raceKey].push(candidateId);
    });

    // Merge independent expenditure data
    Object.values(ieData.byCandidateId).forEach((ieCandidate) => {
      const candidateId = ieCandidate.candidateId;
      const ieSupport = ieCandidate.supportSpending;
      const ieOppose = ieCandidate.opposeSpending;

      totalIESpending += ieSupport + ieOppose;

      if (candidates[candidateId]) {
        // Update existing candidate
        candidates[candidateId].ieSupport = ieSupport;
        candidates[candidateId].ieOppose = ieOppose;
        candidates[candidateId].netIE = ieCandidate.netSpending;
        candidates[candidateId].totalInvestment =
          candidates[candidateId].totalRaised + ieSupport;
      } else {
        // New candidate (IE data only, no direct committee contributions)
        const party = this.inferPartyFromName(ieCandidate.party);
        const office = this.normalizeOffice(ieCandidate.office);
        const raceKey = this.buildRaceKey(
          ieCandidate.state,
          office,
          ieCandidate.district
        );

        candidates[candidateId] = {
          candidateId,
          name: ieCandidate.candidateName,
          party,
          office,
          state: ieCandidate.state,
          district: ieCandidate.district,
          totalRaised: 0,
          individualContributions: 0,
          committeeContributions: 0,
          ieSupport,
          ieOppose,
          netIE: ieCandidate.netSpending,
          totalInvestment: ieSupport,
        };

        // Index by race
        if (!byRace[raceKey]) {
          byRace[raceKey] = [];
        }
        byRace[raceKey].push(candidateId);
      }
    });

    return {
      metadata: {
        processedAt: new Date().toISOString(),
        source: 'committee-contributions.json + independent-expenditures.json',
        candidateCount: Object.keys(candidates).length,
        totalRaised,
        totalIESpending,
      },
      candidates,
      byRace,
    };
  }

  /**
   * Get registry data (throws if not initialized)
   */
  private getRegistry(): CandidateRegistryData {
    if (!this.registry) {
      throw new Error('CandidateRegistry not initialized. Call initialize() first.');
    }
    return this.registry;
  }

  /**
   * Get candidate by ID
   */
  getCandidateById(candidateId: string): Candidate | null {
    const registry = this.getRegistry();
    return registry.candidates[candidateId] || null;
  }

  /**
   * Get all candidates in a race
   */
  getCandidatesByRace(raceKey: RaceKey): Candidate[] {
    const registry = this.getRegistry();
    const candidateIds = registry.byRace[raceKey] || [];
    return candidateIds
      .map((id) => registry.candidates[id])
      .filter((c): c is Candidate => c !== null);
  }

  /**
   * Get all candidates by office
   */
  getCandidatesByOffice(office: CandidateOffice): Candidate[] {
    const registry = this.getRegistry();
    return Object.values(registry.candidates).filter((c) => c.office === office);
  }

  /**
   * Get all candidates by state
   */
  getCandidatesByState(state: string): Candidate[] {
    const registry = this.getRegistry();
    return Object.values(registry.candidates).filter((c) => c.state === state);
  }

  /**
   * Get all candidates by party
   */
  getCandidatesByParty(party: CandidateParty): Candidate[] {
    const registry = this.getRegistry();
    return Object.values(registry.candidates).filter((c) => c.party === party);
  }

  /**
   * Search candidates by name
   */
  searchByName(query: string): Candidate[] {
    const registry = this.getRegistry();
    const lowerQuery = query.toLowerCase();
    return Object.values(registry.candidates).filter((c) =>
      c.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get all races for a state
   */
  getRacesByState(state: string): RaceKey[] {
    const registry = this.getRegistry();
    return Object.keys(registry.byRace).filter((raceKey) =>
      raceKey.startsWith(`${state}-`)
    );
  }

  /**
   * Get top fundraisers (by total raised)
   */
  getTopFundraisers(limit: number = 10, office?: CandidateOffice): Candidate[] {
    const registry = this.getRegistry();
    let candidates = Object.values(registry.candidates);

    if (office) {
      candidates = candidates.filter((c) => c.office === office);
    }

    return candidates
      .sort((a, b) => b.totalRaised - a.totalRaised)
      .slice(0, limit);
  }

  /**
   * Get candidates with most outside spending
   */
  getTopIETargets(limit: number = 10, office?: CandidateOffice): Candidate[] {
    const registry = this.getRegistry();
    let candidates = Object.values(registry.candidates);

    if (office) {
      candidates = candidates.filter((c) => c.office === office);
    }

    return candidates
      .sort((a, b) => b.ieSupport + b.ieOppose - (a.ieSupport + a.ieOppose))
      .slice(0, limit);
  }

  /**
   * Export registry to JSON (for saving to file)
   */
  exportToJSON(): string {
    const registry = this.getRegistry();
    return JSON.stringify(registry, null, 2);
  }

  /**
   * Get registry metadata
   */
  getMetadata(): RegistryMetadata {
    const registry = this.getRegistry();
    return registry.metadata;
  }

  /**
   * Get all candidate IDs
   */
  getAllCandidateIds(): string[] {
    const registry = this.getRegistry();
    return Object.keys(registry.candidates);
  }

  /**
   * Get all race keys
   */
  getAllRaceKeys(): RaceKey[] {
    const registry = this.getRegistry();
    return Object.keys(registry.byRace);
  }

  // Helper methods

  /**
   * Build race key from components
   */
  private buildRaceKey(
    state: string,
    office: CandidateOffice,
    district?: string
  ): RaceKey {
    const districtPart = district || '00';
    return `${state}-${office}-${districtPart.padStart(2, '0')}`;
  }

  /**
   * Normalize party from candidate name or party string
   */
  private normalizeParty(partyStr: string): CandidateParty {
    const upper = partyStr.toUpperCase();
    if (upper.includes('DEM')) return 'DEM';
    if (upper.includes('REP')) return 'REP';
    if (upper.includes('UNKNOWN')) return 'UNKNOWN';
    return 'OTHER';
  }

  /**
   * Infer party from party string in IE data
   */
  private inferPartyFromName(partyStr: string): CandidateParty {
    const upper = partyStr.toUpperCase();
    if (upper.includes('DEMOCRATIC')) return 'DEM';
    if (upper.includes('REPUBLICAN')) return 'REP';
    return 'OTHER';
  }

  /**
   * Normalize office string to single letter
   */
  private normalizeOffice(office: string): CandidateOffice {
    const upper = office.toUpperCase();
    if (upper.includes('HOUSE')) return 'H';
    if (upper.includes('SENATE')) return 'S';
    if (upper.includes('PRESIDENT')) return 'P';
    return 'H'; // Default
  }
}

// Export singleton instance
export const candidateRegistry = new CandidateRegistry();
