/**
 * VolunteerManager Unit Tests
 *
 * Comprehensive test suite for volunteer management functionality.
 * Tests CRUD operations, filtering, assignments, recommendations, and reliability scoring.
 */

import { VolunteerManager } from '../VolunteerManager';
import { VolunteerStore } from '../VolunteerStore';
import type {
  Volunteer,
  TurfAssignment,
  VolunteerFilters,
  ExperienceLevel,
} from '../types-volunteer';
import type { CanvassingTurf } from '../types';

// Mock the VolunteerStore
jest.mock('../VolunteerStore');

describe('VolunteerManager', () => {
  // Sample test data
  const mockVolunteer: Volunteer = {
    id: 'vol_123',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-1234',
    experienceLevel: 'experienced',
    totalDoorsKnocked: 500,
    totalHoursVolunteered: 20,
    completionRate: 85,
    availableDays: ['monday', 'wednesday', 'friday'],
    availableTimeSlots: [
      { day: 'monday', startTime: '18:00', endTime: '20:00' },
    ],
    hasVehicle: true,
    canLeadTeam: false,
    reliabilityScore: 90,
    noShowCount: 1,
    lateStartCount: 2,
    createdAt: '2024-01-01T00:00:00Z',
    activeAssignments: 0,
    avgDoorsPerHour: 25,
    preferredDensity: 'suburban',
    tags: ['phone-bank', 'weekend-warrior'],
  };

  const mockTurf: CanvassingTurf = {
    turfId: 'turf_001',
    turfName: 'Downtown North',
    precinctIds: ['precinct_1', 'precinct_2'],
    estimatedDoors: 200,
    estimatedHours: 5,
    doorsPerHour: 40,
    density: 'urban',
    priority: 8,
    avgGotvPriority: 75,
    avgPersuasionOpportunity: 60,
  };

  const mockAssignment: TurfAssignment = {
    id: 'assign_001',
    volunteerId: 'vol_123',
    turfId: 'turf_001',
    universeId: 'universe_001',
    assignedBy: 'coordinator_1',
    assignedAt: '2024-01-15T10:00:00Z',
    priority: 'high',
    status: 'assigned',
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // ===== CRUD Operations =====

  describe('createVolunteer', () => {
    it('should create a new volunteer with default stats', () => {
      const input = {
        name: 'John Smith',
        email: 'john@example.com',
        phone: '555-5678',
        experienceLevel: 'new' as ExperienceLevel,
        availableDays: ['saturday', 'sunday'],
        availableTimeSlots: [],
        hasVehicle: false,
        canLeadTeam: false,
        reliabilityScore: 100,
        noShowCount: 0,
        lateStartCount: 0,
        activeAssignments: 0,
      };

      const created = VolunteerManager.createVolunteer(input);

      expect(created).toMatchObject({
        name: 'John Smith',
        email: 'john@example.com',
        phone: '555-5678',
        experienceLevel: 'new',
        totalDoorsKnocked: 0,
        totalHoursVolunteered: 0,
        completionRate: 100,
        activeAssignments: 0,
      });
      expect(created.id).toMatch(/^vol_/);
      expect(created.createdAt).toBeDefined();
      expect(VolunteerStore.saveVolunteer).toHaveBeenCalledWith(created);
    });

    it('should set completion rate to 100 for new volunteers', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '555-0000',
        experienceLevel: 'new' as ExperienceLevel,
        availableDays: ['monday'],
        availableTimeSlots: [],
        hasVehicle: true,
        canLeadTeam: false,
        reliabilityScore: 100,
        noShowCount: 0,
        lateStartCount: 0,
        activeAssignments: 0,
      };

      const created = VolunteerManager.createVolunteer(input);

      expect(created.completionRate).toBe(100);
    });

    it('should generate unique IDs for multiple volunteers', () => {
      const input = {
        name: 'Test',
        email: 'test@example.com',
        phone: '555-0000',
        experienceLevel: 'new' as ExperienceLevel,
        availableDays: ['monday'],
        availableTimeSlots: [],
        hasVehicle: false,
        canLeadTeam: false,
        reliabilityScore: 100,
        noShowCount: 0,
        lateStartCount: 0,
        activeAssignments: 0,
      };

      const vol1 = VolunteerManager.createVolunteer(input);
      const vol2 = VolunteerManager.createVolunteer(input);

      expect(vol1.id).not.toBe(vol2.id);
    });
  });

  describe('updateVolunteer', () => {
    it('should update an existing volunteer', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue(mockVolunteer);

      const updates = { phone: '555-9999', experienceLevel: 'team_leader' as ExperienceLevel };
      const updated = VolunteerManager.updateVolunteer('vol_123', updates);

      expect(updated).toMatchObject({
        ...mockVolunteer,
        phone: '555-9999',
        experienceLevel: 'team_leader',
      });
      expect(VolunteerStore.saveVolunteer).toHaveBeenCalledWith(updated);
    });

    it('should throw error when volunteer not found', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue(null);

      expect(() => {
        VolunteerManager.updateVolunteer('nonexistent', { phone: '555-0000' });
      }).toThrow('Volunteer nonexistent not found');
    });

    it('should allow partial updates', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue(mockVolunteer);

      const updated = VolunteerManager.updateVolunteer('vol_123', { phone: '555-1111' });

      expect(updated.phone).toBe('555-1111');
      expect(updated.email).toBe(mockVolunteer.email);
      expect(updated.name).toBe(mockVolunteer.name);
    });
  });

  describe('deleteVolunteer', () => {
    it('should delete a volunteer successfully', () => {
      (VolunteerStore.deleteVolunteer as jest.Mock).mockReturnValue(true);

      const result = VolunteerManager.deleteVolunteer('vol_123');

      expect(result).toBe(true);
      expect(VolunteerStore.deleteVolunteer).toHaveBeenCalledWith('vol_123');
    });

    it('should return false when volunteer not found', () => {
      (VolunteerStore.deleteVolunteer as jest.Mock).mockReturnValue(false);

      const result = VolunteerManager.deleteVolunteer('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getVolunteer', () => {
    it('should return a volunteer when found', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue(mockVolunteer);

      const result = VolunteerManager.getVolunteer('vol_123');

      expect(result).toEqual(mockVolunteer);
      expect(VolunteerStore.getVolunteer).toHaveBeenCalledWith('vol_123');
    });

    it('should return null when volunteer not found', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue(null);

      const result = VolunteerManager.getVolunteer('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllVolunteers', () => {
    it('should return all volunteers', () => {
      const volunteers = [mockVolunteer, { ...mockVolunteer, id: 'vol_456' }];
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = VolunteerManager.getAllVolunteers();

      expect(result).toEqual(volunteers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no volunteers exist', () => {
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue([]);

      const result = VolunteerManager.getAllVolunteers();

      expect(result).toEqual([]);
    });
  });

  // ===== Filtering =====

  describe('filterVolunteers', () => {
    const volunteers: Volunteer[] = [
      { ...mockVolunteer, id: 'vol_1', experienceLevel: 'new', completionRate: 95 },
      { ...mockVolunteer, id: 'vol_2', experienceLevel: 'experienced', completionRate: 80 },
      { ...mockVolunteer, id: 'vol_3', experienceLevel: 'team_leader', completionRate: 90 },
      { ...mockVolunteer, id: 'vol_4', experienceLevel: 'new', hasVehicle: false },
      { ...mockVolunteer, id: 'vol_5', canLeadTeam: true, reliabilityScore: 95 },
      { ...mockVolunteer, id: 'vol_6', activeAssignments: 3, tags: ['veteran', 'weekend-warrior'] },
    ];

    beforeEach(() => {
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);
    });

    it('should filter by experience level', () => {
      const filters: VolunteerFilters = { experienceLevel: ['new'] };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result).toHaveLength(2);
      expect(result.every(v => v.experienceLevel === 'new')).toBe(true);
    });

    it('should filter by multiple experience levels', () => {
      const filters: VolunteerFilters = { experienceLevel: ['new', 'team_leader'] };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result).toHaveLength(3);
      expect(result.every(v => v.experienceLevel === 'new' || v.experienceLevel === 'team_leader')).toBe(true);
    });

    it('should filter by minimum completion rate', () => {
      const filters: VolunteerFilters = { minCompletionRate: 90 };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result.every(v => v.completionRate >= 90)).toBe(true);
    });

    it('should filter by available day', () => {
      const filters: VolunteerFilters = { availableOn: 'monday' };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result.every(v => v.availableDays.includes('monday'))).toBe(true);
    });

    it('should filter by has vehicle', () => {
      const filters: VolunteerFilters = { hasVehicle: true };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result.every(v => v.hasVehicle === true)).toBe(true);
    });

    it('should filter by can lead team', () => {
      const filters: VolunteerFilters = { canLeadTeam: true };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result).toHaveLength(1);
      expect(result[0].canLeadTeam).toBe(true);
    });

    it('should filter by tags', () => {
      const filters: VolunteerFilters = { tags: ['weekend-warrior'] };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result.every(v => v.tags && v.tags.includes('weekend-warrior'))).toBe(true);
    });

    it('should filter by minimum reliability score', () => {
      const filters: VolunteerFilters = { minReliability: 95 };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result.every(v => v.reliabilityScore >= 95)).toBe(true);
    });

    it('should filter by maximum active assignments', () => {
      const filters: VolunteerFilters = { maxActiveAssignments: 2 };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result.every(v => v.activeAssignments <= 2)).toBe(true);
    });

    it('should combine multiple filters', () => {
      const filters: VolunteerFilters = {
        experienceLevel: ['experienced', 'team_leader'],
        minCompletionRate: 85,
        hasVehicle: true,
      };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result.every(v =>
        (v.experienceLevel === 'experienced' || v.experienceLevel === 'team_leader') &&
        v.completionRate >= 85 &&
        v.hasVehicle === true
      )).toBe(true);
    });

    it('should return all volunteers when no filters applied', () => {
      const filters: VolunteerFilters = {};
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result).toHaveLength(volunteers.length);
    });

    it('should return empty array when no matches found', () => {
      const filters: VolunteerFilters = {
        experienceLevel: ['team_leader'],
        hasVehicle: false,
      };
      const result = VolunteerManager.filterVolunteers(filters);

      expect(result).toHaveLength(0);
    });
  });

  // ===== Assignments =====

  describe('assignTurf', () => {
    beforeEach(() => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue(mockVolunteer);
    });

    it('should assign a turf to a volunteer with default options', () => {
      const assignment = VolunteerManager.assignTurf('vol_123', 'turf_001', 'universe_001');

      expect(assignment).toMatchObject({
        volunteerId: 'vol_123',
        turfId: 'turf_001',
        universeId: 'universe_001',
        assignedBy: 'system',
        priority: 'medium',
        status: 'assigned',
      });
      expect(assignment.id).toMatch(/^vol_/);
      expect(assignment.assignedAt).toBeDefined();
      expect(VolunteerStore.saveAssignment).toHaveBeenCalled();
    });

    it('should assign a turf with custom options', () => {
      const options = {
        priority: 'urgent' as const,
        expectedCompletionDate: '2024-01-20',
        assignedBy: 'coordinator_1',
      };

      const assignment = VolunteerManager.assignTurf('vol_123', 'turf_001', 'universe_001', options);

      expect(assignment).toMatchObject({
        priority: 'urgent',
        expectedCompletionDate: '2024-01-20',
        assignedBy: 'coordinator_1',
      });
    });

    it('should increment volunteer active assignments count', () => {
      VolunteerManager.assignTurf('vol_123', 'turf_001', 'universe_001');

      expect(VolunteerStore.saveVolunteer).toHaveBeenCalledWith(
        expect.objectContaining({
          activeAssignments: 1,
        })
      );
    });

    it('should update volunteer lastActiveAt timestamp', () => {
      VolunteerManager.assignTurf('vol_123', 'turf_001', 'universe_001');

      const savedVolunteer = (VolunteerStore.saveVolunteer as jest.Mock).mock.calls[0][0];
      expect(savedVolunteer.lastActiveAt).toBeDefined();
    });

    it('should throw error when volunteer not found', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue(null);

      expect(() => {
        VolunteerManager.assignTurf('nonexistent', 'turf_001', 'universe_001');
      }).toThrow('Volunteer nonexistent not found');
    });
  });

  describe('unassignTurf', () => {
    it('should unassign a turf successfully', () => {
      (VolunteerStore.getAssignment as jest.Mock).mockReturnValue(mockAssignment);
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue({
        ...mockVolunteer,
        activeAssignments: 1,
      });

      const result = VolunteerManager.unassignTurf('assign_001');

      expect(result).toBe(true);
      expect(VolunteerStore.updateAssignment).toHaveBeenCalledWith('assign_001', {
        status: 'cancelled',
      });
    });

    it('should decrement volunteer active assignments count', () => {
      (VolunteerStore.getAssignment as jest.Mock).mockReturnValue(mockAssignment);
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue({
        ...mockVolunteer,
        activeAssignments: 2,
      });

      VolunteerManager.unassignTurf('assign_001');

      expect(VolunteerStore.updateVolunteer).toHaveBeenCalledWith('vol_123', {
        activeAssignments: 1,
      });
    });

    it('should not decrement below zero', () => {
      (VolunteerStore.getAssignment as jest.Mock).mockReturnValue(mockAssignment);
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue({
        ...mockVolunteer,
        activeAssignments: 0,
      });

      VolunteerManager.unassignTurf('assign_001');

      expect(VolunteerStore.updateVolunteer).not.toHaveBeenCalled();
    });

    it('should return false when assignment not found', () => {
      (VolunteerStore.getAssignment as jest.Mock).mockReturnValue(null);

      const result = VolunteerManager.unassignTurf('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getVolunteerAssignments', () => {
    it('should return all assignments for a volunteer', () => {
      const assignments = [mockAssignment, { ...mockAssignment, id: 'assign_002' }];
      (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue(assignments);

      const result = VolunteerManager.getVolunteerAssignments('vol_123');

      expect(result).toEqual(assignments);
      expect(VolunteerStore.getAssignmentsByVolunteer).toHaveBeenCalledWith('vol_123');
    });

    it('should return empty array when volunteer has no assignments', () => {
      (VolunteerStore.getAssignmentsByVolunteer as jest.Mock).mockReturnValue([]);

      const result = VolunteerManager.getVolunteerAssignments('vol_123');

      expect(result).toEqual([]);
    });
  });

  describe('getTurfAssignments', () => {
    it('should return all assignments for a turf', () => {
      const assignments = [mockAssignment, { ...mockAssignment, id: 'assign_002', volunteerId: 'vol_456' }];
      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue(assignments);

      const result = VolunteerManager.getTurfAssignments('turf_001');

      expect(result).toEqual(assignments);
      expect(VolunteerStore.getAssignmentsByTurf).toHaveBeenCalledWith('turf_001');
    });

    it('should return empty array when turf has no assignments', () => {
      (VolunteerStore.getAssignmentsByTurf as jest.Mock).mockReturnValue([]);

      const result = VolunteerManager.getTurfAssignments('turf_001');

      expect(result).toEqual([]);
    });
  });

  // ===== Recommendations =====

  describe('recommendVolunteersForTurf', () => {
    const volunteers: Volunteer[] = [
      {
        ...mockVolunteer,
        id: 'vol_1',
        experienceLevel: 'team_leader',
        completionRate: 95,
        reliabilityScore: 95,
        avgDoorsPerHour: 45,
        activeAssignments: 0,
        preferredDensity: 'urban',
      },
      {
        ...mockVolunteer,
        id: 'vol_2',
        experienceLevel: 'experienced',
        completionRate: 85,
        reliabilityScore: 85,
        avgDoorsPerHour: 35,
        activeAssignments: 1,
      },
      {
        ...mockVolunteer,
        id: 'vol_3',
        experienceLevel: 'new',
        completionRate: 70,
        reliabilityScore: 70,
        avgDoorsPerHour: 25,
        activeAssignments: 3,
        hasVehicle: false,
      },
    ];

    beforeEach(() => {
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);
    });

    it('should recommend volunteers sorted by score', () => {
      const recommendations = VolunteerManager.recommendVolunteersForTurf(mockTurf);

      expect(recommendations).toHaveLength(3);
      expect(recommendations[0].score).toBeGreaterThanOrEqual(recommendations[1].score);
      expect(recommendations[1].score).toBeGreaterThanOrEqual(recommendations[2].score);
    });

    it('should limit recommendations to specified count', () => {
      const recommendations = VolunteerManager.recommendVolunteersForTurf(mockTurf, 2);

      expect(recommendations).toHaveLength(2);
    });

    it('should include reasons for each recommendation', () => {
      const recommendations = VolunteerManager.recommendVolunteersForTurf(mockTurf);

      recommendations.forEach(rec => {
        expect(Array.isArray(rec.reasons)).toBe(true);
        expect(rec.reasons.length).toBeGreaterThan(0);
      });
    });

    it('should include warnings for problematic volunteers', () => {
      const recommendations = VolunteerManager.recommendVolunteersForTurf(mockTurf);

      const lowPerformer = recommendations.find(r => r.volunteer.id === 'vol_3');
      expect(lowPerformer?.warnings).toBeDefined();
      expect(lowPerformer?.warnings?.length).toBeGreaterThan(0);
    });

    it('should penalize volunteers without vehicles for rural turfs', () => {
      const ruralTurf: CanvassingTurf = { ...mockTurf, density: 'rural' };
      const recommendations = VolunteerManager.recommendVolunteersForTurf(ruralTurf);

      const noVehicle = recommendations.find(r => r.volunteer.id === 'vol_3');
      expect(noVehicle?.warnings?.some(w => w.includes('vehicle'))).toBe(true);
    });

    it('should bonus volunteers with matching density preference', () => {
      const recommendations = VolunteerManager.recommendVolunteersForTurf(mockTurf);

      const matched = recommendations.find(r => r.volunteer.id === 'vol_1');
      expect(matched?.reasons?.some(r => r.includes('Preferred density match'))).toBe(true);
    });

    it('should penalize overloaded volunteers', () => {
      const recommendations = VolunteerManager.recommendVolunteersForTurf(mockTurf);

      const overloaded = recommendations.find(r => r.volunteer.id === 'vol_3');
      expect(overloaded?.warnings?.some(w => w.includes('High workload'))).toBe(true);
    });
  });

  // ===== Reliability Scoring =====

  describe('calculateReliabilityScore', () => {
    it('should return 100 for perfect volunteer', () => {
      const perfect: Volunteer = {
        ...mockVolunteer,
        noShowCount: 0,
        lateStartCount: 0,
        completionRate: 100,
      };

      const score = VolunteerManager.calculateReliabilityScore(perfect);

      expect(score).toBe(100);
    });

    it('should penalize no-shows heavily (15 points each)', () => {
      const volunteer: Volunteer = {
        ...mockVolunteer,
        noShowCount: 2,
        lateStartCount: 0,
        completionRate: 100,
      };

      const score = VolunteerManager.calculateReliabilityScore(volunteer);

      expect(score).toBe(70); // 100 - (2 * 15)
    });

    it('should penalize late starts lightly (5 points each)', () => {
      const volunteer: Volunteer = {
        ...mockVolunteer,
        noShowCount: 0,
        lateStartCount: 4,
        completionRate: 100,
      };

      const score = VolunteerManager.calculateReliabilityScore(volunteer);

      expect(score).toBe(80); // 100 - (4 * 5)
    });

    it('should factor in completion rate (0.5x penalty)', () => {
      const volunteer: Volunteer = {
        ...mockVolunteer,
        noShowCount: 0,
        lateStartCount: 0,
        completionRate: 80,
      };

      const score = VolunteerManager.calculateReliabilityScore(volunteer);

      expect(score).toBe(90); // 100 - ((100 - 80) * 0.5)
    });

    it('should combine all penalty factors', () => {
      const volunteer: Volunteer = {
        ...mockVolunteer,
        noShowCount: 1,
        lateStartCount: 2,
        completionRate: 80,
      };

      const score = VolunteerManager.calculateReliabilityScore(volunteer);

      // 100 - (1 * 15) - (2 * 5) - ((100 - 80) * 0.5) = 100 - 15 - 10 - 10 = 65
      expect(score).toBe(65);
    });

    it('should never return score below 0', () => {
      const terrible: Volunteer = {
        ...mockVolunteer,
        noShowCount: 10,
        lateStartCount: 20,
        completionRate: 0,
      };

      const score = VolunteerManager.calculateReliabilityScore(terrible);

      expect(score).toBe(0);
    });

    it('should never return score above 100', () => {
      const perfect: Volunteer = {
        ...mockVolunteer,
        noShowCount: 0,
        lateStartCount: 0,
        completionRate: 100,
      };

      const score = VolunteerManager.calculateReliabilityScore(perfect);

      expect(score).toBeLessThanOrEqual(100);
    });

    it('should round to nearest integer', () => {
      const volunteer: Volunteer = {
        ...mockVolunteer,
        noShowCount: 0,
        lateStartCount: 1,
        completionRate: 96,
      };

      const score = VolunteerManager.calculateReliabilityScore(volunteer);

      expect(Number.isInteger(score)).toBe(true);
    });
  });

  describe('updateVolunteerStats', () => {
    beforeEach(() => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue({
        ...mockVolunteer,
        totalDoorsKnocked: 100,
        totalHoursVolunteered: 4,
        avgDoorsPerHour: 25,
      });
    });

    it('should update doors knocked and hours worked', () => {
      VolunteerManager.updateVolunteerStats('vol_123', 50, 2);

      expect(VolunteerStore.saveVolunteer).toHaveBeenCalledWith(
        expect.objectContaining({
          totalDoorsKnocked: 150,
          totalHoursVolunteered: 6,
        })
      );
    });

    it('should recalculate average doors per hour', () => {
      VolunteerManager.updateVolunteerStats('vol_123', 50, 2);

      const savedVolunteer = (VolunteerStore.saveVolunteer as jest.Mock).mock.calls[0][0];
      expect(savedVolunteer.avgDoorsPerHour).toBe(25); // (100 + 50) / (4 + 2) = 25
    });

    it('should round average doors per hour to one decimal', () => {
      VolunteerManager.updateVolunteerStats('vol_123', 47, 2);

      const savedVolunteer = (VolunteerStore.saveVolunteer as jest.Mock).mock.calls[0][0];
      expect(savedVolunteer.avgDoorsPerHour).toBe(24.5); // (100 + 47) / (4 + 2) = 24.5
    });

    it('should recalculate reliability score', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue({
        ...mockVolunteer,
        noShowCount: 1,
        lateStartCount: 2,
        completionRate: 85,
      });

      VolunteerManager.updateVolunteerStats('vol_123', 50, 2);

      const savedVolunteer = (VolunteerStore.saveVolunteer as jest.Mock).mock.calls[0][0];
      expect(savedVolunteer.reliabilityScore).toBeDefined();
    });

    it('should update lastActiveAt timestamp', () => {
      VolunteerManager.updateVolunteerStats('vol_123', 50, 2);

      const savedVolunteer = (VolunteerStore.saveVolunteer as jest.Mock).mock.calls[0][0];
      expect(savedVolunteer.lastActiveAt).toBeDefined();
    });

    it('should handle zero hours gracefully', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue({
        ...mockVolunteer,
        totalDoorsKnocked: 0,
        totalHoursVolunteered: 0,
      });

      VolunteerManager.updateVolunteerStats('vol_123', 0, 0);

      const savedVolunteer = (VolunteerStore.saveVolunteer as jest.Mock).mock.calls[0][0];
      expect(savedVolunteer.avgDoorsPerHour).toBe(0);
    });

    it('should throw error when volunteer not found', () => {
      (VolunteerStore.getVolunteer as jest.Mock).mockReturnValue(null);

      expect(() => {
        VolunteerManager.updateVolunteerStats('nonexistent', 50, 2);
      }).toThrow('Volunteer nonexistent not found');
    });
  });

  // ===== Bulk Operations =====

  describe('getActiveVolunteers', () => {
    it('should return only volunteers with active assignments', () => {
      const volunteers = [
        { ...mockVolunteer, id: 'vol_1', activeAssignments: 0 },
        { ...mockVolunteer, id: 'vol_2', activeAssignments: 1 },
        { ...mockVolunteer, id: 'vol_3', activeAssignments: 3 },
        { ...mockVolunteer, id: 'vol_4', activeAssignments: 0 },
      ];
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = VolunteerManager.getActiveVolunteers();

      expect(result).toHaveLength(2);
      expect(result.every(v => v.activeAssignments > 0)).toBe(true);
    });

    it('should return empty array when no active volunteers', () => {
      const volunteers = [
        { ...mockVolunteer, id: 'vol_1', activeAssignments: 0 },
        { ...mockVolunteer, id: 'vol_2', activeAssignments: 0 },
      ];
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = VolunteerManager.getActiveVolunteers();

      expect(result).toEqual([]);
    });
  });

  describe('getVolunteersByTag', () => {
    it('should return volunteers with matching tag', () => {
      const volunteers = [
        { ...mockVolunteer, id: 'vol_1', tags: ['weekend-warrior', 'phone-bank'] },
        { ...mockVolunteer, id: 'vol_2', tags: ['data-entry'] },
        { ...mockVolunteer, id: 'vol_3', tags: ['weekend-warrior'] },
        { ...mockVolunteer, id: 'vol_4', tags: undefined },
      ];
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = VolunteerManager.getVolunteersByTag('weekend-warrior');

      expect(result).toHaveLength(2);
      expect(result.every(v => v.tags?.includes('weekend-warrior'))).toBe(true);
    });

    it('should return empty array when no volunteers have the tag', () => {
      const volunteers = [
        { ...mockVolunteer, id: 'vol_1', tags: ['phone-bank'] },
        { ...mockVolunteer, id: 'vol_2', tags: ['data-entry'] },
      ];
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = VolunteerManager.getVolunteersByTag('nonexistent-tag');

      expect(result).toEqual([]);
    });

    it('should handle volunteers without tags array', () => {
      const volunteers = [
        { ...mockVolunteer, id: 'vol_1', tags: undefined },
        { ...mockVolunteer, id: 'vol_2', tags: [] },
        { ...mockVolunteer, id: 'vol_3', tags: ['weekend-warrior'] },
      ];
      (VolunteerStore.getAllVolunteers as jest.Mock).mockReturnValue(volunteers);

      const result = VolunteerManager.getVolunteersByTag('weekend-warrior');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('vol_3');
    });
  });
});
