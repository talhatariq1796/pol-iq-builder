/**
 * FEC API Client
 *
 * Fetches campaign finance data from the Federal Election Commission API.
 * Supports individual contributions, committee details, and candidate information.
 *
 * API Documentation: https://api.open.fec.gov/developers/
 * Rate Limit: 1000 requests/hour (free tier)
 */

import { Contribution } from './types';

const FEC_API_BASE = 'https://api.open.fec.gov/v1';

const INGHAM_COUNTY_ZIPS = [
  '48821', '48823', '48824', '48825', '48826', '48837', '48840',
  '48842', '48854', '48864', '48895', '48906', '48910', '48911',
  '48912', '48915', '48917', '48921', '48922', '48924', '48929',
  '48930', '48933', '48937', '48951', '48956',
];

export interface FECQueryOptions {
  state?: string;
  zipCodes?: string[];
  minDate?: string;
  maxDate?: string;
  minAmount?: number;
  maxAmount?: number;
  perPage?: number;
  page?: number;
}

interface FECContribution {
  committee_id: string;
  committee_name: string;
  contributor_name: string;
  contributor_city: string;
  contributor_state: string;
  contributor_zip: string;
  contributor_employer: string;
  contributor_occupation: string;
  contribution_receipt_amount: number;
  contribution_receipt_date: string;
  candidate_id?: string;
  candidate_name?: string;
  memo_text?: string;
  entity_type: string;
}

interface FECCommittee {
  committee_id: string;
  name: string;
  party?: string;
  committee_type?: string;
  designation?: string;
  candidate_ids?: string[];
}

interface FECResponse<T> {
  results: T[];
  pagination: {
    page: number;
    per_page: number;
    count: number;
    pages: number;
  };
}

/**
 * FEC API Client
 *
 * Handles communication with the FEC API, including:
 * - Individual contribution queries
 * - Committee lookups with caching
 * - Party affiliation enrichment
 * - Rate limiting protection
 */
export class FECClient {
  private apiKey: string;
  private committeeCache: Map<string, FECCommittee> = new Map();
  private requestCount = 0;
  private requestResetTime = Date.now() + 3600000; // 1 hour from now
  private readonly MAX_REQUESTS_PER_HOUR = 1000;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FEC_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('FEC_API_KEY is required');
    }
  }

  /**
   * Check and enforce rate limiting
   */
  private checkRateLimit(): void {
    const now = Date.now();

    // Reset counter if hour has passed
    if (now >= this.requestResetTime) {
      this.requestCount = 0;
      this.requestResetTime = now + 3600000;
    }

    // Check if we've hit the limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_HOUR) {
      const minutesUntilReset = Math.ceil((this.requestResetTime - now) / 60000);
      throw new Error(
        `FEC API rate limit reached. Resets in ${minutesUntilReset} minutes.`
      );
    }

    this.requestCount++;
  }

  /**
   * Make a request to the FEC API
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<FECResponse<T>> {
    this.checkRateLimit();

    const url = new URL(`${FEC_API_BASE}${endpoint}`);
    url.searchParams.append('api_key', this.apiKey);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `FEC API request failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Convert FEC date format (MMDDYYYY or YYYY-MM-DD) to ISO format
   */
  private convertFECDate(fecDate: string): string {
    // If already in ISO format
    if (fecDate.includes('-')) {
      return fecDate;
    }

    // Parse MMDDYYYY format
    const month = fecDate.substring(0, 2);
    const day = fecDate.substring(2, 4);
    const year = fecDate.substring(4, 8);

    return `${year}-${month}-${day}`;
  }

  /**
   * Fetch committee details by ID
   * Uses caching to avoid repeated API calls
   */
  async fetchCommittee(committeeId: string): Promise<FECCommittee | null> {
    // Check cache first
    if (this.committeeCache.has(committeeId)) {
      return this.committeeCache.get(committeeId)!;
    }

    try {
      const response = await this.request<FECCommittee>(
        `/committee/${committeeId}/`
      );

      if (response.results.length === 0) {
        return null;
      }

      const committee = response.results[0];
      this.committeeCache.set(committeeId, committee);
      return committee;
    } catch (error) {
      console.error(`Failed to fetch committee ${committeeId}:`, error);
      return null;
    }
  }

  /**
   * Fetch individual contributions with filtering options
   */
  async fetchContributions(
    options: FECQueryOptions = {}
  ): Promise<FECResponse<FECContribution>> {
    const params: Record<string, string | number | undefined> = {
      per_page: options.perPage || 100,
      page: options.page || 1,
    };

    // State filter
    if (options.state) {
      params.contributor_state = options.state;
    }

    // ZIP code filter (FEC accepts comma-separated list)
    if (options.zipCodes && options.zipCodes.length > 0) {
      params.contributor_zip = options.zipCodes.join(',');
    }

    // Date range filters
    if (options.minDate) {
      params.min_date = options.minDate;
    }
    if (options.maxDate) {
      params.max_date = options.maxDate;
    }

    // Amount range filters
    if (options.minAmount !== undefined) {
      params.min_amount = options.minAmount;
    }
    if (options.maxAmount !== undefined) {
      params.max_amount = options.maxAmount;
    }

    return this.request<FECContribution>('/schedules/schedule_a/', params);
  }

  /**
   * Fetch contributions for Ingham County
   */
  async fetchInghamCountyContributions(
    options: Omit<FECQueryOptions, 'state' | 'zipCodes'> = {}
  ): Promise<FECResponse<FECContribution>> {
    return this.fetchContributions({
      ...options,
      state: 'MI',
      zipCodes: INGHAM_COUNTY_ZIPS,
    });
  }

  /**
   * Convert FEC contribution to our internal Contribution type
   */
  private async convertContribution(
    fecContribution: FECContribution
  ): Promise<Contribution> {
    // Fetch committee details for party affiliation
    const committee = await this.fetchCommittee(fecContribution.committee_id);

    // Map committee party to our party codes
    let party: Contribution['party'];
    if (committee?.party === 'DEM' || committee?.party === 'Democratic') {
      party = 'DEM';
    } else if (committee?.party === 'REP' || committee?.party === 'Republican') {
      party = 'REP';
    } else {
      party = 'other';
    }

    return {
      id: `fec-${fecContribution.committee_id}-${Date.now()}`,
      source: 'fec',
      contributorName: fecContribution.contributor_name,
      city: fecContribution.contributor_city,
      state: fecContribution.contributor_state,
      zipCode: fecContribution.contributor_zip.substring(0, 5),
      employer: fecContribution.contributor_employer,
      occupation: fecContribution.contributor_occupation,
      committeeId: fecContribution.committee_id,
      committeeName: fecContribution.committee_name,
      candidateId: fecContribution.candidate_id,
      candidateName: fecContribution.candidate_name,
      party,
      amount: fecContribution.contribution_receipt_amount,
      date: this.convertFECDate(fecContribution.contribution_receipt_date),
      transactionType: 'individual',
      electionCycle: this.getElectionCycle(fecContribution.contribution_receipt_date),
    };
  }

  /**
   * Get election cycle from date
   */
  private getElectionCycle(dateStr: string): string {
    const date = this.convertFECDate(dateStr);
    const year = parseInt(date.substring(0, 4));
    // Election cycles are even years, contributions in odd years belong to next even year
    return (year % 2 === 0 ? year : year + 1).toString();
  }

  /**
   * Enrich FEC contributions with party affiliation based on committee lookup
   */
  async enrichWithParty(
    fecContributions: FECContribution[]
  ): Promise<Contribution[]> {
    const contributions: Contribution[] = [];

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < fecContributions.length; i += batchSize) {
      const batch = fecContributions.slice(i, i + batchSize);
      const enrichedBatch = await Promise.all(
        batch.map(contrib => this.convertContribution(contrib))
      );
      contributions.push(...enrichedBatch);

      // Small delay between batches to be respectful of rate limits
      if (i + batchSize < fecContributions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return contributions;
  }

  /**
   * Fetch all contributions with automatic pagination
   */
  async fetchAllContributions(
    options: FECQueryOptions = {},
    maxPages?: number
  ): Promise<Contribution[]> {
    const allContributions: Contribution[] = [];
    let page = options.page || 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetchContributions({
        ...options,
        page,
      });

      // Convert and enrich contributions
      const enriched = await this.enrichWithParty(response.results);
      allContributions.push(...enriched);

      // Check if there are more pages
      hasMore = page < response.pagination.pages;

      // Stop if we've hit the max pages limit
      if (maxPages && page >= maxPages) {
        hasMore = false;
      }

      page++;

      // Log progress
      console.log(
        `Fetched page ${page - 1}/${response.pagination.pages} ` +
        `(${allContributions.length} contributions)`
      );
    }

    return allContributions;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    requestsUsed: number;
    requestsRemaining: number;
    resetsIn: number;
  } {
    const now = Date.now();
    const resetsIn = Math.max(0, this.requestResetTime - now);

    return {
      requestsUsed: this.requestCount,
      requestsRemaining: Math.max(0, this.MAX_REQUESTS_PER_HOUR - this.requestCount),
      resetsIn,
    };
  }

  /**
   * Clear the committee cache
   */
  clearCache(): void {
    this.committeeCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    committees: string[];
  } {
    return {
      size: this.committeeCache.size,
      committees: Array.from(this.committeeCache.keys()),
    };
  }
}

/**
 * Create a singleton instance of the FEC client
 */
let fecClientInstance: FECClient | null = null;

export function getFECClient(): FECClient {
  if (!fecClientInstance) {
    fecClientInstance = new FECClient();
  }
  return fecClientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetFECClient(): void {
  fecClientInstance = null;
}
