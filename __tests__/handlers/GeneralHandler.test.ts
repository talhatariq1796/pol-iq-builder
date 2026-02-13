/**
 * GeneralHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for general intents.
 * Run with: npm test -- --testPathPattern=GeneralHandler
 */

import { GeneralHandler } from '@/lib/ai-native/handlers/GeneralHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('GeneralHandler', () => {
  let handler: GeneralHandler;

  beforeAll(() => {
    handler = new GeneralHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('help_general intent', () => {
      const testCases = [
        'Help',
        'What can you do?',
        'How does this work?',
        'Show me capabilities',
        'What are my options?',
        'Getting started',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'help_general');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('help_tool intent', () => {
      const testCases = [
        'How do I use segments?',
        'Help with comparison',
        'Explain canvassing',
        'What is segmentation?',
        'How does donor work?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'help_tool');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('help_example intent', () => {
      const testCases = [
        'Show me examples',
        'Give me examples',
        'Sample queries',
        'Example questions',
        'What can I ask?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'help_example');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('retry_operation intent', () => {
      const testCases = [
        'Try again',
        'Retry',
        'One more time',
        'Do it again',
        'Repeat',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'retry_operation');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('error_explain intent', () => {
      const testCases = [
        'What went wrong?',
        'Why did it fail?',
        'What happened?',
        'Explain the error',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'error_explain');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('county_overview intent', () => {
      const testCases = [
        'Give me an overview of Ingham County',
        'Summary of the political landscape',
        'County at a glance',
        'County overview',
        'Political landscape of Ingham',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'county_overview');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('unknown intent', () => {
      test('should match unknown intent', () => {
        const parsed = createQuery('asdfghjkl', 'unknown');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('help_general returns capabilities list', async () => {
      const parsed = createQuery('Help', 'help_general');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Political Analysis Assistant');
      expect(result.response).toContain('Capabilities');
      expect(result.response).toContain('Segmentation');
      expect(result.suggestedActions).toBeDefined();
      expect(result.suggestedActions!.length).toBeGreaterThan(0);
    });

    test('help_tool returns tool-specific help', async () => {
      const parsed = createQuery('How do I use segments?', 'help_tool');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Segmentation');
      expect(result.suggestedActions).toBeDefined();
    });

    test('help_example returns example queries', async () => {
      const parsed = createQuery('Show me examples', 'help_example');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Example');
      expect(result.suggestedActions).toBeDefined();
    });

    test('retry_operation returns retry guidance', async () => {
      const parsed = createQuery('Try again', 'retry_operation');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Retry');
      expect(result.suggestedActions).toBeDefined();
    });

    test('error_explain returns troubleshooting guidance', async () => {
      const parsed = createQuery('What went wrong?', 'error_explain');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Common Issues');
      expect(result.suggestedActions).toBeDefined();
    });

    test('county_overview returns county summary', async () => {
      const parsed = createQuery('Overview of Ingham County', 'county_overview');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Ingham County');
      expect(result.response).toContain('Precincts');
      expect(result.mapCommands).toBeDefined();
      expect(result.suggestedActions).toBeDefined();
    });

    test('unknown returns fallback response', async () => {
      const parsed = createQuery('asdfghjkl', 'unknown');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('couldn\'t understand');
      expect(result.suggestedActions).toBeDefined();
    });
  });

  describe('Entity Extraction', () => {
    test('extracts tool name from help query', () => {
      const entities = handler.extractEntities('help with segmentation');
      expect((entities as any).toolName).toBe('segmentation');
    });

    test('extracts tool name from explain query', () => {
      const entities = handler.extractEntities('explain comparison');
      expect((entities as any).toolName).toBe('comparison');
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('Help', 'help_general');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('GeneralHandler');
      expect(result.metadata?.queryType).toBe('general');
      expect(result.metadata?.matchedIntent).toBe('help_general');
    });
  });
});
