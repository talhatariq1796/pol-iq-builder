/**
 * Tests for Candidate Comparison Engine
 */

import { CandidateRegistry } from '@/lib/donor/CandidateRegistry';
import { RecipientFilter } from '@/lib/donor/RecipientFilter';
import { ComparisonEngine } from '@/lib/donor/ComparisonEngine';

describe('CandidateRegistry', () => {
  it('should parse candidate ID format correctly', () => {
    const registry = new CandidateRegistry();
    // Test race key building
    expect((registry as any).buildRaceKey('MI', 'H', '07')).toBe('MI-H-07');
    expect((registry as any).buildRaceKey('MI', 'S', undefined)).toBe('MI-S-00');
    expect((registry as any).buildRaceKey('US', 'P', undefined)).toBe('US-P-00');
  });

  it('should normalize party strings correctly', () => {
    const registry = new CandidateRegistry();
    expect((registry as any).normalizeParty('DEMOCRATIC PARTY')).toBe('DEM');
    expect((registry as any).normalizeParty('REPUBLICAN PARTY')).toBe('REP');
    expect((registry as any).normalizeParty('OTHER')).toBe('OTHER');
  });

  it('should normalize office strings correctly', () => {
    const registry = new CandidateRegistry();
    expect((registry as any).normalizeOffice('House')).toBe('H');
    expect((registry as any).normalizeOffice('Senate')).toBe('S');
    expect((registry as any).normalizeOffice('President')).toBe('P');
  });
});

describe('RecipientFilter', () => {
  const mockContributions = [
    {
      id: '1',
      source: 'fec' as const,
      contributorName: 'John Doe',
      city: 'Lansing',
      state: 'MI',
      zipCode: '48933',
      committeeId: 'C00123456',
      candidateId: 'H4MI07210',
      party: 'DEM' as const,
      amount: 100,
      date: '2024-01-15',
      transactionType: 'individual',
      electionCycle: '2024',
    },
    {
      id: '2',
      source: 'fec' as const,
      contributorName: 'Jane Smith',
      city: 'Detroit',
      state: 'MI',
      zipCode: '48201',
      committeeId: 'C00123456',
      candidateId: 'H4MI07210',
      party: 'DEM' as const,
      amount: 500,
      date: '2024-02-20',
      transactionType: 'individual',
      electionCycle: '2024',
    },
    {
      id: '3',
      source: 'fec' as const,
      contributorName: 'Bob Johnson',
      city: 'Grand Rapids',
      state: 'MI',
      zipCode: '49503',
      committeeId: 'C00789012',
      candidateId: 'H4MI03XXX',
      party: 'REP' as const,
      amount: 250,
      date: '2024-03-10',
      transactionType: 'individual',
      electionCycle: '2024',
    },
  ];

  const filter = new RecipientFilter();

  it('should filter by candidate ID', () => {
    const result = filter.filterContributions(mockContributions, {
      candidateIds: ['H4MI07210'],
    });

    expect(result.contributions.length).toBe(2);
    expect(result.totalAmount).toBe(600);
    expect(result.donorCount).toBe(2);
  });

  it('should filter by party', () => {
    const result = filter.filterContributions(mockContributions, {
      party: 'DEM',
    });

    expect(result.contributions.length).toBe(2);
    expect(result.totalAmount).toBe(600);
  });

  it('should filter by amount range', () => {
    const result = filter.filterContributions(mockContributions, {
      minAmount: 200,
    });

    expect(result.contributions.length).toBe(2);
    expect(result.totalAmount).toBe(750);
  });

  it('should filter by date range', () => {
    const result = filter.filterContributions(mockContributions, {
      dateRange: {
        start: '2024-02-01',
        end: '2024-02-28',
      },
    });

    expect(result.contributions.length).toBe(1);
    expect(result.totalAmount).toBe(500);
  });

  it('should calculate correct aggregates', () => {
    const result = filter.filterContributions(mockContributions, {});

    expect(result.contributionCount).toBe(3);
    expect(result.totalAmount).toBe(850);
    expect(result.avgContribution).toBeCloseTo(283.33, 2);
    expect(result.medianContribution).toBe(250);
  });

  it('should get small dollar contributions', () => {
    const result = filter.getSmallDollarContributions(mockContributions);

    expect(result.contributions.length).toBe(1);
    expect(result.totalAmount).toBe(100);
  });

  it('should get large dollar contributions', () => {
    const result = filter.getLargeDollarContributions(mockContributions);

    expect(result.contributions.length).toBe(2);
    expect(result.totalAmount).toBe(750);
  });
});

describe('ComparisonEngine', () => {
  const engine = new ComparisonEngine();

  it('should calculate grassroots score correctly', () => {
    // High small dollar, high donor count, low avg contribution = high grassroots score
    const score1 = (engine as any).calculateGrassrootsScore(70, 1000, 50);
    expect(score1).toBeGreaterThan(90);

    // Low small dollar, low donor count, high avg contribution = low grassroots score
    const score2 = (engine as any).calculateGrassrootsScore(10, 100, 500);
    expect(score2).toBeLessThan(30);
  });

  it('should calculate geographic distribution correctly', () => {
    const mockContribs = [
      {
        id: '1',
        state: 'MI',
        zipCode: '48933',
        amount: 100,
      },
      {
        id: '2',
        state: 'MI',
        zipCode: '48864',
        amount: 200,
      },
      {
        id: '3',
        state: 'CA',
        zipCode: '90210',
        amount: 300,
      },
    ] as any;

    const result = (engine as any).calculateGeographicDistribution(mockContribs, 'MI');

    expect(result.inStatePct).toBeCloseTo(50, 1);
    expect(result.outOfStatePct).toBeCloseTo(50, 1);
    expect(result.topZips.length).toBeGreaterThan(0);
  });
});

describe('Integration Tests', () => {
  it('should build complete candidate profile', () => {
    // This would require loading actual data files
    // Skipped for unit test
  });

  it('should compare two candidates end-to-end', () => {
    // This would require loading actual data files
    // Skipped for unit test
  });
});
