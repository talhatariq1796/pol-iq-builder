/**
 * FilterHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for filter intents.
 * Run with: npm test -- --testPathPattern=FilterHandler
 */

import { FilterHandler } from '@/lib/ai-native/handlers/FilterHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('FilterHandler', () => {
  let handler: FilterHandler;

  beforeAll(() => {
    handler = new FilterHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('map_layer_change intent', () => {
      const testCases = [
        'Filter by swing potential',
        'Show only urban precincts',
        'Hide low-turnout precincts',
        'Precincts with GOTV above 70',
        'Precincts where turnout is high',
        'Areas with high persuasion score',
        'Display competitive precincts',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'map_layer_change');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('returns error when no filter criteria found', async () => {
      const parsed = createQuery('Filter by something', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('understand');
      expect(result.suggestedActions).toBeDefined();
    });

    test('successfully filters by GOTV metric', async () => {
      const parsed = createQuery('Show precincts with GOTV above 70', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.metadata?.handlerName).toBe('FilterHandler');
    });

    test('successfully filters by swing potential', async () => {
      const parsed = createQuery('Filter by swing potential', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('successfully filters by density type', async () => {
      const parsed = createQuery('Show only urban precincts', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('successfully filters by suburban density', async () => {
      const parsed = createQuery('Show suburban areas', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('successfully filters by rural density', async () => {
      const parsed = createQuery('Filter rural precincts', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('successfully filters by turnout metric', async () => {
      const parsed = createQuery('Show high turnout precincts', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('successfully filters by persuasion metric', async () => {
      const parsed = createQuery('Show persuadable voters', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('successfully filters by partisan lean', async () => {
      const parsed = createQuery('Show Democratic precincts', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('successfully filters by combined score', async () => {
      const parsed = createQuery('Show overall target score', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('successfully filters by competitiveness - toss up', async () => {
      const parsed = createQuery('Show toss-up precincts', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('extracts above threshold', async () => {
      const parsed = createQuery('Show precincts with GOTV above 80', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('extracts below threshold', async () => {
      const parsed = createQuery('Show precincts with swing below 50', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('extracts between threshold', async () => {
      const parsed = createQuery('Show swing between 40 and 60', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('Show swing potential', 'map_layer_change');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('FilterHandler');
      expect(result.metadata?.queryType).toBe('filter');
    });
  });
});
