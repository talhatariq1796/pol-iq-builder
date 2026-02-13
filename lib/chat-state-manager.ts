import { VisualizationType } from "../reference/dynamic-layers";
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a single message in the chat history
 */
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Represents a clarification question for ambiguous queries
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
  expectedType: VisualizationType;
  context: {
    originalQuery: string;
    currentConfidence: number;
    matchedPatterns: Array<{
      type: VisualizationType;
      weight: number;
      pattern: string;
    }>;
  };
  timestamp: Date;
}

/**
 * Represents the current data context for exploration
 */
export interface DataContext {
  visualizationType?: VisualizationType;
  dataSummary: {
    totalPoints: number;
    categories: string[];
    timeRange?: [Date, Date];
    spatialBounds?: [number, number, number, number];
  };
  availableMetrics: string[];
  currentFilters: Record<string, unknown>;
}

/**
 * User preferences for chat interactions
 */
interface UserPreferences {
  preferredVisualizationTypes?: VisualizationType[];
  preferredMetrics?: string[];
  defaultFilters?: Record<string, unknown>;
  language?: string;
}

/**
 * Complete chat state for a session
 */
export interface ChatState {
  sessionId: string;
  messages: ChatMessage[];
  dataContext?: DataContext;
  userPreferences: UserPreferences;
  clarificationQuestions: ClarificationQuestion[];
}

/**
 * Manages chat state and interactions for the visualization system
 */
export class ChatStateManager {
  private states: Map<string, ChatState>;
  private readonly DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.states = new Map();
    // Avoid starting background timers in test environments to prevent Jest open handle leaks
    const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
    if (!isTestEnv) {
      this.startCleanupInterval();
    }
  }

  /**
   * Creates a new chat session
   */
  createSession(sessionId: string, preferences: Partial<UserPreferences> = {}): string {
    const state: ChatState = {
      sessionId,
      messages: [],
      dataContext: {
        visualizationType: VisualizationType.SCATTER,
        dataSummary: {
          totalPoints: 0,
          categories: [],
        },
        availableMetrics: [],
        currentFilters: {},
      },
      userPreferences: {
        language: 'en',
        ...preferences,
      },
      clarificationQuestions: [],
    };
    this.states.set(sessionId, state);
    return sessionId;
  }

  /**
   * Adds a message to the chat history
   */
  addMessage(sessionId: string, content: string, role: 'user' | 'assistant' | 'system', metadata?: Record<string, unknown>): void {
    const state = this.getState(sessionId);
    const message: ChatMessage = {
      id: uuidv4(),
      content,
      role,
      timestamp: new Date(),
      metadata,
    };
    state.messages.push(message);
  }

  /**
   * Adds a clarification question to the pending list
   */
  addClarificationQuestion(
    sessionId: string,
    question: string,
    options: string[],
    context: {
      originalQuery: string;
      currentConfidence: number;
      matchedPatterns: Array<{
        type: VisualizationType;
        weight: number;
        pattern: string;
      }>;
    }
  ): string {
    const state = this.getState(sessionId);
    const questionId = uuidv4();
    const clarification: ClarificationQuestion = {
      id: questionId,
      question,
      options,
      expectedType: context.matchedPatterns[0]?.type || 'unknown',
      context,
      timestamp: new Date(),
    };
    state.clarificationQuestions.push(clarification);
    return questionId;
  }

  /**
   * Updates the data context for a session
   */
  updateDataContext(sessionId: string, context: Partial<DataContext>): void {
    const state = this.getState(sessionId);
    if (!state.dataContext) {
      state.dataContext = {
        visualizationType: VisualizationType.SCATTER,
        dataSummary: {
          totalPoints: 0,
          categories: [],
        },
        availableMetrics: [],
        currentFilters: {},
      };
    }
    state.dataContext = {
      ...state.dataContext,
      ...context,
    };
  }

  /**
   * Updates user preferences
   */
  updatePreferences(sessionId: string, preferences: Partial<UserPreferences>): void {
    const state = this.getState(sessionId);
    state.userPreferences = {
      ...state.userPreferences,
      ...preferences,
    };
  }

  /**
   * Gets the current state for a session
   */
  getState(sessionId: string): ChatState {
    const state = this.states.get(sessionId);
    if (!state) {
      throw new Error(`No chat state found for session ${sessionId}`);
    }
    return state;
  }

  /**
   * Gets the chat history for a session
   */
  getHistory(sessionId: string): ChatMessage[] {
    return this.getState(sessionId).messages.map(m => ({
      id: m.id,
      timestamp: m.timestamp,
      role: m.role,
      content: m.content,
      metadata: m.metadata,
    }));
  }

  /**
   * Gets pending clarification questions
   */
  getPendingClarifications(sessionId: string): ClarificationQuestion[] {
    return this.getState(sessionId).clarificationQuestions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      expectedType: q.expectedType,
      context: q.context,
      timestamp: q.timestamp,
    }));
  }

  /**
   * Removes a clarification question after it's been answered
   */
  removeClarificationQuestion(sessionId: string, questionId: string): void {
    const state = this.getState(sessionId);
    state.clarificationQuestions = state.clarificationQuestions.filter(q => q.id !== questionId);
  }

  /**
   * Cleans up expired sessions
   */
  private startCleanupInterval(): void {
    // Store timer so tests or runtime can stop it if needed
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, state] of this.states.entries()) {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && now - lastMessage.timestamp.getTime() > this.DEFAULT_SESSION_TIMEOUT) {
          this.states.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    // Do not keep the Node event loop alive solely for this timer
    const maybeTimer = this.cleanupTimer as unknown as { unref?: () => void };
    if (typeof maybeTimer.unref === 'function') {
      maybeTimer.unref();
    }
  }

  /**
   * Ends a chat session and cleans up resources
   */
  endSession(sessionId: string): void {
    this.states.delete(sessionId);
  }

  /**
   * Stop background cleanup interval (useful for graceful shutdown or tests)
   */
  stopCleanupInterval(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Export a singleton instance
export const chatStateManager = new ChatStateManager(); 