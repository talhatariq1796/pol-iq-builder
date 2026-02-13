/**
 * PoliticalSessionPersistence
 *
 * Manages saving and loading AI analysis sessions.
 * Enables users to resume previous analysis workflows.
 *
 * Storage Options:
 * - LocalStorage: Quick, client-side, no auth required
 * - IndexedDB: For larger sessions with media attachments
 * - Server: For cross-device sync (future)
 *
 * Session Data Includes:
 * - Conversation history
 * - Map state (view, highlights, filters)
 * - Analysis results
 * - User context and preferences
 */

import type {
  AISession,
  Message,
  PoliticalAIContext,
  AnalysisResult,
  MapCommand,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface SessionMetadata {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  precinctCount: number;
  jurisdictions: string[];
  tags: string[];
  thumbnail?: string;
}

export interface SessionExport {
  version: string;
  exportedAt: Date;
  session: AISession;
  metadata: SessionMetadata;
}

export interface SessionListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'updatedAt' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'pol_ai_sessions';
const CURRENT_SESSION_KEY = 'pol_ai_current_session';
const VERSION = '1.0.0';
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_SESSION = 100;

// ============================================================================
// Session Persistence
// ============================================================================

export class PoliticalSessionPersistence {
  private static instance: PoliticalSessionPersistence;
  private sessions: Map<string, AISession> = new Map();
  private metadata: Map<string, SessionMetadata> = new Map();
  private currentSessionId: string | null = null;
  private autoSaveInterval: number | null = null;
  private isDirty = false;

  private constructor() {
    this.loadFromStorage();
    this.startAutoSave();
  }

  static getInstance(): PoliticalSessionPersistence {
    if (!PoliticalSessionPersistence.instance) {
      PoliticalSessionPersistence.instance = new PoliticalSessionPersistence();
    }
    return PoliticalSessionPersistence.instance;
  }

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  /**
   * Create a new session
   */
  createSession(name?: string): AISession {
    const id = this.generateId();
    const now = new Date();

    const session: AISession = {
      id,
      createdAt: now,
      updatedAt: now,
      messages: [],
      context: this.createDefaultContext(),
      name: name || `Analysis Session ${this.sessions.size + 1}`,
      tags: [],
    };

    const meta: SessionMetadata = {
      id,
      name: session.name || '',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      precinctCount: 0,
      jurisdictions: [],
      tags: [],
    };

    this.sessions.set(id, session);
    this.metadata.set(id, meta);
    this.currentSessionId = id;
    this.isDirty = true;

    this.saveToStorage();
    return session;
  }

  /**
   * Get current session or create new one
   */
  getCurrentSession(): AISession {
    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId);
      if (session) return session;
    }
    return this.createSession();
  }

  /**
   * Load a specific session
   */
  loadSession(sessionId: string): AISession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.currentSessionId = sessionId;
      this.saveCurrentSessionId();
      return session;
    }
    return null;
  }

  /**
   * Update current session
   */
  updateSession(updates: Partial<AISession>): void {
    if (!this.currentSessionId) return;

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return;

    const updatedSession: AISession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    this.sessions.set(this.currentSessionId, updatedSession);
    this.updateMetadata(this.currentSessionId, updatedSession);
    this.isDirty = true;
  }

  /**
   * Add message to current session
   */
  addMessage(message: Message): void {
    const session = this.getCurrentSession();

    // Limit message history
    const messages = [...session.messages, message].slice(-MAX_MESSAGES_PER_SESSION);

    this.updateSession({ messages });
  }

  /**
   * Update context in current session
   */
  updateContext(context: Partial<PoliticalAIContext>): void {
    const session = this.getCurrentSession();
    this.updateSession({
      context: { ...session.context, ...context },
    });
  }

  /**
   * Add analysis result to current session
   */
  addAnalysisResult(result: AnalysisResult): void {
    const session = this.getCurrentSession();
    const results = [...(session.context.analysisResults || []), result].slice(-20);
    this.updateContext({ analysisResults: results });
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    this.metadata.delete(sessionId);

    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }

    this.isDirty = true;
    this.saveToStorage();
    return deleted;
  }

  /**
   * Rename a session
   */
  renameSession(sessionId: string, newName: string): void {
    const session = this.sessions.get(sessionId);
    const meta = this.metadata.get(sessionId);

    if (session && meta) {
      session.name = newName;
      meta.name = newName;
      session.updatedAt = new Date();
      meta.updatedAt = new Date();

      this.sessions.set(sessionId, session);
      this.metadata.set(sessionId, meta);
      this.isDirty = true;
      this.saveToStorage();
    }
  }

  /**
   * Add tag to session
   */
  addTag(sessionId: string, tag: string): void {
    const session = this.sessions.get(sessionId);
    const meta = this.metadata.get(sessionId);

    if (session && meta) {
      if (!session.tags) session.tags = [];
      if (!session.tags.includes(tag)) {
        session.tags.push(tag);
        meta.tags = session.tags;
        this.isDirty = true;
        this.saveToStorage();
      }
    }
  }

  /**
   * Remove tag from session
   */
  removeTag(sessionId: string, tag: string): void {
    const session = this.sessions.get(sessionId);
    const meta = this.metadata.get(sessionId);

    if (session && meta && session.tags) {
      session.tags = session.tags.filter(t => t !== tag);
      meta.tags = session.tags;
      this.isDirty = true;
      this.saveToStorage();
    }
  }

  // ---------------------------------------------------------------------------
  // Session Listing
  // ---------------------------------------------------------------------------

  /**
   * Get list of all sessions
   */
  listSessions(options: SessionListOptions = {}): SessionMetadata[] {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      tags,
    } = options;

    let sessions = Array.from(this.metadata.values());

    // Filter by tags
    if (tags && tags.length > 0) {
      sessions = sessions.filter(s =>
        tags.some(tag => s.tags.includes(tag))
      );
    }

    // Sort
    sessions.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
        default:
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Paginate
    return sessions.slice(offset, offset + limit);
  }

  /**
   * Get total session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all unique tags across sessions
   */
  getAllTags(): string[] {
    const tags = new Set<string>();
    this.metadata.forEach(meta => {
      meta.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  // ---------------------------------------------------------------------------
  // Export/Import
  // ---------------------------------------------------------------------------

  /**
   * Export session for sharing or backup
   */
  exportSession(sessionId: string): SessionExport | null {
    const session = this.sessions.get(sessionId);
    const meta = this.metadata.get(sessionId);

    if (!session || !meta) return null;

    return {
      version: VERSION,
      exportedAt: new Date(),
      session,
      metadata: meta,
    };
  }

  /**
   * Import session from export
   */
  importSession(data: SessionExport): AISession | null {
    try {
      // Validate version
      if (!data.version || !data.session) {
        throw new Error('Invalid session export format');
      }

      // Generate new ID to avoid conflicts
      const newId = this.generateId();
      const session: AISession = {
        ...data.session,
        id: newId,
        createdAt: new Date(data.session.createdAt),
        updatedAt: new Date(),
      };

      const meta: SessionMetadata = {
        ...data.metadata,
        id: newId,
        createdAt: new Date(data.metadata.createdAt),
        updatedAt: new Date(),
        name: `${data.metadata.name} (Imported)`,
      };

      this.sessions.set(newId, session);
      this.metadata.set(newId, meta);
      this.isDirty = true;
      this.saveToStorage();

      return session;
    } catch (error) {
      console.error('Failed to import session:', error);
      return null;
    }
  }

  /**
   * Export session as JSON string
   */
  exportSessionAsJSON(sessionId: string): string | null {
    const exportData = this.exportSession(sessionId);
    if (!exportData) return null;
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import session from JSON string
   */
  importSessionFromJSON(json: string): AISession | null {
    try {
      const data = JSON.parse(json) as SessionExport;
      return this.importSession(data);
    } catch (error) {
      console.error('Failed to parse session JSON:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage Operations
  // ---------------------------------------------------------------------------

  /**
   * Load sessions from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);

        // Restore sessions
        if (data.sessions) {
          Object.entries(data.sessions).forEach(([id, session]) => {
            const s = session as AISession;
            s.createdAt = new Date(s.createdAt);
            s.updatedAt = new Date(s.updatedAt);
            this.sessions.set(id, s);
          });
        }

        // Restore metadata
        if (data.metadata) {
          Object.entries(data.metadata).forEach(([id, meta]) => {
            const m = meta as SessionMetadata;
            m.createdAt = new Date(m.createdAt);
            m.updatedAt = new Date(m.updatedAt);
            this.metadata.set(id, m);
          });
        }
      }

      // Restore current session ID
      const currentId = localStorage.getItem(CURRENT_SESSION_KEY);
      if (currentId && this.sessions.has(currentId)) {
        this.currentSessionId = currentId;
      }
    } catch (error) {
      console.error('Failed to load sessions from storage:', error);
    }
  }

  /**
   * Save sessions to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      // Enforce max sessions limit
      this.enforceSessionLimit();

      const data = {
        version: VERSION,
        savedAt: new Date().toISOString(),
        sessions: Object.fromEntries(this.sessions),
        metadata: Object.fromEntries(this.metadata),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.saveCurrentSessionId();
      this.isDirty = false;
    } catch (error) {
      console.error('Failed to save sessions to storage:', error);

      // Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.pruneOldSessions(10);
        this.saveToStorage();
      }
    }
  }

  /**
   * Save current session ID
   */
  private saveCurrentSessionId(): void {
    if (typeof window === 'undefined') return;

    if (this.currentSessionId) {
      localStorage.setItem(CURRENT_SESSION_KEY, this.currentSessionId);
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    if (typeof window === 'undefined') return;

    // Auto-save every 30 seconds if dirty
    this.autoSaveInterval = window.setInterval(() => {
      if (this.isDirty) {
        this.saveToStorage();
      }
    }, 30000);
  }

  /**
   * Stop auto-save interval
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Force save
   */
  forceSave(): void {
    this.saveToStorage();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate unique session ID
   */
  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create default context
   */
  private createDefaultContext(): PoliticalAIContext {
    return {
      currentView: 'overview',
      selectedPrecincts: [],
      lastAction: '',
      conversationHistory: [],
    };
  }

  /**
   * Update metadata from session
   */
  private updateMetadata(sessionId: string, session: AISession): void {
    const existingMeta = this.metadata.get(sessionId);
    if (!existingMeta) return;

    // Extract jurisdictions from selected precincts (simplified)
    const jurisdictions = new Set<string>();
    // In real implementation, would look up jurisdiction from precinct IDs

    const meta: SessionMetadata = {
      ...existingMeta,
      updatedAt: new Date(),
      messageCount: session.messages.length,
      precinctCount: session.context.selectedPrecincts.length,
      jurisdictions: Array.from(jurisdictions),
      tags: session.tags || [],
    };

    this.metadata.set(sessionId, meta);
  }

  /**
   * Enforce maximum sessions limit
   */
  private enforceSessionLimit(): void {
    if (this.sessions.size <= MAX_SESSIONS) return;

    const toDelete = this.sessions.size - MAX_SESSIONS;
    this.pruneOldSessions(toDelete);
  }

  /**
   * Prune oldest sessions
   */
  private pruneOldSessions(count: number): void {
    const sessions = this.listSessions({
      sortBy: 'updatedAt',
      sortOrder: 'asc',
      limit: count,
    });

    sessions.forEach(meta => {
      if (meta.id !== this.currentSessionId) {
        this.sessions.delete(meta.id);
        this.metadata.delete(meta.id);
      }
    });
  }

  /**
   * Clear all sessions (use with caution)
   */
  clearAllSessions(): void {
    this.sessions.clear();
    this.metadata.clear();
    this.currentSessionId = null;
    this.saveToStorage();
  }
}

// ============================================================================
// Export
// ============================================================================

export const sessionPersistence = PoliticalSessionPersistence.getInstance();

export default PoliticalSessionPersistence;
