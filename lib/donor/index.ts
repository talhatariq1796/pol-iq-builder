/**
 * Donor Management Module - Public API
 *
 * Exports:
 * - FECClient: Federal Election Commission data client
 * - DonorAggregator: Aggregates donor data from multiple sources
 * - ProspectFinder: Identifies high-value donor prospects
 * - ProspectScorer: Real prospect scoring algorithm
 * - LapsedDonorAnalyzer: Identifies and scores lapsed donors for recovery
 * - DonorClusterAnalyzer: Geographic clustering for efficient outreach
 * - RecoveryScorer: Advanced recovery potential scoring
 * - DonorStore: Persistent storage for donor records
 * - RFM_SEGMENTS: RFM segmentation constants
 * - INGHAM_COUNTY_ZIPS: Ingham County zip code definitions
 */

// FEC Data Client
export { FECClient } from './FECClient';

// Core Services
export { DonorAggregator } from './DonorAggregator';
export { ProspectFinder } from './ProspectFinder';
export { ProspectScorer } from './ProspectScorer';

// Lapsed Donor Recovery
export { LapsedDonorAnalyzer } from './LapsedDonorAnalyzer';
export { DonorClusterAnalyzer } from './DonorClusterAnalyzer';
export { RecoveryScorer } from './RecoveryScorer';

// Candidate Registry & Comparison
export { CandidateRegistry, candidateRegistry } from './CandidateRegistry';
export { RecipientFilter, recipientFilter } from './RecipientFilter';
export { ComparisonEngine, comparisonEngine } from './ComparisonEngine';

// Committee Lookup
export { CommitteeLookup, CommitteeLookupService } from './CommitteeLookup';

// Storage
export { DonorStore, donorStore } from './DonorStore';

// Types and Constants
export * from './types';
export * from './types-committee';
export * from './constants';
