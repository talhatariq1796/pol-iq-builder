/**
 * SpatialHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for spatial intents.
 * Run with: npm test -- --testPathPattern=SpatialHandler
 */

import { SpatialHandler } from '@/lib/ai-native/handlers/SpatialHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('SpatialHandler', () => {
  let handler: SpatialHandler;

  beforeAll(() => {
    handler = new SpatialHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('spatial_query intent', () => {
      const testCases = [
        "What's near East Lansing?",
        'Show me nearby precincts',
        'In the area of Lansing',
        'Within 5 miles of Mason',
        'Surrounding area of Okemos',
        'Close to Meridian',
        'Adjacent to Delhi',
        'Find precincts near MSU',
        'Precincts near Lansing',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'spatial_query');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('map_click intent', () => {
      const testCases = [
        'Clicked on the precinct',
        'Selected the area',
        'Tell me about this precinct',
        'What is that area?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'map_click');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('map_selection intent', () => {
      const testCases = [
        'Selected area',
        'Drew a boundary',
        'Made a selection',
        'These precincts',
        'Analyze this area',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'map_selection');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('map_zoom intent', () => {
      const testCases = [
        'Zoom to Lansing',
        'Center on East Lansing',
        'Focus on Meridian',
        'Fly to Mason',
        'Go to Okemos',
        'Navigate to Delhi',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'map_zoom');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('map_highlight intent', () => {
      const testCases = [
        'Highlight these precincts',
        'Show me these areas on the map',
        'Mark these precincts',
        'Emphasize these areas',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'map_highlight');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('spatial_query returns area analysis', async () => {
      const parsed = createQuery("What's near East Lansing?", 'spatial_query');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('East Lansing');
      expect(result.response).toContain('near');
      expect(result.mapCommands).toBeDefined();
      expect(result.suggestedActions).toBeDefined();
    });

    test('spatial_query with distance returns buffer info', async () => {
      const parsed = createQuery('Within 5 miles of Mason', 'spatial_query');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Mason');
      expect(result.response).toContain('5');
    });

    test('spatial_query without location still succeeds', async () => {
      const parsed = createQuery('Show me nearby precincts', 'spatial_query');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      // Response contains guidance for users
      expect(result.response).toBeDefined();
    });

    test('map_click returns precinct info prompt', async () => {
      const parsed = createQuery('Tell me about this precinct', 'map_click');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('selected');
      expect(result.response).toContain('Electoral');
      expect(result.suggestedActions).toBeDefined();
    });

    test('map_selection returns area analysis prompt', async () => {
      const parsed = createQuery('Analyze this area', 'map_selection');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Analyzing');
      expect(result.response).toContain('multiple precincts');
      expect(result.mapCommands).toBeDefined();
      expect(result.suggestedActions).toBeDefined();
    });

    test('map_zoom returns success when location specified', async () => {
      const parsed = createQuery('Zoom to Lansing', 'map_zoom');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Lansing');
      expect(result.mapCommands).toBeDefined();
      expect(result.mapCommands![0].type).toBe('flyTo');
    });

    test('map_zoom returns error when no location specified', async () => {
      const parsed = createQuery('Zoom to somewhere', 'map_zoom');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('specify');
      expect(result.suggestedActions).toBeDefined();
    });

    test('map_highlight returns error when no precincts specified', async () => {
      const parsed = createQuery('Highlight some precincts', 'map_highlight');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(false);
      expect(result.response).toContain('specify');
      expect(result.suggestedActions).toBeDefined();
    });
  });

  describe('Entity Extraction', () => {
    test('extracts jurisdiction from query', () => {
      const entities = handler.extractEntities('Show precincts near Lansing');
      expect(entities.jurisdictions).toBeDefined();
      // Jurisdictions are extracted with original casing
      const lowerJurisdictions = entities.jurisdictions!.map((j) => j.toLowerCase());
      expect(lowerJurisdictions).toContain('lansing');
    });

    test('extracts East Lansing jurisdiction', () => {
      const entities = handler.extractEntities("What's near East Lansing?");
      expect(entities.jurisdictions).toBeDefined();
    });

    test('extracts metric from query', () => {
      const entities = handler.extractEntities('Show swing potential near Lansing');
      expect(entities.scoreThresholds).toBeDefined();
    });

    test('extracts GOTV metric', () => {
      const entities = handler.extractEntities('GOTV heatmap near Meridian');
      expect(entities.scoreThresholds).toBeDefined();
    });
  });

  describe('Distance Extraction', () => {
    test('extracts miles distance', async () => {
      const parsed = createQuery('Within 5 miles of Mason', 'spatial_query');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.mapCommands).toBeDefined();
      // Buffer should be generated
    });

    test('extracts kilometers distance', async () => {
      const parsed = createQuery('Within 10 km of Lansing', 'spatial_query');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });

    test('handles decimal distances', async () => {
      const parsed = createQuery('Within 2.5 miles of Okemos', 'spatial_query');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
    });
  });

  describe('Map Commands', () => {
    test('spatial_query generates flyTo command', async () => {
      const parsed = createQuery("What's near East Lansing?", 'spatial_query');
      const result = await handler.handle(parsed);

      expect(result.mapCommands).toBeDefined();
      const flyToCmd = result.mapCommands!.find((c) => c.type === 'flyTo');
      expect(flyToCmd).toBeDefined();
    });

    test('map_zoom generates flyTo command', async () => {
      const parsed = createQuery('Zoom to Lansing', 'map_zoom');
      const result = await handler.handle(parsed);

      expect(result.mapCommands).toBeDefined();
      expect(result.mapCommands![0].type).toBe('flyTo');
      expect(result.mapCommands![0].target).toBe('Lansing');
    });

    test('map_selection generates showChoropleth command', async () => {
      const parsed = createQuery('Analyze this area', 'map_selection');
      const result = await handler.handle(parsed);

      expect(result.mapCommands).toBeDefined();
      expect(result.mapCommands![0].type).toBe('showChoropleth');
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery("What's near Lansing?", 'spatial_query');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('SpatialHandler');
      expect(result.metadata?.queryType).toBe('spatial');
      expect(result.metadata?.matchedIntent).toBe('spatial_query');
    });

    test('returns correct intent in metadata for zoom', async () => {
      const parsed = createQuery('Zoom to Lansing', 'map_zoom');
      const result = await handler.handle(parsed);

      expect(result.metadata?.matchedIntent).toBe('map_zoom');
    });

    test('returns correct intent in metadata for click', async () => {
      const parsed = createQuery('Clicked on precinct', 'map_click');
      const result = await handler.handle(parsed);

      expect(result.metadata?.matchedIntent).toBe('map_click');
    });
  });
});
