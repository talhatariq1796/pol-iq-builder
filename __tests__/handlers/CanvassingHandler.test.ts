/**
 * CanvassingHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for canvassing intents.
 * Run with: npm test -- --testPathPattern=CanvassingHandler
 */

import { CanvassingHandler } from '@/lib/ai-native/handlers/CanvassingHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('CanvassingHandler', () => {
  let handler: CanvassingHandler;

  beforeAll(() => {
    handler = new CanvassingHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('canvass_create intent', () => {
      const testCases = [
        'Create a canvassing universe',
        'Build a canvass universe from my segment',
        'New canvass universe for East Lansing',
        'Canvass from segment suburban swing',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvass_create');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvass_plan intent', () => {
      const testCases = [
        'Plan a canvass for next week',
        'Create a canvassing plan',
        '5000 door canvass',
        'Canvass in Meridian Township',
        'Knock doors in East Lansing',
        'Door knock plan',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvass_plan');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvass_estimate intent', () => {
      const testCases = [
        'How many volunteers do I need?',
        'Volunteers I need for 10000 doors',
        'Staffing estimate for canvassing',
        'Estimate staffing needs',
        'How long will the canvass take?',
        'Hours to canvass 5000 doors',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvass_estimate');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvass_export intent', () => {
      const testCases = [
        'Export walk list',
        'Download walk list',
        'Generate walk list',
        'Export turf assignments',
        'VAN export',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvass_export');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvassing_assign_volunteers intent', () => {
      const testCases = [
        'Assign volunteers to turfs',
        'Who should canvass this area?',
        'Recommend volunteers for this turf',
        'Best volunteers for East Lansing',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvassing_assign_volunteers');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvassing_view_progress intent', () => {
      const testCases = [
        'Show canvassing progress',
        'How much is complete?',
        'Completion rate for this universe',
        'Universe progress',
        'Canvassing status',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvassing_view_progress');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvassing_optimize_route intent', () => {
      const testCases = [
        'Optimize route for this turf',
        'Best walking route',
        'Route optimization',
        'Walking order for canvassers',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvassing_optimize_route');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvassing_performance intent', () => {
      const testCases = [
        'Show top performing precincts',
        'Volunteer efficiency',
        'Performance analysis',
        'Top performers',
        'Best precincts for canvassing',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvassing_performance');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvassing_log_results intent', () => {
      const testCases = [
        'Log canvass results',
        'Record canvassing results',
        'Enter canvass data',
        'Update canvassing results',
        'Submit canvass data',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvassing_log_results');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvassing_analyze_performance intent', () => {
      const testCases = [
        'Analyze canvassing performance',
        'Canvassing performance analysis',
        'How is the canvass doing?',
        'Canvassing effectiveness',
        'Contact rate analysis',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvassing_analyze_performance');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('canvassing_stalled intent', () => {
      const testCases = [
        'Show stalled turfs',
        'Which turfs need attention?',
        'Turfs needing attention',
        'Behind schedule turfs',
        'Inactive turfs',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'canvassing_stalled');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('canvass_create returns universe details', async () => {
      const parsed = createQuery('Create a canvassing universe', 'canvass_create');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Canvass Universe');
      expect(result.response).toContain('doors');
      expect(result.suggestedActions).toBeDefined();
    });

    test('canvass_plan returns plan details with metrics', async () => {
      const parsed = createQuery('Plan a 5000 door canvass in Lansing', 'canvass_plan');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Canvass Plan');
      expect(result.response).toMatch(/Doors|doors/);
      expect(result.suggestedActions).toBeDefined();
    });

    test('canvass_estimate returns staffing estimates', async () => {
      const parsed = createQuery('How many volunteers for 10000 doors?', 'canvass_estimate');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('10,000');
      expect(result.response).toMatch(/volunteers|hours/i);
    });

    test('canvass_export returns format options', async () => {
      const parsed = createQuery('Export walk list', 'canvass_export');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('CSV');
      expect(result.suggestedActions).toBeDefined();
    });

    test('canvassing_assign_volunteers returns assignment guidance', async () => {
      const parsed = createQuery('Assign volunteers', 'canvassing_assign_volunteers');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Volunteer');
      expect(result.suggestedActions).toBeDefined();
    });

    test('canvassing_view_progress returns progress overview', async () => {
      const parsed = createQuery('Show canvassing progress', 'canvassing_view_progress');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Progress');
    });

    test('canvassing_optimize_route returns route guidance', async () => {
      const parsed = createQuery('Optimize route', 'canvassing_optimize_route');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Route');
    });

    test('canvassing_analyze_performance returns metrics', async () => {
      const parsed = createQuery('Analyze canvassing performance', 'canvassing_analyze_performance');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Performance');
    });

    test('canvassing_log_results returns entry guidance', async () => {
      const parsed = createQuery('Log canvass results', 'canvassing_log_results');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Log');
    });

    test('canvassing_stalled returns stalled turf info', async () => {
      const parsed = createQuery('Show stalled turfs', 'canvassing_stalled');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Stalled');
    });
  });

  describe('Entity Extraction', () => {
    test('extracts door count from query', () => {
      const entities = handler.extractEntities('Plan a 5000 door canvass');
      expect(entities.doorCount).toBe(5000);
    });

    test('extracts door count with thousands separator', () => {
      const entities = handler.extractEntities('Plan a 10,000 door canvass');
      expect(entities.doorCount).toBe(10000);
    });

    test('extracts volunteer count from query', () => {
      const entities = handler.extractEntities('I have 20 volunteers available');
      expect(entities.volunteerCount).toBe(20);
    });

    test('extracts jurisdiction from query', () => {
      const entities = handler.extractEntities('Plan canvass in Lansing');
      expect(entities.jurisdictions).toBeDefined();
      expect(entities.jurisdictions).toContain('Lansing');
    });

    test('extracts segment reference from query', () => {
      const entities = handler.extractEntities('Canvass from "suburban swing" segment');
      expect(entities.segmentName).toBe('suburban swing');
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('Create canvass universe', 'canvass_create');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('CanvassingHandler');
      expect(result.metadata?.queryType).toBe('canvass');
    });
  });
});
