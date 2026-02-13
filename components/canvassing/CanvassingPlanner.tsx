'use client';

/**
 * Canvassing Planner - Main orchestrator component for the Canvassing Tool
 *
 * Features:
 * 1. Universe Selection: Load from saved universes, segments, or manual selection
 * 2. Parameters Panel: Configure doors/turf, doors/hour, contact rate, sort by
 * 3. Summary Stats: Total doors, turfs, hours, volunteers, expected contacts
 * 4. Precinct Priority List: Ranked table of precincts with canvassing metrics
 * 5. Actions: Save, export, clear functionality
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Save,
  Trash2,
  Users,
  MapPin,
  Clock,
  Target,
  TrendingUp,
  AlertCircle,
  Loader2,
  BarChart3,
  Route,
  FileSpreadsheet,
  UserPlus,
  ClipboardList,
  Heart,
  Plus,
  RotateCcw,
} from 'lucide-react';

// Import new canvassing components
import { ProgressDashboard } from './ProgressDashboard';
import { VolunteerRoster } from './VolunteerRoster';
import { AssignmentPanel } from './AssignmentPanel';
import { PerformanceAnalytics } from './PerformanceAnalytics';
import { RouteOptimizerPanel } from './RouteOptimizerPanel';
import { VANExportDialog } from './VANExportDialog';
import { ProgressLogger } from './ProgressLogger';
import { DonorTargetingPanel } from './DonorTargetingPanel';

// Import canvassing types and utilities
import type {
  CanvassingUniverse,
  CanvassingParams,
  CanvassingPrecinct,
  SortOption,
} from '@/lib/canvassing/types';
import type { SegmentDefinition } from '@/lib/segmentation/types';

// Import stores (will be created)
import { canvassingStore } from '@/lib/canvassing';
import { segmentStore } from '@/lib/segmentation';

// Wave 6A: State Management for AI context sync
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: string;
  registered_voters: number;
  targeting: {
    gotv_priority: number;
    persuasion_opportunity: number;
  };
  electoral: {
    swing_potential: number;
  };
}

interface SummaryStats {
  totalDoors: number;
  estimatedTurfs: number;
  totalHours: number;
  volunteersNeeded: number;
  expectedContacts: number;
  contactRate: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function CanvassingPlanner() {
  // ============================================================================
  // State Management
  // ============================================================================

  // Universe and selection
  const [universe, setUniverse] = useState<CanvassingUniverse | null>(null);
  const [savedUniverses, setSavedUniverses] = useState<CanvassingUniverse[]>([]);
  const [savedSegments, setSavedSegments] = useState<SegmentDefinition[]>([]);
  const [precinctData, setPrecinctData] = useState<PrecinctData[]>([]);

  // Parameters
  const [params, setParams] = useState<CanvassingParams>({
    targetDoorsPerTurf: 200,
    targetDoorsPerHour: 40,
    targetContactRate: 0.35,
  });

  // Sorting and filtering
  const [sortBy, setSortBy] = useState<SortOption>('gotv');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [manualSelectionOpen, setManualSelectionOpen] = useState(false);
  const [selectedPrecinctIds, setSelectedPrecinctIds] = useState<string[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('universe');
  const [vanExportOpen, setVanExportOpen] = useState(false);
  const [confirmNewCanvassOpen, setConfirmNewCanvassOpen] = useState(false);

  // Wave 6A: Toast for feedback
  const { toast } = useToast();

  // Wave 6A: Subscribe to ApplicationStateManager events
  useEffect(() => {
    const stateManager = getStateManager();

    const unsubscribe = stateManager.subscribe((state, event) => {
      switch (event.type) {
        case 'SEGMENT_CREATED':
          // When segment is created elsewhere, offer to use it as canvassing universe
          console.log('[CanvassingPlanner] Segment created:', event.payload);
          loadSavedData(); // Refresh to show new segment
          break;

        case 'PRECINCT_SELECTED':
          // When user clicks a precinct on map, add to selection
          console.log('[CanvassingPlanner] Precinct selected:', event.payload);
          break;

        case 'CANVASSING_PARAMS_CHANGED':
          // Another component changed canvassing params
          console.log('[CanvassingPlanner] External params change:', event.payload);
          break;

        case 'DONOR_ZIP_SELECTED':
          // When donor tool selects a ZIP, cross-reference with canvassing areas
          console.log('[CanvassingPlanner] Donor ZIP selected:', event.payload);
          break;
      }
    });

    // Set current tool context
    stateManager.dispatch({
      type: 'TOOL_CHANGED',
      payload: { tool: 'canvass' },
      timestamp: new Date(),
    });

    return () => unsubscribe();
  }, []);

  // ============================================================================
  // Data Loading
  // ============================================================================

  // Load saved universes and segments on mount
  useEffect(() => {
    loadSavedData();
    loadPrecinctData();
  }, []);

  const loadSavedData = () => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        return;
      }

      // Load saved universes from store
      const universes = canvassingStore?.getAll() || [];
      setSavedUniverses(universes);
      console.log(`[CanvassingPlanner] Loaded ${universes.length} saved universes`);

      // Load saved segments from segmentation tool
      const segments = segmentStore?.getAll() || [];
      setSavedSegments(segments);
      console.log(`[CanvassingPlanner] Loaded ${segments.length} saved segments`);
    } catch (err) {
      console.error('Error loading saved data:', err);
      toast({
        title: 'Error Loading Saved Data',
        description: 'Failed to load saved universes and segments. Your browser storage may be unavailable.',
        variant: 'destructive',
      });
    }
  };

  const loadPrecinctData = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/canvassing?action=precincts');

      // S8-014: Validate response before parsing JSON
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        throw new Error(`HTTP ${response.status}: ${statusText}`);
      }

      // Check Content-Type header
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      // Parse JSON with try-catch for additional safety
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Invalid JSON response from server');
      }

      setPrecinctData(data.precincts || []);
    } catch (err) {
      console.error('Error loading precinct data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast({
        title: 'Error Loading Precinct Data',
        description: `Failed to load precinct data: ${errorMessage}. Please check your connection and try refreshing the page.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Universe Creation and Management
  // ============================================================================

  const createUniverseFromSegment = (segmentId: string) => {
    try {
      const segment = savedSegments.find(s => s.id === segmentId);
      if (!segment || !segment.cachedResults) {
        toast({
          title: 'Cannot Create Universe',
          description: 'Selected segment not found or has no cached results. Please re-run the segment query in the Segmentation tool first.',
          variant: 'destructive',
        });
        return;
      }

      // Convert segment results to canvassing precincts
      const canvassingPrecincts: CanvassingPrecinct[] = segment.cachedResults.matchingPrecincts.map(
        (match, index) => {
          // Estimate doors based on registered voters (assuming ~70% household coverage)
          const estimatedDoors = Math.round(match.registeredVoters * 0.7);
          const estimatedTurfs = Math.ceil(estimatedDoors / params.targetDoorsPerTurf);
          const estimatedHours = (estimatedDoors / params.targetDoorsPerHour);

          return {
            precinctId: match.precinctId,
            precinctName: match.precinctName,
            jurisdiction: match.jurisdiction,
            registeredVoters: match.registeredVoters,
            gotvPriority: match.gotvPriority,
            persuasionOpportunity: match.persuasionOpportunity,
            swingPotential: match.swingPotential,
            targetingStrategy: match.targetingStrategy,
            estimatedDoors,
            estimatedTurfs,
            estimatedHours,
            priorityRank: index + 1,
          };
        }
      );

      // Calculate totals
      const totalDoors = canvassingPrecincts.reduce((sum, p) => sum + p.estimatedDoors, 0);
      const totalTurfs = canvassingPrecincts.reduce((sum, p) => sum + p.estimatedTurfs, 0);
      const totalHours = canvassingPrecincts.reduce((sum, p) => sum + p.estimatedHours, 0);

      const newUniverse: CanvassingUniverse = {
        id: `universe-${Date.now()}`,
        name: `${segment.name} - Canvassing Universe`,
        description: `Created from segment: ${segment.name}`,
        createdAt: new Date().toISOString(),
        segmentId: segment.id,
        targetDoorsPerTurf: params.targetDoorsPerTurf,
        targetDoorsPerHour: params.targetDoorsPerHour,
        targetContactRate: params.targetContactRate,
        totalPrecincts: canvassingPrecincts.length,
        totalEstimatedDoors: totalDoors,
        estimatedTurfs: totalTurfs,
        estimatedHours: totalHours,
        volunteersNeeded: Math.ceil(totalHours / 4), // Assuming 4-hour shifts
        precincts: canvassingPrecincts,
      };

      setUniverse(newUniverse);
      toast({
        title: 'Universe created',
        description: `${canvassingPrecincts.length} precincts with ${totalDoors.toLocaleString()} estimated doors`,
      });
    } catch (err) {
      console.error('Error creating universe from segment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast({
        title: 'Error Creating Universe',
        description: `Failed to create canvassing universe: ${errorMessage}. Please try again or use manual selection.`,
        variant: 'destructive',
      });
    }
  };

  const loadExistingUniverse = (universeId: string) => {
    const existing = savedUniverses.find(u => u.id === universeId);
    if (existing) {
      setUniverse(existing);
      setParams({
        targetDoorsPerTurf: existing.targetDoorsPerTurf,
        targetDoorsPerHour: existing.targetDoorsPerHour,
        targetContactRate: existing.targetContactRate,
      });
    }
  };

  const clearUniverse = () => {
    setUniverse(null);
    setSaveName('');
    setSaveDescription('');
    setSelectedPrecinctIds([]);
  };

  const startNewCanvass = () => {
    // Clear universe and reset all state
    clearUniverse();
    // Reset parameters to defaults
    setParams({
      targetDoorsPerTurf: 200,
      targetDoorsPerHour: 40,
      targetContactRate: 0.35,
    });
    // Reset to universe tab
    setActiveTab('universe');
    // Close confirmation dialog
    setConfirmNewCanvassOpen(false);

    toast({
      title: 'Ready to Start',
      description: 'All settings cleared. Select a universe to begin planning.',
    });
  };

  const createUniverseFromManualSelection = () => {
    if (selectedPrecinctIds.length === 0) {
      toast({
        title: 'No Precincts Selected',
        description: 'Please select at least one precinct to create a canvassing universe.',
        variant: 'destructive',
      });
      return;
    }

    // Get precinct data for selected IDs
    const selectedPrecincts = precinctData.filter(p => selectedPrecinctIds.includes(p.id));

    if (selectedPrecincts.length === 0) {
      toast({
        title: 'Invalid Selection',
        description: 'No valid precincts found for the selected IDs. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Convert to canvassing precincts
    const canvassingPrecincts: CanvassingPrecinct[] = selectedPrecincts.map((precinct, index) => {
      const estimatedDoors = Math.round(precinct.registered_voters * 0.7);
      const estimatedTurfs = Math.ceil(estimatedDoors / params.targetDoorsPerTurf);
      const estimatedHours = estimatedDoors / params.targetDoorsPerHour;

      return {
        precinctId: precinct.id,
        precinctName: precinct.name,
        jurisdiction: precinct.jurisdiction,
        registeredVoters: precinct.registered_voters,
        gotvPriority: precinct.targeting.gotv_priority,
        persuasionOpportunity: precinct.targeting.persuasion_opportunity,
        swingPotential: precinct.electoral.swing_potential,
        targetingStrategy: 'manual_selection',
        estimatedDoors,
        estimatedTurfs,
        estimatedHours,
        priorityRank: index + 1,
      };
    });

    // Calculate totals
    const totalDoors = canvassingPrecincts.reduce((sum, p) => sum + p.estimatedDoors, 0);
    const totalTurfs = canvassingPrecincts.reduce((sum, p) => sum + p.estimatedTurfs, 0);
    const totalHours = canvassingPrecincts.reduce((sum, p) => sum + p.estimatedHours, 0);

    const newUniverse: CanvassingUniverse = {
      id: `universe-${Date.now()}`,
      name: `Manual Selection - ${canvassingPrecincts.length} precincts`,
      description: 'Created from manual precinct selection',
      createdAt: new Date().toISOString(),
      targetDoorsPerTurf: params.targetDoorsPerTurf,
      targetDoorsPerHour: params.targetDoorsPerHour,
      targetContactRate: params.targetContactRate,
      totalPrecincts: canvassingPrecincts.length,
      totalEstimatedDoors: totalDoors,
      estimatedTurfs: totalTurfs,
      estimatedHours: totalHours,
      volunteersNeeded: Math.ceil(totalHours / 4),
      precincts: canvassingPrecincts,
    };

    setUniverse(newUniverse);
    toast({
      title: 'Universe created',
      description: `${canvassingPrecincts.length} precincts from manual selection`,
    });
    setManualSelectionOpen(false);
  };

  const togglePrecinctSelection = (precinctId: string) => {
    setSelectedPrecinctIds((prev: string[]) => {
      if (prev.includes(precinctId)) {
        return prev.filter((id: string) => id !== precinctId);
      }
      return [...prev, precinctId];
    });
  };

  // ============================================================================
  // Parameters Update
  // ============================================================================

  const updateParams = (updates: Partial<CanvassingParams>) => {
    const newParams = { ...params, ...updates };
    setParams(newParams);

    // Recalculate universe with new parameters
    if (universe) {
      recalculateUniverse(newParams);
    }
  };

  const recalculateUniverse = (newParams: CanvassingParams) => {
    if (!universe) return;

    // Recalculate all precinct metrics
    const updatedPrecincts = universe.precincts.map(precinct => {
      const estimatedTurfs = Math.ceil(precinct.estimatedDoors / newParams.targetDoorsPerTurf);
      const estimatedHours = precinct.estimatedDoors / newParams.targetDoorsPerHour;

      return {
        ...precinct,
        estimatedTurfs,
        estimatedHours,
      };
    });

    // Recalculate totals
    const totalTurfs = updatedPrecincts.reduce((sum, p) => sum + p.estimatedTurfs, 0);
    const totalHours = updatedPrecincts.reduce((sum, p) => sum + p.estimatedHours, 0);

    setUniverse({
      ...universe,
      targetDoorsPerTurf: newParams.targetDoorsPerTurf,
      targetDoorsPerHour: newParams.targetDoorsPerHour,
      targetContactRate: newParams.targetContactRate,
      estimatedTurfs: totalTurfs,
      estimatedHours: totalHours,
      volunteersNeeded: Math.ceil(totalHours / 4),
      precincts: updatedPrecincts,
    });
  };

  // ============================================================================
  // Sorting and Ranking
  // ============================================================================

  const sortedPrecincts = useMemo(() => {
    if (!universe) return [];

    const precincts = [...universe.precincts];

    switch (sortBy) {
      case 'gotv':
        return precincts.sort((a, b) => b.gotvPriority - a.gotvPriority);
      case 'persuasion':
        return precincts.sort((a, b) => b.persuasionOpportunity - a.persuasionOpportunity);
      case 'doors':
        return precincts.sort((a, b) => b.estimatedDoors - a.estimatedDoors);
      case 'swing':
        return precincts.sort((a, b) => b.swingPotential - a.swingPotential);
      case 'combined':
        return precincts.sort(
          (a, b) =>
            b.gotvPriority + b.persuasionOpportunity - (a.gotvPriority + a.persuasionOpportunity)
        );
      default:
        return precincts;
    }
  }, [universe, sortBy]);

  // Update ranks after sorting
  useEffect(() => {
    if (universe && sortedPrecincts.length > 0) {
      const rankedPrecincts = sortedPrecincts.map((p, index) => ({
        ...p,
        priorityRank: index + 1,
      }));

      if (JSON.stringify(rankedPrecincts) !== JSON.stringify(universe.precincts)) {
        setUniverse({
          ...universe,
          precincts: rankedPrecincts,
        });
      }
    }
  }, [sortedPrecincts]);

  // ============================================================================
  // Summary Calculations
  // ============================================================================

  const summaryStats: SummaryStats = useMemo(() => {
    if (!universe) {
      return {
        totalDoors: 0,
        estimatedTurfs: 0,
        totalHours: 0,
        volunteersNeeded: 0,
        expectedContacts: 0,
        contactRate: 0,
      };
    }

    const expectedContacts = Math.round(universe.totalEstimatedDoors * params.targetContactRate);

    return {
      totalDoors: universe.totalEstimatedDoors,
      estimatedTurfs: universe.estimatedTurfs,
      totalHours: Math.round(universe.estimatedHours),
      volunteersNeeded: universe.volunteersNeeded,
      expectedContacts,
      contactRate: params.targetContactRate,
    };
  }, [universe, params]);

  // ============================================================================
  // Save and Export
  // ============================================================================

  const handleSave = () => {
    if (!universe || !saveName.trim()) {
      toast({
        title: 'Cannot Save Universe',
        description: 'Please provide a name for the universe before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const universeToSave: CanvassingUniverse = {
        ...universe,
        name: saveName,
        description: saveDescription,
        updatedAt: new Date().toISOString(),
      };

      canvassingStore?.save(universeToSave);
      setSaveDialogOpen(false);
      setSaveName('');
      setSaveDescription('');
      loadSavedData(); // Refresh list

      // Wave 6A: Emit universe saved event
      const stateManager = getStateManager();
      stateManager.dispatch({
        type: 'CANVASSING_UNIVERSE_SAVED',
        payload: {
          universeId: universeToSave.id,
          name: universeToSave.name,
          precinctCount: universeToSave.precincts?.length || universeToSave.totalPrecincts || 0,
        },
        timestamp: new Date(),
      });

      toast({
        title: 'Universe saved',
        description: `"${saveName}" saved with ${universeToSave.precincts?.length || universeToSave.totalPrecincts || 0} precincts`,
      });
    } catch (err) {
      console.error('Error saving universe:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast({
        title: 'Error Saving Universe',
        description: `Failed to save universe: ${errorMessage}. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = () => {
    if (!universe) return;

    try {
      const headers = [
        'Rank',
        'Precinct Name',
        'Jurisdiction',
        'Registered Voters',
        'Est. Doors',
        'Turfs',
        'Hours',
        'GOTV Priority',
        'Persuasion',
        'Swing Potential',
        'Strategy',
      ];

      const rows = sortedPrecincts.map(p => [
        p.priorityRank,
        `"${p.precinctName}"`,
        `"${p.jurisdiction}"`,
        p.registeredVoters,
        p.estimatedDoors,
        p.estimatedTurfs,
        p.estimatedHours.toFixed(1),
        p.gotvPriority,
        p.persuasionOpportunity,
        p.swingPotential,
        `"${p.targetingStrategy}"`,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `${universe.name.replace(/\s+/g, '_')}_canvassing_plan.csv`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Wave 6A: Emit export event
      const stateManager = getStateManager();
      stateManager.dispatch({
        type: 'DATA_EXPORTED',
        payload: {
          tool: 'canvass',
          format: 'csv',
          recordCount: sortedPrecincts.length,
          filename,
        },
        timestamp: new Date(),
      });

      toast({
        title: 'Plan exported',
        description: `Exported ${sortedPrecincts.length} precincts to CSV`,
      });
    } catch (err) {
      console.error('Error exporting CSV:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast({
        title: 'Error Exporting Plan',
        description: `Failed to export CSV: ${errorMessage}. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Canvassing Planner</h1>
          <p className="text-muted-foreground mt-1">
            Convert voter segments into actionable door-knocking operations
          </p>
        </div>
        <div className="flex gap-2">
          {universe ? (
            <>
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setConfirmNewCanvassOpen(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Start New Canvass
              </Button>
              <Button variant="outline" onClick={() => setVanExportOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export to VAN
              </Button>
              <Button variant="outline" onClick={() => setSaveDialogOpen(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setManualSelectionOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Canvass
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabbed Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-8 lg:grid-cols-8">
          <TabsTrigger value="universe" className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Universe</span>
          </TabsTrigger>
          <TabsTrigger value="volunteers" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Volunteers</span>
          </TabsTrigger>
          <TabsTrigger value="assign" className="flex items-center gap-1">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Assign</span>
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Progress</span>
          </TabsTrigger>
          <TabsTrigger value="log" className="flex items-center gap-1">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Log</span>
          </TabsTrigger>
          <TabsTrigger value="routes" className="flex items-center gap-1">
            <Route className="h-4 w-4" />
            <span className="hidden sm:inline">Routes</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="donors" className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Donors</span>
          </TabsTrigger>
        </TabsList>

        {/* Universe Builder Tab */}
        <TabsContent value="universe" className="space-y-6 mt-6">
          {/* Universe Selection */}
          <Card>
        <CardHeader>
          <CardTitle>1. Select Universe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Load from saved universes */}
            <div>
              <Label>Load Saved Universe</Label>
              <Select onValueChange={loadExistingUniverse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select universe..." />
                </SelectTrigger>
                <SelectContent>
                  {savedUniverses.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      <p className="mb-2">No saved universes yet</p>
                      <p className="text-xs">
                        Create a universe from a segment, then save it to see it here
                      </p>
                    </div>
                  ) : (
                    savedUniverses.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.totalPrecincts} precincts)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Load from segments */}
            <div>
              <Label>Load from Segment</Label>
              <Select onValueChange={createUniverseFromSegment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select segment..." />
                </SelectTrigger>
                <SelectContent>
                  {savedSegments.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      <p className="mb-2">No saved segments yet</p>
                      <p className="text-xs">
                        Go to the Segmentation tool to create voter segments first
                      </p>
                    </div>
                  ) : (
                    savedSegments.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.cachedResults?.precinctCount || 0} precincts)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Manual selection */}
            <div>
              <Label>Create New</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setManualSelectionOpen(true)}
              >
                Manual Precinct Selection
              </Button>
            </div>
          </div>

          {universe && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{universe.totalPrecincts} precincts selected</Badge>
                <span className="text-sm text-muted-foreground">{universe.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearUniverse}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parameters Panel */}
      {universe && (
        <Card>
          <CardHeader>
            <CardTitle>2. Configure Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Doors per Turf */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Doors per Turf</Label>
                <span className="text-sm font-medium">{params.targetDoorsPerTurf}</span>
              </div>
              <Slider
                min={100}
                max={300}
                step={10}
                value={[params.targetDoorsPerTurf]}
                onValueChange={([value]: number[]) => updateParams({ targetDoorsPerTurf: value })}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 150-250 doors per turf for optimal volunteer management
              </p>
            </div>

            {/* Doors per Hour */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Doors per Hour</Label>
                <span className="text-sm font-medium">{params.targetDoorsPerHour}</span>
              </div>
              <Slider
                min={20}
                max={60}
                step={5}
                value={[params.targetDoorsPerHour]}
                onValueChange={([value]: number[]) => updateParams({ targetDoorsPerHour: value })}
              />
              <p className="text-xs text-muted-foreground">
                Urban: 30-40, Suburban: 40-50, Rural: 20-30 doors per hour
              </p>
            </div>

            {/* Contact Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Expected Contact Rate</Label>
                <span className="text-sm font-medium">
                  {Math.round(params.targetContactRate * 100)}%
                </span>
              </div>
              <Slider
                min={20}
                max={50}
                step={5}
                value={[params.targetContactRate * 100]}
                onValueChange={([value]: number[]) => updateParams({ targetContactRate: value / 100 })}
              />
              <p className="text-xs text-muted-foreground">
                Typical contact rates: Weekday evenings 35%, Weekend afternoons 40-45%
              </p>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label>Sort Precincts By</Label>
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gotv">GOTV Priority (Highest First)</SelectItem>
                  <SelectItem value="persuasion">Persuasion Score (Highest First)</SelectItem>
                  <SelectItem value="swing">Swing Potential (Highest First)</SelectItem>
                  <SelectItem value="doors">Number of Doors (Most First)</SelectItem>
                  <SelectItem value="combined">Combined Score (GOTV + Persuasion)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {universe && (
        <Card>
          <CardHeader>
            <CardTitle>3. Operation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-1 p-4 rounded-lg shadow-md border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-950 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Total Doors</span>
                </div>
                <p className="text-2xl font-bold">{summaryStats.totalDoors.toLocaleString()}</p>
              </div>

              <div className="space-y-1 p-4 rounded-lg shadow-md border-l-4 border-l-green-500 bg-gradient-to-br from-white to-green-50 dark:from-gray-800 dark:to-green-950 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Turfs</span>
                </div>
                <p className="text-2xl font-bold">{summaryStats.estimatedTurfs}</p>
              </div>

              <div className="space-y-1 p-4 rounded-lg shadow-md border-l-4 border-l-orange-500 bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-orange-950 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Total Hours</span>
                </div>
                <p className="text-2xl font-bold">{summaryStats.totalHours}</p>
              </div>

              <div className="space-y-1 p-4 rounded-lg shadow-md border-l-4 border-l-purple-500 bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-950 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Volunteers</span>
                </div>
                <p className="text-2xl font-bold">{summaryStats.volunteersNeeded}</p>
                <p className="text-xs text-muted-foreground">4-hour shifts</p>
              </div>

              <div className="space-y-1 p-4 rounded-lg shadow-md border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50 dark:from-gray-800 dark:to-emerald-950 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Expected Contacts</span>
                </div>
                <p className="text-2xl font-bold">{summaryStats.expectedContacts.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(summaryStats.contactRate * 100)}% rate
                </p>
              </div>

              <div className="space-y-1 p-4 rounded-lg shadow-md border-l-4 border-l-indigo-500 bg-gradient-to-br from-white to-indigo-50 dark:from-gray-800 dark:to-indigo-950 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm">Precincts</span>
                </div>
                <p className="text-2xl font-bold">{universe.totalPrecincts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Precinct Priority List */}
      {universe && sortedPrecincts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>4. Precinct Priority List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Precinct</TableHead>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead className="text-right">Est. Doors</TableHead>
                    <TableHead className="text-right">Turfs</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">GOTV</TableHead>
                    <TableHead className="text-right">Persuasion</TableHead>
                    <TableHead>Strategy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPrecincts.map(precinct => (
                    <TableRow key={precinct.precinctId}>
                      <TableCell className="font-medium">{precinct.priorityRank}</TableCell>
                      <TableCell className="font-medium">{precinct.precinctName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {precinct.jurisdiction}
                      </TableCell>
                      <TableCell className="text-right">
                        {precinct.estimatedDoors.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{precinct.estimatedTurfs}</TableCell>
                      <TableCell className="text-right">
                        {precinct.estimatedHours.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={precinct.gotvPriority > 75 ? 'default' : 'secondary'}>
                          {precinct.gotvPriority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            precinct.persuasionOpportunity > 75 ? 'default' : 'secondary'
                          }
                        >
                          {precinct.persuasionOpportunity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {precinct.targetingStrategy}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {universe && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button onClick={() => setSaveDialogOpen(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Universe
                </Button>
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              <Button variant="ghost" onClick={clearUniverse}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!universe && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Universe Selected</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Select a saved universe, load from a segment, or create a new one to get started.
            </p>
            {savedSegments.length === 0 && savedUniverses.length === 0 && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                  Getting Started
                </p>
                <ol className="text-sm text-blue-700 dark:text-blue-300 text-left space-y-2">
                  <li>1. Go to the Segmentation tool to create voter segments</li>
                  <li>2. Return here and load your segment into a canvassing universe</li>
                  <li>3. Configure parameters and export your canvassing plan</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading precinct data...</p>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* Volunteers Tab */}
        <TabsContent value="volunteers" className="mt-6">
          <VolunteerRoster
            universeId={universe?.id}
            onVolunteerSelect={(volunteer) => {
              console.log('Selected volunteer:', volunteer);
            }}
          />
        </TabsContent>

        {/* Assignment Tab */}
        <TabsContent value="assign" className="mt-6">
          {universe ? (
            <AssignmentPanel
              universeId={universe.id}
              turfs={[]}
              onAssignmentComplete={() => {
                console.log('Assignment completed');
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Universe Selected</h3>
                <p className="text-muted-foreground">
                  Select a universe in the Universe tab to assign volunteers to turfs.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="mt-6">
          <ProgressDashboard universeId={universe?.id} />
        </TabsContent>

        {/* Log Session Tab */}
        <TabsContent value="log" className="mt-6">
          <ProgressLogger
            universeId={universe?.id || ''}
            onSessionLogged={(session) => {
              console.log('Session logged:', session);
            }}
          />
        </TabsContent>

        {/* Routes Tab */}
        <TabsContent value="routes" className="mt-6">
          {universe ? (
            <RouteOptimizerPanel
              turfs={[]}
              precincts={[]}
              onRouteOptimized={(route) => {
                console.log('Route optimized:', route);
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Route className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Universe Selected</h3>
                <p className="text-muted-foreground">
                  Select a universe in the Universe tab to optimize routes.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          {universe ? (
            <PerformanceAnalytics universeId={universe.id} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Universe Selected</h3>
                <p className="text-muted-foreground">
                  Select a universe in the Universe tab to view analytics.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Donors Tab */}
        <TabsContent value="donors" className="mt-6">
          <DonorTargetingPanel
            universeId={universe?.id}
            precincts={universe?.precincts}
            onCreateRecoveryTurf={(turf) => {
              console.log('Recovery turf created:', turf);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Canvassing Universe</DialogTitle>
            <DialogDescription>
              Give your canvassing universe a name and optional description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={saveName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaveName(e.target.value)}
                placeholder="e.g., GOTV Weekend Push - East Lansing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={saveDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSaveDescription(e.target.value)}
                placeholder="Add notes about this canvassing operation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!saveName.trim()}>
              Save Universe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VAN Export Dialog */}
      {universe && (
        <VANExportDialog
          open={vanExportOpen}
          onOpenChange={setVanExportOpen}
          universe={universe}
          turfs={[]}
        />
      )}

      {/* Manual Selection Dialog */}
      <Dialog open={manualSelectionOpen} onOpenChange={setManualSelectionOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manual Precinct Selection</DialogTitle>
            <DialogDescription>
              Select precincts to include in your canvassing universe. You can search by name or
              jurisdiction, and sort by different metrics.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-4">
              {/* Selection Summary */}
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{selectedPrecinctIds.length} precincts selected</Badge>
                  {selectedPrecinctIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPrecinctIds([])}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                {precinctData.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPrecinctIds(precinctData.map(p => p.id))}
                  >
                    Select All ({precinctData.length})
                  </Button>
                )}
              </div>

              {/* Precinct List */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Input type="checkbox" className="sr-only" />
                      </TableHead>
                      <TableHead>Precinct</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead className="text-right">Voters</TableHead>
                      <TableHead className="text-right">GOTV</TableHead>
                      <TableHead className="text-right">Persuasion</TableHead>
                      <TableHead className="text-right">Swing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {precinctData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No precinct data available. Please try reloading the page.
                        </TableCell>
                      </TableRow>
                    ) : (
                      precinctData.map(precinct => (
                        <TableRow
                          key={precinct.id}
                          className={`cursor-pointer hover:bg-muted/50 ${
                            selectedPrecinctIds.includes(precinct.id) ? 'bg-blue-50 dark:bg-blue-950' : ''
                          }`}
                          onClick={() => togglePrecinctSelection(precinct.id)}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedPrecinctIds.includes(precinct.id)}
                              onChange={() => togglePrecinctSelection(precinct.id)}
                              className="h-4 w-4"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{precinct.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {precinct.jurisdiction}
                          </TableCell>
                          <TableCell className="text-right">
                            {precinct.registered_voters.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={precinct.targeting.gotv_priority > 75 ? 'default' : 'secondary'}
                            >
                              {precinct.targeting.gotv_priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                precinct.targeting.persuasion_opportunity > 75
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {precinct.targeting.persuasion_opportunity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={precinct.electoral.swing_potential > 75 ? 'default' : 'secondary'}
                            >
                              {precinct.electoral.swing_potential}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualSelectionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={createUniverseFromManualSelection}
              disabled={selectedPrecinctIds.length === 0}
            >
              Create Universe ({selectedPrecinctIds.length} precincts)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm New Canvass Dialog */}
      <Dialog open={confirmNewCanvassOpen} onOpenChange={setConfirmNewCanvassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Canvass?</DialogTitle>
            <DialogDescription>
              This will clear your current universe and reset all parameters to defaults.
              Make sure you&apos;ve saved your work if you want to keep it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {universe && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Current Universe: {universe.name}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {universe.totalPrecincts} precincts • {universe.totalEstimatedDoors?.toLocaleString() || 0} doors
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmNewCanvassOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={startNewCanvass}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Fresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
