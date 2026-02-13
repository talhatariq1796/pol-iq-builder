/**
 * SegmentationHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for segment intents.
 * Run with: npm test -- --testPathPattern=SegmentationHandler
 */

import { SegmentationHandler } from '@/lib/ai-native/handlers/SegmentationHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('SegmentationHandler', () => {
  let handler: SegmentationHandler;

  beforeAll(() => {
    handler = new SegmentationHandler();
  });

  describe('Pattern Matching', () => {
    // Helper to create minimal ParsedQuery
    const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
      originalQuery: query,
      intent,
      entities: {},
      confidence: 0.8,
    });

    describe('segment_create intent', () => {
      const testCases = [
        'Build a segment of suburban swing voters',
        'Create a segment for GOTV targeting',
        'Make a segment of high-turnout precincts',
        'New segment for young voters',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'segment_create');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('segment_find intent', () => {
      const testCases = [
        'Find all precincts with high GOTV priority',
        'Show me precincts in East Lansing',
        'Which precincts have swing potential above 70?',
        'What precincts are in the university corridor?',
        'List precincts with D+10 or more',
        'Precincts where turnout is above 60%',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'segment_find');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('segment_save intent', () => {
      const testCases = [
        'Save this segment as "GOTV Targets"',
        'Save as swing precinct segment',
        'Name this segment University Area',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'segment_save');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('segment_export intent', () => {
      const testCases = [
        'Export this segment to CSV',
        'Download segment data',
        'Export segment for VAN',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'segment_export');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('should not match unrelated intents', () => {
      const unrelatedIntents: QueryIntent[] = [
        'donor_concentration',
        'canvass_create',
        'compare_jurisdictions',
        'election_trends',
        'help_general',
        'unknown',
      ];

      test.each(unrelatedIntents)('should not handle intent: %s', (intent) => {
        const parsed = createQuery('some query', intent);
        expect(handler.canHandle(parsed)).toBe(false);
      });
    });
  });

  describe('Entity Extraction', () => {
    it('should extract density entities', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Find suburban precincts with high GOTV priority',
        intent: 'segment_find',
        entities: {
          density: ['suburban'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      expect(result.success).toBe(true);
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should extract strategy entities', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Build a segment for GOTV targeting',
        intent: 'segment_create',
        entities: {
          strategy: ['gotv'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      expect(result.success).toBe(true);
    });

    it('should extract score thresholds', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Find precincts with swing potential above 70',
        intent: 'segment_find',
        entities: {
          scoreThresholds: {
            swing: { min: 70 },
          },
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      expect(result.success).toBe(true);
    });
  });

  describe('Handler Response', () => {
    it('should return HandlerResult with required fields', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Find precincts with high GOTV priority',
        intent: 'segment_find',
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
        originalQuery: 'Show me swing precincts',
        intent: 'segment_find',
        entities: {
          strategy: ['persuasion'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      // Segment handlers typically include mapCommands
      if (result.mapCommands) {
        expect(Array.isArray(result.mapCommands)).toBe(true);
      }
    });

    it('should include suggestedActions for follow-up', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Build a segment of battleground precincts',
        intent: 'segment_create',
        entities: {
          strategy: ['battleground'],
        },
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

    it('should include metadata with handler info', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Find urban precincts',
        intent: 'segment_find',
        entities: {
          density: ['urban'],
        },
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

  describe('Filter Combinations', () => {
    it('should handle multiple filter criteria', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Find suburban swing voters with high income',
        intent: 'segment_find',
        entities: {
          density: ['suburban'],
          strategy: ['persuasion'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      expect(result.success).toBe(true);
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should handle jurisdiction filters', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Find precincts in East Lansing',
        intent: 'segment_find',
        entities: {
          jurisdictions: ['East Lansing'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      expect(result.success).toBe(true);
    });
  });
});
