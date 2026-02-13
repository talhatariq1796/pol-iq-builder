/**
 * IssueHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for issue intents.
 * Run with: npm test -- --testPathPattern=IssueHandler
 */

import { IssueHandler } from '@/lib/ai-native/handlers/IssueHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('IssueHandler', () => {
  let handler: IssueHandler;

  beforeAll(() => {
    handler = new IssueHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('issue_by_area intent', () => {
      const testCases = [
        'What issues matter in East Lansing?',
        'Top issues in Lansing',
        'Key issues for suburban voters',
        'What do voters in Meridian care about?',
        'Important issues in Ingham County',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'issue_by_area');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('issue_precincts intent', () => {
      const testCases = [
        'Which precincts care about healthcare?',
        'Precincts where education is important',
        'Find voters who care about the economy',
        'Healthcare issue precincts',
        'Where does housing matter most?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'issue_precincts');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('issue_analysis intent', () => {
      const testCases = [
        'Healthcare as a campaign issue',
        'Analyze education as an issue',
        'How does the economy play?',
        'Environment messaging',
        'Where does abortion resonate?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'issue_analysis');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('issue_by_area returns ranked issues for area', async () => {
      const parsed = createQuery('What issues matter in East Lansing?', 'issue_by_area');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Issues');
      expect(result.response).toContain('East Lansing');
      expect(result.suggestedActions).toBeDefined();
      expect(result.suggestedActions!.length).toBeGreaterThan(0);
      expect(result.data).toBeDefined();
    });

    test('issue_precincts returns precincts for issue', async () => {
      const parsed = createQuery('Which precincts care about healthcare?', 'issue_precincts');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Healthcare');
      expect(result.response).toContain('precincts');
      expect(result.mapCommands).toBeDefined();
    });

    test('issue_analysis returns detailed issue breakdown', async () => {
      const parsed = createQuery('Healthcare as a campaign issue', 'issue_analysis');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Healthcare');
      expect(result.response).toMatch(/Urban|Suburban|Rural/);
      expect(result.response).toContain('Messaging');
    });

    test('handles different issue types', async () => {
      const issues = ['healthcare', 'education', 'economy', 'housing', 'environment'];

      for (const issue of issues) {
        const parsed = createQuery(`${issue} as a campaign issue`, 'issue_analysis');
        const result = await handler.handle(parsed);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('What issues matter in Lansing?', 'issue_by_area');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('IssueHandler');
      expect(result.metadata?.matchedIntent).toBe('issue_by_area');
    });

    test('includes processing time', async () => {
      const parsed = createQuery('Healthcare messaging', 'issue_analysis');
      const result = await handler.handle(parsed);

      expect(result.metadata?.processingTimeMs).toBeDefined();
      expect(result.metadata?.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
