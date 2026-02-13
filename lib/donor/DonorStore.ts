/**
 * DonorStore: In-memory storage for processed donor data
 *
 * Features:
 * - In-memory storage for fast access
 * - Optional file persistence to public/data/donors/
 * - Filtering and query capabilities
 * - Summary statistics generation
 * - Singleton pattern for global access
 */

import fs from 'fs';
import path from 'path';
import type {
  Contribution,
  ZIPAggregate,
  DonorProfile,
  ProspectArea,
  ProspectOptions,
} from './types';

/**
 * Filter options for querying ZIP aggregates
 */
export interface ZIPAggregateFilters {
  state?: string;
  minAmount?: number;
  maxAmount?: number;
  minDonors?: number;
  party?: 'DEM' | 'REP' | 'all';
  zipCodes?: string[];
}

/**
 * Summary statistics for all donor data
 */
export interface DonorSummaryStats {
  total_contributions: number;
  total_amount: number;
  avg_contribution: number;
  median_contribution: number;
  unique_contributors: number;
  unique_zip_codes: number;
  date_range: {
    earliest: string;
    latest: string;
  };
  top_zip_codes: Array<{
    zip_code: string;
    total_amount: number;
    contributor_count: number;
  }>;
  party_breakdown: {
    dem_amount: number;
    rep_amount: number;
    other_amount: number;
    dem_percentage: number;
    rep_percentage: number;
  };
  contribution_distribution: {
    under_100: number;
    between_100_500: number;
    between_500_1000: number;
    between_1000_2500: number;
    over_2500: number;
  };
}

/**
 * DonorStore class for managing donor data
 */
export class DonorStore {
  private contributions: Contribution[] = [];
  private zipAggregates: Map<string, ZIPAggregate> = new Map();
  private donorProfiles: Map<string, DonorProfile> = new Map();
  private prospectAreas: Map<string, ProspectArea> = new Map();

  // File paths for persistence
  private readonly DATA_DIR = path.join(process.cwd(), 'public/data/donors');
  private readonly CONTRIBUTIONS_FILE = path.join(this.DATA_DIR, 'contributions.json');
  private readonly ZIP_AGGREGATES_FILE = path.join(this.DATA_DIR, 'zip_aggregates.json');
  private readonly DONOR_PROFILES_FILE = path.join(this.DATA_DIR, 'donor_profiles.json');
  private readonly PROSPECT_AREAS_FILE = path.join(this.DATA_DIR, 'prospect_areas.json');

  constructor() {
    // Ensure data directory exists
    this.ensureDataDirectory();
  }

  /**
   * Ensure the data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
    }
  }

  // ============================================================================
  // CONTRIBUTIONS
  // ============================================================================

  /**
   * Store raw contributions
   */
  setContributions(contributions: Contribution[]): void {
    this.contributions = contributions;
  }

  /**
   * Get all contributions
   */
  getContributions(): Contribution[] {
    return this.contributions;
  }

  /**
   * Get contributions count
   */
  getContributionsCount(): number {
    return this.contributions.length;
  }

  // ============================================================================
  // ZIP AGGREGATES
  // ============================================================================

  /**
   * Store ZIP code aggregates
   */
  setZIPAggregates(aggregates: ZIPAggregate[]): void {
    this.zipAggregates.clear();
    for (const agg of aggregates) {
      this.zipAggregates.set(agg.zipCode, agg);
    }
  }

  /**
   * Get all ZIP aggregates, optionally filtered
   */
  getZIPAggregates(filters?: ZIPAggregateFilters): ZIPAggregate[] {
    let results = Array.from(this.zipAggregates.values());

    if (!filters) {
      return results;
    }

    // Apply filters
    if (filters.state) {
      results = results.filter(agg => agg.state === filters.state);
    }

    if (filters.minAmount !== undefined) {
      results = results.filter(agg => agg.totalAmount >= filters.minAmount!);
    }

    if (filters.maxAmount !== undefined) {
      results = results.filter(agg => agg.totalAmount <= filters.maxAmount!);
    }

    if (filters.minDonors !== undefined) {
      results = results.filter(agg => agg.donorCount >= filters.minDonors!);
    }

    if (filters.party) {
      if (filters.party === 'DEM') {
        results = results.filter(agg => agg.demAmount > agg.repAmount);
      } else if (filters.party === 'REP') {
        results = results.filter(agg => agg.repAmount > agg.demAmount);
      }
    }

    if (filters.zipCodes && filters.zipCodes.length > 0) {
      const zipSet = new Set(filters.zipCodes);
      results = results.filter(agg => zipSet.has(agg.zipCode));
    }

    return results;
  }

  /**
   * Get a single ZIP code aggregate
   */
  getZIPAggregate(zipCode: string): ZIPAggregate | undefined {
    return this.zipAggregates.get(zipCode);
  }

  /**
   * Get ZIP aggregates count
   */
  getZIPAggregatesCount(): number {
    return this.zipAggregates.size;
  }

  // ============================================================================
  // DONOR PROFILES
  // ============================================================================

  /**
   * Store donor profiles
   */
  setDonorProfiles(profiles: DonorProfile[]): void {
    this.donorProfiles.clear();
    for (const profile of profiles) {
      this.donorProfiles.set(profile.donorId, profile);
    }
  }

  /**
   * Get all donor profiles
   */
  getDonorProfiles(): DonorProfile[] {
    return Array.from(this.donorProfiles.values());
  }

  /**
   * Get donors by segment
   */
  getDonorsBySegment(segment: DonorProfile['segment']): DonorProfile[] {
    return Array.from(this.donorProfiles.values()).filter(
      profile => profile.segment === segment
    );
  }

  /**
   * Get a single donor profile
   */
  getDonorProfile(donorId: string): DonorProfile | undefined {
    return this.donorProfiles.get(donorId);
  }

  /**
   * Get donor profiles count
   */
  getDonorProfilesCount(): number {
    return this.donorProfiles.size;
  }

  // ============================================================================
  // PROSPECT AREAS
  // ============================================================================

  /**
   * Store prospect areas
   */
  setProspectAreas(prospects: ProspectArea[]): void {
    this.prospectAreas.clear();
    for (const prospect of prospects) {
      this.prospectAreas.set(prospect.zipCode, prospect);
    }
  }

  /**
   * Get all prospect areas
   */
  getProspectAreas(): ProspectArea[] {
    return Array.from(this.prospectAreas.values());
  }

  /**
   * Get top prospect areas by score
   */
  getTopProspects(limit: number = 10): ProspectArea[] {
    return Array.from(this.prospectAreas.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ============================================================================
  // SUMMARY STATISTICS
  // ============================================================================

  /**
   * Get overall summary statistics
   */
  getSummaryStats(): DonorSummaryStats {
    const contributions = this.contributions;
    const zipAggregates = Array.from(this.zipAggregates.values());

    if (contributions.length === 0) {
      return this.getEmptyStats();
    }

    // Calculate totals
    const totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);
    const amounts = contributions.map(c => c.amount).sort((a, b) => a - b);
    const medianAmount = this.calculateMedian(amounts);

    // Date range
    const dates = contributions.map(c => c.date).filter(Boolean);
    const earliest = dates.length > 0 ? dates.reduce((min, d) => d < min ? d : min) : '';
    const latest = dates.length > 0 ? dates.reduce((max, d) => d > max ? d : max) : '';

    // Unique contributors (using donorProfiles if available)
    const uniqueContributors = this.donorProfiles.size > 0
      ? this.donorProfiles.size
      : new Set(contributions.map(c => `${c.contributorName}|${c.zipCode}`)).size;

    // Top ZIP codes
    const topZipCodes = zipAggregates
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)
      .map(agg => ({
        zip_code: agg.zipCode,
        total_amount: agg.totalAmount,
        contributor_count: agg.donorCount,
      }));

    // Party breakdown
    const demAmount = contributions
      .filter(c => c.party === 'DEM')
      .reduce((sum, c) => sum + c.amount, 0);
    const repAmount = contributions
      .filter(c => c.party === 'REP')
      .reduce((sum, c) => sum + c.amount, 0);
    const otherAmount = totalAmount - demAmount - repAmount;

    // Contribution distribution
    const distribution = {
      under_100: contributions.filter(c => c.amount < 100).length,
      between_100_500: contributions.filter(c => c.amount >= 100 && c.amount < 500).length,
      between_500_1000: contributions.filter(c => c.amount >= 500 && c.amount < 1000).length,
      between_1000_2500: contributions.filter(c => c.amount >= 1000 && c.amount < 2500).length,
      over_2500: contributions.filter(c => c.amount >= 2500).length,
    };

    return {
      total_contributions: contributions.length,
      total_amount: totalAmount,
      avg_contribution: totalAmount / contributions.length,
      median_contribution: medianAmount,
      unique_contributors: uniqueContributors,
      unique_zip_codes: this.zipAggregates.size,
      date_range: {
        earliest,
        latest,
      },
      top_zip_codes: topZipCodes,
      party_breakdown: {
        dem_amount: demAmount,
        rep_amount: repAmount,
        other_amount: otherAmount,
        dem_percentage: (demAmount / totalAmount) * 100,
        rep_percentage: (repAmount / totalAmount) * 100,
      },
      contribution_distribution: distribution,
    };
  }

  /**
   * Get empty stats (when no data)
   */
  private getEmptyStats(): DonorSummaryStats {
    return {
      total_contributions: 0,
      total_amount: 0,
      avg_contribution: 0,
      median_contribution: 0,
      unique_contributors: 0,
      unique_zip_codes: 0,
      date_range: {
        earliest: '',
        latest: '',
      },
      top_zip_codes: [],
      party_breakdown: {
        dem_amount: 0,
        rep_amount: 0,
        other_amount: 0,
        dem_percentage: 0,
        rep_percentage: 0,
      },
      contribution_distribution: {
        under_100: 0,
        between_100_500: 0,
        between_500_1000: 0,
        between_1000_2500: 0,
        over_2500: 0,
      },
    };
  }

  /**
   * Calculate median from sorted array
   */
  private calculateMedian(sortedArray: number[]): number {
    if (sortedArray.length === 0) return 0;
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }

  // ============================================================================
  // FILE PERSISTENCE
  // ============================================================================

  /**
   * Save all data to JSON files
   */
  async saveToFile(): Promise<void> {
    this.ensureDataDirectory();

    // Save contributions
    if (this.contributions.length > 0) {
      await fs.promises.writeFile(
        this.CONTRIBUTIONS_FILE,
        JSON.stringify(this.contributions, null, 2),
        'utf-8'
      );
    }

    // Save ZIP aggregates
    if (this.zipAggregates.size > 0) {
      const zipArray = Array.from(this.zipAggregates.values());
      await fs.promises.writeFile(
        this.ZIP_AGGREGATES_FILE,
        JSON.stringify(zipArray, null, 2),
        'utf-8'
      );
    }

    // Save donor profiles
    if (this.donorProfiles.size > 0) {
      const profilesArray = Array.from(this.donorProfiles.values());
      await fs.promises.writeFile(
        this.DONOR_PROFILES_FILE,
        JSON.stringify(profilesArray, null, 2),
        'utf-8'
      );
    }

    // Save prospect areas
    if (this.prospectAreas.size > 0) {
      const prospectsArray = Array.from(this.prospectAreas.values());
      await fs.promises.writeFile(
        this.PROSPECT_AREAS_FILE,
        JSON.stringify(prospectsArray, null, 2),
        'utf-8'
      );
    }
  }

  /**
   * Load all data from JSON files
   */
  async loadFromFile(): Promise<void> {
    // Load contributions
    if (fs.existsSync(this.CONTRIBUTIONS_FILE)) {
      const data = await fs.promises.readFile(this.CONTRIBUTIONS_FILE, 'utf-8');
      this.contributions = JSON.parse(data);
    }

    // Load ZIP aggregates
    if (fs.existsSync(this.ZIP_AGGREGATES_FILE)) {
      const data = await fs.promises.readFile(this.ZIP_AGGREGATES_FILE, 'utf-8');
      const aggregates: ZIPAggregate[] = JSON.parse(data);
      this.setZIPAggregates(aggregates);
    }

    // Load donor profiles
    if (fs.existsSync(this.DONOR_PROFILES_FILE)) {
      const data = await fs.promises.readFile(this.DONOR_PROFILES_FILE, 'utf-8');
      const profiles: DonorProfile[] = JSON.parse(data);
      this.setDonorProfiles(profiles);
    }

    // Load prospect areas
    if (fs.existsSync(this.PROSPECT_AREAS_FILE)) {
      const data = await fs.promises.readFile(this.PROSPECT_AREAS_FILE, 'utf-8');
      const prospects: ProspectArea[] = JSON.parse(data);
      this.setProspectAreas(prospects);
    }
  }

  /**
   * Check if persisted data exists
   */
  hasPersistedData(): boolean {
    return (
      fs.existsSync(this.CONTRIBUTIONS_FILE) ||
      fs.existsSync(this.ZIP_AGGREGATES_FILE) ||
      fs.existsSync(this.DONOR_PROFILES_FILE)
    );
  }

  /**
   * Clear all data (in-memory only)
   */
  clear(): void {
    this.contributions = [];
    this.zipAggregates.clear();
    this.donorProfiles.clear();
    this.prospectAreas.clear();
  }

  /**
   * Delete all persisted files
   */
  async deletePersistedData(): Promise<void> {
    const files = [
      this.CONTRIBUTIONS_FILE,
      this.ZIP_AGGREGATES_FILE,
      this.DONOR_PROFILES_FILE,
      this.PROSPECT_AREAS_FILE,
    ];

    for (const file of files) {
      if (fs.existsSync(file)) {
        await fs.promises.unlink(file);
      }
    }
  }
}

/**
 * Singleton instance for global access
 */
export const donorStore = new DonorStore();
