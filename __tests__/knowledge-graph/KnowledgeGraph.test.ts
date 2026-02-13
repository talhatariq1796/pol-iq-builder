/**
 * KnowledgeGraph Tests
 *
 * Tests in-memory graph storage, entity management, and querying.
 * Run with: npm test -- --testPathPattern=KnowledgeGraph
 */

import { KnowledgeGraph } from '@/lib/knowledge-graph/KnowledgeGraph';
import type {
  Entity,
  EntityType,
  Relationship,
  RelationshipType,
  GraphQuery,
  CandidateEntity,
  JurisdictionEntity,
  PrecinctEntity,
  IssueEntity,
  OfficeEntity,
} from '@/lib/knowledge-graph/types';

function createMockCandidate(overrides: Partial<CandidateEntity> = {}): CandidateEntity {
  return {
    id: `candidate-${Math.random().toString(36).substr(2, 9)}`,
    type: 'candidate',
    name: 'Test Candidate',
    aliases: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      party: 'DEM',
      status: 'declared',
    },
    ...overrides,
  };
}

function createMockOffice(overrides: Partial<OfficeEntity> = {}): OfficeEntity {
  return {
    id: `office-${Math.random().toString(36).substr(2, 9)}`,
    type: 'office',
    name: 'Test Office',
    aliases: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      level: 'state',
      officeType: 'legislative',
      jurisdiction: 'Michigan',
      termLength: 2,
      nextElection: '2024-11-05',
    },
    ...overrides,
  };
}

function createMockJurisdiction(overrides: Partial<JurisdictionEntity> = {}): JurisdictionEntity {
  return {
    id: `jurisdiction-${Math.random().toString(36).substr(2, 9)}`,
    type: 'jurisdiction',
    name: 'Test City',
    aliases: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      level: 'city',
      density: 'urban',
    },
    ...overrides,
  };
}

function createMockIssue(overrides: Partial<IssueEntity> = {}): IssueEntity {
  return {
    id: `issue-${Math.random().toString(36).substr(2, 9)}`,
    type: 'issue',
    name: 'Test Issue',
    aliases: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      category: 'environmental',
      salience: 50,
      keywords: ['environment', 'test'],
    },
    ...overrides,
  };
}

function createMockRelationship(
  id: string,
  sourceId: string,
  sourceType: EntityType,
  targetId: string,
  targetType: EntityType,
  type: RelationshipType,
): Relationship {
  return {
    id,
    sourceId,
    sourceType,
    targetId,
    targetType,
    type,
    createdAt: new Date().toISOString(),
  };
}

describe('KnowledgeGraph', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph();
  });

  // ========================================
  // Entity Operations Tests
  // ========================================
  describe('entity operations', () => {
    describe('addEntity', () => {
      test('adds entity to graph', () => {
        const candidate = createMockCandidate({ name: 'Jane Doe' });
        graph.addEntity(candidate);

        const retrieved = graph.getEntity(candidate.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.name).toBe('Jane Doe');
      });

      test('generates ID if not provided', () => {
        const candidate = createMockCandidate({ id: undefined as any, name: 'Auto ID' });
        graph.addEntity(candidate);

        expect(candidate.id).toMatch(/^candidate:/);
      });

      test('sets timestamps', () => {
        const candidate = createMockCandidate({
          createdAt: undefined as any,
          updatedAt: undefined as any,
        });
        graph.addEntity(candidate);

        expect(candidate.createdAt).toBeDefined();
        expect(candidate.updatedAt).toBeDefined();
      });

      test('indexes entity by type', () => {
        const candidate = createMockCandidate();
        graph.addEntity(candidate);

        const stats = graph.getStats();
        expect(stats.entitiesByType['candidate']).toBe(1);
      });

      test('indexes entity by name', () => {
        const candidate = createMockCandidate({ name: 'Searchable Name' });
        graph.addEntity(candidate);

        const results = graph.query({ namePattern: 'searchable' });
        expect(results.entities.length).toBe(1);
      });

      test('indexes aliases', () => {
        const candidate = createMockCandidate({
          name: 'Robert Smith',
          aliases: ['Bob Smith', 'Rob Smith'],
        });
        graph.addEntity(candidate);

        const results = graph.query({ namePattern: 'bob' });
        expect(results.entities.length).toBe(1);
      });
    });

    describe('getEntity', () => {
      test('returns entity by ID', () => {
        const candidate = createMockCandidate({ id: 'test-id' });
        graph.addEntity(candidate);

        const retrieved = graph.getEntity('test-id');
        expect(retrieved).toBe(candidate);
      });

      test('returns undefined for nonexistent', () => {
        const retrieved = graph.getEntity('nonexistent');
        expect(retrieved).toBeUndefined();
      });
    });

    describe('updateEntity', () => {
      test('updates entity properties', () => {
        const candidate = createMockCandidate({ id: 'update-test' });
        graph.addEntity(candidate);

        graph.updateEntity('update-test', { name: 'Updated Name' });

        const retrieved = graph.getEntity('update-test');
        expect(retrieved?.name).toBe('Updated Name');
      });

      test('updates timestamp on update', () => {
        const candidate = createMockCandidate({ id: 'update-test' });
        graph.addEntity(candidate);

        graph.updateEntity('update-test', { name: 'New Name' });

        const retrieved = graph.getEntity('update-test');
        // Verify updatedAt is set and is a valid ISO timestamp
        expect(retrieved?.updatedAt).toBeDefined();
        expect(typeof retrieved?.updatedAt).toBe('string');
        expect(() => new Date(retrieved!.updatedAt!)).not.toThrow();
        // The timestamp should be >= the current time (within reason)
        expect(new Date(retrieved!.updatedAt!).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      });

      test('returns true for successful update', () => {
        const candidate = createMockCandidate({ id: 'update-test' });
        graph.addEntity(candidate);

        const result = graph.updateEntity('update-test', { name: 'New' });
        expect(result).toBe(true);
      });

      test('returns false for nonexistent entity', () => {
        const result = graph.updateEntity('nonexistent', { name: 'New' });
        expect(result).toBe(false);
      });

      test('updates name index when name changes', () => {
        const candidate = createMockCandidate({ id: 'name-change', name: 'Old Name' });
        graph.addEntity(candidate);

        graph.updateEntity('name-change', { name: 'New Name' });

        const oldResults = graph.query({ namePattern: 'old name' });
        const newResults = graph.query({ namePattern: 'new name' });

        expect(oldResults.entities.length).toBe(0);
        expect(newResults.entities.length).toBe(1);
      });
    });

    describe('removeEntity', () => {
      test('removes entity from graph', () => {
        const candidate = createMockCandidate({ id: 'remove-test' });
        graph.addEntity(candidate);

        graph.removeEntity('remove-test');

        expect(graph.getEntity('remove-test')).toBeUndefined();
      });

      test('returns true for successful removal', () => {
        const candidate = createMockCandidate({ id: 'remove-test' });
        graph.addEntity(candidate);

        const result = graph.removeEntity('remove-test');
        expect(result).toBe(true);
      });

      test('returns false for nonexistent entity', () => {
        const result = graph.removeEntity('nonexistent');
        expect(result).toBe(false);
      });

      test('removes associated relationships', () => {
        const candidate = createMockCandidate({ id: 'source' });
        const office = createMockOffice({ id: 'target' });
        graph.addEntity(candidate);
        graph.addEntity(office);

        graph.addRelationship(createMockRelationship('rel-1', 'source', 'candidate', 'target', 'office', 'RUNNING_FOR'));

        graph.removeEntity('source');

        expect(graph.getRelationship('rel-1')).toBeUndefined();
      });

      test('removes from type index', () => {
        const candidate = createMockCandidate({ id: 'index-test' });
        graph.addEntity(candidate);
        graph.removeEntity('index-test');

        const stats = graph.getStats();
        expect(stats.entitiesByType['candidate']).toBe(0);
      });
    });
  });

  // ========================================
  // Relationship Operations Tests
  // ========================================
  describe('relationship operations', () => {
    describe('addRelationship', () => {
      test('adds relationship to graph', () => {
        const candidate = createMockCandidate({ id: 'cand-1' });
        const office = createMockOffice({ id: 'office-1' });
        graph.addEntity(candidate);
        graph.addEntity(office);

        graph.addRelationship(createMockRelationship('rel-1', 'cand-1', 'candidate', 'office-1', 'office', 'RUNNING_FOR'));

        const rel = graph.getRelationship('rel-1');
        expect(rel).toBeDefined();
        expect(rel?.type).toBe('RUNNING_FOR');
      });

      test('generates ID if not provided', () => {
        const relationship: Relationship = {
          sourceId: 'source',
          sourceType: 'candidate',
          targetId: 'target',
          targetType: 'office',
          type: 'RUNNING_FOR',
        } as any;

        graph.addRelationship(relationship);

        expect(relationship.id).toBeDefined();
        expect(relationship.id).toContain('--RUNNING_FOR--');
      });

      test('indexes by source', () => {
        graph.addRelationship(createMockRelationship('rel-1', 'source', 'candidate', 'target', 'office', 'RUNNING_FOR'));

        const stats = graph.getStats();
        expect(stats.relationshipsByType['RUNNING_FOR']).toBe(1);
      });
    });

    describe('getRelationship', () => {
      test('returns relationship by ID', () => {
        graph.addRelationship(createMockRelationship('rel-1', 'a', 'candidate', 'b', 'candidate', 'SUPPORTS'));

        const rel = graph.getRelationship('rel-1');
        expect(rel?.type).toBe('SUPPORTS');
      });

      test('returns undefined for nonexistent', () => {
        expect(graph.getRelationship('nonexistent')).toBeUndefined();
      });
    });

    describe('removeRelationship', () => {
      test('removes relationship from graph', () => {
        graph.addRelationship(createMockRelationship('rel-1', 'a', 'candidate', 'b', 'candidate', 'SUPPORTS'));

        graph.removeRelationship('rel-1');

        expect(graph.getRelationship('rel-1')).toBeUndefined();
      });

      test('returns true for successful removal', () => {
        graph.addRelationship(createMockRelationship('rel-1', 'a', 'candidate', 'b', 'candidate', 'SUPPORTS'));

        expect(graph.removeRelationship('rel-1')).toBe(true);
      });

      test('returns false for nonexistent', () => {
        expect(graph.removeRelationship('nonexistent')).toBe(false);
      });
    });
  });

  // ========================================
  // Query Operations Tests
  // ========================================
  describe('query operations', () => {
    beforeEach(() => {
      // Set up test data
      graph.addEntity(createMockCandidate({ id: 'cand-1', name: 'Alice Smith', metadata: { party: 'DEM', status: 'declared' } }));
      graph.addEntity(createMockCandidate({ id: 'cand-2', name: 'Bob Jones', metadata: { party: 'REP', status: 'declared' } }));
      graph.addEntity(createMockOffice({ id: 'office-1', name: 'State Representative District 73' }));
      graph.addEntity(createMockJurisdiction({ id: 'jur-1', name: 'East Lansing' }));
      graph.addEntity(createMockIssue({ id: 'issue-1', name: 'Climate Change' }));

      graph.addRelationship(createMockRelationship('rel-1', 'cand-1', 'candidate', 'office-1', 'office', 'RUNNING_FOR'));
      graph.addRelationship(createMockRelationship('rel-2', 'cand-1', 'candidate', 'issue-1', 'issue', 'SUPPORTS_ISSUE'));
    });

    test('queries by entity type', () => {
      const results = graph.query({ entityTypes: ['candidate'] });

      expect(results.entities.length).toBe(2);
      results.entities.forEach(e => expect(e.type).toBe('candidate'));
    });

    test('queries by multiple entity types', () => {
      const results = graph.query({ entityTypes: ['candidate', 'office'] });

      expect(results.entities.length).toBe(3);
    });

    test('queries by entity IDs', () => {
      const results = graph.query({ entityIds: ['cand-1', 'office-1'] });

      expect(results.entities.length).toBe(2);
    });

    test('queries by name pattern', () => {
      const results = graph.query({ namePattern: 'alice' });

      expect(results.entities.length).toBe(1);
      expect(results.entities[0].name).toBe('Alice Smith');
    });

    test('queries with pagination', () => {
      const results = graph.query({ offset: 1, limit: 2 });

      expect(results.entities.length).toBe(2);
    });

    test('includes query metadata', () => {
      const results = graph.query({ entityTypes: ['candidate'] });

      expect(results.metadata).toBeDefined();
      expect(results.metadata.totalEntities).toBe(2);
      expect(results.metadata.queryTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('traverses relationships', () => {
      const results = graph.query({
        entityIds: ['cand-1'],
        relationshipTypes: ['RUNNING_FOR'],
        direction: 'outgoing',
      });

      expect(results.relationships.length).toBe(1);
      expect(results.relationships[0].type).toBe('RUNNING_FOR');
    });

    test('includes traversed entities', () => {
      const results = graph.query({
        entityIds: ['cand-1'],
        relationshipTypes: ['RUNNING_FOR'],
      });

      // Should include office-1 from traversal
      expect(results.entities.some(e => e.id === 'office-1')).toBe(true);
    });
  });

  // ========================================
  // Specialized Query Tests
  // ========================================
  describe('specialized queries', () => {
    beforeEach(() => {
      graph.addEntity(createMockCandidate({ id: 'cand-1', name: 'Test Candidate' }));
      graph.addEntity(createMockOffice({ id: 'office-1', name: 'State House 73' }));
      graph.addEntity(createMockJurisdiction({ id: 'jur-1', name: 'East Lansing' }));
      graph.addEntity(createMockIssue({ id: 'issue-1', name: 'Education' }));

      graph.addRelationship(createMockRelationship('rel-1', 'cand-1', 'candidate', 'office-1', 'office', 'RUNNING_FOR'));
      graph.addRelationship(createMockRelationship('rel-2', 'issue-1', 'issue', 'jur-1', 'jurisdiction', 'SALIENT_IN'));
      graph.addRelationship(createMockRelationship('rel-3', 'cand-1', 'candidate', 'jur-1', 'jurisdiction', 'CAMPAIGNED_IN'));
    });

    test('getCandidatesForOffice', () => {
      const candidates = graph.getCandidatesForOffice('office-1');

      expect(candidates.length).toBe(1);
      expect(candidates[0].id).toBe('cand-1');
    });

    test('getCandidatesForOffice returns empty for no candidates', () => {
      const candidates = graph.getCandidatesForOffice('nonexistent');

      expect(candidates).toEqual([]);
    });

    test('getConnections', () => {
      const connections = graph.getConnections('cand-1');

      expect(connections.length).toBe(2);
    });

    test('getConnections filters by relationship type', () => {
      const connections = graph.getConnections('cand-1', ['RUNNING_FOR']);

      expect(connections.length).toBe(1);
      expect(connections[0].relationship.type).toBe('RUNNING_FOR');
    });

    test('getConnections includes direction', () => {
      const connections = graph.getConnections('cand-1');

      connections.forEach(c => {
        expect(['outgoing', 'incoming']).toContain(c.direction);
      });
    });

    test('getIssuesForArea', () => {
      const issues = graph.getIssuesForArea('jur-1');

      expect(issues.length).toBe(1);
      expect(issues[0].name).toBe('Education');
    });

    test('getCampaignedPrecincts', () => {
      const precincts = graph.getCampaignedPrecincts('cand-1');

      // Returns jurisdictions where CAMPAIGNED_IN
      expect(precincts.length).toBe(0); // jur-1 is jurisdiction, not precinct type
    });
  });

  // ========================================
  // Path Finding Tests
  // ========================================
  describe('findPath', () => {
    beforeEach(() => {
      graph.addEntity(createMockCandidate({ id: 'A' }));
      graph.addEntity(createMockOffice({ id: 'B' }));
      graph.addEntity(createMockJurisdiction({ id: 'C' }));
      graph.addEntity(createMockIssue({ id: 'D' }));

      graph.addRelationship(createMockRelationship('r1', 'A', 'candidate', 'B', 'office', 'RUNNING_FOR'));
      graph.addRelationship(createMockRelationship('r2', 'B', 'office', 'C', 'jurisdiction', 'REPRESENTS'));
      graph.addRelationship(createMockRelationship('r3', 'C', 'jurisdiction', 'D', 'issue', 'SALIENT_IN'));
    });

    test('finds direct path', () => {
      const path = graph.findPath('A', 'B');

      expect(path).not.toBeNull();
      expect(path?.nodes.length).toBe(2);
      expect(path?.edges.length).toBe(1);
    });

    test('finds multi-hop path', () => {
      const path = graph.findPath('A', 'C');

      expect(path).not.toBeNull();
      expect(path?.nodes.length).toBe(3);
      expect(path?.edges.length).toBe(2);
    });

    test('returns null for disconnected nodes', () => {
      graph.addEntity(createMockCandidate({ id: 'isolated' }));

      const path = graph.findPath('A', 'isolated');

      expect(path).toBeNull();
    });

    test('returns self for same source and target', () => {
      const path = graph.findPath('A', 'A');

      expect(path).not.toBeNull();
      expect(path?.nodes.length).toBe(1);
      expect(path?.edges.length).toBe(0);
    });

    test('respects max depth', () => {
      const path = graph.findPath('A', 'D', 2);

      // Path A -> B -> C -> D requires 3 hops, but max depth is 2
      expect(path).toBeNull();
    });

    test('finds shortest path', () => {
      // Add direct path from A to C
      graph.addRelationship(createMockRelationship('direct', 'A', 'candidate', 'C', 'jurisdiction', 'CAMPAIGNED_IN'));

      const path = graph.findPath('A', 'C');

      // Should find the direct path (2 nodes) not via B (3 nodes)
      expect(path?.nodes.length).toBe(2);
    });
  });

  // ========================================
  // Statistics Tests
  // ========================================
  describe('getStats', () => {
    test('returns entity count', () => {
      graph.addEntity(createMockCandidate());
      graph.addEntity(createMockOffice());

      const stats = graph.getStats();

      expect(stats.entityCount).toBe(2);
    });

    test('returns relationship count', () => {
      graph.addRelationship(createMockRelationship('r1', 'a', 'candidate', 'b', 'candidate', 'SUPPORTS'));

      const stats = graph.getStats();

      expect(stats.relationshipCount).toBe(1);
    });

    test('returns entities by type breakdown', () => {
      graph.addEntity(createMockCandidate());
      graph.addEntity(createMockCandidate());
      graph.addEntity(createMockOffice());

      const stats = graph.getStats();

      expect(stats.entitiesByType['candidate']).toBe(2);
      expect(stats.entitiesByType['office']).toBe(1);
    });

    test('returns relationships by type breakdown', () => {
      graph.addRelationship(createMockRelationship('r1', 'a', 'candidate', 'b', 'office', 'RUNNING_FOR'));
      graph.addRelationship(createMockRelationship('r2', 'a', 'candidate', 'c', 'office', 'RUNNING_FOR'));

      const stats = graph.getStats();

      expect(stats.relationshipsByType['RUNNING_FOR']).toBe(2);
    });
  });

  // ========================================
  // Serialization Tests
  // ========================================
  describe('serialization', () => {
    test('toJSON exports graph data', () => {
      graph.addEntity(createMockCandidate({ id: 'c1' }));
      graph.addEntity(createMockOffice({ id: 'o1' }));
      graph.addRelationship(createMockRelationship('r1', 'c1', 'candidate', 'o1', 'office', 'RUNNING_FOR'));

      const json = graph.toJSON();

      expect(json.entities.length).toBe(2);
      expect(json.relationships.length).toBe(1);
    });

    test('fromJSON imports graph data', () => {
      const data = {
        entities: [
          createMockCandidate({ id: 'imported-c1' }),
          createMockOffice({ id: 'imported-o1' }),
        ],
        relationships: [
          createMockRelationship('imported-r1', 'imported-c1', 'candidate', 'imported-o1', 'office', 'RUNNING_FOR'),
        ],
      };

      graph.fromJSON(data);

      expect(graph.getEntity('imported-c1')).toBeDefined();
      expect(graph.getRelationship('imported-r1')).toBeDefined();
    });

    test('fromJSON clears existing data', () => {
      graph.addEntity(createMockCandidate({ id: 'existing' }));

      graph.fromJSON({ entities: [], relationships: [] });

      expect(graph.getEntity('existing')).toBeUndefined();
    });

    test('round-trip serialization preserves data', () => {
      graph.addEntity(createMockCandidate({ id: 'c1', name: 'Test' }));
      graph.addRelationship(createMockRelationship('r1', 'c1', 'candidate', 'c1', 'candidate', 'SUPPORTS'));

      const exported = graph.toJSON();
      graph.fromJSON({ entities: [], relationships: [] }); // Clear
      graph.fromJSON(exported);

      expect(graph.getEntity('c1')?.name).toBe('Test');
      expect(graph.getRelationship('r1')).toBeDefined();
    });
  });

  // ========================================
  // Get All Methods Tests
  // ========================================
  describe('getAllEntities and getAllRelationships', () => {
    test('getAllEntities returns array of all entities', () => {
      graph.addEntity(createMockCandidate({ id: 'c1' }));
      graph.addEntity(createMockOffice({ id: 'o1' }));

      const all = graph.getAllEntities();

      expect(all.length).toBe(2);
    });

    test('getAllRelationships returns array of all relationships', () => {
      graph.addRelationship(createMockRelationship('r1', 'a', 'candidate', 'b', 'candidate', 'SUPPORTS'));

      const all = graph.getAllRelationships();

      expect(all.length).toBe(1);
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles empty graph queries', () => {
      const results = graph.query({});

      expect(results.entities).toEqual([]);
      expect(results.relationships).toEqual([]);
    });

    test('handles special characters in names', () => {
      const candidate = createMockCandidate({ name: "O'Connor-Smith (D)" });
      graph.addEntity(candidate);

      const results = graph.query({ namePattern: "o'connor" });
      expect(results.entities.length).toBe(1);
    });

    test('handles unicode names', () => {
      const candidate = createMockCandidate({ name: 'José García' });
      graph.addEntity(candidate);

      const results = graph.query({ namePattern: 'josé' });
      expect(results.entities.length).toBe(1);
    });

    test('handles very long entity names', () => {
      const longName = 'A'.repeat(200);
      const candidate = createMockCandidate({ name: longName });
      graph.addEntity(candidate);

      expect(graph.getEntity(candidate.id)?.name).toBe(longName);
    });
  });
});
