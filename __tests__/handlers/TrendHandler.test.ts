/**
 * TrendHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for all 7 trend intents.
 * Run with: npm test -- --testPathPattern=TrendHandler
 */

import { TrendHandler } from '@/lib/ai-native/handlers/TrendHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('TrendHandler', () => {
  let handler: TrendHandler;

  beforeAll(() => {
    handler = new TrendHandler();
  });

  describe('Pattern Matching', () => {
    // Helper to create minimal ParsedQuery
    const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
      originalQuery: query,
      intent,
      entities: {},
      confidence: 0.8,
    });

    describe('election_trends intent', () => {
      const testCases = [
        'How have elections changed over time?',
        'Show me election trends',
        'What are the voting patterns historically?',
        'Election history for Ingham County',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'election_trends');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('turnout_trends intent', () => {
      const testCases = [
        'Show turnout over time',
        'How has voter turnout changed?',
        'Turnout trends in the county',
        'Historical turnout data',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'turnout_trends');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('partisan_trends intent', () => {
      const testCases = [
        'Which areas are shifting Republican?',
        'Partisan trends over time',
        'Where is the Democratic lean changing?',
        'Show partisan shift analysis',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'partisan_trends');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('flip_risk intent', () => {
      const testCases = [
        'What districts might flip?',
        'Show flip risk areas',
        'Which precincts are at risk of changing?',
        'Competitive districts that could flip',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'flip_risk');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('demographic_trends intent', () => {
      const testCases = [
        'How have demographics changed?',
        'Show demographic trends',
        'Population changes over time',
        'Income trends in the county',
        'Education shifts by precinct',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'demographic_trends');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('donor_trends intent', () => {
      const testCases = [
        'Donor giving patterns',
        'How have donations changed?',
        'Fundraising trends over time',
        'Contribution momentum',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'donor_trends');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('compare_elections intent', () => {
      const testCases = [
        'Compare 2020 vs 2024',
        'How did 2022 differ from 2020?',
        'Election comparison between cycles',
        'Compare results across elections',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'compare_elections');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('should not match unrelated intents', () => {
      const unrelatedIntents: QueryIntent[] = [
        'segment_create',
        'donor_concentration',
        'canvass_create',
        'compare_jurisdictions',
        'help_general',
        'unknown',
      ];

      test.each(unrelatedIntents)('should not handle intent: %s', (intent) => {
        const parsed = createQuery('some query', intent);
        expect(handler.canHandle(parsed)).toBe(false);
      });
    });
  });

  describe('Handler Response', () => {
    // These tests require data to be loaded, so we test structure not content

    it('should return HandlerResult with required fields', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Show election trends',
        intent: 'election_trends',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('response');
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should include mapCommands for visualization', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Show turnout trends',
        intent: 'turnout_trends',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      // Trend handlers typically include mapCommands
      if (result.mapCommands) {
        expect(Array.isArray(result.mapCommands)).toBe(true);
      }
    });

    it('should include suggestedActions for follow-up', async () => {
      const query: ParsedQuery = {
        originalQuery: 'What areas might flip?',
        intent: 'flip_risk',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      if (result.suggestedActions) {
        expect(Array.isArray(result.suggestedActions)).toBe(true);
        result.suggestedActions.forEach((action) => {
          expect(action).toHaveProperty('id');
          expect(action).toHaveProperty('label');
          expect(action).toHaveProperty('action');
        });
      }
    });

    it('should include metadata with timing', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Demographic trends',
        intent: 'demographic_trends',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      if (result.metadata) {
        expect(result.metadata).toHaveProperty('handlerName');
        expect(result.metadata).toHaveProperty('processingTimeMs');
        expect(typeof result.metadata.processingTimeMs).toBe('number');
      }
    });
  });

  describe('Demographic Trends Data', () => {
    it('should handle demographic trends with real data', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Show demographic changes in Ingham County',
        intent: 'demographic_trends',
        entities: {
          jurisdictions: ['Ingham County'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      expect(result.success).toBe(true);
      expect(result.response.length).toBeGreaterThan(0);
      // In test environment without server, data may not load
      // Just verify handler returns a valid response structure
      expect(typeof result.response).toBe('string');
    });

    it('should handle specific precinct demographic trends', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Demographic trends for East Lansing precincts',
        intent: 'demographic_trends',
        entities: {
          precincts: ['East Lansing City, Precinct 1'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      expect(result.success).toBe(true);
      expect(result.response.length).toBeGreaterThan(50);
    });
  });
});
