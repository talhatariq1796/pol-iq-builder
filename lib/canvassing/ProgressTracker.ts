/**
 * Progress Tracker
 *
 * Tracks canvassing progress at session, turf, and universe levels.
 * Provides real-time metrics, session logging, and stalled turf detection.
 */

import type {
  CanvassingSession,
  TurfProgress,
  UniverseProgress,
  ProgressLogInput,
  StalledTurfAlert,
  DailyProgressSummary
} from './types-progress';
import type { CanvassingTurf, CanvassingUniverse } from './types';
import { ProgressStore } from './ProgressStore';

export class ProgressTracker {
  /**
   * Start a new canvassing session
   */
  static startSession(
    volunteerId: string,
    turfId: string,
    universeId: string,
    assignmentId: string
  ): CanvassingSession {
    const session: CanvassingSession = {
      id: this.generateSessionId(),
      volunteerId,
      turfId,
      universeId,
      assignmentId,
      startTime: new Date().toISOString(),
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
    };

    ProgressStore.saveSession(session);
    return session;
  }

  /**
   * End an active session with final metrics
   */
  static endSession(
    sessionId: string,
    results: {
      doorsKnocked: number;
      contactsMade: number;
      notHome?: number;
      refused?: number;
      positiveResponses?: number;
      negativeResponses?: number;
      undecided?: number;
      notes?: string;
    }
  ): CanvassingSession {
    const session = ProgressStore.getSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updated: CanvassingSession = {
      ...session,
      endTime: new Date().toISOString(),
      doorsKnocked: results.doorsKnocked,
      contactsMade: results.contactsMade,
      notHome: results.notHome ?? 0,
      refused: results.refused ?? 0,
      positiveResponses: results.positiveResponses ?? 0,
      negativeResponses: results.negativeResponses ?? 0,
      undecided: results.undecided ?? 0,
      notes: results.notes ?? session.notes,
    };

    ProgressStore.saveSession(updated);

    // Invalidate turf progress cache
    ProgressStore.invalidateProgressCache(session.turfId);

    return updated;
  }

  /**
   * Log progress (can be used mid-session or as batch entry)
   */
  static logProgress(input: ProgressLogInput): CanvassingSession {
    // If sessionId provided, update existing session
    if (input.sessionId) {
      const session = ProgressStore.getSession(input.sessionId);
      if (!session) {
        throw new Error(`Session ${input.sessionId} not found`);
      }

      const updated: CanvassingSession = {
        ...session,
        doorsKnocked: input.doorsKnocked ?? session.doorsKnocked,
        contactsMade: input.contactsMade ?? session.contactsMade,
        notHome: input.notHome ?? session.notHome,
        refused: input.refused ?? session.refused,
        notes: input.notes ?? session.notes,
      };

      ProgressStore.saveSession(updated);
      ProgressStore.invalidateProgressCache(session.turfId);
      return updated;
    }

    // Create new completed session from batch entry
    const session: CanvassingSession = {
      id: this.generateSessionId(),
      volunteerId: input.volunteerId,
      turfId: input.turfId,
      universeId: input.universeId,
      assignmentId: '',
      startTime: input.startTime || new Date().toISOString(),
      endTime: input.endTime || new Date().toISOString(),
      pausedMinutes: 0,
      doorsKnocked: input.doorsKnocked || 0,
      contactsMade: input.contactsMade || 0,
      notHome: input.notHome || 0,
      refused: input.refused || 0,
      movedAway: 0,
      notes: input.notes || '',
    };

    ProgressStore.saveSession(session);
    ProgressStore.invalidateProgressCache(input.turfId);
    return session;
  }

  /**
   * Get progress for a specific turf
   */
  static getTurfProgress(turfId: string, targetDoors: number, turfName?: string, universeId?: string): TurfProgress {
    // Check cache first
    const cached = ProgressStore.getCachedTurfProgress(turfId);
    if (cached) {
      return cached;
    }

    const sessions = ProgressStore.getSessionsByTurf(turfId);
    const aggregated = this.aggregateSessions(sessions);

    const percentComplete = targetDoors > 0
      ? Math.min(100, (aggregated.totalDoors / targetDoors) * 100)
      : 0;

    const contactRate = aggregated.totalDoors > 0
      ? (aggregated.totalContacts / aggregated.totalDoors) * 100
      : 0;

    const doorsPerHour = aggregated.totalHours > 0
      ? aggregated.totalDoors / aggregated.totalHours
      : 0;

    // Find last activity
    const lastSession = sessions.sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )[0];

    const lastActivityDate = lastSession?.startTime;

    const progress: TurfProgress = {
      turfId,
      turfName: turfName || turfId,
      universeId: universeId || sessions[0]?.universeId || '',
      targetDoors,
      doorsKnocked: aggregated.totalDoors,
      doorsRemaining: Math.max(0, targetDoors - aggregated.totalDoors),
      percentComplete: Math.round(percentComplete * 10) / 10,
      totalContacts: aggregated.totalContacts,
      contactRate: Math.round(contactRate * 10) / 10,
      notHomeCount: aggregated.totalNotHome,
      refusedCount: aggregated.totalRefused,
      totalHoursSpent: Math.round(aggregated.totalHours * 10) / 10,
      doorsPerHour: Math.round(doorsPerHour * 10) / 10,
      totalSessions: sessions.length,
      uniqueVolunteers: new Set(sessions.map(s => s.volunteerId)).size,
      lastActivityDate,
      status: this.determineTurfStatus(percentComplete, lastActivityDate),
    };

    // Cache the result
    ProgressStore.cacheTurfProgress(progress);

    return progress;
  }

  /**
   * Get progress for an entire universe
   */
  static getUniverseProgress(universe: CanvassingUniverse, turfs: CanvassingTurf[]): UniverseProgress {
    const sessions = ProgressStore.getSessionsByUniverse(universe.id);
    const aggregated = this.aggregateSessions(sessions);

    const totalTargetDoors = universe.totalEstimatedDoors;
    const percentComplete = totalTargetDoors > 0
      ? Math.min(100, (aggregated.totalDoors / totalTargetDoors) * 100)
      : 0;

    const contactRate = aggregated.totalDoors > 0
      ? (aggregated.totalContacts / aggregated.totalDoors) * 100
      : 0;

    const avgDoorsPerHour = aggregated.totalHours > 0
      ? aggregated.totalDoors / aggregated.totalHours
      : 0;

    // Calculate turf-level stats
    let turfsComplete = 0;
    let turfsInProgress = 0;
    let turfsStalled = 0;
    let turfsNotStarted = 0;

    for (const turf of turfs) {
      const progress = this.getTurfProgress(turf.turfId, turf.estimatedDoors, turf.turfName, universe.id);
      switch (progress.status) {
        case 'complete':
          turfsComplete++;
          break;
        case 'in_progress':
          turfsInProgress++;
          break;
        case 'stalled':
          turfsStalled++;
          break;
        case 'not_started':
          turfsNotStarted++;
          break;
      }
    }

    // Calculate active volunteers (active in last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentSessions = sessions.filter(s => new Date(s.startTime).getTime() >= sevenDaysAgo);
    const activeVolunteers = new Set(recentSessions.map(s => s.volunteerId)).size;

    // Calculate projected completion
    const doorsRemaining = totalTargetDoors - aggregated.totalDoors;
    const projected = this.calculateProjectedCompletion(sessions, doorsRemaining);

    return {
      universeId: universe.id,
      universeName: universe.name,
      totalTargetDoors,
      totalDoorsKnocked: aggregated.totalDoors,
      totalDoorsRemaining: Math.max(0, doorsRemaining),
      overallPercentComplete: Math.round(percentComplete * 10) / 10,
      totalContacts: aggregated.totalContacts,
      overallContactRate: Math.round(contactRate * 10) / 10,
      totalNotHome: aggregated.totalNotHome,
      totalRefused: aggregated.totalRefused,
      totalHoursSpent: Math.round(aggregated.totalHours * 10) / 10,
      averageDoorsPerHour: Math.round(avgDoorsPerHour * 10) / 10,
      turfsTotal: turfs.length,
      turfsComplete,
      turfsInProgress,
      turfsStalled,
      turfsNotStarted,
      totalSessions: sessions.length,
      uniqueVolunteers: new Set(sessions.map(s => s.volunteerId)).size,
      activeVolunteers,
      estimatedCompletionDate: projected.date,
      projectedTotalHours: projected.hours,
    };
  }

  /**
   * Get progress for a specific volunteer
   */
  static getVolunteerProgress(volunteerId: string, universeId?: string): {
    totalSessions: number;
    totalDoorsKnocked: number;
    totalContacts: number;
    totalHours: number;
    averageDoorsPerHour: number;
    averageContactRate: number;
  } {
    let sessions = ProgressStore.getSessionsByVolunteer(volunteerId);

    if (universeId) {
      sessions = sessions.filter(s => s.universeId === universeId);
    }

    const aggregated = this.aggregateSessions(sessions);

    return {
      totalSessions: sessions.length,
      totalDoorsKnocked: aggregated.totalDoors,
      totalContacts: aggregated.totalContacts,
      totalHours: Math.round(aggregated.totalHours * 10) / 10,
      averageDoorsPerHour: aggregated.totalHours > 0
        ? Math.round((aggregated.totalDoors / aggregated.totalHours) * 10) / 10
        : 0,
      averageContactRate: aggregated.totalDoors > 0
        ? Math.round((aggregated.totalContacts / aggregated.totalDoors) * 100 * 10) / 10
        : 0,
    };
  }

  /**
   * Identify turfs with no activity in X hours
   */
  static identifyStalledTurfs(
    universeId: string,
    turfs: CanvassingTurf[],
    stalledThresholdHours: number = 48
  ): StalledTurfAlert[] {
    const alerts: StalledTurfAlert[] = [];
    const now = Date.now();
    const thresholdMs = stalledThresholdHours * 60 * 60 * 1000;

    for (const turf of turfs) {
      const progress = this.getTurfProgress(turf.turfId, turf.estimatedDoors, turf.turfName, universeId);

      // Skip completed turfs
      if (progress.percentComplete >= 100) {
        continue;
      }

      // Check if stalled
      if (progress.lastActivityDate) {
        const lastActivityMs = new Date(progress.lastActivityDate).getTime();
        const inactiveDuration = now - lastActivityMs;

        if (inactiveDuration > thresholdMs) {
          const daysInactive = Math.floor(inactiveDuration / (24 * 60 * 60 * 1000));
          alerts.push({
            turfId: turf.turfId,
            turfName: turf.turfName,
            universeId,
            lastActivityDate: progress.lastActivityDate,
            daysInactive,
            percentComplete: progress.percentComplete,
            doorsRemaining: turf.estimatedDoors - progress.doorsKnocked,
            assignedVolunteers: [], // TODO: Get from VolunteerManager
            suggestedAction: daysInactive > 7 ? 'reassign' : 'follow_up',
          });
        }
      } else if (progress.doorsKnocked === 0) {
        // Never started
        alerts.push({
          turfId: turf.turfId,
          turfName: turf.turfName,
          universeId,
          lastActivityDate: new Date(0).toISOString(), // Epoch
          daysInactive: 999,
          percentComplete: 0,
          doorsRemaining: turf.estimatedDoors,
          assignedVolunteers: [],
          suggestedAction: 'reassign',
        });
      }
    }

    return alerts.sort((a, b) => b.daysInactive - a.daysInactive);
  }

  /**
   * Calculate contact rate for a set of sessions
   */
  static calculateContactRate(sessions: CanvassingSession[]): number {
    const aggregated = this.aggregateSessions(sessions);
    return aggregated.totalDoors > 0
      ? (aggregated.totalContacts / aggregated.totalDoors) * 100
      : 0;
  }

  /**
   * Calculate doors per hour from sessions
   */
  static calculateDoorsPerHour(sessions: CanvassingSession[]): number {
    const aggregated = this.aggregateSessions(sessions);
    return aggregated.totalHours > 0
      ? aggregated.totalDoors / aggregated.totalHours
      : 0;
  }

  /**
   * Generate a summary of progress for display
   */
  static generateProgressSummary(universeId: string, turfs: CanvassingTurf[]): {
    overview: UniverseProgress;
    dailyTrend: DailyProgressSummary[];
    stalledTurfs: StalledTurfAlert[];
    topPerformingTurfs: TurfProgress[];
  } {
    // Get universe data (we need to construct it from turfs)
    const universe: CanvassingUniverse = {
      id: universeId,
      name: '',
      createdAt: new Date().toISOString(),
      targetDoorsPerTurf: 50,
      targetDoorsPerHour: 40,
      targetContactRate: 0.35,
      totalPrecincts: 0,
      totalEstimatedDoors: turfs.reduce((sum, t) => sum + t.estimatedDoors, 0),
      estimatedTurfs: turfs.length,
      estimatedHours: turfs.reduce((sum, t) => sum + t.estimatedHours, 0),
      volunteersNeeded: 0,
      precincts: [],
    };

    const overview = this.getUniverseProgress(universe, turfs);

    // Get last 14 days of daily data
    const dailyTrend = this.getDailyTrend(universeId, 14);

    // Identify stalled turfs
    const stalledTurfs = this.identifyStalledTurfs(universeId, turfs);

    // Get top performing turfs (by completion %)
    const topPerformingTurfs = turfs
      .map(turf => this.getTurfProgress(turf.turfId, turf.estimatedDoors, turf.turfName, universeId))
      .filter(p => p.percentComplete > 0)
      .sort((a, b) => b.percentComplete - a.percentComplete)
      .slice(0, 5);

    return {
      overview,
      dailyTrend,
      stalledTurfs,
      topPerformingTurfs,
    };
  }

  // Private helper methods

  /**
   * Generate a unique session ID
   */
  private static generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate session duration in hours
   */
  private static calculateSessionDuration(session: CanvassingSession): number {
    if (!session.endTime) {
      return 0; // Active session
    }

    const start = new Date(session.startTime).getTime();
    const end = new Date(session.endTime).getTime();
    const pausedMs = (session.pausedMinutes || 0) * 60 * 1000;
    const durationMs = end - start - pausedMs;

    return Math.max(0, durationMs / (60 * 60 * 1000)); // Convert to hours
  }

  /**
   * Aggregate multiple sessions into totals
   */
  private static aggregateSessions(sessions: CanvassingSession[]): {
    totalDoors: number;
    totalContacts: number;
    totalHours: number;
    totalNotHome: number;
    totalRefused: number;
  } {
    return sessions.reduce(
      (acc, session) => ({
        totalDoors: acc.totalDoors + session.doorsKnocked,
        totalContacts: acc.totalContacts + session.contactsMade,
        totalHours: acc.totalHours + this.calculateSessionDuration(session),
        totalNotHome: acc.totalNotHome + session.notHome,
        totalRefused: acc.totalRefused + session.refused,
      }),
      { totalDoors: 0, totalContacts: 0, totalHours: 0, totalNotHome: 0, totalRefused: 0 }
    );
  }

  /**
   * Determine turf status based on completion and activity
   */
  private static determineTurfStatus(
    percentComplete: number,
    lastActivityDate?: string
  ): 'not_started' | 'in_progress' | 'stalled' | 'complete' {
    if (percentComplete >= 100) {
      return 'complete';
    }

    if (!lastActivityDate) {
      return 'not_started';
    }

    // Check if stalled (no activity in 48 hours)
    const hoursSinceActivity = (Date.now() - new Date(lastActivityDate).getTime()) / (60 * 60 * 1000);
    if (hoursSinceActivity > 48) {
      return 'stalled';
    }

    return 'in_progress';
  }

  /**
   * Calculate projected completion date
   */
  private static calculateProjectedCompletion(sessions: CanvassingSession[], doorsRemaining: number): {
    date?: string;
    hours?: number;
  } {
    if (sessions.length === 0 || doorsRemaining <= 0) {
      return {};
    }

    // Get last 7 days of sessions
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentSessions = sessions.filter(s =>
      new Date(s.startTime).getTime() >= sevenDaysAgo
    );

    if (recentSessions.length === 0) {
      return {};
    }

    // Calculate daily average
    const aggregated = this.aggregateSessions(recentSessions);
    const dailyAverage = aggregated.totalDoors / 7;
    const avgDoorsPerHour = aggregated.totalHours > 0
      ? aggregated.totalDoors / aggregated.totalHours
      : 40;

    if (dailyAverage <= 0) {
      return {};
    }

    const daysRemaining = Math.ceil(doorsRemaining / dailyAverage);
    const hoursRemaining = Math.ceil(doorsRemaining / avgDoorsPerHour);

    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysRemaining);

    return {
      date: completionDate.toISOString().split('T')[0],
      hours: hoursRemaining,
    };
  }

  /**
   * Get daily trend data for the last N days
   */
  private static getDailyTrend(universeId: string, days: number): DailyProgressSummary[] {
    const trend: DailyProgressSummary[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const sessions = ProgressStore.getSessionsByDate(dateStr, universeId);
      const aggregated = this.aggregateSessions(sessions);

      trend.push({
        date: dateStr,
        universeId,
        doorsKnocked: aggregated.totalDoors,
        contactsMade: aggregated.totalContacts,
        hoursWorked: Math.round(aggregated.totalHours * 10) / 10,
        sessionsCount: sessions.length,
        volunteersActive: new Set(sessions.map(s => s.volunteerId)).size,
      });
    }

    return trend;
  }
}
