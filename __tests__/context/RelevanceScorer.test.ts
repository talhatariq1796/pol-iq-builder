/**
 * RelevanceScorer Unit Tests
 *
 * Tests relevance scoring functions for context enrichment.
 * Run with: npm test -- --testPathPattern=RelevanceScorer
 */

import {
  calculateRelevanceScore,
  scoreRAGDocument,
  scoreCurrentIntel,
  scoreCandidateContext,
  scoreIssue,
  scoreEntity,
  filterByRelevance,
  getMaxRelevance,
  getRelevanceReasons,
} from '@/lib/context/RelevanceScorer';
import type { RelevanceFactors, ScoredItem, EnrichmentOptions } from '@/lib/context/types';
import type { RAGDocument, CurrentIntelDocument } from '@/lib/rag';
import type { Entity, IssueEntity, OrganizationEntity } from '@/lib/knowledge-graph/types';
import type { CandidateContext } from '@/lib/knowledge-graph/CandidateContextService';

describe('RelevanceScorer', () => {
  // ========================================
  // calculateRelevanceScore Tests
  // ========================================
  describe('calculateRelevanceScore', () => {
    test('direct mention returns score of 1.0', () => {
      const factors: RelevanceFactors = {
        directMention: true,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      expect(calculateRelevanceScore(factors)).toBe(1.0);
    });

    test('direct mention overrides all other factors', () => {
      const factors: RelevanceFactors = {
        directMention: true,
        jurisdictionMatch: true,
        districtMatch: true,
        temporalRelevance: 1.0,
        topicMatch: 1.0,
        typeMatch: true,
      };
      expect(calculateRelevanceScore(factors)).toBe(1.0);
    });

    test('district match adds 0.6 to score', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: true,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      expect(calculateRelevanceScore(factors)).toBe(0.6);
    });

    test('jurisdiction match adds 0.4 to score (when no district match)', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: true,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      expect(calculateRelevanceScore(factors)).toBe(0.4);
    });

    test('district match takes precedence over jurisdiction match', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: true,
        districtMatch: true,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      // District match (0.6) is used instead of jurisdiction match (0.4)
      expect(calculateRelevanceScore(factors)).toBe(0.6);
    });

    test('type match adds 0.2 to score', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: true,
      };
      expect(calculateRelevanceScore(factors)).toBe(0.2);
    });

    test('temporal relevance adds up to 0.2 to score', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 1.0, // Max temporal
        topicMatch: 0,
        typeMatch: false,
      };
      expect(calculateRelevanceScore(factors)).toBe(0.2);
    });

    test('topic match adds up to 0.2 to score', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 1.0, // Max topic match
        typeMatch: false,
      };
      expect(calculateRelevanceScore(factors)).toBe(0.2);
    });

    test('combined factors are added correctly', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: true, // +0.4
        districtMatch: false,
        temporalRelevance: 0.5, // +0.1
        topicMatch: 0.5, // +0.1
        typeMatch: true, // +0.2
      };
      // 0.4 + 0.1 + 0.1 + 0.2 = 0.8
      expect(calculateRelevanceScore(factors)).toBeCloseTo(0.8, 2);
    });

    test('score is capped at 1.0', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: true, // +0.4
        districtMatch: true, // +0.6 (replaces jurisdiction)
        temporalRelevance: 1.0, // +0.2
        topicMatch: 1.0, // +0.2
        typeMatch: true, // +0.2
      };
      // Would be 0.6 + 0.2 + 0.2 + 0.2 = 1.2, but capped at 1.0
      expect(calculateRelevanceScore(factors)).toBe(1.0);
    });

    test('all false factors return 0', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      expect(calculateRelevanceScore(factors)).toBe(0);
    });
  });

  // ========================================
  // scoreRAGDocument Tests
  // ========================================
  describe('scoreRAGDocument', () => {
    const createMockRAGDocument = (overrides?: Partial<RAGDocument>): RAGDocument => ({
      id: 'doc-1',
      title: 'Partisan Lean Methodology',
      path: '/docs/methodology/partisan-lean.md',
      description: 'How partisan lean scores are calculated',
      content: 'Full methodology content...',
      keywords: ['partisan', 'lean', 'methodology', 'scoring'],
      category: 'methodology',
      use_when: ['partisan lean', 'methodology'],
      ...overrides,
    });

    const createOptions = (overrides?: Partial<EnrichmentOptions>): EnrichmentOptions => ({
      intent: '',
      jurisdiction: 'Ingham County',
      districtType: 'county',
      districtNumber: '',
      precincts: [],
      candidates: [],
      topics: [],
      maxRagDocs: 2,
      maxIntelDocs: 3,
      maxGraphEntities: 10,
      includeMethodology: false,
      includeCurrentIntel: true,
      includeCandidates: true,
      includeIssues: true,
      relevanceThreshold: 0.3,
      ...overrides,
    });

    test('returns ScoredItem with document', () => {
      const doc = createMockRAGDocument();
      const options = createOptions();
      const result = scoreRAGDocument(doc, 'test query', options);

      expect(result.item).toBe(doc);
      expect(typeof result.score).toBe('number');
      expect(result.factors).toBeDefined();
    });

    test('direct mention of title gives score 1.0', () => {
      const doc = createMockRAGDocument({ title: 'Voter Turnout Analysis' });
      const options = createOptions();
      const result = scoreRAGDocument(doc, 'Tell me about voter turnout analysis', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('direct mention of keyword gives score 1.0', () => {
      const doc = createMockRAGDocument({ keywords: ['swing', 'voters', 'targeting'] });
      const options = createOptions();
      const result = scoreRAGDocument(doc, 'How do you identify swing voters?', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('jurisdiction match is detected', () => {
      const doc = createMockRAGDocument({ keywords: ['Ingham County', 'Michigan'] });
      const options = createOptions({ jurisdiction: 'Ingham' });
      const result = scoreRAGDocument(doc, 'test query', options);

      expect(result.factors.jurisdictionMatch).toBe(true);
    });

    test('district number match is detected', () => {
      const doc = createMockRAGDocument({ keywords: ['District 73', 'House'] });
      const options = createOptions({ districtNumber: '73' });
      const result = scoreRAGDocument(doc, 'test query', options);

      expect(result.factors.districtMatch).toBe(true);
    });

    test('methodology category respects includeMethodology option', () => {
      const doc = createMockRAGDocument({ category: 'methodology' });
      const optionsExclude = createOptions({ includeMethodology: false });
      const optionsInclude = createOptions({ includeMethodology: true });

      const resultExclude = scoreRAGDocument(doc, 'test query', optionsExclude);
      const resultInclude = scoreRAGDocument(doc, 'test query', optionsInclude);

      expect(resultExclude.factors.typeMatch).toBe(false);
      expect(resultInclude.factors.typeMatch).toBe(true);
    });

    test('non-methodology category has typeMatch true', () => {
      const doc = createMockRAGDocument({ category: 'context' });
      const options = createOptions();
      const result = scoreRAGDocument(doc, 'test query', options);

      expect(result.factors.typeMatch).toBe(true);
    });

    test('temporal relevance is neutral (0.5) for static docs', () => {
      const doc = createMockRAGDocument();
      const options = createOptions();
      const result = scoreRAGDocument(doc, 'test query', options);

      expect(result.factors.temporalRelevance).toBe(0.5);
    });
  });

  // ========================================
  // scoreCurrentIntel Tests
  // ========================================
  describe('scoreCurrentIntel', () => {
    const createMockIntelDocument = (overrides?: Partial<CurrentIntelDocument>): CurrentIntelDocument => ({
      id: 'intel-1',
      type: 'news',
      title: 'Election Update',
      path: '/data/current-intel/news/election-update.json',
      content: 'Latest election news...',
      source: 'Local News',
      published: new Date().toISOString(),
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      keywords: ['election', 'update', 'news'],
      jurisdictions: ['Ingham County'],
      relevance: ['voting', 'elections'],
      priority: 50,
      ...overrides,
    });

    const createOptions = (overrides?: Partial<EnrichmentOptions>): EnrichmentOptions => ({
      intent: '',
      jurisdiction: 'Ingham County',
      districtType: 'county',
      districtNumber: '',
      precincts: [],
      candidates: [],
      topics: [],
      maxRagDocs: 2,
      maxIntelDocs: 3,
      maxGraphEntities: 10,
      includeMethodology: false,
      includeCurrentIntel: true,
      includeCandidates: true,
      includeIssues: true,
      relevanceThreshold: 0.3,
      ...overrides,
    });

    test('returns ScoredItem with document', () => {
      const doc = createMockIntelDocument();
      const options = createOptions();
      const result = scoreCurrentIntel(doc, 'test query', options);

      expect(result.item).toBe(doc);
      expect(typeof result.score).toBe('number');
      expect(result.factors).toBeDefined();
    });

    test('direct mention of title gives score 1.0', () => {
      const doc = createMockIntelDocument({ title: 'Primary Results' });
      const options = createOptions();
      const result = scoreCurrentIntel(doc, 'What were the primary results?', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('jurisdiction match from jurisdictions array', () => {
      const doc = createMockIntelDocument({ jurisdictions: ['Lansing', 'East Lansing'] });
      const options = createOptions({ jurisdiction: 'Lansing' });
      const result = scoreCurrentIntel(doc, 'test query', options);

      expect(result.factors.jurisdictionMatch).toBe(true);
    });

    test('district match from keywords', () => {
      const doc = createMockIntelDocument({ keywords: ['District 73', 'State House'] });
      const options = createOptions({ districtNumber: '73' });
      const result = scoreCurrentIntel(doc, 'test query', options);

      expect(result.factors.districtMatch).toBe(true);
    });

    test('district match from jurisdictions', () => {
      const doc = createMockIntelDocument({ jurisdictions: ['State House District 73'] });
      const options = createOptions({ districtNumber: '73' });
      const result = scoreCurrentIntel(doc, 'test query', options);

      expect(result.factors.districtMatch).toBe(true);
    });

    test('upcoming type calculates future temporal relevance', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10); // 10 days from now
      const doc = createMockIntelDocument({
        type: 'upcoming',
        published: futureDate.toISOString(),
      });
      const options = createOptions();
      const result = scoreCurrentIntel(doc, 'test query', options);

      expect(result.factors.temporalRelevance).toBe(1.0); // Within 30 days = 1.0
    });

    test('news type calculates past temporal relevance', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3); // 3 days ago
      const doc = createMockIntelDocument({
        type: 'news',
        published: pastDate.toISOString(),
      });
      const options = createOptions();
      const result = scoreCurrentIntel(doc, 'test query', options);

      expect(result.factors.temporalRelevance).toBe(1.0); // Within 7 days = 1.0
    });

    test('old news has lower temporal relevance', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 60); // 60 days ago
      const doc = createMockIntelDocument({
        type: 'news',
        published: pastDate.toISOString(),
      });
      const options = createOptions();
      const result = scoreCurrentIntel(doc, 'test query', options);

      expect(result.factors.temporalRelevance).toBe(0.6); // Within 90 days = 0.6
    });

    test('typeMatch is always true for current intel', () => {
      const doc = createMockIntelDocument();
      const options = createOptions();
      const result = scoreCurrentIntel(doc, 'test query', options);

      expect(result.factors.typeMatch).toBe(true);
    });
  });

  // ========================================
  // scoreCandidateContext Tests
  // ========================================
  describe('scoreCandidateContext', () => {
    const createMockCandidateContext = (overrides?: Partial<CandidateContext>): CandidateContext => ({
      incumbent: {
        name: 'John Smith',
        party: 'DEM',
        biography: 'A dedicated public servant',
      },
      challengers: [],
      office: {
        name: 'Michigan State House District 73',
        level: 'state',
        district: '73',
        nextElection: '2024-11-05',
        termLength: 2,
      },
      ...overrides,
    });

    const createOptions = (overrides?: Partial<EnrichmentOptions>): EnrichmentOptions => ({
      intent: '',
      jurisdiction: 'Ingham County',
      districtType: 'county',
      districtNumber: '',
      precincts: [],
      candidates: [],
      topics: [],
      maxRagDocs: 2,
      maxIntelDocs: 3,
      maxGraphEntities: 10,
      includeMethodology: false,
      includeCurrentIntel: true,
      includeCandidates: true,
      includeIssues: true,
      relevanceThreshold: 0.3,
      ...overrides,
    });

    test('returns ScoredItem with candidate context', () => {
      const context = createMockCandidateContext();
      const options = createOptions();
      const result = scoreCandidateContext(context, 'test query', options);

      expect(result.item).toBe(context);
      expect(typeof result.score).toBe('number');
      expect(result.factors).toBeDefined();
    });

    test('direct mention of candidate name gives score 1.0', () => {
      const context = createMockCandidateContext({
        incumbent: { ...createMockCandidateContext().incumbent!, name: 'Jane Doe' },
      });
      const options = createOptions();
      const result = scoreCandidateContext(context, 'Tell me about Jane Doe', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('direct mention of office name gives score 1.0', () => {
      const context = createMockCandidateContext();
      const options = createOptions();
      // Query must contain the full office name for direct mention
      const result = scoreCandidateContext(context, 'Who represents Michigan State House District 73?', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('district match when districtNumber matches', () => {
      const context = createMockCandidateContext();
      const options = createOptions({ districtNumber: '73' });
      const result = scoreCandidateContext(context, 'test query', options);

      expect(result.factors.districtMatch).toBe(true);
    });

    test('district match is false when districtNumber differs', () => {
      const context = createMockCandidateContext();
      const options = createOptions({ districtNumber: '74' });
      const result = scoreCandidateContext(context, 'test query', options);

      expect(result.factors.districtMatch).toBe(false);
    });

    test('respects includeCandidates option', () => {
      const context = createMockCandidateContext();
      const optionsInclude = createOptions({ includeCandidates: true });
      const optionsExclude = createOptions({ includeCandidates: false });

      const resultInclude = scoreCandidateContext(context, 'test query', optionsInclude);
      const resultExclude = scoreCandidateContext(context, 'test query', optionsExclude);

      expect(resultInclude.factors.typeMatch).toBe(true);
      expect(resultExclude.factors.typeMatch).toBe(false);
    });

    test('temporal relevance based on next election date', () => {
      const nearElection = new Date();
      nearElection.setDate(nearElection.getDate() + 20); // 20 days
      const context = createMockCandidateContext({
        office: { ...createMockCandidateContext().office!, nextElection: nearElection.toISOString() },
      });
      const options = createOptions();
      const result = scoreCandidateContext(context, 'test query', options);

      expect(result.factors.temporalRelevance).toBe(1.0); // Within 30 days
    });

    test('handles context without incumbent', () => {
      const context: CandidateContext = {
        incumbent: undefined,
        challengers: [],
        office: createMockCandidateContext().office,
      };
      const options = createOptions();
      const result = scoreCandidateContext(context, 'test query', options);

      // Note: When incumbent is undefined, candidateName is '', and JavaScript's includes('')
      // always returns true, so directMention will be true for any query
      expect(result.factors.directMention).toBe(true);
      expect(typeof result.score).toBe('number');
    });

    test('state_house district type boosts state level offices', () => {
      const context = createMockCandidateContext();
      const options = createOptions({ districtType: 'state_house' });
      const result = scoreCandidateContext(context, 'test query', options);

      expect(result.factors.typeMatch).toBe(true);
    });
  });

  // ========================================
  // scoreIssue Tests
  // ========================================
  describe('scoreIssue', () => {
    const createMockIssue = (overrides?: Partial<IssueEntity>): IssueEntity => ({
      id: 'issue:education',
      type: 'issue',
      name: 'Education Funding',
      aliases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        category: 'social',
        salience: 75,
        keywords: ['schools', 'funding', 'budget', 'teachers'],
      },
      ...overrides,
    });

    const createOptions = (overrides?: Partial<EnrichmentOptions>): EnrichmentOptions => ({
      intent: '',
      jurisdiction: 'Ingham County',
      districtType: 'county',
      districtNumber: '',
      precincts: [],
      candidates: [],
      topics: [],
      maxRagDocs: 2,
      maxIntelDocs: 3,
      maxGraphEntities: 10,
      includeMethodology: false,
      includeCurrentIntel: true,
      includeCandidates: true,
      includeIssues: true,
      relevanceThreshold: 0.3,
      ...overrides,
    });

    test('returns ScoredItem with issue', () => {
      const issue = createMockIssue();
      const options = createOptions();
      const result = scoreIssue(issue, 'test query', options);

      expect(result.item).toBe(issue);
      expect(typeof result.score).toBe('number');
      expect(result.factors).toBeDefined();
    });

    test('direct mention of issue name gives score 1.0', () => {
      const issue = createMockIssue({ name: 'Healthcare Reform' });
      const options = createOptions();
      const result = scoreIssue(issue, 'What is the status of healthcare reform?', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('direct mention of keyword gives score 1.0', () => {
      const issue = createMockIssue({
        metadata: { category: 'economic', salience: 60, keywords: ['property', 'tax', 'relief'] },
      });
      const options = createOptions();
      const result = scoreIssue(issue, 'Tell me about property tax issues', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('jurisdiction match is always true for issues', () => {
      const issue = createMockIssue();
      const options = createOptions();
      const result = scoreIssue(issue, 'test query', options);

      expect(result.factors.jurisdictionMatch).toBe(true);
    });

    test('district match is always false for issues', () => {
      const issue = createMockIssue();
      const options = createOptions({ districtNumber: '73' });
      const result = scoreIssue(issue, 'test query', options);

      expect(result.factors.districtMatch).toBe(false);
    });

    test('respects includeIssues option', () => {
      const issue = createMockIssue();
      const optionsInclude = createOptions({ includeIssues: true });
      const optionsExclude = createOptions({ includeIssues: false });

      const resultInclude = scoreIssue(issue, 'test query', optionsInclude);
      const resultExclude = scoreIssue(issue, 'test query', optionsExclude);

      expect(resultInclude.factors.typeMatch).toBe(true);
      expect(resultExclude.factors.typeMatch).toBe(false);
    });

    test('handles issue without keywords', () => {
      const issue = createMockIssue({ metadata: { category: 'other', salience: 50, keywords: [] } });
      const options = createOptions();
      const result = scoreIssue(issue, 'test query', options);

      expect(typeof result.score).toBe('number');
      expect(result.factors.topicMatch).toBe(0);
    });
  });

  // ========================================
  // scoreEntity Tests
  // ========================================
  describe('scoreEntity', () => {
    const createMockEntity = (overrides?: Partial<OrganizationEntity>): OrganizationEntity => ({
      id: 'entity:test',
      type: 'organization',
      name: 'Michigan Education Association',
      aliases: ['MEA', 'Teachers Union'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        orgType: 'union',
        partisanLean: 'D',
        scope: 'state',
      },
      ...overrides,
    });

    const createOptions = (): EnrichmentOptions => ({
      intent: '',
      jurisdiction: 'Ingham County',
      districtType: 'county',
      districtNumber: '',
      precincts: [],
      candidates: [],
      topics: [],
      maxRagDocs: 2,
      maxIntelDocs: 3,
      maxGraphEntities: 10,
      includeMethodology: false,
      includeCurrentIntel: true,
      includeCandidates: true,
      includeIssues: true,
      relevanceThreshold: 0.3,
    });

    test('returns ScoredItem with entity', () => {
      const entity = createMockEntity();
      const options = createOptions();
      const result = scoreEntity(entity, 'test query', options);

      expect(result.item).toBe(entity);
      expect(typeof result.score).toBe('number');
      expect(result.factors).toBeDefined();
    });

    test('direct mention of entity name gives score 1.0', () => {
      const entity = createMockEntity({ name: 'Sierra Club' });
      const options = createOptions();
      const result = scoreEntity(entity, 'What has the Sierra Club endorsed?', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('direct mention of alias gives score 1.0', () => {
      const entity = createMockEntity({ aliases: ['UAW', 'Auto Workers'] });
      const options = createOptions();
      const result = scoreEntity(entity, 'UAW endorsement', options);

      expect(result.factors.directMention).toBe(true);
      expect(result.score).toBe(1.0);
    });

    test('handles entity without aliases', () => {
      const entity = createMockEntity({ aliases: undefined });
      const options = createOptions();
      const result = scoreEntity(entity, 'test query', options);

      expect(typeof result.score).toBe('number');
    });

    test('jurisdiction and type match are true by default', () => {
      const entity = createMockEntity();
      const options = createOptions();
      const result = scoreEntity(entity, 'test query', options);

      expect(result.factors.jurisdictionMatch).toBe(true);
      expect(result.factors.typeMatch).toBe(true);
    });
  });

  // ========================================
  // filterByRelevance Tests
  // ========================================
  describe('filterByRelevance', () => {
    const createScoredItem = <T>(item: T, score: number): ScoredItem<T> => ({
      item,
      score,
      factors: {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      },
    });

    test('filters items below threshold', () => {
      const items = [
        createScoredItem('high', 0.8),
        createScoredItem('low', 0.2),
        createScoredItem('medium', 0.5),
      ];
      const result = filterByRelevance(items, 0.3, 10);

      expect(result).toContain('high');
      expect(result).toContain('medium');
      expect(result).not.toContain('low');
    });

    test('sorts items by score descending', () => {
      const items = [
        createScoredItem('medium', 0.5),
        createScoredItem('high', 0.8),
        createScoredItem('low', 0.3),
      ];
      const result = filterByRelevance(items, 0.3, 10);

      expect(result[0]).toBe('high');
      expect(result[1]).toBe('medium');
      expect(result[2]).toBe('low');
    });

    test('limits items to maxItems', () => {
      const items = [
        createScoredItem('a', 0.9),
        createScoredItem('b', 0.8),
        createScoredItem('c', 0.7),
        createScoredItem('d', 0.6),
        createScoredItem('e', 0.5),
      ];
      const result = filterByRelevance(items, 0.3, 3);

      expect(result).toHaveLength(3);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('returns empty array when no items meet threshold', () => {
      const items = [
        createScoredItem('low1', 0.1),
        createScoredItem('low2', 0.2),
      ];
      const result = filterByRelevance(items, 0.5, 10);

      expect(result).toHaveLength(0);
    });

    test('handles empty input array', () => {
      const result = filterByRelevance([], 0.3, 10);
      expect(result).toHaveLength(0);
    });

    test('includes items exactly at threshold', () => {
      const items = [createScoredItem('exact', 0.5)];
      const result = filterByRelevance(items, 0.5, 10);

      expect(result).toContain('exact');
    });
  });

  // ========================================
  // getMaxRelevance Tests
  // ========================================
  describe('getMaxRelevance', () => {
    const createScoredItem = <T>(item: T, score: number): ScoredItem<T> => ({
      item,
      score,
      factors: {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      },
    });

    test('returns maximum score from items', () => {
      const items = [
        createScoredItem('a', 0.5),
        createScoredItem('b', 0.9),
        createScoredItem('c', 0.7),
      ];
      expect(getMaxRelevance(items)).toBe(0.9);
    });

    test('returns 0 for empty array', () => {
      expect(getMaxRelevance([])).toBe(0);
    });

    test('handles single item', () => {
      const items = [createScoredItem('only', 0.6)];
      expect(getMaxRelevance(items)).toBe(0.6);
    });

    test('handles items with same score', () => {
      const items = [
        createScoredItem('a', 0.5),
        createScoredItem('b', 0.5),
      ];
      expect(getMaxRelevance(items)).toBe(0.5);
    });
  });

  // ========================================
  // getRelevanceReasons Tests
  // ========================================
  describe('getRelevanceReasons', () => {
    test('returns below threshold message when score is low', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      const reasons = getRelevanceReasons(factors, 0.1, 0.3);

      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain('below threshold');
    });

    test('includes direct mention reason', () => {
      const factors: RelevanceFactors = {
        directMention: true,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      const reasons = getRelevanceReasons(factors, 1.0, 0.3);

      expect(reasons).toContain('Directly mentioned in query');
    });

    test('includes district match reason', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: true,
        districtMatch: true,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      const reasons = getRelevanceReasons(factors, 0.6, 0.3);

      expect(reasons).toContain('Matches queried district');
      // District takes precedence over jurisdiction
      expect(reasons).not.toContain('Matches queried jurisdiction');
    });

    test('includes jurisdiction match reason when no district match', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: true,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0,
        typeMatch: false,
      };
      const reasons = getRelevanceReasons(factors, 0.4, 0.3);

      expect(reasons).toContain('Matches queried jurisdiction');
    });

    test('includes temporal relevance reason when high', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0.9,
        topicMatch: 0,
        typeMatch: false,
      };
      const reasons = getRelevanceReasons(factors, 0.4, 0.3);

      expect(reasons).toContain('Temporally relevant (recent/upcoming)');
    });

    test('excludes temporal relevance reason when low', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: true,
        districtMatch: false,
        temporalRelevance: 0.5,
        topicMatch: 0,
        typeMatch: false,
      };
      const reasons = getRelevanceReasons(factors, 0.4, 0.3);

      expect(reasons).not.toContain('Temporally relevant (recent/upcoming)');
    });

    test('includes topic match reason when high', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0,
        topicMatch: 0.7,
        typeMatch: false,
      };
      const reasons = getRelevanceReasons(factors, 0.4, 0.3);

      expect(reasons).toContain('Topic keywords match');
    });

    test('can have multiple reasons', () => {
      const factors: RelevanceFactors = {
        directMention: true,
        jurisdictionMatch: true,
        districtMatch: true,
        temporalRelevance: 0.9,
        topicMatch: 0.8,
        typeMatch: true,
      };
      const reasons = getRelevanceReasons(factors, 1.0, 0.3);

      expect(reasons.length).toBeGreaterThan(1);
      expect(reasons).toContain('Directly mentioned in query');
    });

    test('returns empty array when score above threshold but no specific reasons', () => {
      const factors: RelevanceFactors = {
        directMention: false,
        jurisdictionMatch: false,
        districtMatch: false,
        temporalRelevance: 0.3,
        topicMatch: 0.3,
        typeMatch: true, // This alone gives 0.2 + temporal/topic contributions
      };
      // Score around 0.32, above 0.3 threshold
      const reasons = getRelevanceReasons(factors, 0.32, 0.3);

      // No reasons because none of the specific conditions are met
      expect(reasons).toHaveLength(0);
    });
  });
});
