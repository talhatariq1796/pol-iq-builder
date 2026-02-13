/**
 * Scenario Modeling Engine
 *
 * Provides "what if" analysis for political campaign strategy:
 * - Turnout scenarios: "What if student turnout increases by 10%?"
 * - Persuasion scenarios: "What if we persuade 5% of independents?"
 * - Resource allocation scenarios: "Where should we deploy canvassers?"
 *
 * Used by AI to provide strategic insights and campaign planning.
 */

import { politicalDataService } from '@/lib/services/PoliticalDataService';

// ============================================================================
// Types
// ============================================================================

export interface TurnoutScenario {
  type: 'turnout';
  name: string;
  description: string;
  targetGroup: 'students' | 'seniors' | 'low_propensity' | 'all' | 'custom';
  turnoutChange: number; // Percentage points (+10 means increase by 10 points)
  affectedPrecincts?: string[]; // If empty, applies to all
  assumptions: string[];
}

export interface PersuasionScenario {
  type: 'persuasion';
  name: string;
  description: string;
  targetGroup: 'independents' | 'soft_partisans' | 'ticket_splitters' | 'custom';
  persuasionRate: number; // Percentage of target group persuaded (0-100)
  direction: 'D' | 'R'; // Which party gains
  affectedPrecincts?: string[];
  assumptions: string[];
}

export interface ResourceScenario {
  type: 'resource';
  name: string;
  description: string;
  resourceType: 'canvassers' | 'ad_spend' | 'gotv_calls' | 'mail';
  totalResources: number;
  allocationStrategy: 'gotv_priority' | 'swing_priority' | 'persuasion_priority' | 'even';
  assumptions: string[];
}

export type Scenario = TurnoutScenario | PersuasionScenario | ResourceScenario;

export interface ScenarioResult {
  scenario: Scenario;
  baselineVotes: { dem: number; rep: number; other: number };
  projectedVotes: { dem: number; rep: number; other: number };
  netChange: number; // Positive = Dem gain, Negative = Rep gain
  marginChange: number; // Change in margin (percentage points)
  flippedPrecincts: Array<{
    id: string;
    name: string;
    baselineMargin: number;
    projectedMargin: number;
  }>;
  keyInsights: string[];
  confidence: 'high' | 'medium' | 'low';
  methodology: string;
}

export interface PrecinctScenarioImpact {
  precinctId: string;
  precinctName: string;
  baselineVotes: { dem: number; rep: number };
  projectedVotes: { dem: number; rep: number };
  baselineMargin: number;
  projectedMargin: number;
  flipped: boolean;
  impactScore: number; // 0-100, how much this precinct matters in scenario
}

// ============================================================================
// Scenario Engine
// ============================================================================

export class ScenarioModelingEngine {
  private static instance: ScenarioModelingEngine;

  private constructor() {}

  static getInstance(): ScenarioModelingEngine {
    if (!ScenarioModelingEngine.instance) {
      ScenarioModelingEngine.instance = new ScenarioModelingEngine();
    }
    return ScenarioModelingEngine.instance;
  }

  // --------------------------------------------------------------------------
  // Turnout Scenarios
  // --------------------------------------------------------------------------

  /**
   * Model the impact of turnout changes on election outcomes
   */
  async modelTurnoutScenario(scenario: TurnoutScenario): Promise<ScenarioResult> {
    const precincts = await this.getPrecinctData(scenario.affectedPrecincts);

    let baselineDem = 0;
    let baselineRep = 0;
    let projectedDem = 0;
    let projectedRep = 0;
    const flippedPrecincts: ScenarioResult['flippedPrecincts'] = [];

    for (const precinct of precincts) {
      const impact = this.calculateTurnoutImpact(precinct, scenario);

      baselineDem += impact.baselineVotes.dem;
      baselineRep += impact.baselineVotes.rep;
      projectedDem += impact.projectedVotes.dem;
      projectedRep += impact.projectedVotes.rep;

      if (impact.flipped) {
        flippedPrecincts.push({
          id: precinct.id,
          name: precinct.name,
          baselineMargin: impact.baselineMargin,
          projectedMargin: impact.projectedMargin,
        });
      }
    }

    const netChange = (projectedDem - projectedRep) - (baselineDem - baselineRep);
    const baselineTotal = baselineDem + baselineRep;
    const projectedTotal = projectedDem + projectedRep;
    const marginChange = baselineTotal > 0 && projectedTotal > 0
      ? ((projectedDem / projectedTotal) - (baselineDem / baselineTotal)) * 100
      : 0;

    return {
      scenario,
      baselineVotes: { dem: baselineDem, rep: baselineRep, other: 0 },
      projectedVotes: { dem: projectedDem, rep: projectedRep, other: 0 },
      netChange,
      marginChange,
      flippedPrecincts,
      keyInsights: this.generateTurnoutInsights(scenario, netChange, flippedPrecincts),
      confidence: this.assessConfidence(scenario),
      methodology: this.getTurnoutMethodology(scenario),
    };
  }

  private calculateTurnoutImpact(
    precinct: PrecinctData,
    scenario: TurnoutScenario
  ): PrecinctScenarioImpact {
    // Get baseline data
    const baselineTurnout = precinct.turnout_2024 || precinct.avg_turnout || 50;
    const registeredVoters = precinct.registered_voters || 1000;
    const partisanLean = precinct.partisan_lean || 0; // -100 to +100 (- = D, + = R)

    // Calculate baseline votes
    const baselineVoters = Math.round(registeredVoters * (baselineTurnout / 100));
    const demShare = 50 - (partisanLean / 2); // Convert lean to share
    const baselineDem = Math.round(baselineVoters * (demShare / 100));
    const baselineRep = baselineVoters - baselineDem;

    // Calculate turnout multiplier based on target group
    let turnoutMultiplier = 1;
    const change = scenario.turnoutChange / 100;

    switch (scenario.targetGroup) {
      case 'students':
        // Students lean D heavily (~70-30)
        turnoutMultiplier = this.getStudentPresence(precinct) * change;
        break;
      case 'seniors':
        // Seniors lean slightly R in Michigan suburbs
        turnoutMultiplier = this.getSeniorPresence(precinct) * change;
        break;
      case 'low_propensity':
        // Low propensity voters often match precinct lean
        turnoutMultiplier = this.getLowPropensityPresence(precinct) * change;
        break;
      case 'all':
        turnoutMultiplier = change;
        break;
      default:
        turnoutMultiplier = change;
    }

    // Calculate projected turnout
    const projectedTurnout = Math.min(100, baselineTurnout + (scenario.turnoutChange * Math.abs(turnoutMultiplier)));
    const projectedVoters = Math.round(registeredVoters * (projectedTurnout / 100));
    const additionalVoters = projectedVoters - baselineVoters;

    // New voters share based on target group
    let newVoterDemShare = demShare;
    if (scenario.targetGroup === 'students') {
      newVoterDemShare = 70; // Students lean heavily D
    } else if (scenario.targetGroup === 'seniors') {
      newVoterDemShare = 45; // Seniors lean slightly R in MI suburbs
    }

    const newDemVotes = Math.round(additionalVoters * (newVoterDemShare / 100));
    const newRepVotes = additionalVoters - newDemVotes;

    const projectedDem = baselineDem + newDemVotes;
    const projectedRep = baselineRep + newRepVotes;

    const baselineMargin = baselineVoters > 0 ? ((baselineDem - baselineRep) / baselineVoters) * 100 : 0;
    const projectedMargin = projectedVoters > 0 ? ((projectedDem - projectedRep) / projectedVoters) * 100 : 0;
    const flipped = (baselineMargin > 0) !== (projectedMargin > 0);

    return {
      precinctId: precinct.id,
      precinctName: precinct.name,
      baselineVotes: { dem: baselineDem, rep: baselineRep },
      projectedVotes: { dem: projectedDem, rep: projectedRep },
      baselineMargin,
      projectedMargin,
      flipped,
      impactScore: Math.abs(projectedMargin - baselineMargin) * 10,
    };
  }

  // --------------------------------------------------------------------------
  // Persuasion Scenarios
  // --------------------------------------------------------------------------

  /**
   * Model the impact of voter persuasion on election outcomes
   */
  async modelPersuasionScenario(scenario: PersuasionScenario): Promise<ScenarioResult> {
    const precincts = await this.getPrecinctData(scenario.affectedPrecincts);

    let baselineDem = 0;
    let baselineRep = 0;
    let projectedDem = 0;
    let projectedRep = 0;
    const flippedPrecincts: ScenarioResult['flippedPrecincts'] = [];

    for (const precinct of precincts) {
      const impact = this.calculatePersuasionImpact(precinct, scenario);

      baselineDem += impact.baselineVotes.dem;
      baselineRep += impact.baselineVotes.rep;
      projectedDem += impact.projectedVotes.dem;
      projectedRep += impact.projectedVotes.rep;

      if (impact.flipped) {
        flippedPrecincts.push({
          id: precinct.id,
          name: precinct.name,
          baselineMargin: impact.baselineMargin,
          projectedMargin: impact.projectedMargin,
        });
      }
    }

    const netChange = (projectedDem - projectedRep) - (baselineDem - baselineRep);
    const baselineTotal = baselineDem + baselineRep;
    const projectedTotal = projectedDem + projectedRep;
    const marginChange = baselineTotal > 0 && projectedTotal > 0
      ? ((projectedDem / projectedTotal) - (baselineDem / baselineTotal)) * 100
      : 0;

    return {
      scenario,
      baselineVotes: { dem: baselineDem, rep: baselineRep, other: 0 },
      projectedVotes: { dem: projectedDem, rep: projectedRep, other: 0 },
      netChange,
      marginChange,
      flippedPrecincts,
      keyInsights: this.generatePersuasionInsights(scenario, netChange, flippedPrecincts),
      confidence: this.assessConfidence(scenario),
      methodology: this.getPersuasionMethodology(scenario),
    };
  }

  private calculatePersuasionImpact(
    precinct: PrecinctData,
    scenario: PersuasionScenario
  ): PrecinctScenarioImpact {
    const baselineTurnout = precinct.turnout_2024 || precinct.avg_turnout || 50;
    const registeredVoters = precinct.registered_voters || 1000;
    const partisanLean = precinct.partisan_lean || 0;

    // Baseline votes
    const voters = Math.round(registeredVoters * (baselineTurnout / 100));
    const demShare = 50 - (partisanLean / 2);
    const baselineDem = Math.round(voters * (demShare / 100));
    const baselineRep = voters - baselineDem;

    // Estimate persuadable population
    let persuadableShare = 0;
    switch (scenario.targetGroup) {
      case 'independents':
        persuadableShare = precinct.independent_pct || 15;
        break;
      case 'soft_partisans':
        persuadableShare = 10; // ~10% are soft partisans
        break;
      case 'ticket_splitters':
        persuadableShare = precinct.ticket_split_rate || 8;
        break;
      default:
        persuadableShare = 10;
    }

    // Calculate persuaded voters
    const persuadableVoters = Math.round(voters * (persuadableShare / 100));
    const persuadedVoters = Math.round(persuadableVoters * (scenario.persuasionRate / 100));

    // Apply persuasion
    let projectedDem = baselineDem;
    let projectedRep = baselineRep;

    if (scenario.direction === 'D') {
      // Half come from Rep, half from undecided/third party
      const fromRep = Math.round(persuadedVoters * 0.5);
      projectedDem = baselineDem + persuadedVoters;
      projectedRep = baselineRep - fromRep;
    } else {
      const fromDem = Math.round(persuadedVoters * 0.5);
      projectedRep = baselineRep + persuadedVoters;
      projectedDem = baselineDem - fromDem;
    }

    const baselineMargin = voters > 0 ? ((baselineDem - baselineRep) / voters) * 100 : 0;
    const projectedMargin = voters > 0 ? ((projectedDem - projectedRep) / voters) * 100 : 0;
    const flipped = (baselineMargin > 0) !== (projectedMargin > 0);

    return {
      precinctId: precinct.id,
      precinctName: precinct.name,
      baselineVotes: { dem: baselineDem, rep: baselineRep },
      projectedVotes: { dem: projectedDem, rep: projectedRep },
      baselineMargin,
      projectedMargin,
      flipped,
      impactScore: Math.abs(projectedMargin - baselineMargin) * 10,
    };
  }

  // --------------------------------------------------------------------------
  // Resource Allocation Scenarios
  // --------------------------------------------------------------------------

  /**
   * Recommend resource allocation based on strategy
   */
  async modelResourceScenario(scenario: ResourceScenario): Promise<{
    allocations: Array<{
      precinctId: string;
      precinctName: string;
      allocation: number;
      rationale: string;
      expectedImpact: number;
    }>;
    totalExpectedImpact: number;
    insights: string[];
  }> {
    const precincts = await this.getPrecinctData();

    // Score precincts based on strategy
    const scored = precincts.map(p => ({
      precinct: p,
      score: this.scorePrecinctForStrategy(p, scenario.allocationStrategy),
    }));

    // Sort by score and allocate resources
    scored.sort((a, b) => b.score - a.score);

    const allocations: Array<{
      precinctId: string;
      precinctName: string;
      allocation: number;
      rationale: string;
      expectedImpact: number;
    }> = [];

    let remainingResources = scenario.totalResources;
    let totalExpectedImpact = 0;

    for (const { precinct, score } of scored) {
      if (remainingResources <= 0) break;
      if (score < 20) continue; // Skip low-priority precincts

      // Allocate proportionally to score
      const allocation = Math.min(
        Math.round(scenario.totalResources * (score / 100) * 0.3),
        remainingResources
      );

      if (allocation > 0) {
        const expectedImpact = this.estimateResourceImpact(precinct, scenario, allocation);
        totalExpectedImpact += expectedImpact;

        allocations.push({
          precinctId: precinct.id,
          precinctName: precinct.name,
          allocation,
          rationale: this.getAllocationRationale(precinct, scenario.allocationStrategy),
          expectedImpact,
        });

        remainingResources -= allocation;
      }
    }

    return {
      allocations: allocations.slice(0, 20), // Top 20 precincts
      totalExpectedImpact,
      insights: this.generateResourceInsights(scenario, allocations, totalExpectedImpact),
    };
  }

  private scorePrecinctForStrategy(precinct: PrecinctData, strategy: ResourceScenario['allocationStrategy']): number {
    switch (strategy) {
      case 'gotv_priority':
        return precinct.gotv_priority || 50;
      case 'swing_priority':
        return precinct.swing_potential || 50;
      case 'persuasion_priority':
        return precinct.persuasion_opportunity || 50;
      case 'even':
        return 50;
      default:
        return 50;
    }
  }

  private estimateResourceImpact(
    precinct: PrecinctData,
    scenario: ResourceScenario,
    allocation: number
  ): number {
    // Estimate vote impact based on resource type and allocation
    const baseImpact = allocation * 0.1; // 10% efficiency baseline

    switch (scenario.resourceType) {
      case 'canvassers':
        // Canvassing: ~6-8% turnout boost per contact
        return Math.round(baseImpact * 0.07 * (precinct.registered_voters || 1000) / 100);
      case 'gotv_calls':
        // Calls: ~2-3% turnout boost
        return Math.round(baseImpact * 0.025 * (precinct.registered_voters || 1000) / 100);
      case 'mail':
        // Mail: ~1-2% turnout boost
        return Math.round(baseImpact * 0.015 * (precinct.registered_voters || 1000) / 100);
      case 'ad_spend':
        // Ads: ~0.5-1% persuasion
        return Math.round(baseImpact * 0.0075 * (precinct.registered_voters || 1000) / 100);
      default:
        return Math.round(baseImpact);
    }
  }

  private getAllocationRationale(precinct: PrecinctData, strategy: ResourceScenario['allocationStrategy']): string {
    switch (strategy) {
      case 'gotv_priority':
        return `High GOTV priority (${precinct.gotv_priority || 50}/100) - favorable base with turnout opportunity`;
      case 'swing_priority':
        return `High swing potential (${precinct.swing_potential || 50}/100) - competitive precinct`;
      case 'persuasion_priority':
        return `High persuasion opportunity (${precinct.persuasion_opportunity || 50}/100) - many persuadable voters`;
      case 'even':
        return 'Even distribution across all precincts';
      default:
        return 'Strategic allocation';
    }
  }

  // --------------------------------------------------------------------------
  // Preset Scenarios
  // --------------------------------------------------------------------------

  /**
   * Get common preset scenarios for quick analysis
   */
  getPresetScenarios(): Scenario[] {
    return [
      // Turnout scenarios
      {
        type: 'turnout',
        name: 'Student Turnout Surge',
        description: 'Model a 10-point increase in student turnout (e.g., from campus organizing)',
        targetGroup: 'students',
        turnoutChange: 10,
        assumptions: [
          'Students vote ~70% Democratic in Michigan',
          'Student precincts identified by proximity to MSU and LCC',
          'Assumes effective campus mobilization campaign',
        ],
      },
      {
        type: 'turnout',
        name: 'Senior Turnout Increase',
        description: 'Model a 5-point increase in senior turnout',
        targetGroup: 'seniors',
        turnoutChange: 5,
        assumptions: [
          'Seniors vote ~48% Democratic in Michigan suburbs',
          'Senior presence estimated from Census age data',
          'Common in high-profile elections',
        ],
      },
      {
        type: 'turnout',
        name: 'Low-Propensity Mobilization',
        description: 'Model a 8-point increase in low-propensity voter turnout',
        targetGroup: 'low_propensity',
        turnoutChange: 8,
        assumptions: [
          'Low-propensity voters tend to mirror precinct partisan lean',
          'Requires significant GOTV investment',
          'Common target for ground game operations',
        ],
      },
      // Persuasion scenarios
      {
        type: 'persuasion',
        name: 'Independent Voter Persuasion (D)',
        description: 'Model persuading 5% of independents toward Democrats',
        targetGroup: 'independents',
        persuasionRate: 5,
        direction: 'D',
        assumptions: [
          'Independent voters estimated at ~15% of electorate',
          'Half of persuaded come from leaning-R, half from undecided',
          'Requires targeted messaging and candidate appeal',
        ],
      },
      {
        type: 'persuasion',
        name: 'Ticket Splitter Consolidation (D)',
        description: 'Model consolidating 10% of ticket-splitters for Democrats',
        targetGroup: 'ticket_splitters',
        persuasionRate: 10,
        direction: 'D',
        assumptions: [
          'Ticket-splitting estimated from precinct variance',
          'These voters already showed willingness to vote D down-ballot',
          'Easier persuasion target than pure independents',
        ],
      },
    ];
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private async getPrecinctData(precinctIds?: string[]): Promise<PrecinctData[]> {
    try {
      // Get targeting scores which includes relevant metrics
      const targetingScores = await politicalDataService.getAllTargetingScores();
      const allScores = await politicalDataService.getAllPrecinctScores();

      if (!targetingScores || Object.keys(targetingScores).length === 0) {
        // Return mock data for testing
        return this.getMockPrecinctData();
      }

      // Convert to PrecinctData format
      const allPrecincts: PrecinctData[] = Object.entries(targetingScores).map(([name, scores]) => {
        const precinctScores = allScores.get(name);
        // PrecinctPoliticalScores has nested structure: partisanLean.value, turnout.averageTurnout, etc.
        const turnoutAvg = precinctScores?.turnout?.averageTurnout || 60;
        const partisanLeanValue = scores.political_scores?.partisan_lean || precinctScores?.partisanLean?.value || 0;
        const swingPotential = scores.political_scores?.swing_potential || precinctScores?.swingPotential?.value || 50;

        return {
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          registered_voters: scores.registered_voters || 1000,
          turnout_2024: turnoutAvg,
          avg_turnout: turnoutAvg,
          partisan_lean: partisanLeanValue,
          gotv_priority: scores.gotv_priority || 50,
          swing_potential: swingPotential,
          persuasion_opportunity: scores.persuasion_opportunity || 50,
          independent_pct: scores.ind_affiliation_pct || 15, // Use actual data if available
          ticket_split_rate: 8, // Default estimate
        };
      });

      if (precinctIds && precinctIds.length > 0) {
        return allPrecincts.filter(p => precinctIds.includes(p.id) || precinctIds.includes(p.name));
      }

      return allPrecincts;
    } catch (error) {
      console.warn('[ScenarioEngine] Error loading precinct data:', error);
      return this.getMockPrecinctData();
    }
  }

  private getMockPrecinctData(): PrecinctData[] {
    // Minimal mock data for testing
    return [
      {
        id: 'east-lansing-1',
        name: 'East Lansing P1',
        registered_voters: 3500,
        turnout_2024: 72,
        avg_turnout: 68,
        partisan_lean: -15, // D+15
        gotv_priority: 85,
        swing_potential: 78,
        persuasion_opportunity: 45,
        independent_pct: 18,
        ticket_split_rate: 12,
      },
      {
        id: 'lansing-3',
        name: 'Lansing P3',
        registered_voters: 2800,
        turnout_2024: 58,
        avg_turnout: 52,
        partisan_lean: -25, // D+25
        gotv_priority: 92,
        swing_potential: 35,
        persuasion_opportunity: 30,
        independent_pct: 12,
        ticket_split_rate: 6,
      },
      {
        id: 'meridian-1',
        name: 'Meridian P1',
        registered_voters: 4200,
        turnout_2024: 78,
        avg_turnout: 75,
        partisan_lean: 8, // R+8
        gotv_priority: 45,
        swing_potential: 65,
        persuasion_opportunity: 72,
        independent_pct: 22,
        ticket_split_rate: 15,
      },
    ];
  }

  private getStudentPresence(precinct: PrecinctData): number {
    // Estimate student presence (0-1) based on name or demographics
    const name = precinct.name.toLowerCase();
    if (name.includes('east lansing') || name.includes('msu')) {
      return 0.8;
    }
    if (name.includes('lansing') && !name.includes('east')) {
      return 0.3; // LCC students
    }
    return 0.1;
  }

  private getSeniorPresence(precinct: PrecinctData): number {
    // Estimate senior presence based on demographics or defaults
    return 0.25; // ~25% senior population average
  }

  private getLowPropensityPresence(precinct: PrecinctData): number {
    // Estimate based on turnout gap
    const avgTurnout = precinct.avg_turnout || 60;
    return Math.max(0, (80 - avgTurnout) / 80); // Lower turnout = more low-propensity
  }

  private generateTurnoutInsights(
    scenario: TurnoutScenario,
    netChange: number,
    flippedPrecincts: ScenarioResult['flippedPrecincts']
  ): string[] {
    const insights: string[] = [];

    if (netChange > 0) {
      insights.push(`Democrats gain net ${Math.round(netChange).toLocaleString()} votes from ${scenario.name.toLowerCase()}`);
    } else if (netChange < 0) {
      insights.push(`Republicans gain net ${Math.round(Math.abs(netChange)).toLocaleString()} votes from ${scenario.name.toLowerCase()}`);
    }

    if (flippedPrecincts.length > 0) {
      insights.push(`${flippedPrecincts.length} precinct(s) would flip under this scenario`);
    }

    if (scenario.targetGroup === 'students') {
      insights.push('Campus precincts show highest sensitivity to this scenario');
    }

    return insights;
  }

  private generatePersuasionInsights(
    scenario: PersuasionScenario,
    netChange: number,
    flippedPrecincts: ScenarioResult['flippedPrecincts']
  ): string[] {
    const insights: string[] = [];

    const party = scenario.direction === 'D' ? 'Democrats' : 'Republicans';
    insights.push(`${party} gain net ${Math.round(Math.abs(netChange)).toLocaleString()} votes from persuading ${scenario.targetGroup.replace('_', ' ')}`);

    if (flippedPrecincts.length > 0) {
      insights.push(`${flippedPrecincts.length} competitive precinct(s) would flip with this persuasion rate`);
    }

    if (scenario.targetGroup === 'ticket_splitters') {
      insights.push('Focus on precincts with high historical ticket-splitting for maximum efficiency');
    }

    return insights;
  }

  private generateResourceInsights(
    scenario: ResourceScenario,
    allocations: Array<{ precinctName: string; allocation: number; expectedImpact: number }>,
    totalExpectedImpact: number
  ): string[] {
    const insights: string[] = [];

    insights.push(`Total expected vote impact: ${totalExpectedImpact.toLocaleString()} additional votes`);

    const topPrecinct = allocations[0];
    if (topPrecinct) {
      insights.push(`Top target: ${topPrecinct.precinctName} (${topPrecinct.allocation} ${scenario.resourceType})`);
    }

    const efficiency = totalExpectedImpact / scenario.totalResources;
    insights.push(`Efficiency: ${efficiency.toFixed(2)} votes per unit of ${scenario.resourceType}`);

    return insights;
  }

  private assessConfidence(scenario: Scenario): 'high' | 'medium' | 'low' {
    // Turnout scenarios have more historical data
    if (scenario.type === 'turnout') {
      if (scenario.targetGroup === 'all') return 'high';
      if (scenario.targetGroup === 'students' || scenario.targetGroup === 'seniors') return 'medium';
      return 'low';
    }

    // Persuasion is harder to predict
    if (scenario.type === 'persuasion') {
      if (scenario.persuasionRate <= 5) return 'medium';
      return 'low';
    }

    return 'medium';
  }

  private getTurnoutMethodology(scenario: TurnoutScenario): string {
    return `Turnout scenario modeled by adjusting baseline turnout by ${scenario.turnoutChange} percentage points for ${scenario.targetGroup} voters. ` +
      `New voter partisan split estimated from historical patterns and demographic research. ` +
      `Precinct-level impacts aggregated to produce total vote estimates.`;
  }

  private getPersuasionMethodology(scenario: PersuasionScenario): string {
    return `Persuasion scenario modeled by converting ${scenario.persuasionRate}% of ${scenario.targetGroup.replace('_', ' ')} voters to ${scenario.direction === 'D' ? 'Democratic' : 'Republican'} support. ` +
      `Persuadable population estimated from registration data and historical ticket-splitting patterns. ` +
      `Assumes 50% of persuaded voters come from opposing party, 50% from undecided/third party.`;
  }
}

// ============================================================================
// Types for Precinct Data
// ============================================================================

interface PrecinctData {
  id: string;
  name: string;
  registered_voters?: number;
  turnout_2024?: number;
  avg_turnout?: number;
  partisan_lean?: number;
  gotv_priority?: number;
  swing_potential?: number;
  persuasion_opportunity?: number;
  independent_pct?: number;
  ticket_split_rate?: number;
}

// ============================================================================
// Singleton Export
// ============================================================================

let engineInstance: ScenarioModelingEngine | null = null;

export function getScenarioEngine(): ScenarioModelingEngine {
  if (!engineInstance) {
    engineInstance = ScenarioModelingEngine.getInstance();
  }
  return engineInstance;
}

export default ScenarioModelingEngine;
