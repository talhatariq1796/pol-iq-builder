/**
 * TypeScript Type Definitions for Committee Contribution Data
 *
 * Generated from: scripts/donor-ingestion/process-committee-contributions.ts
 * Data file: public/data/donors/committee-contributions.json
 */

/**
 * Committee party affiliation
 */
export type CommitteeParty = 'DEM' | 'REP' | 'OTHER' | 'UNKNOWN';

/**
 * Committee type classification
 */
export type CommitteeType = 'PAC' | 'PARTY' | 'LEADERSHIP' | 'OTHER';

/**
 * Candidate office type
 */
export type CandidateOffice = 'H' | 'S' | 'P';

/**
 * Party breakdown totals
 */
export interface PartyBreakdown {
  DEM: number;
  REP: number;
  OTHER: number;
  UNKNOWN: number;
}

/**
 * Committee type breakdown totals
 */
export interface TypeBreakdown {
  PAC: number;
  PARTY: number;
  LEADERSHIP: number;
  OTHER: number;
}

/**
 * Top contributor to a candidate
 */
export interface TopContributor {
  committeeId: string;
  committeeName: string;
  amount: number;
  party: string;
}

/**
 * Top recipient of committee funds
 */
export interface TopRecipient {
  candidateId: string;
  candidateName: string;
  amount: number;
}

/**
 * Candidate aggregate data
 */
export interface CandidateAggregate {
  candidateId: string;
  candidateName: string;
  state: string;
  district?: string;
  office: CandidateOffice;
  totalReceived: number;
  contributorCount: number;
  byParty: PartyBreakdown;
  byType: TypeBreakdown;
  topContributors: TopContributor[];
}

/**
 * Committee aggregate data
 */
export interface CommitteeAggregate {
  committeeId: string;
  committeeName: string;
  party: string;
  totalGiven: number;
  recipientCount: number;
  topRecipients: TopRecipient[];
}

/**
 * Candidate data within a race
 */
export interface RaceCandidate {
  candidateId: string;
  candidateName: string;
  party: string;
  received: number;
}

/**
 * Race aggregate data
 */
export interface RaceAggregate {
  raceKey: string;
  totalContributions: number;
  demReceived: number;
  repReceived: number;
  candidates: RaceCandidate[];
}

/**
 * Individual committee contribution record
 */
export interface CommitteeContributionRecord {
  contributorId: string;
  contributorName: string;
  contributorParty: string;
  recipientId: string;
  recipientName: string;
  candidateId: string;
  amount: number;
  date: string;
  transactionType: string;
}

/**
 * Metadata about the processed data
 */
export interface CommitteeContributionMetadata {
  processedAt: string;
  source: string;
  cycle: string;
  totalRecords: number;
  michiganRecords: number;
  totalAmount: number;
}

/**
 * Root data structure for committee contributions
 */
export interface CommitteeContributionData {
  metadata: CommitteeContributionMetadata;
  byCandidateId: Record<string, CandidateAggregate>;
  byCommitteeId: Record<string, CommitteeAggregate>;
  byRace: Record<string, RaceAggregate>;
  michiganRecords: CommitteeContributionRecord[];
}

/**
 * Helper type for filtering candidates by office
 */
export type CandidatesByOffice = {
  house: CandidateAggregate[];
  senate: CandidateAggregate[];
  president: CandidateAggregate[];
};

/**
 * Helper type for filtering committees by party
 */
export type CommitteesByParty = {
  democratic: CommitteeAggregate[];
  republican: CommitteeAggregate[];
  other: CommitteeAggregate[];
  unknown: CommitteeAggregate[];
};

/**
 * Helper type for filtering committees by type
 */
export type CommitteesByType = {
  pac: CommitteeAggregate[];
  party: CommitteeAggregate[];
  leadership: CommitteeAggregate[];
  other: CommitteeAggregate[];
};

/**
 * Committee info lookup
 */
export interface CommitteeInfo {
  id: string;
  name: string;
  party: CommitteeParty;
  type: CommitteeType;
}

/**
 * Candidate info from ID
 */
export interface CandidateInfo {
  office: CandidateOffice;
  state: string;
  district?: string;
}
