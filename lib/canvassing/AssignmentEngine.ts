/**
 * Assignment Engine
 *
 * Smart turf assignment with conflict detection, workload balancing,
 * and optimization recommendations.
 */

import type {
  Volunteer,
  TurfAssignment,
  AssignmentValidation,
  VolunteerRecommendation,
  ExperienceLevel,
} from './types-volunteer';
import type { CanvassingTurf, CanvassingUniverse } from './types';
import { VolunteerManager } from './VolunteerManager';
import { VolunteerStore } from './VolunteerStore';

/**
 * Assignment validation and optimization engine
 */
export class AssignmentEngine {
  /**
   * Validate if an assignment can be made
   * Checks for:
   * - Double assignment (volunteer already assigned to same turf)
   * - Overload (too many active turfs)
   * - Schedule conflicts
   */
  static validateAssignment(
    volunteer: Volunteer,
    turf: CanvassingTurf,
    universeId: string
  ): AssignmentValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check for double assignment
    const existingAssignments = VolunteerStore.getAssignmentsByVolunteer(volunteer.id);
    const alreadyAssignedToThisTurf = existingAssignments.some(
      a => a.turfId === turf.turfId && a.status !== 'cancelled' && a.status !== 'completed'
    );

    if (alreadyAssignedToThisTurf) {
      errors.push(`Volunteer is already assigned to turf ${turf.turfName}`);
    }

    // 2. Check for overload
    if (volunteer.maxTurfsPerWeek) {
      const activeCount = this.getActiveAssignmentCount(volunteer.id);
      if (activeCount >= volunteer.maxTurfsPerWeek) {
        errors.push(
          `Volunteer has reached maximum turfs per week (${volunteer.maxTurfsPerWeek}/${volunteer.maxTurfsPerWeek})`
        );
      } else if (activeCount === volunteer.maxTurfsPerWeek - 1) {
        warnings.push('This will be the volunteer\'s last available turf slot');
      }
    }

    // 3. Check experience level for high-priority turfs
    if (turf.priority <= 3 && volunteer.experienceLevel === 'new') {
      warnings.push('High-priority turf assigned to new volunteer - consider pairing with team leader');
    }

    // 4. Check vehicle requirement for rural turfs
    if (turf.density === 'rural' && !volunteer.hasVehicle) {
      errors.push('Rural turf requires a vehicle, but volunteer does not have one');
    }

    // 5. Check reliability for urgent turfs
    if (turf.priority === 1 && volunteer.reliabilityScore < 70) {
      warnings.push(
        `High-priority turf assigned to volunteer with low reliability score (${volunteer.reliabilityScore})`
      );
    }

    // 6. Check if volunteer is already heavily loaded
    if (volunteer.activeAssignments >= 3) {
      warnings.push(
        `Volunteer has ${volunteer.activeAssignments} active assignments - may be overloaded`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Recommend best volunteers for a specific turf
   * Considers: experience, past performance, location, availability
   */
  static recommendVolunteers(
    turf: CanvassingTurf,
    options?: {
      limit?: number;
      excludeIds?: string[];
      minExperience?: ExperienceLevel;
    }
  ): VolunteerRecommendation[] {
    const limit = options?.limit ?? 5;
    const excludeIds = new Set(options?.excludeIds ?? []);

    let volunteers = VolunteerManager.getAllVolunteers();

    // Filter by minimum experience
    if (options?.minExperience) {
      const experienceLevels: ExperienceLevel[] = ['new', 'experienced', 'team_leader'];
      const minIndex = experienceLevels.indexOf(options.minExperience);
      volunteers = volunteers.filter(v => {
        const vIndex = experienceLevels.indexOf(v.experienceLevel);
        return vIndex >= minIndex;
      });
    }

    // Exclude specific volunteers
    volunteers = volunteers.filter(v => !excludeIds.has(v.id));

    // Use VolunteerManager's scoring logic
    return VolunteerManager.recommendVolunteersForTurf(turf, limit);
  }

  /**
   * Optimize assignments across a universe
   * Balances workload and minimizes travel
   */
  static optimizeAssignments(
    universe: CanvassingUniverse,
    turfs: CanvassingTurf[],
    volunteers: Volunteer[]
  ): Array<{ volunteerId: string; turfId: string; score: number }> {
    const assignments: Array<{ volunteerId: string; turfId: string; score: number }> = [];
    const assignedVolunteers = new Set<string>();
    const assignedTurfs = new Set<string>();

    // Create a score matrix: volunteer x turf
    const scoreMatrix: Array<{ volunteerId: string; turfId: string; score: number }> = [];

    for (const turf of turfs) {
      for (const volunteer of volunteers) {
        const score = this.calculateMatchScore(volunteer, turf);
        scoreMatrix.push({ volunteerId: volunteer.id, turfId: turf.turfId, score });
      }
    }

    // Sort by score descending (greedy approach)
    scoreMatrix.sort((a, b) => b.score - a.score);

    // Assign highest scores first, avoiding double-booking
    for (const match of scoreMatrix) {
      // Check if volunteer or turf already assigned
      if (assignedVolunteers.has(match.volunteerId) || assignedTurfs.has(match.turfId)) {
        continue;
      }

      // Check if volunteer is at max capacity
      const volunteer = volunteers.find(v => v.id === match.volunteerId);
      if (!volunteer) continue;

      if (volunteer.maxTurfsPerWeek) {
        const currentAssignments = assignments.filter(a => a.volunteerId === volunteer.id);
        if (currentAssignments.length >= volunteer.maxTurfsPerWeek) {
          continue; // Skip this volunteer
        }
      }

      // Assign
      assignments.push(match);
      assignedTurfs.add(match.turfId);

      // Only mark volunteer as assigned if they've hit their max
      if (volunteer.maxTurfsPerWeek) {
        const currentAssignments = assignments.filter(a => a.volunteerId === volunteer.id);
        if (currentAssignments.length >= volunteer.maxTurfsPerWeek) {
          assignedVolunteers.add(volunteer.id);
        }
      }

      // Stop if all turfs assigned
      if (assignedTurfs.size === turfs.length) {
        break;
      }
    }

    return assignments;
  }

  /**
   * Detect and list any double assignments
   */
  static detectDoubleAssignments(universeId: string): Array<{
    volunteerId: string;
    turfIds: string[];
  }> {
    const assignments = VolunteerStore.getAssignmentsByUniverse(universeId);
    const activeAssignments = assignments.filter(
      a => a.status === 'assigned' || a.status === 'in_progress'
    );

    // Group by volunteer
    const volunteerMap = new Map<string, string[]>();
    for (const assignment of activeAssignments) {
      const turfs = volunteerMap.get(assignment.volunteerId) || [];
      turfs.push(assignment.turfId);
      volunteerMap.set(assignment.volunteerId, turfs);
    }

    // Find volunteers with multiple turfs (potential conflicts)
    const doubleAssignments: Array<{ volunteerId: string; turfIds: string[] }> = [];
    volunteerMap.forEach((turfIds, volunteerId) => {
      if (turfIds.length > 1) {
        // Check if these are actual conflicts (same turf multiple times)
        const uniqueTurfs = new Set(turfIds);
        if (uniqueTurfs.size < turfIds.length) {
          doubleAssignments.push({ volunteerId, turfIds });
        }
      }
    });

    return doubleAssignments;
  }

  /**
   * Get volunteer workload summary
   */
  static getVolunteerWorkload(volunteerId: string): {
    activeAssignments: number;
    pendingDoors: number;
    completedDoors: number;
    hoursThisWeek: number;
  } {
    const volunteer = VolunteerManager.getVolunteer(volunteerId);
    if (!volunteer) {
      return {
        activeAssignments: 0,
        pendingDoors: 0,
        completedDoors: 0,
        hoursThisWeek: 0,
      };
    }

    const assignments = VolunteerStore.getAssignmentsByVolunteer(volunteerId);

    const activeAssignments = assignments.filter(
      a => a.status === 'assigned' || a.status === 'in_progress'
    ).length;

    const completedDoors = assignments
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + (a.doorsAttempted || 0), 0);

    // Estimate pending doors (would need turf data in real implementation)
    const pendingDoors = activeAssignments * 50; // Rough estimate

    // Calculate hours this week (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const hoursThisWeek = assignments
      .filter(a => {
        if (!a.completedAt) return false;
        const completedDate = new Date(a.completedAt);
        return completedDate >= oneWeekAgo;
      })
      .reduce((sum, a) => sum + (a.hoursWorked || 0), 0);

    return {
      activeAssignments,
      pendingDoors,
      completedDoors,
      hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
    };
  }

  /**
   * Suggest reassignments for stalled turfs
   */
  static suggestReassignments(stalledTurfIds: string[]): Array<{
    turfId: string;
    currentVolunteerId?: string;
    suggestedVolunteerId: string;
    reason: string;
  }> {
    const suggestions: Array<{
      turfId: string;
      currentVolunteerId?: string;
      suggestedVolunteerId: string;
      reason: string;
    }> = [];

    for (const turfId of stalledTurfIds) {
      // Find current assignment
      const turfAssignments = VolunteerStore.getAssignmentsByTurf(turfId);
      const currentAssignment = turfAssignments.find(
        a => a.status === 'assigned' || a.status === 'in_progress'
      );

      // Get all available volunteers
      const volunteers = VolunteerManager.getAllVolunteers();

      // Filter out current volunteer and overloaded volunteers
      const availableVolunteers = volunteers.filter(v => {
        if (currentAssignment && v.id === currentAssignment.volunteerId) return false;
        if (v.activeAssignments >= 3) return false;
        if (v.reliabilityScore < 60) return false;
        return true;
      });

      if (availableVolunteers.length === 0) {
        continue; // No suitable volunteers available
      }

      // Find best volunteer (highest reliability + lowest workload)
      availableVolunteers.sort((a, b) => {
        const scoreA = a.reliabilityScore - (a.activeAssignments * 10);
        const scoreB = b.reliabilityScore - (b.activeAssignments * 10);
        return scoreB - scoreA;
      });

      const bestVolunteer = availableVolunteers[0];

      suggestions.push({
        turfId,
        currentVolunteerId: currentAssignment?.volunteerId,
        suggestedVolunteerId: bestVolunteer.id,
        reason: `High reliability (${bestVolunteer.reliabilityScore}), low workload (${bestVolunteer.activeAssignments} active)`,
      });
    }

    return suggestions;
  }

  // ===== Private helpers =====

  /**
   * Calculate match score between volunteer and turf
   * Similar to VolunteerManager scoring but simplified
   */
  private static calculateMatchScore(volunteer: Volunteer, turf: CanvassingTurf): number {
    let score = 0;

    // Experience (0-40)
    switch (volunteer.experienceLevel) {
      case 'new':
        score += 10;
        break;
      case 'experienced':
        score += 25;
        break;
      case 'team_leader':
        score += 40;
        break;
    }

    // Completion rate (0-30)
    score += (volunteer.completionRate / 100) * 30;

    // Performance (0-20)
    if (volunteer.avgDoorsPerHour) {
      const performanceRatio = volunteer.avgDoorsPerHour / turf.doorsPerHour;
      score += Math.min(20, performanceRatio * 20);
    }

    // Density match (0-10)
    if (volunteer.preferredDensity === turf.density) {
      score += 10;
    }

    // Vehicle penalty for rural
    if (turf.density === 'rural' && !volunteer.hasVehicle) {
      score -= 15;
    }

    // Workload penalty
    if (volunteer.activeAssignments >= 3) {
      score -= 10;
    } else if (volunteer.activeAssignments === 0) {
      score += 5;
    }

    // Reliability
    if (volunteer.reliabilityScore >= 90) {
      score += 5;
    } else if (volunteer.reliabilityScore < 60) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get count of active assignments for a volunteer
   */
  private static getActiveAssignmentCount(volunteerId: string): number {
    const assignments = VolunteerStore.getAssignmentsByVolunteer(volunteerId);
    return assignments.filter(
      a => a.status === 'assigned' || a.status === 'in_progress'
    ).length;
  }
}
