/**
 * Unit Tests for ProgressTracker
 *
 * Tests session lifecycle, progress calculation, stalled turf detection,
 * and various edge cases.
 */

import { ProgressTracker } from '../ProgressTracker';
import { ProgressStore } from '../ProgressStore';
import type { CanvassingSession, TurfProgress } from '../types-progress';
import type { CanvassingTurf, CanvassingUniverse } from '../types';

// Mock ProgressStore
jest.mock('../ProgressStore');

const MockedProgressStore = ProgressStore as jest.Mocked<typeof ProgressStore>;

describe('ProgressTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startSession', () => {
    it('should create a new session with initial values', () => {
      const session = ProgressTracker.startSession(
        'volunteer-1',
        'turf-1',
        'universe-1',
        'assignment-1'
      );

      expect(session).toMatchObject({
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: 'assignment-1',
        startTime: '2024-01-15T12:00:00.000Z',
        pausedMinutes: 0,
        doorsKnocked: 0,
        contactsMade: 0,
        notHome: 0,
        refused: 0,
        movedAway: 0,
        positiveResponses: 0,
        negativeResponses: 0,
        undecided: 0,
        notes: '',
      });

      expect(session.id).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(MockedProgressStore.saveSession).toHaveBeenCalledWith(session);
    });

    it('should generate unique session IDs', () => {
      const session1 = ProgressTracker.startSession('v1', 't1', 'u1', 'a1');
      const session2 = ProgressTracker.startSession('v1', 't1', 'u1', 'a1');

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('endSession', () => {
    it('should end a session with final metrics', () => {
      const mockSession: CanvassingSession = {
        id: 'session-1',
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: 'assignment-1',
        startTime: '2024-01-15T10:00:00Z',
        pausedMinutes: 0,
        doorsKnocked: 0,
        contactsMade: 0,
        notHome: 0,
        refused: 0,
        movedAway: 0,
        notes: '',
      };

      MockedProgressStore.getSession.mockReturnValue(mockSession);

      const endedSession = ProgressTracker.endSession('session-1', {
        doorsKnocked: 45,
        contactsMade: 18,
        notHome: 12,
        refused: 5,
        positiveResponses: 10,
        negativeResponses: 8,
        undecided: 0,
        notes: 'Good canvassing session',
      });

      expect(endedSession).toMatchObject({
        id: 'session-1',
        endTime: '2024-01-15T12:00:00.000Z',
        doorsKnocked: 45,
        contactsMade: 18,
        notHome: 12,
        refused: 5,
        positiveResponses: 10,
        negativeResponses: 8,
        undecided: 0,
        notes: 'Good canvassing session',
      });

      expect(MockedProgressStore.saveSession).toHaveBeenCalledWith(endedSession);
      expect(MockedProgressStore.invalidateProgressCache).toHaveBeenCalledWith('turf-1');
    });

    it('should handle optional fields with defaults', () => {
      const mockSession: CanvassingSession = {
        id: 'session-1',
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: 'assignment-1',
        startTime: '2024-01-15T10:00:00Z',
        pausedMinutes: 0,
        doorsKnocked: 0,
        contactsMade: 0,
        notHome: 0,
        refused: 0,
        movedAway: 0,
        notes: 'Initial notes',
      };

      MockedProgressStore.getSession.mockReturnValue(mockSession);

      const endedSession = ProgressTracker.endSession('session-1', {
        doorsKnocked: 30,
        contactsMade: 12,
      });

      expect(endedSession.notHome).toBe(0);
      expect(endedSession.refused).toBe(0);
      expect(endedSession.positiveResponses).toBe(0);
      expect(endedSession.negativeResponses).toBe(0);
      expect(endedSession.undecided).toBe(0);
      expect(endedSession.notes).toBe('Initial notes');
    });

    it('should throw error if session not found', () => {
      MockedProgressStore.getSession.mockReturnValue(null);

      expect(() => {
        ProgressTracker.endSession('nonexistent', {
          doorsKnocked: 10,
          contactsMade: 5,
        });
      }).toThrow('Session nonexistent not found');
    });
  });

  describe('logProgress', () => {
    it('should update existing session when sessionId provided', () => {
      const mockSession: CanvassingSession = {
        id: 'session-1',
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: 'assignment-1',
        startTime: '2024-01-15T10:00:00Z',
        pausedMinutes: 0,
        doorsKnocked: 20,
        contactsMade: 8,
        notHome: 5,
        refused: 2,
        movedAway: 0,
        notes: '',
      };

      MockedProgressStore.getSession.mockReturnValue(mockSession);

      const updated = ProgressTracker.logProgress({
        sessionId: 'session-1',
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        doorsKnocked: 35,
        contactsMade: 15,
        notHome: 8,
        refused: 3,
        notes: 'Progress update',
      });

      expect(updated.doorsKnocked).toBe(35);
      expect(updated.contactsMade).toBe(15);
      expect(updated.notHome).toBe(8);
      expect(updated.refused).toBe(3);
      expect(updated.notes).toBe('Progress update');
      expect(MockedProgressStore.invalidateProgressCache).toHaveBeenCalledWith('turf-1');
    });

    it('should create new completed session when no sessionId', () => {
      const newSession = ProgressTracker.logProgress({
        volunteerId: 'volunteer-2',
        turfId: 'turf-2',
        universeId: 'universe-1',
        doorsKnocked: 50,
        contactsMade: 20,
        notHome: 15,
        refused: 5,
        notes: 'Batch entry',
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T10:00:00Z',
      });

      expect(newSession).toMatchObject({
        volunteerId: 'volunteer-2',
        turfId: 'turf-2',
        universeId: 'universe-1',
        doorsKnocked: 50,
        contactsMade: 20,
        notHome: 15,
        refused: 5,
        notes: 'Batch entry',
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T10:00:00Z',
        pausedMinutes: 0,
        movedAway: 0,
      });

      expect(MockedProgressStore.saveSession).toHaveBeenCalledWith(newSession);
    });

    it('should throw error if sessionId not found', () => {
      MockedProgressStore.getSession.mockReturnValue(null);

      expect(() => {
        ProgressTracker.logProgress({
          sessionId: 'nonexistent',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          doorsKnocked: 10,
          contactsMade: 5,
        });
      }).toThrow('Session nonexistent not found');
    });
  });

  describe('getTurfProgress', () => {
    it('should return cached progress if available', () => {
      const cachedProgress: TurfProgress = {
        turfId: 'turf-1',
        turfName: 'Turf 1',
        universeId: 'universe-1',
        targetDoors: 100,
        doorsKnocked: 45,
        doorsRemaining: 55,
        percentComplete: 45.0,
        totalContacts: 18,
        contactRate: 40.0,
        notHomeCount: 12,
        refusedCount: 5,
        totalHoursSpent: 2.5,
        doorsPerHour: 18.0,
        totalSessions: 2,
        uniqueVolunteers: 1,
        lastActivityDate: '2024-01-15T10:00:00Z',
        status: 'in_progress',
      };

      MockedProgressStore.getCachedTurfProgress.mockReturnValue(cachedProgress);

      const progress = ProgressTracker.getTurfProgress('turf-1', 100, 'Turf 1', 'universe-1');

      expect(progress).toEqual(cachedProgress);
      expect(MockedProgressStore.getCachedTurfProgress).toHaveBeenCalledWith('turf-1');
      expect(MockedProgressStore.getSessionsByTurf).not.toHaveBeenCalled();
    });

    it('should calculate progress from sessions if not cached', () => {
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);

      const mockSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 40,
          contactsMade: 16,
          notHome: 10,
          refused: 4,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 30,
          contactsMade: 12,
          notHome: 8,
          refused: 2,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getSessionsByTurf.mockReturnValue(mockSessions);

      const progress = ProgressTracker.getTurfProgress('turf-1', 100, 'Turf 1', 'universe-1');

      expect(progress).toMatchObject({
        turfId: 'turf-1',
        turfName: 'Turf 1',
        universeId: 'universe-1',
        targetDoors: 100,
        doorsKnocked: 70,
        doorsRemaining: 30,
        percentComplete: 70.0,
        totalContacts: 28,
        contactRate: 40.0,
        notHomeCount: 18,
        refusedCount: 6,
        totalHoursSpent: 3.0, // 2 hours + 1 hour
        doorsPerHour: 23.3,
        totalSessions: 2,
        uniqueVolunteers: 2,
        lastActivityDate: '2024-01-15T10:00:00Z',
        status: 'in_progress',
      });

      expect(MockedProgressStore.cacheTurfProgress).toHaveBeenCalled();
    });

    it('should handle sessions with paused time', () => {
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);

      const mockSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:30:00Z',
          pausedMinutes: 30, // 30 minute break
          doorsKnocked: 40,
          contactsMade: 16,
          notHome: 10,
          refused: 4,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getSessionsByTurf.mockReturnValue(mockSessions);

      const progress = ProgressTracker.getTurfProgress('turf-1', 100);

      // 2.5 hours total - 0.5 hours paused = 2 hours
      expect(progress.totalHoursSpent).toBe(2.0);
      expect(progress.doorsPerHour).toBe(20.0); // 40 doors / 2 hours
    });

    it('should handle turf with no sessions', () => {
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);
      MockedProgressStore.getSessionsByTurf.mockReturnValue([]);

      const progress = ProgressTracker.getTurfProgress('turf-empty', 50);

      expect(progress).toMatchObject({
        turfId: 'turf-empty',
        targetDoors: 50,
        doorsKnocked: 0,
        doorsRemaining: 50,
        percentComplete: 0,
        totalContacts: 0,
        contactRate: 0,
        totalSessions: 0,
        uniqueVolunteers: 0,
        status: 'not_started',
      });
    });

    it('should cap percentComplete at 100%', () => {
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);

      const mockSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 120, // Exceeded target
          contactsMade: 50,
          notHome: 20,
          refused: 10,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getSessionsByTurf.mockReturnValue(mockSessions);

      const progress = ProgressTracker.getTurfProgress('turf-1', 100);

      expect(progress.percentComplete).toBe(100);
      expect(progress.doorsRemaining).toBe(0);
      expect(progress.status).toBe('complete');
    });

    it('should determine status correctly', () => {
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);

      // Test "in_progress" status
      const recentSession: CanvassingSession = {
        id: 'session-1',
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: 'assignment-1',
        startTime: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        endTime: new Date().toISOString(),
        pausedMinutes: 0,
        doorsKnocked: 30,
        contactsMade: 12,
        notHome: 8,
        refused: 2,
        movedAway: 0,
      };

      MockedProgressStore.getSessionsByTurf.mockReturnValue([recentSession]);

      let progress = ProgressTracker.getTurfProgress('turf-1', 100);
      expect(progress.status).toBe('in_progress');

      // Test "stalled" status (48+ hours ago)
      const stalledSession: CanvassingSession = {
        ...recentSession,
        startTime: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), // 50 hours ago
      };

      MockedProgressStore.getSessionsByTurf.mockReturnValue([stalledSession]);
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);

      progress = ProgressTracker.getTurfProgress('turf-1', 100);
      expect(progress.status).toBe('stalled');
    });
  });

  describe('getUniverseProgress', () => {
    it('should aggregate progress across all turfs', () => {
      const universe: CanvassingUniverse = {
        id: 'universe-1',
        name: 'Test Universe',
        createdAt: '2024-01-01T00:00:00Z',
        targetDoorsPerTurf: 50,
        targetDoorsPerHour: 40,
        targetContactRate: 0.35,
        totalPrecincts: 10,
        totalEstimatedDoors: 300,
        estimatedTurfs: 6,
        estimatedHours: 7.5,
        volunteersNeeded: 3,
        precincts: [],
      };

      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-1',
          turfName: 'Turf 1',
          precinctIds: ['p1', 'p2'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
        {
          turfId: 'turf-2',
          turfName: 'Turf 2',
          precinctIds: ['p3', 'p4'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 8,
          avgGotvPriority: 70,
          avgPersuasionOpportunity: 50,
        },
        {
          turfId: 'turf-3',
          turfName: 'Turf 3',
          precinctIds: ['p5', 'p6'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'rural',
          priority: 6,
          avgGotvPriority: 60,
          avgPersuasionOpportunity: 40,
        },
      ];

      const mockSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-14T08:00:00Z', // Within last 7 days
          endTime: '2024-01-14T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 80,
          contactsMade: 32,
          notHome: 20,
          refused: 8,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-2',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 70,
          contactsMade: 28,
          notHome: 18,
          refused: 6,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getSessionsByUniverse.mockReturnValue(mockSessions);
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);

      // Mock getTurfProgress for each turf
      const turf1Sessions = [mockSessions[0]];
      const turf2Sessions = [mockSessions[1]];
      const turf3Sessions: CanvassingSession[] = [];

      MockedProgressStore.getSessionsByTurf
        .mockReturnValueOnce(turf1Sessions) // turf-1
        .mockReturnValueOnce(turf2Sessions) // turf-2
        .mockReturnValueOnce(turf3Sessions); // turf-3

      const progress = ProgressTracker.getUniverseProgress(universe, turfs);

      expect(progress).toMatchObject({
        universeId: 'universe-1',
        universeName: 'Test Universe',
        totalTargetDoors: 300,
        totalDoorsKnocked: 150,
        totalDoorsRemaining: 150,
        overallPercentComplete: 50.0,
        totalContacts: 60,
        overallContactRate: 40.0,
        totalNotHome: 38,
        totalRefused: 14,
        totalHoursSpent: 4.0,
        averageDoorsPerHour: 37.5,
        turfsTotal: 3,
        turfsComplete: 0,
        turfsInProgress: 2,
        turfsStalled: 0,
        turfsNotStarted: 1,
        totalSessions: 2,
        uniqueVolunteers: 2,
        activeVolunteers: 2, // Both within 7 days
      });
    });

    it('should calculate active volunteers correctly', () => {
      const universe: CanvassingUniverse = {
        id: 'universe-1',
        name: 'Test Universe',
        createdAt: '2024-01-01T00:00:00Z',
        targetDoorsPerTurf: 50,
        targetDoorsPerHour: 40,
        targetContactRate: 0.35,
        totalPrecincts: 10,
        totalEstimatedDoors: 100,
        estimatedTurfs: 2,
        estimatedHours: 2.5,
        volunteersNeeded: 2,
        precincts: [],
      };

      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-1',
          turfName: 'Turf 1',
          precinctIds: ['p1'],
          estimatedDoors: 50,
          estimatedHours: 1.25,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
      ];

      // Current time: 2024-01-15T12:00:00Z
      // 7 days ago: 2024-01-08T12:00:00Z
      const mockSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-14T08:00:00Z', // Recent (active)
          endTime: '2024-01-14T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 40,
          contactsMade: 16,
          notHome: 10,
          refused: 4,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-01-05T08:00:00Z', // >7 days ago (not active)
          endTime: '2024-01-05T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 30,
          contactsMade: 12,
          notHome: 8,
          refused: 2,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getSessionsByUniverse.mockReturnValue(mockSessions);
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);
      MockedProgressStore.getSessionsByTurf.mockReturnValue(mockSessions);

      const progress = ProgressTracker.getUniverseProgress(universe, turfs);

      expect(progress.uniqueVolunteers).toBe(2); // Total unique
      expect(progress.activeVolunteers).toBe(1); // Only volunteer-1 active in last 7 days
    });

    it('should handle universe with no sessions', () => {
      const universe: CanvassingUniverse = {
        id: 'universe-empty',
        name: 'Empty Universe',
        createdAt: '2024-01-01T00:00:00Z',
        targetDoorsPerTurf: 50,
        targetDoorsPerHour: 40,
        targetContactRate: 0.35,
        totalPrecincts: 5,
        totalEstimatedDoors: 100,
        estimatedTurfs: 2,
        estimatedHours: 2.5,
        volunteersNeeded: 1,
        precincts: [],
      };

      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-1',
          turfName: 'Turf 1',
          precinctIds: ['p1'],
          estimatedDoors: 50,
          estimatedHours: 1.25,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
      ];

      MockedProgressStore.getSessionsByUniverse.mockReturnValue([]);
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);
      MockedProgressStore.getSessionsByTurf.mockReturnValue([]);

      const progress = ProgressTracker.getUniverseProgress(universe, turfs);

      expect(progress).toMatchObject({
        totalDoorsKnocked: 0,
        totalDoorsRemaining: 100,
        overallPercentComplete: 0,
        totalContacts: 0,
        overallContactRate: 0,
        totalHoursSpent: 0,
        averageDoorsPerHour: 0,
        turfsNotStarted: 1,
        totalSessions: 0,
        uniqueVolunteers: 0,
        activeVolunteers: 0,
      });
    });
  });

  describe('getVolunteerProgress', () => {
    it('should aggregate progress for a volunteer', () => {
      const mockSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 40,
          contactsMade: 16,
          notHome: 10,
          refused: 4,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-2',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:30:00Z',
          pausedMinutes: 0,
          doorsKnocked: 50,
          contactsMade: 20,
          notHome: 12,
          refused: 5,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getSessionsByVolunteer.mockReturnValue(mockSessions);

      const progress = ProgressTracker.getVolunteerProgress('volunteer-1');

      expect(progress).toEqual({
        totalSessions: 2,
        totalDoorsKnocked: 90,
        totalContacts: 36,
        totalHours: 3.5,
        averageDoorsPerHour: 25.7,
        averageContactRate: 40.0,
      });
    });

    it('should filter by universe when provided', () => {
      const allSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 40,
          contactsMade: 16,
          notHome: 10,
          refused: 4,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-2',
          universeId: 'universe-2',
          assignmentId: 'assignment-2',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T12:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 50,
          contactsMade: 20,
          notHome: 12,
          refused: 5,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getSessionsByVolunteer.mockReturnValue(allSessions);

      const progress = ProgressTracker.getVolunteerProgress('volunteer-1', 'universe-1');

      // Should only include session-1 from universe-1
      expect(progress.totalSessions).toBe(1);
      expect(progress.totalDoorsKnocked).toBe(40);
    });

    it('should handle volunteer with no sessions', () => {
      MockedProgressStore.getSessionsByVolunteer.mockReturnValue([]);

      const progress = ProgressTracker.getVolunteerProgress('volunteer-new');

      expect(progress).toEqual({
        totalSessions: 0,
        totalDoorsKnocked: 0,
        totalContacts: 0,
        totalHours: 0,
        averageDoorsPerHour: 0,
        averageContactRate: 0,
      });
    });
  });

  describe('identifyStalledTurfs', () => {
    it('should identify turfs with no activity in 48+ hours', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-stalled',
          turfName: 'Stalled Turf',
          precinctIds: ['p1'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
        {
          turfId: 'turf-active',
          turfName: 'Active Turf',
          precinctIds: ['p2'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 8,
          avgGotvPriority: 70,
          avgPersuasionOpportunity: 50,
        },
      ];

      // Stalled turf: last activity 50 hours ago
      const stalledSession: CanvassingSession = {
        id: 'session-1',
        volunteerId: 'volunteer-1',
        turfId: 'turf-stalled',
        universeId: 'universe-1',
        assignmentId: 'assignment-1',
        startTime: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 50 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        pausedMinutes: 0,
        doorsKnocked: 30,
        contactsMade: 12,
        notHome: 8,
        refused: 2,
        movedAway: 0,
      };

      // Active turf: last activity 10 hours ago
      const activeSession: CanvassingSession = {
        id: 'session-2',
        volunteerId: 'volunteer-2',
        turfId: 'turf-active',
        universeId: 'universe-1',
        assignmentId: 'assignment-2',
        startTime: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 10 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        pausedMinutes: 0,
        doorsKnocked: 40,
        contactsMade: 16,
        notHome: 10,
        refused: 4,
        movedAway: 0,
      };

      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);
      MockedProgressStore.getSessionsByTurf
        .mockReturnValueOnce([stalledSession])
        .mockReturnValueOnce([activeSession]);

      const alerts = ProgressTracker.identifyStalledTurfs('universe-1', turfs, 48);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        turfId: 'turf-stalled',
        turfName: 'Stalled Turf',
        universeId: 'universe-1',
        daysInactive: 2,
        percentComplete: 30.0,
        doorsRemaining: 70,
        suggestedAction: 'follow_up',
      });
    });

    it('should suggest reassign for turfs inactive >7 days', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-very-stalled',
          turfName: 'Very Stalled Turf',
          precinctIds: ['p1'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
      ];

      // Very stalled: last activity 10 days ago
      const veryOldSession: CanvassingSession = {
        id: 'session-1',
        volunteerId: 'volunteer-1',
        turfId: 'turf-very-stalled',
        universeId: 'universe-1',
        assignmentId: 'assignment-1',
        startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        pausedMinutes: 0,
        doorsKnocked: 20,
        contactsMade: 8,
        notHome: 5,
        refused: 2,
        movedAway: 0,
      };

      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);
      MockedProgressStore.getSessionsByTurf.mockReturnValue([veryOldSession]);

      const alerts = ProgressTracker.identifyStalledTurfs('universe-1', turfs, 48);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        turfId: 'turf-very-stalled',
        daysInactive: 10,
        suggestedAction: 'reassign',
      });
    });

    it('should identify never-started turfs', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-never-started',
          turfName: 'Never Started Turf',
          precinctIds: ['p1'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
      ];

      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);
      MockedProgressStore.getSessionsByTurf.mockReturnValue([]);

      const alerts = ProgressTracker.identifyStalledTurfs('universe-1', turfs, 48);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        turfId: 'turf-never-started',
        turfName: 'Never Started Turf',
        daysInactive: 999,
        percentComplete: 0,
        doorsRemaining: 100,
        suggestedAction: 'reassign',
      });
    });

    it('should skip completed turfs', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-complete',
          turfName: 'Complete Turf',
          precinctIds: ['p1'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
      ];

      // Complete turf but old
      const oldSession: CanvassingSession = {
        id: 'session-1',
        volunteerId: 'volunteer-1',
        turfId: 'turf-complete',
        universeId: 'universe-1',
        assignmentId: 'assignment-1',
        startTime: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 100 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        pausedMinutes: 0,
        doorsKnocked: 110, // Over target
        contactsMade: 44,
        notHome: 30,
        refused: 10,
        movedAway: 0,
      };

      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);
      MockedProgressStore.getSessionsByTurf.mockReturnValue([oldSession]);

      const alerts = ProgressTracker.identifyStalledTurfs('universe-1', turfs, 48);

      expect(alerts).toHaveLength(0); // Complete turf should not be in alerts
    });

    it('should sort alerts by days inactive descending', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-1',
          turfName: 'Turf 1',
          precinctIds: ['p1'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
        {
          turfId: 'turf-2',
          turfName: 'Turf 2',
          precinctIds: ['p2'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 8,
          avgGotvPriority: 70,
          avgPersuasionOpportunity: 50,
        },
        {
          turfId: 'turf-3',
          turfName: 'Turf 3',
          precinctIds: ['p3'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'rural',
          priority: 6,
          avgGotvPriority: 60,
          avgPersuasionOpportunity: 40,
        },
      ];

      const sessions = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
          endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          pausedMinutes: 0,
          doorsKnocked: 30,
          contactsMade: 12,
          notHome: 8,
          refused: 2,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-2',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
          endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          pausedMinutes: 0,
          doorsKnocked: 40,
          contactsMade: 16,
          notHome: 10,
          refused: 4,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);
      MockedProgressStore.getSessionsByTurf
        .mockReturnValueOnce([sessions[0]]) // turf-1: 3 days
        .mockReturnValueOnce([sessions[1]]) // turf-2: 5 days
        .mockReturnValueOnce([]); // turf-3: never started (999 days)

      const alerts = ProgressTracker.identifyStalledTurfs('universe-1', turfs, 48);

      expect(alerts).toHaveLength(3);
      expect(alerts[0].turfId).toBe('turf-3'); // 999 days (never started)
      expect(alerts[1].turfId).toBe('turf-2'); // 5 days
      expect(alerts[2].turfId).toBe('turf-1'); // 3 days
    });
  });

  describe('calculateContactRate', () => {
    it('should calculate contact rate from sessions', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 100,
          contactsMade: 40,
          notHome: 30,
          refused: 10,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T12:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 50,
          contactsMade: 20,
          notHome: 15,
          refused: 5,
          movedAway: 0,
        },
      ];

      const rate = ProgressTracker.calculateContactRate(sessions);

      expect(rate).toBe(40.0); // 60 contacts / 150 doors = 40%
    });

    it('should return 0 for empty sessions', () => {
      const rate = ProgressTracker.calculateContactRate([]);
      expect(rate).toBe(0);
    });

    it('should return 0 for sessions with no doors knocked', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 0,
          contactsMade: 0,
          notHome: 0,
          refused: 0,
          movedAway: 0,
        },
      ];

      const rate = ProgressTracker.calculateContactRate(sessions);
      expect(rate).toBe(0);
    });
  });

  describe('calculateDoorsPerHour', () => {
    it('should calculate doors per hour from sessions', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:00:00Z', // 2 hours
          pausedMinutes: 0,
          doorsKnocked: 80,
          contactsMade: 32,
          notHome: 20,
          refused: 8,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z', // 1 hour
          pausedMinutes: 0,
          doorsKnocked: 40,
          contactsMade: 16,
          notHome: 10,
          refused: 4,
          movedAway: 0,
        },
      ];

      const dph = ProgressTracker.calculateDoorsPerHour(sessions);

      expect(dph).toBe(40.0); // 120 doors / 3 hours = 40 DPH
    });

    it('should return 0 for empty sessions', () => {
      const dph = ProgressTracker.calculateDoorsPerHour([]);
      expect(dph).toBe(0);
    });

    it('should return 0 for sessions with no duration', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          // No endTime
          pausedMinutes: 0,
          doorsKnocked: 40,
          contactsMade: 16,
          notHome: 10,
          refused: 4,
          movedAway: 0,
        },
      ];

      const dph = ProgressTracker.calculateDoorsPerHour(sessions);
      expect(dph).toBe(0);
    });
  });

  describe('generateProgressSummary', () => {
    it('should generate comprehensive progress summary', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-1',
          turfName: 'Turf 1',
          precinctIds: ['p1'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'urban',
          priority: 10,
          avgGotvPriority: 80,
          avgPersuasionOpportunity: 60,
        },
        {
          turfId: 'turf-2',
          turfName: 'Turf 2',
          precinctIds: ['p2'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 8,
          avgGotvPriority: 70,
          avgPersuasionOpportunity: 50,
        },
      ];

      const mockSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 80,
          contactsMade: 32,
          notHome: 20,
          refused: 8,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-2',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-01-14T08:00:00Z',
          endTime: '2024-01-14T10:00:00Z',
          pausedMinutes: 0,
          doorsKnocked: 70,
          contactsMade: 28,
          notHome: 18,
          refused: 6,
          movedAway: 0,
        },
      ];

      MockedProgressStore.getSessionsByUniverse.mockReturnValue(mockSessions);
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);

      // Mock getTurfProgress calls
      MockedProgressStore.getSessionsByTurf
        .mockReturnValueOnce([mockSessions[0]]) // turf-1 for universe progress
        .mockReturnValueOnce([mockSessions[1]]) // turf-2 for universe progress
        .mockReturnValueOnce([mockSessions[0]]) // turf-1 for stalled check
        .mockReturnValueOnce([mockSessions[1]]) // turf-2 for stalled check
        .mockReturnValueOnce([mockSessions[0]]) // turf-1 for top performing
        .mockReturnValueOnce([mockSessions[1]]); // turf-2 for top performing

      // Mock getSessionsByDate for daily trend (14 days)
      MockedProgressStore.getSessionsByDate.mockReturnValue([]);

      const summary = ProgressTracker.generateProgressSummary('universe-1', turfs);

      expect(summary).toHaveProperty('overview');
      expect(summary).toHaveProperty('dailyTrend');
      expect(summary).toHaveProperty('stalledTurfs');
      expect(summary).toHaveProperty('topPerformingTurfs');

      expect(summary.overview.universeId).toBe('universe-1');
      expect(summary.overview.totalDoorsKnocked).toBe(150);
      expect(summary.dailyTrend).toHaveLength(14);
      expect(summary.topPerformingTurfs.length).toBeLessThanOrEqual(5);
    });

    it('should limit top performing turfs to 5', () => {
      const turfs: CanvassingTurf[] = Array.from({ length: 10 }, (_, i) => ({
        turfId: `turf-${i}`,
        turfName: `Turf ${i}`,
        precinctIds: [`p${i}`],
        estimatedDoors: 100,
        estimatedHours: 2.5,
        doorsPerHour: 40,
        density: 'urban' as const,
        priority: 10 - i,
        avgGotvPriority: 80,
        avgPersuasionOpportunity: 60,
      }));

      const mockSessions: CanvassingSession[] = turfs.map((turf, i) => ({
        id: `session-${i}`,
        volunteerId: `volunteer-${i}`,
        turfId: turf.turfId,
        universeId: 'universe-1',
        assignmentId: `assignment-${i}`,
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T10:00:00Z',
        pausedMinutes: 0,
        doorsKnocked: 50 + i * 10,
        contactsMade: 20 + i * 4,
        notHome: 15,
        refused: 5,
        movedAway: 0,
      }));

      MockedProgressStore.getSessionsByUniverse.mockReturnValue(mockSessions);
      MockedProgressStore.getCachedTurfProgress.mockReturnValue(null);

      // Mock all the getSessionsByTurf calls
      mockSessions.forEach((session) => {
        MockedProgressStore.getSessionsByTurf.mockReturnValueOnce([session]);
      });

      // Additional mocks for stalled and top performing checks
      mockSessions.forEach((session) => {
        MockedProgressStore.getSessionsByTurf.mockReturnValueOnce([session]);
      });

      mockSessions.forEach((session) => {
        MockedProgressStore.getSessionsByTurf.mockReturnValueOnce([session]);
      });

      MockedProgressStore.getSessionsByDate.mockReturnValue([]);

      const summary = ProgressTracker.generateProgressSummary('universe-1', turfs);

      expect(summary.topPerformingTurfs).toHaveLength(5);
    });
  });
});
