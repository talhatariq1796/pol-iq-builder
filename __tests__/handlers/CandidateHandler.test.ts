/**
 * CandidateHandler Unit Tests
 *
 * Tests intent pattern matching and response generation for candidate intents.
 * Run with: npm test -- --testPathPattern=CandidateHandler
 */

import { CandidateHandler } from '@/lib/ai-native/handlers/CandidateHandler';
import type { ParsedQuery, QueryIntent } from '@/lib/ai-native/handlers/types';

describe('CandidateHandler', () => {
  let handler: CandidateHandler;

  beforeAll(() => {
    handler = new CandidateHandler();
  });

  // Helper to create minimal ParsedQuery
  const createQuery = (query: string, intent: QueryIntent): ParsedQuery => ({
    originalQuery: query,
    intent,
    entities: {},
    confidence: 0.8,
  });

  describe('Pattern Matching', () => {
    describe('candidate_profile intent', () => {
      const testCases = [
        'Tell me about Elissa Slotkin',
        'Who is Mike Rogers?',
        'Slotkin profile',
        'Background on Peters',
        'What is Slotkin known for?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'candidate_profile');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('candidate_race intent', () => {
      const testCases = [
        "Who's running for Senate?",
        'Candidates in the Senate race',
        'Who are the candidates for Congress?',
        'Show me the Senate race',
        'List candidates for State House 73',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'candidate_race');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('candidate_competitive intent', () => {
      const testCases = [
        'Most competitive races',
        'Closest races in Ingham County',
        'Tightest contests',
        'Which races are competitive?',
        'Battleground races',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'candidate_competitive');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('candidate_fundraising intent', () => {
      const testCases = [
        'How much has Slotkin raised?',
        'Fundraising totals for Rogers',
        'Campaign finance for Senate race',
        'Who has more money?',
        'Donor contributions to Slotkin',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'candidate_fundraising');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });

    describe('candidate_endorsements intent', () => {
      const testCases = [
        'Who endorsed Slotkin?',
        'Endorsements for Rogers',
        'Which unions support Slotkin?',
        'Newspaper endorsements',
        'Who backs Rogers?',
      ];

      test.each(testCases)('should match: "%s"', (query) => {
        const parsed = createQuery(query, 'candidate_endorsements');
        expect(handler.canHandle(parsed)).toBe(true);
      });
    });
  });

  describe('Response Generation', () => {
    test('candidate_profile returns structured response', async () => {
      const parsed = createQuery('Tell me about Slotkin', 'candidate_profile');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Slotkin');
      expect(result.suggestedActions).toBeDefined();
      expect(result.suggestedActions!.length).toBeGreaterThan(0);
    });

    test('candidate_race returns race overview', async () => {
      const parsed = createQuery("Who's running for Senate?", 'candidate_race');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Senate');
      expect(result.data).toBeDefined();
    });

    test('candidate_competitive returns ranked races', async () => {
      const parsed = createQuery('Most competitive races', 'candidate_competitive');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Competitive');
      expect(result.suggestedActions).toBeDefined();
    });

    test('candidate_fundraising returns financial data', async () => {
      const parsed = createQuery('How much has Slotkin raised?', 'candidate_fundraising');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toMatch(/\$|raised|fundrais/i);
    });

    test('candidate_endorsements returns endorsement list', async () => {
      const parsed = createQuery('Who endorsed Slotkin?', 'candidate_endorsements');
      const result = await handler.handle(parsed);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Endorsement');
    });
  });

  describe('Handler Metadata', () => {
    test('returns correct handler name in metadata', async () => {
      const parsed = createQuery('Tell me about Slotkin', 'candidate_profile');
      const result = await handler.handle(parsed);

      expect(result.metadata?.handlerName).toBe('CandidateHandler');
      expect(result.metadata?.matchedIntent).toBe('candidate_profile');
    });
  });
});
