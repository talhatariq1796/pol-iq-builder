/**
 * DataExportHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for data export intents.
 * Run with: npm test -- --testPathPattern=DataExportHandler
 */

import { DataExportHandler } from '@/lib/ai-native/handlers/DataExportHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('DataExportHandler', () => {
  let handler: DataExportHandler;

  beforeAll(() => {
    handler = new DataExportHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('export_segments intent', () => {
      const testCases = [
        'Export all my segments',
        'Download segments',
        'Save segments to CSV',
        'Segments to excel',
        'Export segment data',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'export_segments');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('export_voter_file intent', () => {
      const testCases = [
        'Export the voter file',
        'Download voter file',
        'Get the voter list',
        'Pull voter data',
        'Export voter records',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'export_voter_file');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('export_van intent', () => {
      const testCases = [
        'Sync with VAN',
        'Export to VAN',
        'VAN integration',
        'Send to VoteBuilder',
        'VAN compatible format',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'export_van');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('export_general intent', () => {
      const testCases = [
        'Export data to CSV',
        'Download all data',
        'Export to excel',
        'Get me a data export',
        'Save as spreadsheet',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'export_general');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('export_precincts intent', () => {
      const testCases = [
        'Export all precincts',
        'Download precinct data',
        'Precinct data export',
        'Export precinct list',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'export_precincts');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('export_donors intent', () => {
      const testCases = [
        'Export donors',
        'Download donor data',
        'Donor data export',
        'FEC data export',
        'Export donor list',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'export_donors');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('export_segments returns format options', async () => {
      const parsed = createQuery('Export all my segments', 'export_segments');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Export Segments');
      expect(result.response).toContain('CSV');
      expect(result.suggestedActions).toBeDefined();
      expect(result.suggestedActions!.length).toBeGreaterThanOrEqual(2);
    });

    test('export_voter_file returns file info', async () => {
      const parsed = createQuery('Download the voter file', 'export_voter_file');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Voter File');
      expect(result.response).toContain('precinct');
    });

    test('export_van returns VAN options', async () => {
      const parsed = createQuery('Sync with VAN', 'export_van');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('VAN');
      expect(result.response).toMatch(/Walk|Turf|Precinct/);
    });

    test('export_general returns data type options', async () => {
      const parsed = createQuery('Export data to CSV', 'export_general');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Export Options');
      expect(result.response).toContain('Segments');
      expect(result.response).toContain('Precincts');
    });

    test('export_precincts returns precinct export details', async () => {
      const parsed = createQuery('Export all precincts', 'export_precincts');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Precinct');
      expect(result.response).toContain('Included Fields');
    });

    test('export_donors returns donor export info', async () => {
      const parsed = createQuery('Export donors', 'export_donors');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Donor');
      expect(result.response).toContain('FEC');
    });

    test('all export intents include suggested actions', async () => {
      const intents: QueryIntent[] = [
        'export_segments',
        'export_voter_file',
        'export_van',
        'export_general',
        'export_precincts',
        'export_donors',
      ];

      for (const intent of intents) {
        const parsed = createQuery('test query', intent);
        const result = await handler.handle(parsed);
        expect(result.suggestedActions).toBeDefined();
        expect(result.suggestedActions!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('Export segments', 'export_segments');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('DataExportHandler');
      expect(result.metadata?.queryType).toBe('export');
    });

    test('includes export type in data', async () => {
      const parsed = createQuery('Export precincts', 'export_precincts');
      const result = await handler.handle(parsed);

      expect(result.data).toBeDefined();
      expect((result.data as any).exportType).toBe('precincts');
    });
  });
});
