/**
 * Volunteer Management Types
 *
 * Type definitions for volunteer roster, assignments, and recommendations.
 */

/**
 * Experience level classification for volunteers
 */
export type ExperienceLevel = 'new' | 'experienced' | 'team_leader';

/**
 * Time slot for volunteer availability
 */
export interface TimeSlot {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

/**
 * Volunteer profile
 */
export interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string;

  // Experience
  experienceLevel: ExperienceLevel;
  totalDoorsKnocked: number;
  totalHoursVolunteered: number;
  completionRate: number; // 0-100

  // Availability
  availableDays: string[]; // day names
  availableTimeSlots: TimeSlot[];
  maxTurfsPerWeek?: number;

  // Location
  homeZipCode?: string;
  willingToTravel?: number; // km radius

  // Skills & Preferences
  languages?: string[];
  hasVehicle: boolean;
  canLeadTeam: boolean;
  preferredDensity?: 'urban' | 'suburban' | 'rural';

  // Performance tracking
  avgDoorsPerHour?: number;
  reliabilityScore: number; // 0-100
  noShowCount: number;
  lateStartCount: number;

  // Metadata
  tags?: string[];
  notes?: string;
  createdAt: string;
  lastActiveAt?: string;
  activeAssignments: number;
}

/**
 * Turf assignment
 */
export interface TurfAssignment {
  id: string;
  volunteerId: string;
  turfId: string;
  universeId: string;

  // Assignment details
  assignedBy: string;
  assignedAt: string;
  expectedCompletionDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Status
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  startedAt?: string;
  completedAt?: string;

  // Performance
  doorsAttempted?: number;
  contactsMade?: number;
  hoursWorked?: number;

  // Notes
  notes?: string;
}

/**
 * Volunteer filter criteria
 */
export interface VolunteerFilters {
  experienceLevel?: ExperienceLevel[];
  minCompletionRate?: number;
  availableOn?: string; // day name
  hasVehicle?: boolean;
  canLeadTeam?: boolean;
  tags?: string[];
  minReliability?: number;
  maxActiveAssignments?: number;
}

/**
 * Volunteer recommendation for a turf
 */
export interface VolunteerRecommendation {
  volunteer: Volunteer;
  score: number; // 0-100
  reasons: string[];
  warnings?: string[];
}

/**
 * Assignment validation result
 */
export interface AssignmentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
