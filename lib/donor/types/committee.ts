/**
 * FEC Committee Types
 *
 * Type definitions for FEC committee data processed from the Committee Master file.
 * See scripts/donor-ingestion/process-committee-master.ts for processing logic.
 */

export type PartyAffiliation = 'DEM' | 'REP' | 'OTHER' | 'UNKNOWN';

/**
 * Committee Type Codes
 * See: https://www.fec.gov/campaign-finance-data/committee-type-code-descriptions/
 */
export type CommitteeTypeCode =
  | 'C'  // Communication Cost
  | 'D'  // Delegate Committee
  | 'E'  // Electioneering Communication
  | 'H'  // House
  | 'I'  // Independent Expenditure (Super PAC)
  | 'N'  // PAC - Nonqualified
  | 'O'  // Independent Expenditure-Only (Super PAC)
  | 'P'  // Presidential
  | 'Q'  // PAC - Qualified
  | 'S'  // Senate
  | 'U'  // Single Candidate Independent Expenditure
  | 'V'  // PAC with Non-Contribution Account - Nonqualified
  | 'W'  // PAC with Non-Contribution Account - Qualified
  | 'X'  // Party - Nonqualified
  | 'Y'  // Party - Qualified
  | 'Z'; // National Party Nonfederal Account

/**
 * Committee Designation Codes
 */
export type CommitteeDesignationCode =
  | 'A'  // Authorized by a candidate
  | 'J'  // Joint fundraiser
  | 'P'  // Principal campaign committee
  | 'U'  // Unauthorized
  | 'B'  // Lobbyist/Registrant PAC
  | 'D'; // Leadership PAC

/**
 * FEC Committee Record
 */
export interface CommitteeRecord {
  /** Committee ID (e.g., C00000059) */
  id: string;

  /** Committee name */
  name: string;

  /** Party affiliation */
  party: PartyAffiliation;

  /** Committee type code */
  type: CommitteeTypeCode | string;

  /** Human-readable committee type description */
  typeDescription: string;

  /** Committee designation code */
  designation: CommitteeDesignationCode | string;

  /** Human-readable designation description */
  designationDescription: string;

  /** Candidate ID (if authorized committee) */
  candidateId?: string;

  /** Connected organization name */
  connectedOrg?: string;

  /** State code */
  state?: string;
}

/**
 * Committee Data File Structure
 */
export interface CommitteeData {
  metadata: {
    /** ISO timestamp of when file was processed */
    processedAt: string;

    /** Data source description */
    source: string;

    /** Total number of committees */
    totalCommittees: number;

    /** Breakdown by party affiliation */
    byParty: {
      DEM: number;
      REP: number;
      OTHER: number;
      UNKNOWN: number;
    };

    /** Breakdown by committee type */
    byType: Record<string, number>;
  };

  /** Committee lookup map: committee_id → committee record */
  committees: Record<string, CommitteeRecord>;
}

/**
 * Helper function to check if a committee is a party committee
 */
export function isPartyCommittee(committee: CommitteeRecord): boolean {
  return committee.type === 'Y' || committee.type === 'X' || committee.type === 'Z';
}

/**
 * Helper function to check if a committee is a Super PAC
 */
export function isSuperPAC(committee: CommitteeRecord): boolean {
  return committee.type === 'O' || committee.type === 'I';
}

/**
 * Helper function to check if a committee is a candidate committee
 */
export function isCandidateCommittee(committee: CommitteeRecord): boolean {
  return committee.type === 'H' || committee.type === 'S' || committee.type === 'P';
}

/**
 * Helper function to check if a committee is a PAC
 */
export function isPAC(committee: CommitteeRecord): boolean {
  return (
    committee.type === 'Q' ||
    committee.type === 'N' ||
    committee.type === 'V' ||
    committee.type === 'W'
  );
}
