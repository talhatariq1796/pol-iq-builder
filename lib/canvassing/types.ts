/**
 * Canvassing Types
 *
 * Type definitions for the Canvassing Universe tool.
 * Supports converting political segments into actionable door-knocking operations
 * with staffing estimates and turf allocation.
 */

/**
 * Parameters for canvassing operation
 */
export interface CanvassingParams {
  targetDoorsPerTurf: number;  // Default: 200
  targetDoorsPerHour: number;  // Default: 40
  targetContactRate: number;   // Default: 0.35
}

/**
 * A canvassing universe - collection of precincts to canvass
 */
export interface CanvassingUniverse {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;

  // Source
  segmentId?: string;         // From Segmentation Tool
  customPrecincts?: string[]; // Or manual selection

  // Parameters
  targetDoorsPerTurf: number;
  targetDoorsPerHour: number;
  targetContactRate: number;

  // Calculated totals
  totalPrecincts: number;
  totalEstimatedDoors: number;
  estimatedTurfs: number;
  estimatedHours: number;
  volunteersNeeded: number;

  // Precincts with canvassing info
  precincts: CanvassingPrecinct[];
}

/**
 * Precinct with canvassing-specific calculations
 */
export interface CanvassingPrecinct {
  precinctId: string;
  precinctName: string;
  jurisdiction: string;

  // From existing data
  registeredVoters: number;
  activeVoters?: number;
  gotvPriority: number;
  persuasionOpportunity: number;
  swingPotential: number;
  targetingStrategy: string;

  // Calculated
  estimatedDoors: number;
  estimatedTurfs: number;
  estimatedHours: number;
  priorityRank: number;

  // Assignment (future)
  assignedVolunteers?: string[];
  status?: 'unassigned' | 'assigned' | 'in_progress' | 'complete';
}

/**
 * Staffing estimate for canvassing operation
 */
export interface StaffingEstimate {
  totalShifts: number;
  shiftsPerDay: number;
  volunteersPerDay: number;
  totalVolunteerSlots: number;
  expectedContacts: number;
  coveragePercent: number;
}

/**
 * Summary for display/export
 */
export interface CanvassSummary {
  universeName: string;
  createdAt: string;

  // Totals
  precincts: number;
  estimatedDoors: number;
  estimatedTurfs: number;
  estimatedHours: number;
  volunteersFor8HrShifts: number;
  volunteersFor4HrShifts: number;

  // Expected outcomes
  expectedContacts: number;
  contactRate: number;

  // Top precincts
  topPrecincts: Array<{
    rank: number;
    name: string;
    doors: number;
    turfs: number;
    gotv: number;
  }>;

  // Strategy breakdown
  strategyBreakdown: Record<string, number>;
}

/**
 * Sort options for universe
 */
export type SortOption = 'gotv' | 'persuasion' | 'doors' | 'combined' | 'swing';

/**
 * Density type classification
 */
export type DensityType = 'urban' | 'suburban' | 'rural';

/**
 * Canvassing turf - optimized subset of precincts for door-knocking
 */
export interface CanvassingTurf {
  turfId: string;
  turfName: string;
  precinctIds: string[];
  estimatedDoors: number;
  estimatedHours: number;
  doorsPerHour: number;
  density: DensityType;
  priority: number;
  avgGotvPriority: number;
  avgPersuasionOpportunity: number;
}

/**
 * Canvassing metrics for precincts
 */
export interface CanvassingMetrics {
  totalDoors: number;
  estimatedTime: number; // hours
  doorsPerHour: number;
  density: DensityType;
}

/**
 * Route optimization suggestions
 */
export interface RouteSuggestions {
  optimalOrder: string[]; // precinct IDs in optimal visit order
  estimatedDistance: number; // km
  tips: string[];
}

/**
 * Segment results from SegmentEngine (simplified interface for canvassing)
 */
export interface SegmentResults {
  matchingPrecincts: Array<{
    precinctId: string;
    precinctName: string;
    jurisdiction: string;
    registeredVoters: number;
    gotvPriority: number;
    persuasionOpportunity: number;
    swingPotential: number;
    targetingStrategy: string;
    partisanLean: number;
  }>;
  estimatedVoters: number;
  totalPrecincts: number;
}

// Re-export volunteer types
export * from './types-volunteer';

// Re-export progress types
export * from './types-progress';

// Re-export analytics types
export * from './types-analytics';
