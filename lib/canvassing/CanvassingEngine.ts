/**
 * Canvassing Engine
 *
 * Creates canvassing universes from precinct data and calculates turf estimates.
 * Converts political segments into actionable door-knocking operations with
 * staffing estimates and turf allocation.
 */

import type {
  CanvassingParams,
  CanvassingUniverse,
  CanvassingPrecinct,
  StaffingEstimate,
  CanvassSummary,
  SortOption,
  CanvassingTurf,
  CanvassingMetrics,
  RouteSuggestions,
  SegmentResults,
  DensityType,
} from './types';

// Constants for canvassing calculations
const DEFAULT_DOORS_PER_TURF = 50; // Optimal turf size for 1-hour shift
const DEFAULT_DOORS_PER_HOUR = 40; // Suburban/optimal rate
const DEFAULT_CONTACT_RATE = 0.35;
const RESIDENTIAL_FACTOR = 0.80; // % of voters with doors to knock

// Density-aware door rates (doors per hour)
const DOORS_PER_HOUR_URBAN = 35; // 30-40 range
const DOORS_PER_HOUR_SUBURBAN = 45; // 40-50 range (optimal)
const DOORS_PER_HOUR_RURAL = 25; // 20-30 range

/**
 * Precinct data structure from ingham_precincts.json
 * Contains electoral, demographic, and targeting information
 */
interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: string;
  jurisdictionType: 'city' | 'township';

  demographics: {
    totalPopulation: number;
    population18up: number;
    medianAge: number;
    medianHHI: number;
    collegePct: number;
    homeownerPct: number;
    diversityIndex: number;
    populationDensity: number;
  };

  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
    liberalPct: number;
    moderatePct: number;
    conservativePct: number;
  };

  electoral: {
    partisanLean: number;
    swingPotential: number;
    competitiveness: 'safe_d' | 'likely_d' | 'lean_d' | 'toss_up' | 'lean_r' | 'likely_r' | 'safe_r';
    avgTurnout: number;
    turnoutDropoff: number;
  };

  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };
}

/**
 * Main Canvassing Engine class
 * Handles universe creation, sorting, staffing estimates, and summary generation
 */
export class CanvassingEngine {
  private precincts: PrecinctData[];

  /**
   * Create a new CanvassingEngine
   * @param precincts - Array of precinct data to work with
   */
  constructor(precincts: PrecinctData[]) {
    this.precincts = precincts;
  }

  /**
   * Create a canvassing universe from precinct IDs
   * @param name - Name for the universe
   * @param precinctIds - Array of precinct IDs to include
   * @param params - Optional canvassing parameters (defaults used if not provided)
   * @returns CanvassingUniverse with all calculations
   */
  createUniverse(
    name: string,
    precinctIds: string[],
    params?: Partial<CanvassingParams>
  ): CanvassingUniverse {
    // Set default parameters
    const targetDoorsPerTurf = params?.targetDoorsPerTurf ?? DEFAULT_DOORS_PER_TURF;
    const targetDoorsPerHour = params?.targetDoorsPerHour ?? DEFAULT_DOORS_PER_HOUR;
    const targetContactRate = params?.targetContactRate ?? DEFAULT_CONTACT_RATE;

    // Find matching precincts
    const matchedPrecincts = this.precincts.filter(p => precinctIds.includes(p.id));

    if (matchedPrecincts.length === 0) {
      throw new Error('No matching precincts found');
    }

    // Create canvassing precincts with calculations
    const canvassingPrecincts: CanvassingPrecinct[] = matchedPrecincts.map(precinct => {
      const registeredVoters = precinct.demographics.population18up;
      const estimatedDoors = Math.round(registeredVoters * RESIDENTIAL_FACTOR);
      const estimatedTurfs = Math.ceil(estimatedDoors / targetDoorsPerTurf);
      const estimatedHours = Math.ceil(estimatedDoors / targetDoorsPerHour);

      return {
        precinctId: precinct.id,
        precinctName: precinct.name,
        jurisdiction: precinct.jurisdiction,
        registeredVoters,
        gotvPriority: precinct.targeting.gotvPriority,
        persuasionOpportunity: precinct.targeting.persuasionOpportunity,
        swingPotential: precinct.electoral.swingPotential,
        targetingStrategy: precinct.targeting.strategy,
        estimatedDoors,
        estimatedTurfs,
        estimatedHours,
        priorityRank: 0, // Will be set after sorting
      };
    });

    // Sort by combined score (GOTV + Persuasion) by default
    this.sortPrecinctsByCombined(canvassingPrecincts);

    // Assign priority ranks
    canvassingPrecincts.forEach((precinct, index) => {
      precinct.priorityRank = index + 1;
    });

    // Calculate totals
    const totalEstimatedDoors = canvassingPrecincts.reduce(
      (sum, p) => sum + p.estimatedDoors,
      0
    );
    const estimatedTurfs = Math.ceil(totalEstimatedDoors / targetDoorsPerTurf);
    const estimatedHours = Math.ceil(totalEstimatedDoors / targetDoorsPerHour);
    const volunteersNeeded = Math.ceil(estimatedHours / 8); // 8-hour shifts

    const now = new Date().toISOString();

    return {
      id: this.generateUniverseId(name),
      name,
      createdAt: now,
      customPrecincts: precinctIds,
      targetDoorsPerTurf,
      targetDoorsPerHour,
      targetContactRate,
      totalPrecincts: canvassingPrecincts.length,
      totalEstimatedDoors,
      estimatedTurfs,
      estimatedHours,
      volunteersNeeded,
      precincts: canvassingPrecincts,
    };
  }

  /**
   * Re-sort a universe by different criteria
   * @param universe - Universe to sort
   * @param sortBy - Sort option
   * @returns Updated universe with new rankings
   */
  sortUniverse(universe: CanvassingUniverse, sortBy: SortOption): CanvassingUniverse {
    const precincts = [...universe.precincts];

    switch (sortBy) {
      case 'gotv':
        this.sortPrecinctsByGOTV(precincts);
        break;
      case 'persuasion':
        this.sortPrecinctsByPersuasion(precincts);
        break;
      case 'doors':
        this.sortPrecinctsByDoors(precincts);
        break;
      case 'swing':
        this.sortPrecinctsBySwing(precincts);
        break;
      case 'combined':
      default:
        this.sortPrecinctsByCombined(precincts);
        break;
    }

    // Update priority ranks
    precincts.forEach((precinct, index) => {
      precinct.priorityRank = index + 1;
    });

    return {
      ...universe,
      precincts,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate staffing requirements for a canvassing operation
   * @param universe - Canvassing universe
   * @param canvassDays - Number of days to complete canvass
   * @param hoursPerShift - Hours per volunteer shift
   * @returns Staffing estimate with volunteer needs
   */
  estimateStaffing(
    universe: CanvassingUniverse,
    canvassDays: number,
    hoursPerShift: number
  ): StaffingEstimate {
    const totalHours = universe.estimatedHours;
    const totalShifts = Math.ceil(totalHours / hoursPerShift);
    const shiftsPerDay = Math.ceil(totalShifts / canvassDays);
    const volunteersPerDay = shiftsPerDay; // 1 volunteer per shift
    const totalVolunteerSlots = totalShifts;

    const expectedContacts = Math.round(
      universe.totalEstimatedDoors * universe.targetContactRate
    );
    const coveragePercent = Math.min(100, (expectedContacts / universe.totalEstimatedDoors) * 100);

    return {
      totalShifts,
      shiftsPerDay,
      volunteersPerDay,
      totalVolunteerSlots,
      expectedContacts,
      coveragePercent: Math.round(coveragePercent * 10) / 10,
    };
  }

  /**
   * Generate a summary of the canvassing universe for display/export
   * @param universe - Canvassing universe
   * @returns Summary statistics and top precincts
   */
  generateSummary(universe: CanvassingUniverse): CanvassSummary {
    // Calculate staffing for standard shifts
    const estimate8hr = this.estimateStaffing(universe, 7, 8); // 1 week, 8-hour shifts
    const estimate4hr = this.estimateStaffing(universe, 7, 4); // 1 week, 4-hour shifts

    // Get top 10 precincts
    const topPrecincts = universe.precincts
      .slice(0, 10)
      .map((p, index) => ({
        rank: index + 1,
        name: p.precinctName,
        doors: p.estimatedDoors,
        turfs: p.estimatedTurfs,
        gotv: p.gotvPriority,
      }));

    // Strategy breakdown
    const strategyBreakdown: Record<string, number> = {};
    universe.precincts.forEach(p => {
      strategyBreakdown[p.targetingStrategy] = (strategyBreakdown[p.targetingStrategy] || 0) + 1;
    });

    return {
      universeName: universe.name,
      createdAt: universe.createdAt,
      precincts: universe.totalPrecincts,
      estimatedDoors: universe.totalEstimatedDoors,
      estimatedTurfs: universe.estimatedTurfs,
      estimatedHours: universe.estimatedHours,
      volunteersFor8HrShifts: estimate8hr.totalVolunteerSlots,
      volunteersFor4HrShifts: estimate4hr.totalVolunteerSlots,
      expectedContacts: estimate8hr.expectedContacts,
      contactRate: universe.targetContactRate,
      topPrecincts,
      strategyBreakdown,
    };
  }

  /**
   * Get a precinct by ID (useful for detailed analysis)
   * @param precinctId - Precinct identifier
   * @returns Precinct data or undefined
   */
  getPrecinct(precinctId: string): PrecinctData | undefined {
    return this.precincts.find(p => p.id === precinctId);
  }

  /**
   * Get all precincts (for debugging/testing)
   */
  getAllPrecincts(): PrecinctData[] {
    return this.precincts;
  }

  /**
   * Create a canvassing universe from segment results
   * @param segmentResults - Results from SegmentEngine query
   * @param name - Name for the universe
   * @param description - Optional description
   * @returns CanvassingUniverse ready for field operations
   */
  createUniverseFromSegment(
    segmentResults: SegmentResults,
    name: string,
    description?: string
  ): CanvassingUniverse {
    // Extract precinct IDs from segment results
    const precinctIds = segmentResults.matchingPrecincts.map(p => p.precinctId);

    if (precinctIds.length === 0) {
      throw new Error('No precincts in segment results');
    }

    // Create universe using existing method
    const universe = this.createUniverse(name, precinctIds);

    // Add description and segment metadata
    return {
      ...universe,
      description,
      // Store reference to segment data for future use
      segmentId: `segment_${Date.now()}`,
    };
  }

  /**
   * Optimize turfs for a universe based on priority and capacity
   * @param universe - Canvassing universe to optimize
   * @param options - Optimization options
   * @returns Array of optimized turfs
   */
  optimizeTurfs(
    universe: CanvassingUniverse,
    options?: {
      targetDoorsPerTurf?: number;
      maxTurfs?: number;
      priorityMetric?: 'gotv_priority' | 'persuasion_opportunity' | 'combined_score';
    }
  ): CanvassingTurf[] {
    const targetDoorsPerTurf = options?.targetDoorsPerTurf ?? DEFAULT_DOORS_PER_TURF;
    const priorityMetric = options?.priorityMetric ?? 'combined_score';

    // Sort precincts by priority metric
    const sortedPrecincts = [...universe.precincts].sort((a, b) => {
      switch (priorityMetric) {
        case 'gotv_priority':
          return b.gotvPriority - a.gotvPriority;
        case 'persuasion_opportunity':
          return b.persuasionOpportunity - a.persuasionOpportunity;
        case 'combined_score':
        default:
          return (b.gotvPriority + b.persuasionOpportunity) - (a.gotvPriority + a.persuasionOpportunity);
      }
    });

    const turfs: CanvassingTurf[] = [];
    let currentTurf: CanvassingPrecinct[] = [];
    let currentDoors = 0;
    let turfNumber = 1;

    for (const precinct of sortedPrecincts) {
      // If adding this precinct exceeds turf size, finalize current turf
      if (currentDoors > 0 && currentDoors + precinct.estimatedDoors > targetDoorsPerTurf * 1.2) {
        turfs.push(this.createTurf(currentTurf, turfNumber, universe));
        currentTurf = [];
        currentDoors = 0;
        turfNumber++;

        // Check max turfs limit
        if (options?.maxTurfs && turfs.length >= options.maxTurfs) {
          break;
        }
      }

      currentTurf.push(precinct);
      currentDoors += precinct.estimatedDoors;

      // If we've hit target size, finalize turf
      if (currentDoors >= targetDoorsPerTurf) {
        turfs.push(this.createTurf(currentTurf, turfNumber, universe));
        currentTurf = [];
        currentDoors = 0;
        turfNumber++;

        // Check max turfs limit
        if (options?.maxTurfs && turfs.length >= options.maxTurfs) {
          break;
        }
      }
    }

    // Add remaining precincts as final turf
    if (currentTurf.length > 0) {
      turfs.push(this.createTurf(currentTurf, turfNumber, universe));
    }

    return turfs;
  }

  /**
   * Calculate canvassing metrics for a set of precincts
   * @param precinctIds - Array of precinct IDs
   * @returns Aggregated canvassing metrics
   */
  calculateMetrics(precinctIds: string[]): CanvassingMetrics {
    const matchedPrecincts = this.precincts.filter(p => precinctIds.includes(p.id));

    if (matchedPrecincts.length === 0) {
      return {
        totalDoors: 0,
        estimatedTime: 0,
        doorsPerHour: 0,
        density: 'suburban',
      };
    }

    // Calculate total doors
    const totalDoors = matchedPrecincts.reduce(
      (sum, p) => sum + Math.round(p.demographics.population18up * RESIDENTIAL_FACTOR),
      0
    );

    // Determine average density
    const avgDensity =
      matchedPrecincts.reduce((sum, p) => sum + p.demographics.populationDensity, 0) /
      matchedPrecincts.length;

    const densityType = this.categorizeDensity(avgDensity);

    // Get density-appropriate door rate
    const doorsPerHour = this.getDoorsPerHourByDensity(densityType);

    // Calculate estimated time
    const estimatedTime = totalDoors / doorsPerHour;

    return {
      totalDoors,
      estimatedTime: Math.round(estimatedTime * 10) / 10,
      doorsPerHour,
      density: densityType,
    };
  }

  /**
   * Get route optimization suggestions for a turf
   * @param turfId - Turf identifier (or comma-separated precinct IDs)
   * @returns Route suggestions with optimal order and tips
   */
  getRouteSuggestions(turfId: string): RouteSuggestions {
    // Parse turf ID - could be "turf-1" or comma-separated precinct IDs
    let precinctIds: string[];

    if (turfId.startsWith('turf-')) {
      // This is a placeholder - in a full implementation, we'd look up the turf
      // For now, return empty suggestions
      return {
        optimalOrder: [],
        estimatedDistance: 0,
        tips: ['Turf lookup not yet implemented'],
      };
    } else {
      // Assume comma-separated precinct IDs
      precinctIds = turfId.split(',').map(id => id.trim());
    }

    const matchedPrecincts = this.precincts.filter(p => precinctIds.includes(p.id));

    if (matchedPrecincts.length === 0) {
      return {
        optimalOrder: [],
        estimatedDistance: 0,
        tips: ['No precincts found'],
      };
    }

    // Sort by jurisdiction to keep geographically close precincts together
    const sortedByJurisdiction = [...matchedPrecincts].sort((a, b) =>
      a.jurisdiction.localeCompare(b.jurisdiction)
    );

    // Within each jurisdiction, sort by density (urban first, then suburban, then rural)
    const sortedOptimally = sortedByJurisdiction.sort((a, b) => {
      if (a.jurisdiction !== b.jurisdiction) {
        return a.jurisdiction.localeCompare(b.jurisdiction);
      }
      return b.demographics.populationDensity - a.demographics.populationDensity;
    });

    const optimalOrder = sortedOptimally.map(p => p.id);

    // Estimate distance (rough approximation: 2km between precincts)
    const estimatedDistance = Math.max(0, (matchedPrecincts.length - 1) * 2);

    // Generate practical tips
    const tips = this.generateRouteTips(matchedPrecincts);

    return {
      optimalOrder,
      estimatedDistance,
      tips,
    };
  }

  // Private helper methods

  /**
   * Generate a unique ID for a universe
   */
  private generateUniverseId(name: string): string {
    const timestamp = Date.now();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${slug}-${timestamp}`;
  }

  /**
   * Sort precincts by GOTV priority (highest first)
   */
  private sortPrecinctsByGOTV(precincts: CanvassingPrecinct[]): void {
    precincts.sort((a, b) => b.gotvPriority - a.gotvPriority);
  }

  /**
   * Sort precincts by persuasion opportunity (highest first)
   */
  private sortPrecinctsByPersuasion(precincts: CanvassingPrecinct[]): void {
    precincts.sort((a, b) => b.persuasionOpportunity - a.persuasionOpportunity);
  }

  /**
   * Sort precincts by swing potential (highest first)
   */
  private sortPrecinctsBySwing(precincts: CanvassingPrecinct[]): void {
    precincts.sort((a, b) => b.swingPotential - a.swingPotential);
  }

  /**
   * Sort precincts by estimated doors (highest first)
   */
  private sortPrecinctsByDoors(precincts: CanvassingPrecinct[]): void {
    precincts.sort((a, b) => b.estimatedDoors - a.estimatedDoors);
  }

  /**
   * Sort precincts by combined score (GOTV + Persuasion, highest first)
   */
  private sortPrecinctsByCombined(precincts: CanvassingPrecinct[]): void {
    precincts.sort((a, b) => {
      const scoreA = a.gotvPriority + a.persuasionOpportunity;
      const scoreB = b.gotvPriority + b.persuasionOpportunity;
      return scoreB - scoreA;
    });
  }

  /**
   * Categorize population density into urban/suburban/rural
   */
  private categorizeDensity(density: number): DensityType {
    if (density >= 3000) return 'urban';
    if (density >= 500) return 'suburban';
    return 'rural';
  }

  /**
   * Get appropriate doors-per-hour rate based on density
   */
  private getDoorsPerHourByDensity(density: DensityType): number {
    switch (density) {
      case 'urban':
        return DOORS_PER_HOUR_URBAN;
      case 'suburban':
        return DOORS_PER_HOUR_SUBURBAN;
      case 'rural':
        return DOORS_PER_HOUR_RURAL;
      default:
        return DEFAULT_DOORS_PER_HOUR;
    }
  }

  /**
   * Create a turf from a set of precincts
   */
  private createTurf(
    precincts: CanvassingPrecinct[],
    turfNumber: number,
    universe: CanvassingUniverse
  ): CanvassingTurf {
    const precinctIds = precincts.map(p => p.precinctId);
    const estimatedDoors = precincts.reduce((sum, p) => sum + p.estimatedDoors, 0);

    // Get average density from underlying precinct data
    const precinctDataList = this.precincts.filter(p => precinctIds.includes(p.id));
    const avgDensity =
      precinctDataList.reduce((sum, p) => sum + p.demographics.populationDensity, 0) /
      precinctDataList.length;
    const densityType = this.categorizeDensity(avgDensity);
    const doorsPerHour = this.getDoorsPerHourByDensity(densityType);

    const estimatedHours = estimatedDoors / doorsPerHour;

    const avgGotvPriority =
      precincts.reduce((sum, p) => sum + p.gotvPriority, 0) / precincts.length;
    const avgPersuasionOpportunity =
      precincts.reduce((sum, p) => sum + p.persuasionOpportunity, 0) / precincts.length;

    return {
      turfId: `${universe.id}-turf-${turfNumber}`,
      turfName: `Turf ${turfNumber}`,
      precinctIds,
      estimatedDoors,
      estimatedHours: Math.round(estimatedHours * 10) / 10,
      doorsPerHour,
      density: densityType,
      priority: turfNumber,
      avgGotvPriority: Math.round(avgGotvPriority * 10) / 10,
      avgPersuasionOpportunity: Math.round(avgPersuasionOpportunity * 10) / 10,
    };
  }

  /**
   * Generate practical route tips based on precinct characteristics
   */
  private generateRouteTips(precincts: PrecinctData[]): string[] {
    const tips: string[] = [];

    // Density-based tips
    const avgDensity =
      precincts.reduce((sum, p) => sum + p.demographics.populationDensity, 0) /
      precincts.length;
    const densityType = this.categorizeDensity(avgDensity);

    switch (densityType) {
      case 'urban':
        tips.push('Urban area: Expect apartments and multi-unit buildings');
        tips.push('Plan for 30-40 doors/hour, including building access time');
        break;
      case 'suburban':
        tips.push('Suburban area: Optimal canvassing efficiency at 40-50 doors/hour');
        tips.push('Most efficient use of volunteer time');
        break;
      case 'rural':
        tips.push('Rural area: Longer distances between homes');
        tips.push('Plan for 20-30 doors/hour, budget extra travel time');
        break;
    }

    // Multiple jurisdictions tip
    const jurisdictions = new Set(precincts.map(p => p.jurisdiction));
    if (jurisdictions.size > 1) {
      tips.push(`Route spans ${jurisdictions.size} jurisdictions - group by area to minimize travel`);
    }

    // High-priority targeting tip
    const avgGotv =
      precincts.reduce((sum, p) => sum + p.targeting.gotvPriority, 0) / precincts.length;
    if (avgGotv >= 75) {
      tips.push('High GOTV priority - focus on voter turnout messaging');
    }

    const avgPersuasion =
      precincts.reduce((sum, p) => sum + p.targeting.persuasionOpportunity, 0) /
      precincts.length;
    if (avgPersuasion >= 75) {
      tips.push('High persuasion opportunity - prepare for longer conversations');
    }

    // Turnout-based tip
    const avgTurnout =
      precincts.reduce((sum, p) => sum + p.electoral.avgTurnout, 0) / precincts.length;
    if (avgTurnout < 50) {
      tips.push('Low historical turnout - emphasize importance of voting');
    }

    return tips;
  }
}
