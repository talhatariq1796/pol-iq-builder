'use client';

/**
 * Progress Logger - Log canvassing session progress
 *
 * Allows volunteers/coordinators to log canvassing session progress with two modes:
 * 1. Live Session - Start/stop timer, log as you go with running timer
 * 2. Batch Entry - Log completed session after the fact
 *
 * Features:
 * - Session mode toggle (Live vs Batch)
 * - Running timer display (HH:MM:SS)
 * - Quick-add buttons for doors (+1, +5, +10)
 * - Contact tracking per door
 * - Session summary with validation
 * - Quick stats (today, this week, personal best)
 * - Recent sessions list
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Play,
  Square,
  Plus,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

// Import engines
import { ProgressTracker } from '@/lib/canvassing/ProgressTracker';
import { ProgressStore } from '@/lib/canvassing/ProgressStore';
import { VolunteerStore } from '@/lib/canvassing/VolunteerStore';

// Import types
import type {
  CanvassingSession,
} from '@/lib/canvassing/types-progress';
import type { Volunteer } from '@/lib/canvassing/types-volunteer';

// ============================================================================
// Types
// ============================================================================

interface ProgressLoggerProps {
  universeId: string;
  volunteerId?: string; // Pre-select volunteer
  turfId?: string; // Pre-select turf
  className?: string;
  onSessionLogged?: (session: CanvassingSession) => void;
}

interface TurfOption {
  id: string;
  name: string;
}

interface LiveSessionState {
  sessionId: string | null;
  startTime: Date | null;
  elapsedSeconds: number;
  doorsKnocked: number;
  contactsMade: number;
  isRunning: boolean;
}

interface ValidationWarning {
  type: 'warning' | 'error';
  message: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function ProgressLogger({
  universeId,
  volunteerId: initialVolunteerId,
  turfId: initialTurfId,
  className = '',
  onSessionLogged,
}: ProgressLoggerProps) {
  // ============================================================================
  // State Management
  // ============================================================================

  // Mode: 'live' or 'batch'
  const [mode, setMode] = useState<'live' | 'batch'>('live');

  // Form state
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>(initialVolunteerId || '');
  const [selectedTurfId, setSelectedTurfId] = useState<string>(initialTurfId || '');
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [turfs, setTurfs] = useState<TurfOption[]>([]);

  // Live session state
  const [liveSession, setLiveSession] = useState<LiveSessionState>({
    sessionId: null,
    startTime: null,
    elapsedSeconds: 0,
    doorsKnocked: 0,
    contactsMade: 0,
    isRunning: false,
  });

  // Batch entry state
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [batchStartTime, setBatchStartTime] = useState<string>('09:00');
  const [batchEndTime, setBatchEndTime] = useState<string>('12:00');
  const [batchDoorsKnocked, setBatchDoorsKnocked] = useState<number>(0);
  const [batchContactsMade, setBatchContactsMade] = useState<number>(0);
  const [batchNotes, setBatchNotes] = useState<string>('');

  // Summary dialog
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryNotes, setSummaryNotes] = useState('');
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);

  // Quick stats
  const [todayStats, setTodayStats] = useState({ doors: 0, contacts: 0, hours: 0 });
  const [weekStats, setWeekStats] = useState({ doors: 0, contacts: 0, hours: 0 });
  const [personalBest, setPersonalBest] = useState({ doorsPerHour: 0 });

  // Recent sessions
  const [recentSessions, setRecentSessions] = useState<CanvassingSession[]>([]);

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Effects
  // ============================================================================

  // Load volunteers and turfs on mount
  useEffect(() => {
    loadVolunteers();
    loadTurfs();
  }, [universeId]);

  // Load stats when volunteer changes
  useEffect(() => {
    if (selectedVolunteerId) {
      loadStats();
      loadRecentSessions();
    }
  }, [selectedVolunteerId]);

  // Timer effect for live session
  useEffect(() => {
    if (liveSession.isRunning) {
      timerRef.current = setInterval(() => {
        setLiveSession((prev: LiveSessionState) => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        }));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [liveSession.isRunning]);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadVolunteers = () => {
    // Load volunteers from VolunteerStore
    const storedVolunteers = VolunteerStore.getAllVolunteers();

    // If no volunteers in store, create sample data to help users get started
    if (storedVolunteers.length === 0) {
      const sampleVolunteers: Volunteer[] = [
        {
          id: 'v1',
          name: 'John Smith',
          email: 'john@example.com',
          phone: '555-0101',
          experienceLevel: 'experienced',
          totalDoorsKnocked: 1250,
          totalHoursVolunteered: 32,
          completionRate: 95,
          availableDays: ['saturday', 'sunday'],
          availableTimeSlots: [],
          hasVehicle: true,
          canLeadTeam: true,
          reliabilityScore: 95,
          noShowCount: 0,
          lateStartCount: 1,
          createdAt: new Date().toISOString(),
          activeAssignments: 1,
        },
        {
          id: 'v2',
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          phone: '555-0102',
          experienceLevel: 'new',
          totalDoorsKnocked: 320,
          totalHoursVolunteered: 8,
          completionRate: 88,
          availableDays: ['saturday'],
          availableTimeSlots: [],
          hasVehicle: true,
          canLeadTeam: false,
          reliabilityScore: 90,
          noShowCount: 0,
          lateStartCount: 0,
          createdAt: new Date().toISOString(),
          activeAssignments: 1,
        },
      ];
      setVolunteers(sampleVolunteers);
    } else {
      setVolunteers(storedVolunteers);
    }
  };

  const loadTurfs = () => {
    // Load turfs from assignments for this universe
    const assignments = VolunteerStore.getAssignmentsByUniverse(universeId);

    // Extract unique turfs with their IDs
    const turfMap = new Map<string, string>();
    assignments.forEach(assignment => {
      if (!turfMap.has(assignment.turfId)) {
        // Use turfId as name if we don't have a dedicated turf name field
        // In a real implementation, this would come from a Universe or Turf entity
        turfMap.set(assignment.turfId, assignment.turfId);
      }
    });

    // Convert map to TurfOption array
    const storedTurfs: TurfOption[] = Array.from(turfMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    // If no turfs found, provide sample turfs to help users get started
    if (storedTurfs.length === 0) {
      const sampleTurfs: TurfOption[] = [
        { id: 't1', name: 'Turf A - Downtown' },
        { id: 't2', name: 'Turf B - Eastside' },
        { id: 't3', name: 'Turf C - Westside' },
      ];
      setTurfs(sampleTurfs);
    } else {
      setTurfs(storedTurfs);
    }
  };

  const loadStats = () => {
    if (!selectedVolunteerId) return;

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = ProgressStore.getSessionsByDate(today, universeId)
      .filter(s => s.volunteerId === selectedVolunteerId);

    const todayDoors = todaySessions.reduce((sum, s) => sum + s.doorsKnocked, 0);
    const todayContacts = todaySessions.reduce((sum, s) => sum + s.contactsMade, 0);
    const todayHours = todaySessions.reduce((sum, s) => {
      if (!s.endTime) return sum;
      const duration = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    setTodayStats({ doors: todayDoors, contacts: todayContacts, hours: todayHours });

    // This week's stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekSessions = ProgressStore.getSessionsInRange(
      weekAgo.toISOString().split('T')[0],
      today,
      universeId
    ).filter(s => s.volunteerId === selectedVolunteerId);

    const weekDoors = weekSessions.reduce((sum, s) => sum + s.doorsKnocked, 0);
    const weekContacts = weekSessions.reduce((sum, s) => sum + s.contactsMade, 0);
    const weekHours = weekSessions.reduce((sum, s) => {
      if (!s.endTime) return sum;
      const duration = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    setWeekStats({ doors: weekDoors, contacts: weekContacts, hours: weekHours });

    // Personal best
    const allSessions = ProgressStore.getSessionsByVolunteer(selectedVolunteerId);
    let bestDoorsPerHour = 0;
    for (const session of allSessions) {
      if (session.endTime && session.doorsKnocked > 0) {
        const duration = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60);
        if (duration > 0) {
          const dph = session.doorsKnocked / duration;
          if (dph > bestDoorsPerHour) {
            bestDoorsPerHour = dph;
          }
        }
      }
    }

    setPersonalBest({ doorsPerHour: Math.round(bestDoorsPerHour) });
  };

  const loadRecentSessions = () => {
    if (!selectedVolunteerId) return;
    const sessions = ProgressStore.getSessionsByVolunteer(selectedVolunteerId, 5);
    setRecentSessions(sessions);
  };

  // ============================================================================
  // Live Session Handlers
  // ============================================================================

  const handleStartSession = () => {
    if (!selectedVolunteerId || !selectedTurfId) {
      alert('Please select a volunteer and turf');
      return;
    }

    const session = ProgressTracker.startSession(
      selectedVolunteerId,
      selectedTurfId,
      universeId,
      'assignment-placeholder'
    );

    setLiveSession({
      sessionId: session.id,
      startTime: new Date(session.startTime),
      elapsedSeconds: 0,
      doorsKnocked: 0,
      contactsMade: 0,
      isRunning: true,
    });
  };

  const handleEndSession = () => {
    if (!liveSession.sessionId) return;

    // Stop timer
    setLiveSession((prev: LiveSessionState) => ({ ...prev, isRunning: false }));

    // Validate session
    const warnings = validateSession(
      liveSession.doorsKnocked,
      liveSession.contactsMade,
      liveSession.elapsedSeconds / 3600
    );
    setValidationWarnings(warnings);

    // Show summary dialog
    setShowSummaryDialog(true);
  };

  const handleSaveSession = () => {
    if (!liveSession.sessionId) return;

    const session = ProgressTracker.endSession(liveSession.sessionId, {
      doorsKnocked: liveSession.doorsKnocked,
      contactsMade: liveSession.contactsMade,
      notes: summaryNotes,
    });

    // Reset live session
    setLiveSession({
      sessionId: null,
      startTime: null,
      elapsedSeconds: 0,
      doorsKnocked: 0,
      contactsMade: 0,
      isRunning: false,
    });

    setShowSummaryDialog(false);
    setSummaryNotes('');

    // Reload stats
    loadStats();
    loadRecentSessions();

    // Notify parent
    if (onSessionLogged) {
      onSessionLogged(session);
    }
  };

  const handleAddDoors = (count: number) => {
    setLiveSession((prev: LiveSessionState) => ({
      ...prev,
      doorsKnocked: prev.doorsKnocked + count,
    }));
  };

  const handleAddContact = () => {
    setLiveSession((prev: LiveSessionState) => ({
      ...prev,
      contactsMade: prev.contactsMade + 1,
    }));
  };

  // ============================================================================
  // Batch Entry Handlers
  // ============================================================================

  const handleBatchSubmit = () => {
    if (!selectedVolunteerId || !selectedTurfId) {
      alert('Please select a volunteer and turf');
      return;
    }

    if (batchDoorsKnocked === 0) {
      alert('Please enter doors knocked');
      return;
    }

    // Calculate duration
    const startDateTime = new Date(`${batchDate}T${batchStartTime}`);
    const endDateTime = new Date(`${batchDate}T${batchEndTime}`);
    const durationHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);

    // Validate
    const warnings = validateSession(batchDoorsKnocked, batchContactsMade, durationHours);
    setValidationWarnings(warnings);

    // Check for errors
    const hasErrors = warnings.some(w => w.type === 'error');
    if (hasErrors) {
      alert('Please fix validation errors before submitting');
      return;
    }

    // Log session
    const session = ProgressTracker.logProgress({
      volunteerId: selectedVolunteerId,
      turfId: selectedTurfId,
      universeId,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      doorsKnocked: batchDoorsKnocked,
      contactsMade: batchContactsMade,
      notes: batchNotes,
    });

    // Reset form
    setBatchDoorsKnocked(0);
    setBatchContactsMade(0);
    setBatchNotes('');
    setValidationWarnings([]);

    // Reload stats
    loadStats();
    loadRecentSessions();

    // Notify parent
    if (onSessionLogged) {
      onSessionLogged(session);
    }

    alert('Session logged successfully!');
  };

  // ============================================================================
  // Validation
  // ============================================================================

  const validateSession = (doors: number, contacts: number, hours: number): ValidationWarning[] => {
    const warnings: ValidationWarning[] = [];

    // Contacts > doors is an error
    if (contacts > doors) {
      warnings.push({
        type: 'error',
        message: 'Contacts cannot exceed doors knocked',
      });
    }

    // Duration < 15 min
    if (hours < 0.25) {
      warnings.push({
        type: 'warning',
        message: 'Session seems short (less than 15 minutes)',
      });
    }

    // Doors per hour > 60
    if (hours > 0) {
      const doorsPerHour = doors / hours;
      if (doorsPerHour > 60) {
        warnings.push({
          type: 'warning',
          message: `Unusually high rate: ${Math.round(doorsPerHour)} doors/hour`,
        });
      }
    }

    // Contact rate > 60%
    if (doors > 0) {
      const contactRate = (contacts / doors) * 100;
      if (contactRate > 60) {
        warnings.push({
          type: 'warning',
          message: `Unusually high contact rate: ${Math.round(contactRate)}%`,
        });
      }
    }

    return warnings;
  };

  // ============================================================================
  // Formatting Helpers
  // ============================================================================

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const calculateMetrics = () => {
    const hours = liveSession.elapsedSeconds / 3600;
    const doorsPerHour = hours > 0 ? liveSession.doorsKnocked / hours : 0;
    const contactRate = liveSession.doorsKnocked > 0
      ? (liveSession.contactsMade / liveSession.doorsKnocked) * 100
      : 0;

    return { doorsPerHour, contactRate };
  };

  const calculateBatchMetrics = () => {
    const startDateTime = new Date(`${batchDate}T${batchStartTime}`);
    const endDateTime = new Date(`${batchDate}T${batchEndTime}`);
    const hours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);

    const doorsPerHour = hours > 0 ? batchDoorsKnocked / hours : 0;
    const contactRate = batchDoorsKnocked > 0
      ? (batchContactsMade / batchDoorsKnocked) * 100
      : 0;

    return { hours, doorsPerHour, contactRate };
  };

  // ============================================================================
  // Render
  // ============================================================================

  const liveMetrics = calculateMetrics();
  const batchMetrics = calculateBatchMetrics();

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle>Log Canvassing Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'live' | 'batch')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="live">
                <Play className="w-4 h-4 mr-2" />
                Live Session
              </TabsTrigger>
              <TabsTrigger value="batch">
                <Clock className="w-4 h-4 mr-2" />
                Batch Entry
              </TabsTrigger>
            </TabsList>

            {/* Live Session Mode */}
            <TabsContent value="live" className="space-y-4">
              {/* Volunteer & Turf Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="live-volunteer">Volunteer</Label>
                  <Select
                    value={selectedVolunteerId}
                    onValueChange={setSelectedVolunteerId}
                    disabled={liveSession.isRunning}
                  >
                    <SelectTrigger id="live-volunteer">
                      <SelectValue placeholder="Select volunteer" />
                    </SelectTrigger>
                    <SelectContent>
                      {volunteers.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="live-turf">Turf</Label>
                  <Select
                    value={selectedTurfId}
                    onValueChange={setSelectedTurfId}
                    disabled={liveSession.isRunning}
                  >
                    <SelectTrigger id="live-turf">
                      <SelectValue placeholder="Select turf" />
                    </SelectTrigger>
                    <SelectContent>
                      {turfs.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Session Controls */}
              {!liveSession.isRunning && !liveSession.sessionId && (
                <Button
                  onClick={handleStartSession}
                  className="w-full"
                  disabled={!selectedVolunteerId || !selectedTurfId}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Session
                </Button>
              )}

              {liveSession.isRunning && (
                <div className="space-y-4">
                  {/* Timer Display */}
                  <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
                    <Clock className="w-8 h-8 mr-3 text-primary" />
                    <div className="text-4xl font-mono font-bold">
                      {formatTime(liveSession.elapsedSeconds)}
                    </div>
                  </div>

                  {/* Quick Add Doors */}
                  <div>
                    <Label>Doors Knocked: {liveSession.doorsKnocked}</Label>
                    <div className="flex gap-2 mt-2">
                      <Button onClick={() => handleAddDoors(1)} variant="outline">
                        <Plus className="w-4 h-4 mr-1" />
                        +1 Door
                      </Button>
                      <Button onClick={() => handleAddDoors(5)} variant="outline">
                        <Plus className="w-4 h-4 mr-1" />
                        +5 Doors
                      </Button>
                      <Button onClick={() => handleAddDoors(10)} variant="outline">
                        <Plus className="w-4 h-4 mr-1" />
                        +10 Doors
                      </Button>
                    </div>
                  </div>

                  {/* Contact Tracking */}
                  <div>
                    <Label>Contacts Made: {liveSession.contactsMade}</Label>
                    <Button
                      onClick={handleAddContact}
                      variant="outline"
                      className="w-full mt-2"
                      disabled={liveSession.contactsMade >= liveSession.doorsKnocked}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                  </div>

                  {/* Live Metrics */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">Doors/Hour</div>
                      <div className="text-2xl font-bold">
                        {Math.round(liveMetrics.doorsPerHour)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Contact Rate</div>
                      <div className="text-2xl font-bold">
                        {Math.round(liveMetrics.contactRate)}%
                      </div>
                    </div>
                  </div>

                  {/* End Session Button */}
                  <Button
                    onClick={handleEndSession}
                    variant="destructive"
                    className="w-full"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    End Session
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Batch Entry Mode */}
            <TabsContent value="batch" className="space-y-4">
              {/* Volunteer & Turf Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batch-volunteer">Volunteer</Label>
                  <Select
                    value={selectedVolunteerId}
                    onValueChange={setSelectedVolunteerId}
                  >
                    <SelectTrigger id="batch-volunteer">
                      <SelectValue placeholder="Select volunteer" />
                    </SelectTrigger>
                    <SelectContent>
                      {volunteers.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="batch-turf">Turf</Label>
                  <Select
                    value={selectedTurfId}
                    onValueChange={setSelectedTurfId}
                  >
                    <SelectTrigger id="batch-turf">
                      <SelectValue placeholder="Select turf" />
                    </SelectTrigger>
                    <SelectContent>
                      {turfs.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <Label htmlFor="batch-date">Date</Label>
                <Input
                  id="batch-date"
                  type="date"
                  value={batchDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBatchDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batch-start-time">Start Time</Label>
                  <Input
                    id="batch-start-time"
                    type="time"
                    value={batchStartTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBatchStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="batch-end-time">End Time</Label>
                  <Input
                    id="batch-end-time"
                    type="time"
                    value={batchEndTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBatchEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Duration Display */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="text-lg font-semibold">
                  {batchMetrics.hours > 0 ? `${batchMetrics.hours.toFixed(1)} hours` : '--'}
                </div>
              </div>

              {/* Doors & Contacts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batch-doors">Doors Knocked</Label>
                  <Input
                    id="batch-doors"
                    type="number"
                    min="0"
                    value={batchDoorsKnocked || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBatchDoorsKnocked(Number(e.target.value))}
                  />
                </div>

                <div>
                  <Label htmlFor="batch-contacts">Contacts Made</Label>
                  <Input
                    id="batch-contacts"
                    type="number"
                    min="0"
                    max={batchDoorsKnocked}
                    value={batchContactsMade || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBatchContactsMade(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Calculated Metrics */}
              {batchDoorsKnocked > 0 && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Doors/Hour</div>
                    <div className="text-2xl font-bold">
                      {Math.round(batchMetrics.doorsPerHour)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Contact Rate</div>
                    <div className="text-2xl font-bold">
                      {Math.round(batchMetrics.contactRate)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Warnings */}
              {validationWarnings.length > 0 && (
                <div className="space-y-2">
                  {validationWarnings.map((warning, idx) => (
                    <Alert
                      key={idx}
                      variant={warning.type === 'error' ? 'destructive' : 'default'}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>{warning.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div>
                <Label htmlFor="batch-notes">Notes (optional)</Label>
                <Textarea
                  id="batch-notes"
                  value={batchNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchNotes(e.target.value)}
                  placeholder="Any observations, issues, or highlights from the session..."
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleBatchSubmit}
                className="w-full"
                disabled={!selectedVolunteerId || !selectedTurfId || batchDoorsKnocked === 0}
              >
                Log Session
              </Button>
            </TabsContent>
          </Tabs>

          {/* Quick Stats */}
          {selectedVolunteerId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Today</span>
                  <div className="flex gap-4">
                    <Badge variant="secondary">
                      {todayStats.doors} doors
                    </Badge>
                    <Badge variant="secondary">
                      {todayStats.contacts} contacts
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">This Week</span>
                  <div className="flex gap-4">
                    <Badge variant="secondary">
                      {weekStats.doors} doors
                    </Badge>
                    <Badge variant="secondary">
                      {weekStats.hours.toFixed(1)} hrs
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Personal Best</span>
                  <Badge variant="outline">
                    {personalBest.doorsPerHour} doors/hr
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Sessions */}
          {recentSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentSessions.map(session => {
                    const duration = session.endTime
                      ? ((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60)).toFixed(1)
                      : 'Active';
                    const date = new Date(session.startTime).toLocaleDateString();

                    return (
                      <div
                        key={session.id}
                        className="flex justify-between items-center p-2 border rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <div>
                          <div className="text-sm font-medium">{date}</div>
                          <div className="text-xs text-muted-foreground">
                            {session.doorsKnocked} doors, {session.contactsMade} contacts
                          </div>
                        </div>
                        <Badge variant="outline">
                          {typeof duration === 'string' ? duration : `${duration} hrs`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Session Summary Dialog */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Summary</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="text-xl font-bold">
                  {formatTime(liveSession.elapsedSeconds)}
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Doors Knocked</div>
                <div className="text-xl font-bold">{liveSession.doorsKnocked}</div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Contacts Made</div>
                <div className="text-xl font-bold">{liveSession.contactsMade}</div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Contact Rate</div>
                <div className="text-xl font-bold">
                  {Math.round(liveMetrics.contactRate)}%
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Doors per Hour</div>
              <div className="text-xl font-bold">
                {Math.round(liveMetrics.doorsPerHour)}
              </div>
            </div>

            {/* Validation Warnings */}
            {validationWarnings.length > 0 && (
              <div className="space-y-2">
                {validationWarnings.map((warning, idx) => (
                  <Alert
                    key={idx}
                    variant={warning.type === 'error' ? 'destructive' : 'default'}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{warning.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="summary-notes">Notes (optional)</Label>
              <Textarea
                id="summary-notes"
                value={summaryNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSummaryNotes(e.target.value)}
                placeholder="Any observations, issues, or highlights from the session..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSummaryDialog(false);
                setLiveSession((prev: LiveSessionState) => ({ ...prev, isRunning: true }));
              }}
            >
              Resume Session
            </Button>
            <Button onClick={handleSaveSession}>
              Save Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
