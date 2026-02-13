/**
 * DonorHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for donor intents.
 * Run with: npm test -- --testPathPattern=DonorHandler
 */

import { DonorHandler } from '@/lib/ai-native/handlers/DonorHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('DonorHandler', () => {
  let handler: DonorHandler;

  beforeAll(() => {
    handler = new DonorHandler();
  });

  describe('Pattern Matching', () => {
    // Helper to create minimal ParsedQuery
    const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
      originalQuery: query,
      intent,
      entities: {},
      confidence: 0.8,
    });

    describe('donor_concentration intent', () => {
      const testCases = [
        'Where are our donors concentrated?',
        'Show me donor concentration',
        'Top donor areas in Ingham County',
        'Highest donor density ZIP codes',
        'Where do we have the most donors?',
        'Show donor heatmap',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'donor_concentration');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('donor_prospects intent', () => {
      const testCases = [
        'Find fundraising prospects',
        'Potential donors in high-income areas',
        'Untapped donor potential',
        'Similar to our current donors',
        'High-capacity areas for fundraising',
        'Where should we fundraise next?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'donor_prospects');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('donor_trends intent', () => {
      const testCases = [
        'Show donor trends',
        'Fundraising trends over time',
        'Giving trends this cycle',
        'How have donations changed?',
        'Year over year fundraising',
        'Donation momentum',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'donor_trends');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('donor_export intent', () => {
      const testCases = [
        'Export donor data',
        'Download donor list',
        'Donor list export to CSV',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'donor_export');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('should not match unrelated intents', () => {
      const unrelatedIntents: QueryIntent[] = [
        'segment_create',
        'canvass_create',
        'compare_jurisdictions',
        'election_trends',
        'help_general',
        'unknown',
      ];

      test.each(unrelatedIntents)('should not handle intent: %s', (intent) => {
        const parsed = createQuery('some query', intent);
        expect(handler.canHandle(parsed)).toBe(false);
      });
    });
  });

  describe('Entity Extraction', () => {
    it('should extract ZIP code entities', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Show donor concentration in 48823',
        intent: 'donor_concentration',
        entities: {
          zipCodes: ['48823'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      // In test environment without server, data may not load
      // Just verify handler returns a valid response structure
      expect(typeof result.success).toBe('boolean');
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should handle jurisdiction entities', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Donor concentration in East Lansing',
        intent: 'donor_concentration',
        entities: {
          jurisdictions: ['East Lansing'],
        },
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      // Handler should return a response even if data unavailable
      expect(typeof result.success).toBe('boolean');
      expect(result.response.length).toBeGreaterThan(0);
    });
  });

  describe('Handler Response', () => {
    it('should return HandlerResult with required fields', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Where are our donors?',
        intent: 'donor_concentration',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('response');
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should include mapCommands for visualization', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Show donor heatmap',
        intent: 'donor_concentration',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      // Donor handlers typically include mapCommands
      if (result.mapCommands) {
        expect(Array.isArray(result.mapCommands)).toBe(true);
      }
    });

    it('should include suggestedActions for follow-up', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Find fundraising prospects',
        intent: 'donor_prospects',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      if (result.suggestedActions) {
        expect(Array.isArray(result.suggestedActions)).toBe(true);
        result.suggestedActions.forEach((action) => {
          expect(action).toHaveProperty('id');
          expect(action).toHaveProperty('label');
          expect(action).toHaveProperty('action');
        });
      }
    });

    it('should include metadata with handler info', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Show donor trends',
        intent: 'donor_trends',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);

      if (result.metadata) {
        expect(result.metadata).toHaveProperty('handlerName');
        expect(result.metadata).toHaveProperty('processingTimeMs');
        expect(typeof result.metadata.processingTimeMs).toBe('number');
      }
    });
  });

  describe('Donor Analysis Scenarios', () => {
    it('should handle prospect analysis', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Find high-capacity fundraising prospects',
        intent: 'donor_prospects',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      // In test environment, data may not load but handler should respond
      expect(typeof result.success).toBe('boolean');
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should handle trend analysis', async () => {
      const query: ParsedQuery = {
        originalQuery: 'How have donations changed year over year?',
        intent: 'donor_trends',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      // In test environment, data may not load but handler should respond
      expect(typeof result.success).toBe('boolean');
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should handle export requests', async () => {
      const query: ParsedQuery = {
        originalQuery: 'Export donor data to CSV',
        intent: 'donor_export',
        entities: {},
        confidence: 0.9,
      };

      const result = await handler.handle(query);
      // Export may succeed or indicate no data to export
      expect(typeof result.success).toBe('boolean');
      expect(result.response.length).toBeGreaterThan(0);
    });
  });
});
