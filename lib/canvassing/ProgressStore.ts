/**
 * Progress Store
 *
 * LocalStorage persistence for canvassing sessions and progress metrics.
 * Provides CRUD operations for session data and optional caching for performance.
 */

import type { CanvassingSession, TurfProgress } from './types-progress';

const SESSIONS_KEY = 'political_canvassing_sessions';
const PROGRESS_KEY = 'political_canvassing_progress';

export class ProgressStore {
  /**
   * Save a canvassing session to LocalStorage
   */
  static saveSession(session: CanvassingSession): void {
    const sessions = this.getAllSessions();
    const index = sessions.findIndex(s => s.id === session.id);

    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }

    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  /**
   * Get a session by ID
   */
  static getSession(id: string): CanvassingSession | null {
    const sessions = this.getAllSessions();
    return sessions.find(s => s.id === id) || null;
  }

  /**
   * Get all sessions for a specific volunteer
   */
  static getSessionsByVolunteer(volunteerId: string, limit?: number): CanvassingSession[] {
    const sessions = this.getAllSessions()
      .filter(s => s.volunteerId === volunteerId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return limit ? sessions.slice(0, limit) : sessions;
  }

  /**
   * Get all sessions for a specific turf
   */
  static getSessionsByTurf(turfId: string): CanvassingSession[] {
    return this.getAllSessions()
      .filter(s => s.turfId === turfId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  /**
   * Get all sessions for a specific universe
   */
  static getSessionsByUniverse(universeId: string): CanvassingSession[] {
    return this.getAllSessions()
      .filter(s => s.universeId === universeId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  /**
   * Get sessions for a specific date
   */
  static getSessionsByDate(date: string, universeId?: string): CanvassingSession[] {
    const targetDate = new Date(date).toISOString().split('T')[0];

    return this.getAllSessions()
      .filter(s => {
        const sessionDate = new Date(s.startTime).toISOString().split('T')[0];
        const matchesDate = sessionDate === targetDate;
        const matchesUniverse = !universeId || s.universeId === universeId;
        return matchesDate && matchesUniverse;
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  /**
   * Get sessions within a date range
   */
  static getSessionsInRange(
    startDate: string,
    endDate: string,
    universeId?: string
  ): CanvassingSession[] {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return this.getAllSessions()
      .filter(s => {
        const sessionTime = new Date(s.startTime).getTime();
        const inRange = sessionTime >= start && sessionTime <= end;
        const matchesUniverse = !universeId || s.universeId === universeId;
        return inRange && matchesUniverse;
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  /**
   * Delete a session by ID
   */
  static deleteSession(id: string): boolean {
    const sessions = this.getAllSessions();
    const filtered = sessions.filter(s => s.id !== id);

    if (filtered.length === sessions.length) {
      return false; // Session not found
    }

    localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
    return true;
  }

  /**
   * Update a session with partial data
   */
  static updateSession(id: string, updates: Partial<CanvassingSession>): CanvassingSession | null {
    const session = this.getSession(id);

    if (!session) {
      return null;
    }

    const updated = { ...session, ...updates };
    this.saveSession(updated);
    return updated;
  }

  /**
   * Cache turf progress for performance (optional optimization)
   */
  static cacheTurfProgress(progress: TurfProgress): void {
    const cache = this.getProgressCache();
    cache[progress.turfId] = {
      ...progress,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(cache));
  }

  /**
   * Get cached turf progress if available and fresh
   */
  static getCachedTurfProgress(turfId: string): TurfProgress | null {
    const cache = this.getProgressCache();
    const cached = cache[turfId];

    if (!cached) {
      return null;
    }

    // Cache is valid for 5 minutes
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    if (age > 5 * 60 * 1000) {
      return null;
    }

    return cached;
  }

  /**
   * Invalidate cached progress for a turf
   */
  static invalidateProgressCache(turfId: string): void {
    const cache = this.getProgressCache();
    delete cache[turfId];
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(cache));
  }

  /**
   * Import sessions in bulk (for data migration or restore)
   */
  static importSessions(sessions: CanvassingSession[]): number {
    const existing = this.getAllSessions();
    const merged = [...existing];

    let imported = 0;
    for (const session of sessions) {
      const existingIndex = merged.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = session; // Replace
      } else {
        merged.push(session); // Add new
        imported++;
      }
    }

    localStorage.setItem(SESSIONS_KEY, JSON.stringify(merged));
    return imported;
  }

  /**
   * Export all sessions (for backup or analysis)
   */
  static exportSessions(): CanvassingSession[] {
    return this.getAllSessions();
  }

  /**
   * Get total count of sessions
   */
  static getSessionCount(): number {
    return this.getAllSessions().length;
  }

  /**
   * Clear old sessions (cleanup utility)
   */
  static clearOldSessions(beforeDate: string): number {
    const cutoff = new Date(beforeDate).getTime();
    const sessions = this.getAllSessions();
    const filtered = sessions.filter(s => new Date(s.startTime).getTime() >= cutoff);

    const removed = sessions.length - filtered.length;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
    return removed;
  }

  // Private helper methods

  /**
   * Get all sessions from LocalStorage
   */
  private static getAllSessions(): CanvassingSession[] {
    try {
      const stored = localStorage.getItem(SESSIONS_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored) as CanvassingSession[];
    } catch (error) {
      console.error('Error loading sessions from LocalStorage:', error);
      return [];
    }
  }

  /**
   * Get progress cache from LocalStorage
   */
  private static getProgressCache(): Record<string, TurfProgress & { cachedAt: string }> {
    try {
      const stored = localStorage.getItem(PROGRESS_KEY);
      if (!stored) {
        return {};
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error loading progress cache:', error);
      return {};
    }
  }
}
