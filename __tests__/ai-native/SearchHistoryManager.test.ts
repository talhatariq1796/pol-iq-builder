/**
 * SearchHistoryManager Tests
 *
 * Tests search history storage, retrieval, and management.
 * Run with: npm test -- --testPathPattern=SearchHistoryManager
 */

import {
  SearchHistoryManager,
  getSearchHistoryManager,
  type SearchHistoryEntry,
} from '@/lib/ai-native/SearchHistoryManager';

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

describe('SearchHistoryManager', () => {
  let manager: SearchHistoryManager;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    manager = new SearchHistoryManager();
  });

  // ========================================
  // Constructor Tests
  // ========================================
  describe('constructor', () => {
    test('initializes with localStorage available', () => {
      const mgr = new SearchHistoryManager();
      expect(mgr).toBeDefined();
    });

    test('handles localStorage unavailable gracefully', () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn((_key: string, _value: string) => {
        throw new Error('Storage not available');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mgr = new SearchHistoryManager();
      expect(mgr).toBeDefined();

      localStorageMock.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // Add Tests
  // ========================================
  describe('add', () => {
    test('adds query to history', () => {
      manager.add('swing voters in East Lansing');
      const history = manager.getAll();
      expect(history.length).toBe(1);
      expect(history[0].query).toBe('swing voters in East Lansing');
    });

    test('adds query with tool context', () => {
      manager.add('high GOTV priority', 'segments');
      const history = manager.getAll();
      expect(history[0].tool).toBe('segments');
    });

    test('skips empty queries', () => {
      manager.add('');
      const history = manager.getAll();
      expect(history.length).toBe(0);
    });

    test('skips very short queries (< 3 chars)', () => {
      manager.add('ab');
      const history = manager.getAll();
      expect(history.length).toBe(0);
    });

    test('trims whitespace from queries', () => {
      manager.add('  swing voters  ');
      const history = manager.getAll();
      expect(history[0].query).toBe('swing voters');
    });

    test('deduplicates case-insensitively', () => {
      manager.add('Swing Voters');
      manager.add('swing voters');
      const history = manager.getAll();
      expect(history.length).toBe(1);
      expect(history[0].query).toBe('swing voters'); // Most recent
    });

    test('moves duplicate to front', () => {
      manager.add('query one');
      manager.add('query two');
      manager.add('query one');
      const history = manager.getAll();
      expect(history[0].query).toBe('query one');
      expect(history.length).toBe(2);
    });

    test('maintains max size of 10', () => {
      for (let i = 0; i < 15; i++) {
        manager.add(`query ${i}`);
      }
      const history = manager.getAll();
      expect(history.length).toBe(10);
      expect(history[0].query).toBe('query 14'); // Most recent
    });

    test('includes timestamp', () => {
      const before = new Date().toISOString();
      manager.add('test query');
      const after = new Date().toISOString();

      const history = manager.getAll();
      expect(history[0].timestamp).toBeDefined();
      expect(history[0].timestamp >= before).toBe(true);
      expect(history[0].timestamp <= after).toBe(true);
    });

    test('handles localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn((_key: string, _value: string) => {
        throw new Error('Quota exceeded');
      });

      // Should not throw
      manager.add('test query');

      // Restore
      localStorageMock.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // GetAll Tests
  // ========================================
  describe('getAll', () => {
    test('returns empty array when no history', () => {
      const history = manager.getAll();
      expect(history).toEqual([]);
    });

    test('returns all entries', () => {
      manager.add('query one');
      manager.add('query two');
      manager.add('query three');

      const history = manager.getAll();
      expect(history.length).toBe(3);
    });

    test('filters by tool when provided', () => {
      manager.add('segments query', 'segments');
      manager.add('donors query', 'donors');
      manager.add('general query');

      const segmentsHistory = manager.getAll('segments');
      expect(segmentsHistory.length).toBe(2); // segments + general (no tool)
      expect(segmentsHistory.some(h => h.query === 'segments query')).toBe(true);
    });

    test('returns entries without tool filter when tool is undefined', () => {
      manager.add('specific tool query', 'segments');
      manager.add('no tool query');

      const history = manager.getAll();
      expect(history.length).toBe(2);
    });

    test('handles malformed JSON gracefully', () => {
      const originalGetItem = localStorageMock.getItem;
      localStorageMock.getItem = jest.fn((_key: string): string | null => 'invalid json');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const history = manager.getAll();
      expect(history).toEqual([]);

      // Restore
      localStorageMock.getItem = originalGetItem;
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // GetRecent Tests
  // ========================================
  describe('getRecent', () => {
    test('returns last N entries', () => {
      manager.add('query one');
      manager.add('query two');
      manager.add('query three');

      const recent = manager.getRecent(2);
      expect(recent.length).toBe(2);
      expect(recent[0].query).toBe('query three');
      expect(recent[1].query).toBe('query two');
    });

    test('returns default of 5 entries', () => {
      for (let i = 0; i < 10; i++) {
        manager.add(`query ${i}`);
      }

      const recent = manager.getRecent();
      expect(recent.length).toBe(5);
    });

    test('returns all entries if fewer than requested', () => {
      manager.add('query one');
      manager.add('query two');

      const recent = manager.getRecent(5);
      expect(recent.length).toBe(2);
    });

    test('filters by tool', () => {
      manager.add('segments query', 'segments');
      manager.add('donors query', 'donors');
      manager.add('another segments', 'segments');

      const recent = manager.getRecent(5, 'segments');
      expect(recent.every(h => !h.tool || h.tool === 'segments')).toBe(true);
    });
  });

  // ========================================
  // Remove Tests
  // ========================================
  describe('remove', () => {
    test('removes entry by query text', () => {
      manager.add('query one');
      manager.add('query two');

      manager.remove('query one');

      const history = manager.getAll();
      expect(history.length).toBe(1);
      expect(history[0].query).toBe('query two');
    });

    test('removes case-insensitively', () => {
      manager.add('Query One');

      manager.remove('query one');

      const history = manager.getAll();
      expect(history.length).toBe(0);
    });

    test('does nothing if query not found', () => {
      manager.add('query one');

      manager.remove('nonexistent');

      const history = manager.getAll();
      expect(history.length).toBe(1);
    });
  });

  // ========================================
  // Clear Tests
  // ========================================
  describe('clear', () => {
    test('removes all history', () => {
      manager.add('query one');
      manager.add('query two');

      manager.clear();

      const history = manager.getAll();
      expect(history.length).toBe(0);
    });

    test('calls localStorage.removeItem', () => {
      manager.add('query');
      manager.clear();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('pol_recent_searches');
    });
  });

  // ========================================
  // FormatTimeAgo Tests
  // ========================================
  describe('formatTimeAgo', () => {
    test('returns "just now" for < 1 minute ago', () => {
      const now = new Date().toISOString();
      expect(SearchHistoryManager.formatTimeAgo(now)).toBe('just now');
    });

    test('returns minutes for < 1 hour ago', () => {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      expect(SearchHistoryManager.formatTimeAgo(thirtyMinsAgo)).toBe('30m ago');
    });

    test('returns hours for < 24 hours ago', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
      expect(SearchHistoryManager.formatTimeAgo(fiveHoursAgo)).toBe('5h ago');
    });

    test('returns days for < 7 days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(SearchHistoryManager.formatTimeAgo(threeDaysAgo)).toBe('3d ago');
    });

    test('returns date string for >= 7 days ago', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const result = SearchHistoryManager.formatTimeAgo(tenDaysAgo.toISOString());
      expect(result).toBe(tenDaysAgo.toLocaleDateString());
    });
  });

  // ========================================
  // Singleton Tests
  // ========================================
  describe('getSearchHistoryManager singleton', () => {
    test('returns same instance', () => {
      const instance1 = getSearchHistoryManager();
      const instance2 = getSearchHistoryManager();
      expect(instance1).toBe(instance2);
    });

    test('returns a SearchHistoryManager instance', () => {
      const instance = getSearchHistoryManager();
      expect(instance).toBeInstanceOf(SearchHistoryManager);
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles unicode in queries', () => {
      manager.add('café voters émigré');
      const history = manager.getAll();
      expect(history[0].query).toBe('café voters émigré');
    });

    test('handles special characters', () => {
      manager.add('voters & residents (all)');
      const history = manager.getAll();
      expect(history[0].query).toBe('voters & residents (all)');
    });

    test('handles very long queries', () => {
      const longQuery = 'a'.repeat(1000);
      manager.add(longQuery);
      const history = manager.getAll();
      expect(history[0].query).toBe(longQuery);
    });

    test('handles concurrent adds', () => {
      // Simulate rapid additions
      for (let i = 0; i < 5; i++) {
        manager.add(`rapid query ${i}`);
      }
      const history = manager.getAll();
      expect(history.length).toBe(5);
    });
  });

  // ========================================
  // Integration Tests
  // ========================================
  describe('integration', () => {
    test('full workflow: add, get, remove, clear', () => {
      // Add queries
      manager.add('query one', 'segments');
      manager.add('query two', 'donors');
      manager.add('query three');

      // Verify additions
      expect(manager.getAll().length).toBe(3);

      // Filter by tool
      const donorsHistory = manager.getAll('donors');
      expect(donorsHistory.some(h => h.query === 'query two')).toBe(true);

      // Get recent
      const recent = manager.getRecent(2);
      expect(recent[0].query).toBe('query three');

      // Remove one
      manager.remove('query one');
      expect(manager.getAll().length).toBe(2);

      // Clear all
      manager.clear();
      expect(manager.getAll().length).toBe(0);
    });

    test('persists across manager instances', () => {
      manager.add('persisted query');

      // Create new manager (simulates page reload)
      const newManager = new SearchHistoryManager();
      const history = newManager.getAll();

      expect(history.length).toBe(1);
      expect(history[0].query).toBe('persisted query');
    });
  });
});
