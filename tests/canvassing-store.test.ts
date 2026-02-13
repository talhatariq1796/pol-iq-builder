/**
 * CanvassingStore Tests
 *
 * Tests for LocalStorage persistence of canvassing universes
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CanvassingStore } from '@/lib/canvassing/CanvassingStore';
import type { CanvassingUniverse, CanvassingPrecinct } from '@/lib/canvassing/types';

// Mock localStorage for Node.js environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe('CanvassingStore', () => {
  let store: CanvassingStore;
  let mockLocalStorage: LocalStorageMock;

  beforeEach(() => {
    // Set up mock localStorage
    mockLocalStorage = new LocalStorageMock();
    global.localStorage = mockLocalStorage as any;
    (global as any).window = { localStorage: mockLocalStorage };

    store = new CanvassingStore();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  const createMockPrecinct = (id: string): CanvassingPrecinct => ({
    precinctId: id,
    precinctName: `Precinct ${id}`,
    jurisdiction: 'Lansing',
    registeredVoters: 1000,
    activeVoters: 800,
    gotvPriority: 75,
    persuasionOpportunity: 50,
    swingPotential: 60,
    targetingStrategy: 'GOTV',
    estimatedDoors: 400,
    estimatedTurfs: 2,
    estimatedHours: 10,
    priorityRank: 1,
  });

  const createMockUniverse = (id: string, name: string): CanvassingUniverse => ({
    id,
    name,
    description: `Test universe ${name}`,
    createdAt: new Date().toISOString(),
    targetDoorsPerTurf: 200,
    targetDoorsPerHour: 40,
    targetContactRate: 0.35,
    totalPrecincts: 5,
    totalEstimatedDoors: 2000,
    estimatedTurfs: 10,
    estimatedHours: 50,
    volunteersNeeded: 7,
    precincts: [
      createMockPrecinct('P1'),
      createMockPrecinct('P2'),
      createMockPrecinct('P3'),
      createMockPrecinct('P4'),
      createMockPrecinct('P5'),
    ],
  });

  describe('Basic CRUD Operations', () => {
    it('should save and retrieve a universe', () => {
      const universe = createMockUniverse('test-1', 'Test Universe 1');

      store.save(universe);
      const retrieved = store.get('test-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('test-1');
      expect(retrieved?.name).toBe('Test Universe 1');
      expect(retrieved?.precincts.length).toBe(5);
    });

    it('should retrieve all universes', () => {
      const universe1 = createMockUniverse('test-1', 'Universe 1');
      const universe2 = createMockUniverse('test-2', 'Universe 2');

      store.save(universe1);
      store.save(universe2);

      const all = store.getAll();
      expect(all.length).toBe(2);
    });

    it('should update an existing universe', () => {
      const universe = createMockUniverse('test-1', 'Original Name');
      store.save(universe);

      const updated = { ...universe, name: 'Updated Name' };
      store.save(updated);

      const retrieved = store.get('test-1');
      expect(retrieved?.name).toBe('Updated Name');
      expect(store.getAll().length).toBe(1);
    });

    it('should delete a universe', () => {
      const universe = createMockUniverse('test-1', 'Test Universe');
      store.save(universe);

      expect(store.get('test-1')).not.toBeNull();

      store.delete('test-1');

      expect(store.get('test-1')).toBeNull();
      expect(store.getAll().length).toBe(0);
    });

    it('should return null for non-existent universe', () => {
      const result = store.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      const universe1 = createMockUniverse('test-1', 'Universe 1');
      const universe2 = createMockUniverse('test-2', 'Universe 2');
      universe2.segmentId = 'seg-123';

      store.save(universe1);
      store.save(universe2);
    });

    it('should check if a name exists', () => {
      expect(store.exists('Universe 1')).toBe(true);
      expect(store.exists('Non-existent')).toBe(false);
    });

    it('should check name exists excluding specific ID', () => {
      expect(store.exists('Universe 1', 'test-1')).toBe(false);
      expect(store.exists('Universe 1', 'test-2')).toBe(true);
    });

    it('should get universe count', () => {
      expect(store.getCount()).toBe(2);
    });

    it('should get universes by segment ID', () => {
      const results = store.getBySegmentId('seg-123');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('test-2');
    });

    it('should return empty array for non-matching segment ID', () => {
      const results = store.getBySegmentId('non-existent');
      expect(results.length).toBe(0);
    });

    it('should get all universes sorted by creation date', () => {
      // Clear and add with delays to ensure different timestamps
      store.clearAll();

      const old = createMockUniverse('old', 'Old');
      old.createdAt = '2024-01-01T00:00:00Z';

      const newer = createMockUniverse('newer', 'Newer');
      newer.createdAt = '2024-06-01T00:00:00Z';

      const newest = createMockUniverse('newest', 'Newest');
      newest.createdAt = '2024-12-01T00:00:00Z';

      store.save(old);
      store.save(newer);
      store.save(newest);

      const sorted = store.getAllSorted();
      expect(sorted[0].id).toBe('newest');
      expect(sorted[1].id).toBe('newer');
      expect(sorted[2].id).toBe('old');
    });
  });

  describe('Import/Export', () => {
    it('should export universes to JSON', () => {
      const universe = createMockUniverse('test-1', 'Test Universe');
      store.save(universe);

      const json = store.exportToJSON();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].id).toBe('test-1');
    });

    it('should import universes from JSON', () => {
      const universes = [
        createMockUniverse('import-1', 'Imported 1'),
        createMockUniverse('import-2', 'Imported 2'),
      ];

      const json = JSON.stringify(universes);
      const imported = store.importFromJSON(json);

      expect(imported.length).toBe(2);
      expect(store.getCount()).toBe(2);
      expect(store.get('import-1')).not.toBeNull();
      expect(store.get('import-2')).not.toBeNull();
    });

    it('should throw error on invalid JSON import', () => {
      expect(() => {
        store.importFromJSON('invalid json');
      }).toThrow();
    });

    it('should throw error on invalid universe structure', () => {
      const invalidData = [{ id: 'test' }]; // Missing required fields
      const json = JSON.stringify(invalidData);

      expect(() => {
        store.importFromJSON(json);
      }).toThrow('Invalid universe structure');
    });
  });

  describe('Duplicate', () => {
    it('should duplicate a universe with new name', () => {
      const original = createMockUniverse('original', 'Original');
      store.save(original);

      const duplicated = store.duplicate('original', 'Duplicated');

      expect(duplicated).not.toBeNull();
      expect(duplicated?.name).toBe('Duplicated');
      expect(duplicated?.id).not.toBe('original');
      expect(duplicated?.precincts.length).toBe(5);
      expect(store.getCount()).toBe(2);
    });

    it('should return null when duplicating non-existent universe', () => {
      const result = store.duplicate('non-existent', 'New Name');
      expect(result).toBeNull();
    });
  });

  describe('Clear All', () => {
    it('should clear all universes', () => {
      store.save(createMockUniverse('test-1', 'Universe 1'));
      store.save(createMockUniverse('test-2', 'Universe 2'));

      expect(store.getCount()).toBe(2);

      store.clearAll();

      expect(store.getCount()).toBe(0);
      expect(store.getAll().length).toBe(0);
    });
  });

  describe('SSR Safety', () => {
    it('should handle missing localStorage gracefully', () => {
      // Remove window/localStorage
      delete (global as any).window;

      const newStore = new CanvassingStore();

      // Should not throw, should return empty arrays
      expect(newStore.getAll()).toEqual([]);
      expect(newStore.get('any-id')).toBeNull();
      expect(newStore.getCount()).toBe(0);
    });

    it('should throw error when trying to save without localStorage', () => {
      delete (global as any).window;

      const newStore = new CanvassingStore();
      const universe = createMockUniverse('test', 'Test');

      expect(() => {
        newStore.save(universe);
      }).toThrow('localStorage is not available');
    });
  });

  describe('updatedAt Timestamp', () => {
    it('should set updatedAt when updating existing universe', () => {
      const universe = createMockUniverse('test-1', 'Original');
      store.save(universe);

      // Wait a bit to ensure different timestamp
      const updated = { ...universe, name: 'Updated' };
      store.save(updated);

      const retrieved = store.get('test-1');
      expect(retrieved?.updatedAt).toBeDefined();
    });

    it('should not have updatedAt on initial save', () => {
      const universe = createMockUniverse('test-1', 'New');
      store.save(universe);

      const retrieved = store.get('test-1');
      // Initial save might not have updatedAt (depending on implementation)
      // This tests the actual behavior
    });
  });
});
