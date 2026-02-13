'use client';

import React, { useState, useEffect } from 'react';
import { VolunteerManager } from '@/lib/canvassing/VolunteerManager';
import { AssignmentEngine } from '@/lib/canvassing/AssignmentEngine';
import { VolunteerStore } from '@/lib/canvassing/VolunteerStore';
import type { Volunteer, TurfAssignment, VolunteerRecommendation, AssignmentValidation } from '@/lib/canvassing/types-volunteer';
import type { CanvassingTurf } from '@/lib/canvassing/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, MapPin, AlertTriangle, CheckCircle, Star, Clock } from 'lucide-react';

interface AssignmentPanelProps {
  universeId: string;
  turfs: CanvassingTurf[];
  className?: string;
  onAssignmentComplete?: () => void;
}

type TurfFilter = 'all' | 'unassigned' | 'assigned';

export function AssignmentPanel({
  universeId,
  turfs,
  className = '',
  onAssignmentComplete
}: AssignmentPanelProps) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [assignments, setAssignments] = useState<TurfAssignment[]>([]);
  const [selectedTurf, setSelectedTurf] = useState<CanvassingTurf | null>(null);
  const [recommendations, setRecommendations] = useState<VolunteerRecommendation[]>([]);
  const [turfFilter, setTurfFilter] = useState<TurfFilter>('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTurfIds, setSelectedTurfIds] = useState<Set<string>>(new Set());

  // Assignment dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [validation, setValidation] = useState<AssignmentValidation | null>(null);
  const [expectedCompletion, setExpectedCompletion] = useState('');
  const [assignmentPriority, setAssignmentPriority] = useState<1 | 2 | 3 | 4 | 5>(3);

  // Load volunteers and assignments
  useEffect(() => {
    setVolunteers(VolunteerManager.getAllVolunteers());
    setAssignments(VolunteerStore.getAssignmentsByUniverse(universeId));
  }, [universeId]);

  // Load recommendations when turf is selected
  useEffect(() => {
    if (selectedTurf) {
      const recs = AssignmentEngine.recommendVolunteers(selectedTurf, { limit: 5 });
      setRecommendations(recs);
    } else {
      setRecommendations([]);
    }
  }, [selectedTurf]);

  // Get turf status
  const getTurfStatus = (turfId: string): 'unassigned' | 'assigned' | 'in_progress' => {
    const assignment = assignments.find(a => a.turfId === turfId && a.status !== 'cancelled');
    if (!assignment) return 'unassigned';
    if (assignment.status === 'completed' || assignment.status === 'assigned') return 'assigned';
    return 'in_progress';
  };

  // Get assigned volunteer name
  const getAssignedVolunteer = (turfId: string): string => {
    const assignment = assignments.find(a => a.turfId === turfId);
    if (!assignment) return '-';
    const volunteer = volunteers.find(v => v.id === assignment.volunteerId);
    return volunteer ? volunteer.name : 'Unknown';
  };

  // Filter turfs
  const filteredTurfs = turfs.filter(turf => {
    const status = getTurfStatus(turf.turfId);
    if (turfFilter === 'unassigned') return status === 'unassigned';
    if (turfFilter === 'assigned') return status !== 'unassigned';
    return true;
  });

  // Handle turf selection
  const handleTurfSelect = (turf: CanvassingTurf) => {
    if (bulkMode) {
      const newSelected = new Set(selectedTurfIds);
      if (newSelected.has(turf.turfId)) {
        newSelected.delete(turf.turfId);
      } else {
        newSelected.add(turf.turfId);
      }
      setSelectedTurfIds(newSelected);
    } else {
      setSelectedTurf(turf);
    }
  };

  // Open assignment dialog
  const handleAssignClick = (volunteer: Volunteer) => {
    if (!selectedTurf) return;

    const validationResult = AssignmentEngine.validateAssignment(volunteer, selectedTurf, universeId);

    setSelectedVolunteer(volunteer);
    setValidation(validationResult);
    setExpectedCompletion('');
    setAssignmentPriority(3);
    setShowAssignDialog(true);
  };

  // Convert numeric priority to string
  const priorityMap: Record<number, 'low' | 'medium' | 'high' | 'urgent'> = {
    1: 'urgent',
    2: 'high',
    3: 'medium',
    4: 'low',
    5: 'low',
  };

  // Confirm assignment
  const handleConfirmAssignment = () => {
    if (!selectedVolunteer || !selectedTurf) return;

    try {
      VolunteerManager.assignTurf(
        selectedVolunteer.id,
        selectedTurf.turfId,
        universeId,
        {
          priority: priorityMap[assignmentPriority],
          expectedCompletionDate: expectedCompletion || undefined
        }
      );

      // Refresh assignments
      setAssignments(VolunteerStore.getAssignmentsByUniverse(universeId));
      setShowAssignDialog(false);
      setSelectedTurf(null);
      onAssignmentComplete?.();
    } catch (error) {
      console.error('Failed to assign volunteer:', error);
    }
  };

  // Bulk auto-assign - simplified approach
  const handleBulkAutoAssign = () => {
    const turfIdsToAssign = Array.from(selectedTurfIds);
    const selectedTurfs = turfs.filter(t => turfIdsToAssign.includes(t.turfId));

    // Simple greedy assignment: for each turf, find best available volunteer
    for (const turf of selectedTurfs) {
      const recommendations = AssignmentEngine.recommendVolunteers(turf, { limit: 1 });
      if (recommendations.length > 0) {
        const bestVolunteer = recommendations[0].volunteer;
        try {
          VolunteerManager.assignTurf(bestVolunteer.id, turf.turfId, universeId);
        } catch (error) {
          console.error(`Failed to assign ${bestVolunteer.name} to ${turf.turfName}:`, error);
        }
      }
    }

    // Refresh and reset
    setAssignments(VolunteerStore.getAssignmentsByUniverse(universeId));
    setVolunteers(VolunteerManager.getAllVolunteers()); // Refresh volunteer counts
    setSelectedTurfIds(new Set());
    setBulkMode(false);
    onAssignmentComplete?.();
  };

  // Get status badge
  const getStatusBadge = (status: 'unassigned' | 'assigned' | 'in_progress') => {
    const variants: Record<typeof status, { variant: 'destructive' | 'default' | 'secondary', label: string }> = {
      unassigned: { variant: 'destructive', label: 'Unassigned' },
      assigned: { variant: 'default', label: 'Assigned' },
      in_progress: { variant: 'secondary', label: 'In Progress' }
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Get priority badge
  const getPriorityBadge = (priority: number) => {
    const colors: Record<number, string> = {
      1: 'bg-red-500 text-white',
      2: 'bg-orange-500 text-white',
      3: 'bg-yellow-500 text-black',
      4: 'bg-blue-500 text-white',
      5: 'bg-gray-500 text-white'
    };
    return <Badge className={colors[priority] || colors[3]}>{priority}</Badge>;
  };

  // Get match score badge
  const getMatchScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500 text-white">{score}</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500 text-black">{score}</Badge>;
    return <Badge variant="secondary">{score}</Badge>;
  };

  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      {/* Left Panel: Turfs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Turfs ({filteredTurfs.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={turfFilter} onValueChange={(v) => setTurfFilter(v as TurfFilter)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Turfs</SelectItem>
                  <SelectItem value="unassigned">Unassigned Only</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={bulkMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedTurfIds(new Set());
                }}
              >
                Bulk Mode
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {bulkMode && <TableHead className="w-12"></TableHead>}
                  <TableHead>Turf Name</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Est. Doors</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTurfs.map(turf => {
                  const status = getTurfStatus(turf.turfId);
                  const assignedTo = getAssignedVolunteer(turf.turfId);
                  const isSelected = bulkMode ? selectedTurfIds.has(turf.turfId) : selectedTurf?.turfId === turf.turfId;

                  return (
                    <TableRow
                      key={turf.turfId}
                      className={`cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => handleTurfSelect(turf)}
                    >
                      {bulkMode && (
                        <TableCell>
                          <Checkbox checked={selectedTurfIds.has(turf.turfId)} />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{turf.turfName}</TableCell>
                      <TableCell>{getPriorityBadge(turf.priority)}</TableCell>
                      <TableCell>{turf.estimatedDoors}</TableCell>
                      <TableCell>{getStatusBadge(status)}</TableCell>
                      <TableCell>{assignedTo}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {bulkMode && selectedTurfIds.size > 0 && (
            <div className="mt-4 flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedTurfIds.size} turf{selectedTurfIds.size !== 1 ? 's' : ''} selected
              </span>
              <Button onClick={handleBulkAutoAssign}>
                Auto-Assign Selected
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Panel: Volunteers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {selectedTurf ? `Volunteers for "${selectedTurf.turfName}"` : 'Select a Turf'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedTurf ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mb-4" />
              <p>Select a turf to view volunteer recommendations</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Recommended Volunteers */}
              {recommendations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <h3 className="font-semibold">Recommended Volunteers</h3>
                  </div>
                  <div className="space-y-2">
                    {recommendations.map(rec => (
                        <Card key={rec.volunteer.id} className="p-3 bg-yellow-50 border-yellow-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{rec.volunteer.name}</span>
                                {getMatchScoreBadge(rec.score)}
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Experience: {rec.volunteer.experienceLevel} | Active: {rec.volunteer.activeAssignments} | Reliability: {rec.volunteer.reliabilityScore}%</div>
                                {rec.reasons.length > 0 && (
                                  <div className="flex items-start gap-1 text-green-700">
                                    <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span>{rec.reasons.join(', ')}</span>
                                  </div>
                                )}
                                {rec.warnings && rec.warnings.length > 0 && (
                                  <div className="flex items-start gap-1 text-orange-700">
                                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span>{rec.warnings.join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAssignClick(rec.volunteer)}
                            >
                              Assign
                            </Button>
                          </div>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {/* All Volunteers */}
              <div>
                <h3 className="font-semibold mb-3">All Volunteers</h3>
                <div className="rounded-md border max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Experience</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Reliability</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {volunteers.map(volunteer => {
                        const rec = recommendations.find(r => r.volunteer.id === volunteer.id);

                        return (
                          <TableRow key={volunteer.id}>
                            <TableCell className="font-medium">{volunteer.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{volunteer.experienceLevel}</Badge>
                            </TableCell>
                            <TableCell>{volunteer.activeAssignments}</TableCell>
                            <TableCell>{volunteer.reliabilityScore}%</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {rec && getMatchScoreBadge(rec.score)}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAssignClick(volunteer)}
                                >
                                  Assign
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Volunteer to Turf</DialogTitle>
            <DialogDescription>
              Assign {selectedVolunteer?.name} to {selectedTurf?.turfName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Validation Warnings/Errors */}
            {validation && !validation.isValid && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation && validation.isValid && validation.warnings.length > 0 && (
              <Alert className="border-orange-500 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <ul className="list-disc list-inside space-y-1">
                    {validation.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Assignment Options */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <Select
                  value={String(assignmentPriority)}
                  onValueChange={(v) => setAssignmentPriority(Number(v) as 1 | 2 | 3 | 4 | 5)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Highest</SelectItem>
                    <SelectItem value="2">2 - High</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - Low</SelectItem>
                    <SelectItem value="5">5 - Lowest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Expected Completion Date
                </label>
                <Input
                  type="date"
                  value={expectedCompletion}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpectedCompletion(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAssignment}
              disabled={validation ? !validation.isValid : false}
            >
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
