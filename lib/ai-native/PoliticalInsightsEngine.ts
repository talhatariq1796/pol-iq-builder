/**
 * PoliticalInsightsEngine
 *
 * Generates proactive insights about political data without being asked.
 * Surfaces interesting patterns, anomalies, opportunities, and risks.
 *
 * Key Capabilities:
 * 1. Pattern Detection: Find unusual precincts, outliers, clusters
 * 2. Opportunity Identification: GOTV targets, persuasion opportunities
 * 3. Risk Assessment: Vulnerabilities, competitive threats
 * 4. Trend Analysis: Changes over time, momentum shifts
 * 5. Strategic Suggestions: Actionable recommendations
 */

import type { SuggestedAction, MapCommand } from './types';
import { MapCommandBridge } from './MapCommandBridge';

// ============================================================================
// Types
// ============================================================================

export interface Insight {
  id: string;
  type: InsightType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: InsightEvidence[];
  affectedPrecincts: string[];
  suggestedActions: SuggestedAction[];
  mapCommand?: MapCommand;
  timestamp: Date;
  dismissed?: boolean;
}

export type InsightType =
  | 'opportunity'
  | 'risk'
  | 'anomaly'
  | 'trend'
  | 'pattern'
  | 'recommendation';

export interface InsightEvidence {
  metric: string;
  value: number | string;
  comparison?: string;
  significance: string;
}

export interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: string;
  demographics: {
    totalPopulation: number;
    population18up: number;
    medianAge: number;
    medianHHI: number;
    collegePct: number;
    diversityIndex: number;
    populationDensity: number;
  };
  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
  };
  electoral: {
    partisanLean: number;
    swingPotential: number;
    avgTurnout: number;
    turnoutDropoff: number;
    competitiveness: string;
  };
  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };
  elections?: Record<string, {
    demPct: number;
    repPct: number;
    margin: number;
    turnout: number;
  }>;
}

export interface InsightGeneratorConfig {
  minPriorityLevel: 'critical' | 'high' | 'medium' | 'low';
  maxInsights: number;
  includeTypes: InsightType[];
  focusJurisdictions?: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: InsightGeneratorConfig = {
  minPriorityLevel: 'medium',
  maxInsights: 10,
  includeTypes: ['opportunity', 'risk', 'anomaly', 'trend', 'pattern', 'recommendation'],
};

// Priority order for filtering
const PRIORITY_ORDER: Record<Insight['priority'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ============================================================================
// Insight Generators
// ============================================================================

/**
 * Find precincts with unusually high GOTV opportunity
 */
function findGOTVOpportunities(precincts: PrecinctData[]): Insight[] {
  const insights: Insight[] = [];

  // High Democratic affiliation + low turnout = GOTV gold
  const gotvTargets = precincts.filter(p =>
    p.political.demAffiliationPct > 50 &&
    p.electoral.avgTurnout < 50 &&
    p.targeting.gotvPriority > 70
  );

  if (gotvTargets.length >= 3) {
    const totalVoters = gotvTargets.reduce((sum, p) => sum + p.demographics.population18up, 0);
    const avgTurnout = gotvTargets.reduce((sum, p) => sum + p.electoral.avgTurnout, 0) / gotvTargets.length;

    insights.push({
      id: `gotv-opportunity-${Date.now()}`,
      type: 'opportunity',
      priority: 'high',
      title: `${gotvTargets.length} High-Value GOTV Targets Identified`,
      description: `Found ${gotvTargets.length} precincts with strong Democratic base (50%+ affiliation) but low turnout (${avgTurnout.toFixed(1)}% avg). Total of ${totalVoters.toLocaleString()} voting-age adults could be mobilized.`,
      evidence: [
        { metric: 'Avg. Turnout', value: `${avgTurnout.toFixed(1)}%`, comparison: 'vs 55% county avg', significance: 'Low turnout leaves room for gains' },
        { metric: 'Total VAP', value: totalVoters.toLocaleString(), significance: 'Large voter pool' },
        { metric: 'Avg. GOTV Priority', value: Math.round(gotvTargets.reduce((s, p) => s + p.targeting.gotvPriority, 0) / gotvTargets.length), significance: 'Above threshold' },
      ],
      affectedPrecincts: gotvTargets.map(p => p.id),
      suggestedActions: [
        { id: 'view-gotv-targets', label: 'View GOTV Targets', action: 'segment:show', icon: 'map', variant: 'primary', metadata: { precinctIds: gotvTargets.map(p => p.id) } },
        { id: 'create-canvass', label: 'Create Canvass Universe', action: 'canvass:create', icon: 'route' },
        { id: 'save-segment', label: 'Save as Segment', action: 'segment:save', icon: 'save' },
      ],
      mapCommand: MapCommandBridge.createHighlightPrecincts(gotvTargets.map(p => p.id), {
        fillColor: '#22c55e',
        strokeColor: '#15803d',
        opacity: 0.6,
      }),
      timestamp: new Date(),
    });
  }

  return insights;
}

/**
 * Find vulnerable precincts that could flip
 */
function findVulnerablePrecincts(precincts: PrecinctData[]): Insight[] {
  const insights: Insight[] = [];

  // Close margins + high swing potential = vulnerability
  const vulnerable = precincts.filter(p =>
    Math.abs(p.electoral.partisanLean) < 10 &&
    p.electoral.swingPotential > 50
  );

  if (vulnerable.length >= 2) {
    // Check which direction they lean
    const demLeaning = vulnerable.filter(p => p.electoral.partisanLean > 0);
    const repLeaning = vulnerable.filter(p => p.electoral.partisanLean < 0);

    if (demLeaning.length > 0) {
      insights.push({
        id: `vulnerable-dem-${Date.now()}`,
        type: 'risk',
        priority: demLeaning.length >= 3 ? 'high' : 'medium',
        title: `${demLeaning.length} Democratic-Leaning Precincts at Risk`,
        description: `These precincts currently lean Democratic but have high swing potential. Without defensive investment, they could flip.`,
        evidence: [
          { metric: 'Avg. Lean', value: `+${(demLeaning.reduce((s, p) => s + p.electoral.partisanLean, 0) / demLeaning.length).toFixed(1)}D`, significance: 'Narrow margin' },
          { metric: 'Avg. Swing Potential', value: Math.round(demLeaning.reduce((s, p) => s + p.electoral.swingPotential, 0) / demLeaning.length), significance: 'High volatility' },
        ],
        affectedPrecincts: demLeaning.map(p => p.id),
        suggestedActions: [
          { id: 'view-vulnerable', label: 'View Vulnerable Precincts', action: 'map:highlight', icon: 'alert-triangle', variant: 'primary' },
          { id: 'defensive-plan', label: 'Create Defensive Plan', action: 'canvass:create', icon: 'shield' },
        ],
        mapCommand: MapCommandBridge.createHighlightPrecincts(demLeaning.map(p => p.id), {
          fillColor: '#ef4444',
          strokeColor: '#b91c1c',
          opacity: 0.6,
        }),
        timestamp: new Date(),
      });
    }
  }

  return insights;
}

/**
 * Find anomalies in the data
 */
function findAnomalies(precincts: PrecinctData[]): Insight[] {
  const insights: Insight[] = [];

  // Calculate means and standard deviations
  const calcStats = (values: number[]) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
    return { mean, stdDev };
  };

  // Check turnout anomalies
  const turnouts = precincts.map(p => p.electoral.avgTurnout);
  const turnoutStats = calcStats(turnouts);

  const turnoutAnomalies = precincts.filter(p =>
    Math.abs(p.electoral.avgTurnout - turnoutStats.mean) > 2 * turnoutStats.stdDev
  );

  if (turnoutAnomalies.length > 0) {
    const lowTurnout = turnoutAnomalies.filter(p => p.electoral.avgTurnout < turnoutStats.mean);
    const highTurnout = turnoutAnomalies.filter(p => p.electoral.avgTurnout > turnoutStats.mean);

    if (lowTurnout.length > 0) {
      insights.push({
        id: `anomaly-low-turnout-${Date.now()}`,
        type: 'anomaly',
        priority: 'medium',
        title: `Unusually Low Turnout in ${lowTurnout.length} Precinct${lowTurnout.length > 1 ? 's' : ''}`,
        description: `${lowTurnout.map(p => p.name).join(', ')} ${lowTurnout.length > 1 ? 'have' : 'has'} turnout more than 2 standard deviations below county average. This could indicate suppression, disengagement, or data issues.`,
        evidence: lowTurnout.slice(0, 3).map(p => ({
          metric: p.name,
          value: `${p.electoral.avgTurnout}%`,
          comparison: `vs ${turnoutStats.mean.toFixed(1)}% avg`,
          significance: 'Statistical outlier',
        })),
        affectedPrecincts: lowTurnout.map(p => p.id),
        suggestedActions: [
          { id: 'investigate', label: 'Investigate Causes', action: 'analyze:precinct', icon: 'search' },
          { id: 'gotv-focus', label: 'Focus GOTV Here', action: 'segment:create', icon: 'target' },
        ],
        timestamp: new Date(),
      });
    }
  }

  // Check for partisan lean vs demographics mismatch
  const mismatches = precincts.filter(p => {
    // High college + high income usually correlates with moderate Dem lean
    // If we see opposite, it's interesting
    const expectedLeanRange = p.demographics.collegePct > 50 ? [-5, 25] : [-15, 15];
    return p.electoral.partisanLean < expectedLeanRange[0] || p.electoral.partisanLean > expectedLeanRange[1];
  });

  if (mismatches.length >= 2) {
    insights.push({
      id: `anomaly-demographic-mismatch-${Date.now()}`,
      type: 'anomaly',
      priority: 'low',
      title: `${mismatches.length} Precincts Show Unexpected Voting Patterns`,
      description: `These precincts vote differently than their demographics would predict. Worth investigating for persuasion or GOTV opportunities.`,
      evidence: [
        { metric: 'Precincts', value: mismatches.length, significance: 'Demographic-political mismatch' },
      ],
      affectedPrecincts: mismatches.map(p => p.id),
      suggestedActions: [
        { id: 'deep-dive', label: 'Deep Dive Analysis', action: 'analyze:demographic-political', icon: 'bar-chart' },
      ],
      timestamp: new Date(),
    });
  }

  return insights;
}

/**
 * Find patterns across jurisdictions
 */
function findPatterns(precincts: PrecinctData[]): Insight[] {
  const insights: Insight[] = [];

  // Group by jurisdiction
  const byJurisdiction = new Map<string, PrecinctData[]>();
  precincts.forEach(p => {
    const list = byJurisdiction.get(p.jurisdiction) || [];
    list.push(p);
    byJurisdiction.set(p.jurisdiction, list);
  });

  // Find jurisdiction-level patterns
  const jurisdictionStats = Array.from(byJurisdiction.entries()).map(([name, pcts]) => ({
    name,
    avgLean: pcts.reduce((s, p) => s + p.electoral.partisanLean, 0) / pcts.length,
    avgTurnout: pcts.reduce((s, p) => s + p.electoral.avgTurnout, 0) / pcts.length,
    avgGOTV: pcts.reduce((s, p) => s + p.targeting.gotvPriority, 0) / pcts.length,
    count: pcts.length,
  }));

  // Find jurisdiction with highest GOTV potential
  const sortedByGOTV = [...jurisdictionStats].sort((a, b) => b.avgGOTV - a.avgGOTV);
  if (sortedByGOTV.length > 0 && sortedByGOTV[0].avgGOTV > 60) {
    const top = sortedByGOTV[0];
    insights.push({
      id: `pattern-jurisdiction-gotv-${Date.now()}`,
      type: 'pattern',
      priority: 'medium',
      title: `${top.name} Has Highest GOTV Potential`,
      description: `With an average GOTV priority of ${top.avgGOTV.toFixed(0)}/100 across ${top.count} precincts, ${top.name} should be the primary focus for turnout operations.`,
      evidence: [
        { metric: 'Avg. GOTV Priority', value: top.avgGOTV.toFixed(0), significance: 'Highest in county' },
        { metric: 'Precinct Count', value: top.count, significance: 'Sufficient scale' },
        { metric: 'Avg. Turnout', value: `${top.avgTurnout.toFixed(1)}%`, significance: 'Room for improvement' },
      ],
      affectedPrecincts: byJurisdiction.get(top.name)?.map(p => p.id) || [],
      suggestedActions: [
        { id: 'focus-jurisdiction', label: `Focus on ${top.name}`, action: 'map:flyTo', icon: 'map-pin', variant: 'primary', metadata: { jurisdiction: top.name } },
        { id: 'compare', label: 'Compare to Others', action: 'compare:jurisdictions', icon: 'layers' },
      ],
      mapCommand: {
        type: 'flyTo',
        target: top.name,
        zoom: 12,
      },
      timestamp: new Date(),
    });
  }

  return insights;
}

/**
 * Generate strategic recommendations
 */
function generateRecommendations(precincts: PrecinctData[]): Insight[] {
  const insights: Insight[] = [];

  // Overall strategy recommendation based on data
  const avgLean = precincts.reduce((s, p) => s + p.electoral.partisanLean, 0) / precincts.length;
  const avgTurnout = precincts.reduce((s, p) => s + p.electoral.avgTurnout, 0) / precincts.length;
  const highGOTVCount = precincts.filter(p => p.targeting.gotvPriority > 70).length;
  const highPersuasionCount = precincts.filter(p => p.targeting.persuasionOpportunity > 50).length;

  let recommendedStrategy: 'gotv' | 'persuasion' | 'battleground';
  let rationale: string;

  if (avgLean > 10 && highGOTVCount > highPersuasionCount) {
    recommendedStrategy = 'gotv';
    rationale = `Strong Democratic lean (+${avgLean.toFixed(1)}) with ${highGOTVCount} high-GOTV precincts suggests focusing on base mobilization.`;
  } else if (Math.abs(avgLean) < 5 && highPersuasionCount > 5) {
    recommendedStrategy = 'persuasion';
    rationale = `Near-neutral lean and ${highPersuasionCount} persuasion targets suggest focusing on swing voters.`;
  } else {
    recommendedStrategy = 'battleground';
    rationale = `Mixed indicators suggest a battleground approach combining GOTV and persuasion.`;
  }

  insights.push({
    id: `recommendation-strategy-${Date.now()}`,
    type: 'recommendation',
    priority: 'high',
    title: `Recommended Strategy: ${recommendedStrategy.toUpperCase()}`,
    description: rationale,
    evidence: [
      { metric: 'County Lean', value: `${avgLean > 0 ? '+' : ''}${avgLean.toFixed(1)}D`, significance: 'Overall partisan environment' },
      { metric: 'High-GOTV Precincts', value: highGOTVCount, significance: 'GOTV opportunity' },
      { metric: 'Persuasion Targets', value: highPersuasionCount, significance: 'Persuasion opportunity' },
    ],
    affectedPrecincts: [],
    suggestedActions: [
      { id: 'apply-strategy', label: `Apply ${recommendedStrategy.toUpperCase()} Strategy`, action: `workflow:find-targets`, icon: 'target', variant: 'primary', metadata: { strategy: recommendedStrategy } },
      { id: 'explain', label: 'Explain Reasoning', action: 'analyze:strategy-explanation', icon: 'info' },
    ],
    timestamp: new Date(),
  });

  return insights;
}

// ============================================================================
// Main Engine
// ============================================================================

export class PoliticalInsightsEngine {
  private static instance: PoliticalInsightsEngine;
  private cachedInsights: Insight[] = [];
  private lastGeneratedAt: Date | null = null;
  private cacheValidityMs = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): PoliticalInsightsEngine {
    if (!PoliticalInsightsEngine.instance) {
      PoliticalInsightsEngine.instance = new PoliticalInsightsEngine();
    }
    return PoliticalInsightsEngine.instance;
  }

  /**
   * Generate insights from precinct data
   */
  generateInsights(
    precincts: PrecinctData[],
    config: Partial<InsightGeneratorConfig> = {}
  ): Insight[] {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    // Check cache validity
    if (
      this.lastGeneratedAt &&
      Date.now() - this.lastGeneratedAt.getTime() < this.cacheValidityMs &&
      this.cachedInsights.length > 0
    ) {
      return this.filterInsights(this.cachedInsights, fullConfig);
    }

    // Generate all insights
    const allInsights: Insight[] = [
      ...findGOTVOpportunities(precincts),
      ...findVulnerablePrecincts(precincts),
      ...findAnomalies(precincts),
      ...findPatterns(precincts),
      ...generateRecommendations(precincts),
    ];

    // Cache results
    this.cachedInsights = allInsights;
    this.lastGeneratedAt = new Date();

    return this.filterInsights(allInsights, fullConfig);
  }

  /**
   * Filter and sort insights based on config
   */
  private filterInsights(
    insights: Insight[],
    config: InsightGeneratorConfig
  ): Insight[] {
    const minPriority = PRIORITY_ORDER[config.minPriorityLevel];

    return insights
      .filter(i => !i.dismissed)
      .filter(i => config.includeTypes.includes(i.type))
      .filter(i => PRIORITY_ORDER[i.priority] <= minPriority)
      .filter(i => {
        if (!config.focusJurisdictions || config.focusJurisdictions.length === 0) return true;
        // If insight has affected precincts, check if any are in focus jurisdictions
        // This is a simplified check - in reality would need precinct-to-jurisdiction mapping
        return true;
      })
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
      .slice(0, config.maxInsights);
  }

  /**
   * Dismiss an insight (won't show again until cache expires)
   */
  dismissInsight(insightId: string): void {
    const insight = this.cachedInsights.find(i => i.id === insightId);
    if (insight) {
      insight.dismissed = true;
    }
  }

  /**
   * Get a single high-priority insight for display
   */
  getTopInsight(precincts: PrecinctData[]): Insight | null {
    const insights = this.generateInsights(precincts, { maxInsights: 1 });
    return insights[0] || null;
  }

  /**
   * Clear the insight cache
   */
  clearCache(): void {
    this.cachedInsights = [];
    this.lastGeneratedAt = null;
  }

  /**
   * Format insight for display in chat
   */
  formatInsightForChat(insight: Insight): string {
    const priorityEmoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '📊',
      low: 'ℹ️',
    }[insight.priority];

    let text = `${priorityEmoji} **${insight.title}**\n\n`;
    text += `${insight.description}\n\n`;

    if (insight.evidence.length > 0) {
      text += '**Evidence:**\n';
      insight.evidence.forEach(e => {
        text += `- ${e.metric}: ${e.value}`;
        if (e.comparison) text += ` (${e.comparison})`;
        text += '\n';
      });
    }

    return text;
  }
}

// ============================================================================
// Export
// ============================================================================

export const insightsEngine = PoliticalInsightsEngine.getInstance();

export default PoliticalInsightsEngine;
