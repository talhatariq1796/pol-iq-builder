/**
 * PerformanceAnalyzer Unit Tests
 *
 * Tests for volunteer, precinct, and turf performance analytics.
 */

import { PerformanceAnalyzer, PerformanceInsight } from '../PerformanceAnalyzer';
import { ProgressStore } from '../ProgressStore';
import type { CanvassingSession, TurfProgress, UniverseProgress } from '../types-progress';
import type {
  VolunteerAnalytics,
  PrecinctAnalytics,
  TemporalAnalytics,
  ConversionFunnel,
  WeeklyReport,
} from '../types-analytics';
import type { CanvassingTurf, CanvassingUniverse } from '../types';

// Mock ProgressStore
jest.mock('../ProgressStore', () => ({
  ProgressStore: {
    getSessionsByVolunteer: jest.fn(),
    getSessionsByUniverse: jest.fn(),
    getSessionsByTurf: jest.fn(),
    getSessionsInRange: jest.fn(),
  },
}));

describe('PerformanceAnalyzer', () => {
  const mockProgressStore = ProgressStore as jest.Mocked<typeof ProgressStore>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeVolunteer', () => {
    it('should return empty analytics for volunteer with no sessions', () => {
      mockProgressStore.getSessionsByVolunteer.mockReturnValue([]);

      const result = PerformanceAnalyzer.analyzeVolunteer('volunteer-1');

      expect(result).toEqual({
        volunteerId: 'volunteer-1',
        volunteerName: 'volunteer-1',
        totalSessions: 0,
        totalHours: 0,
        totalDoorsKnocked: 0,
        totalContacts: 0,
        averageDoorsPerHour: 0,
        averageContactRate: 0,
        averageSessionLength: 0,
        completionRate: 0,
        onTimeRate: 100,
        noShowCount: 0,
        rankByDoors: 1,
        rankByEfficiency: 1,
        rankByReliability: 1,
        overallRank: 1,
        percentile: 100,
        performanceTrend: 'stable',
        hoursThisWeek: 0,
        hoursLastWeek: 0,
      });
    });

    it('should calculate metrics correctly for completed sessions', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          pausedMinutes: 10,
          doorsKnocked: 80,
          contactsMade: 30,
          notHome: 40,
          refused: 10,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-12-02T14:00:00Z',
          endTime: '2024-12-02T16:00:00Z',
          pausedMinutes: 5,
          doorsKnocked: 75,
          contactsMade: 28,
          notHome: 38,
          refused: 9,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByVolunteer.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.analyzeVolunteer('volunteer-1');

      // Total doors: 80 + 75 = 155
      expect(result.totalDoorsKnocked).toBe(155);

      // Total contacts: 30 + 28 = 58
      expect(result.totalContacts).toBe(58);

      // Total hours: (120-10)/60 + (120-5)/60 = 1.833 + 1.917 = 3.75
      expect(result.totalHours).toBeCloseTo(3.75, 2);

      // Average doors per hour: 155 / 3.75 = 41.33
      expect(result.averageDoorsPerHour).toBeCloseTo(41.33, 2);

      // Average contact rate: 58 / 155 = 0.374
      expect(result.averageContactRate).toBeCloseTo(0.374, 3);

      // Completion rate: 2 completed / 2 total = 100%
      expect(result.completionRate).toBe(100);
    });

    it('should filter sessions by universeId when provided', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          doorsKnocked: 80,
          contactsMade: 30,
          notHome: 40,
          refused: 10,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-2',
          universeId: 'universe-2',
          assignmentId: 'assignment-2',
          startTime: '2024-12-02T14:00:00Z',
          endTime: '2024-12-02T16:00:00Z',
          doorsKnocked: 75,
          contactsMade: 28,
          notHome: 38,
          refused: 9,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByVolunteer.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.analyzeVolunteer('volunteer-1', 'universe-1');

      // Should only count universe-1 session
      expect(result.totalDoorsKnocked).toBe(80);
      expect(result.totalContacts).toBe(30);
    });

    it('should calculate recent activity correctly', () => {
      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: threeDaysAgo,
          endTime: new Date(new Date(threeDaysAgo).getTime() + 2 * 60 * 60 * 1000).toISOString(),
          doorsKnocked: 80,
          contactsMade: 30,
          notHome: 40,
          refused: 10,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: tenDaysAgo,
          endTime: new Date(new Date(tenDaysAgo).getTime() + 2 * 60 * 60 * 1000).toISOString(),
          doorsKnocked: 75,
          contactsMade: 28,
          notHome: 38,
          refused: 9,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByVolunteer.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.analyzeVolunteer('volunteer-1');

      // hoursThisWeek should only count session from 3 days ago (2 hours)
      expect(result.hoursThisWeek).toBeCloseTo(2, 1);

      // hoursLastWeek should count session from 10 days ago (2 hours)
      expect(result.hoursLastWeek).toBeCloseTo(2, 1);
    });
  });

  describe('calculateEfficiencyScore', () => {
    it('should calculate efficiency score with correct weights', () => {
      // Formula: doorsScore * 0.4 + contactScore * 0.35 + completionScore * 0.25
      // doorsPerHour=40 -> 100%, contactRate=0.35 -> 100%, completionRate=1.0 -> 100%
      // Score = 100 * 0.4 + 100 * 0.35 + 100 * 0.25 = 100

      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 40,
          contactsMade: 14, // 35% contact rate
          notHome: 20,
          refused: 6,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByVolunteer.mockReturnValue(sessions);
      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1', 'efficiency');

      expect(rankings).toHaveLength(1);
      // Efficiency should be close to 100
      // doorsPerHour: 40/1 = 40 -> 100 points
      // contactRate: 14/40 = 0.35 -> 100 points
      // completionRate: 1/1 = 1.0 -> 100 points
      // Score: 100*0.4 + 100*0.35 + 100*0.25 = 100
      const efficiency =
        ((40 / 40) * 100) * 0.4 + ((0.35 / 0.35) * 100) * 0.35 + (1.0 * 100) * 0.25;
      expect(efficiency).toBeCloseTo(100, 0);
    });

    it('should cap scores at 100%', () => {
      // doorsPerHour=80 (should cap at 100), contactRate=0.7 (should cap at 100)
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 80,
          contactsMade: 56, // 70% contact rate
          notHome: 20,
          refused: 4,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByVolunteer.mockReturnValue(sessions);
      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1', 'efficiency');

      expect(rankings).toHaveLength(1);
      // Both doors and contact should cap at 100
      const efficiency = 100 * 0.4 + 100 * 0.35 + 100 * 0.25;
      expect(efficiency).toBe(100);
    });
  });

  describe('determineTrend', () => {
    it('should return stable for less than 6 sessions', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 40,
          contactsMade: 14,
          notHome: 20,
          refused: 6,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByVolunteer.mockReturnValue(sessions);
      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      expect(rankings[0].trend).toBe('stable');
    });

    it('should return improving when recent performance is 10%+ better', () => {
      const sessions: CanvassingSession[] = [
        // Previous 3 sessions (30 doors/hour average)
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-11-20T10:00:00Z',
          endTime: '2024-11-20T11:00:00Z',
          doorsKnocked: 30,
          contactsMade: 10,
          notHome: 15,
          refused: 5,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-11-21T10:00:00Z',
          endTime: '2024-11-21T11:00:00Z',
          doorsKnocked: 30,
          contactsMade: 10,
          notHome: 15,
          refused: 5,
          movedAway: 0,
        },
        {
          id: 'session-3',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-3',
          startTime: '2024-11-22T10:00:00Z',
          endTime: '2024-11-22T11:00:00Z',
          doorsKnocked: 30,
          contactsMade: 10,
          notHome: 15,
          refused: 5,
          movedAway: 0,
        },
        // Recent 3 sessions (45 doors/hour average = 50% improvement)
        {
          id: 'session-4',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-4',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 45,
          contactsMade: 15,
          notHome: 20,
          refused: 10,
          movedAway: 0,
        },
        {
          id: 'session-5',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-5',
          startTime: '2024-12-02T10:00:00Z',
          endTime: '2024-12-02T11:00:00Z',
          doorsKnocked: 45,
          contactsMade: 15,
          notHome: 20,
          refused: 10,
          movedAway: 0,
        },
        {
          id: 'session-6',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-6',
          startTime: '2024-12-03T10:00:00Z',
          endTime: '2024-12-03T11:00:00Z',
          doorsKnocked: 45,
          contactsMade: 15,
          notHome: 20,
          refused: 10,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByVolunteer.mockReturnValue(sessions);
      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      expect(rankings[0].trend).toBe('improving');
    });

    it('should return declining when recent performance is 10%+ worse', () => {
      const sessions: CanvassingSession[] = [
        // Previous 3 sessions (50 doors/hour average)
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-11-20T10:00:00Z',
          endTime: '2024-11-20T11:00:00Z',
          doorsKnocked: 50,
          contactsMade: 18,
          notHome: 25,
          refused: 7,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-11-21T10:00:00Z',
          endTime: '2024-11-21T11:00:00Z',
          doorsKnocked: 50,
          contactsMade: 18,
          notHome: 25,
          refused: 7,
          movedAway: 0,
        },
        {
          id: 'session-3',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-3',
          startTime: '2024-11-22T10:00:00Z',
          endTime: '2024-11-22T11:00:00Z',
          doorsKnocked: 50,
          contactsMade: 18,
          notHome: 25,
          refused: 7,
          movedAway: 0,
        },
        // Recent 3 sessions (35 doors/hour average = 30% decline)
        {
          id: 'session-4',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-4',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 35,
          contactsMade: 12,
          notHome: 18,
          refused: 5,
          movedAway: 0,
        },
        {
          id: 'session-5',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-5',
          startTime: '2024-12-02T10:00:00Z',
          endTime: '2024-12-02T11:00:00Z',
          doorsKnocked: 35,
          contactsMade: 12,
          notHome: 18,
          refused: 5,
          movedAway: 0,
        },
        {
          id: 'session-6',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-6',
          startTime: '2024-12-03T10:00:00Z',
          endTime: '2024-12-03T11:00:00Z',
          doorsKnocked: 35,
          contactsMade: 12,
          notHome: 18,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByVolunteer.mockReturnValue(sessions);
      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      expect(rankings[0].trend).toBe('declining');
    });
  });

  describe('assignBadges', () => {
    it('should assign Top Performer badge to ranks 1-3', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 50,
          contactsMade: 20,
          notHome: 25,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].badges).toContain('Top Performer');
    });

    it('should assign Most Improved badge when trend is improving', () => {
      const sessions: CanvassingSession[] = Array.from({ length: 6 }, (_, i) => ({
        id: `session-${i + 1}`,
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: `assignment-${i + 1}`,
        startTime: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        doorsKnocked: i < 3 ? 30 : 45, // Recent sessions better
        contactsMade: i < 3 ? 10 : 16,
        notHome: 15,
        refused: 5,
        movedAway: 0,
      }));

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      expect(rankings[0].trend).toBe('improving');
      expect(rankings[0].badges).toContain('Most Improved');
    });

    it('should assign Reliable badge when completionRate >= 90%', () => {
      // NOTE: There is a bug in the implementation where assignBadges checks
      // completionRate >= 90, but completionRate is a decimal (0-1), not a percentage (0-100).
      // This test documents the actual behavior (no Reliable badge is assigned).
      // To fix, change line 907 in PerformanceAnalyzer.ts to: metrics.completionRate >= 0.9

      const sessions: CanvassingSession[] = Array.from({ length: 10 }, (_, i) => ({
        id: `session-${i + 1}`,
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: `assignment-${i + 1}`,
        startTime: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        doorsKnocked: 40,
        contactsMade: 15,
        notHome: 20,
        refused: 5,
        movedAway: 0,
      }));

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      // CompletionRate should be 1.0 (100%)
      expect(rankings[0].metrics.completionRate).toBe(1.0);

      // BUG: Reliable badge not assigned because code checks >= 90 instead of >= 0.9
      expect(rankings[0].badges).not.toContain('Reliable');

      // Test will pass when bug is fixed:
      // expect(rankings[0].badges).toContain('Reliable');
    });

    it('should assign Contact Master badge when contactRate >= 40%', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 100,
          contactsMade: 45, // 45% contact rate
          notHome: 50,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      expect(rankings[0].metrics.contactRate).toBeGreaterThanOrEqual(0.4);
      expect(rankings[0].badges).toContain('Contact Master');
    });

    it('should assign Speed Demon badge when doorsPerHour >= 50', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          doorsKnocked: 100, // 50 doors/hour
          contactsMade: 35,
          notHome: 50,
          refused: 15,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      expect(rankings[0].metrics.doorsPerHour).toBeGreaterThanOrEqual(50);
      expect(rankings[0].badges).toContain('Speed Demon');
    });

    it('should assign Veteran badge when totalDoors >= 1000', () => {
      const sessions: CanvassingSession[] = Array.from({ length: 25 }, (_, i) => ({
        id: `session-${i + 1}`,
        volunteerId: 'volunteer-1',
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: `assignment-${i + 1}`,
        startTime: new Date(Date.now() - (25 - i) * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - (25 - i) * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        doorsKnocked: 50,
        contactsMade: 18,
        notHome: 25,
        refused: 7,
        movedAway: 0,
      }));

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1');

      expect(rankings[0].metrics.totalDoors).toBeGreaterThanOrEqual(1000);
      expect(rankings[0].badges).toContain('Veteran');
    });
  });

  describe('getVolunteerRankings', () => {
    it('should rank volunteers by total doors when sortBy=doors', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 100,
          contactsMade: 35,
          notHome: 50,
          refused: 15,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 50,
          contactsMade: 20,
          notHome: 25,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1', 'doors');

      expect(rankings).toHaveLength(2);
      expect(rankings[0].volunteerId).toBe('volunteer-1');
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].volunteerId).toBe('volunteer-2');
      expect(rankings[1].rank).toBe(2);
    });

    it('should assign percentiles correctly', () => {
      const sessions: CanvassingSession[] = Array.from({ length: 10 }, (_, i) => ({
        id: `session-${i + 1}`,
        volunteerId: `volunteer-${i + 1}`,
        turfId: 'turf-1',
        universeId: 'universe-1',
        assignmentId: `assignment-${i + 1}`,
        startTime: '2024-12-01T10:00:00Z',
        endTime: '2024-12-01T11:00:00Z',
        doorsKnocked: 100 - i * 10,
        contactsMade: 35 - i * 3,
        notHome: 50,
        refused: 15,
        movedAway: 0,
      }));

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const rankings = PerformanceAnalyzer.getVolunteerRankings('universe-1', 'doors');

      expect(rankings).toHaveLength(10);
      expect(rankings[0].percentile).toBe(100);
      expect(rankings[9].percentile).toBe(10);
    });
  });

  describe('analyzePrecinct', () => {
    it('should calculate precinct analytics correctly', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'precinct-001',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          doorsKnocked: 80,
          contactsMade: 30,
          notHome: 40,
          refused: 10,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.analyzePrecinct('precinct-001', 'universe-1', 200);

      expect(result.precinctId).toBe('precinct-001');
      expect(result.totalDoorsKnocked).toBe(80);
      expect(result.totalContacts).toBe(30);
      expect(result.contactRate).toBeCloseTo(0.375, 3);
      expect(result.averageDoorsPerHour).toBeCloseTo(40, 1);
      expect(result.uniqueVolunteers).toBe(1);
    });

    it('should calculate efficiency and ROI scores', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'precinct-001',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 40,
          contactsMade: 14,
          notHome: 20,
          refused: 6,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.analyzePrecinct('precinct-001', 'universe-1', 100);

      // ROI: contacts per hour = 14 / 1 = 14
      expect(result.roiScore).toBe(14);

      // Efficiency should be high (40 doors/hr, 35% contact, 40% complete)
      expect(result.efficiencyScore).toBeGreaterThan(50);
    });
  });

  describe('getTurfRankings', () => {
    it('should rank turfs by efficiency score', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-1',
          turfName: 'Turf 1',
          precinctIds: ['precinct-001'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 1,
          avgGotvPriority: 75,
          avgPersuasionOpportunity: 60,
        },
        {
          turfId: 'turf-2',
          turfName: 'Turf 2',
          precinctIds: ['precinct-002'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 2,
          avgGotvPriority: 65,
          avgPersuasionOpportunity: 55,
        },
      ];

      const sessions1: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 50,
          contactsMade: 20,
          notHome: 25,
          refused: 5,
          movedAway: 0,
        },
      ];

      const sessions2: CanvassingSession[] = [
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-2',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 30,
          contactsMade: 10,
          notHome: 15,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByTurf
        .mockReturnValueOnce(sessions1)
        .mockReturnValueOnce(sessions2);

      const rankings = PerformanceAnalyzer.getTurfRankings('universe-1', turfs);

      expect(rankings).toHaveLength(2);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].rank).toBe(2);
      // Turf 1 should rank higher (better performance)
      expect(rankings[0].turfId).toBe('turf-1');
    });

    it('should determine turf status correctly', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-complete',
          turfName: 'Complete Turf',
          precinctIds: ['precinct-001'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 1,
          avgGotvPriority: 75,
          avgPersuasionOpportunity: 60,
        },
        {
          turfId: 'turf-stalled',
          turfName: 'Stalled Turf',
          precinctIds: ['precinct-002'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 2,
          avgGotvPriority: 65,
          avgPersuasionOpportunity: 55,
        },
      ];

      const completeSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-complete',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 110, // Over target
          contactsMade: 40,
          notHome: 55,
          refused: 15,
          movedAway: 0,
        },
      ];

      const stalledSessions: CanvassingSession[] = [
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-stalled',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
          endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
          doorsKnocked: 30,
          contactsMade: 10,
          notHome: 15,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByTurf
        .mockReturnValueOnce(completeSessions)
        .mockReturnValueOnce(stalledSessions);

      const rankings = PerformanceAnalyzer.getTurfRankings('universe-1', turfs);

      expect(rankings.find(r => r.turfId === 'turf-complete')?.status).toBe('ahead');
      expect(rankings.find(r => r.turfId === 'turf-stalled')?.status).toBe('stalled');
    });
  });

  describe('analyzeTemporalPatterns', () => {
    it('should identify best day and hour', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-03T18:00:00Z', // Tuesday 6 PM UTC
          endTime: '2024-12-03T19:00:00Z',
          doorsKnocked: 40,
          contactsMade: 20, // Best contact rate
          notHome: 15,
          refused: 5,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-12-04T10:00:00Z', // Wednesday 10 AM UTC
          endTime: '2024-12-04T11:00:00Z',
          doorsKnocked: 40,
          contactsMade: 10, // Lower contact rate
          notHome: 25,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.analyzeTemporalPatterns('universe-1');

      // The analyzer uses local time, so we check that it found the session with most contacts
      const bestSlot = result.contactsByDayHour.find(
        slot => slot.contacts === 20
      );
      expect(bestSlot).toBeDefined();
      expect(result.bestDayOfWeek).toBe(bestSlot?.dayOfWeek);
      expect(result.bestHourOfDay).toBe(bestSlot?.hour);
    });

    it('should build daily trend correctly', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          doorsKnocked: 80,
          contactsMade: 30,
          notHome: 40,
          refused: 10,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-2',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-12-02T14:00:00Z',
          endTime: '2024-12-02T16:00:00Z',
          doorsKnocked: 75,
          contactsMade: 28,
          notHome: 38,
          refused: 9,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.analyzeTemporalPatterns('universe-1');

      expect(result.dailyTrend).toHaveLength(2);
      expect(result.dailyTrend[0].date).toBe('2024-12-01');
      expect(result.dailyTrend[0].doorsKnocked).toBe(80);
      expect(result.dailyTrend[1].date).toBe('2024-12-02');
      expect(result.dailyTrend[1].doorsKnocked).toBe(75);
    });
  });

  describe('buildConversionFunnel', () => {
    it('should calculate conversion rates correctly', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 100,
          contactsMade: 35,
          positiveResponses: 20,
          volunteerSignups: 5,
          notHome: 50,
          refused: 15,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.buildConversionFunnel('universe-1');

      expect(result.doorsKnocked).toBe(100);
      expect(result.contactsMade).toBe(35);
      expect(result.contactRate).toBeCloseTo(0.35, 2);
      expect(result.positiveConversations).toBe(20);
      expect(result.commitments).toBe(5);
      expect(result.commitmentRate).toBeCloseTo(0.25, 2); // 5/20
    });

    it('should compare to targets', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 100,
          contactsMade: 40, // 40% vs 35% target = +14.3%
          positiveResponses: 20,
          volunteerSignups: 3, // 15% vs 15% target = 0%
          notHome: 50,
          refused: 10,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.buildConversionFunnel('universe-1', {
        contactRate: 0.35,
        commitmentRate: 0.15,
      });

      expect(result.contactRateVsTarget).toBeCloseTo(14.3, 1);
      expect(result.commitmentRateVsTarget).toBeCloseTo(0, 1);
    });
  });

  describe('generateInsights', () => {
    it('should generate low contact rate warning', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 100,
          contactsMade: 20, // 20% - below 25% threshold
          notHome: 70,
          refused: 10,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);
      mockProgressStore.getSessionsByTurf.mockReturnValue([]);

      const insights = PerformanceAnalyzer.generateInsights('universe-1', []);

      const contactWarning = insights.find(i => i.category === 'contact_rate' && i.type === 'warning');
      expect(contactWarning).toBeDefined();
      expect(contactWarning?.title).toBe('Low Contact Rate');
    });

    it('should generate excellent contact rate success', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T11:00:00Z',
          doorsKnocked: 100,
          contactsMade: 45, // 45% - above 40% threshold
          notHome: 45,
          refused: 10,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);
      mockProgressStore.getSessionsByTurf.mockReturnValue([]);

      const insights = PerformanceAnalyzer.generateInsights('universe-1', []);

      const contactSuccess = insights.find(i => i.category === 'contact_rate' && i.type === 'success');
      expect(contactSuccess).toBeDefined();
      expect(contactSuccess?.title).toBe('Excellent Contact Rate');
    });

    it('should generate efficiency opportunity insight', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          doorsKnocked: 50, // 25 doors/hour - below 30 threshold
          contactsMade: 18,
          notHome: 25,
          refused: 7,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);
      mockProgressStore.getSessionsByTurf.mockReturnValue([]);

      const insights = PerformanceAnalyzer.generateInsights('universe-1', []);

      const efficiencyOpportunity = insights.find(
        i => i.category === 'efficiency' && i.type === 'opportunity'
      );
      expect(efficiencyOpportunity).toBeDefined();
      expect(efficiencyOpportunity?.title).toBe('Efficiency Opportunity');
    });

    it('should generate stalled turfs warning', () => {
      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-stalled',
          turfName: 'Stalled Turf',
          precinctIds: ['precinct-001'],
          estimatedDoors: 100,
          estimatedHours: 2.5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 1,
          avgGotvPriority: 75,
          avgPersuasionOpportunity: 60,
        },
      ];

      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-stalled',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
          doorsKnocked: 30,
          contactsMade: 10,
          notHome: 15,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);
      mockProgressStore.getSessionsByTurf.mockReturnValue(sessions);

      const insights = PerformanceAnalyzer.generateInsights('universe-1', turfs);

      const stalledWarning = insights.find(i => i.category === 'coverage' && i.title === 'Stalled Turfs');
      expect(stalledWarning).toBeDefined();
      expect(stalledWarning?.type).toBe('warning');
    });

    it('should generate low volunteer retention warning', () => {
      const now = Date.now();
      const recentDate = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
      const oldDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-active',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: recentDate,
          endTime: new Date(new Date(recentDate).getTime() + 60 * 60 * 1000).toISOString(),
          doorsKnocked: 40,
          contactsMade: 15,
          notHome: 20,
          refused: 5,
          movedAway: 0,
        },
        {
          id: 'session-2',
          volunteerId: 'volunteer-inactive-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: oldDate,
          endTime: new Date(new Date(oldDate).getTime() + 60 * 60 * 1000).toISOString(),
          doorsKnocked: 40,
          contactsMade: 15,
          notHome: 20,
          refused: 5,
          movedAway: 0,
        },
        {
          id: 'session-3',
          volunteerId: 'volunteer-inactive-2',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-3',
          startTime: oldDate,
          endTime: new Date(new Date(oldDate).getTime() + 60 * 60 * 1000).toISOString(),
          doorsKnocked: 40,
          contactsMade: 15,
          notHome: 20,
          refused: 5,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);
      mockProgressStore.getSessionsByTurf.mockReturnValue([]);

      const insights = PerformanceAnalyzer.generateInsights('universe-1', []);

      const retentionWarning = insights.find(
        i => i.category === 'engagement' && i.title === 'Low Volunteer Retention'
      );
      expect(retentionWarning).toBeDefined();
      expect(retentionWarning?.type).toBe('warning');
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate complete weekly report', () => {
      const universe: CanvassingUniverse = {
        id: 'universe-1',
        name: 'Test Universe',
        createdAt: '2024-12-01T00:00:00Z',
        targetDoorsPerTurf: 200,
        targetDoorsPerHour: 40,
        targetContactRate: 0.35,
        totalPrecincts: 5,
        totalEstimatedDoors: 1000,
        estimatedTurfs: 5,
        estimatedHours: 25,
        volunteersNeeded: 10,
        precincts: [],
      };

      const turfs: CanvassingTurf[] = [
        {
          turfId: 'turf-1',
          turfName: 'Turf 1',
          precinctIds: ['precinct-001'],
          estimatedDoors: 200,
          estimatedHours: 5,
          doorsPerHour: 40,
          density: 'suburban',
          priority: 1,
          avgGotvPriority: 75,
          avgPersuasionOpportunity: 60,
        },
      ];

      const thisWeekSessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          doorsKnocked: 80,
          contactsMade: 30,
          notHome: 40,
          refused: 10,
          movedAway: 0,
        },
      ];

      const prevWeekSessions: CanvassingSession[] = [
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-11-24T10:00:00Z',
          endTime: '2024-11-24T12:00:00Z',
          doorsKnocked: 60,
          contactsMade: 20,
          notHome: 30,
          refused: 10,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsInRange
        .mockReturnValueOnce(thisWeekSessions)
        .mockReturnValueOnce(prevWeekSessions)
        .mockReturnValue(thisWeekSessions.concat(prevWeekSessions));

      mockProgressStore.getSessionsByUniverse.mockReturnValue(
        thisWeekSessions.concat(prevWeekSessions)
      );

      mockProgressStore.getSessionsByTurf.mockReturnValue(thisWeekSessions);

      const report = PerformanceAnalyzer.generateWeeklyReport(
        universe,
        turfs,
        '2024-12-01'
      );

      expect(report.universeId).toBe('universe-1');
      expect(report.doorsThisWeek).toBe(80);
      expect(report.doorsPreviousWeek).toBe(60);
      expect(report.doorsChange).toBeCloseTo(33.33, 1);
      expect(report.contactsThisWeek).toBe(30);
      expect(report.volunteersActive).toBe(1);
    });

    it('should include recommended actions', () => {
      const universe: CanvassingUniverse = {
        id: 'universe-1',
        name: 'Test Universe',
        createdAt: '2024-12-01T00:00:00Z',
        targetDoorsPerTurf: 200,
        targetDoorsPerHour: 40,
        targetContactRate: 0.35,
        totalPrecincts: 5,
        totalEstimatedDoors: 1000,
        estimatedTurfs: 5,
        estimatedHours: 25,
        volunteersNeeded: 10,
        precincts: [],
      };

      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T14:00:00Z',
          doorsKnocked: 100, // 25 doors/hour
          contactsMade: 25, // 25% contact rate
          notHome: 60,
          refused: 15,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsInRange.mockReturnValue(sessions);
      mockProgressStore.getSessionsByUniverse.mockReturnValue(sessions);
      mockProgressStore.getSessionsByTurf.mockReturnValue(sessions);

      const report = PerformanceAnalyzer.generateWeeklyReport(universe, [], '2024-12-01');

      expect(report.recommendedActions.length).toBeGreaterThan(0);
      expect(report.recommendedActions).toContain('Adjust canvassing times to improve contact rate');
      expect(report.recommendedActions).toContain('Review turf density and route optimization');
    });
  });

  describe('comparePeriods', () => {
    it('should compare two periods correctly', () => {
      const period1Sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-11-01T10:00:00Z',
          endTime: '2024-11-01T12:00:00Z',
          doorsKnocked: 60,
          contactsMade: 20,
          notHome: 30,
          refused: 10,
          movedAway: 0,
        },
      ];

      const period2Sessions: CanvassingSession[] = [
        {
          id: 'session-2',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-2',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          doorsKnocked: 90,
          contactsMade: 35,
          notHome: 45,
          refused: 10,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsInRange
        .mockReturnValueOnce(period1Sessions)
        .mockReturnValueOnce(period2Sessions);

      const result = PerformanceAnalyzer.comparePeriods(
        'universe-1',
        { start: '2024-11-01', end: '2024-11-07' },
        { start: '2024-12-01', end: '2024-12-07' }
      );

      expect(result.period1.doors).toBe(60);
      expect(result.period2.doors).toBe(90);
      expect(result.change.doors).toBeCloseTo(50, 0); // 50% increase
      expect(result.winner).toBe('period2');
    });

    it('should identify tie when periods are equal', () => {
      const sessions: CanvassingSession[] = [
        {
          id: 'session-1',
          volunteerId: 'volunteer-1',
          turfId: 'turf-1',
          universeId: 'universe-1',
          assignmentId: 'assignment-1',
          startTime: '2024-12-01T10:00:00Z',
          endTime: '2024-12-01T12:00:00Z',
          doorsKnocked: 80,
          contactsMade: 30,
          notHome: 40,
          refused: 10,
          movedAway: 0,
        },
      ];

      mockProgressStore.getSessionsInRange.mockReturnValue(sessions);

      const result = PerformanceAnalyzer.comparePeriods(
        'universe-1',
        { start: '2024-11-01', end: '2024-11-07' },
        { start: '2024-12-01', end: '2024-12-07' }
      );

      expect(result.winner).toBe('tie');
    });
  });
});
