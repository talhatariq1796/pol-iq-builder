/**
 * NavigationHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for navigation intents.
 * Run with: npm test -- --testPathPattern=NavigationHandler
 */

import { NavigationHandler } from '@/lib/ai-native/handlers/NavigationHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

// Type for navigation result data
interface NavigationData {
  destination: string;
  path: string;
}

describe('NavigationHandler', () => {
  let handler: NavigationHandler;

  beforeAll(() => {
    handler = new NavigationHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('navigate_tool intent', () => {
      const testCases = [
        'Go to segments page',
        'Open segmentation',
        'Navigate to donors',
        'Take me to canvassing',
        'Switch to comparison',
        'Show me the graph',
        'Go to home',
        'Segments page',
        'Donors dashboard',
        'Canvassing tool',
        'Comparison view',
        'Knowledge graph page',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'navigate_tool');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('navigate_settings intent', () => {
      const testCases = [
        'Go to settings',
        'Open settings',
        'Navigate to preferences',
        'Take me to configuration',
        'Settings page',
        'Preferences menu',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'navigate_settings');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('navigate_tool to segments returns navigation response', async () => {
      const parsed = createQuery('Go to segments page', 'navigate_tool');
      const result = await handler.handle(parsed);
      const data = result.data as NavigationData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Segmentation');
      expect(result.mapCommands).toBeDefined();
      expect(data?.destination).toBe('segments');
      expect(data?.path).toBe('/segments');
      expect(result.suggestedActions).toBeDefined();
    });

    test('navigate_tool to donors returns navigation response', async () => {
      const parsed = createQuery('Open donor analysis', 'navigate_tool');
      const result = await handler.handle(parsed);
      const data = result.data as NavigationData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Donor');
      expect(data?.destination).toBe('donors');
      expect(data?.path).toBe('/donors');
    });

    test('navigate_tool to canvassing returns navigation response', async () => {
      const parsed = createQuery('Take me to canvassing', 'navigate_tool');
      const result = await handler.handle(parsed);
      const data = result.data as NavigationData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Canvass');
      expect(data?.destination).toBe('canvass');
      expect(data?.path).toBe('/canvass');
    });

    test('navigate_tool to compare returns navigation response', async () => {
      const parsed = createQuery('Switch to comparison view', 'navigate_tool');
      const result = await handler.handle(parsed);
      const data = result.data as NavigationData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Comparison');
      expect(data?.destination).toBe('compare');
      expect(data?.path).toBe('/compare');
    });

    test('navigate_tool to graph returns navigation response', async () => {
      const parsed = createQuery('Go to knowledge graph', 'navigate_tool');
      const result = await handler.handle(parsed);
      const data = result.data as NavigationData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Knowledge Graph');
      expect(data?.destination).toBe('graph');
      expect(data?.path).toBe('/knowledge-graph');
    });

    test('navigate_tool to main returns navigation response', async () => {
      const parsed = createQuery('Go to home', 'navigate_tool');
      const result = await handler.handle(parsed);
      const data = result.data as NavigationData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Political AI');
      expect(data?.destination).toBe('main');
      expect(data?.path).toBe('/political-ai');
    });

    test('navigate_tool with unknown destination returns error', async () => {
      const parsed = createQuery('Go to xyz123', 'navigate_tool');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('Available pages');
      expect(result.suggestedActions).toBeDefined();
    });

    test('navigate_settings returns settings page', async () => {
      const parsed = createQuery('Open settings', 'navigate_settings');
      const result = await handler.handle(parsed);
      const data = result.data as NavigationData;

      expect(result.success).toBe(true);
      expect(result.response).toContain('Settings');
      expect(data?.destination).toBe('settings');
      expect(data?.path).toBe('/settings');
      expect(result.suggestedActions).toBeDefined();
    });
  });

  describe('Entity Extraction', () => {
    test('extracts segments destination', () => {
      const entities = handler.extractEntities('Go to segments page');
      expect((entities as any).destination).toBe('segments');
    });

    test('extracts donors destination', () => {
      const entities = handler.extractEntities('Open donor analysis');
      expect((entities as any).destination).toBe('donors');
    });

    test('extracts canvass destination', () => {
      const entities = handler.extractEntities('Navigate to canvassing');
      expect((entities as any).destination).toBe('canvass');
    });

    test('extracts compare destination', () => {
      const entities = handler.extractEntities('Switch to comparison');
      expect((entities as any).destination).toBe('compare');
    });

    test('extracts settings destination', () => {
      const entities = handler.extractEntities('Open settings');
      expect((entities as any).destination).toBe('settings');
    });
  });

  describe('Suggested Actions by Destination', () => {
    test('segments destination includes segment-specific actions', async () => {
      const parsed = createQuery('Go to segments', 'navigate_tool');
      const result = await handler.handle(parsed);

      expect(result.suggestedActions).toBeDefined();
      const actionIds = result.suggestedActions!.map((a) => a.id);
      expect(actionIds).toContain('create-segment');
    });

    test('donors destination includes donor-specific actions', async () => {
      const parsed = createQuery('Go to donors', 'navigate_tool');
      const result = await handler.handle(parsed);

      expect(result.suggestedActions).toBeDefined();
      const actionIds = result.suggestedActions!.map((a) => a.id);
      expect(actionIds).toContain('concentration');
    });

    test('canvass destination includes canvass-specific actions', async () => {
      const parsed = createQuery('Go to canvassing', 'navigate_tool');
      const result = await handler.handle(parsed);

      expect(result.suggestedActions).toBeDefined();
      const actionIds = result.suggestedActions!.map((a) => a.id);
      expect(actionIds).toContain('create-universe');
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('Go to segments', 'navigate_tool');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('NavigationHandler');
      expect(result.metadata?.queryType).toBe('navigation');
      expect(result.metadata?.destination).toBe('segments');
    });

    test('returns correct intent in metadata for settings', async () => {
      const parsed = createQuery('Open settings', 'navigate_settings');
      const result = await handler.handle(parsed);

      expect(result.metadata?.matchedIntent).toBe('navigate_settings');
      expect(result.metadata?.destination).toBe('settings');
    });
  });
});
