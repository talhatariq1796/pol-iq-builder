/**
 * Analytics Types
 *
 * Type definitions for performance analytics, trends, and reports.
 */

/**
 * Precinct-level canvassing analytics
 */
export interface PrecinctAnalytics {
  precinctId: string;
  precinctName: string;
  jurisdiction: string;

  // Performance metrics
  totalDoorsKnocked: number;
  totalContacts: number;
  contactRate: number;
  averageDoorsPerHour: number;
  totalHoursSpent: number;

  // Efficiency
  efficiencyScore: number; // 0-100, normalized
  roiScore: number; // Value per hour spent

  // Targeting accuracy
  predictedContactRate: number;
  actualContactRate: number;
  targetingAccuracy: number; // 0-100

  // Comparison to average
  contactRateVsAvg: number; // +/- %
  doorsPerHourVsAvg: number; // +/- %

  // Volunteer data
  uniqueVolunteers: number;
  totalSessions: number;
}

/**
 * Volunteer performance analytics
 */
export interface VolunteerAnalytics {
  volunteerId: string;
  volunteerName: string;

  // Activity summary
  totalSessions: number;
  totalHours: number;
  totalDoorsKnocked: number;
  totalContacts: number;

  // Efficiency metrics
  averageDoorsPerHour: number;
  averageContactRate: number;
  averageSessionLength: number; // hours

  // Reliability
  completionRate: number; // % of assignments completed
  onTimeRate: number; // % of sessions started on time
  noShowCount: number;

  // Ranking
  rankByDoors: number; // 1 = top
  rankByEfficiency: number;
  rankByReliability: number;
  overallRank: number;
  percentile: number; // Top X%

  // Trends
  performanceTrend: 'improving' | 'stable' | 'declining';
  hoursThisWeek: number;
  hoursLastWeek: number;
}

/**
 * Temporal (time-based) analytics
 */
export interface TemporalAnalytics {
  universeId: string;

  // Best times to canvass
  bestDayOfWeek: number; // 0-6
  bestHourOfDay: number; // 0-23

  // Time heatmap data (contacts per slot)
  contactsByDayHour: Array<{
    dayOfWeek: number;
    hour: number;
    contacts: number;
    doors: number;
    contactRate: number;
  }>;

  // Daily trend
  dailyTrend: Array<{
    date: string;
    doorsKnocked: number;
    contacts: number;
    hours: number;
    volunteers: number;
  }>;

  // Weekly summary
  weeklySummary: Array<{
    weekStart: string;
    weekNumber: number;
    totalDoors: number;
    totalContacts: number;
    totalHours: number;
    averageDoorsPerHour: number;
    uniqueVolunteers: number;
  }>;
}

/**
 * Conversion funnel analytics
 */
export interface ConversionFunnel {
  universeId: string;

  // Funnel stages
  totalDoors: number;
  doorsKnocked: number;
  contactsMade: number;
  positiveConversations: number;
  commitments: number;

  // Conversion rates
  knockRate: number; // knocked / total
  contactRate: number; // contacts / knocked
  positiveRate: number; // positive / contacts
  commitmentRate: number; // commitments / positive
  overallConversionRate: number; // commitments / total

  // Comparison to targets
  targetContactRate: number;
  targetCommitmentRate: number;
  contactRateVsTarget: number; // +/- %
  commitmentRateVsTarget: number; // +/- %
}

/**
 * Top performer leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  volunteerId: string;
  volunteerName: string;

  metric: 'doors' | 'contacts' | 'hours' | 'efficiency';
  value: number;
  previousRank?: number;
  change?: 'up' | 'down' | 'same' | 'new';
}

/**
 * Weekly report summary
 */
export interface WeeklyReport {
  universeId: string;
  universeName: string;
  weekStart: string;
  weekEnd: string;

  // Progress
  doorsThisWeek: number;
  doorsPreviousWeek: number;
  doorsChange: number; // +/- %

  contactsThisWeek: number;
  contactRate: number;

  hoursThisWeek: number;
  averageDoorsPerHour: number;

  // Volunteer engagement
  volunteersActive: number;
  newVolunteers: number;
  volunteersInactive: number;

  // Highlights
  topPerformers: LeaderboardEntry[];
  topPrecincts: Array<{
    precinctId: string;
    precinctName: string;
    contactRate: number;
    doorsKnocked: number;
  }>;

  // Issues
  stalledTurfs: number;
  behindSchedulePercent: number;

  // Projections
  projectedCompletionDate: string;
  onTrack: boolean;
  recommendedActions: string[];
}

/**
 * Analytics query options
 */
export interface AnalyticsQueryOptions {
  universeId?: string;
  dateRange?: { start: string; end: string };
  precinctIds?: string[];
  volunteerIds?: string[];
  groupBy?: 'day' | 'week' | 'month' | 'precinct' | 'volunteer';
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
