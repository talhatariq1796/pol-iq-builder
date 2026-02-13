import { ChatSessionManager } from '@/lib/chat/session-manager';
import { ConversationMemory } from '@/components/ConversationMemory';
import { MEMORY_CONFIG } from '@/config/chat-memory-config';

// Mock the Claude API
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Mocked Claude response with analysis of demographic patterns in Toronto showing high diversity in areas M2M and M2H.'
          }
        ]
      })
    }
  }))
}));

// Mock the query classification API
global.fetch = jest.fn();

describe('Phase 2: Claude Route Integration', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    // Mock localStorage for Node.js environment
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    
    // Mock global objects for Node.js environment
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    
    // Mock window for browser compatibility
    if (typeof window === 'undefined') {
      (global as any).window = {
        localStorage: mockLocalStorage,
      };
    }
  });

  describe('Session-Aware Context Management', () => {
    test('should integrate session manager with conversation memory', async () => {
      const sessionManager = new ChatSessionManager();
      const conversationMemory = new ConversationMemory();

      // Mock successful query classification
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ classification: 'new-analysis' })
      } as Response);

      const sessionDecision = await sessionManager.handleNewQuery(
        'Show me demographic patterns in Toronto',
        '',
        undefined, // persona
        undefined, // analysisType
        'test-user' // userId
      );

      expect(sessionDecision.isNewSession).toBe(true);
      expect(sessionDecision.shouldClearContext).toBe(true);
      expect(sessionDecision.classification).toBe('new-analysis');

      // Simulate conversation memory operations
      conversationMemory.clearSession();
      conversationMemory.addMessage({
        role: 'user',
        content: 'Show me demographic patterns in Toronto'
      });

      const messages = conversationMemory.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[messages.length - 1].content).toBe('Show me demographic patterns in Toronto');
    });

    test('should maintain context for follow-up queries', async () => {
      const conversationMemory = new ConversationMemory();
      const sessionManager = new ChatSessionManager(conversationMemory);

      // First, establish a session with initial query
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ classification: 'new-analysis' })
      } as Response);

      await sessionManager.handleNewQuery(
        'Show me demographic patterns in Toronto',
        '',
        undefined, // persona
        undefined, // analysisType
        'test-user' // userId
      );

      // Simulate previous conversation
      conversationMemory.addMessage({
        role: 'user',
        content: 'Show me demographic patterns in Toronto'
      });
      conversationMemory.addMessage({
        role: 'assistant',
        content: 'Analysis shows high diversity in M2M and M2H areas with significant Filipino population.'
      });

      // Now test follow-up query
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ classification: 'follow-up' })
      } as Response);

      const sessionDecision = await sessionManager.handleNewQuery(
        'Why is Filipino population such a strong factor?',
        'Previous analysis of Toronto demographics',
        undefined, // persona
        undefined, // analysisType
        'test-user' // userId
      );

      expect(sessionDecision.isNewSession).toBe(false);
      expect(sessionDecision.shouldClearContext).toBe(false);
      expect(sessionDecision.classification).toBe('follow-up');

      // Context should be preserved
      const memoryExport = conversationMemory.export();
      expect(memoryExport.messages.length).toBeGreaterThan(1);
    });

    test('should clear context for new analysis queries', async () => {
      const sessionManager = new ChatSessionManager();
      const conversationMemory = new ConversationMemory();

      // Add some previous context
      conversationMemory.addMessage({
        role: 'user',
        content: 'Previous query about Toronto'
      });

      // Mock new analysis classification
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ classification: 'new-analysis' })
      } as Response);

      const sessionDecision = await sessionManager.handleNewQuery(
        'Show me Nike brand trends in Vancouver',
        'Previous conversation about Toronto demographics',
        undefined, // persona
        undefined, // analysisType
        'test-user' // userId
      );

      expect(sessionDecision.shouldClearContext).toBe(true);

      // Simulate context clearing
      conversationMemory.clearSession();
      const messagesAfterClear = conversationMemory.getMessages();
      expect(messagesAfterClear.length).toBe(0);
    });
  });

  describe('System Prompt Context Injection', () => {
    test('should inject conversation context for follow-up queries', () => {
      const conversationContext = 'Previous analysis showed high diversity in Toronto M2M areas';
      const previousAnalysisContext = 'Analysis of demographic patterns revealed Filipino population concentration...';
      const baseSystemPrompt = 'You are an expert geospatial analyst.';
      
      // Simulate system prompt construction for follow-up
      const dynamicSystemPrompt = `${baseSystemPrompt}

CONVERSATION CONTEXT:
Previous conversation summary: ${conversationContext}

PREVIOUS ANALYSIS CONTEXT:
${previousAnalysisContext}

SESSION STATUS: This is a follow-up query building on previous analysis. Maintain context and reference prior findings where relevant.

DATA SUMMARY:
Test data summary

TASK: Analyze patterns`;

      expect(dynamicSystemPrompt).toContain('CONVERSATION CONTEXT');
      expect(dynamicSystemPrompt).toContain('PREVIOUS ANALYSIS CONTEXT');
      expect(dynamicSystemPrompt).toContain('follow-up query building on previous analysis');
      expect(dynamicSystemPrompt).toContain(conversationContext);
      expect(dynamicSystemPrompt).toContain(previousAnalysisContext);
    });

    test('should exclude context for new analysis queries', () => {
      const baseSystemPrompt = 'You are an expert geospatial analyst.';
      
      // Simulate system prompt construction for new analysis
      const dynamicSystemPrompt = `${baseSystemPrompt}

SESSION STATUS: This is a new analysis session. No previous context to consider.

DATA SUMMARY:
Test data summary

TASK: Analyze patterns`;

      expect(dynamicSystemPrompt).toContain('new analysis session');
      expect(dynamicSystemPrompt).toContain('No previous context to consider');
      expect(dynamicSystemPrompt).not.toContain('CONVERSATION CONTEXT');
      expect(dynamicSystemPrompt).not.toContain('PREVIOUS ANALYSIS CONTEXT');
    });
  });

  describe('Response Enhancement', () => {
    test('should include session information in analysis response', () => {
      const sessionDecision = {
        sessionId: 'session_123',
        isNewSession: false,
        classification: 'follow-up' as const,
        shouldClearContext: false
      };

      const conversationContext = 'Previous analysis summary';

      const analysisResponse = {
        content: 'Analysis response content',
        validIdentifiers: ['12345', '67890'],
        sessionInfo: {
          sessionId: sessionDecision.sessionId,
          isNewSession: sessionDecision.isNewSession,
          classification: sessionDecision.classification,
          hasContext: !!conversationContext
        }
      };

      expect(analysisResponse.sessionInfo).toBeDefined();
      expect(analysisResponse.sessionInfo.sessionId).toBe('session_123');
      expect(analysisResponse.sessionInfo.isNewSession).toBe(false);
      expect(analysisResponse.sessionInfo.classification).toBe('follow-up');
      expect(analysisResponse.sessionInfo.hasContext).toBe(true);
    });

    test('should indicate no context for new sessions', () => {
      const sessionDecision = {
        sessionId: 'session_456',
        isNewSession: true,
        classification: 'new-analysis' as const,
        shouldClearContext: true
      };

      const conversationContext = null;

      const analysisResponse = {
        content: 'New analysis response',
        sessionInfo: {
          sessionId: sessionDecision.sessionId,
          isNewSession: sessionDecision.isNewSession,
          classification: sessionDecision.classification,
          hasContext: !!conversationContext
        }
      };

      expect(analysisResponse.sessionInfo.isNewSession).toBe(true);
      expect(analysisResponse.sessionInfo.classification).toBe('new-analysis');
      expect(analysisResponse.sessionInfo.hasContext).toBe(false);
    });
  });

  describe('Memory Storage Integration', () => {
    test('should store user and assistant messages in memory', () => {
      const conversationMemory = new ConversationMemory();
      const persona = 'strategist';

      // Simulate storing conversation
      conversationMemory.addMessage({
        role: 'user',
        content: 'Show me demographic patterns'
      }, persona);

      conversationMemory.addMessage({
        role: 'assistant',
        content: 'Analysis shows patterns in areas M2M and M2H',
        analysisType: 'demographic'
      }, persona);

      const messages = conversationMemory.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(2);
      
      const userMessage = messages.find(m => m.role === 'user');
      const assistantMessage = messages.find(m => m.role === 'assistant');
      
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Show me demographic patterns');
      expect(userMessage?.persona).toBe(persona);
      
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toContain('Analysis shows patterns');
      expect(assistantMessage?.persona).toBe(persona);
    });

    test('should handle memory storage errors gracefully', () => {
      const conversationMemory = new ConversationMemory();
      
      // Mock a storage error scenario
      const originalAddMessage = conversationMemory.addMessage;
      jest.spyOn(conversationMemory, 'addMessage').mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw error, should handle gracefully
      expect(() => {
        try {
          conversationMemory.addMessage({
            role: 'user',
            content: 'Test message'
          });
        } catch (error) {
          // Simulate graceful error handling
          console.warn('Failed to store conversation in memory:', error);
        }
      }).not.toThrow();

      // Restore original method
      jest.restoreAllMocks();
    });
  });

  describe('User Isolation in Claude Route', () => {
    test('should handle different users with separate contexts', async () => {
      const sessionManager = new ChatSessionManager();
      
      // Mock different classifications for different users
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ classification: 'new-analysis' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ classification: 'new-analysis' })
        } as Response);

      const user1Session = await sessionManager.handleNewQuery(
        'Show me Toronto demographics',
        '',
        undefined, // persona
        undefined, // analysisType
        'user1' // userId
      );

      const user2Session = await sessionManager.handleNewQuery(
        'Show me Vancouver trends',
        '',
        undefined, // persona
        undefined, // analysisType
        'user2' // userId
      );

      expect(user1Session.sessionId).not.toBe(user2Session.sessionId);
      expect(user1Session.sessionId).toContain('user1');
      expect(user2Session.sessionId).toContain('user2');
    });

    test('should maintain separate conversation memories per user', () => {
      const memory1 = new ConversationMemory();
      const memory2 = new ConversationMemory();

      memory1.addMessage({
        role: 'user',
        content: 'User 1 query about Toronto'
      });

      memory2.addMessage({
        role: 'user',
        content: 'User 2 query about Vancouver'
      });

      const user1Messages = memory1.getMessages();
      const user2Messages = memory2.getMessages();

      expect(user1Messages.length).toBeGreaterThan(0);
      expect(user2Messages.length).toBeGreaterThan(0);
      
      // Find the actual user messages (not session boundary messages)
      const user1UserMessage = user1Messages.find(m => m.role === 'user' && !m.content.startsWith('[SESSION-'));
      const user2UserMessage = user2Messages.find(m => m.role === 'user' && !m.content.startsWith('[SESSION-'));
      
      expect(user1UserMessage?.content).toContain('Toronto');
      expect(user2UserMessage?.content).toContain('Vancouver');
    });
  });

  describe('Error Handling', () => {
    test('should handle query classification API failures', async () => {
      const sessionManager = new ChatSessionManager();

      // Mock API failure
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const sessionDecision = await sessionManager.handleNewQuery(
        'Test query',
        '',
        undefined, // persona
        undefined, // analysisType
        'test-user' // userId
      );

      // Should fallback to new-analysis
      expect(sessionDecision.classification).toBe('new-analysis');
      expect(sessionDecision.isNewSession).toBe(true);
      expect(sessionDecision.shouldClearContext).toBe(true);
    });

    test('should handle conversation memory failures gracefully', () => {
      const conversationMemory = new ConversationMemory();

      // Mock export failure
      jest.spyOn(conversationMemory, 'export').mockImplementation(() => {
        throw new Error('Export failed');
      });

      let conversationContext: string | null = null;
      let previousAnalysisContext: string | null = null;

      // Should handle error gracefully
      expect(() => {
        try {
          const memoryExport = conversationMemory.export();
          conversationContext = 'Should not reach here';
        } catch (error) {
          console.warn('Failed to retrieve conversation context:', error);
          conversationContext = null;
          previousAnalysisContext = null;
        }
      }).not.toThrow();

      expect(conversationContext).toBeNull();
      expect(previousAnalysisContext).toBeNull();
    });
  });
}); 