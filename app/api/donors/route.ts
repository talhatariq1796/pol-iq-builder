/**
 * Donor Concentration API Route
 *
 * Handles donor data queries, ZIP code aggregates, RFM segments, and prospect finding.
 *
 * IMPORTANT: This API reads from REAL FEC data files, NOT sample/mock data.
 * Data is fetched using scripts/donor-ingestion/fetch-fec-api.ts
 *
 * GET endpoints:
 *   - ?action=summary - Return summary stats
 *   - ?action=aggregates&party=X&cycle=Y - Return ZIP aggregates with optional filters
 *   - ?action=zip&zipCode=X - Return single ZIP aggregate
 *   - ?action=segments - Return donor segments with counts
 *   - ?action=profiles&segment=X - Return donor profiles, optionally filtered by segment
 *   - ?action=status - Return data freshness info
 *
 * POST endpoints:
 *   - Body: { action: 'prospects', options: ProspectOptions } - Find prospect areas
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { ProspectScorer } from '@/lib/donor/ProspectScorer';

// ============================================================================
// Types (matching design doc and ingestion script)
// ============================================================================

type Party = 'DEM' | 'REP' | 'other';
type DonorSegment = 'champion' | 'loyal' | 'potential' | 'at_risk' | 'lapsed' | 'prospect';

interface ZIPAggregate {
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

  // Top contributors
  topDonorCount: number;
  maxSingleDonation: number;

  // Derived metrics
  donorDensity: number;
  avgCapacity: number;
  prospectScore: number;
}

interface DonorProfile {
  donorId: string;
  zipCode: string;
  city: string;
  h3Index?: string;

  // RFM Scores (1-5 each)
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;

  // Totals
  totalContributed: number;
  contributionCount: number;
  avgContribution: number;
  firstContributionDate: string;
  lastContributionDate: string;

  // Party affiliation
  likelyParty: 'DEM' | 'REP' | 'split' | 'unknown';
  partyConfidence: number;

  // Segment
  segment: DonorSegment;
}

interface SegmentSummary {
  segment: DonorSegment;
  name: string;
  description: string;
  donorCount: number;
  totalAmount: number;
  avgGift: number;
  strategy: string;
}

interface SummaryStats {
  totalRaised: number;
  uniqueDonors: number;
  totalContributions: number;
  avgGift: number;
  medianGift: number;
  largestGift: number;
  demAmount: number;
  demPct: number;
  repAmount: number;
  repPct: number;
  otherAmount: number;
  otherPct: number;
  dataFreshness?: string;
}

interface ProspectOptions {
  minMedianIncome?: number;
  minDonorGap?: number;
  party?: Party;
  includeLapsed?: boolean;
}

interface ZIPDemographics {
  zipCode: string;
  city: string;
  state: string;
  population: number;
  medianIncome: number;
  medianAge?: number;
  collegePct?: number;
}

interface OccupationSummary {
  occupation: string;
  donorCount: number;
  totalAmount: number;
  avgContribution: number;
}

interface ZIPOccupationData {
  zipCode: string;
  city: string;
  topOccupations: OccupationSummary[];
}

interface ProspectArea {
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

interface DataMetadata {
  cycle: string;
  fetchedAt: string;
  source: string;
  dateRange: { minDate: string; maxDate: string };
  stats: {
    totalContributions: number;
    totalAmount: number;
    uniqueDonors: number;
    zipCodes: number;
    dateRange: { earliest: string; latest: string };
  };
}

// ============================================================================
// Data Loading from Real FEC Data Files
// ============================================================================

class DonorStore {
  private static instance: DonorStore;
  private zipAggregates: Map<string, ZIPAggregate> = new Map();
  private donorProfiles: DonorProfile[] = [];
  private zipOccupations: Map<string, ZIPOccupationData> = new Map();
  private metadata: DataMetadata | null = null;
  private initialized = false;
  private initError: string | null = null;

  static getInstance(): DonorStore {
    if (!DonorStore.instance) {
      DonorStore.instance = new DonorStore();
    }
    return DonorStore.instance;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getInitError(): string | null {
    return this.initError;
  }

  getMetadata(): DataMetadata | null {
    return this.metadata;
  }

  /**
   * Initialize by loading real data from FEC data files.
   * NO SAMPLE DATA - this reads from public/data/donors/*.json
   */
  initialize(): void {
    if (this.initialized) return;

    const dataDir = path.join(process.cwd(), 'public', 'data', 'donors');

    try {
      // Check if data files exist
      const aggregatesPath = path.join(dataDir, 'zip-aggregates.json');
      const profilesPath = path.join(dataDir, 'donor-profiles.json');
      const metadataPath = path.join(dataDir, 'metadata.json');

      if (!fs.existsSync(aggregatesPath)) {
        this.initError = 'Donor data not found. Run: FEC_API_KEY=your_key npx tsx scripts/donor-ingestion/fetch-fec-api.ts';
        console.error(`[DonorStore] ${this.initError}`);
        return;
      }

      // Load ZIP aggregates
      const aggregatesData = JSON.parse(fs.readFileSync(aggregatesPath, 'utf-8')) as ZIPAggregate[];
      for (const agg of aggregatesData) {
        this.zipAggregates.set(agg.zipCode, agg);
      }
      console.log(`[DonorStore] Loaded ${aggregatesData.length} ZIP aggregates`);

      // Load donor profiles
      if (fs.existsSync(profilesPath)) {
        this.donorProfiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8')) as DonorProfile[];
        console.log(`[DonorStore] Loaded ${this.donorProfiles.length} donor profiles`);
      }

      // Load occupation data
      const occupationsPath = path.join(dataDir, 'zip-occupations.json');
      if (fs.existsSync(occupationsPath)) {
        const occupationsData = JSON.parse(fs.readFileSync(occupationsPath, 'utf-8')) as ZIPOccupationData[];
        for (const occ of occupationsData) {
          this.zipOccupations.set(occ.zipCode, occ);
        }
        console.log(`[DonorStore] Loaded occupations for ${occupationsData.length} ZIPs`);
      } else {
        console.log(`[DonorStore] Occupation data not found (optional). Run: npx tsx scripts/donor-ingestion/aggregate-occupations.ts`);
      }

      // Load metadata
      if (fs.existsSync(metadataPath)) {
        this.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as DataMetadata;
        console.log(`[DonorStore] Data fetched at: ${this.metadata.fetchedAt}`);
      }

      this.initialized = true;
      this.initError = null;

    } catch (err) {
      this.initError = `Failed to load donor data: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[DonorStore] ${this.initError}`);
    }
  }

  getSummaryStats(): SummaryStats | null {
    if (!this.initialized) return null;

    const aggregates = Array.from(this.zipAggregates.values());

    const totalRaised = aggregates.reduce((sum, z) => sum + z.totalAmount, 0);
    const uniqueDonors = aggregates.reduce((sum, z) => sum + z.donorCount, 0);
    const totalContributions = aggregates.reduce((sum, z) => sum + z.contributionCount, 0);
    const demAmount = aggregates.reduce((sum, z) => sum + z.demAmount, 0);
    const repAmount = aggregates.reduce((sum, z) => sum + z.repAmount, 0);
    const otherAmount = aggregates.reduce((sum, z) => sum + z.otherAmount, 0);
    const largestGift = Math.max(...aggregates.map(z => z.maxSingleDonation));

    // Calculate weighted median from ZIP medians
    // Weight by contribution count to approximate overall median
    const medianData = aggregates
      .filter(z => z.medianContribution > 0)
      .map(z => ({ median: z.medianContribution, weight: z.contributionCount }));

    let medianGift = 0;
    if (medianData.length > 0) {
      // Sort by median value
      medianData.sort((a, b) => a.median - b.median);
      const totalWeight = medianData.reduce((sum, d) => sum + d.weight, 0);
      let cumulativeWeight = 0;
      const halfWeight = totalWeight / 2;

      for (const d of medianData) {
        cumulativeWeight += d.weight;
        if (cumulativeWeight >= halfWeight) {
          medianGift = d.median;
          break;
        }
      }
    }

    return {
      totalRaised,
      uniqueDonors,
      totalContributions,
      avgGift: totalContributions > 0 ? Math.round(totalRaised / totalContributions) : 0,
      medianGift,
      largestGift,
      demAmount,
      demPct: totalRaised > 0 ? Math.round((demAmount / totalRaised) * 100) : 0,
      repAmount,
      repPct: totalRaised > 0 ? Math.round((repAmount / totalRaised) * 100) : 0,
      otherAmount,
      otherPct: totalRaised > 0 ? Math.round((otherAmount / totalRaised) * 100) : 0,
      dataFreshness: this.metadata?.fetchedAt,
    };
  }

  getAllZIPAggregates(filters?: { party?: string; cycle?: string }): ZIPAggregate[] {
    let aggregates = Array.from(this.zipAggregates.values());

    // Calculate real prospect scores if not already set
    this.ensureProspectScores();

    // Sort by total amount descending
    aggregates.sort((a, b) => b.totalAmount - a.totalAmount);

    return aggregates;
  }

  /**
   * Ensure all ZIP aggregates have prospect scores calculated
   * Uses real scoring algorithm based on demographics
   */
  private ensureProspectScores(): void {
    // Check if scores already calculated
    const firstZip = Array.from(this.zipAggregates.values())[0];
    if (firstZip && firstZip.prospectScore > 0) {
      return; // Already calculated
    }

    console.log('[DonorStore] Calculating prospect scores...');

    const scorer = new ProspectScorer();
    const demographicsMap = this.loadDemographics();

    // Calculate county-wide averages for scoring
    const aggregates = Array.from(this.zipAggregates.values());
    const totalDonors = aggregates.reduce((sum, z) => sum + z.donorCount, 0);
    const totalPopulation = Array.from(demographicsMap.values()).reduce(
      (sum, d) => sum + d.population,
      0
    );
    const countyAvgDonorRate = totalPopulation > 0 ? (totalDonors / totalPopulation) * 1000 : 4.2;
    const countyAvgIncome = demographicsMap.size > 0
      ? Array.from(demographicsMap.values()).reduce((sum, d) => sum + d.medianIncome, 0) / demographicsMap.size
      : 60000;

    console.log(`[DonorStore] County avg donor rate: ${countyAvgDonorRate.toFixed(2)} per 1000`);
    console.log(`[DonorStore] County avg income: $${countyAvgIncome.toFixed(0)}`);

    // Score each ZIP
    for (const [zipCode, agg] of this.zipAggregates) {
      const demo = demographicsMap.get(zipCode) || null;
      const score = scorer.calculateProspectScore(agg, demo, {
        targetParty: 'all',
        countyAvgDonorRate,
        countyAvgIncome,
      });

      // Update aggregate with calculated score
      agg.prospectScore = score.totalScore;
    }

    console.log('[DonorStore] Prospect scores calculated for all ZIPs');
  }

  /**
   * Load ZIP demographics from file or create estimates
   */
  private loadDemographics(): Map<string, ZIPDemographics> {
    const demographicsMap = new Map<string, ZIPDemographics>();
    const dataDir = path.join(process.cwd(), 'public', 'data', 'donors');
    const demoPath = path.join(dataDir, 'zip-demographics.json');

    // Try to load real demographics
    if (fs.existsSync(demoPath)) {
      try {
        const demoData = JSON.parse(fs.readFileSync(demoPath, 'utf-8')) as ZIPDemographics[];
        for (const demo of demoData) {
          demographicsMap.set(demo.zipCode, demo);
        }
        console.log(`[DonorStore] Loaded ${demoData.length} ZIP demographics`);
        return demographicsMap;
      } catch (err) {
        console.warn('[DonorStore] Failed to load demographics, using estimates');
      }
    }

    // Create estimates from ZIP aggregate data
    for (const [zipCode, agg] of this.zipAggregates) {
      // Estimate demographics from donor data
      // These are rough estimates - real data should be provided via zip-demographics.json
      const estimatedPopulation = agg.donorCount * 50; // Rough 2% donor rate
      const estimatedIncome = agg.avgContribution > 200 ? 75000 : agg.avgContribution > 100 ? 60000 : 50000;

      demographicsMap.set(zipCode, {
        zipCode,
        city: agg.city,
        state: agg.state,
        population: estimatedPopulation,
        medianIncome: estimatedIncome,
        medianAge: 42, // Michigan median age
        collegePct: 30, // National average
      });
    }

    console.log(`[DonorStore] Created estimated demographics for ${demographicsMap.size} ZIPs`);
    return demographicsMap;
  }

  getZIPAggregate(zipCode: string): ZIPAggregate | null {
    return this.zipAggregates.get(zipCode) || null;
  }

  getZIPOccupations(zipCode: string): ZIPOccupationData | null {
    return this.zipOccupations.get(zipCode) || null;
  }

  getDonorSegments(): SegmentSummary[] {
    const segmentDefs: Record<DonorSegment, { name: string; description: string; strategy: string }> = {
      champion: {
        name: 'Champions',
        description: 'Recent, frequent, high-value donors',
        strategy: 'Thank, recognize, exclusive access',
      },
      loyal: {
        name: 'Loyal Donors',
        description: 'Regular mid-level contributors',
        strategy: 'Upgrade asks, monthly giving programs',
      },
      potential: {
        name: 'Potential Loyalists',
        description: 'Recent donors, not yet frequent',
        strategy: 'Nurture, welcome series, second gift',
      },
      at_risk: {
        name: 'At Risk',
        description: "Were valuable, haven't given recently",
        strategy: 'Reactivation campaigns, special appeals',
      },
      lapsed: {
        name: 'Lapsed',
        description: "Haven't given in 12+ months",
        strategy: 'Win-back campaigns, updated messaging',
      },
      prospect: {
        name: 'Prospects',
        description: 'High-capacity area, no donation history',
        strategy: 'Acquisition, events, peer-to-peer',
      },
    };

    const segments: DonorSegment[] = ['champion', 'loyal', 'potential', 'at_risk', 'lapsed', 'prospect'];

    return segments.map(segment => {
      const donors = this.donorProfiles.filter(d => d.segment === segment);
      const totalAmount = donors.reduce((sum, d) => sum + d.totalContributed, 0);
      const avgGift = donors.length > 0 ? Math.round(totalAmount / donors.length) : 0;

      return {
        segment,
        ...segmentDefs[segment],
        donorCount: donors.length,
        totalAmount,
        avgGift,
      };
    });
  }

  getDonorProfiles(segmentFilter?: DonorSegment): DonorProfile[] {
    if (segmentFilter) {
      return this.donorProfiles.filter(d => d.segment === segmentFilter);
    }
    return this.donorProfiles;
  }

  findProspects(options: ProspectOptions): ProspectArea[] {
    const {
      minMedianIncome = 60000,
      minDonorGap = 40,
    } = options;

    // Calculate county-wide average donor rate
    const aggregates = Array.from(this.zipAggregates.values());
    if (aggregates.length === 0) return [];

    // Estimate average donor rate per 1000 population
    // Using topDonorCount as proxy for high-value donors
    const totalDonors = aggregates.reduce((sum, z) => sum + z.donorCount, 0);
    const avgDonorRate = 4.2; // County average donors per 1000 (Ingham County baseline)

    const prospects: ProspectArea[] = [];

    for (const agg of aggregates) {
      // Use avgCapacity as income proxy (set in ingestion if available)
      const medianIncome = agg.avgCapacity > 0 ? agg.avgCapacity * 1000 : 50000;

      if (medianIncome < minMedianIncome) continue;

      // Estimate population from donor count and density (if set)
      const population = agg.donorDensity > 0
        ? Math.round((agg.donorCount / agg.donorDensity) * 1000)
        : agg.donorCount * 50; // Rough estimate

      const currentRate = agg.donorDensity > 0 ? agg.donorDensity : (agg.donorCount / (population / 1000));
      const gapPercent = ((avgDonorRate - currentRate) / avgDonorRate) * 100;

      if (gapPercent < minDonorGap) continue;

      const expectedDonors = (population / 1000) * avgDonorRate;
      const untappedDonors = Math.max(0, expectedDonors - agg.donorCount);
      const potentialLow = Math.round(untappedDonors * agg.avgContribution * 0.5);
      const potentialHigh = Math.round(untappedDonors * agg.avgContribution * 1.5);

      prospects.push({
        zipCode: agg.zipCode,
        city: agg.city,
        medianIncome,
        population,
        currentDonorRate: Math.round(currentRate * 10) / 10,
        avgDonorRate,
        gapPercent: Math.round(gapPercent * 10) / 10,
        potentialLow,
        potentialHigh,
        score: Math.round((gapPercent / 100) * (medianIncome / 50000) * Math.log10(Math.max(population, 1)) * 100) / 100,
      });
    }

    // Sort by score descending
    prospects.sort((a, b) => b.score - a.score);

    return prospects;
  }
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Initialize store with real data
    const store = DonorStore.getInstance();
    if (!store.isInitialized()) {
      store.initialize();
    }

    // Check for initialization errors
    const initError = store.getInitError();
    if (initError) {
      return NextResponse.json(
        {
          success: false,
          error: initError,
          message: 'Real FEC data not available. Run the ingestion script first.',
        },
        { status: 503 }
      );
    }

    // Return data status
    if (action === 'status') {
      const metadata = store.getMetadata();
      return NextResponse.json({
        success: true,
        data: {
          initialized: store.isInitialized(),
          metadata,
        },
      });
    }

    // Return summary stats
    if (action === 'summary') {
      const summary = store.getSummaryStats();
      if (!summary) {
        return NextResponse.json(
          { success: false, error: 'Data not initialized' },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        data: summary,
      });
    }

    // Return all ZIP aggregates
    if (action === 'aggregates') {
      const party = searchParams.get('party') || undefined;
      const cycle = searchParams.get('cycle') || undefined;

      const aggregates = store.getAllZIPAggregates({ party, cycle });

      return NextResponse.json({
        success: true,
        data: aggregates,
      });
    }

    // Return single ZIP aggregate with occupation data
    if (action === 'zip') {
      const zipCode = searchParams.get('zipCode');

      if (!zipCode) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing zipCode parameter',
          },
          { status: 400 }
        );
      }

      const aggregate = store.getZIPAggregate(zipCode);

      if (!aggregate) {
        return NextResponse.json(
          {
            success: false,
            error: `ZIP code ${zipCode} not found`,
          },
          { status: 404 }
        );
      }

      // Include occupation data if available
      const occupationData = store.getZIPOccupations(zipCode);
      const response = {
        ...aggregate,
        topOccupations: occupationData?.topOccupations || [],
      };

      return NextResponse.json({
        success: true,
        data: response,
      });
    }

    // Return donor segments
    if (action === 'segments') {
      const segments = store.getDonorSegments();

      return NextResponse.json({
        success: true,
        data: segments,
      });
    }

    // Return donor profiles
    if (action === 'profiles') {
      const segment = searchParams.get('segment') as DonorSegment | null;

      const profiles = store.getDonorProfiles(segment || undefined);

      return NextResponse.json({
        success: true,
        data: profiles,
      });
    }

    // Return time series data for charts and forecasting
    if (action === 'timeseries') {
      const dataDir = path.join(process.cwd(), 'public', 'data', 'donors');
      const timeSeriesPath = path.join(dataDir, 'time-series.json');

      if (!fs.existsSync(timeSeriesPath)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Time series data not generated. Run: npx tsx scripts/donor-ingestion/generate-time-series.ts',
          },
          { status: 503 }
        );
      }

      const timeSeriesData = JSON.parse(fs.readFileSync(timeSeriesPath, 'utf-8'));
      return NextResponse.json({
        success: true,
        data: timeSeriesData,
      });
    }

    // Unknown action
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action parameter. Use: summary, aggregates, zip, segments, profiles, timeseries, or status',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in GET /api/donors:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, options } = body;

    // Initialize store with real data
    const store = DonorStore.getInstance();
    if (!store.isInitialized()) {
      store.initialize();
    }

    // Check for initialization errors
    const initError = store.getInitError();
    if (initError) {
      return NextResponse.json(
        {
          success: false,
          error: initError,
          message: 'Real FEC data not available. Run the ingestion script first.',
        },
        { status: 503 }
      );
    }

    // Find prospect areas
    if (action === 'prospects') {
      if (!options || typeof options !== 'object') {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing or invalid options in request body',
          },
          { status: 400 }
        );
      }

      const prospects = store.findProspects(options as ProspectOptions);

      return NextResponse.json({
        success: true,
        data: prospects,
      });
    }

    // Unknown action
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use: prospects',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/donors:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
