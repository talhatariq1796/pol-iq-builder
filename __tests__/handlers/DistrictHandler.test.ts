/**
 * DistrictHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for district intents.
 * Run with: npm test -- --testPathPattern=DistrictHandler
 */

import { DistrictHandler } from '@/lib/ai-native/handlers/DistrictHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('DistrictHandler', () => {
  let handler: DistrictHandler;

  beforeAll(() => {
    handler = new DistrictHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('district_analysis intent', () => {
      const testCases = [
        'Show State House 73',
        'Analyze State House District 73',
        'View State Senate 21',
        'Display Congressional MI-07',
        'Show school district Okemos',
        'Political landscape of State House District 73',
        'Overview of State Senate District 21',
        'HD-73',
        'SD-21',
        'MI-07',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'district_analysis');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('district_compare intent', () => {
      const testCases = [
        'Compare State House 73 to State House 74',
        'Compare HD-73 vs HD-74',
        'HD-73 vs HD-74',
        'Compare Senate District 21 versus Senate District 28',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'district_compare');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('district_list intent', () => {
      const testCases = [
        'Show all districts',
        'List available districts',
        'What districts are in Ingham County?',
        'What state house districts are available?',
        'List of districts',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'district_list');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('district_precincts intent', () => {
      const testCases = [
        'What precincts are in State House 73?',
        'Which precincts are in HD-73?',
        'Show precincts in Senate District 21',
        'Precincts for SD-21',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'district_precincts');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('jurisdiction_lookup intent', () => {
      const testCases = [
        'Show all precincts in East Lansing',
        'What precincts are in Meridian?',
        'Lansing precincts',
        'Show precincts in Delhi',
        'East Lansing city precincts',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'jurisdiction_lookup');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('district_analysis returns error when no district specified', async () => {
      const parsed = createQuery('Show district analysis', 'district_analysis');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('specify');
      expect(result.suggestedActions).toBeDefined();
    });

    test('district_compare returns error when insufficient districts', async () => {
      const parsed = createQuery('Compare districts', 'district_compare');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('two districts');
    });

    test('district_list returns available districts', async () => {
      const parsed = createQuery('List all districts', 'district_list');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Available Districts');
      expect(result.response).toContain('Congressional');
      expect(result.response).toContain('State Senate');
      expect(result.response).toContain('State House');
      expect(result.response).toContain('School Districts');
    });

    test('district_precincts returns error when no district specified', async () => {
      const parsed = createQuery('Show precincts in district', 'district_precincts');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('specify');
    });

    test('jurisdiction_lookup returns error when no jurisdiction specified', async () => {
      const parsed = createQuery('Show precincts in the city', 'jurisdiction_lookup');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('specify');
    });
  });

  describe('Entity Extraction', () => {
    test('extracts State House district from query', () => {
      const entities = handler.extractEntities('Show State House 73');
      expect(entities.stateHouse).toBe('mi-house-73');
    });

    test('extracts State Senate district from query', () => {
      const entities = handler.extractEntities('Analyze Senate District 21');
      expect(entities.stateSenate).toBe('mi-senate-21');
    });

    test('extracts Congressional district from query', () => {
      const entities = handler.extractEntities('Show MI-07');
      expect(entities.congressional).toBe('mi-07');
    });

    test('extracts HD shorthand', () => {
      const entities = handler.extractEntities('HD-74');
      expect(entities.stateHouse).toBe('mi-house-74');
    });

    test('extracts SD shorthand', () => {
      const entities = handler.extractEntities('SD-28');
      expect(entities.stateSenate).toBe('mi-senate-28');
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('List all districts', 'district_list');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('DistrictHandler');
      expect(result.metadata?.queryType).toBe('district');
    });
  });
});
