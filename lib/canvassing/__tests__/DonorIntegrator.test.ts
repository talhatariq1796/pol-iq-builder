/**
 * Unit Tests for DonorIntegrator
 *
 * Tests donor clustering, turf creation, walk list enrichment,
 * and recovery campaign functionality.
 */

import { DonorIntegrator } from '../DonorIntegrator';
import type {
  DonorType,
  DonorEnrichedAddress,
  DonorTargetingOptions,
  DonorRecoveryTurf,
  DonorCanvassingResult,
  DonorRecoverySummary,
} from '../DonorIntegrator';
import type { CanvassingPrecinct, CanvassingUniverse } from '../types';
import type {
  LapsedDonor,
  DonorProfile,
  ZIPAggregate,
  DonorCluster,
} from '../../donor/types';

describe('DonorIntegrator', () => {
  // ============================================================
  // Mock Data Factory Functions
  // ============================================================

  const createMockLapsedDonor = (overrides?: Partial<LapsedDonor>): LapsedDonor => ({
    donorId: 'donor_001',
    zipCode: '48823',
    city: 'East Lansing',
    lastGiftDate: '2023-01-15',
    lastGiftAmount: 250,
    totalHistoricalAmount: 1500,
    giftCount: 6,
    avgGift: 250,
    likelyParty: 'DEM',
    daysSinceLastGift: 650,
    monthsSinceLastGift: 21,
    historicalFrequencyScore: 4,
    historicalMonetaryScore: 3,
    recoveryScore: 75,
    estimatedRecoveryAmount: 300,
    recommendedChannel: 'door',
    priority: 'high',
    ...overrides,
  });

  const createMockDonorProfile = (overrides?: Partial<DonorProfile>): DonorProfile => ({
    donorId: 'profile_001',
    zipCode: '48823',
    city: 'East Lansing',
    h3Index: '87283472bffffff',
    recencyScore: 4,
    frequencyScore: 3,
    monetaryScore: 4,
    totalContributed: 2500,
    contributionCount: 8,
    avgContribution: 312.5,
    firstContributionDate: '2020-06-01',
    lastContributionDate: '2024-10-15',
    likelyParty: 'DEM',
    partyConfidence: 0.95,
    segment: 'loyal',
    ...overrides,
  });

  const createMockZIPAggregate = (overrides?: Partial<ZIPAggregate>): ZIPAggregate => ({
    zipCode: '48823',
    city: 'East Lansing',
    state: 'MI',
    totalAmount: 125000,
    donorCount: 85,
    contributionCount: 320,
    avgContribution: 390,
    medianContribution: 150,
    demAmount: 90000,
    repAmount: 35000,
    otherAmount: 0,
    demDonors: 65,
    repDonors: 20,
    amountLast30Days: 5000,
    amountLast90Days: 15000,
    amountLast12Months: 85000,
    topDonorCount: 12,
    maxSingleDonation: 5000,
    donorDensity: 8.5,
    avgCapacity: 450,
    prospectScore: 65,
    ...overrides,
  });

  const createMockCanvassingPrecinct = (overrides?: Partial<CanvassingPrecinct>): CanvassingPrecinct => ({
    precinctId: 'precinct_001',
    precinctName: 'East Lansing 1-1',
    jurisdiction: 'East Lansing 488',
    registeredVoters: 2500,
    activeVoters: 1800,
    gotvPriority: 75,
    persuasionOpportunity: 45,
    swingPotential: 60,
    targetingStrategy: 'GOTV + Persuasion',
    estimatedDoors: 800,
    estimatedTurfs: 4,
    estimatedHours: 20,
    priorityRank: 1,
    status: 'unassigned',
    ...overrides,
  });

  const createMockUniverse = (overrides?: Partial<CanvassingUniverse>): CanvassingUniverse => ({
    id: 'universe_001',
    name: 'Test Universe',
    description: 'Test canvassing universe',
    createdAt: '2024-11-01',
    targetDoorsPerTurf: 50,
    targetDoorsPerHour: 40,
    targetContactRate: 0.35,
    totalPrecincts: 5,
    totalEstimatedDoors: 1000,
    estimatedTurfs: 20,
    estimatedHours: 25,
    volunteersNeeded: 4,
    precincts: [],
    ...overrides,
  });

  // ============================================================
  // findDonorClusters Tests
  // ============================================================

  describe('findDonorClusters', () => {
    it('should group donors by ZIP code into clusters', () => {
      const donors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823', totalHistoricalAmount: 1500 }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823', totalHistoricalAmount: 2000 }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823', totalHistoricalAmount: 1000 }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48823', totalHistoricalAmount: 800 }),
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48823', totalHistoricalAmount: 1200 }),
      ];

      const clusters = DonorIntegrator.findDonorClusters(donors);

      expect(clusters).toHaveLength(1);
      expect(clusters[0].centerZip).toBe('48823');
      expect(clusters[0].donorCount).toBe(5);
      expect(clusters[0].donorIds).toHaveLength(5);
    });

    it('should only create clusters meeting minimum threshold', () => {
      const donors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48824' }), // Too few in 48824
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48824' }),
      ];

      const clusters = DonorIntegrator.findDonorClusters(donors, { minDonorsPerCluster: 3 });

      expect(clusters).toHaveLength(1);
      expect(clusters[0].centerZip).toBe('48823');
      expect(clusters[0].donorCount).toBe(3);
    });

    it('should calculate total historical value correctly', () => {
      const donors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823', totalHistoricalAmount: 1000 }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823', totalHistoricalAmount: 2000 }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823', totalHistoricalAmount: 1500 }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48823', totalHistoricalAmount: 500 }),
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48823', totalHistoricalAmount: 3000 }),
      ];

      const clusters = DonorIntegrator.findDonorClusters(donors);

      expect(clusters[0].totalHistoricalValue).toBe(8000);
    });

    it('should calculate average recovery score correctly', () => {
      const donors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823', recoveryScore: 80 }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823', recoveryScore: 70 }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823', recoveryScore: 60 }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48823', recoveryScore: 90 }),
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48823', recoveryScore: 75 }),
      ];

      const clusters = DonorIntegrator.findDonorClusters(donors);

      expect(clusters[0].avgRecoveryScore).toBe(75); // (80+70+60+90+75)/5 = 75
    });

    it('should calculate estimated recovery value correctly', () => {
      const donors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823', estimatedRecoveryAmount: 200 }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823', estimatedRecoveryAmount: 300 }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823', estimatedRecoveryAmount: 150 }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48823', estimatedRecoveryAmount: 400 }),
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48823', estimatedRecoveryAmount: 250 }),
      ];

      const clusters = DonorIntegrator.findDonorClusters(donors);

      expect(clusters[0].estimatedRecoveryValue).toBe(1300);
    });

    it('should sort clusters by estimated recovery value (highest first)', () => {
      const donors: LapsedDonor[] = [
        // ZIP 48823 - Lower value
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823', estimatedRecoveryAmount: 100 }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823', estimatedRecoveryAmount: 150 }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823', estimatedRecoveryAmount: 200 }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48823', estimatedRecoveryAmount: 125 }),
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48823', estimatedRecoveryAmount: 175 }),
        // ZIP 48824 - Higher value
        createMockLapsedDonor({ donorId: 'donor_006', zipCode: '48824', city: 'Lansing', estimatedRecoveryAmount: 500 }),
        createMockLapsedDonor({ donorId: 'donor_007', zipCode: '48824', city: 'Lansing', estimatedRecoveryAmount: 400 }),
        createMockLapsedDonor({ donorId: 'donor_008', zipCode: '48824', city: 'Lansing', estimatedRecoveryAmount: 600 }),
        createMockLapsedDonor({ donorId: 'donor_009', zipCode: '48824', city: 'Lansing', estimatedRecoveryAmount: 350 }),
        createMockLapsedDonor({ donorId: 'donor_010', zipCode: '48824', city: 'Lansing', estimatedRecoveryAmount: 450 }),
      ];

      const clusters = DonorIntegrator.findDonorClusters(donors);

      expect(clusters).toHaveLength(2);
      expect(clusters[0].centerZip).toBe('48824'); // Higher value first
      expect(clusters[0].estimatedRecoveryValue).toBe(2300);
      expect(clusters[1].centerZip).toBe('48823');
      expect(clusters[1].estimatedRecoveryValue).toBe(750);
    });

    it('should include recommended approach for cluster', () => {
      const donors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48823' }),
      ];

      const clusters = DonorIntegrator.findDonorClusters(donors);

      expect(clusters[0].recommendedApproach).toBeDefined();
      expect(typeof clusters[0].recommendedApproach).toBe('string');
      expect(clusters[0].recommendedApproach.length).toBeGreaterThan(0);
    });

    it('should return empty array when no clusters meet minimum', () => {
      const donors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48824', city: 'Lansing' }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48826', city: 'Mason' }),
      ];

      const clusters = DonorIntegrator.findDonorClusters(donors, { minDonorsPerCluster: 5 });

      expect(clusters).toHaveLength(0);
    });

    it('should handle empty donor array', () => {
      const clusters = DonorIntegrator.findDonorClusters([]);

      expect(clusters).toHaveLength(0);
    });
  });

  // ============================================================
  // createDonorRecoveryTurfs Tests
  // ============================================================

  describe('createDonorRecoveryTurfs', () => {
    it('should create turfs from donor clusters', () => {
      const clusters: DonorCluster[] = [
        {
          clusterId: 'cluster_1',
          centerZip: '48823',
          city: 'East Lansing',
          donorCount: 10,
          totalHistoricalValue: 15000,
          avgRecoveryScore: 75,
          estimatedRecoveryValue: 3000,
          donorIds: ['donor_001', 'donor_002', 'donor_003', 'donor_004', 'donor_005'],
          recommendedApproach: 'High-value priority',
        },
      ];

      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct({ jurisdiction: 'East Lansing 488' }),
      ];

      const lapsedDonors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48823' }),
      ];

      const turfs = DonorIntegrator.createDonorRecoveryTurfs(clusters, precincts, lapsedDonors);

      expect(turfs).toHaveLength(1);
      expect(turfs[0].turfId).toBe('donor_cluster_1');
      expect(turfs[0].turfName).toContain('East Lansing');
      expect(turfs[0].turfName).toContain('48823');
    });

    it('should set donor targeting stats correctly', () => {
      const clusters: DonorCluster[] = [
        {
          clusterId: 'cluster_1',
          centerZip: '48823',
          city: 'East Lansing',
          donorCount: 5,
          totalHistoricalValue: 10000,
          avgRecoveryScore: 80,
          estimatedRecoveryValue: 2500,
          donorIds: ['donor_001', 'donor_002', 'donor_003', 'donor_004', 'donor_005'],
          recommendedApproach: 'Test',
        },
      ];

      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct({ jurisdiction: 'East Lansing 488' }),
      ];

      const lapsedDonors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_004', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_005', zipCode: '48823' }),
      ];

      const turfs = DonorIntegrator.createDonorRecoveryTurfs(clusters, precincts, lapsedDonors);

      expect(turfs[0].donorTargeting.totalDonors).toBe(5);
      expect(turfs[0].donorTargeting.lapsedDonors).toBe(5);
      expect(turfs[0].donorTargeting.avgRecoveryScore).toBe(80);
      expect(turfs[0].donorTargeting.estimatedRecoveryValue).toBe(2500);
    });

    it('should enrich addresses for donors', () => {
      const clusters: DonorCluster[] = [
        {
          clusterId: 'cluster_1',
          centerZip: '48823',
          city: 'East Lansing',
          donorCount: 3,
          totalHistoricalValue: 5000,
          avgRecoveryScore: 70,
          estimatedRecoveryValue: 1200,
          donorIds: ['donor_001', 'donor_002', 'donor_003'],
          recommendedApproach: 'Test',
        },
      ];

      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct({ jurisdiction: 'East Lansing 488' }),
      ];

      const lapsedDonors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823', lastGiftAmount: 250 }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48823', lastGiftAmount: 500 }),
        createMockLapsedDonor({ donorId: 'donor_003', zipCode: '48823', lastGiftAmount: 100 }),
      ];

      const turfs = DonorIntegrator.createDonorRecoveryTurfs(clusters, precincts, lapsedDonors);

      expect(turfs[0].enrichedAddresses).toHaveLength(3);
      expect(turfs[0].enrichedAddresses[0].isDonor).toBe(true);
      expect(turfs[0].enrichedAddresses[0].donorType).toBe('lapsed');
      expect(turfs[0].enrichedAddresses[0].recommendedScript).toBe('lapsed_donor_reengagement');
    });

    it('should calculate priority based on recovery value and score', () => {
      const highValueCluster: DonorCluster = {
        clusterId: 'cluster_1',
        centerZip: '48823',
        city: 'East Lansing',
        donorCount: 5,
        totalHistoricalValue: 50000,
        avgRecoveryScore: 85,
        estimatedRecoveryValue: 15000,
        donorIds: ['donor_001'],
        recommendedApproach: 'Test',
      };

      const lowValueCluster: DonorCluster = {
        clusterId: 'cluster_2',
        centerZip: '48824',
        city: 'Lansing',
        donorCount: 5,
        totalHistoricalValue: 3000,
        avgRecoveryScore: 45,
        estimatedRecoveryValue: 800,
        donorIds: ['donor_002'],
        recommendedApproach: 'Test',
      };

      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct({ jurisdiction: 'East Lansing 488' }),
        createMockCanvassingPrecinct({ precinctId: 'precinct_002', jurisdiction: 'Lansing 488' }),
      ];

      const lapsedDonors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '48823' }),
        createMockLapsedDonor({ donorId: 'donor_002', zipCode: '48824' }),
      ];

      const turfs = DonorIntegrator.createDonorRecoveryTurfs(
        [highValueCluster, lowValueCluster],
        precincts,
        lapsedDonors
      );

      expect(turfs[0].priority).toBeLessThan(turfs[1].priority); // Lower number = higher priority
    });

    it('should skip clusters with no matching precincts', () => {
      const clusters: DonorCluster[] = [
        {
          clusterId: 'cluster_1',
          centerZip: '99999', // No matching precinct
          city: 'Unknown',
          donorCount: 5,
          totalHistoricalValue: 5000,
          avgRecoveryScore: 70,
          estimatedRecoveryValue: 1500,
          donorIds: ['donor_001'],
          recommendedApproach: 'Test',
        },
      ];

      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct({ jurisdiction: 'East Lansing 488' }),
      ];

      const lapsedDonors: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001', zipCode: '99999' }),
      ];

      const turfs = DonorIntegrator.createDonorRecoveryTurfs(clusters, precincts, lapsedDonors);

      expect(turfs).toHaveLength(0);
    });

    it('should respect target doors per turf option', () => {
      const clusters: DonorCluster[] = [
        {
          clusterId: 'cluster_1',
          centerZip: '48823',
          city: 'East Lansing',
          donorCount: 100,
          totalHistoricalValue: 50000,
          avgRecoveryScore: 75,
          estimatedRecoveryValue: 12000,
          donorIds: Array.from({ length: 100 }, (_, i) => `donor_${i}`),
          recommendedApproach: 'Test',
        },
      ];

      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct({ jurisdiction: 'East Lansing 488' }),
      ];

      const lapsedDonors: LapsedDonor[] = Array.from({ length: 100 }, (_, i) =>
        createMockLapsedDonor({ donorId: `donor_${i}`, zipCode: '48823' })
      );

      const turfs = DonorIntegrator.createDonorRecoveryTurfs(clusters, precincts, lapsedDonors, {
        donorTypes: ['lapsed'],
        targetDoorsPerTurf: 30,
      });

      expect(turfs[0].estimatedDoors).toBeLessThanOrEqual(30);
    });
  });

  // ============================================================
  // enrichWalkList Tests
  // ============================================================

  describe('enrichWalkList', () => {
    it('should enrich walk list with donor information', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct({ precinctId: 'precinct_001' }),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({ donorId: 'profile_001', zipCode: '48823' }),
        createMockDonorProfile({ donorId: 'profile_002', zipCode: '48823' }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate({ zipCode: '48823' })],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      expect(enriched.length).toBeGreaterThan(0);
      expect(enriched[0].isDonor).toBe(true);
      expect(enriched[0].donorType).toBeDefined();
    });

    it('should classify donor types correctly', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({ donorId: 'major_001', totalContributed: 10000, segment: 'champion' }),
        createMockDonorProfile({ donorId: 'recurring_001', contributionCount: 15, segment: 'loyal' }),
        createMockDonorProfile({ donorId: 'lapsed_001', segment: 'lapsed' }),
        createMockDonorProfile({ donorId: 'grassroots_001', totalContributed: 500, segment: 'potential' }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate()],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      const major = enriched.find(a => a.donorId === 'major_001');
      const recurring = enriched.find(a => a.donorId === 'recurring_001');
      const lapsed = enriched.find(a => a.donorId === 'lapsed_001');
      const grassroots = enriched.find(a => a.donorId === 'grassroots_001');

      expect(major?.donorType).toBe('major');
      expect(recurring?.donorType).toBe('recurring');
      expect(lapsed?.donorType).toBe('lapsed');
      expect(grassroots?.donorType).toBe('grassroots');
    });

    it('should add recommended script based on donor type', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({ donorId: 'lapsed_001', segment: 'lapsed' }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate()],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      const lapsed = enriched.find(a => a.donorId === 'lapsed_001');
      expect(lapsed?.recommendedScript).toBe('lapsed_donor_reengagement');
    });

    it('should add conversation tips', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({ donorId: 'profile_001' }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate()],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      expect(enriched[0].conversationTips).toBeDefined();
      expect(Array.isArray(enriched[0].conversationTips)).toBe(true);
      expect(enriched[0].conversationTips.length).toBeGreaterThan(0);
    });

    it('should add special handling for high-value donors', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({ donorId: 'high_value', totalContributed: 15000 }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate()],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      const highValue = enriched.find(a => a.donorId === 'high_value');
      expect(highValue?.specialHandling).toBeDefined();
      expect(highValue?.specialHandling).toContain('MAJOR DONOR');
    });

    it('should calculate priority correctly (1-5)', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({ donorId: 'low_priority', totalContributed: 100 }),
        createMockDonorProfile({ donorId: 'high_priority', totalContributed: 8000 }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate()],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      const low = enriched.find(a => a.donorId === 'low_priority');
      const high = enriched.find(a => a.donorId === 'high_priority');

      expect(low?.priority).toBeGreaterThanOrEqual(1);
      expect(low?.priority).toBeLessThanOrEqual(5);
      expect(high?.priority).toBeGreaterThanOrEqual(1);
      expect(high?.priority).toBeLessThanOrEqual(5);
      expect(high!.priority).toBeGreaterThan(low!.priority);
    });

    it('should add recovery score for lapsed donors', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({
          donorId: 'lapsed_001',
          segment: 'lapsed',
          recencyScore: 1,
          frequencyScore: 4,
          monetaryScore: 4,
        }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate()],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      const lapsed = enriched.find(a => a.donorId === 'lapsed_001');
      expect(lapsed?.recoveryScore).toBeDefined();
      expect(lapsed?.recoveryScore).toBeGreaterThan(0);
      expect(lapsed?.recoveryScore).toBeLessThanOrEqual(100);
    });

    it('should add upgrade score for current donors', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({
          donorId: 'current_001',
          segment: 'loyal',
          recencyScore: 5,
          frequencyScore: 4,
          monetaryScore: 3,
        }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate()],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      const current = enriched.find(a => a.donorId === 'current_001');
      expect(current?.upgradeScore).toBeDefined();
      expect(current?.upgradeScore).toBeGreaterThan(0);
      expect(current?.upgradeScore).toBeLessThanOrEqual(100);
    });

    it('should add prospect addresses for high-score ZIPs', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate({ prospectScore: 75 })],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      const prospects = enriched.filter(a => a.donorType === 'prospect');
      expect(prospects.length).toBeGreaterThan(0);
      expect(prospects[0].recommendedScript).toBe('voter_outreach');
    });

    it('should sort addresses by priority (highest first)', () => {
      const precincts: CanvassingPrecinct[] = [
        createMockCanvassingPrecinct(),
      ];

      const donorProfiles: DonorProfile[] = [
        createMockDonorProfile({ donorId: 'low', totalContributed: 100 }),
        createMockDonorProfile({ donorId: 'high', totalContributed: 10000 }),
        createMockDonorProfile({ donorId: 'medium', totalContributed: 2000 }),
      ];

      const zipAggregates = new Map<string, ZIPAggregate>([
        ['48823', createMockZIPAggregate()],
      ]);

      const enriched = DonorIntegrator.enrichWalkList(precincts, donorProfiles, zipAggregates);

      // Priorities should be descending
      for (let i = 0; i < enriched.length - 1; i++) {
        expect(enriched[i].priority).toBeGreaterThanOrEqual(enriched[i + 1].priority);
      }
    });
  });

  // ============================================================
  // getRecommendedScript Tests
  // ============================================================

  describe('getRecommendedScript', () => {
    it('should return correct script for lapsed donor', () => {
      const script = DonorIntegrator.getRecommendedScript('lapsed');
      expect(script).toBe('lapsed_donor_reengagement');
    });

    it('should return correct script for major donor', () => {
      const script = DonorIntegrator.getRecommendedScript('major');
      expect(script).toBe('major_donor_stewardship');
    });

    it('should return correct script for recurring donor', () => {
      const script = DonorIntegrator.getRecommendedScript('recurring');
      expect(script).toBe('recurring_donor_thank_you');
    });

    it('should return correct script for grassroots donor', () => {
      const script = DonorIntegrator.getRecommendedScript('grassroots');
      expect(script).toBe('upgrade_prospect_cultivation');
    });

    it('should return correct script for prospect', () => {
      const script = DonorIntegrator.getRecommendedScript('prospect');
      expect(script).toBe('voter_outreach_with_ask');
    });

    it('should return default script for none', () => {
      const script = DonorIntegrator.getRecommendedScript('none');
      expect(script).toBe('voter_outreach');
    });
  });

  // ============================================================
  // getConversationTips Tests
  // ============================================================

  describe('getConversationTips', () => {
    it('should return tips for lapsed donor', () => {
      const tips = DonorIntegrator.getConversationTips('lapsed');
      expect(Array.isArray(tips)).toBe(true);
      expect(tips.length).toBeGreaterThan(0);
      expect(tips.some(tip => tip.includes('noticed it\'s been a while'))).toBe(true);
    });

    it('should return tips for major donor', () => {
      const tips = DonorIntegrator.getConversationTips('major');
      expect(tips.some(tip => tip.toLowerCase().includes('brief'))).toBe(true);
      expect(tips.some(tip => tip.toLowerCase().includes('appreciation'))).toBe(true);
    });

    it('should return tips for recurring donor', () => {
      const tips = DonorIntegrator.getConversationTips('recurring');
      expect(tips.some(tip => tip.toLowerCase().includes('ongoing support'))).toBe(true);
    });

    it('should return tips for grassroots donor', () => {
      const tips = DonorIntegrator.getConversationTips('grassroots');
      expect(tips.some(tip => tip.toLowerCase().includes('grassroots'))).toBe(true);
    });

    it('should return tips for prospect', () => {
      const tips = DonorIntegrator.getConversationTips('prospect');
      expect(tips.some(tip => tip.toLowerCase().includes('voter concerns'))).toBe(true);
    });

    it('should include previous gift amount for lapsed donor with history', () => {
      const donor = createMockLapsedDonor({ lastGiftAmount: 500 });
      const tips = DonorIntegrator.getConversationTips('lapsed', donor);
      expect(tips.some(tip => tip.includes('$500'))).toBe(true);
    });
  });

  // ============================================================
  // getSpecialHandling Tests
  // ============================================================

  describe('getSpecialHandling', () => {
    it('should flag donors with $10,000+ as major donors', () => {
      const donor = createMockDonorProfile({ totalContributed: 15000 });
      const handling = DonorIntegrator.getSpecialHandling(donor);
      expect(handling).toContain('MAJOR DONOR');
    });

    it('should flag donors with $5,000+ as high-value', () => {
      const donor = createMockDonorProfile({ totalContributed: 7000 });
      const handling = DonorIntegrator.getSpecialHandling(donor);
      expect(handling).toContain('High-value donor');
    });

    it('should flag at-risk donors', () => {
      const donor = createMockDonorProfile({ segment: 'at_risk' });
      const handling = DonorIntegrator.getSpecialHandling(donor);
      expect(handling).toContain('At-risk donor');
    });

    it('should flag champion donors', () => {
      const donor = createMockDonorProfile({ segment: 'champion' });
      const handling = DonorIntegrator.getSpecialHandling(donor);
      expect(handling).toContain('Champion donor');
    });

    it('should return undefined for regular donors', () => {
      const donor = createMockDonorProfile({ totalContributed: 500, segment: 'loyal' });
      const handling = DonorIntegrator.getSpecialHandling(donor);
      expect(handling).toBeUndefined();
    });

    it('should work with lapsed donor records', () => {
      const donor = createMockLapsedDonor({ totalHistoricalAmount: 12000 });
      const handling = DonorIntegrator.getSpecialHandling(donor);
      expect(handling).toContain('MAJOR DONOR');
    });
  });

  // ============================================================
  // recordDonorContact Tests
  // ============================================================

  describe('recordDonorContact', () => {
    it('should record contact result without throwing', () => {
      const result: DonorCanvassingResult = {
        donorId: 'donor_001',
        contactDate: '2024-11-15',
        contactType: 'door',
        result: 'recovered',
        pledgeAmount: 250,
        followUpRequired: false,
        volunteerId: 'volunteer_001',
      };

      expect(() => {
        DonorIntegrator.recordDonorContact(result);
      }).not.toThrow();
    });

    it('should handle all result types', () => {
      const results: DonorCanvassingResult['result'][] = [
        'recovered',
        'declined',
        'not_home',
        'moved',
        'refused',
        'pending',
      ];

      results.forEach(resultType => {
        const result: DonorCanvassingResult = {
          donorId: 'donor_001',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: resultType,
          followUpRequired: false,
          volunteerId: 'volunteer_001',
        };

        expect(() => {
          DonorIntegrator.recordDonorContact(result);
        }).not.toThrow();
      });
    });
  });

  // ============================================================
  // generateRecoverySummary Tests
  // ============================================================

  describe('generateRecoverySummary', () => {
    it('should generate summary with correct totals', () => {
      const universe = createMockUniverse();

      const results: DonorCanvassingResult[] = [
        {
          donorId: 'donor_001',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'recovered',
          pledgeAmount: 250,
          actualAmount: 250,
          followUpRequired: false,
          volunteerId: 'vol_001',
        },
        {
          donorId: 'donor_002',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'recovered',
          pledgeAmount: 500,
          actualAmount: 400,
          followUpRequired: true,
          volunteerId: 'vol_001',
        },
        {
          donorId: 'donor_003',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'not_home',
          followUpRequired: true,
          volunteerId: 'vol_001',
        },
      ];

      const targeted: LapsedDonor[] = [
        createMockLapsedDonor({ donorId: 'donor_001' }),
        createMockLapsedDonor({ donorId: 'donor_002' }),
        createMockLapsedDonor({ donorId: 'donor_003' }),
        createMockLapsedDonor({ donorId: 'donor_004' }),
        createMockLapsedDonor({ donorId: 'donor_005' }),
      ];

      const summary = DonorIntegrator.generateRecoverySummary(universe, results, targeted);

      expect(summary.totalDonorsTargeted).toBe(5);
      expect(summary.totalAddressesVisited).toBe(3);
      expect(summary.donorsRecovered).toBe(2);
      expect(summary.totalPledged).toBe(750);
      expect(summary.totalCollected).toBe(650);
    });

    it('should calculate recovery rate correctly', () => {
      const universe = createMockUniverse();

      const results: DonorCanvassingResult[] = [
        {
          donorId: 'donor_001',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'recovered',
          followUpRequired: false,
          volunteerId: 'vol_001',
        },
        {
          donorId: 'donor_002',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'recovered',
          followUpRequired: false,
          volunteerId: 'vol_001',
        },
      ];

      const targeted: LapsedDonor[] = Array.from({ length: 10 }, (_, i) =>
        createMockLapsedDonor({ donorId: `donor_${i + 1}` })
      );

      const summary = DonorIntegrator.generateRecoverySummary(universe, results, targeted);

      expect(summary.recoveryRate).toBe(20); // 2 / 10 = 20%
      expect(summary.doorRecoveryRate).toBe(20);
    });

    it('should generate insights based on recovery rate', () => {
      const universe = createMockUniverse();

      const highRecoveryResults: DonorCanvassingResult[] = Array.from({ length: 25 }, (_, i) => ({
        donorId: `donor_${i + 1}`,
        contactDate: '2024-11-15',
        contactType: 'door' as const,
        result: 'recovered' as const,
        followUpRequired: false,
        volunteerId: 'vol_001',
      }));

      const targeted: LapsedDonor[] = Array.from({ length: 100 }, (_, i) =>
        createMockLapsedDonor({ donorId: `donor_${i + 1}` })
      );

      const summary = DonorIntegrator.generateRecoverySummary(universe, highRecoveryResults, targeted);

      expect(summary.insights.length).toBeGreaterThan(0);
      expect(summary.insights[0]).toContain('Excellent');
    });

    it('should generate recommendations for high not-home rate', () => {
      const universe = createMockUniverse();

      const results: DonorCanvassingResult[] = [
        ...Array.from({ length: 40 }, (_, i) => ({
          donorId: `donor_${i + 1}`,
          contactDate: '2024-11-15',
          contactType: 'door' as const,
          result: 'not_home' as const,
          followUpRequired: true,
          volunteerId: 'vol_001',
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          donorId: `donor_${i + 41}`,
          contactDate: '2024-11-15',
          contactType: 'door' as const,
          result: 'recovered' as const,
          followUpRequired: false,
          volunteerId: 'vol_001',
        })),
      ];

      const targeted: LapsedDonor[] = Array.from({ length: 50 }, (_, i) =>
        createMockLapsedDonor({ donorId: `donor_${i + 1}` })
      );

      const summary = DonorIntegrator.generateRecoverySummary(universe, results, targeted);

      expect(summary.recommendations.some(r => r.includes('not-home'))).toBe(true);
    });

    it('should generate recommendations for high refusal rate', () => {
      const universe = createMockUniverse();

      const results: DonorCanvassingResult[] = [
        ...Array.from({ length: 20 }, (_, i) => ({
          donorId: `donor_${i + 1}`,
          contactDate: '2024-11-15',
          contactType: 'door' as const,
          result: 'refused' as const,
          followUpRequired: false,
          volunteerId: 'vol_001',
        })),
        ...Array.from({ length: 80 }, (_, i) => ({
          donorId: `donor_${i + 21}`,
          contactDate: '2024-11-15',
          contactType: 'door' as const,
          result: 'recovered' as const,
          followUpRequired: false,
          volunteerId: 'vol_001',
        })),
      ];

      const targeted: LapsedDonor[] = Array.from({ length: 100 }, (_, i) =>
        createMockLapsedDonor({ donorId: `donor_${i + 1}` })
      );

      const summary = DonorIntegrator.generateRecoverySummary(universe, results, targeted);

      expect(summary.recommendations.some(r => r.includes('refusal'))).toBe(true);
    });

    it('should calculate contacts made (excluding not_home)', () => {
      const universe = createMockUniverse();

      const results: DonorCanvassingResult[] = [
        {
          donorId: 'donor_001',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'recovered',
          followUpRequired: false,
          volunteerId: 'vol_001',
        },
        {
          donorId: 'donor_002',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'not_home',
          followUpRequired: true,
          volunteerId: 'vol_001',
        },
        {
          donorId: 'donor_003',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'declined',
          followUpRequired: false,
          volunteerId: 'vol_001',
        },
      ];

      const targeted: LapsedDonor[] = Array.from({ length: 5 }, (_, i) =>
        createMockLapsedDonor({ donorId: `donor_${i + 1}` })
      );

      const summary = DonorIntegrator.generateRecoverySummary(universe, results, targeted);

      expect(summary.totalContactsMade).toBe(2); // Excludes not_home
    });

    it('should include historical comparison benchmarks', () => {
      const universe = createMockUniverse();
      const results: DonorCanvassingResult[] = [];
      const targeted: LapsedDonor[] = [];

      const summary = DonorIntegrator.generateRecoverySummary(universe, results, targeted);

      expect(summary.historicalMailRate).toBe(5);
      expect(summary.historicalPhoneRate).toBe(8);
    });

    it('should handle empty results gracefully', () => {
      const universe = createMockUniverse();
      const results: DonorCanvassingResult[] = [];
      const targeted: LapsedDonor[] = [];

      const summary = DonorIntegrator.generateRecoverySummary(universe, results, targeted);

      expect(summary.recoveryRate).toBe(0);
      expect(summary.totalPledged).toBe(0);
      expect(summary.totalCollected).toBe(0);
      expect(summary.donorsRecovered).toBe(0);
    });

    it('should track outstanding pledges in insights', () => {
      const universe = createMockUniverse();

      const results: DonorCanvassingResult[] = [
        {
          donorId: 'donor_001',
          contactDate: '2024-11-15',
          contactType: 'door',
          result: 'recovered',
          pledgeAmount: 1000,
          actualAmount: 500,
          followUpRequired: true,
          volunteerId: 'vol_001',
        },
      ];

      const targeted: LapsedDonor[] = [createMockLapsedDonor()];

      const summary = DonorIntegrator.generateRecoverySummary(universe, results, targeted);

      expect(summary.insights.some(i => i.includes('pledges still outstanding'))).toBe(true);
    });
  });
});
