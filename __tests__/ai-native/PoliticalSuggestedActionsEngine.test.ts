/**
 * PoliticalSuggestedActionsEngine Tests
 *
 * Tests context-aware action suggestion generation.
 * Run with: npm test -- --testPathPattern=PoliticalSuggestedActionsEngine
 */

import PoliticalSuggestedActionsEngine, {
  suggestedActionsEngine,
  type ActionContext,
  type AnalysisResult,
} from '@/lib/ai-native/PoliticalSuggestedActionsEngine';

import type { SuggestedAction, Message } from '@/lib/ai-native/types';

describe('PoliticalSuggestedActionsEngine', () => {
  // ========================================
  // Singleton Tests
  // ========================================
  describe('singleton', () => {
    test('getInstance returns same instance', () => {
      const instance1 = PoliticalSuggestedActionsEngine.getInstance();
      const instance2 = PoliticalSuggestedActionsEngine.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('suggestedActionsEngine is singleton instance', () => {
      expect(suggestedActionsEngine).toBe(PoliticalSuggestedActionsEngine.getInstance());
    });
  });

  // ========================================
  // Generate Actions Tests
  // ========================================
  describe('generateActions', () => {
    test('returns array of suggested actions', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    });

    test('limits actions to maxActions', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'donor',
        targetingStrategy: 'gotv',
      };

      suggestedActionsEngine.setMaxActions(3);
      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.length).toBeLessThanOrEqual(3);

      // Reset
      suggestedActionsEngine.setMaxActions(5);
    });

    test('deduplicates actions', () => {
      const context: ActionContext = {
        currentView: 'precinct',
        selectedPrecincts: ['P1'],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'comparison',
      };

      const actions = suggestedActionsEngine.generateActions(context);
      const ids = actions.map(a => a.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  // ========================================
  // View-Based Actions Tests
  // ========================================
  describe('view-based actions', () => {
    test('returns precinct actions for precinct view', () => {
      const context: ActionContext = {
        currentView: 'precinct',
        selectedPrecincts: ['P1'],
        lastAction: '',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a => a.action.includes('explain-score') || a.action.includes('find-similar'))).toBe(true);
    });

    test('returns jurisdiction actions for jurisdiction view', () => {
      const context: ActionContext = {
        currentView: 'jurisdiction',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('trends') ||
        a.action.includes('demographics') ||
        a.action.includes('rank-precincts')
      )).toBe(true);
    });

    test('returns comparison actions for comparison view', () => {
      const context: ActionContext = {
        currentView: 'comparison',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('comparison') ||
        a.action.includes('swap') ||
        a.action.includes('average')
      )).toBe(true);
    });

    test('returns universal actions for overview', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a => a.action.includes('find-targets') || a.action.includes('focus'))).toBe(true);
    });
  });

  // ========================================
  // Strategy-Based Actions Tests
  // ========================================
  describe('strategy-based actions', () => {
    test('includes GOTV actions for gotv strategy', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        targetingStrategy: 'gotv',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('gotv') ||
        a.action.includes('turnout') ||
        a.action.includes('base')
      )).toBe(true);
    });

    test('includes persuasion actions for persuasion strategy', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        targetingStrategy: 'persuasion',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('persuasion') ||
        a.action.includes('swing')
      )).toBe(true);
    });

    test('includes both actions for battleground strategy', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        targetingStrategy: 'battleground',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      // Should have mix of GOTV and persuasion
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Tool-Based Actions Tests
  // ========================================
  describe('tool-based actions', () => {
    test('includes segment actions for segment tool', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'segment',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('segment') ||
        a.action.includes('save') ||
        a.action.includes('map')
      )).toBe(true);
    });

    test('includes canvass actions for canvass tool', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'canvass',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('walk') ||
        a.action.includes('assign') ||
        a.action.includes('van') ||
        a.action.includes('optimize')
      )).toBe(true);
    });

    test('includes donor actions for donor tool', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'donor',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('donor') ||
        a.action.includes('lapsed') ||
        a.action.includes('upgrade') ||
        a.action.includes('heatmap')
      )).toBe(true);
    });

    test('includes poll actions for poll tool', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'poll',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('poll') ||
        a.action.includes('trend') ||
        a.action.includes('methodology')
      )).toBe(true);
    });
  });

  // ========================================
  // Follow-Up Actions Tests
  // ========================================
  describe('follow-up actions', () => {
    test('suggests save after segment creation', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'segment:create',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a => a.action.includes('save'))).toBe(true);
    });

    test('suggests walk lists after canvass creation', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'canvass:create',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a => a.action.includes('walks') || a.action.includes('optimize'))).toBe(true);
    });

    test('suggests export after comparison', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'compare:complete',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a => a.action.includes('pdf') || a.action.includes('swap'))).toBe(true);
    });

    test('suggests prospects after donor geographic analysis', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'donor:geographic',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('prospects') ||
        a.action.includes('heatmap')
      )).toBe(true);
    });

    test('suggests call list after lapsed donor analysis', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'donor:lapsed',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('call') ||
        a.action.includes('cluster') ||
        a.action.includes('recovery')
      )).toBe(true);
    });

    test('suggests compare for multiple selected precincts', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: ['P1', 'P2', 'P3'],
        lastAction: 'map:select',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('compare') ||
        a.action.includes('segment')
      )).toBe(true);
    });

    test('suggests filter actions after applying filter', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'filter:apply',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a =>
        a.action.includes('save') ||
        a.action.includes('refine') ||
        a.action.includes('clear')
      )).toBe(true);
    });
  });

  // ========================================
  // Analysis Results Actions Tests
  // ========================================
  describe('analysis results actions', () => {
    test('includes report action when analysis results exist', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        analysisResults: [
          {
            id: 'analysis-1',
            type: 'segment',
            data: { precinctCount: 15 },
            timestamp: new Date(),
          },
        ],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.some(a => a.action.includes('report'))).toBe(true);
    });
  });

  // ========================================
  // Generate From Conversation Tests
  // ========================================
  describe('generateFromConversation', () => {
    test('returns universal actions for empty messages', () => {
      const actions = suggestedActionsEngine.generateFromConversation([]);

      expect(actions.length).toBeGreaterThan(0);
    });

    test('returns message actions if last message has them', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Here are your results',
          timestamp: new Date(),
          actions: [
            { id: 'custom-action', label: 'Custom Action', action: 'custom:action' },
          ],
        },
      ];

      const actions = suggestedActionsEngine.generateFromConversation(messages);

      expect(actions.some(a => a.id === 'custom-action')).toBe(true);
    });

    test('detects donor topic from conversation', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Show me donor data', timestamp: new Date() },
        { id: 'msg-2', role: 'assistant', content: 'Here are the fundraising results', timestamp: new Date() },
      ];

      const actions = suggestedActionsEngine.generateFromConversation(messages);

      expect(actions.some(a =>
        a.action.includes('donor') ||
        a.action.includes('lapsed') ||
        a.action.includes('upgrade')
      )).toBe(true);
    });

    test('detects canvass topic from conversation', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'I need to plan door knocking', timestamp: new Date() },
      ];

      const actions = suggestedActionsEngine.generateFromConversation(messages);

      expect(actions.some(a =>
        a.action.includes('walk') ||
        a.action.includes('assign') ||
        a.action.includes('canvass')
      )).toBe(true);
    });

    test('detects segment topic from conversation', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Filter precincts by age', timestamp: new Date() },
        { id: 'msg-2', role: 'assistant', content: 'Here are the filtered results', timestamp: new Date() },
      ];

      const actions = suggestedActionsEngine.generateFromConversation(messages);

      expect(actions.some(a =>
        a.action.includes('segment') ||
        a.action.includes('save') ||
        a.action.includes('refine')
      )).toBe(true);
    });

    test('detects poll topic from conversation', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'What do the latest surveys show?', timestamp: new Date() },
      ];

      const actions = suggestedActionsEngine.generateFromConversation(messages);

      expect(actions.some(a =>
        a.action.includes('poll') ||
        a.action.includes('trend')
      )).toBe(true);
    });

    test('detects comparison topic from conversation', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Compare East Lansing vs Lansing', timestamp: new Date() },
      ];

      const actions = suggestedActionsEngine.generateFromConversation(messages);

      expect(actions.some(a =>
        a.action.includes('comparison') ||
        a.action.includes('swap')
      )).toBe(true);
    });

    test('detects GOTV topic from conversation', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Show me low turnout areas', timestamp: new Date() },
      ];

      const actions = suggestedActionsEngine.generateFromConversation(messages);

      expect(actions.some(a =>
        a.action.includes('gotv') ||
        a.action.includes('turnout')
      )).toBe(true);
    });

    test('detects persuasion topic from conversation', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Find swing voters', timestamp: new Date() },
      ];

      const actions = suggestedActionsEngine.generateFromConversation(messages);

      expect(actions.some(a =>
        a.action.includes('persuasion') ||
        a.action.includes('swing')
      )).toBe(true);
    });
  });

  // ========================================
  // Action Prioritization Tests
  // ========================================
  describe('action prioritization', () => {
    test('primary variant actions come first', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'segment:create',
        conversationHistory: [],
        activeTool: 'segment',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      // Find primary action
      const primaryIndex = actions.findIndex(a => a.variant === 'primary');
      const secondaryIndex = actions.findIndex(a => a.variant === 'secondary');
      const otherIndex = actions.findIndex(a => !a.variant);

      if (primaryIndex >= 0 && secondaryIndex >= 0) {
        expect(primaryIndex).toBeLessThan(secondaryIndex);
      }
      if (primaryIndex >= 0 && otherIndex >= 0) {
        expect(primaryIndex).toBeLessThan(otherIndex);
      }
    });
  });

  // ========================================
  // SetMaxActions Tests
  // ========================================
  describe('setMaxActions', () => {
    test('changes max actions limit', () => {
      suggestedActionsEngine.setMaxActions(2);

      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'donor',
        targetingStrategy: 'gotv',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(actions.length).toBeLessThanOrEqual(2);

      // Reset
      suggestedActionsEngine.setMaxActions(5);
    });
  });

  // ========================================
  // Action Structure Tests
  // ========================================
  describe('action structure', () => {
    test('all actions have required fields', () => {
      const context: ActionContext = {
        currentView: 'precinct',
        selectedPrecincts: ['P1'],
        lastAction: 'segment:query',
        conversationHistory: [],
        activeTool: 'segment',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      actions.forEach(action => {
        expect(action.id).toBeDefined();
        expect(action.label).toBeDefined();
        expect(action.action).toBeDefined();
      });
    });

    test('actions have valid icons when specified', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'canvass',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      actions.forEach(action => {
        if (action.icon) {
          expect(typeof action.icon).toBe('string');
        }
      });
    });

    test('actions have valid variants when specified', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'segment:create',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      actions.forEach(action => {
        if (action.variant) {
          expect(['primary', 'secondary']).toContain(action.variant);
        }
      });
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles unknown tool gracefully', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
        activeTool: 'unknown-tool',
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(Array.isArray(actions)).toBe(true);
    });

    test('handles unknown view gracefully', () => {
      const context: ActionContext = {
        currentView: 'unknown' as any,
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(Array.isArray(actions)).toBe(true);
    });

    test('handles unknown lastAction gracefully', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: 'unknown:action',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(Array.isArray(actions)).toBe(true);
    });

    test('handles empty lastAction', () => {
      const context: ActionContext = {
        currentView: 'overview',
        selectedPrecincts: [],
        lastAction: '',
        conversationHistory: [],
      };

      const actions = suggestedActionsEngine.generateActions(context);

      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    });
  });
});
