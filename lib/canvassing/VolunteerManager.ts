/**
 * Volunteer Manager
 *
 * Manages volunteer roster, profiles, and assignments.
 * Provides filtering, recommendations, and reliability scoring.
 */

import type {
  Volunteer,
  TurfAssignment,
  VolunteerFilters,
  VolunteerRecommendation,
  ExperienceLevel,
} from './types-volunteer';
import type { CanvassingTurf } from './types';
import { VolunteerStore } from './VolunteerStore';

/**
 * Main volunteer management class
 */
export class VolunteerManager {
  // ===== Volunteer CRUD (delegates to store with business logic) =====

  /**
   * Create a new volunteer
   */
  static createVolunteer(
    data: Omit<Volunteer, 'id' | 'createdAt' | 'totalDoorsKnocked' | 'totalHoursVolunteered' | 'completionRate'>
  ): Volunteer {
    const now = new Date().toISOString();

    const volunteer: Volunteer = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      totalDoorsKnocked: 0,
      totalHoursVolunteered: 0,
      completionRate: 100, // Start optimistic
      activeAssignments: 0,
    };

    VolunteerStore.saveVolunteer(volunteer);
    return volunteer;
  }

  /**
   * Update an existing volunteer
   */
  static updateVolunteer(id: string, updates: Partial<Volunteer>): Volunteer {
    const existing = VolunteerStore.getVolunteer(id);
    if (!existing) {
      throw new Error(`Volunteer ${id} not found`);
    }

    const updated = { ...existing, ...updates };
    VolunteerStore.saveVolunteer(updated);
    return updated;
  }

  /**
   * Delete a volunteer
   */
  static deleteVolunteer(id: string): boolean {
    return VolunteerStore.deleteVolunteer(id);
  }

  /**
   * Get a volunteer by ID
   */
  static getVolunteer(id: string): Volunteer | null {
    return VolunteerStore.getVolunteer(id);
  }

  /**
   * Get all volunteers
   */
  static getAllVolunteers(): Volunteer[] {
    return VolunteerStore.getAllVolunteers();
  }

  // ===== Filtering =====

  /**
   * Filter volunteers by criteria
   */
  static filterVolunteers(filters: VolunteerFilters): Volunteer[] {
    let volunteers = this.getAllVolunteers();

    // Experience level
    if (filters.experienceLevel && filters.experienceLevel.length > 0) {
      volunteers = volunteers.filter(v =>
        filters.experienceLevel!.includes(v.experienceLevel)
      );
    }

    // Min completion rate
    if (filters.minCompletionRate !== undefined) {
      volunteers = volunteers.filter(v => v.completionRate >= filters.minCompletionRate!);
    }

    // Available on specific day
    if (filters.availableOn) {
      volunteers = volunteers.filter(v =>
        v.availableDays.includes(filters.availableOn!)
      );
    }

    // Has vehicle
    if (filters.hasVehicle !== undefined) {
      volunteers = volunteers.filter(v => v.hasVehicle === filters.hasVehicle);
    }

    // Can lead team
    if (filters.canLeadTeam !== undefined) {
      volunteers = volunteers.filter(v => v.canLeadTeam === filters.canLeadTeam);
    }

    // Tags
    if (filters.tags && filters.tags.length > 0) {
      volunteers = volunteers.filter(v =>
        v.tags && v.tags.some(tag => filters.tags!.includes(tag))
      );
    }

    // Min reliability
    if (filters.minReliability !== undefined) {
      volunteers = volunteers.filter(v => v.reliabilityScore >= filters.minReliability!);
    }

    // Max active assignments
    if (filters.maxActiveAssignments !== undefined) {
      volunteers = volunteers.filter(v => v.activeAssignments <= filters.maxActiveAssignments!);
    }

    return volunteers;
  }

  // ===== Assignments =====

  /**
   * Assign a turf to a volunteer
   */
  static assignTurf(
    volunteerId: string,
    turfId: string,
    universeId: string,
    options?: {
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      expectedCompletionDate?: string;
      assignedBy?: string;
    }
  ): TurfAssignment {
    const volunteer = VolunteerStore.getVolunteer(volunteerId);
    if (!volunteer) {
      throw new Error(`Volunteer ${volunteerId} not found`);
    }

    const now = new Date().toISOString();

    const assignment: TurfAssignment = {
      id: this.generateId(),
      volunteerId,
      turfId,
      universeId,
      assignedBy: options?.assignedBy || 'system',
      assignedAt: now,
      expectedCompletionDate: options?.expectedCompletionDate,
      priority: options?.priority || 'medium',
      status: 'assigned',
    };

    VolunteerStore.saveAssignment(assignment);

    // Update volunteer's active assignment count
    const updatedVolunteer = {
      ...volunteer,
      activeAssignments: volunteer.activeAssignments + 1,
      lastActiveAt: now,
    };
    VolunteerStore.saveVolunteer(updatedVolunteer);

    return assignment;
  }

  /**
   * Unassign a turf (cancel assignment)
   */
  static unassignTurf(assignmentId: string): boolean {
    const assignment = VolunteerStore.getAssignment(assignmentId);
    if (!assignment) {
      return false;
    }

    // Update assignment status
    VolunteerStore.updateAssignment(assignmentId, {
      status: 'cancelled',
    });

    // Decrement volunteer's active assignment count
    const volunteer = VolunteerStore.getVolunteer(assignment.volunteerId);
    if (volunteer && volunteer.activeAssignments > 0) {
      VolunteerStore.updateVolunteer(volunteer.id, {
        activeAssignments: volunteer.activeAssignments - 1,
      });
    }

    return true;
  }

  /**
   * Get all assignments for a volunteer
   */
  static getVolunteerAssignments(volunteerId: string): TurfAssignment[] {
    return VolunteerStore.getAssignmentsByVolunteer(volunteerId);
  }

  /**
   * Get all assignments for a turf
   */
  static getTurfAssignments(turfId: string): TurfAssignment[] {
    return VolunteerStore.getAssignmentsByTurf(turfId);
  }

  // ===== Recommendations =====

  /**
   * Recommend best volunteers for a specific turf
   */
  static recommendVolunteersForTurf(
    turf: CanvassingTurf,
    limit: number = 5
  ): VolunteerRecommendation[] {
    const volunteers = this.getAllVolunteers();

    const recommendations: VolunteerRecommendation[] = volunteers.map(volunteer => {
      const { score, reasons, warnings } = this.scoreVolunteerForTurf(volunteer, turf);

      return {
        volunteer,
        score,
        reasons,
        warnings,
      };
    });

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    // Return top N
    return recommendations.slice(0, limit);
  }

  // ===== Reliability scoring =====

  /**
   * Calculate reliability score based on performance history
   */
  static calculateReliabilityScore(volunteer: Volunteer): number {
    let score = 100;

    // Deduct for no-shows (heavy penalty)
    score -= volunteer.noShowCount * 15;

    // Deduct for late starts (lighter penalty)
    score -= volunteer.lateStartCount * 5;

    // Factor in completion rate
    const completionPenalty = (100 - volunteer.completionRate) * 0.5;
    score -= completionPenalty;

    // Ensure score stays in 0-100 range
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Update volunteer stats after completing a session
   */
  static updateVolunteerStats(
    volunteerId: string,
    doorsKnocked: number,
    hoursWorked: number
  ): void {
    const volunteer = VolunteerStore.getVolunteer(volunteerId);
    if (!volunteer) {
      throw new Error(`Volunteer ${volunteerId} not found`);
    }

    const totalDoors = volunteer.totalDoorsKnocked + doorsKnocked;
    const totalHours = volunteer.totalHoursVolunteered + hoursWorked;
    const avgDoorsPerHour = totalHours > 0 ? totalDoors / totalHours : 0;

    // Recalculate reliability
    const reliabilityScore = this.calculateReliabilityScore(volunteer);

    const updated: Volunteer = {
      ...volunteer,
      totalDoorsKnocked: totalDoors,
      totalHoursVolunteered: totalHours,
      avgDoorsPerHour: Math.round(avgDoorsPerHour * 10) / 10,
      reliabilityScore,
      lastActiveAt: new Date().toISOString(),
    };

    VolunteerStore.saveVolunteer(updated);
  }

  // ===== Bulk operations =====

  /**
   * Get volunteers with active assignments
   */
  static getActiveVolunteers(): Volunteer[] {
    return this.getAllVolunteers().filter(v => v.activeAssignments > 0);
  }

  /**
   * Get volunteers by tag
   */
  static getVolunteersByTag(tag: string): Volunteer[] {
    return this.getAllVolunteers().filter(v =>
      v.tags && v.tags.includes(tag)
    );
  }

  // ===== Private helpers =====

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `vol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Score a volunteer for a specific turf
   * Returns score (0-100) and reasons
   */
  private static scoreVolunteerForTurf(
    volunteer: Volunteer,
    turf: CanvassingTurf
  ): { score: number; reasons: string[]; warnings: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // 1. Experience level (0-40 points)
    switch (volunteer.experienceLevel) {
      case 'new':
        score += 10;
        reasons.push('New volunteer (+10)');
        break;
      case 'experienced':
        score += 25;
        reasons.push('Experienced volunteer (+25)');
        break;
      case 'team_leader':
        score += 40;
        reasons.push('Team leader (+40)');
        break;
    }

    // 2. Completion rate (0-30 points)
    const completionScore = (volunteer.completionRate / 100) * 30;
    score += completionScore;
    if (volunteer.completionRate >= 90) {
      reasons.push(`Excellent completion rate: ${volunteer.completionRate}% (+${Math.round(completionScore)})`);
    } else if (volunteer.completionRate >= 70) {
      reasons.push(`Good completion rate: ${volunteer.completionRate}% (+${Math.round(completionScore)})`);
    } else {
      warnings.push(`Low completion rate: ${volunteer.completionRate}%`);
    }

    // 3. Doors per hour performance (0-20 points)
    if (volunteer.avgDoorsPerHour) {
      const expectedRate = turf.doorsPerHour;
      const performanceRatio = volunteer.avgDoorsPerHour / expectedRate;
      const performanceScore = Math.min(20, performanceRatio * 20);
      score += performanceScore;

      if (performanceRatio >= 1.0) {
        reasons.push(`Strong performance: ${volunteer.avgDoorsPerHour} doors/hr (+${Math.round(performanceScore)})`);
      } else if (performanceRatio >= 0.8) {
        reasons.push(`Adequate performance: ${volunteer.avgDoorsPerHour} doors/hr (+${Math.round(performanceScore)})`);
      } else {
        warnings.push(`Below average performance: ${volunteer.avgDoorsPerHour} doors/hr`);
      }
    }

    // 4. Density preference match (0-10 points)
    if (volunteer.preferredDensity === turf.density) {
      score += 10;
      reasons.push(`Preferred density match: ${turf.density} (+10)`);
    } else if (volunteer.preferredDensity) {
      warnings.push(`Density mismatch: prefers ${volunteer.preferredDensity}, turf is ${turf.density}`);
    }

    // 5. Vehicle requirement for rural turfs
    if (turf.density === 'rural' && !volunteer.hasVehicle) {
      score -= 15;
      warnings.push('Rural turf requires vehicle (-15)');
    }

    // 6. Current workload (penalty for overloaded volunteers)
    if (volunteer.activeAssignments >= 3) {
      score -= 10;
      warnings.push(`High workload: ${volunteer.activeAssignments} active assignments (-10)`);
    } else if (volunteer.activeAssignments === 0) {
      score += 5;
      reasons.push('Available: no current assignments (+5)');
    }

    // 7. Reliability bonus/penalty
    if (volunteer.reliabilityScore >= 90) {
      score += 5;
      reasons.push(`High reliability: ${volunteer.reliabilityScore} (+5)`);
    } else if (volunteer.reliabilityScore < 60) {
      score -= 10;
      warnings.push(`Low reliability: ${volunteer.reliabilityScore} (-10)`);
    }

    // Ensure score stays in 0-100 range
    score = Math.max(0, Math.min(100, Math.round(score)));

    return { score, reasons, warnings };
  }
}
