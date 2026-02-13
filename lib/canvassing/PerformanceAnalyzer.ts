/**
 * Performance Analyzer
 *
 * Analyzes canvassing performance at volunteer, turf, and operation levels.
 * Provides insights, rankings, and optimization recommendations.
 */

import type { CanvassingSession, TurfProgress, UniverseProgress } from './types-progress';
import type {
  VolunteerAnalytics,
  PrecinctAnalytics,
  TemporalAnalytics,
  ConversionFunnel,
  WeeklyReport,
  LeaderboardEntry,
} from './types-analytics';
import type { CanvassingTurf, CanvassingUniverse } from './types';
import { ProgressStore } from './ProgressStore';

export interface PerformanceInsight {
  type: 'success' | 'warning' | 'opportunity';
  category: 'efficiency' | 'contact_rate' | 'coverage' | 'engagement' | 'timing';
  title: string;
  description: string;
  metric?: { name: string; value: number; benchmark: number };
  recommendation?: string;
}

export interface VolunteerRanking {
  volunteerId: string;
  volunteerName: string;
  rank: number;
  percentile: number;
  metrics: {
    totalDoors: number;
    totalContacts: number;
    totalHours: number;
    doorsPerHour: number;
    contactRate: number;
    completionRate: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  badges: string[]; // e.g., "Top Performer", "Most Improved", "Reliable"
}

export interface TurfRanking {
  turfId: string;
  turfName: string;
  rank: number;
  score: number; // Composite efficiency score
  metrics: {
    percentComplete: number;
    contactRate: number;
    doorsPerHour: number;
    efficiency: number;
  };
  status: 'ahead' | 'on_track' | 'behind' | 'stalled';
}

export class PerformanceAnalyzer {
  /**
   * Analyze individual volunteer performance
   */
  static analyzeVolunteer(volunteerId: string, universeId?: string): VolunteerAnalytics {
    const sessions = universeId
      ? ProgressStore.getSessionsByVolunteer(volunteerId).filter(s => s.universeId === universeId)
      : ProgressStore.getSessionsByVolunteer(volunteerId);

    if (sessions.length === 0) {
      // Return empty analytics for volunteer with no sessions
      return {
        volunteerId,
        volunteerName: volunteerId,
        totalSessions: 0,
        totalHours: 0,
        totalDoorsKnocked: 0,
        totalContacts: 0,
        averageDoorsPerHour: 0,
        averageContactRate: 0,
        averageSessionLength: 0,
        completionRate: 0,
        onTimeRate: 100, // Assume on-time if no data
        noShowCount: 0,
        rankByDoors: 1,
        rankByEfficiency: 1,
        rankByReliability: 1,
        overallRank: 1,
        percentile: 100,
        performanceTrend: 'stable',
        hoursThisWeek: 0,
        hoursLastWeek: 0,
      };
    }

    // Calculate totals
    let totalDoors = 0;
    let totalContacts = 0;
    let totalMinutes = 0;
    let completedSessions = 0;

    for (const session of sessions) {
      totalDoors += session.doorsKnocked;
      totalContacts += session.contactsMade;

      if (session.endTime) {
        const start = new Date(session.startTime).getTime();
        const end = new Date(session.endTime).getTime();
        const minutes = (end - start) / (1000 * 60);
        totalMinutes += minutes - (session.pausedMinutes || 0);
        completedSessions++;
      }
    }

    const totalHours = totalMinutes / 60;
    const averageDoorsPerHour = totalHours > 0 ? totalDoors / totalHours : 0;
    const averageContactRate = totalDoors > 0 ? totalContacts / totalDoors : 0;
    const averageSessionLength = sessions.length > 0 ? totalHours / sessions.length : 0;
    const completionRate = sessions.length > 0 ? (completedSessions / sessions.length) * 100 : 100;

    // Calculate recent activity
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const sessionsThisWeek = sessions.filter(s => new Date(s.startTime).getTime() >= oneWeekAgo);
    const sessionsLastWeek = sessions.filter(
      s => new Date(s.startTime).getTime() >= twoWeeksAgo && new Date(s.startTime).getTime() < oneWeekAgo
    );

    const hoursThisWeek = this.calculateHoursFromSessions(sessionsThisWeek);
    const hoursLastWeek = this.calculateHoursFromSessions(sessionsLastWeek);

    // Determine trend
    const performanceTrend = this.determineTrend(sessions);

    // Rankings (would need all volunteers to calculate properly)
    // For now, return placeholder values
    const rankByDoors = 1;
    const rankByEfficiency = 1;
    const rankByReliability = 1;
    const overallRank = 1;
    const percentile = 100;

    return {
      volunteerId,
      volunteerName: volunteerId, // Would come from volunteer data
      totalSessions: sessions.length,
      totalHours,
      totalDoorsKnocked: totalDoors,
      totalContacts,
      averageDoorsPerHour,
      averageContactRate,
      averageSessionLength,
      completionRate,
      onTimeRate: 100, // Would require assignment data
      noShowCount: 0, // Would require assignment data
      rankByDoors,
      rankByEfficiency,
      rankByReliability,
      overallRank,
      percentile,
      performanceTrend,
      hoursThisWeek,
      hoursLastWeek,
    };
  }

  /**
   * Get volunteer rankings for a universe
   */
  static getVolunteerRankings(
    universeId: string,
    sortBy: 'doors' | 'contacts' | 'efficiency' | 'reliability' = 'efficiency'
  ): VolunteerRanking[] {
    const sessions = ProgressStore.getSessionsByUniverse(universeId);

    // Group by volunteer
    const volunteerMap = new Map<string, CanvassingSession[]>();
    for (const session of sessions) {
      const existing = volunteerMap.get(session.volunteerId) || [];
      existing.push(session);
      volunteerMap.set(session.volunteerId, existing);
    }

    // Calculate metrics for each volunteer
    const rankings: VolunteerRanking[] = [];

    for (const [volunteerId, volunteerSessions] of Array.from(volunteerMap.entries())) {
      const metrics = this.calculateVolunteerMetrics(volunteerSessions);
      const trend = this.determineTrend(volunteerSessions);
      const efficiencyScore = this.calculateEfficiencyScore(
        metrics.doorsPerHour,
        metrics.contactRate,
        metrics.completionRate
      );

      rankings.push({
        volunteerId,
        volunteerName: volunteerId,
        rank: 0, // Will be set after sorting
        percentile: 0, // Will be set after sorting
        metrics,
        trend,
        badges: [], // Will be assigned after ranking
      });
    }

    // Sort by requested metric
    rankings.sort((a, b) => {
      switch (sortBy) {
        case 'doors':
          return b.metrics.totalDoors - a.metrics.totalDoors;
        case 'contacts':
          return b.metrics.totalContacts - a.metrics.totalContacts;
        case 'reliability':
          return b.metrics.completionRate - a.metrics.completionRate;
        case 'efficiency':
        default: {
          const scoreA = this.calculateEfficiencyScore(
            a.metrics.doorsPerHour,
            a.metrics.contactRate,
            a.metrics.completionRate
          );
          const scoreB = this.calculateEfficiencyScore(
            b.metrics.doorsPerHour,
            b.metrics.contactRate,
            b.metrics.completionRate
          );
          return scoreB - scoreA;
        }
      }
    });

    // Assign ranks, percentiles, and badges
    const total = rankings.length;
    for (let i = 0; i < rankings.length; i++) {
      const ranking = rankings[i];
      ranking.rank = i + 1;
      ranking.percentile = ((total - i) / total) * 100;
      ranking.badges = this.assignBadges(ranking.metrics, ranking.rank, ranking.trend);
    }

    return rankings;
  }

  /**
   * Analyze precinct-level performance
   */
  static analyzePrecinct(
    precinctId: string,
    universeId: string,
    targetDoors: number
  ): PrecinctAnalytics {
    const sessions = ProgressStore.getSessionsByUniverse(universeId).filter(s =>
      s.turfId.includes(precinctId)
    );

    let totalDoors = 0;
    let totalContacts = 0;
    let totalHours = 0;
    const volunteerIds = new Set<string>();

    for (const session of sessions) {
      totalDoors += session.doorsKnocked;
      totalContacts += session.contactsMade;
      totalHours += this.calculateSessionHours(session);
      volunteerIds.add(session.volunteerId);
    }

    const contactRate = totalDoors > 0 ? totalContacts / totalDoors : 0;
    const averageDoorsPerHour = totalHours > 0 ? totalDoors / totalHours : 0;

    // Calculate efficiency score (0-100)
    const efficiencyScore = this.calculateEfficiencyScore(
      averageDoorsPerHour,
      contactRate,
      totalDoors / targetDoors
    );

    // ROI score (contacts per hour)
    const roiScore = totalHours > 0 ? totalContacts / totalHours : 0;

    // Targeting accuracy (compare to predicted contact rate of 35%)
    const predictedContactRate = 0.35;
    const actualContactRate = contactRate;
    const targetingAccuracy = Math.min(100, (actualContactRate / predictedContactRate) * 100);

    // Get universe-wide averages for comparison
    const allSessions = ProgressStore.getSessionsByUniverse(universeId);
    const universeAvg = this.calculateUniverseAverages(allSessions);

    const contactRateVsAvg = universeAvg.contactRate > 0
      ? ((contactRate - universeAvg.contactRate) / universeAvg.contactRate) * 100
      : 0;

    const doorsPerHourVsAvg = universeAvg.doorsPerHour > 0
      ? ((averageDoorsPerHour - universeAvg.doorsPerHour) / universeAvg.doorsPerHour) * 100
      : 0;

    return {
      precinctId,
      precinctName: precinctId,
      jurisdiction: 'Unknown',
      totalDoorsKnocked: totalDoors,
      totalContacts,
      contactRate,
      averageDoorsPerHour,
      totalHoursSpent: totalHours,
      efficiencyScore,
      roiScore,
      predictedContactRate,
      actualContactRate,
      targetingAccuracy,
      contactRateVsAvg,
      doorsPerHourVsAvg,
      uniqueVolunteers: volunteerIds.size,
      totalSessions: sessions.length,
    };
  }

  /**
   * Get turf rankings by efficiency
   */
  static getTurfRankings(universeId: string, turfs: CanvassingTurf[]): TurfRanking[] {
    const rankings: TurfRanking[] = turfs.map(turf => {
      const sessions = ProgressStore.getSessionsByTurf(turf.turfId);

      let totalDoors = 0;
      let totalContacts = 0;
      let totalHours = 0;

      for (const session of sessions) {
        totalDoors += session.doorsKnocked;
        totalContacts += session.contactsMade;
        totalHours += this.calculateSessionHours(session);
      }

      const percentComplete = (totalDoors / turf.estimatedDoors) * 100;
      const contactRate = totalDoors > 0 ? totalContacts / totalDoors : 0;
      const doorsPerHour = totalHours > 0 ? totalDoors / totalHours : 0;
      const efficiency = this.calculateEfficiencyScore(doorsPerHour, contactRate, percentComplete / 100);

      // Determine status
      let status: TurfRanking['status'];
      const lastActivity = sessions[0]?.startTime;
      const daysSinceActivity = lastActivity
        ? (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      if (percentComplete >= 100) {
        status = 'ahead';
      } else if (daysSinceActivity > 7) {
        status = 'stalled';
      } else if (percentComplete >= 50) {
        status = 'on_track';
      } else {
        status = 'behind';
      }

      return {
        turfId: turf.turfId,
        turfName: turf.turfName,
        rank: 0,
        score: efficiency,
        metrics: {
          percentComplete,
          contactRate,
          doorsPerHour,
          efficiency,
        },
        status,
      };
    });

    // Sort by score and assign ranks
    rankings.sort((a, b) => b.score - a.score);
    for (let i = 0; i < rankings.length; i++) {
      rankings[i].rank = i + 1;
    }

    return rankings;
  }

  /**
   * Analyze temporal patterns
   */
  static analyzeTemporalPatterns(universeId: string): TemporalAnalytics {
    const sessions = ProgressStore.getSessionsByUniverse(universeId);

    // Initialize contact counts by day/hour
    const contactsByDayHour: Array<{
      dayOfWeek: number;
      hour: number;
      contacts: number;
      doors: number;
      contactRate: number;
    }> = [];

    const dayHourMap = new Map<string, { contacts: number; doors: number }>();

    for (const session of sessions) {
      const date = new Date(session.startTime);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const key = `${dayOfWeek}-${hour}`;

      const existing = dayHourMap.get(key) || { contacts: 0, doors: 0 };
      existing.contacts += session.contactsMade;
      existing.doors += session.doorsKnocked;
      dayHourMap.set(key, existing);
    }

    // Convert to array format
    for (const [key, data] of Array.from(dayHourMap.entries())) {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      contactsByDayHour.push({
        dayOfWeek,
        hour,
        contacts: data.contacts,
        doors: data.doors,
        contactRate: data.doors > 0 ? data.contacts / data.doors : 0,
      });
    }

    // Find best day and hour
    const bestSlot = contactsByDayHour.reduce(
      (best, current) => (current.contacts > best.contacts ? current : best),
      { dayOfWeek: 0, hour: 18, contacts: 0, doors: 0, contactRate: 0 }
    );

    // Build daily trend
    const dailyMap = new Map<string, { doors: number; contacts: number; hours: number; volunteers: Set<string> }>();

    for (const session of sessions) {
      const date = new Date(session.startTime).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { doors: 0, contacts: 0, hours: 0, volunteers: new Set() };

      existing.doors += session.doorsKnocked;
      existing.contacts += session.contactsMade;
      existing.hours += this.calculateSessionHours(session);
      existing.volunteers.add(session.volunteerId);
      dailyMap.set(date, existing);
    }

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        doorsKnocked: data.doors,
        contacts: data.contacts,
        hours: data.hours,
        volunteers: data.volunteers.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build weekly summary
    const weeklySummary = this.buildWeeklySummary(sessions);

    return {
      universeId,
      bestDayOfWeek: bestSlot.dayOfWeek,
      bestHourOfDay: bestSlot.hour,
      contactsByDayHour,
      dailyTrend,
      weeklySummary,
    };
  }

  /**
   * Build conversion funnel
   */
  static buildConversionFunnel(
    universeId: string,
    targets?: { contactRate: number; commitmentRate: number }
  ): ConversionFunnel {
    const sessions = ProgressStore.getSessionsByUniverse(universeId);

    let totalDoors = 0;
    let doorsKnocked = 0;
    let contactsMade = 0;
    let positiveConversations = 0;
    let commitments = 0;

    for (const session of sessions) {
      doorsKnocked += session.doorsKnocked;
      contactsMade += session.contactsMade;
      positiveConversations += session.positiveResponses || 0;
      commitments += session.volunteerSignups || 0; // Using volunteer signups as commitments
    }

    // Total doors would come from universe data
    totalDoors = doorsKnocked; // Simplified for now

    const knockRate = totalDoors > 0 ? doorsKnocked / totalDoors : 0;
    const contactRate = doorsKnocked > 0 ? contactsMade / doorsKnocked : 0;
    const positiveRate = contactsMade > 0 ? positiveConversations / contactsMade : 0;
    const commitmentRate = positiveConversations > 0 ? commitments / positiveConversations : 0;
    const overallConversionRate = totalDoors > 0 ? commitments / totalDoors : 0;

    const targetContactRate = targets?.contactRate || 0.35;
    const targetCommitmentRate = targets?.commitmentRate || 0.15;

    const contactRateVsTarget = targetContactRate > 0
      ? ((contactRate - targetContactRate) / targetContactRate) * 100
      : 0;

    const commitmentRateVsTarget = targetCommitmentRate > 0
      ? ((commitmentRate - targetCommitmentRate) / targetCommitmentRate) * 100
      : 0;

    return {
      universeId,
      totalDoors,
      doorsKnocked,
      contactsMade,
      positiveConversations,
      commitments,
      knockRate,
      contactRate,
      positiveRate,
      commitmentRate,
      overallConversionRate,
      targetContactRate,
      targetCommitmentRate,
      contactRateVsTarget,
      commitmentRateVsTarget,
    };
  }

  /**
   * Generate performance insights
   */
  static generateInsights(universeId: string, turfs: CanvassingTurf[]): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];
    const sessions = ProgressStore.getSessionsByUniverse(universeId);

    if (sessions.length === 0) {
      return [];
    }

    const universeAvg = this.calculateUniverseAverages(sessions);

    // Contact rate insights
    if (universeAvg.contactRate < 0.25) {
      insights.push({
        type: 'warning',
        category: 'contact_rate',
        title: 'Low Contact Rate',
        description: `Overall contact rate is ${(universeAvg.contactRate * 100).toFixed(1)}%, below the benchmark of 35%.`,
        metric: { name: 'Contact Rate', value: universeAvg.contactRate * 100, benchmark: 35 },
        recommendation: 'Consider adjusting canvassing times to evenings (6-8 PM) or weekends when people are more likely to be home.',
      });
    } else if (universeAvg.contactRate >= 0.4) {
      insights.push({
        type: 'success',
        category: 'contact_rate',
        title: 'Excellent Contact Rate',
        description: `Contact rate of ${(universeAvg.contactRate * 100).toFixed(1)}% exceeds expectations!`,
        metric: { name: 'Contact Rate', value: universeAvg.contactRate * 100, benchmark: 35 },
      });
    }

    // Efficiency insights
    if (universeAvg.doorsPerHour < 30) {
      insights.push({
        type: 'opportunity',
        category: 'efficiency',
        title: 'Efficiency Opportunity',
        description: `Average pace of ${universeAvg.doorsPerHour.toFixed(1)} doors/hour is below target of 40.`,
        metric: { name: 'Doors per Hour', value: universeAvg.doorsPerHour, benchmark: 40 },
        recommendation: 'Review turf density and route optimization. Consider assigning volunteers to more compact turfs.',
      });
    } else if (universeAvg.doorsPerHour >= 50) {
      insights.push({
        type: 'success',
        category: 'efficiency',
        title: 'High Efficiency',
        description: `Team is moving at ${universeAvg.doorsPerHour.toFixed(1)} doors/hour - excellent pace!`,
        metric: { name: 'Doors per Hour', value: universeAvg.doorsPerHour, benchmark: 40 },
      });
    }

    // Stalled turfs
    const stalledTurfs = turfs.filter(turf => {
      const sessions = ProgressStore.getSessionsByTurf(turf.turfId);
      if (sessions.length === 0) return false;

      const lastActivity = sessions[0].startTime;
      const daysSince = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 7;
    });

    if (stalledTurfs.length > 0) {
      insights.push({
        type: 'warning',
        category: 'coverage',
        title: 'Stalled Turfs',
        description: `${stalledTurfs.length} turfs have had no activity in over a week.`,
        recommendation: 'Consider reassigning these turfs to active volunteers or scheduling follow-up shifts.',
      });
    }

    // Engagement insights
    const activeVolunteers = new Set(
      sessions
        .filter(s => Date.now() - new Date(s.startTime).getTime() < 7 * 24 * 60 * 60 * 1000)
        .map(s => s.volunteerId)
    ).size;

    const totalVolunteers = new Set(sessions.map(s => s.volunteerId)).size;

    if (activeVolunteers < totalVolunteers * 0.5) {
      insights.push({
        type: 'warning',
        category: 'engagement',
        title: 'Low Volunteer Retention',
        description: `Only ${activeVolunteers} of ${totalVolunteers} volunteers have been active in the past week.`,
        recommendation: 'Reach out to inactive volunteers to understand barriers and provide encouragement.',
      });
    }

    // Timing insights
    const temporal = this.analyzeTemporalPatterns(universeId);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    insights.push({
      type: 'opportunity',
      category: 'timing',
      title: 'Optimal Canvassing Time',
      description: `Best results on ${dayNames[temporal.bestDayOfWeek]} at ${temporal.bestHourOfDay}:00.`,
      recommendation: `Schedule more volunteers during this time window for maximum contact rates.`,
    });

    return insights;
  }

  /**
   * Generate weekly report
   */
  static generateWeeklyReport(
    universe: CanvassingUniverse,
    turfs: CanvassingTurf[],
    weekStart?: string
  ): WeeklyReport {
    const start = weekStart ? new Date(weekStart) : this.getStartOfWeek(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const weekStartStr = start.toISOString();
    const weekEndStr = end.toISOString();

    const sessionsThisWeek = ProgressStore.getSessionsInRange(weekStartStr, weekEndStr, universe.id);

    // Calculate previous week for comparison
    const prevWeekStart = new Date(start);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const sessionsPrevWeek = ProgressStore.getSessionsInRange(
      prevWeekStart.toISOString(),
      start.toISOString(),
      universe.id
    );

    // This week metrics
    const doorsThisWeek = sessionsThisWeek.reduce((sum, s) => sum + s.doorsKnocked, 0);
    const contactsThisWeek = sessionsThisWeek.reduce((sum, s) => sum + s.contactsMade, 0);
    const contactRate = doorsThisWeek > 0 ? contactsThisWeek / doorsThisWeek : 0;

    let hoursThisWeek = 0;
    for (const session of sessionsThisWeek) {
      hoursThisWeek += this.calculateSessionHours(session);
    }

    const averageDoorsPerHour = hoursThisWeek > 0 ? doorsThisWeek / hoursThisWeek : 0;

    // Previous week for comparison
    const doorsPreviousWeek = sessionsPrevWeek.reduce((sum, s) => sum + s.doorsKnocked, 0);
    const doorsChange = doorsPreviousWeek > 0
      ? ((doorsThisWeek - doorsPreviousWeek) / doorsPreviousWeek) * 100
      : 0;

    // Volunteer engagement
    const activeVolunteers = new Set(sessionsThisWeek.map(s => s.volunteerId));
    const previousVolunteers = new Set(sessionsPrevWeek.map(s => s.volunteerId));
    const newVolunteers = Array.from(activeVolunteers).filter(v => !previousVolunteers.has(v)).length;

    const allVolunteers = new Set(ProgressStore.getSessionsByUniverse(universe.id).map(s => s.volunteerId));
    const volunteersInactive = allVolunteers.size - activeVolunteers.size;

    // Top performers
    const topPerformers = this.getVolunteerRankings(universe.id, 'doors')
      .slice(0, 5)
      .map((v, i) => ({
        rank: i + 1,
        volunteerId: v.volunteerId,
        volunteerName: v.volunteerName,
        metric: 'doors' as const,
        value: v.metrics.totalDoors,
      }));

    // Top precincts (approximated from turfs)
    const turfPerformance = turfs.map(turf => {
      const sessions = ProgressStore.getSessionsByTurf(turf.turfId);
      let doors = 0;
      let contacts = 0;

      for (const session of sessions) {
        doors += session.doorsKnocked;
        contacts += session.contactsMade;
      }

      return {
        precinctId: turf.turfId,
        precinctName: turf.turfName,
        contactRate: doors > 0 ? contacts / doors : 0,
        doorsKnocked: doors,
      };
    });

    const topPrecincts = turfPerformance
      .sort((a, b) => b.contactRate - a.contactRate)
      .slice(0, 5);

    // Issues
    const stalledTurfs = this.getTurfRankings(universe.id, turfs).filter(
      t => t.status === 'stalled'
    ).length;

    const behindSchedulePercent = this.getTurfRankings(universe.id, turfs).filter(
      t => t.status === 'behind'
    ).length / turfs.length * 100;

    // Projections
    const allSessions = ProgressStore.getSessionsByUniverse(universe.id);
    const totalDoors = allSessions.reduce((sum, s) => sum + s.doorsKnocked, 0);
    const remainingDoors = universe.totalEstimatedDoors - totalDoors;
    const weeksRemaining = averageDoorsPerHour > 0
      ? remainingDoors / (doorsThisWeek || 1)
      : 999;

    const projectedDate = new Date(end);
    projectedDate.setDate(projectedDate.getDate() + weeksRemaining * 7);
    const projectedCompletionDate = projectedDate.toISOString().split('T')[0];

    const onTrack = weeksRemaining < 12; // Arbitrary threshold

    // Recommended actions
    const recommendedActions: string[] = [];
    if (stalledTurfs > 0) {
      recommendedActions.push(`Reassign ${stalledTurfs} stalled turfs to active volunteers`);
    }
    if (contactRate < 0.3) {
      recommendedActions.push('Adjust canvassing times to improve contact rate');
    }
    if (activeVolunteers.size < 5) {
      recommendedActions.push('Recruit more volunteers to maintain momentum');
    }
    if (averageDoorsPerHour < 35) {
      recommendedActions.push('Review turf density and route optimization');
    }

    return {
      universeId: universe.id,
      universeName: universe.name,
      weekStart: weekStartStr.split('T')[0],
      weekEnd: weekEndStr.split('T')[0],
      doorsThisWeek,
      doorsPreviousWeek,
      doorsChange,
      contactsThisWeek,
      contactRate,
      hoursThisWeek,
      averageDoorsPerHour,
      volunteersActive: activeVolunteers.size,
      newVolunteers,
      volunteersInactive,
      topPerformers,
      topPrecincts,
      stalledTurfs,
      behindSchedulePercent,
      projectedCompletionDate,
      onTrack,
      recommendedActions,
    };
  }

  /**
   * Compare performance across time periods
   */
  static comparePeriods(
    universeId: string,
    period1: { start: string; end: string },
    period2: { start: string; end: string }
  ): {
    period1: { doors: number; contacts: number; hours: number; contactRate: number };
    period2: { doors: number; contacts: number; hours: number; contactRate: number };
    change: { doors: number; contacts: number; hours: number; contactRate: number };
    winner: 'period1' | 'period2' | 'tie';
  } {
    const sessions1 = ProgressStore.getSessionsInRange(period1.start, period1.end, universeId);
    const sessions2 = ProgressStore.getSessionsInRange(period2.start, period2.end, universeId);

    const metrics1 = this.calculateMetricsFromSessions(sessions1);
    const metrics2 = this.calculateMetricsFromSessions(sessions2);

    const change = {
      doors: metrics1.doors > 0 ? ((metrics2.doors - metrics1.doors) / metrics1.doors) * 100 : 0,
      contacts: metrics1.contacts > 0 ? ((metrics2.contacts - metrics1.contacts) / metrics1.contacts) * 100 : 0,
      hours: metrics1.hours > 0 ? ((metrics2.hours - metrics1.hours) / metrics1.hours) * 100 : 0,
      contactRate: metrics1.contactRate > 0
        ? ((metrics2.contactRate - metrics1.contactRate) / metrics1.contactRate) * 100
        : 0,
    };

    // Determine winner based on composite score
    const score1 = metrics1.doors + metrics1.contacts * 2 + metrics1.contactRate * 100;
    const score2 = metrics2.doors + metrics2.contacts * 2 + metrics2.contactRate * 100;

    let winner: 'period1' | 'period2' | 'tie';
    if (Math.abs(score1 - score2) < 0.01) {
      winner = 'tie';
    } else {
      winner = score2 > score1 ? 'period2' : 'period1';
    }

    return {
      period1: metrics1,
      period2: metrics2,
      change,
      winner,
    };
  }

  // Private helper methods

  /**
   * Calculate efficiency score for a volunteer (0-100)
   * 40% weight: doorsPerHour normalized (40/hour = 100%)
   * 35% weight: contactRate normalized (35% = 100%)
   * 25% weight: completionRate
   */
  private static calculateEfficiencyScore(
    doorsPerHour: number,
    contactRate: number,
    completionRate: number
  ): number {
    const doorsScore = Math.min(100, (doorsPerHour / 40) * 100);
    const contactScore = Math.min(100, (contactRate / 0.35) * 100);
    const completionScore = completionRate * 100;

    return doorsScore * 0.4 + contactScore * 0.35 + completionScore * 0.25;
  }

  /**
   * Determine trend from recent sessions
   * Compare last 3 sessions vs previous 3
   * If avg doors/hour increased >10%: improving
   * If decreased >10%: declining
   * Otherwise: stable
   */
  private static determineTrend(sessions: CanvassingSession[]): 'improving' | 'stable' | 'declining' {
    if (sessions.length < 6) {
      return 'stable';
    }

    // Sort by date (most recent first)
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    const recent = sorted.slice(0, 3);
    const previous = sorted.slice(3, 6);

    const recentAvg = this.calculateAverageDoorsPerHour(recent);
    const previousAvg = this.calculateAverageDoorsPerHour(previous);

    if (previousAvg === 0) {
      return 'stable';
    }

    const change = ((recentAvg - previousAvg) / previousAvg) * 100;

    if (change > 10) return 'improving';
    if (change < -10) return 'declining';
    return 'stable';
  }

  /**
   * Assign badges based on performance
   */
  private static assignBadges(
    metrics: VolunteerRanking['metrics'],
    rank: number,
    trend: string
  ): string[] {
    const badges: string[] = [];

    // Top Performer: Rank 1-3
    if (rank <= 3) {
      badges.push('Top Performer');
    }

    // Most Improved: Trend = improving
    if (trend === 'improving') {
      badges.push('Most Improved');
    }

    // Reliable: completionRate >= 90%
    if (metrics.completionRate >= 90) {
      badges.push('Reliable');
    }

    // Contact Master: contactRate >= 40%
    if (metrics.contactRate >= 0.4) {
      badges.push('Contact Master');
    }

    // Speed Demon: doorsPerHour >= 50
    if (metrics.doorsPerHour >= 50) {
      badges.push('Speed Demon');
    }

    // Veteran: totalDoors >= 1000 (proxy for 20+ sessions)
    if (metrics.totalDoors >= 1000) {
      badges.push('Veteran');
    }

    return badges;
  }

  /**
   * Calculate volunteer metrics from sessions
   */
  private static calculateVolunteerMetrics(sessions: CanvassingSession[]): VolunteerRanking['metrics'] {
    let totalDoors = 0;
    let totalContacts = 0;
    let totalMinutes = 0;
    let completedSessions = 0;

    for (const session of sessions) {
      totalDoors += session.doorsKnocked;
      totalContacts += session.contactsMade;

      if (session.endTime) {
        const start = new Date(session.startTime).getTime();
        const end = new Date(session.endTime).getTime();
        const minutes = (end - start) / (1000 * 60);
        totalMinutes += minutes - (session.pausedMinutes || 0);
        completedSessions++;
      }
    }

    const totalHours = totalMinutes / 60;
    const doorsPerHour = totalHours > 0 ? totalDoors / totalHours : 0;
    const contactRate = totalDoors > 0 ? totalContacts / totalDoors : 0;
    const completionRate = sessions.length > 0 ? completedSessions / sessions.length : 1;

    return {
      totalDoors,
      totalContacts,
      totalHours,
      doorsPerHour,
      contactRate,
      completionRate,
    };
  }

  /**
   * Calculate hours from sessions
   */
  private static calculateHoursFromSessions(sessions: CanvassingSession[]): number {
    let totalMinutes = 0;

    for (const session of sessions) {
      if (session.endTime) {
        const start = new Date(session.startTime).getTime();
        const end = new Date(session.endTime).getTime();
        const minutes = (end - start) / (1000 * 60);
        totalMinutes += minutes - (session.pausedMinutes || 0);
      }
    }

    return totalMinutes / 60;
  }

  /**
   * Calculate hours for a single session
   */
  private static calculateSessionHours(session: CanvassingSession): number {
    if (!session.endTime) {
      return 0;
    }

    const start = new Date(session.startTime).getTime();
    const end = new Date(session.endTime).getTime();
    const minutes = (end - start) / (1000 * 60);
    return (minutes - (session.pausedMinutes || 0)) / 60;
  }

  /**
   * Calculate universe-wide averages
   */
  private static calculateUniverseAverages(sessions: CanvassingSession[]): {
    contactRate: number;
    doorsPerHour: number;
  } {
    let totalDoors = 0;
    let totalContacts = 0;
    let totalHours = 0;

    for (const session of sessions) {
      totalDoors += session.doorsKnocked;
      totalContacts += session.contactsMade;
      totalHours += this.calculateSessionHours(session);
    }

    return {
      contactRate: totalDoors > 0 ? totalContacts / totalDoors : 0,
      doorsPerHour: totalHours > 0 ? totalDoors / totalHours : 0,
    };
  }

  /**
   * Calculate average doors per hour
   */
  private static calculateAverageDoorsPerHour(sessions: CanvassingSession[]): number {
    let totalDoors = 0;
    let totalHours = 0;

    for (const session of sessions) {
      totalDoors += session.doorsKnocked;
      totalHours += this.calculateSessionHours(session);
    }

    return totalHours > 0 ? totalDoors / totalHours : 0;
  }

  /**
   * Build weekly summary from sessions
   */
  private static buildWeeklySummary(sessions: CanvassingSession[]): Array<{
    weekStart: string;
    weekNumber: number;
    totalDoors: number;
    totalContacts: number;
    totalHours: number;
    averageDoorsPerHour: number;
    uniqueVolunteers: number;
  }> {
    const weekMap = new Map<string, {
      doors: number;
      contacts: number;
      hours: number;
      volunteers: Set<string>;
    }>();

    for (const session of sessions) {
      const date = new Date(session.startTime);
      const weekStart = this.getStartOfWeek(date);
      const weekKey = weekStart.toISOString().split('T')[0];

      const existing = weekMap.get(weekKey) || {
        doors: 0,
        contacts: 0,
        hours: 0,
        volunteers: new Set(),
      };

      existing.doors += session.doorsKnocked;
      existing.contacts += session.contactsMade;
      existing.hours += this.calculateSessionHours(session);
      existing.volunteers.add(session.volunteerId);
      weekMap.set(weekKey, existing);
    }

    const summary = Array.from(weekMap.entries())
      .map(([weekStart, data], index) => ({
        weekStart,
        weekNumber: index + 1,
        totalDoors: data.doors,
        totalContacts: data.contacts,
        totalHours: data.hours,
        averageDoorsPerHour: data.hours > 0 ? data.doors / data.hours : 0,
        uniqueVolunteers: data.volunteers.size,
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    return summary;
  }

  /**
   * Get start of week (Sunday) for a date
   */
  private static getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day;
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Calculate metrics from sessions
   */
  private static calculateMetricsFromSessions(sessions: CanvassingSession[]): {
    doors: number;
    contacts: number;
    hours: number;
    contactRate: number;
  } {
    let doors = 0;
    let contacts = 0;
    let hours = 0;

    for (const session of sessions) {
      doors += session.doorsKnocked;
      contacts += session.contactsMade;
      hours += this.calculateSessionHours(session);
    }

    return {
      doors,
      contacts,
      hours,
      contactRate: doors > 0 ? contacts / doors : 0,
    };
  }
}
