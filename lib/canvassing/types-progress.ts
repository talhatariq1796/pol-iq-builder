/**
 * Progress Tracking Types
 *
 * Type definitions for canvassing sessions, progress metrics, and real-time updates.
 */

/**
 * A single canvassing session (one shift for one volunteer)
 */
export interface CanvassingSession {
  id: string;
  volunteerId: string;
  turfId: string;
  universeId: string;
  assignmentId: string;

  // Time tracking
  startTime: string; // ISO datetime
  endTime?: string;
  pausedMinutes?: number; // Total time paused (breaks)

  // Progress
  doorsKnocked: number;
  contactsMade: number;
  notHome: number;
  refused: number;
  movedAway: number;

  // Outcomes (optional, depends on campaign goals)
  positiveResponses?: number;
  negativeResponses?: number;
  undecided?: number;
  yardSignRequests?: number;
  volunteerSignups?: number;

  // Location data (for route tracking)
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  routeGeoJSON?: GeoJSON.LineString;

  // Notes
  notes?: string;
  issues?: string[];

  // Device info
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  submittedFrom?: string; // app version or source
}

/**
 * Progress metrics for a single turf
 */
export interface TurfProgress {
  turfId: string;
  turfName: string;
  universeId: string;

  // Door counts
  targetDoors: number;
  doorsKnocked: number;
  doorsRemaining: number;
  percentComplete: number;

  // Contact metrics
  totalContacts: number;
  contactRate: number; // contacts / doors
  notHomeCount: number;
  refusedCount: number;

  // Time metrics
  totalHoursSpent: number;
  doorsPerHour: number;

  // Volunteer activity
  totalSessions: number;
  uniqueVolunteers: number;
  lastActivityDate?: string;

  // Status
  status: 'not_started' | 'in_progress' | 'stalled' | 'complete';
  daysInactive?: number;
}

/**
 * Progress metrics for an entire universe
 */
export interface UniverseProgress {
  universeId: string;
  universeName: string;

  // Aggregate door counts
  totalTargetDoors: number;
  totalDoorsKnocked: number;
  totalDoorsRemaining: number;
  overallPercentComplete: number;

  // Contact aggregates
  totalContacts: number;
  overallContactRate: number;
  totalNotHome: number;
  totalRefused: number;

  // Time aggregates
  totalHoursSpent: number;
  averageDoorsPerHour: number;

  // Turf breakdown
  turfsTotal: number;
  turfsComplete: number;
  turfsInProgress: number;
  turfsStalled: number;
  turfsNotStarted: number;

  // Volunteer engagement
  totalSessions: number;
  uniqueVolunteers: number;
  activeVolunteers: number; // Volunteers with activity in last 7 days

  // Projections
  estimatedCompletionDate?: string;
  projectedTotalHours?: number;
}

/**
 * Daily progress summary
 */
export interface DailyProgressSummary {
  date: string; // YYYY-MM-DD
  universeId: string;

  doorsKnocked: number;
  contactsMade: number;
  hoursWorked: number;
  sessionsCount: number;
  volunteersActive: number;

  // Comparisons
  doorsVsPreviousDay?: number; // +/- %
  doorsVsAverage?: number; // +/- %
}

/**
 * Stalled turf alert
 */
export interface StalledTurfAlert {
  turfId: string;
  turfName: string;
  universeId: string;

  lastActivityDate: string;
  daysInactive: number;
  percentComplete: number;
  doorsRemaining: number;

  assignedVolunteers: string[];
  suggestedAction: 'reassign' | 'follow_up' | 'archive';
}

/**
 * Progress logging input
 */
export interface ProgressLogInput {
  volunteerId: string;
  turfId: string;
  universeId: string;

  sessionId?: string; // For continuing a session

  startTime?: string;
  endTime?: string;

  doorsKnocked: number;
  contactsMade: number;
  notHome?: number;
  refused?: number;

  notes?: string;
}
