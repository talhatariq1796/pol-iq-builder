'use client';

/**
 * Progress Dashboard - Real-time canvassing progress tracking
 *
 * Features:
 * 1. Universe Selector - Dropdown to select canvassing universe
 * 2. Summary Cards - Total doors, contacts, completion %, contact rate, volunteers, hours
 * 3. Turf Progress Table - Status, progress, assignments, last activity
 * 4. Stalled Turfs Alert - Turfs with no activity in 48+ hours
 * 5. Volunteer Leaderboard - Top 5 volunteers by doors knocked
 * 6. Trend Chart placeholder - For future daily progress visualization
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  MapPin,
  Clock,
  Target,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

// Import progress tracking engines
import { ProgressTracker } from '@/lib/canvassing/ProgressTracker';
import { ProgressAggregator } from '@/lib/canvassing/ProgressAggregator';
import { ProgressStore } from '@/lib/canvassing/ProgressStore';
import { canvassingStore } from '@/lib/canvassing/CanvassingStore';

// Import types
import type {
  UniverseProgress,
  TurfProgress,
  StalledTurfAlert,
} from '@/lib/canvassing/types-progress';
import type { CanvassingUniverse, CanvassingTurf } from '@/lib/canvassing/types';

// ============================================================================
// Types
// ============================================================================

interface ProgressDashboardProps {
  universeId?: string; // Optional initial universe
  className?: string;
}

interface VolunteerStats {
  volunteerId: string;
  volunteerName: string;
  doorsKnocked: number;
  contactsMade: number;
  hoursWorked: number;
  sessionsCount: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function ProgressDashboard({
  universeId: initialUniverseId,
  className,
}: ProgressDashboardProps) {
  // ============================================================================
  // State Management
  // ============================================================================

  const [selectedUniverseId, setSelectedUniverseId] = useState<string | null>(
    initialUniverseId || null
  );
  const [availableUniverses, setAvailableUniverses] = useState<CanvassingUniverse[]>([]);
  const [universeProgress, setUniverseProgress] = useState<UniverseProgress | null>(null);
  const [turfProgressList, setTurfProgressList] = useState<TurfProgress[]>([]);
  const [stalledTurfs, setStalledTurfs] = useState<StalledTurfAlert[]>([]);
  const [volunteerStats, setVolunteerStats] = useState<VolunteerStats[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Data Loading
  // ============================================================================

  // Load available universes on mount
  useEffect(() => {
    loadAvailableUniverses();
  }, []);

  // Load progress data when universe changes
  useEffect(() => {
    if (selectedUniverseId) {
      loadProgressData(selectedUniverseId);
    }
  }, [selectedUniverseId]);

  const loadAvailableUniverses = () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load saved canvassing universes from client-side store
      const universes = canvassingStore.getAllSorted();
      setAvailableUniverses(universes);

      // Auto-select first universe if none selected
      if (!selectedUniverseId && universes.length > 0) {
        setSelectedUniverseId(universes[0].id);
      }
    } catch (err) {
      console.error('Error loading universes:', err);
      setError('Failed to load canvassing universes');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProgressData = (universeId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Get universe from client-side store
      const universe = canvassingStore.get(universeId);
      if (!universe) {
        throw new Error('Universe not found');
      }

      // Generate turfs from universe precincts for progress tracking
      const turfs: CanvassingTurf[] = universe.precincts.map((precinct, index) => ({
        turfId: `turf-${precinct.precinctId}`,
        turfName: precinct.precinctName || `Turf ${index + 1}`,
        precinctIds: [precinct.precinctId],
        estimatedDoors: precinct.estimatedDoors,
        estimatedHours: precinct.estimatedHours,
        doorsPerHour: universe.targetDoorsPerHour || 40,
        density: 'suburban' as const, // Default; could be derived from precinct data
        priority: precinct.priorityRank,
        avgGotvPriority: precinct.gotvPriority,
        avgPersuasionOpportunity: precinct.persuasionOpportunity,
      }));

      // Use ProgressTracker to get progress data (client-side localStorage)
      const progressSummary = ProgressTracker.generateProgressSummary(universeId, turfs);

      // Set data from client-side computation
      setUniverseProgress(progressSummary.overview);
      setTurfProgressList(progressSummary.topPerformingTurfs);
      setStalledTurfs(progressSummary.stalledTurfs);

      // Get volunteer stats from sessions
      const sessions = ProgressStore.getSessionsByUniverse(universeId);
      const volunteerMap = new Map<string, VolunteerStats>();

      for (const session of sessions) {
        const existing = volunteerMap.get(session.volunteerId);
        const duration = session.endTime
          ? (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60)
          : 0;

        if (existing) {
          existing.doorsKnocked += session.doorsKnocked;
          existing.contactsMade += session.contactsMade;
          existing.hoursWorked += duration;
          existing.sessionsCount += 1;
        } else {
          volunteerMap.set(session.volunteerId, {
            volunteerId: session.volunteerId,
            volunteerName: session.volunteerId, // Could be enhanced with volunteer roster lookup
            doorsKnocked: session.doorsKnocked,
            contactsMade: session.contactsMade,
            hoursWorked: duration,
            sessionsCount: 1,
          });
        }
      }

      setVolunteerStats(Array.from(volunteerMap.values()));
    } catch (err) {
      console.error('Error loading progress data:', err);
      setError('Failed to load progress data');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Status Helpers
  // ============================================================================

  const getStatusBadge = (status: TurfProgress['status']) => {
    const variants = {
      not_started: { variant: 'secondary' as const, label: 'Not Started', color: 'text-gray-600' },
      in_progress: { variant: 'default' as const, label: 'In Progress', color: 'text-blue-600' },
      stalled: { variant: 'destructive' as const, label: 'Stalled', color: 'text-orange-600' },
      complete: { variant: 'default' as const, label: 'Complete', color: 'text-green-600' },
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant} className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const formatHours = (hours: number) => {
    return hours.toFixed(1);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const topVolunteers = useMemo(() => {
    return [...volunteerStats]
      .sort((a, b) => b.doorsKnocked - a.doorsKnocked)
      .slice(0, 5);
  }, [volunteerStats]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header & Universe Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Canvassing Progress</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time tracking of door-knocking operations
            </p>
          </div>

          {availableUniverses.length > 0 && (
            <div className="w-80">
              <Select
                value={selectedUniverseId || ''}
                onValueChange={setSelectedUniverseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select universe..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUniverses.map((universe) => (
                    <SelectItem key={universe.id} value={universe.id}>
                      {universe.name} ({universe.totalPrecincts} precincts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        {universeProgress && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Total Doors Knocked */}
            <Card className="rounded-lg shadow-md border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-950 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Doors Knocked
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <div className="text-2xl font-bold">
                    {formatNumber(universeProgress.totalDoorsKnocked)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  of {formatNumber(universeProgress.totalTargetDoors)} target
                </div>
                <Progress
                  value={universeProgress.overallPercentComplete}
                  className="mt-2 h-1.5"
                />
              </CardContent>
            </Card>

            {/* Total Contacts */}
            <Card className="rounded-lg shadow-md border-l-4 border-l-green-500 bg-gradient-to-br from-white to-green-50 dark:from-gray-800 dark:to-green-950 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Contacts Made
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <div className="text-2xl font-bold">
                    {formatNumber(universeProgress.totalContacts)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatPercent(universeProgress.overallContactRate * 100)} contact rate
                </div>
              </CardContent>
            </Card>

            {/* Completion Percentage */}
            <Card className="rounded-lg shadow-md border-l-4 border-l-purple-500 bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-950 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  <div className="text-2xl font-bold">
                    {formatPercent(universeProgress.overallPercentComplete)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatNumber(universeProgress.totalDoorsRemaining)} doors remaining
                </div>
              </CardContent>
            </Card>

            {/* Active Volunteers */}
            <Card className="rounded-lg shadow-md border-l-4 border-l-orange-500 bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-orange-950 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Volunteers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  <div className="text-2xl font-bold">
                    {universeProgress.activeVolunteers}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {universeProgress.uniqueVolunteers} total volunteers
                </div>
              </CardContent>
            </Card>

            {/* Hours Logged */}
            <Card className="rounded-lg shadow-md border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50 dark:from-gray-800 dark:to-emerald-950 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Hours Logged
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <div className="text-2xl font-bold">
                    {formatNumber(universeProgress.totalHoursSpent)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatNumber(universeProgress.averageDoorsPerHour)} doors/hour avg
                </div>
              </CardContent>
            </Card>

            {/* Average Contact Rate */}
            <Card className="rounded-lg shadow-md border-l-4 border-l-indigo-500 bg-gradient-to-br from-white to-indigo-50 dark:from-gray-800 dark:to-indigo-950 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Contact Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                  <div className="text-2xl font-bold">
                    {formatPercent(universeProgress.overallContactRate * 100)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatNumber(universeProgress.totalSessions)} sessions
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stalled Turfs Alert */}
        {stalledTurfs.length > 0 && (
          <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  {stalledTurfs.length} turf{stalledTurfs.length > 1 ? 's' : ''} with no activity in 48+ hours
                </p>
                <div className="space-y-1">
                  {stalledTurfs.slice(0, 3).map((turf) => (
                    <div key={turf.turfId} className="text-sm text-orange-700 dark:text-orange-300">
                      <span className="font-medium">{turf.turfName}</span> - {turf.daysInactive} days inactive ({formatPercent(turf.percentComplete)} complete)
                      <span className="ml-2 text-xs">
                        Suggested: {turf.suggestedAction === 'reassign' ? 'Reassign volunteer' : turf.suggestedAction === 'follow_up' ? 'Contact volunteer' : 'Archive turf'}
                      </span>
                    </div>
                  ))}
                  {stalledTurfs.length > 3 && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      +{stalledTurfs.length - 3} more stalled turfs
                    </p>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Turf Progress Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Turf Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Turf Name</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Doors Knocked</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">% Complete</TableHead>
                      <TableHead className="text-right">Contact Rate</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {turfProgressList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No turf data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      turfProgressList.map((turf) => (
                        <TableRow key={turf.turfId}>
                          <TableCell className="font-medium">{turf.turfName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {turf.uniqueVolunteers} volunteer{turf.uniqueVolunteers !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell>{getStatusBadge(turf.status)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(turf.doorsKnocked)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(turf.targetDoors)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-medium">
                                {formatPercent(turf.percentComplete)}
                              </span>
                              <Progress value={turf.percentComplete} className="h-1.5 w-16" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(turf.contactRate * 100)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(turf.lastActivityDate)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Volunteer Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle>Top Volunteers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topVolunteers.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No volunteer data available
                  </div>
                ) : (
                  topVolunteers.map((volunteer, index) => (
                    <div
                      key={volunteer.volunteerId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0
                            ? 'bg-yellow-500 text-white'
                            : index === 1
                            ? 'bg-gray-400 text-white'
                            : index === 2
                            ? 'bg-orange-600 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {volunteer.volunteerName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(volunteer.doorsKnocked)} doors • {formatNumber(volunteer.contactsMade)} contacts
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatHours(volunteer.hoursWorked)}h
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {volunteer.sessionsCount} shifts
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Doors Knocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              <div className="text-center space-y-2">
                <TrendingUp className="h-12 w-12 mx-auto" />
                <p className="text-sm">Daily trend chart coming soon</p>
                <p className="text-xs text-muted-foreground">
                  Visualize doors knocked per day over time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {!selectedUniverseId && availableUniverses.length === 0 && !isLoading && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <Target className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Canvassing Universes Found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Create a canvassing universe in the Canvassing Planner to start tracking progress.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
