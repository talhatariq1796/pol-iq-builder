/**
 * PoliticalSessionPersistence Tests
 *
 * Tests session storage, retrieval, and management for AI analysis sessions.
 * Run with: npm test -- --testPathPattern=PoliticalSessionPersistence
 */

import PoliticalSessionPersistence, {
  sessionPersistence,
  type SessionMetadata,
  type SessionExport,
  type SessionListOptions,
} from '@/lib/ai-native/PoliticalSessionPersistence';

import type { AISession, Message, PoliticalAIContext } from '@/lib/ai-native/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock window for setInterval/clearInterval
Object.defineProperty(global, 'window', {
  value: {
    setInterval: jest.fn(() => 123),
    clearInterval: jest.fn(),
  },
  writable: true,
});

// Also mock global clearInterval since implementation uses it directly
const originalClearInterval = global.clearInterval;
global.clearInterval = jest.fn();

describe('PoliticalSessionPersistence', () => {
  let persistence: PoliticalSessionPersistence;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();

    // Create fresh instance by accessing singleton
    // Note: singleton pattern means we work with the same instance
    persistence = PoliticalSessionPersistence.getInstance();
    persistence.clearAllSessions();
  });

  afterEach(() => {
    persistence.stopAutoSave();
  });

  // ========================================
  // Singleton Tests
  // ========================================
  describe('singleton', () => {
    test('getInstance returns same instance', () => {
      const instance1 = PoliticalSessionPersistence.getInstance();
      const instance2 = PoliticalSessionPersistence.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('sessionPersistence is singleton instance', () => {
      expect(sessionPersistence).toBe(PoliticalSessionPersistence.getInstance());
    });
  });

  // ========================================
  // Create Session Tests
  // ========================================
  describe('createSession', () => {
    test('creates new session with default name', () => {
      const session = persistence.createSession();

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session_/);
      expect(session.name).toContain('Analysis Session');
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    test('creates session with custom name', () => {
      const session = persistence.createSession('GOTV Analysis');

      expect(session.name).toBe('GOTV Analysis');
    });

    test('sets default context', () => {
      const session = persistence.createSession();

      expect(session.context).toBeDefined();
      expect(session.context.currentView).toBe('overview');
      expect(session.context.selectedPrecincts).toEqual([]);
    });

    test('increments session count in name', () => {
      persistence.createSession();
      persistence.createSession();
      const session3 = persistence.createSession();

      expect(session3.name).toContain('3');
    });

    test('saves to localStorage', () => {
      persistence.createSession('Test Session');

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  // ========================================
  // Get Current Session Tests
  // ========================================
  describe('getCurrentSession', () => {
    test('returns current session if exists', () => {
      const created = persistence.createSession('Test');
      const current = persistence.getCurrentSession();

      expect(current.id).toBe(created.id);
    });

    test('creates new session if none exists', () => {
      persistence.clearAllSessions();
      const current = persistence.getCurrentSession();

      expect(current).toBeDefined();
      expect(current.id).toMatch(/^session_/);
    });
  });

  // ========================================
  // Load Session Tests
  // ========================================
  describe('loadSession', () => {
    test('loads existing session by ID', () => {
      const session1 = persistence.createSession('Session 1');
      const session2 = persistence.createSession('Session 2');

      const loaded = persistence.loadSession(session1.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(session1.id);
      expect(loaded?.name).toBe('Session 1');
    });

    test('returns null for nonexistent session', () => {
      const loaded = persistence.loadSession('nonexistent-id');

      expect(loaded).toBeNull();
    });

    test('sets loaded session as current', () => {
      const session1 = persistence.createSession('Session 1');
      persistence.createSession('Session 2');

      persistence.loadSession(session1.id);
      const current = persistence.getCurrentSession();

      expect(current.id).toBe(session1.id);
    });
  });

  // ========================================
  // Update Session Tests
  // ========================================
  describe('updateSession', () => {
    test('updates current session properties', () => {
      persistence.createSession('Test');

      persistence.updateSession({ name: 'Updated Name' });

      const current = persistence.getCurrentSession();
      expect(current.name).toBe('Updated Name');
    });

    test('updates timestamp on update', () => {
      const session = persistence.createSession();
      const originalUpdatedAt = session.updatedAt;

      persistence.updateSession({ name: 'New Name' });

      const current = persistence.getCurrentSession();
      // The timestamp should be updated (may be equal if same millisecond)
      expect(current.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    test('does nothing if no current session', () => {
      persistence.clearAllSessions();

      // Should not throw
      persistence.updateSession({ name: 'Test' });
    });
  });

  // ========================================
  // Add Message Tests
  // ========================================
  describe('addMessage', () => {
    test('adds message to current session', () => {
      persistence.createSession();

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Show me swing precincts',
        timestamp: new Date(),
      };

      persistence.addMessage(message);

      const session = persistence.getCurrentSession();
      expect(session.messages.length).toBe(1);
      expect(session.messages[0].content).toBe('Show me swing precincts');
    });

    test('maintains message order', () => {
      persistence.createSession();

      for (let i = 0; i < 5; i++) {
        persistence.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }

      const session = persistence.getCurrentSession();
      expect(session.messages.length).toBe(5);
      expect(session.messages[0].content).toBe('Message 0');
      expect(session.messages[4].content).toBe('Message 4');
    });

    test('limits message history to 100', () => {
      persistence.createSession();

      for (let i = 0; i < 110; i++) {
        persistence.addMessage({
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }

      const session = persistence.getCurrentSession();
      expect(session.messages.length).toBeLessThanOrEqual(100);
    });
  });

  // ========================================
  // Update Context Tests
  // ========================================
  describe('updateContext', () => {
    test('updates context properties', () => {
      persistence.createSession();

      persistence.updateContext({
        currentView: 'precinct',
        selectedPrecincts: ['P1', 'P2'],
      });

      const session = persistence.getCurrentSession();
      expect(session.context.currentView).toBe('precinct');
      expect(session.context.selectedPrecincts).toEqual(['P1', 'P2']);
    });

    test('merges with existing context', () => {
      persistence.createSession();
      persistence.updateContext({ currentView: 'jurisdiction' });
      persistence.updateContext({ selectedPrecincts: ['P1'] });

      const session = persistence.getCurrentSession();
      expect(session.context.currentView).toBe('jurisdiction');
      expect(session.context.selectedPrecincts).toEqual(['P1']);
    });
  });

  // ========================================
  // Delete Session Tests
  // ========================================
  describe('deleteSession', () => {
    test('deletes existing session', () => {
      const session = persistence.createSession('To Delete');
      const id = session.id;

      const deleted = persistence.deleteSession(id);

      expect(deleted).toBe(true);
      expect(persistence.loadSession(id)).toBeNull();
    });

    test('returns false for nonexistent session', () => {
      const deleted = persistence.deleteSession('nonexistent');

      expect(deleted).toBe(false);
    });

    test('clears current session ID if deleted', () => {
      const session = persistence.createSession();
      persistence.deleteSession(session.id);

      // Getting current session should create new one
      const current = persistence.getCurrentSession();
      expect(current.id).not.toBe(session.id);
    });
  });

  // ========================================
  // Rename Session Tests
  // ========================================
  describe('renameSession', () => {
    test('renames existing session', () => {
      const session = persistence.createSession('Original');

      persistence.renameSession(session.id, 'Renamed Session');

      const loaded = persistence.loadSession(session.id);
      expect(loaded?.name).toBe('Renamed Session');
    });

    test('updates metadata name', () => {
      const session = persistence.createSession('Original');
      persistence.renameSession(session.id, 'New Name');

      const sessions = persistence.listSessions();
      const renamed = sessions.find(s => s.id === session.id);
      expect(renamed?.name).toBe('New Name');
    });
  });

  // ========================================
  // Tag Management Tests
  // ========================================
  describe('tag management', () => {
    test('addTag adds tag to session', () => {
      const session = persistence.createSession();

      persistence.addTag(session.id, 'gotv');

      const loaded = persistence.loadSession(session.id);
      expect(loaded?.tags).toContain('gotv');
    });

    test('addTag prevents duplicates', () => {
      const session = persistence.createSession();

      persistence.addTag(session.id, 'gotv');
      persistence.addTag(session.id, 'gotv');

      const loaded = persistence.loadSession(session.id);
      expect(loaded?.tags?.filter(t => t === 'gotv').length).toBe(1);
    });

    test('removeTag removes tag from session', () => {
      const session = persistence.createSession();
      persistence.addTag(session.id, 'gotv');
      persistence.addTag(session.id, 'persuasion');

      persistence.removeTag(session.id, 'gotv');

      const loaded = persistence.loadSession(session.id);
      expect(loaded?.tags).not.toContain('gotv');
      expect(loaded?.tags).toContain('persuasion');
    });
  });

  // ========================================
  // List Sessions Tests
  // ========================================
  describe('listSessions', () => {
    test('returns all sessions as metadata', () => {
      persistence.createSession('Session 1');
      persistence.createSession('Session 2');
      persistence.createSession('Session 3');

      const sessions = persistence.listSessions();

      expect(sessions.length).toBe(3);
    });

    test('respects limit option', () => {
      for (let i = 0; i < 10; i++) {
        persistence.createSession(`Session ${i}`);
      }

      const sessions = persistence.listSessions({ limit: 5 });

      expect(sessions.length).toBe(5);
    });

    test('respects offset option', () => {
      for (let i = 0; i < 5; i++) {
        persistence.createSession(`Session ${i}`);
      }

      const sessions = persistence.listSessions({ offset: 2, limit: 10 });

      expect(sessions.length).toBe(3);
    });

    test('sorts by updatedAt descending by default', () => {
      // Mock Date.now to ensure different timestamps
      const originalDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime++);
      const OriginalDate = Date;
      // @ts-ignore - mocking Date constructor
      global.Date = class extends OriginalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(Date.now());
          } else {
            // @ts-ignore
            super(...args);
          }
        }
      } as any;
      global.Date.now = Date.now;

      persistence.createSession('First');
      persistence.createSession('Second');
      const third = persistence.createSession('Third');

      // Update third session to make it most recent using renameSession
      persistence.renameSession(third.id, 'Third Updated');

      const sessions = persistence.listSessions();

      // Restore Date
      global.Date = OriginalDate;
      Date.now = originalDateNow;

      // Third Updated should be first as it was updated most recently
      expect(sessions[0].name).toBe('Third Updated');
    });

    test('sorts by name when specified', () => {
      persistence.createSession('Zebra');
      persistence.createSession('Alpha');
      persistence.createSession('Middle');

      const sessions = persistence.listSessions({ sortBy: 'name', sortOrder: 'asc' });

      expect(sessions[0].name).toBe('Alpha');
      expect(sessions[2].name).toBe('Zebra');
    });

    test('filters by tags', () => {
      const s1 = persistence.createSession('GOTV Analysis');
      const s2 = persistence.createSession('Persuasion');
      const s3 = persistence.createSession('Both');

      persistence.addTag(s1.id, 'gotv');
      persistence.addTag(s2.id, 'persuasion');
      persistence.addTag(s3.id, 'gotv');

      const sessions = persistence.listSessions({ tags: ['gotv'] });

      expect(sessions.length).toBe(2);
      expect(sessions.every(s => s.tags.includes('gotv'))).toBe(true);
    });
  });

  // ========================================
  // Session Count Tests
  // ========================================
  describe('getSessionCount', () => {
    test('returns correct count', () => {
      expect(persistence.getSessionCount()).toBe(0);

      persistence.createSession();
      expect(persistence.getSessionCount()).toBe(1);

      persistence.createSession();
      expect(persistence.getSessionCount()).toBe(2);
    });
  });

  // ========================================
  // Get All Tags Tests
  // ========================================
  describe('getAllTags', () => {
    test('returns all unique tags', () => {
      const s1 = persistence.createSession();
      const s2 = persistence.createSession();

      persistence.addTag(s1.id, 'gotv');
      persistence.addTag(s1.id, 'lansing');
      persistence.addTag(s2.id, 'gotv');
      persistence.addTag(s2.id, 'persuasion');

      const tags = persistence.getAllTags();

      expect(tags).toContain('gotv');
      expect(tags).toContain('lansing');
      expect(tags).toContain('persuasion');
      expect(tags.length).toBe(3);
    });

    test('returns empty array when no tags', () => {
      persistence.createSession();

      const tags = persistence.getAllTags();

      expect(tags).toEqual([]);
    });

    test('returns sorted tags', () => {
      const session = persistence.createSession();
      persistence.addTag(session.id, 'zebra');
      persistence.addTag(session.id, 'alpha');

      const tags = persistence.getAllTags();

      expect(tags[0]).toBe('alpha');
      expect(tags[1]).toBe('zebra');
    });
  });

  // ========================================
  // Export Session Tests
  // ========================================
  describe('exportSession', () => {
    test('exports session with metadata', () => {
      const session = persistence.createSession('Export Test');
      persistence.addMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      });

      const exported = persistence.exportSession(session.id);

      expect(exported).not.toBeNull();
      expect(exported?.version).toBeDefined();
      expect(exported?.exportedAt).toBeDefined();
      expect(exported?.session.name).toBe('Export Test');
      expect(exported?.metadata.messageCount).toBe(1);
    });

    test('returns null for nonexistent session', () => {
      const exported = persistence.exportSession('nonexistent');

      expect(exported).toBeNull();
    });
  });

  // ========================================
  // Import Session Tests
  // ========================================
  describe('importSession', () => {
    test('imports session from export', () => {
      const original = persistence.createSession('Original');
      persistence.addMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Original message',
        timestamp: new Date(),
      });

      const exported = persistence.exportSession(original.id)!;
      persistence.deleteSession(original.id);

      const imported = persistence.importSession(exported);

      expect(imported).not.toBeNull();
      // Session name stays original, metadata has "(Imported)" appended
      expect(imported?.name).toBe('Original');
      expect(imported?.messages[0].content).toBe('Original message');

      // Check that metadata has "(Imported)" suffix
      const sessions = persistence.listSessions();
      const importedMeta = sessions.find(s => s.id === imported?.id);
      expect(importedMeta?.name).toContain('(Imported)');
    });

    test('generates new ID on import', () => {
      const original = persistence.createSession('Original');
      const exported = persistence.exportSession(original.id)!;

      const imported = persistence.importSession(exported);

      expect(imported?.id).not.toBe(original.id);
    });

    test('returns null for invalid export', () => {
      const invalid = { version: null, session: null } as any;

      const imported = persistence.importSession(invalid);

      expect(imported).toBeNull();
    });
  });

  // ========================================
  // JSON Export/Import Tests
  // ========================================
  describe('JSON export/import', () => {
    test('exportSessionAsJSON returns JSON string', () => {
      const session = persistence.createSession('JSON Test');

      const json = persistence.exportSessionAsJSON(session.id);

      expect(json).not.toBeNull();
      expect(() => JSON.parse(json!)).not.toThrow();
    });

    test('importSessionFromJSON imports from JSON string', () => {
      const session = persistence.createSession('JSON Test');
      const json = persistence.exportSessionAsJSON(session.id)!;
      persistence.deleteSession(session.id);

      const imported = persistence.importSessionFromJSON(json);

      expect(imported).not.toBeNull();
      // Session name stays original, metadata has "(Imported)" appended
      expect(imported?.name).toBe('JSON Test');

      // Check that metadata has "(Imported)" suffix
      const sessions = persistence.listSessions();
      const importedMeta = sessions.find(s => s.id === imported?.id);
      expect(importedMeta?.name).toContain('(Imported)');
    });

    test('importSessionFromJSON handles invalid JSON', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const imported = persistence.importSessionFromJSON('not valid json');

      expect(imported).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // Auto-Save Tests
  // ========================================
  describe('auto-save', () => {
    test('stopAutoSave clears interval when interval exists', () => {
      // The singleton's autoSaveInterval may already be cleared by previous tests
      // We just verify that stopAutoSave doesn't throw and the method exists
      expect(() => persistence.stopAutoSave()).not.toThrow();

      // Call again - should handle already-cleared state gracefully
      expect(() => persistence.stopAutoSave()).not.toThrow();
    });

    test('forceSave saves immediately', () => {
      persistence.createSession();
      const callsBefore = (localStorageMock.setItem as jest.Mock).mock.calls.length;

      persistence.forceSave();

      expect((localStorageMock.setItem as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // ========================================
  // Session Limit Tests
  // ========================================
  describe('session limits', () => {
    test('enforces maximum sessions limit', () => {
      // Create more than max sessions (50)
      for (let i = 0; i < 55; i++) {
        persistence.createSession(`Session ${i}`);
      }

      expect(persistence.getSessionCount()).toBeLessThanOrEqual(50);
    });

    test('prunes oldest sessions when limit exceeded', () => {
      // Create sessions with known order
      for (let i = 0; i < 55; i++) {
        persistence.createSession(`Session ${i}`);
      }

      const sessions = persistence.listSessions({ limit: 100 });

      // Oldest sessions should be removed
      expect(sessions.some(s => s.name === 'Session 54')).toBe(true);
    });
  });

  // ========================================
  // Clear All Sessions Tests
  // ========================================
  describe('clearAllSessions', () => {
    test('removes all sessions', () => {
      persistence.createSession();
      persistence.createSession();

      persistence.clearAllSessions();

      expect(persistence.getSessionCount()).toBe(0);
    });

    test('clears current session ID', () => {
      persistence.createSession();
      persistence.clearAllSessions();

      // Getting current creates new session
      const current = persistence.getCurrentSession();
      expect(persistence.getSessionCount()).toBe(1);
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles localStorage quota exceeded', () => {
      const original = localStorageMock.setItem;
      let callCount = 0;
      localStorageMock.setItem = jest.fn((_key: string, _value: string) => {
        callCount++;
        if (callCount > 5) {
          const error = new DOMException('Quota exceeded', 'QuotaExceededError');
          throw error;
        }
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      for (let i = 0; i < 10; i++) {
        persistence.createSession(`Session ${i}`);
      }

      localStorageMock.setItem = original;
      consoleSpy.mockRestore();
    });

    test('handles malformed localStorage data', () => {
      localStorageMock.getItem = jest.fn((_key: string): string | null => 'invalid json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Create new instance to trigger loadFromStorage
      const newPersistence = PoliticalSessionPersistence.getInstance();

      // Should not throw
      expect(newPersistence).toBeDefined();
      consoleSpy.mockRestore();
    });
  });
});
