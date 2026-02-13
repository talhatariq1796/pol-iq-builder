'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { VolunteerManager } from '@/lib/canvassing/VolunteerManager';
import { VolunteerStore } from '@/lib/canvassing/VolunteerStore';
import { AssignmentEngine } from '@/lib/canvassing/AssignmentEngine';
import type { Volunteer, ExperienceLevel } from '@/lib/canvassing/types-volunteer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Car,
  Star,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  TrendingUp,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface VolunteerRosterProps {
  universeId?: string;
  className?: string;
  onVolunteerSelect?: (volunteer: Volunteer) => void;
}

type SortField = 'name' | 'experience' | 'activeTurfs' | 'completedTurfs' | 'totalDoors' | 'reliability';
type SortDirection = 'asc' | 'desc';

// Memoized volunteer row component for performance with large rosters
const VolunteerRow = React.memo(function VolunteerRow({
  volunteer,
  isSelected,
  onToggleSelect,
  onRowClick,
  getExperienceBadgeVariant,
  getReliabilityBgColor,
  getReliabilityColor,
}: {
  volunteer: Volunteer;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onRowClick: (volunteer: Volunteer) => void;
  getExperienceBadgeVariant: (level: ExperienceLevel) => 'default' | 'secondary' | 'outline';
  getReliabilityBgColor: (score: number) => string;
  getReliabilityColor: (score: number) => string;
}) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => onRowClick(volunteer)}
    >
      <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(volunteer.id)}
        />
      </TableCell>
      <TableCell className="font-medium">{volunteer.name}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Mail className="h-3 w-3" />
            {volunteer.email}
          </div>
          {volunteer.phone && (
            <div className="flex items-center gap-1 text-gray-600">
              <Phone className="h-3 w-3" />
              {volunteer.phone}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getExperienceBadgeVariant(volunteer.experienceLevel)}>
          {volunteer.experienceLevel === 'new' && 'New'}
          {volunteer.experienceLevel === 'experienced' && 'Experienced'}
          {volunteer.experienceLevel === 'team_leader' && 'Team Leader'}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline">
          {volunteer.activeAssignments}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="bg-green-50">
          {Math.round(volunteer.completionRate)}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-medium">
        {volunteer.totalDoorsKnocked.toLocaleString()}
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={getReliabilityBgColor(volunteer.reliabilityScore)}
        >
          <Star className={`h-3 w-3 mr-1 ${getReliabilityColor(volunteer.reliabilityScore)}`} />
          <span className={getReliabilityColor(volunteer.reliabilityScore)}>
            {volunteer.reliabilityScore.toFixed(0)}
          </span>
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {volunteer.hasVehicle && (
            <Badge variant="outline" className="text-xs">
              <Car className="h-3 w-3" />
            </Badge>
          )}
          {(volunteer.tags || []).slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {(volunteer.tags || []).length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{(volunteer.tags || []).length - 2}
            </Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

export function VolunteerRoster({
  universeId,
  className = '',
  onVolunteerSelect,
}: VolunteerRosterProps) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [experienceFilter, setExperienceFilter] = useState<ExperienceLevel | 'all'>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [reliabilityFilter, setReliabilityFilter] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Form state for add/edit
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    experienceLevel: 'new' as ExperienceLevel,
    hasVehicle: false,
    availability: [] as string[],
    preferredAreas: [] as string[],
    notes: '',
  });

  useEffect(() => {
    loadVolunteers();
  }, [universeId]);

  const loadVolunteers = async () => {
    setLoading(true);
    try {
      const allVolunteers = VolunteerManager.getAllVolunteers();

      // Filter by universe if specified
      if (universeId) {
        const assignments = VolunteerStore.getAssignmentsByUniverse(universeId);
        const volunteerIds = new Set(assignments.map(a => a.volunteerId));
        setVolunteers(allVolunteers.filter(v => volunteerIds.has(v.id)));
      } else {
        setVolunteers(allVolunteers);
      }
    } catch (error) {
      console.error('Failed to load volunteers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered and sorted volunteers
  const filteredVolunteers = useMemo(() => {
    let filtered = volunteers.filter(v => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          v.name.toLowerCase().includes(query) ||
          v.email.toLowerCase().includes(query) ||
          (v.phone && v.phone.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Experience filter
      if (experienceFilter !== 'all' && v.experienceLevel !== experienceFilter) {
        return false;
      }

      // Availability filter
      if (availabilityFilter !== 'all' && !v.availableDays.includes(availabilityFilter)) {
        return false;
      }

      // Vehicle filter
      if (vehicleFilter === 'yes' && !v.hasVehicle) return false;
      if (vehicleFilter === 'no' && v.hasVehicle) return false;

      // Reliability filter
      const reliability = v.reliabilityScore;
      if (reliabilityFilter === 'high' && reliability < 80) return false;
      if (reliabilityFilter === 'medium' && (reliability < 60 || reliability >= 80)) return false;
      if (reliabilityFilter === 'low' && reliability >= 60) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'experience':
          const expOrder: Record<ExperienceLevel, number> = {
            new: 1,
            experienced: 2,
            team_leader: 3,
          };
          aVal = expOrder[a.experienceLevel];
          bVal = expOrder[b.experienceLevel];
          break;
        case 'activeTurfs':
          aVal = a.activeAssignments;
          bVal = b.activeAssignments;
          break;
        case 'completedTurfs':
          aVal = a.completionRate;
          bVal = b.completionRate;
          break;
        case 'totalDoors':
          aVal = a.totalDoorsKnocked;
          bVal = b.totalDoorsKnocked;
          break;
        case 'reliability':
          aVal = a.reliabilityScore;
          bVal = b.reliabilityScore;
          break;
        default:
          aVal = a.name;
          bVal = b.name;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [volunteers, searchQuery, experienceFilter, availabilityFilter, vehicleFilter, reliabilityFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    setDetailDialogOpen(true);
    onVolunteerSelect?.(volunteer);
  };

  const handleAddVolunteer = async () => {
    try {
      VolunteerStore.saveVolunteer({
        id: crypto.randomUUID(),
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        experienceLevel: formData.experienceLevel,
        totalDoorsKnocked: 0,
        totalHoursVolunteered: 0,
        completionRate: 100,
        availableDays: formData.availability,
        availableTimeSlots: [],
        hasVehicle: formData.hasVehicle,
        canLeadTeam: false,
        reliabilityScore: 100,
        noShowCount: 0,
        lateStartCount: 0,
        notes: formData.notes || '',
        createdAt: new Date().toISOString(),
        activeAssignments: 0,
      });
      setAddDialogOpen(false);
      resetForm();
      loadVolunteers();
    } catch (error) {
      console.error('Failed to add volunteer:', error);
    }
  };

  const handleDeleteVolunteer = async (volunteerId: string) => {
    if (!confirm('Are you sure you want to delete this volunteer?')) return;

    try {
      VolunteerStore.deleteVolunteer(volunteerId);
      setDetailDialogOpen(false);
      loadVolunteers();
    } catch (error) {
      console.error('Failed to delete volunteer:', error);
    }
  };

  const handleToggleSelect = (volunteerId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(volunteerId)) {
      newSelected.delete(volunteerId);
    } else {
      newSelected.add(volunteerId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredVolunteers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVolunteers.map(v => v.id)));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      experienceLevel: 'new',
      hasVehicle: false,
      availability: [],
      preferredAreas: [],
      notes: '',
    });
  };

  const getExperienceBadgeVariant = (level: ExperienceLevel) => {
    switch (level) {
      case 'new':
        return 'secondary';
      case 'experienced':
        return 'default';
      case 'team_leader':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getReliabilityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getReliabilityBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-50';
    if (score >= 70) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>Volunteer Roster</CardTitle>
              <Badge variant="secondary">{filteredVolunteers.length} volunteers</Badge>
            </div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Volunteer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search volunteers..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Experience Filter */}
            <Select value={experienceFilter} onValueChange={(v) => setExperienceFilter(v as ExperienceLevel | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="Experience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Experience</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="experienced">Experienced</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
              </SelectContent>
            </Select>

            {/* Availability Filter */}
            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Availability</SelectItem>
                <SelectItem value="weekday_morning">Weekday Morning</SelectItem>
                <SelectItem value="weekday_evening">Weekday Evening</SelectItem>
                <SelectItem value="weekend">Weekend</SelectItem>
              </SelectContent>
            </Select>

            {/* Vehicle Filter */}
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Volunteers</SelectItem>
                <SelectItem value="yes">Has Vehicle</SelectItem>
                <SelectItem value="no">No Vehicle</SelectItem>
              </SelectContent>
            </Select>

            {/* Reliability Filter */}
            <Select value={reliabilityFilter} onValueChange={setReliabilityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Reliability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reliability</SelectItem>
                <SelectItem value="high">80+ (High)</SelectItem>
                <SelectItem value="medium">60-80 (Medium)</SelectItem>
                <SelectItem value="low">&lt;60 (Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm">
                Bulk Tag Assignment
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
            </div>
          )}

          {/* Volunteer Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === filteredVolunteers.length && filteredVolunteers.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortField === 'name' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('experience')}
                  >
                    <div className="flex items-center gap-1">
                      Experience
                      {sortField === 'experience' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 text-center"
                    onClick={() => handleSort('activeTurfs')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Active
                      {sortField === 'activeTurfs' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 text-center"
                    onClick={() => handleSort('completedTurfs')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Completed
                      {sortField === 'completedTurfs' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 text-right"
                    onClick={() => handleSort('totalDoors')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total Doors
                      {sortField === 'totalDoors' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 text-center"
                    onClick={() => handleSort('reliability')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Reliability
                      {sortField === 'reliability' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Attributes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVolunteers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No volunteers found. Try adjusting your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVolunteers.map((volunteer) => (
                    <VolunteerRow
                      key={volunteer.id}
                      volunteer={volunteer}
                      isSelected={selectedIds.has(volunteer.id)}
                      onToggleSelect={handleToggleSelect}
                      onRowClick={handleRowClick}
                      getExperienceBadgeVariant={getExperienceBadgeVariant}
                      getReliabilityBgColor={getReliabilityBgColor}
                      getReliabilityColor={getReliabilityColor}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Volunteer Detail Dialog */}
      {selectedVolunteer && (
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{selectedVolunteer.name}</span>
                <Badge variant={getExperienceBadgeVariant(selectedVolunteer.experienceLevel)}>
                  {selectedVolunteer.experienceLevel === 'new' && 'New Volunteer'}
                  {selectedVolunteer.experienceLevel === 'experienced' && 'Experienced'}
                  {selectedVolunteer.experienceLevel === 'team_leader' && 'Team Leader'}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Volunteer details and performance statistics
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{selectedVolunteer.email}</span>
                  </div>
                </div>
                {selectedVolunteer.phone && (
                  <div>
                    <Label className="text-xs text-gray-500">Phone</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{selectedVolunteer.phone}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-gray-500" />
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedVolunteer.activeAssignments}
                  </div>
                  <div className="text-xs text-gray-600">Active Turfs</div>
                </div>
                <div className="text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-gray-500" />
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(selectedVolunteer.completionRate)}
                  </div>
                  <div className="text-xs text-gray-600">Completed</div>
                </div>
                <div className="text-center">
                  <MapPin className="h-5 w-5 mx-auto mb-1 text-gray-500" />
                  <div className="text-2xl font-bold text-purple-600">
                    {selectedVolunteer.totalDoorsKnocked.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">Doors Knocked</div>
                </div>
                <div className="text-center">
                  <Star className="h-5 w-5 mx-auto mb-1 text-gray-500" />
                  <div className={`text-2xl font-bold ${getReliabilityColor(selectedVolunteer.reliabilityScore)}`}>
                    {selectedVolunteer.reliabilityScore.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-600">Reliability</div>
                </div>
              </div>

              {/* Availability */}
              <div>
                <Label className="text-xs text-gray-500 mb-2 block">Availability</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedVolunteer.availableDays.map((slot) => (
                    <Badge key={slot} variant="outline">
                      <Calendar className="h-3 w-3 mr-1" />
                      {slot.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Attributes */}
              <div className="flex gap-4">
                {selectedVolunteer.hasVehicle && (
                  <Badge variant="outline" className="bg-blue-50">
                    <Car className="h-4 w-4 mr-1" />
                    Has Vehicle
                  </Badge>
                )}
                {(selectedVolunteer.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Preferred Areas */}
              {(selectedVolunteer.tags || []).length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">Preferred Areas</Label>
                  <div className="flex flex-wrap gap-2">
                    {(selectedVolunteer.tags || []).map((area) => (
                      <Badge key={area} variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedVolunteer.notes && (
                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">Notes</Label>
                  <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded">
                    {selectedVolunteer.notes}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteVolunteer(selectedVolunteer.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button variant="default">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Volunteer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Volunteer</DialogTitle>
            <DialogDescription>
              Enter volunteer information to add to the roster
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="experience">Experience Level</Label>
              <Select
                value={formData.experienceLevel}
                onValueChange={(v) => setFormData({ ...formData, experienceLevel: v as ExperienceLevel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New Volunteer</SelectItem>
                  <SelectItem value="experienced">Experienced</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="vehicle"
                checked={formData.hasVehicle}
                onCheckedChange={(checked: boolean | 'indeterminate') => setFormData({ ...formData, hasVehicle: !!checked })}
              />
              <Label htmlFor="vehicle" className="cursor-pointer">
                Has vehicle available for canvassing
              </Label>
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddVolunteer}
              disabled={!formData.name || !formData.email}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Volunteer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
