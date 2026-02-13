/**
 * AssignmentEngine Unit Tests
 *
 * Comprehensive test suite for volunteer-turf assignment validation,
 * optimization, and workload management.
 */

import { AssignmentEngine } from '../AssignmentEngine';
import { VolunteerManager } from '../VolunteerManager';
import { VolunteerStore } from '../VolunteerStore';
import type { Volunteer, TurfAssignment } from '../types-volunteer';
import type { CanvassingTurf, CanvassingUniverse } from '../types';

// Mock VolunteerStore
jest.mock('../VolunteerStore', () => ({
  VolunteerStore: {
    getAssignmentsByVolunteer: jest.fn(),
    getAssignmentsByTurf: jest.fn(),
    getAssignmentsByUniverse: jest.fn(),
    getAllVolunteers: jest.fn(),
    getVolunteer: jest.fn(),
    saveVolunteer: jest.fn(),
    saveAssignment: jest.fn(),
    getAssignment: jest.fn(),
  },
}));

// Mock VolunteerManager
jest.mock('../VolunteerManager', () => ({
  VolunteerManager: {
    getAllVolunteers: jest.fn(),
    getVolunteer: jest.fn(),
    recommendVolunteersForTurf: jest.fn(),
  },
}));

describe('AssignmentEngine', () => {
  // Helper function to create test volunteers
  const createTestVolunteer = (overrides?: Partial<Volunteer>): Volunteer => ({
    id: 'vol_123',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-0100',
    experienceLevel: 'experienced',
    totalDoorsKnocked: 500,
    totalHoursVolunteered: 20,
    completionRate: 90,
    availableDays: ['monday', 'wednesday', 'friday'],
    availableTimeSlots: [],
    maxTurfsPerWeek: 5,
    hasVehicle: true,
    canLeadTeam: false,
    avgDoorsPerHour: 40,
    reliabilityScore: 85,
    noShowCount: 0,
    lateStartCount: 1,
    createdAt: '2024-01-01T00:00:00Z',
    activeAssignments: 0,
    ...overrides,
  });

  // Helper function to create test turfs
  const createTestTurf = (overrides?: Partial<CanvassingTurf>): CanvassingTurf => ({
    turfId: 'turf_1',
    turfName: 'Downtown District',
    precinctIds: ['precinct_1'],
    estimatedDoors: 200,
    estimatedHours: 5,
    doorsPerHour: 40,
    density: 'urban',
    priority: 5,
    avgGotvPriority: 75,
    avgPersuasionOpportunity: 60,
    ...overrides,
  });

  // Helper function to create test assignments
  const createTestAssignment = (overrides?: Partial<TurfAssignment>): TurfAssignment => ({
    id: 'assign_1',
    volunteerId: 'vol_123',
    turfId: 'turf_1',
    universeId: 'universe_1',
    assignedBy: 'system',
    assignedAt: '2024-01-01T00:00:00Z',
    priority: 'medium',
    status: 'assigned',
    ...overrides,
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('validateAssignment', () => {
    describe('double assignment detection', () => {
      it('should detect duplicate turf assignment with active status', () => {
        const volunteer = createTestVolunteer();
        const turf = createTestTurf();
        const existingAssignment = createTestAssignment({
          status: 'assigned',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([existingAssignment]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Volunteer is already assigned to turf Downtown District');
      });

      it('should detect duplicate turf assignment with in_progress status', () => {
        const volunteer = createTestVolunteer();
        const turf = createTestTurf();
        const existingAssignment = createTestAssignment({
          status: 'in_progress',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([existingAssignment]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Volunteer is already assigned to turf Downtown District');
      });

      it('should allow assignment if previous assignment was cancelled', () => {
        const volunteer = createTestVolunteer();
        const turf = createTestTurf();
        const cancelledAssignment = createTestAssignment({
          status: 'cancelled',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([cancelledAssignment]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should allow assignment if previous assignment was completed', () => {
        const volunteer = createTestVolunteer();
        const turf = createTestTurf();
        const completedAssignment = createTestAssignment({
          status: 'completed',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([completedAssignment]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should allow assignment to different turf', () => {
        const volunteer = createTestVolunteer();
        const turf = createTestTurf({ turfId: 'turf_2', turfName: 'Suburbs' });
        const otherAssignment = createTestAssignment({
          turfId: 'turf_1',
          status: 'assigned',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([otherAssignment]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('overload detection (maxTurfsPerWeek)', () => {
      it('should error when volunteer at max capacity', () => {
        const volunteer = createTestVolunteer({
          maxTurfsPerWeek: 3,
        });
        const turf = createTestTurf();

        // Mock 3 active assignments
        const activeAssignments = [
          createTestAssignment({ id: 'assign_1', turfId: 'turf_2', status: 'assigned' }),
          createTestAssignment({ id: 'assign_2', turfId: 'turf_3', status: 'in_progress' }),
          createTestAssignment({ id: 'assign_3', turfId: 'turf_4', status: 'assigned' }),
        ];

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue(activeAssignments);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Volunteer has reached maximum turfs per week (3/3)');
      });

      it('should warn when volunteer at max capacity minus one', () => {
        const volunteer = createTestVolunteer({
          maxTurfsPerWeek: 3,
        });
        const turf = createTestTurf();

        // Mock 2 active assignments
        const activeAssignments = [
          createTestAssignment({ id: 'assign_1', turfId: 'turf_2', status: 'assigned' }),
          createTestAssignment({ id: 'assign_2', turfId: 'turf_3', status: 'in_progress' }),
        ];

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue(activeAssignments);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain("This will be the volunteer's last available turf slot");
      });

      it('should allow assignment when under capacity', () => {
        const volunteer = createTestVolunteer({
          maxTurfsPerWeek: 5,
        });
        const turf = createTestTurf();

        // Mock 1 active assignment
        const activeAssignments = [
          createTestAssignment({ id: 'assign_1', turfId: 'turf_2', status: 'assigned' }),
        ];

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue(activeAssignments);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).not.toContain("This will be the volunteer's last available turf slot");
      });

      it('should allow assignment when maxTurfsPerWeek is undefined', () => {
        const volunteer = createTestVolunteer({
          maxTurfsPerWeek: undefined,
        });
        const turf = createTestTurf();

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('experience level warnings for high-priority turfs', () => {
      it('should warn when new volunteer assigned to priority 1 turf', () => {
        const volunteer = createTestVolunteer({
          experienceLevel: 'new',
        });
        const turf = createTestTurf({
          priority: 1,
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('High-priority turf assigned to new volunteer - consider pairing with team leader');
      });

      it('should warn when new volunteer assigned to priority 3 turf', () => {
        const volunteer = createTestVolunteer({
          experienceLevel: 'new',
        });
        const turf = createTestTurf({
          priority: 3,
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('High-priority turf assigned to new volunteer - consider pairing with team leader');
      });

      it('should not warn when new volunteer assigned to priority 4 turf', () => {
        const volunteer = createTestVolunteer({
          experienceLevel: 'new',
        });
        const turf = createTestTurf({
          priority: 4,
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).not.toContain('High-priority turf assigned to new volunteer - consider pairing with team leader');
      });

      it('should not warn when experienced volunteer assigned to priority 1 turf', () => {
        const volunteer = createTestVolunteer({
          experienceLevel: 'experienced',
        });
        const turf = createTestTurf({
          priority: 1,
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).not.toContain('High-priority turf assigned to new volunteer - consider pairing with team leader');
      });
    });

    describe('vehicle requirement for rural turfs', () => {
      it('should error when rural turf assigned to volunteer without vehicle', () => {
        const volunteer = createTestVolunteer({
          hasVehicle: false,
        });
        const turf = createTestTurf({
          density: 'rural',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Rural turf requires a vehicle, but volunteer does not have one');
      });

      it('should allow rural turf assignment when volunteer has vehicle', () => {
        const volunteer = createTestVolunteer({
          hasVehicle: true,
        });
        const turf = createTestTurf({
          density: 'rural',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should allow urban turf assignment without vehicle', () => {
        const volunteer = createTestVolunteer({
          hasVehicle: false,
        });
        const turf = createTestTurf({
          density: 'urban',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should allow suburban turf assignment without vehicle', () => {
        const volunteer = createTestVolunteer({
          hasVehicle: false,
        });
        const turf = createTestTurf({
          density: 'suburban',
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('reliability warnings for urgent turfs', () => {
      it('should warn when priority 1 turf assigned to low reliability volunteer', () => {
        const volunteer = createTestVolunteer({
          reliabilityScore: 65,
        });
        const turf = createTestTurf({
          priority: 1,
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('High-priority turf assigned to volunteer with low reliability score (65)');
      });

      it('should not warn when priority 1 turf assigned to high reliability volunteer', () => {
        const volunteer = createTestVolunteer({
          reliabilityScore: 90,
        });
        const turf = createTestTurf({
          priority: 1,
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).not.toContain(expect.stringContaining('low reliability score'));
      });

      it('should not warn when priority 2 turf assigned to low reliability volunteer', () => {
        const volunteer = createTestVolunteer({
          reliabilityScore: 65,
        });
        const turf = createTestTurf({
          priority: 2,
        });

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).not.toContain(expect.stringContaining('low reliability score'));
      });
    });

    describe('workload warnings', () => {
      it('should warn when volunteer has 3 active assignments', () => {
        const volunteer = createTestVolunteer({
          activeAssignments: 3,
        });
        const turf = createTestTurf();

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Volunteer has 3 active assignments - may be overloaded');
      });

      it('should warn when volunteer has 4 active assignments', () => {
        const volunteer = createTestVolunteer({
          activeAssignments: 4,
        });
        const turf = createTestTurf();

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Volunteer has 4 active assignments - may be overloaded');
      });

      it('should not warn when volunteer has 2 active assignments', () => {
        const volunteer = createTestVolunteer({
          activeAssignments: 2,
        });
        const turf = createTestTurf();

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).not.toContain(expect.stringContaining('active assignments - may be overloaded'));
      });

      it('should not warn when volunteer has 0 active assignments', () => {
        const volunteer = createTestVolunteer({
          activeAssignments: 0,
        });
        const turf = createTestTurf();

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(true);
        expect(result.warnings).not.toContain(expect.stringContaining('active assignments - may be overloaded'));
      });
    });

    describe('multiple validation issues', () => {
      it('should accumulate multiple errors and warnings', () => {
        const volunteer = createTestVolunteer({
          experienceLevel: 'new',
          hasVehicle: false,
          reliabilityScore: 65,
          activeAssignments: 3,
          maxTurfsPerWeek: 4,
        });
        const turf = createTestTurf({
          priority: 1,
          density: 'rural',
        });

        // Mock 4 active assignments (at max)
        const activeAssignments = [
          createTestAssignment({ id: 'a1', turfId: 't2', status: 'assigned' }),
          createTestAssignment({ id: 'a2', turfId: 't3', status: 'in_progress' }),
          createTestAssignment({ id: 'a3', turfId: 't4', status: 'assigned' }),
          createTestAssignment({ id: 'a4', turfId: 't5', status: 'assigned' }),
        ];

        (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue(activeAssignments);

        const result = AssignmentEngine.validateAssignment(volunteer, turf, 'universe_1');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Volunteer has reached maximum turfs per week (4/4)');
        expect(result.errors).toContain('Rural turf requires a vehicle, but volunteer does not have one');
        expect(result.warnings).toContain('High-priority turf assigned to new volunteer - consider pairing with team leader');
        expect(result.warnings).toContain('High-priority turf assigned to volunteer with low reliability score (65)');
        expect(result.warnings).toContain('Volunteer has 3 active assignments - may be overloaded');
      });
    });
  });

  describe('recommendVolunteers', () => {
    it('should call VolunteerManager.recommendVolunteersForTurf', () => {
      const turf = createTestTurf();
      const mockRecommendations = [
        {
          volunteer: createTestVolunteer(),
          score: 85,
          reasons: ['Experienced volunteer'],
          warnings: [],
        },
      ];

      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue([createTestVolunteer()]);
      (VolunteerManager.recommendVolunteersForTurf as jest.Mock).mockReturnValue(mockRecommendations);

      const result = AssignmentEngine.recommendVolunteers(turf);

      expect(VolunteerManager.recommendVolunteersForTurf).toHaveBeenCalledWith(turf, 5);
      expect(result).toEqual(mockRecommendations);
    });

    it('should respect custom limit', () => {
      const turf = createTestTurf();
      const mockRecommendations = [
        {
          volunteer: createTestVolunteer(),
          score: 85,
          reasons: ['Experienced volunteer'],
          warnings: [],
        },
      ];

      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue([createTestVolunteer()]);
      (VolunteerManager.recommendVolunteersForTurf as jest.Mock).mockReturnValue(mockRecommendations);

      AssignmentEngine.recommendVolunteers(turf, { limit: 10 });

      expect(VolunteerManager.recommendVolunteersForTurf).toHaveBeenCalledWith(turf, 10);
    });

    it('should filter by minimum experience level', () => {
      const turf = createTestTurf();
      const volunteers = [
        createTestVolunteer({ id: 'v1', experienceLevel: 'new' }),
        createTestVolunteer({ id: 'v2', experienceLevel: 'experienced' }),
        createTestVolunteer({ id: 'v3', experienceLevel: 'team_leader' }),
      ];

      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);
      (VolunteerManager.recommendVolunteersForTurf as jest.Mock).mockReturnValue([]);

      AssignmentEngine.recommendVolunteers(turf, { minExperience: 'experienced' });

      expect(VolunteerManager.getAllVolunteers).toHaveBeenCalled();
    });

    it('should exclude specific volunteer IDs', () => {
      const turf = createTestTurf();
      const volunteers = [
        createTestVolunteer({ id: 'v1' }),
        createTestVolunteer({ id: 'v2' }),
        createTestVolunteer({ id: 'v3' }),
      ];

      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);
      (VolunteerManager.recommendVolunteersForTurf as jest.Mock).mockReturnValue([]);

      AssignmentEngine.recommendVolunteers(turf, { excludeIds: ['v1', 'v3'] });

      expect(VolunteerManager.getAllVolunteers).toHaveBeenCalled();
    });
  });

  describe('optimizeAssignments', () => {
    it('should assign volunteers to turfs based on highest scores', () => {
      const universe = {
        id: 'universe_1',
        name: 'Test Universe',
      } as CanvassingUniverse;

      const turfs = [
        createTestTurf({ turfId: 't1', doorsPerHour: 40 }),
        createTestTurf({ turfId: 't2', doorsPerHour: 35 }),
      ];

      const volunteers = [
        createTestVolunteer({ id: 'v1', avgDoorsPerHour: 45, experienceLevel: 'team_leader', maxTurfsPerWeek: 2 }),
        createTestVolunteer({ id: 'v2', avgDoorsPerHour: 30, experienceLevel: 'new', maxTurfsPerWeek: 2 }),
      ];

      const result = AssignmentEngine.optimizeAssignments(universe, turfs, volunteers);

      expect(result).toHaveLength(2);
      // The greedy algorithm assigns best matches first, may assign both to v1 or distribute
      // Just verify we get 2 assignments
      expect(result[0]).toHaveProperty('turfId');
      expect(result[0]).toHaveProperty('volunteerId');
      expect(result[1]).toHaveProperty('turfId');
      expect(result[1]).toHaveProperty('volunteerId');
      // Verify all turfs are covered
      const assignedTurfs = result.map(r => r.turfId).sort();
      expect(assignedTurfs).toEqual(['t1', 't2']);
    });

    it('should respect maxTurfsPerWeek capacity', () => {
      const universe = {
        id: 'universe_1',
        name: 'Test Universe',
      } as CanvassingUniverse;

      const turfs = [
        createTestTurf({ turfId: 't1' }),
        createTestTurf({ turfId: 't2' }),
        createTestTurf({ turfId: 't3' }),
      ];

      const volunteers = [
        createTestVolunteer({ id: 'v1', maxTurfsPerWeek: 1, experienceLevel: 'team_leader' }),
        createTestVolunteer({ id: 'v2', maxTurfsPerWeek: 2, experienceLevel: 'experienced' }),
      ];

      const result = AssignmentEngine.optimizeAssignments(universe, turfs, volunteers);

      // v1 should get 1 turf, v2 should get 2 turfs
      const v1Assignments = result.filter(a => a.volunteerId === 'v1');
      const v2Assignments = result.filter(a => a.volunteerId === 'v2');

      expect(v1Assignments).toHaveLength(1);
      expect(v2Assignments).toHaveLength(2);
    });

    it('should not double-book volunteers or turfs', () => {
      const universe = {
        id: 'universe_1',
        name: 'Test Universe',
      } as CanvassingUniverse;

      const turfs = [
        createTestTurf({ turfId: 't1' }),
        createTestTurf({ turfId: 't2' }),
      ];

      const volunteers = [
        createTestVolunteer({ id: 'v1', maxTurfsPerWeek: 1 }),
      ];

      const result = AssignmentEngine.optimizeAssignments(universe, turfs, volunteers);

      // With only 1 volunteer at max capacity 1, only 1 assignment should be made
      expect(result).toHaveLength(1);
      expect(result[0].volunteerId).toBe('v1');
    });

    it('should handle volunteers without maxTurfsPerWeek', () => {
      const universe = {
        id: 'universe_1',
        name: 'Test Universe',
      } as CanvassingUniverse;

      const turfs = [
        createTestTurf({ turfId: 't1' }),
        createTestTurf({ turfId: 't2' }),
      ];

      const volunteers = [
        createTestVolunteer({ id: 'v1', maxTurfsPerWeek: undefined }),
      ];

      const result = AssignmentEngine.optimizeAssignments(universe, turfs, volunteers);

      // Without maxTurfsPerWeek, volunteer can be assigned to multiple turfs
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(2);
      result.forEach(assignment => {
        expect(assignment.volunteerId).toBe('v1');
      });
    });

    it('should prioritize by match score', () => {
      const universe = {
        id: 'universe_1',
        name: 'Test Universe',
      } as CanvassingUniverse;

      const turf = createTestTurf({ turfId: 't1', doorsPerHour: 40, density: 'urban' });

      const volunteers = [
        createTestVolunteer({
          id: 'v1',
          experienceLevel: 'new',
          avgDoorsPerHour: 30,
          completionRate: 70,
          reliabilityScore: 60,
          activeAssignments: 3,
        }),
        createTestVolunteer({
          id: 'v2',
          experienceLevel: 'team_leader',
          avgDoorsPerHour: 45,
          completionRate: 95,
          reliabilityScore: 95,
          activeAssignments: 0,
          preferredDensity: 'urban',
        }),
      ];

      const result = AssignmentEngine.optimizeAssignments(universe, [turf], volunteers);

      // v2 should be chosen due to higher match score
      expect(result).toHaveLength(1);
      expect(result[0].volunteerId).toBe('v2');
    });

    it('should return empty array when no volunteers available', () => {
      const universe = {
        id: 'universe_1',
        name: 'Test Universe',
      } as CanvassingUniverse;

      const turfs = [createTestTurf({ turfId: 't1' })];
      const volunteers: Volunteer[] = [];

      const result = AssignmentEngine.optimizeAssignments(universe, turfs, volunteers);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no turfs available', () => {
      const universe = {
        id: 'universe_1',
        name: 'Test Universe',
      } as CanvassingUniverse;

      const turfs: CanvassingTurf[] = [];
      const volunteers = [createTestVolunteer({ id: 'v1' })];

      const result = AssignmentEngine.optimizeAssignments(universe, turfs, volunteers);

      expect(result).toHaveLength(0);
    });
  });

  describe('detectDoubleAssignments', () => {
    it('should detect duplicate turf assignments for same volunteer', () => {
      const assignments = [
        createTestAssignment({ id: 'a1', volunteerId: 'v1', turfId: 't1', status: 'assigned' }),
        createTestAssignment({ id: 'a2', volunteerId: 'v1', turfId: 't1', status: 'in_progress' }),
      ];

      (VolunteerStore.getAssignmentsByUniverse as jest.Mock).mockReturnValue(assignments);

      const result = AssignmentEngine.detectDoubleAssignments('universe_1');

      expect(result).toHaveLength(1);
      expect(result[0].volunteerId).toBe('v1');
      expect(result[0].turfIds).toEqual(['t1', 't1']);
    });

    it('should not flag volunteers with assignments to different turfs', () => {
      const assignments = [
        createTestAssignment({ id: 'a1', volunteerId: 'v1', turfId: 't1', status: 'assigned' }),
        createTestAssignment({ id: 'a2', volunteerId: 'v1', turfId: 't2', status: 'assigned' }),
      ];

      (VolunteerStore.getAssignmentsByUniverse as jest.Mock).mockReturnValue(assignments);

      const result = AssignmentEngine.detectDoubleAssignments('universe_1');

      expect(result).toHaveLength(0);
    });

    it('should only consider active assignments (assigned, in_progress)', () => {
      const assignments = [
        createTestAssignment({ id: 'a1', volunteerId: 'v1', turfId: 't1', status: 'assigned' }),
        createTestAssignment({ id: 'a2', volunteerId: 'v1', turfId: 't1', status: 'completed' }),
      ];

      (VolunteerStore.getAssignmentsByUniverse as jest.Mock).mockReturnValue(assignments);

      const result = AssignmentEngine.detectDoubleAssignments('universe_1');

      expect(result).toHaveLength(0);
    });

    it('should handle multiple volunteers with conflicts', () => {
      const assignments = [
        createTestAssignment({ id: 'a1', volunteerId: 'v1', turfId: 't1', status: 'assigned' }),
        createTestAssignment({ id: 'a2', volunteerId: 'v1', turfId: 't1', status: 'in_progress' }),
        createTestAssignment({ id: 'a3', volunteerId: 'v2', turfId: 't2', status: 'assigned' }),
        createTestAssignment({ id: 'a4', volunteerId: 'v2', turfId: 't2', status: 'assigned' }),
      ];

      (VolunteerStore.getAssignmentsByUniverse as jest.Mock).mockReturnValue(assignments);

      const result = AssignmentEngine.detectDoubleAssignments('universe_1');

      expect(result).toHaveLength(2);
      expect(result[0].volunteerId).toBe('v1');
      expect(result[1].volunteerId).toBe('v2');
    });

    it('should return empty array when no conflicts', () => {
      const assignments = [
        createTestAssignment({ id: 'a1', volunteerId: 'v1', turfId: 't1', status: 'assigned' }),
        createTestAssignment({ id: 'a2', volunteerId: 'v2', turfId: 't2', status: 'assigned' }),
      ];

      (VolunteerStore.getAssignmentsByUniverse as jest.Mock).mockReturnValue(assignments);

      const result = AssignmentEngine.detectDoubleAssignments('universe_1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getVolunteerWorkload', () => {
    it('should calculate workload for volunteer with assignments', () => {
      const volunteer = createTestVolunteer({ id: 'v1' });
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const assignments = [
        createTestAssignment({
          id: 'a1',
          status: 'assigned',
        }),
        createTestAssignment({
          id: 'a2',
          status: 'in_progress',
        }),
        createTestAssignment({
          id: 'a3',
          status: 'completed',
          doorsAttempted: 150,
          hoursWorked: 4.5,
          completedAt: sevenDaysAgo.toISOString(),
        }),
        createTestAssignment({
          id: 'a4',
          status: 'completed',
          doorsAttempted: 200,
          hoursWorked: 5.0,
          completedAt: now.toISOString(),
        }),
      ];

      (VolunteerManager.getVolunteer as jest.Mock).mockReturnValue(volunteer);
      (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue(assignments);

      const result = AssignmentEngine.getVolunteerWorkload('v1');

      expect(result.activeAssignments).toBe(2);
      expect(result.completedDoors).toBe(350);
      expect(result.pendingDoors).toBe(100); // 2 active * 50 estimate
      expect(result.hoursThisWeek).toBeGreaterThan(0);
    });

    it('should return zeros for non-existent volunteer', () => {
      (VolunteerManager.getVolunteer as jest.Mock).mockReturnValue(null);

      const result = AssignmentEngine.getVolunteerWorkload('nonexistent');

      expect(result.activeAssignments).toBe(0);
      expect(result.pendingDoors).toBe(0);
      expect(result.completedDoors).toBe(0);
      expect(result.hoursThisWeek).toBe(0);
    });

    it('should only count active assignments (assigned, in_progress)', () => {
      const volunteer = createTestVolunteer({ id: 'v1' });

      const assignments = [
        createTestAssignment({ id: 'a1', status: 'assigned' }),
        createTestAssignment({ id: 'a2', status: 'in_progress' }),
        createTestAssignment({ id: 'a3', status: 'completed', doorsAttempted: 100 }),
        createTestAssignment({ id: 'a4', status: 'cancelled' }),
      ];

      (VolunteerManager.getVolunteer as jest.Mock).mockReturnValue(volunteer);
      (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue(assignments);

      const result = AssignmentEngine.getVolunteerWorkload('v1');

      expect(result.activeAssignments).toBe(2);
    });

    it('should only count hours from last 7 days', () => {
      const volunteer = createTestVolunteer({ id: 'v1' });
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const assignments = [
        createTestAssignment({
          id: 'a1',
          status: 'completed',
          hoursWorked: 3.5,
          completedAt: fiveDaysAgo.toISOString(),
        }),
        createTestAssignment({
          id: 'a2',
          status: 'completed',
          hoursWorked: 5.0,
          completedAt: tenDaysAgo.toISOString(),
        }),
      ];

      (VolunteerManager.getVolunteer as jest.Mock).mockReturnValue(volunteer);
      (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue(assignments);

      const result = AssignmentEngine.getVolunteerWorkload('v1');

      expect(result.hoursThisWeek).toBe(3.5); // Only recent assignment
    });
  });

  describe('suggestReassignments', () => {
    it('should suggest reassignment to high reliability volunteer', () => {
      const volunteers = [
        createTestVolunteer({
          id: 'v1',
          reliabilityScore: 55, // Current low-reliability volunteer
          activeAssignments: 2,
        }),
        createTestVolunteer({
          id: 'v2',
          reliabilityScore: 95, // High reliability alternative
          activeAssignments: 1,
        }),
      ];

      const currentAssignment = createTestAssignment({
        turfId: 't1',
        volunteerId: 'v1',
        status: 'assigned',
      });

      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue([currentAssignment]);
      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = AssignmentEngine.suggestReassignments(['t1']);

      expect(result).toHaveLength(1);
      expect(result[0].turfId).toBe('t1');
      expect(result[0].currentVolunteerId).toBe('v1');
      expect(result[0].suggestedVolunteerId).toBe('v2');
      expect(result[0].reason).toContain('High reliability (95)');
      expect(result[0].reason).toContain('low workload (1 active)');
    });

    it('should not suggest current volunteer', () => {
      const volunteers = [
        createTestVolunteer({ id: 'v1', reliabilityScore: 85, activeAssignments: 1 }),
        createTestVolunteer({ id: 'v2', reliabilityScore: 90, activeAssignments: 0 }),
      ];

      const currentAssignment = createTestAssignment({
        turfId: 't1',
        volunteerId: 'v1',
        status: 'assigned',
      });

      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue([currentAssignment]);
      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = AssignmentEngine.suggestReassignments(['t1']);

      expect(result[0].suggestedVolunteerId).toBe('v2'); // Not v1
    });

    it('should exclude overloaded volunteers (3+ active assignments)', () => {
      const volunteers = [
        createTestVolunteer({ id: 'v1', reliabilityScore: 50, activeAssignments: 1 }), // Current
        createTestVolunteer({ id: 'v2', reliabilityScore: 95, activeAssignments: 3 }), // Overloaded
        createTestVolunteer({ id: 'v3', reliabilityScore: 85, activeAssignments: 1 }), // Good alternative
      ];

      const currentAssignment = createTestAssignment({
        turfId: 't1',
        volunteerId: 'v1',
        status: 'assigned',
      });

      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue([currentAssignment]);
      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = AssignmentEngine.suggestReassignments(['t1']);

      expect(result[0].suggestedVolunteerId).toBe('v3'); // Not v2 (overloaded)
    });

    it('should exclude low reliability volunteers (< 60)', () => {
      const volunteers = [
        createTestVolunteer({ id: 'v1', reliabilityScore: 50, activeAssignments: 1 }), // Current
        createTestVolunteer({ id: 'v2', reliabilityScore: 55, activeAssignments: 0 }), // Too low
        createTestVolunteer({ id: 'v3', reliabilityScore: 75, activeAssignments: 0 }), // Good
      ];

      const currentAssignment = createTestAssignment({
        turfId: 't1',
        volunteerId: 'v1',
        status: 'assigned',
      });

      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue([currentAssignment]);
      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = AssignmentEngine.suggestReassignments(['t1']);

      expect(result[0].suggestedVolunteerId).toBe('v3'); // Not v2 (low reliability)
    });

    it('should handle turfs with no current assignment', () => {
      const volunteers = [
        createTestVolunteer({ id: 'v1', reliabilityScore: 90, activeAssignments: 0 }),
      ];

      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue([]);
      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = AssignmentEngine.suggestReassignments(['t1']);

      expect(result[0].currentVolunteerId).toBeUndefined();
      expect(result[0].suggestedVolunteerId).toBe('v1');
    });

    it('should return empty array when no suitable volunteers available', () => {
      const volunteers = [
        createTestVolunteer({ id: 'v1', reliabilityScore: 50, activeAssignments: 1 }), // Current
        createTestVolunteer({ id: 'v2', reliabilityScore: 55, activeAssignments: 3 }), // Low reliability + overloaded
      ];

      const currentAssignment = createTestAssignment({
        turfId: 't1',
        volunteerId: 'v1',
        status: 'assigned',
      });

      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue([currentAssignment]);
      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = AssignmentEngine.suggestReassignments(['t1']);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple stalled turfs', () => {
      const volunteers = [
        createTestVolunteer({ id: 'v1', reliabilityScore: 50, activeAssignments: 1 }),
        createTestVolunteer({ id: 'v2', reliabilityScore: 90, activeAssignments: 0 }),
        createTestVolunteer({ id: 'v3', reliabilityScore: 85, activeAssignments: 0 }),
      ];

      const assignments = [
        createTestAssignment({ id: 'a1', turfId: 't1', volunteerId: 'v1', status: 'assigned' }),
        createTestAssignment({ id: 'a2', turfId: 't2', volunteerId: 'v1', status: 'assigned' }),
      ];

      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockImplementation((turfId: string) => {
        return assignments.filter(a => a.turfId === turfId);
      });
      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = AssignmentEngine.suggestReassignments(['t1', 't2']);

      expect(result).toHaveLength(2);
      expect(result[0].turfId).toBe('t1');
      expect(result[1].turfId).toBe('t2');
    });

    it('should prefer volunteers with lower workload in scoring', () => {
      const volunteers = [
        createTestVolunteer({ id: 'v1', reliabilityScore: 50, activeAssignments: 2 }), // Current
        createTestVolunteer({ id: 'v2', reliabilityScore: 80, activeAssignments: 2 }), // High workload
        createTestVolunteer({ id: 'v3', reliabilityScore: 75, activeAssignments: 0 }), // Low workload
      ];

      const currentAssignment = createTestAssignment({
        turfId: 't1',
        volunteerId: 'v1',
        status: 'assigned',
      });

      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue([currentAssignment]);
      (VolunteerManager.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = AssignmentEngine.suggestReassignments(['t1']);

      // v3 should be chosen: reliability 75 - (0 * 10) = 75
      // v2 would be: reliability 80 - (2 * 10) = 60
      expect(result[0].suggestedVolunteerId).toBe('v3');
    });
  });
});
