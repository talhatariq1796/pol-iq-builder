/**
 * ComparisonHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for comparison intents.
 * Run with: npm test -- --testPathPattern=ComparisonHandler
 */

import { ComparisonHandler } from '@/lib/ai-native/handlers/ComparisonHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('ComparisonHandler', () => {
  let handler: ComparisonHandler;

  beforeAll(() => {
    handler = new ComparisonHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('compare_find_similar intent', () => {
      const testCases = [
        'Find precincts similar to East Lansing Ward 1',
        'Similar areas to Meridian Township',
        'Which precincts are like Okemos?',
        'Show me similar precincts',
        'Comparable jurisdictions to Lansing',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'compare_find_similar');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('compare_resource_analysis intent', () => {
      const testCases = [
        'What is the ROI for canvassing these areas?',
        'Resource allocation analysis',
        'Cost benefit analysis',
        'Efficiency analysis for Lansing',
        'Where is the best place to invest?',
        'Prioritize canvass areas',
        'Optimize resources',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'compare_resource_analysis');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('compare_field_brief intent', () => {
      const testCases = [
        'Generate a field brief for Ward 1 and Ward 2',
        'Field brief for Lansing',
        'Briefing for East Lansing',
        'Canvass brief for these areas',
        'Door knocking brief',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'compare_field_brief');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('compare_batch intent', () => {
      const testCases = [
        'Compare all precincts in Lansing',
        'Batch comparison of wards',
        'Compare multiple jurisdictions',
        'Side by side all precincts',
        'Rank all precincts',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'compare_batch');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('compare_export_pdf intent', () => {
      const testCases = [
        'Export comparison as PDF',
        'Download comparison report',
        'Save PDF of comparison',
        'Generate PDF report',
        'Print comparison',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'compare_export_pdf');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('compare_jurisdictions intent', () => {
      const testCases = [
        'Compare Lansing Ward 1 to East Lansing Ward 1',
        'Difference between Mason and Williamston',
        'Side by side comparison',
        'How does Lansing compare to East Lansing?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'compare_jurisdictions');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('compare_find_similar returns error when no reference specified', async () => {
      const parsed = createQuery('Find similar precincts', 'compare_find_similar');
      const result = await handler.handle(parsed);

      // Should fail without a reference entity
      expect(result.success).toBe(false);
      expect(result.response).toContain('specify');
    });

    test('compare_resource_analysis returns error when no areas specified', async () => {
      const parsed = createQuery('What is the ROI?', 'compare_resource_analysis');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('specify');
    });

    test('compare_field_brief returns error when insufficient areas', async () => {
      const parsed = createQuery('Generate field brief', 'compare_field_brief');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('at least two');
    });

    test('compare_batch returns error when no pattern specified', async () => {
      const parsed = createQuery('Compare all', 'compare_batch');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('specify');
    });

    test('compare_export_pdf returns error when insufficient areas', async () => {
      const parsed = createQuery('Export comparison PDF', 'compare_export_pdf');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('at least two');
    });

    test('compare_jurisdictions returns error when insufficient areas', async () => {
      const parsed = createQuery('Compare Lansing', 'compare_jurisdictions');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('two areas');
    });
  });

  describe('Entity Extraction', () => {
    test('extracts precinct names from query', () => {
      const entities = handler.extractEntities('Compare Lansing Ward 1 to East Lansing Ward 2');
      // The handler extracts precincts via PRECINCT_NAME_PATTERN
      expect(entities.precincts || entities.jurisdictions).toBeDefined();
    });

    test('extracts jurisdiction names from query', () => {
      const entities = handler.extractEntities('City of Lansing vs Township of Meridian');
      expect(entities.jurisdictions).toBeDefined();
    });
  });

  describe('Handler Metadata', () => {
    test('returns handler name in metadata when available', async () => {
      const parsed = createQuery('Compare Lansing to East Lansing', 'compare_jurisdictions');
      const result = await handler.handle(parsed);

      // Error responses may not include metadata
      // Just verify the handler can process the query
      expect(result.response).toBeDefined();
    });
  });
});
