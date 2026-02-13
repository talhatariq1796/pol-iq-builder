/**
 * Progress Aggregator
 *
 * Aggregates progress data for real-time dashboards.
 * Provides operation overview, heatmaps, leaderboards, and trends.
 */

import type {
  CanvassingSession,
  DailyProgressSummary
} from './types-progress';
import type { LeaderboardEntry } from './types-analytics';
import type { CanvassingTurf } from './types';
import { ProgressStore } from './ProgressStore';
import { ProgressTracker } from './ProgressTracker';

export class ProgressAggregator {
  /**
   * Get high-level operation overview for dashboard
   */
  static getOperationOverview(universeId: string, turfs: CanvassingTurf[]): {
    totalDoors: number;
    doorsKnocked: number;
    doorsRemaining: number;
    percentComplete: number;
    totalContacts: number;
    contactRate: number;
    totalHours: number;
    volunteersActive: number;
    projectedCompletionDays: number | null;
  } {
    const sessions = ProgressStore.getSessionsByUniverse(universeId);

    const totalDoors = turfs.reduce((sum, t) => sum + t.estimatedDoors, 0);
    const doorsKnocked = sessions.reduce((sum, s) => sum + s.doorsKnocked, 0);
    const doorsRemaining = Math.max(0, totalDoors - doorsKnocked);
    const percentComplete = totalDoors > 0 ? Math.min(100, (doorsKnocked / totalDoors) * 100) : 0;

    const totalContacts = sessions.reduce((sum, s) => sum + s.contactsMade, 0);
    const contactRate = doorsKnocked > 0 ? (totalContacts / doorsKnocked) * 100 : 0;

    const totalHours = sessions.reduce((sum, s) => {
      if (!s.endTime) return sum;
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      const pausedMs = (s.pausedMinutes || 0) * 60 * 1000;
      const hours = (end - start - pausedMs) / (60 * 60 * 1000);
      return sum + Math.max(0, hours);
    }, 0);

    const volunteersActive = new Set(sessions.map(s => s.volunteerId)).size;

    const projectedCompletionDays = this.calculateProjectedCompletion(
      universeId,
      totalDoors,
      doorsKnocked,
      7
    ).daysRemaining;

    return {
      totalDoors,
      doorsKnocked,
      doorsRemaining,
      percentComplete: Math.round(percentComplete * 10) / 10,
      totalContacts,
      contactRate: Math.round(contactRate * 10) / 10,
      totalHours: Math.round(totalHours * 10) / 10,
      volunteersActive,
      projectedCompletionDays,
    };
  }

  /**
   * Get completion rates by precinct for heatmap
   */
  static getPrecinctHeatmap(universeId: string, turfs: CanvassingTurf[]): Array<{
    precinctId: string;
    precinctName: string;
    percentComplete: number;
    doorsKnocked: number;
    targetDoors: number;
    status: 'not_started' | 'in_progress' | 'stalled' | 'complete';
  }> {
    const heatmap: Array<{
      precinctId: string;
      precinctName: string;
      percentComplete: number;
      doorsKnocked: number;
      targetDoors: number;
      status: 'not_started' | 'in_progress' | 'stalled' | 'complete';
    }> = [];

    for (const turf of turfs) {
      const progress = ProgressTracker.getTurfProgress(turf.turfId, turf.estimatedDoors, turf.turfName, universeId);

      // For each precinct in the turf (simplified - treating turf as precinct for visualization)
      for (const precinctId of turf.precinctIds) {
        heatmap.push({
          precinctId,
          precinctName: `Precinct ${precinctId}`,
          percentComplete: progress.percentComplete,
          doorsKnocked: progress.doorsKnocked,
          targetDoors: turf.estimatedDoors,
          status: progress.status,
        });
      }
    }

    return heatmap;
  }

  /**
   * Get volunteer leaderboard
   */
  static getVolunteerLeaderboard(
    universeId: string,
    metric: 'doors' | 'contacts' | 'hours' | 'efficiency',
    limit: number = 10
  ): LeaderboardEntry[] {
    const sessions = ProgressStore.getSessionsByUniverse(universeId);

    // Group by volunteer
    const volunteerStats = new Map<string, {
      volunteerId: string;
      doors: number;
      contacts: number;
      hours: number;
      sessions: number;
    }>();

    for (const session of sessions) {
      const existing = volunteerStats.get(session.volunteerId) || {
        volunteerId: session.volunteerId,
        doors: 0,
        contacts: 0,
        hours: 0,
        sessions: 0,
      };

      let hours = 0;
      if (session.endTime) {
        const start = new Date(session.startTime).getTime();
        const end = new Date(session.endTime).getTime();
        const pausedMs = (session.pausedMinutes || 0) * 60 * 1000;
        hours = (end - start - pausedMs) / (60 * 60 * 1000);
      }

      existing.doors += session.doorsKnocked;
      existing.contacts += session.contactsMade;
      existing.hours += Math.max(0, hours);
      existing.sessions += 1;

      volunteerStats.set(session.volunteerId, existing);
    }

    // Convert to array and calculate metric
    const entries: Array<{ stats: typeof volunteerStats extends Map<string, infer V> ? V : never; value: number }> = [];

    volunteerStats.forEach((stats) => {
      let value = 0;
      switch (metric) {
        case 'doors':
          value = stats.doors;
          break;
        case 'contacts':
          value = stats.contacts;
          break;
        case 'hours':
          value = Math.round(stats.hours * 10) / 10;
          break;
        case 'efficiency':
          value = stats.hours > 0 ? Math.round((stats.doors / stats.hours) * 10) / 10 : 0;
          break;
      }
      entries.push({ stats, value });
    });

    // Sort by value (descending)
    entries.sort((a, b) => b.value - a.value);

    // Build leaderboard entries
    const leaderboard: LeaderboardEntry[] = entries.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      volunteerId: entry.stats.volunteerId,
      volunteerName: `Volunteer ${entry.stats.volunteerId.slice(0, 8)}`, // Use ID prefix as name
      metric,
      value: entry.value,
    }));

    return leaderboard;
  }

  /**
   * Get daily/weekly trend data
   */
  static getTrendData(
    universeId: string,
    granularity: 'daily' | 'weekly',
    periods: number = 14
  ): Array<{
    period: string;
    doorsKnocked: number;
    contacts: number;
    hours: number;
    volunteers: number;
    contactRate: number;
  }> {
    const trend: Array<{
      period: string;
      doorsKnocked: number;
      contacts: number;
      hours: number;
      volunteers: number;
      contactRate: number;
    }> = [];

    const now = new Date();

    if (granularity === 'daily') {
      for (let i = periods - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const sessions = ProgressStore.getSessionsByDate(dateStr, universeId);
        const stats = this.aggregateSessions(sessions);

        trend.push({
          period: dateStr,
          doorsKnocked: stats.doors,
          contacts: stats.contacts,
          hours: Math.round(stats.hours * 10) / 10,
          volunteers: stats.volunteers,
          contactRate: stats.doors > 0 ? Math.round((stats.contacts / stats.doors) * 100 * 10) / 10 : 0,
        });
      }
    } else {
      // Weekly
      for (let i = periods - 1; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const startStr = weekStart.toISOString().split('T')[0];
        const endStr = weekEnd.toISOString().split('T')[0];

        const sessions = ProgressStore.getSessionsInRange(startStr, endStr, universeId);
        const stats = this.aggregateSessions(sessions);

        trend.push({
          period: `Week of ${startStr}`,
          doorsKnocked: stats.doors,
          contacts: stats.contacts,
          hours: Math.round(stats.hours * 10) / 10,
          volunteers: stats.volunteers,
          contactRate: stats.doors > 0 ? Math.round((stats.contacts / stats.doors) * 100 * 10) / 10 : 0,
        });
      }
    }

    return trend;
  }

  /**
   * Get time-of-day heatmap for best canvassing times
   */
  static getTimeOfDayHeatmap(universeId: string): Array<{
    dayOfWeek: number;
    hour: number;
    sessionCount: number;
    avgContactRate: number;
    avgDoorsPerHour: number;
  }> {
    const sessions = ProgressStore.getSessionsByUniverse(universeId);

    // Group sessions by day-of-week and hour
    const slotData = new Map<string, {
      dayOfWeek: number;
      hour: number;
      sessions: CanvassingSession[];
    }>();

    for (const session of sessions) {
      const startDate = new Date(session.startTime);
      const dayOfWeek = startDate.getDay();
      const hour = startDate.getHours();
      const key = `${dayOfWeek}-${hour}`;

      const existing = slotData.get(key) || {
        dayOfWeek,
        hour,
        sessions: [],
      };
      existing.sessions.push(session);
      slotData.set(key, existing);
    }

    // Convert to heatmap array
    const heatmap: Array<{
      dayOfWeek: number;
      hour: number;
      sessionCount: number;
      avgContactRate: number;
      avgDoorsPerHour: number;
    }> = [];

    slotData.forEach((data) => {
      const stats = this.aggregateSessions(data.sessions);
      const contactRate = stats.doors > 0 ? (stats.contacts / stats.doors) * 100 : 0;
      const doorsPerHour = stats.hours > 0 ? stats.doors / stats.hours : 0;

      heatmap.push({
        dayOfWeek: data.dayOfWeek,
        hour: data.hour,
        sessionCount: data.sessions.length,
        avgContactRate: Math.round(contactRate * 10) / 10,
        avgDoorsPerHour: Math.round(doorsPerHour * 10) / 10,
      });
    });

    // Sort by day then hour
    heatmap.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.hour - b.hour;
    });

    return heatmap;
  }

  /**
   * Get turfs needing attention (stalled or behind)
   */
  static getTurfsNeedingAttention(
    universeId: string,
    turfs: CanvassingTurf[]
  ): Array<{
    turfId: string;
    turfName: string;
    issue: 'stalled' | 'behind_schedule' | 'low_contact_rate' | 'unassigned';
    details: string;
    suggestedAction: string;
  }> {
    const issues: Array<{
      turfId: string;
      turfName: string;
      issue: 'stalled' | 'behind_schedule' | 'low_contact_rate' | 'unassigned';
      details: string;
      suggestedAction: string;
    }> = [];

    for (const turf of turfs) {
      const progress = ProgressTracker.getTurfProgress(turf.turfId, turf.estimatedDoors, turf.turfName, universeId);

      // Check for stalled
      if (progress.status === 'stalled') {
        issues.push({
          turfId: turf.turfId,
          turfName: turf.turfName,
          issue: 'stalled',
          details: `No activity for ${progress.daysInactive || 'several'} days. ${progress.percentComplete.toFixed(1)}% complete.`,
          suggestedAction: 'Follow up with assigned volunteers or reassign turf.',
        });
      }

      // Check for not started
      if (progress.status === 'not_started') {
        issues.push({
          turfId: turf.turfId,
          turfName: turf.turfName,
          issue: 'unassigned',
          details: `Turf has not been started. ${turf.estimatedDoors} doors waiting.`,
          suggestedAction: 'Assign volunteers to this turf.',
        });
      }

      // Check for low contact rate (only if enough data)
      if (progress.doorsKnocked > 20 && progress.contactRate < 20) {
        issues.push({
          turfId: turf.turfId,
          turfName: turf.turfName,
          issue: 'low_contact_rate',
          details: `Contact rate is ${progress.contactRate.toFixed(1)}% (target: 35%).`,
          suggestedAction: 'Review canvassing times or provide additional training.',
        });
      }
    }

    return issues;
  }

  /**
   * Get daily summary for a specific date
   */
  static getDailySummary(date: string, universeId: string): DailyProgressSummary {
    const sessions = ProgressStore.getSessionsByDate(date, universeId);
    const stats = this.aggregateSessions(sessions);

    return {
      date,
      universeId,
      doorsKnocked: stats.doors,
      contactsMade: stats.contacts,
      hoursWorked: Math.round(stats.hours * 10) / 10,
      sessionsCount: sessions.length,
      volunteersActive: stats.volunteers,
    };
  }

  /**
   * Compare current week vs previous week
   */
  static getWeekOverWeekComparison(universeId: string): {
    currentWeek: { doors: number; contacts: number; hours: number; volunteers: number };
    previousWeek: { doors: number; contacts: number; hours: number; volunteers: number };
    change: { doors: number; contacts: number; hours: number; volunteers: number };
  } {
    const now = new Date();

    // Current week (last 7 days)
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 6);
    const currentSessions = ProgressStore.getSessionsInRange(
      currentStart.toISOString().split('T')[0],
      now.toISOString().split('T')[0],
      universeId
    );
    const currentStats = this.aggregateSessions(currentSessions);

    // Previous week (7-14 days ago)
    const prevEnd = new Date(currentStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);
    const prevSessions = ProgressStore.getSessionsInRange(
      prevStart.toISOString().split('T')[0],
      prevEnd.toISOString().split('T')[0],
      universeId
    );
    const prevStats = this.aggregateSessions(prevSessions);

    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      currentWeek: {
        doors: currentStats.doors,
        contacts: currentStats.contacts,
        hours: Math.round(currentStats.hours * 10) / 10,
        volunteers: currentStats.volunteers,
      },
      previousWeek: {
        doors: prevStats.doors,
        contacts: prevStats.contacts,
        hours: Math.round(prevStats.hours * 10) / 10,
        volunteers: prevStats.volunteers,
      },
      change: {
        doors: calculateChange(currentStats.doors, prevStats.doors),
        contacts: calculateChange(currentStats.contacts, prevStats.contacts),
        hours: calculateChange(currentStats.hours, prevStats.hours),
        volunteers: calculateChange(currentStats.volunteers, prevStats.volunteers),
      },
    };
  }

  /**
   * Calculate projected completion date based on current pace
   */
  static calculateProjectedCompletion(
    universeId: string,
    totalDoors: number,
    doorsKnocked: number,
    lookbackDays: number = 7
  ): {
    projectedDate: string | null;
    daysRemaining: number | null;
    confidence: 'high' | 'medium' | 'low';
    basedOnDailyAverage: number;
  } {
    const doorsRemaining = totalDoors - doorsKnocked;

    if (doorsRemaining <= 0) {
      return {
        projectedDate: new Date().toISOString().split('T')[0],
        daysRemaining: 0,
        confidence: 'high',
        basedOnDailyAverage: 0,
      };
    }

    const sessions = this.getRecentSessions(universeId, lookbackDays);

    if (sessions.length === 0) {
      return {
        projectedDate: null,
        daysRemaining: null,
        confidence: 'low',
        basedOnDailyAverage: 0,
      };
    }

    const totalDoorsInPeriod = sessions.reduce((sum, s) => sum + s.doorsKnocked, 0);
    const dailyAverage = totalDoorsInPeriod / lookbackDays;

    if (dailyAverage <= 0) {
      return {
        projectedDate: null,
        daysRemaining: null,
        confidence: 'low',
        basedOnDailyAverage: 0,
      };
    }

    const daysRemaining = Math.ceil(doorsRemaining / dailyAverage);
    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + daysRemaining);

    // Calculate confidence based on data availability
    const daysWithSessions = new Set(
      sessions.map(s => new Date(s.startTime).toISOString().split('T')[0])
    ).size;

    let confidence: 'high' | 'medium' | 'low';
    if (daysWithSessions >= 7) {
      confidence = 'high';
    } else if (daysWithSessions >= 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      projectedDate: projectedDate.toISOString().split('T')[0],
      daysRemaining,
      confidence,
      basedOnDailyAverage: Math.round(dailyAverage * 10) / 10,
    };
  }

  // Private helpers

  private static getRecentSessions(universeId: string, days: number): CanvassingSession[] {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return ProgressStore.getSessionsInRange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      universeId
    );
  }

  private static aggregateSessions(sessions: CanvassingSession[]): {
    doors: number;
    contacts: number;
    hours: number;
    volunteers: number;
  } {
    const volunteerSet = new Set<string>();
    let doors = 0;
    let contacts = 0;
    let hours = 0;

    for (const session of sessions) {
      doors += session.doorsKnocked;
      contacts += session.contactsMade;
      volunteerSet.add(session.volunteerId);

      if (session.endTime) {
        const start = new Date(session.startTime).getTime();
        const end = new Date(session.endTime).getTime();
        const pausedMs = (session.pausedMinutes || 0) * 60 * 1000;
        const sessionHours = (end - start - pausedMs) / (60 * 60 * 1000);
        hours += Math.max(0, sessionHours);
      }
    }

    return {
      doors,
      contacts,
      hours,
      volunteers: volunteerSet.size,
    };
  }
}
