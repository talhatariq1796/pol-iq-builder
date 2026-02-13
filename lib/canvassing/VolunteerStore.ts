/**
 * Volunteer Store
 *
 * LocalStorage persistence for volunteers and turf assignments.
 * Follows the pattern from lib/segmentation/segmentStore.ts
 */

import type { Volunteer, TurfAssignment } from './types-volunteer';

const VOLUNTEERS_KEY = 'political_canvassing_volunteers';
const ASSIGNMENTS_KEY = 'political_canvassing_assignments';

/**
 * Volunteer store for saving and managing volunteer data
 */
export class VolunteerStore {
  // ===== Volunteer CRUD =====

  /**
   * Save a volunteer (create or update)
   */
  static saveVolunteer(volunteer: Volunteer): void {
    try {
      const volunteers = this.getAllVolunteers();
      const existingIndex = volunteers.findIndex(v => v.id === volunteer.id);

      if (existingIndex >= 0) {
        // Update existing
        volunteers[existingIndex] = volunteer;
      } else {
        // Create new
        volunteers.push(volunteer);
      }

      localStorage.setItem(VOLUNTEERS_KEY, JSON.stringify(volunteers));
    } catch (error) {
      console.error('Error saving volunteer to localStorage:', error);
      throw new Error('Failed to save volunteer');
    }
  }

  /**
   * Get a volunteer by ID
   */
  static getVolunteer(id: string): Volunteer | null {
    const volunteers = this.getAllVolunteers();
    return volunteers.find(v => v.id === id) || null;
  }

  /**
   * Get all volunteers
   */
  static getAllVolunteers(): Volunteer[] {
    try {
      const json = localStorage.getItem(VOLUNTEERS_KEY);
      if (!json) return [];
      return JSON.parse(json) as Volunteer[];
    } catch (error) {
      console.error('Error loading volunteers from localStorage:', error);
      return [];
    }
  }

  /**
   * Delete a volunteer by ID
   */
  static deleteVolunteer(id: string): boolean {
    try {
      const volunteers = this.getAllVolunteers();
      const filtered = volunteers.filter(v => v.id !== id);

      if (filtered.length === volunteers.length) {
        return false; // Not found
      }

      localStorage.setItem(VOLUNTEERS_KEY, JSON.stringify(filtered));

      // Also delete all assignments for this volunteer
      const assignments = this.getAllAssignments();
      const filteredAssignments = assignments.filter(a => a.volunteerId !== id);
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(filteredAssignments));

      return true;
    } catch (error) {
      console.error('Error deleting volunteer from localStorage:', error);
      throw new Error('Failed to delete volunteer');
    }
  }

  /**
   * Update a volunteer with partial data
   */
  static updateVolunteer(id: string, updates: Partial<Volunteer>): Volunteer | null {
    const volunteer = this.getVolunteer(id);
    if (!volunteer) return null;

    const updated = { ...volunteer, ...updates };
    this.saveVolunteer(updated);
    return updated;
  }

  // ===== Assignment CRUD =====

  /**
   * Save an assignment (create or update)
   */
  static saveAssignment(assignment: TurfAssignment): void {
    try {
      const assignments = this.getAllAssignments();
      const existingIndex = assignments.findIndex(a => a.id === assignment.id);

      if (existingIndex >= 0) {
        // Update existing
        assignments[existingIndex] = assignment;
      } else {
        // Create new
        assignments.push(assignment);
      }

      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
    } catch (error) {
      console.error('Error saving assignment to localStorage:', error);
      throw new Error('Failed to save assignment');
    }
  }

  /**
   * Get an assignment by ID
   */
  static getAssignment(id: string): TurfAssignment | null {
    const assignments = this.getAllAssignments();
    return assignments.find(a => a.id === id) || null;
  }

  /**
   * Get all assignments
   */
  private static getAllAssignments(): TurfAssignment[] {
    try {
      const json = localStorage.getItem(ASSIGNMENTS_KEY);
      if (!json) return [];
      return JSON.parse(json) as TurfAssignment[];
    } catch (error) {
      console.error('Error loading assignments from localStorage:', error);
      return [];
    }
  }

  /**
   * Get all assignments for a specific volunteer
   */
  static getAssignmentsByVolunteer(volunteerId: string): TurfAssignment[] {
    return this.getAllAssignments().filter(a => a.volunteerId === volunteerId);
  }

  /**
   * Get all assignments for a specific turf
   */
  static getAssignmentsByTurf(turfId: string): TurfAssignment[] {
    return this.getAllAssignments().filter(a => a.turfId === turfId);
  }

  /**
   * Get all assignments for a specific universe
   */
  static getAssignmentsByUniverse(universeId: string): TurfAssignment[] {
    return this.getAllAssignments().filter(a => a.universeId === universeId);
  }

  /**
   * Delete an assignment by ID
   */
  static deleteAssignment(id: string): boolean {
    try {
      const assignments = this.getAllAssignments();
      const filtered = assignments.filter(a => a.id !== id);

      if (filtered.length === assignments.length) {
        return false; // Not found
      }

      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting assignment from localStorage:', error);
      throw new Error('Failed to delete assignment');
    }
  }

  /**
   * Update an assignment with partial data
   */
  static updateAssignment(id: string, updates: Partial<TurfAssignment>): TurfAssignment | null {
    const assignment = this.getAssignment(id);
    if (!assignment) return null;

    const updated = { ...assignment, ...updates };
    this.saveAssignment(updated);
    return updated;
  }

  // ===== Bulk operations =====

  /**
   * Import volunteers from array (merge with existing)
   */
  static importVolunteers(volunteers: Volunteer[]): number {
    try {
      let importedCount = 0;
      volunteers.forEach(volunteer => {
        // Validate basic structure
        if (!volunteer.id || !volunteer.name || !volunteer.email) {
          console.warn('Skipping invalid volunteer:', volunteer);
          return;
        }
        this.saveVolunteer(volunteer);
        importedCount++;
      });
      return importedCount;
    } catch (error) {
      console.error('Error importing volunteers:', error);
      throw new Error('Failed to import volunteers: ' + (error as Error).message);
    }
  }

  /**
   * Export all volunteers to array
   */
  static exportVolunteers(): Volunteer[] {
    return this.getAllVolunteers();
  }

  /**
   * Clear all volunteers and assignments
   */
  static clearAll(): void {
    try {
      localStorage.removeItem(VOLUNTEERS_KEY);
      localStorage.removeItem(ASSIGNMENTS_KEY);
    } catch (error) {
      console.error('Error clearing volunteer data from localStorage:', error);
      throw new Error('Failed to clear volunteer data');
    }
  }
}
