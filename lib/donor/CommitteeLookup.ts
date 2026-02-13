/**
 * FEC Committee Lookup Service
 *
 * Provides efficient lookup and querying of FEC committee data.
 * Data is loaded from the processed committees.json file.
 */

import type {
  CommitteeData,
  CommitteeRecord,
  PartyAffiliation,
  CommitteeTypeCode,
} from './types/committee';
import {
  isPartyCommittee,
  isSuperPAC,
  isCandidateCommittee,
  isPAC,
} from './types/committee';

/**
 * Committee Lookup Service
 * Singleton class for efficient committee data access
 */
class CommitteeLookupService {
  private data: CommitteeData | null = null;
  private committeesByParty: Map<PartyAffiliation, CommitteeRecord[]>;
  private committeesByType: Map<string, CommitteeRecord[]>;
  private committeesByState: Map<string, CommitteeRecord[]>;

  constructor() {
    this.committeesByParty = new Map();
    this.committeesByType = new Map();
    this.committeesByState = new Map();
  }

  /**
   * Initialize the service by loading committee data
   * Must be called before using other methods
   */
  async initialize(): Promise<void> {
    if (this.data) return; // Already initialized

    // Load committee data dynamically
    const response = await fetch('/data/donors/committees.json');
    this.data = await response.json();
    this.buildIndexes();
  }

  /**
   * Get data (throws if not initialized)
   */
  private getData(): CommitteeData {
    if (!this.data) {
      throw new Error('CommitteeLookupService not initialized. Call initialize() first.');
    }
    return this.data;
  }

  /**
   * Build indexes for efficient querying
   */
  private buildIndexes(): void {
    const data = this.getData();
    const committees = Object.values(data.committees);

    // Index by party
    committees.forEach((committee) => {
      if (!this.committeesByParty.has(committee.party)) {
        this.committeesByParty.set(committee.party, []);
      }
      this.committeesByParty.get(committee.party)!.push(committee);
    });

    // Index by type
    committees.forEach((committee) => {
      if (!this.committeesByType.has(committee.type)) {
        this.committeesByType.set(committee.type, []);
      }
      this.committeesByType.get(committee.type)!.push(committee);
    });

    // Index by state
    committees.forEach((committee) => {
      if (committee.state) {
        if (!this.committeesByState.has(committee.state)) {
          this.committeesByState.set(committee.state, []);
        }
        this.committeesByState.get(committee.state)!.push(committee);
      }
    });
  }

  /**
   * Get committee by ID
   */
  getById(committeeId: string): CommitteeRecord | null {
    const data = this.getData();
    return data.committees[committeeId] || null;
  }

  /**
   * Get committees by party affiliation
   */
  getByParty(party: PartyAffiliation): CommitteeRecord[] {
    return this.committeesByParty.get(party) || [];
  }

  /**
   * Get committees by type
   */
  getByType(type: CommitteeTypeCode | string): CommitteeRecord[] {
    return this.committeesByType.get(type) || [];
  }

  /**
   * Get committees by state
   */
  getByState(state: string): CommitteeRecord[] {
    return this.committeesByState.get(state) || [];
  }

  /**
   * Search committees by name (case-insensitive)
   */
  searchByName(query: string): CommitteeRecord[] {
    const data = this.getData();
    const lowerQuery = query.toLowerCase();
    return Object.values(data.committees).filter((committee) =>
      committee.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get all party committees
   */
  getPartyCommittees(): CommitteeRecord[] {
    const data = this.getData();
    return Object.values(data.committees).filter(isPartyCommittee);
  }

  /**
   * Get all Super PACs
   */
  getSuperPACs(): CommitteeRecord[] {
    const data = this.getData();
    return Object.values(data.committees).filter(isSuperPAC);
  }

  /**
   * Get all candidate committees
   */
  getCandidateCommittees(): CommitteeRecord[] {
    const data = this.getData();
    return Object.values(data.committees).filter(isCandidateCommittee);
  }

  /**
   * Get all PACs
   */
  getPACs(): CommitteeRecord[] {
    const data = this.getData();
    return Object.values(data.committees).filter(isPAC);
  }

  /**
   * Get committees for a specific candidate
   */
  getByCandidateId(candidateId: string): CommitteeRecord[] {
    const data = this.getData();
    return Object.values(data.committees).filter(
      (committee) => committee.candidateId === candidateId
    );
  }

  /**
   * Get metadata about the committee data
   */
  getMetadata() {
    const data = this.getData();
    return data.metadata;
  }

  /**
   * Get summary statistics
   */
  getStats() {
    const data = this.getData();
    return {
      total: data.metadata.totalCommittees,
      byParty: data.metadata.byParty,
      byType: data.metadata.byType,
      processedAt: data.metadata.processedAt,
    };
  }

  /**
   * Check if committee exists
   */
  exists(committeeId: string): boolean {
    const data = this.getData();
    return committeeId in data.committees;
  }

  /**
   * Get party affiliation for a committee (returns UNKNOWN if not found)
   */
  getParty(committeeId: string): PartyAffiliation {
    const committee = this.getById(committeeId);
    return committee?.party || 'UNKNOWN';
  }

  /**
   * Get committee name (returns ID if not found)
   */
  getName(committeeId: string): string {
    const committee = this.getById(committeeId);
    return committee?.name || committeeId;
  }

  /**
   * Batch lookup: get multiple committees by ID
   */
  getBatch(committeeIds: string[]): CommitteeRecord[] {
    return committeeIds
      .map((id) => this.getById(id))
      .filter((c): c is CommitteeRecord => c !== null);
  }

  /**
   * Get top committees by party (sorted by frequency in dataset)
   */
  getTopCommitteesByParty(party: PartyAffiliation, limit: number = 10): CommitteeRecord[] {
    return this.getByParty(party).slice(0, limit);
  }
}

// Export singleton instance
export const CommitteeLookup = new CommitteeLookupService();

// Export class for testing
export { CommitteeLookupService };

// Re-export types for convenience
export type { CommitteeRecord, CommitteeData, PartyAffiliation, CommitteeTypeCode };
export { isPartyCommittee, isSuperPAC, isCandidateCommittee, isPAC };
