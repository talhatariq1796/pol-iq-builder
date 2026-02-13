/**
 * ElectionResultsHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for election result intents.
 * Run with: npm test -- --testPathPattern=ElectionResultsHandler
 */

import { ElectionResultsHandler } from '@/lib/ai-native/handlers/ElectionResultsHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('ElectionResultsHandler', () => {
  let handler: ElectionResultsHandler;

  beforeAll(() => {
    handler = new ElectionResultsHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('election_results intent', () => {
      const testCases = [
        'What were the 2020 results?',
        'Show me 2022 election results',
        '2024 results',
        'How did the 2020 election go?',
        'Results from 2018',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'election_results');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('election_candidate_results intent', () => {
      const testCases = [
        'How did Biden do?',
        'Trump results in Ingham',
        'Harris performance',
        'Whitmer margin',
        'How did Slotkin do in Lansing?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'election_candidate_results');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('election_turnout intent', () => {
      const testCases = [
        'Show me the 2020 turnout',
        'Turnout in 2022',
        'Voter turnout history',
        'How many people voted in 2020?',
        'Turnout results',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'election_turnout');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('election_history intent', () => {
      const testCases = [
        'Election history for Lansing',
        'How has Ingham County voted historically?',
        'Historical results for East Lansing',
        'Past election results',
        'Voting history over time',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'election_history');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('election_results returns year-specific results', async () => {
      const parsed = createQuery('What were the 2020 results?', 'election_results');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('2020');
      expect(result.response).toContain('Election Results');
      expect(result.response).toMatch(/Biden|Trump/);
      expect(result.suggestedActions).toBeDefined();
    });

    test('election_candidate_results returns candidate performance', async () => {
      const parsed = createQuery('How did Biden do?', 'election_candidate_results');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Biden');
      expect(result.response).toMatch(/%/);
    });

    test('election_turnout returns turnout data', async () => {
      const parsed = createQuery('Show me the 2020 turnout', 'election_turnout');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Turnout');
      expect(result.response).toMatch(/%/);
    });

    test('election_history returns multi-year comparison', async () => {
      const parsed = createQuery('Election history for Ingham County', 'election_history');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('History');
      expect(result.response).toContain('Presidential');
    });

    test('handles multiple election years', async () => {
      const years = ['2016', '2018', '2020', '2022', '2024'];

      for (const year of years) {
        const parsed = createQuery(`${year} results`, 'election_results');
        const result = await handler.handle(parsed);
        expect(result.success).toBe(true);
      }
    });

    test('defaults to 2020 for unrecognized year patterns', async () => {
      // The handler extracts year from pattern (?:20)?(20|22|24|18|16)
      // "2010" doesn't match, so defaults to yearSuffix '20' -> 2020
      const parsed = createQuery('What were the 2010 results?', 'election_results');
      const result = await handler.handle(parsed);

      // Defaults to 2020 since 10 isn't a valid suffix
      expect(result.success).toBe(true);
      expect(result.response).toContain('2020');
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('2020 results', 'election_results');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('ElectionResultsHandler');
      expect(result.metadata?.queryType).toBe('election_results');
    });
  });
});
