/**
 * ReportHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for report intents.
 * Run with: npm test -- --testPathPattern=ReportHandler
 */

import { ReportHandler } from '@/lib/ai-native/handlers/ReportHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

// Type for report result data
interface ReportData {
  reportType?: string;
  subject?: string;
  sections?: string[];
}

describe('ReportHandler', () => {
  let handler: ReportHandler;

  beforeAll(() => {
    handler = new ReportHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('report_generate intent', () => {
      const testCases = [
        'Generate a political profile',
        'Create a report for East Lansing',
        'Build a campaign briefing',
        'Make a report',
        'PDF for Lansing',
        'Generate profile report',
        'Create comparison report',
        'Build donor report',
        'Generate canvassing report',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'report_generate');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('report_preview intent', () => {
      const testCases = [
        'Preview the report',
        'Show me the report preview',
        'What will the report include?',
        'What would the report look like?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'report_preview');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('report_generate returns profile report details', async () => {
      const parsed = createQuery('Generate a political profile for East Lansing', 'report_generate');
      const result = await handler.handle(parsed);
      const data = result.data as ReportData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Political Profile');
      expect(result.response).toContain('East Lansing');
      expect(result.response).toContain('Sections');
      expect(result.suggestedActions).toBeDefined();
      expect(data?.reportType).toBe('profile');
    });

    test('report_generate returns comparison report', async () => {
      const parsed = createQuery('Create a comparison report for Lansing vs Mason', 'report_generate');
      const result = await handler.handle(parsed);
      const data = result.data as ReportData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Comparison');
      expect(data?.reportType).toBe('comparison');
    });

    test('report_generate returns briefing report', async () => {
      const parsed = createQuery('Build a campaign briefing', 'report_generate');
      const result = await handler.handle(parsed);
      const data = result.data as ReportData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Briefing');
      expect(data?.reportType).toBe('briefing');
    });

    test('report_generate returns canvass report', async () => {
      const parsed = createQuery('Generate canvassing report', 'report_generate');
      const result = await handler.handle(parsed);
      const data = result.data as ReportData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Canvass');
      expect(data?.reportType).toBe('canvass');
    });

    test('report_generate returns donor report', async () => {
      const parsed = createQuery('Create a fundraising report', 'report_generate');
      const result = await handler.handle(parsed);
      const data = result.data as ReportData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Donor');
      expect(data?.reportType).toBe('donor');
    });

    test('report_generate returns segment report', async () => {
      const parsed = createQuery('Generate segment report', 'report_generate');
      const result = await handler.handle(parsed);
      const data = result.data as ReportData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Segment');
      expect(data?.reportType).toBe('segment');
    });

    test('report_generate defaults to Ingham County', async () => {
      const parsed = createQuery('Generate a political profile', 'report_generate');
      const result = await handler.handle(parsed);
      const data = result.data as ReportData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Ingham County');
      expect(data?.subject).toBe('Ingham County');
    });

    test('report_generate includes download actions', async () => {
      const parsed = createQuery('Generate report', 'report_generate');
      const result = await handler.handle(parsed);

      expect(result.suggestedActions).toBeDefined();
      const actionIds = result.suggestedActions!.map((a) => a.id);
      expect(actionIds).toContain('download-pdf');
      expect(actionIds).toContain('download-docx');
    });

    test('report_preview returns section list', async () => {
      const parsed = createQuery('Preview the report', 'report_preview');
      const result = await handler.handle(parsed);
      const data = result.data as ReportData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Report Preview');
      expect(result.response).toContain('Available Sections');
      expect(data?.sections).toBeDefined();
      expect(result.suggestedActions).toBeDefined();
    });

    test('report_preview includes generate action', async () => {
      const parsed = createQuery('Preview the report', 'report_preview');
      const result = await handler.handle(parsed);

      const actionIds = result.suggestedActions!.map((a) => a.id);
      expect(actionIds).toContain('generate-now');
    });
  });

  describe('Entity Extraction', () => {
    test('extracts jurisdiction from query', () => {
      const entities = handler.extractEntities('Generate report for East Lansing');
      expect(entities.jurisdictions).toBeDefined();
    });

    test('extracts comparison areas', () => {
      const entities = handler.extractEntities('Compare Lansing vs Mason');
      expect((entities as any).comparisonAreas).toBeDefined();
      expect((entities as any).comparisonAreas).toHaveLength(2);
    });

    test('extracts segment name', () => {
      const entities = handler.extractEntities('Report for the "suburban swing" segment');
      expect(entities.segmentName).toBe('suburban swing');
    });

    test('extracts PDF format', () => {
      const entities = handler.extractEntities('Export as PDF');
      expect(entities.format).toBe('pdf');
    });

    test('extracts Word/DOCX format', () => {
      const entities = handler.extractEntities('Export as Word document');
      expect(entities.format).toBe('docx');
    });
  });

  describe('Report Type Detection', () => {
    test('detects profile type', async () => {
      const parsed = createQuery('Create a profile report', 'report_generate');
      const result = await handler.handle(parsed);
      expect((result.data as ReportData)?.reportType).toBe('profile');
    });

    test('detects comparison type from keywords', async () => {
      const parsed = createQuery('Compare these areas', 'report_generate');
      const result = await handler.handle(parsed);
      expect((result.data as ReportData)?.reportType).toBe('comparison');
    });

    test('detects briefing type', async () => {
      const parsed = createQuery('Create a campaign brief', 'report_generate');
      const result = await handler.handle(parsed);
      expect((result.data as ReportData)?.reportType).toBe('briefing');
    });

    test('detects canvass type', async () => {
      const parsed = createQuery('Generate walk list report', 'report_generate');
      const result = await handler.handle(parsed);
      expect((result.data as ReportData)?.reportType).toBe('canvass');
    });

    test('detects donor type', async () => {
      const parsed = createQuery('Generate fundraising report', 'report_generate');
      const result = await handler.handle(parsed);
      expect((result.data as ReportData)?.reportType).toBe('donor');
    });

    test('detects segment type', async () => {
      const parsed = createQuery('Create target list report', 'report_generate');
      const result = await handler.handle(parsed);
      expect((result.data as ReportData)?.reportType).toBe('segment');
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('Generate report', 'report_generate');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('ReportHandler');
      expect(result.metadata?.queryType).toBe('report');
      expect(result.metadata?.matchedIntent).toBe('report_generate');
    });

    test('returns correct intent in metadata for preview', async () => {
      const parsed = createQuery('Preview the report', 'report_preview');
      const result = await handler.handle(parsed);

      expect(result.metadata?.matchedIntent).toBe('report_preview');
    });
  });
});
