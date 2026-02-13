/**
 * DonorStore Unit Tests
 *
 * Tests for in-memory donor data storage with file persistence capabilities.
 */

import { DonorStore, donorStore, ZIPAggregateFilters } from '@/lib/donor/DonorStore';
import type {
  Contribution,
  ZIPAggregate,
  DonorProfile,
  ProspectArea,
} from '@/lib/donor/types';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

import fs from 'fs';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsPromises = fs.promises as jest.Mocked<typeof fs.promises>;

describe('DonorStore', () => {
  let store: DonorStore;

  // Sample test data
  const sampleContributions: Contribution[] = [
    {
      id: 'c1',
      source: 'fec',
      contributorName: 'John Doe',
      city: 'Lansing',
      state: 'MI',
      zipCode: '48912',
      amount: 500,
      date: '2024-01-15',
      transactionType: '15',
      electionCycle: '2024',
      committeeId: 'C001',
      party: 'DEM',
    },
    {
      id: 'c2',
      source: 'fec',
      contributorName: 'Jane Smith',
      city: 'East Lansing',
      state: 'MI',
      zipCode: '48823',
      amount: 1000,
      date: '2024-02-20',
      transactionType: '15',
      electionCycle: '2024',
      committeeId: 'C002',
      party: 'REP',
    },
    {
      id: 'c3',
      source: 'fec',
      contributorName: 'Bob Johnson',
      city: 'Lansing',
      state: 'MI',
      zipCode: '48912',
      amount: 250,
      date: '2024-03-10',
      transactionType: '15',
      electionCycle: '2024',
      committeeId: 'C001',
      party: 'DEM',
    },
    {
      id: 'c4',
      source: 'fec',
      contributorName: 'Alice Brown',
      city: 'Okemos',
      state: 'MI',
      zipCode: '48864',
      amount: 2500,
      date: '2023-11-05',
      transactionType: '15',
      electionCycle: '2024',
      committeeId: 'C003',
      party: 'REP',
    },
    {
      id: 'c5',
      source: 'fec',
      contributorName: 'Charlie Wilson',
      city: 'Lansing',
      state: 'MI',
      zipCode: '48912',
      amount: 75,
      date: '2024-04-01',
      transactionType: '15',
      electionCycle: '2024',
      committeeId: 'C001',
      party: 'other',
    },
  ];

  const sampleZIPAggregates: ZIPAggregate[] = [
    {
      zipCode: '48912',
      city: 'Lansing',
      state: 'MI',
      totalAmount: 825,
      donorCount: 3,
      contributionCount: 3,
      avgContribution: 275,
      medianContribution: 250,
      demAmount: 750,
      repAmount: 0,
      otherAmount: 75,
      demDonors: 2,
      repDonors: 0,
      amountLast30Days: 0,
      amountLast90Days: 0,
      amountLast12Months: 825,
      topDonorCount: 0,
      maxSingleDonation: 500,
      donorDensity: 1.5,
      avgCapacity: 500,
      prospectScore: 65,
    },
    {
      zipCode: '48823',
      city: 'East Lansing',
      state: 'MI',
      totalAmount: 1000,
      donorCount: 1,
      contributionCount: 1,
      avgContribution: 1000,
      medianContribution: 1000,
      demAmount: 0,
      repAmount: 1000,
      otherAmount: 0,
      demDonors: 0,
      repDonors: 1,
      amountLast30Days: 0,
      amountLast90Days: 0,
      amountLast12Months: 1000,
      topDonorCount: 1,
      maxSingleDonation: 1000,
      donorDensity: 2.0,
      avgCapacity: 800,
      prospectScore: 75,
    },
    {
      zipCode: '48864',
      city: 'Okemos',
      state: 'MI',
      totalAmount: 2500,
      donorCount: 1,
      contributionCount: 1,
      avgContribution: 2500,
      medianContribution: 2500,
      demAmount: 0,
      repAmount: 2500,
      otherAmount: 0,
      demDonors: 0,
      repDonors: 1,
      amountLast30Days: 0,
      amountLast90Days: 0,
      amountLast12Months: 2500,
      topDonorCount: 1,
      maxSingleDonation: 2500,
      donorDensity: 0.8,
      avgCapacity: 1500,
      prospectScore: 85,
    },
  ];

  const sampleDonorProfiles: DonorProfile[] = [
    {
      donorId: 'd1',
      zipCode: '48912',
      city: 'Lansing',
      recencyScore: 4,
      frequencyScore: 3,
      monetaryScore: 3,
      totalContributed: 500,
      contributionCount: 2,
      avgContribution: 250,
      firstContributionDate: '2023-06-01',
      lastContributionDate: '2024-01-15',
      likelyParty: 'DEM',
      partyConfidence: 0.9,
      segment: 'loyal',
    },
    {
      donorId: 'd2',
      zipCode: '48823',
      city: 'East Lansing',
      recencyScore: 5,
      frequencyScore: 5,
      monetaryScore: 5,
      totalContributed: 5000,
      contributionCount: 10,
      avgContribution: 500,
      firstContributionDate: '2022-01-01',
      lastContributionDate: '2024-02-20',
      likelyParty: 'REP',
      partyConfidence: 0.95,
      segment: 'champion',
    },
    {
      donorId: 'd3',
      zipCode: '48864',
      city: 'Okemos',
      recencyScore: 2,
      frequencyScore: 2,
      monetaryScore: 4,
      totalContributed: 2500,
      contributionCount: 1,
      avgContribution: 2500,
      firstContributionDate: '2023-11-05',
      lastContributionDate: '2023-11-05',
      likelyParty: 'REP',
      partyConfidence: 0.85,
      segment: 'potential',
    },
    {
      donorId: 'd4',
      zipCode: '48912',
      city: 'Lansing',
      recencyScore: 1,
      frequencyScore: 4,
      monetaryScore: 4,
      totalContributed: 3000,
      contributionCount: 8,
      avgContribution: 375,
      firstContributionDate: '2020-01-01',
      lastContributionDate: '2022-12-15',
      likelyParty: 'DEM',
      partyConfidence: 0.8,
      segment: 'lapsed',
    },
  ];

  const sampleProspectAreas: ProspectArea[] = [
    {
      zipCode: '48917',
      city: 'Lansing',
      medianIncome: 65000,
      population: 15000,
      currentDonorRate: 0.5,
      avgDonorRate: 1.2,
      gapPercent: 58,
      potentialLow: 50000,
      potentialHigh: 100000,
      score: 85,
    },
    {
      zipCode: '48910',
      city: 'Lansing',
      medianIncome: 55000,
      population: 12000,
      currentDonorRate: 0.8,
      avgDonorRate: 1.1,
      gapPercent: 27,
      potentialLow: 20000,
      potentialHigh: 40000,
      score: 65,
    },
    {
      zipCode: '48840',
      city: 'Haslett',
      medianIncome: 85000,
      population: 8000,
      currentDonorRate: 0.3,
      avgDonorRate: 1.5,
      gapPercent: 80,
      potentialLow: 80000,
      potentialHigh: 150000,
      score: 92,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    store = new DonorStore();
    store.clear();
  });

  describe('Singleton Pattern', () => {
    test('exports a singleton instance', () => {
      expect(donorStore).toBeInstanceOf(DonorStore);
    });

    test('singleton maintains state across references', () => {
      donorStore.setContributions(sampleContributions);
      expect(donorStore.getContributionsCount()).toBe(5);
      donorStore.clear();
    });
  });

  describe('Constructor', () => {
    test('creates data directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      new DonorStore();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('public/data/donors'),
        { recursive: true }
      );
    });

    test('does not create directory if it already exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.mkdirSync.mockClear();
      new DonorStore();
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('Contributions', () => {
    test('setContributions stores contributions', () => {
      store.setContributions(sampleContributions);
      expect(store.getContributionsCount()).toBe(5);
    });

    test('getContributions returns all contributions', () => {
      store.setContributions(sampleContributions);
      const contributions = store.getContributions();
      expect(contributions).toHaveLength(5);
      expect(contributions[0].contributorName).toBe('John Doe');
    });

    test('getContributionsCount returns correct count', () => {
      expect(store.getContributionsCount()).toBe(0);
      store.setContributions(sampleContributions);
      expect(store.getContributionsCount()).toBe(5);
    });

    test('setContributions replaces existing contributions', () => {
      store.setContributions(sampleContributions);
      store.setContributions([sampleContributions[0]]);
      expect(store.getContributionsCount()).toBe(1);
    });
  });

  describe('ZIP Aggregates', () => {
    beforeEach(() => {
      store.setZIPAggregates(sampleZIPAggregates);
    });

    test('setZIPAggregates stores aggregates by ZIP code', () => {
      expect(store.getZIPAggregatesCount()).toBe(3);
    });

    test('getZIPAggregates returns all aggregates without filters', () => {
      const aggregates = store.getZIPAggregates();
      expect(aggregates).toHaveLength(3);
    });

    test('getZIPAggregate returns single aggregate by ZIP code', () => {
      const aggregate = store.getZIPAggregate('48912');
      expect(aggregate).toBeDefined();
      expect(aggregate?.city).toBe('Lansing');
      expect(aggregate?.totalAmount).toBe(825);
    });

    test('getZIPAggregate returns undefined for unknown ZIP', () => {
      const aggregate = store.getZIPAggregate('99999');
      expect(aggregate).toBeUndefined();
    });

    test('getZIPAggregatesCount returns correct count', () => {
      expect(store.getZIPAggregatesCount()).toBe(3);
    });

    describe('Filtering', () => {
      test('filters by state', () => {
        const filters: ZIPAggregateFilters = { state: 'MI' };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(3);
      });

      test('filters by minAmount', () => {
        const filters: ZIPAggregateFilters = { minAmount: 1000 };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(2);
        expect(results.every(a => a.totalAmount >= 1000)).toBe(true);
      });

      test('filters by maxAmount', () => {
        const filters: ZIPAggregateFilters = { maxAmount: 1000 };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(2);
        expect(results.every(a => a.totalAmount <= 1000)).toBe(true);
      });

      test('filters by minDonors', () => {
        const filters: ZIPAggregateFilters = { minDonors: 2 };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(1);
        expect(results[0].zipCode).toBe('48912');
      });

      test('filters by party DEM', () => {
        const filters: ZIPAggregateFilters = { party: 'DEM' };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(1);
        expect(results[0].zipCode).toBe('48912');
      });

      test('filters by party REP', () => {
        const filters: ZIPAggregateFilters = { party: 'REP' };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(2);
      });

      test('filters by party all returns all', () => {
        const filters: ZIPAggregateFilters = { party: 'all' };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(3);
      });

      test('filters by specific ZIP codes', () => {
        const filters: ZIPAggregateFilters = { zipCodes: ['48912', '48823'] };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(2);
      });

      test('combines multiple filters', () => {
        const filters: ZIPAggregateFilters = {
          state: 'MI',
          minAmount: 900,
          party: 'REP',
        };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(2);
      });

      test('empty zipCodes array does not filter', () => {
        const filters: ZIPAggregateFilters = { zipCodes: [] };
        const results = store.getZIPAggregates(filters);
        expect(results).toHaveLength(3);
      });
    });
  });

  describe('Donor Profiles', () => {
    beforeEach(() => {
      store.setDonorProfiles(sampleDonorProfiles);
    });

    test('setDonorProfiles stores profiles by donorId', () => {
      expect(store.getDonorProfilesCount()).toBe(4);
    });

    test('getDonorProfiles returns all profiles', () => {
      const profiles = store.getDonorProfiles();
      expect(profiles).toHaveLength(4);
    });

    test('getDonorProfile returns single profile by ID', () => {
      const profile = store.getDonorProfile('d2');
      expect(profile).toBeDefined();
      expect(profile?.segment).toBe('champion');
    });

    test('getDonorProfile returns undefined for unknown ID', () => {
      const profile = store.getDonorProfile('unknown');
      expect(profile).toBeUndefined();
    });

    test('getDonorsBySegment returns donors matching segment', () => {
      const loyalDonors = store.getDonorsBySegment('loyal');
      expect(loyalDonors).toHaveLength(1);
      expect(loyalDonors[0].donorId).toBe('d1');

      const lapsedDonors = store.getDonorsBySegment('lapsed');
      expect(lapsedDonors).toHaveLength(1);
      expect(lapsedDonors[0].donorId).toBe('d4');
    });

    test('getDonorsBySegment returns empty array for segment with no donors', () => {
      const atRiskDonors = store.getDonorsBySegment('at_risk');
      expect(atRiskDonors).toHaveLength(0);
    });

    test('getDonorProfilesCount returns correct count', () => {
      expect(store.getDonorProfilesCount()).toBe(4);
    });
  });

  describe('Prospect Areas', () => {
    beforeEach(() => {
      store.setProspectAreas(sampleProspectAreas);
    });

    test('setProspectAreas stores prospects by ZIP code', () => {
      const prospects = store.getProspectAreas();
      expect(prospects).toHaveLength(3);
    });

    test('getProspectAreas returns all prospects', () => {
      const prospects = store.getProspectAreas();
      expect(prospects).toHaveLength(3);
    });

    test('getTopProspects returns prospects sorted by score', () => {
      const topProspects = store.getTopProspects(2);
      expect(topProspects).toHaveLength(2);
      expect(topProspects[0].zipCode).toBe('48840');
      expect(topProspects[0].score).toBe(92);
      expect(topProspects[1].zipCode).toBe('48917');
      expect(topProspects[1].score).toBe(85);
    });

    test('getTopProspects with default limit of 10', () => {
      const topProspects = store.getTopProspects();
      expect(topProspects).toHaveLength(3);
    });

    test('getTopProspects returns all if limit exceeds count', () => {
      const topProspects = store.getTopProspects(100);
      expect(topProspects).toHaveLength(3);
    });
  });

  describe('Summary Statistics', () => {
    test('getSummaryStats returns empty stats when no contributions', () => {
      const stats = store.getSummaryStats();
      expect(stats.total_contributions).toBe(0);
      expect(stats.total_amount).toBe(0);
      expect(stats.avg_contribution).toBe(0);
      expect(stats.unique_contributors).toBe(0);
      expect(stats.top_zip_codes).toHaveLength(0);
    });

    test('getSummaryStats calculates totals correctly', () => {
      store.setContributions(sampleContributions);
      store.setZIPAggregates(sampleZIPAggregates);
      const stats = store.getSummaryStats();

      expect(stats.total_contributions).toBe(5);
      expect(stats.total_amount).toBe(4325);
      expect(stats.avg_contribution).toBeCloseTo(865, 0);
    });

    test('getSummaryStats calculates median correctly', () => {
      store.setContributions(sampleContributions);
      const stats = store.getSummaryStats();
      // Sorted amounts: 75, 250, 500, 1000, 2500 - median is 500
      expect(stats.median_contribution).toBe(500);
    });

    test('getSummaryStats calculates median for even count', () => {
      store.setContributions(sampleContributions.slice(0, 4));
      const stats = store.getSummaryStats();
      // Sorted amounts: 250, 500, 1000, 2500 - median is (500+1000)/2 = 750
      expect(stats.median_contribution).toBe(750);
    });

    test('getSummaryStats finds date range', () => {
      store.setContributions(sampleContributions);
      const stats = store.getSummaryStats();

      expect(stats.date_range.earliest).toBe('2023-11-05');
      expect(stats.date_range.latest).toBe('2024-04-01');
    });

    test('getSummaryStats uses donor profiles for unique count if available', () => {
      store.setContributions(sampleContributions);
      store.setDonorProfiles(sampleDonorProfiles);
      const stats = store.getSummaryStats();

      expect(stats.unique_contributors).toBe(4);
    });

    test('getSummaryStats calculates unique contributors from contributions if no profiles', () => {
      store.setContributions(sampleContributions);
      const stats = store.getSummaryStats();

      // 5 unique name|zip combinations
      expect(stats.unique_contributors).toBe(5);
    });

    test('getSummaryStats includes top ZIP codes', () => {
      store.setContributions(sampleContributions);
      store.setZIPAggregates(sampleZIPAggregates);
      const stats = store.getSummaryStats();

      expect(stats.top_zip_codes.length).toBeGreaterThan(0);
      expect(stats.top_zip_codes[0].zip_code).toBe('48864');
      expect(stats.top_zip_codes[0].total_amount).toBe(2500);
    });

    test('getSummaryStats calculates party breakdown', () => {
      store.setContributions(sampleContributions);
      const stats = store.getSummaryStats();

      // DEM: 500 + 250 = 750
      expect(stats.party_breakdown.dem_amount).toBe(750);
      // REP: 1000 + 2500 = 3500
      expect(stats.party_breakdown.rep_amount).toBe(3500);
      // Other: 75
      expect(stats.party_breakdown.other_amount).toBe(75);
    });

    test('getSummaryStats calculates contribution distribution', () => {
      store.setContributions(sampleContributions);
      const stats = store.getSummaryStats();

      // Amounts: 75, 250, 500, 1000, 2500
      // under_100: 75
      // between_100_500: 250 (100 <= x < 500)
      // between_500_1000: 500 (500 <= x < 1000)
      // between_1000_2500: 1000 (1000 <= x < 2500)
      // over_2500: 2500 (>= 2500)
      expect(stats.contribution_distribution.under_100).toBe(1);
      expect(stats.contribution_distribution.between_100_500).toBe(1);
      expect(stats.contribution_distribution.between_500_1000).toBe(1);
      expect(stats.contribution_distribution.between_1000_2500).toBe(1);
      expect(stats.contribution_distribution.over_2500).toBe(1);
    });

    test('getSummaryStats handles empty date array', () => {
      const contributionsNoDate = sampleContributions.map(c => ({
        ...c,
        date: '',
      }));
      store.setContributions(contributionsNoDate);
      const stats = store.getSummaryStats();

      expect(stats.date_range.earliest).toBe('');
      expect(stats.date_range.latest).toBe('');
    });
  });

  describe('File Persistence', () => {
    describe('saveToFile', () => {
      test('saves contributions to file', async () => {
        store.setContributions(sampleContributions);
        await store.saveToFile();

        expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('contributions.json'),
          expect.any(String),
          'utf-8'
        );
      });

      test('saves ZIP aggregates to file', async () => {
        store.setZIPAggregates(sampleZIPAggregates);
        await store.saveToFile();

        expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('zip_aggregates.json'),
          expect.any(String),
          'utf-8'
        );
      });

      test('saves donor profiles to file', async () => {
        store.setDonorProfiles(sampleDonorProfiles);
        await store.saveToFile();

        expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('donor_profiles.json'),
          expect.any(String),
          'utf-8'
        );
      });

      test('saves prospect areas to file', async () => {
        store.setProspectAreas(sampleProspectAreas);
        await store.saveToFile();

        expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('prospect_areas.json'),
          expect.any(String),
          'utf-8'
        );
      });

      test('does not save empty data', async () => {
        await store.saveToFile();
        expect(mockFsPromises.writeFile).not.toHaveBeenCalled();
      });

      test('ensures data directory exists before saving', async () => {
        mockFs.existsSync.mockReturnValue(false);
        store.setContributions(sampleContributions);
        await store.saveToFile();

        expect(mockFs.mkdirSync).toHaveBeenCalled();
      });
    });

    describe('loadFromFile', () => {
      test('loads contributions from file', async () => {
        // Only contributions file exists
        mockFs.existsSync.mockImplementation((path: unknown) =>
          String(path).includes('contributions.json')
        );
        mockFsPromises.readFile.mockResolvedValueOnce(
          JSON.stringify(sampleContributions)
        );

        await store.loadFromFile();
        expect(store.getContributionsCount()).toBe(5);
      });

      test('loads ZIP aggregates from file', async () => {
        mockFs.existsSync.mockImplementation((path: unknown) =>
          String(path).includes('zip_aggregates.json')
        );
        mockFsPromises.readFile.mockResolvedValueOnce(
          JSON.stringify(sampleZIPAggregates)
        );

        await store.loadFromFile();
        expect(store.getZIPAggregatesCount()).toBe(3);
      });

      test('loads donor profiles from file', async () => {
        mockFs.existsSync.mockImplementation((path: unknown) =>
          String(path).includes('donor_profiles.json')
        );
        mockFsPromises.readFile.mockResolvedValueOnce(
          JSON.stringify(sampleDonorProfiles)
        );

        await store.loadFromFile();
        expect(store.getDonorProfilesCount()).toBe(4);
      });

      test('loads prospect areas from file', async () => {
        mockFs.existsSync.mockImplementation((path: unknown) =>
          String(path).includes('prospect_areas.json')
        );
        mockFsPromises.readFile.mockResolvedValueOnce(
          JSON.stringify(sampleProspectAreas)
        );

        await store.loadFromFile();
        expect(store.getProspectAreas()).toHaveLength(3);
      });

      test('does not load from non-existent files', async () => {
        mockFs.existsSync.mockReturnValue(false);
        await store.loadFromFile();
        expect(mockFsPromises.readFile).not.toHaveBeenCalled();
      });
    });

    describe('hasPersistedData', () => {
      test('returns true if contributions file exists', () => {
        mockFs.existsSync.mockImplementation((path: unknown) =>
          String(path).includes('contributions.json')
        );
        expect(store.hasPersistedData()).toBe(true);
      });

      test('returns true if ZIP aggregates file exists', () => {
        mockFs.existsSync.mockImplementation((path: unknown) =>
          String(path).includes('zip_aggregates.json')
        );
        expect(store.hasPersistedData()).toBe(true);
      });

      test('returns true if donor profiles file exists', () => {
        mockFs.existsSync.mockImplementation((path: unknown) =>
          String(path).includes('donor_profiles.json')
        );
        expect(store.hasPersistedData()).toBe(true);
      });

      test('returns false if no files exist', () => {
        mockFs.existsSync.mockReturnValue(false);
        expect(store.hasPersistedData()).toBe(false);
      });
    });

    describe('deletePersistedData', () => {
      test('deletes all existing files', async () => {
        mockFs.existsSync.mockReturnValue(true);
        await store.deletePersistedData();

        expect(mockFsPromises.unlink).toHaveBeenCalledTimes(4);
      });

      test('only deletes files that exist', async () => {
        mockFs.existsSync.mockImplementation((path: unknown) =>
          String(path).includes('contributions.json')
        );
        await store.deletePersistedData();

        expect(mockFsPromises.unlink).toHaveBeenCalledTimes(1);
      });

      test('does not delete if no files exist', async () => {
        mockFs.existsSync.mockReturnValue(false);
        await store.deletePersistedData();

        expect(mockFsPromises.unlink).not.toHaveBeenCalled();
      });
    });
  });

  describe('Clear', () => {
    test('clear removes all in-memory data', () => {
      store.setContributions(sampleContributions);
      store.setZIPAggregates(sampleZIPAggregates);
      store.setDonorProfiles(sampleDonorProfiles);
      store.setProspectAreas(sampleProspectAreas);

      store.clear();

      expect(store.getContributionsCount()).toBe(0);
      expect(store.getZIPAggregatesCount()).toBe(0);
      expect(store.getDonorProfilesCount()).toBe(0);
      expect(store.getProspectAreas()).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('handles contributions with missing optional fields', () => {
      const minimalContribution: Contribution = {
        id: 'min1',
        source: 'fec',
        contributorName: 'Test',
        city: 'Test City',
        state: 'MI',
        zipCode: '48900',
        amount: 100,
        date: '2024-01-01',
        transactionType: '15',
        electionCycle: '2024',
        committeeId: 'C001',
      };

      store.setContributions([minimalContribution]);
      expect(store.getContributionsCount()).toBe(1);
    });

    test('handles empty arrays', () => {
      store.setContributions([]);
      store.setZIPAggregates([]);
      store.setDonorProfiles([]);
      store.setProspectAreas([]);

      expect(store.getContributionsCount()).toBe(0);
      expect(store.getZIPAggregatesCount()).toBe(0);
      expect(store.getDonorProfilesCount()).toBe(0);
      expect(store.getProspectAreas()).toHaveLength(0);
    });

    test('handles single contribution for statistics', () => {
      store.setContributions([sampleContributions[0]]);
      const stats = store.getSummaryStats();

      expect(stats.total_contributions).toBe(1);
      expect(stats.median_contribution).toBe(500);
      expect(stats.avg_contribution).toBe(500);
    });

    test('handles duplicate ZIP codes in aggregates (last one wins)', () => {
      const duplicateAggregates = [
        { ...sampleZIPAggregates[0], totalAmount: 100 },
        { ...sampleZIPAggregates[0], totalAmount: 999 },
      ];
      store.setZIPAggregates(duplicateAggregates);

      expect(store.getZIPAggregatesCount()).toBe(1);
      expect(store.getZIPAggregate('48912')?.totalAmount).toBe(999);
    });

    test('handles duplicate donor IDs in profiles (last one wins)', () => {
      const duplicateProfiles = [
        { ...sampleDonorProfiles[0], segment: 'loyal' as const },
        { ...sampleDonorProfiles[0], segment: 'champion' as const },
      ];
      store.setDonorProfiles(duplicateProfiles);

      expect(store.getDonorProfilesCount()).toBe(1);
      expect(store.getDonorProfile('d1')?.segment).toBe('champion');
    });
  });
});
