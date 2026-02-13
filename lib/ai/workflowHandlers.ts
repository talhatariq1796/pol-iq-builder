/**
 * Workflow Handlers for AI Political Conversation
 *
 * Real handlers that fetch and process data from APIs
 * Enhanced with context awareness (Phase 2 - Claude Integration Plan)
 *
 * INTENT → COMMAND TRANSLATION GUIDE (P2-34):
 * This file translates user intents (parsed from natural language) into map commands.
 *
 * Intent Types → Map Commands:
 * - filter_request → showHeatmap (for metrics) OR showChoropleth (for margins)
 * - district_query → flyTo (location) + showChoropleth OR showHeatmap
 * - comparison → highlightComparison (two entities, different colors)
 * - spatial_query → showBuffer (radius/drivetime) + highlight (results)
 * - segment_create → highlight (matching precincts)
 *
 * Command Selection Logic:
 * - Numeric metrics (swing, gotv, persuasion) → showHeatmap
 * - Categorical/competitive data → showChoropleth
 * - Location-based queries → flyTo + visualization layer
 * - Multiple entities → highlightComparison OR showNumberedMarkers
 * - Spatial proximity → showBuffer + highlight
 */

import type { MapCommand, SuggestedAction } from '@/components/ai-native/AIPoliticalSessionHost';
import type { SegmentFilters } from '@/lib/segmentation/types';
import { fuzzyMatchPrecinct } from './intentParser';
import { getRecentReports, REPORT_TYPE_CONFIG, type ReportHistoryEntry } from './ReportHistoryService';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { getSuggestionEngine } from '@/lib/ai-native/SuggestionEngine';
import { getSpatialReasoningEngine, type SpatialAnalysis } from '@/lib/ai/spatial';
import {
  getInsightEngine,
  type Insight,
  type InsightCategory,
  frameAsDiscovery,
  getFollowUpQuestions,
  getActionableRecommendations,
} from '@/lib/ai/insights';

import {
  getConfidenceEngine,
  getCitationService,
  type ConfidenceMetadata,
  type CitationKey,
} from '@/lib/ai/confidence';

import {
  createCollapsibleSection,
  createSourcesSection,
  createPrecinctsSection,
  STANDARD_SOURCES,
} from '@/lib/ai-native/handlers/types';

import {
  getStateHouseContext,
  getStateSenateContext,
  getCongressionalContext,
  formatCandidateContextForResponse,
  type CandidateContext,
} from '@/lib/knowledge-graph/CandidateContextService';

import {
  enrich,
  enrichDistrictAnalysis,
  enrichFilterQuery,
  enrichComparison,
  formatForResponse,
  type EnrichmentContext,
} from '@/lib/context';

// ============================================================================
// Context Awareness Helpers (Phase 2)
// ============================================================================

interface ExplorationContext {
  recentPrecincts: string[];
  explorationDepth: number;
  toolsVisited: string[];
  hasHighValueFinds: boolean;
  sessionMinutes: number;
  filtersApplied: number;
  comparisonsMade: number;
}

/**
 * Get current exploration context from StateManager
 */
function getExplorationContext(): ExplorationContext {
  try {
    const stateManager = getStateManager();
    const metrics = stateManager.getExplorationMetrics();
    const state = stateManager.getState();

    // Get recent precinct names from exploration history
    const recentPrecincts = state.explorationHistory
      .filter(entry => entry.precinctIds && entry.precinctIds.length > 0)
      .slice(-5)
      .flatMap(entry => entry.precinctIds || []);

    return {
      recentPrecincts: [...new Set(recentPrecincts)], // Deduplicate
      explorationDepth: stateManager.getExplorationDepth(),
      toolsVisited: metrics.toolsVisited,
      hasHighValueFinds: metrics.highValueFound,
      sessionMinutes: metrics.sessionDuration,
      filtersApplied: metrics.filtersApplied,
      comparisonsMade: metrics.comparisonsMade,
    };
  } catch {
    // Return defaults if state manager not available
    return {
      recentPrecincts: [],
      explorationDepth: 0,
      toolsVisited: [],
      hasHighValueFinds: false,
      sessionMinutes: 0,
      filtersApplied: 0,
      comparisonsMade: 0,
    };
  }
}

/**
 * Generate recovery suggestions when user action requires missing context
 */
function generateRecoverySuggestions(missingContext: 'selection' | 'segment' | 'comparison' | 'filter'): SuggestedAction[] {
  const baseActions: SuggestedAction[] = [
    { id: 'click-map', label: 'Click map to select', action: 'Click on the map to select a precinct', icon: 'map-pin' },
    { id: 'browse-all', label: 'Browse all precincts', action: 'Show me all precincts in Ingham County', icon: 'list' },
  ];

  switch (missingContext) {
    case 'selection':
      return [
        ...baseActions,
        { id: 'draw-boundary', label: 'Draw custom area', action: 'map:enableDraw', icon: 'edit' },
        { id: 'use-saved', label: 'Use saved segment', action: 'navigate:segments', icon: 'bookmark' },
      ];
    case 'segment':
      return [
        { id: 'create-segment', label: 'Create new segment', action: 'navigate:segments', icon: 'plus' },
        { id: 'quick-filter', label: 'Quick filter: High GOTV', action: 'Find precincts with GOTV priority above 70', icon: 'filter' },
        ...baseActions,
      ];
    case 'comparison':
      return [
        { id: 'select-first', label: 'Select first precinct', action: 'Click on a precinct to start comparison', icon: 'target' },
        { id: 'compare-example', label: 'Example comparison', action: 'Compare East Lansing to Meridian Township', icon: 'git-compare' },
      ];
    case 'filter':
      return [
        { id: 'show-filters', label: 'Show available filters', action: 'What filters can I use?', icon: 'filter' },
        { id: 'preset-gotv', label: 'Use GOTV preset', action: 'Apply GOTV targeting filter', icon: 'zap' },
        { id: 'preset-swing', label: 'Use swing preset', action: 'Find swing precincts', icon: 'trending-up' },
      ];
    default:
      return baseActions;
  }
}

/**
 * Enhance a response with context-aware additions
 */
function enhanceResponseWithContext(
  baseResponse: string,
  currentPrecinct?: string
): string {
  const context = getExplorationContext();

  // If user has explored other precincts, mention them
  if (context.recentPrecincts.length > 1 && currentPrecinct) {
    const otherPrecincts = context.recentPrecincts
      .filter(p => p !== currentPrecinct)
      .slice(0, 3);

    if (otherPrecincts.length > 0) {
      baseResponse += `\n\n📍 *You've also explored ${otherPrecincts.join(', ')} this session. Want to compare them?*`;
    }
  }

  // If deep exploration, suggest output actions
  if (context.explorationDepth > 50 && context.recentPrecincts.length >= 3) {
    baseResponse += `\n\n💡 *With ${context.recentPrecincts.length} precincts explored, you're ready to generate a comprehensive report or create a targeting segment.*`;
  }

  return baseResponse;
}

/**
 * Generate context-aware suggested actions
 * Wave 6B: Now integrates SuggestionEngine.generateOutputSuggestions()
 */
function getContextAwareSuggestions(
  baseSuggestions: SuggestedAction[],
  currentPrecinct?: string
): SuggestedAction[] {
  const context = getExplorationContext();
  const suggestions = [...baseSuggestions];

  // If user has explored multiple precincts, suggest comparison
  if (context.recentPrecincts.length >= 2 && currentPrecinct) {
    const otherPrecinct = context.recentPrecincts.find(p => p !== currentPrecinct);
    if (otherPrecinct) {
      suggestions.push({
        id: 'compare-recent',
        label: `Compare with ${otherPrecinct}`,
        action: `Compare ${currentPrecinct} to ${otherPrecinct}`,
        icon: 'git-compare'
      });
    }
  }

  // Wave 6B: Get output suggestions from SuggestionEngine based on exploration depth
  try {
    const suggestionEngine = getSuggestionEngine();
    const stateManager = getStateManager();
    const state = stateManager.getState();

    // Get threshold-based output suggestions (save segment, export, generate report, etc.)
    const outputSuggestions = suggestionEngine.generateOutputSuggestions(state);

    // Convert to SuggestedAction format and merge (avoid duplicates by ID)
    const existingIds = new Set(suggestions.map(s => s.id));
    for (const outputSugg of outputSuggestions) {
      if (!existingIds.has(outputSugg.id)) {
        suggestions.push({
          id: outputSugg.id,
          label: outputSugg.label,
          action: outputSugg.action,
          icon: outputSugg.category === 'canvassing' ? 'map-pin'
              : outputSugg.category === 'reporting' ? 'file-text'
              : outputSugg.category === 'segmentation' ? 'filter'
              : 'arrow-right',
          metadata: outputSugg.metadata,
        });
        existingIds.add(outputSugg.id);
      }
    }
  } catch (error) {
    console.warn('[workflowHandlers] SuggestionEngine not available:', error);
  }

  // Legacy: Manual fallback suggestions (kept for compatibility)
  // If deep exploration and no output suggestion yet, suggest save
  if (context.explorationDepth > 60 && !suggestions.some(s => s.id.startsWith('output-'))) {
    suggestions.push({
      id: 'save-segment',
      label: 'Save as targeting segment',
      action: 'output:saveSegment',
      icon: 'save'
    });
  }

  // If user has made comparisons, suggest report
  if (context.comparisonsMade >= 2 && !suggestions.some(s => s.id === 'output-save-comparison')) {
    suggestions.push({
      id: 'generate-comparison-report',
      label: 'Generate comparison report',
      action: 'report:comparison',
      icon: 'file-text'
    });
  }

  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

// ============================================================================
// Confidence Expression Helpers (Agent 3A - Wave 4)
// ============================================================================

/**
 * Express confidence level in natural language
 */
function expressConfidence(
  level: 'high' | 'medium' | 'low',
  insight: string,
  methodology?: string
): string {
  const expressions = {
    high: {
      prefix: '**High confidence**: ',
      suffix: methodology ? ` (Based on ${methodology})` : '',
    },
    medium: {
      prefix: 'Likely: ',
      suffix: methodology ? ` (${methodology})` : '',
    },
    low: {
      prefix: 'Possible: ',
      suffix: methodology ? ` (Limited data: ${methodology})` : '',
    },
  };

  const expr = expressions[level];
  return `${expr.prefix}${insight}${expr.suffix}`;
}

/**
 * Determine confidence level based on data quality
 */
function assessConfidence(factors: {
  dataPoints?: number;
  historicalElections?: number;
  margin?: number;
  sampleSize?: number;
}): 'high' | 'medium' | 'low' {
  let score = 0;

  if (factors.dataPoints && factors.dataPoints > 100) score += 2;
  else if (factors.dataPoints && factors.dataPoints > 20) score += 1;

  if (factors.historicalElections && factors.historicalElections >= 3) score += 2;
  else if (factors.historicalElections && factors.historicalElections >= 2) score += 1;

  if (factors.margin !== undefined) {
    if (Math.abs(factors.margin) > 10) score += 2; // Clear trend
    else if (Math.abs(factors.margin) > 5) score += 1;
  }

  if (factors.sampleSize && factors.sampleSize > 1000) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Wave 6B.5: Check for serendipitous cross-domain insights
 * This finds unexpected connections (e.g., donor-GOTV overlap, geographic patterns)
 */
async function checkAndAppendSerendipitousInsight(
  baseResponse: string,
  trigger: 'precinct_selection' | 'filter_applied' | 'segment_created' | 'query_response',
  context?: { precincts?: string[]; metric?: string }
): Promise<string> {
  try {
    const suggestionEngine = getSuggestionEngine();
    const result = await suggestionEngine.checkForSerendipitousInsight(trigger);

    // InsightCheckResult uses hasInsight + insights[] (not found + insight)
    if (result.hasInsight && result.insights.length > 0) {
      const insight = result.insights[0]; // Take first (most relevant) insight
      // Frame the insight as a discovery
      // Insight has: title, message, shortMessage - use title as the headline
      const discoveryText = frameAsDiscovery
        ? frameAsDiscovery(insight)
        : insight.title;

      return `${baseResponse}\n\n💡 **Unexpected Discovery**: ${discoveryText}\n${insight.shortMessage}`;
    }
  } catch (error) {
    console.warn('[workflowHandlers] Serendipitous insight check failed:', error);
  }
  return baseResponse;
}

/**
 * Wave 6D.5: Check for donor-GOTV cross-tool serendipity
 * Finds valuable overlap between donor concentration and GOTV priority areas
 */
function checkDonorGOTVOverlap(): { hasOverlap: boolean; insight: string; overlappingAreas: string[] } {
  try {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const history = state.explorationHistory || [];

    // Extract high-GOTV precincts from exploration history
    const gotvPrecincts = history
      .filter(e => {
        const gotvPriority = e.metadata?.gotvPriority as number | undefined;
        return gotvPriority !== undefined && gotvPriority > 70;
      })
      .flatMap(e => e.precinctIds || []);

    // Extract top donor ZIPs from exploration history
    const donorData = history
      .filter(e => e.tool === 'donors' && e.metadata?.topZips)
      .flatMap(e => (e.metadata?.topZips as string[]) || []);

    // Check for exploration in both domains
    if (gotvPrecincts.length > 0 && donorData.length > 0) {
      // Provide actionable insight about strategic overlap opportunity
      // Note: True geographic intersection would require precinct-to-ZIP crosswalk data
      // which is not currently loaded in the handler context
      const uniqueGotvPrecincts = Array.from(new Set(gotvPrecincts));
      const uniqueDonorZips = Array.from(new Set(donorData));

      return {
        hasOverlap: true,
        insight: `💡 **Cross-Tool Discovery**: You've explored ${uniqueGotvPrecincts.length} high-GOTV precincts ` +
          `and ${uniqueDonorZips.length} top donor ZIP codes. **Strategic opportunity**: Deploy canvassing teams in ` +
          `high-GOTV areas that overlap with donor-rich ZIPs for dual-purpose outreach (voter contact + fundraising asks). ` +
          `Consider analyzing precinct-ZIP overlap on the map to identify these high-value zones.`,
        overlappingAreas: uniqueGotvPrecincts.slice(0, 3),
      };
    }

    return { hasOverlap: false, insight: '', overlappingAreas: [] };
  } catch {
    return { hasOverlap: false, insight: '', overlappingAreas: [] };
  }
}

/**
 * Wave 6D.5: Check for segment-canvassing cross-tool serendipity
 * Suggests canvassing when user has explored/saved segments
 */
function checkSegmentCanvassOpportunity(): { hasOpportunity: boolean; insight: string; segmentName?: string } {
  try {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const savedSegments = state.segmentation?.savedSegments || [];
    const history = state.explorationHistory || [];

    // Check if user has saved segments but hasn't visited canvassing
    const hasVisitedCanvass = history.some(e => e.tool === 'canvass');

    if (savedSegments.length > 0 && !hasVisitedCanvass) {
      const recentSegment = savedSegments[savedSegments.length - 1];
      return {
        hasOpportunity: true,
        insight: `💡 **Next Step Suggestion**: You've saved "${recentSegment.name}" as a segment. ` +
          `Ready to turn this into a canvassing plan? The Canvassing Planner can optimize routes for these precincts.`,
        segmentName: recentSegment.name,
      };
    }

    return { hasOpportunity: false, insight: '' };
  } catch {
    return { hasOpportunity: false, insight: '' };
  }
}

// ============================================================================
// "So What" Intelligence Generation (Wave 6B)
// ============================================================================
// Note: Uses PrecinctData interface defined below (~line 556)

/**
 * Generate "So What" strategic insight for a precinct
 * This answers: Why should a campaign strategist care about this data?
 */
function generatePrecinctSoWhat(precinct: PrecinctData): string {
  const { electoral, targeting, demographics } = precinct;
  const insights: string[] = [];

  // Determine primary strategic value
  const swingScore = electoral.swingPotential;
  const gotvScore = targeting.gotvPriority;
  const persuasionScore = targeting.persuasionOpportunity;
  const turnout = electoral.avgTurnout;
  const lean = electoral.partisanLean;

  // High swing potential insight
  if (swingScore >= 70) {
    insights.push(
      `**Strategic Opportunity**: This is a true battleground precinct (swing ${swingScore}/100). ` +
      `Historical voting patterns show ${Math.abs(lean) < 5 ? 'nearly split' : 'volatile'} partisan support. ` +
      `A focused persuasion effort here could flip outcomes.`
    );
  } else if (swingScore >= 50) {
    insights.push(
      `**Moderate Swing Potential**: This precinct shows some electoral flexibility (swing ${swingScore}/100). ` +
      `Consider it a secondary persuasion target behind your highest-swing priorities.`
    );
  }

  // GOTV priority insight
  if (gotvScore >= 80 && lean < -5) {
    insights.push(
      `**High GOTV Value**: Strong Democratic lean (D+${Math.abs(lean).toFixed(0)}) with ${gotvScore}/100 GOTV priority. ` +
      `Mobilizing voters here could yield significant net votes. ` +
      `With ${demographics.totalPopulation.toLocaleString()} residents, this is a prime turnout target.`
    );
  } else if (gotvScore >= 80 && lean > 5) {
    insights.push(
      `**High GOTV Value (R)**: Strong Republican lean (R+${lean.toFixed(0)}) with ${gotvScore}/100 GOTV priority. ` +
      `Mobilizing your base here is high-leverage if you're running as a Republican.`
    );
  }

  // Persuasion insight
  if (persuasionScore >= 70) {
    insights.push(
      `**Persuasion Opportunity**: ${persuasionScore}/100 persuadability score indicates many persuadable voters. ` +
      `Consider door-knocking with issue-focused messaging rather than pure partisan appeals.`
    );
  }

  // Turnout anomaly insight
  // Note: avgTurnout is already stored as percentage (e.g., 55.3 = 55.3%)
  if (turnout < 55) {
    const additionalVotes = Math.round(demographics.population18up * 0.1); // Rough estimate
    insights.push(
      `**Untapped Potential**: Below-average turnout (${turnout.toFixed(0)}%) means ~${additionalVotes.toLocaleString()} potential votes if you boost engagement 10 points.`
    );
  } else if (turnout > 75) {
    insights.push(
      `**High-Engagement Area**: Above-average turnout (${turnout.toFixed(0)}%). ` +
      `These voters are already engaged — focus on persuasion over mobilization.`
    );
  }

  // Demographic correlation insight
  if (demographics.collegePct > 60 && swingScore > 50) {
    insights.push(
      `**Demo-Political Correlation**: High college education (${demographics.collegePct.toFixed(0)}%) combined with swing potential suggests receptivity to policy-detailed messaging.`
    );
  }

  // Return combined insights or default
  if (insights.length > 0) {
    return `\n\n**📊 Strategic Insight**\n${insights.slice(0, 2).join('\n\n')}`;
  }

  return `\n\n**📊 Strategic Insight**\nThis precinct has ${targeting.strategy.toLowerCase()} value. Focus resources on higher-priority targets unless geographic clustering makes this efficient to include.`;
}

/**
 * Generate "So What" for filter results
 * Wave 6B.7: Enhanced with spatial/geographic reasoning
 */
function generateFilterSoWhat(
  criteria: { metric?: string; threshold?: number },
  results: { precinctCount?: number; estimatedVoters?: number; avgGOTV?: number; avgPartisanLean?: number; jurisdictions?: string[] }
): string {
  const count = results.precinctCount || 0;
  const voters = results.estimatedVoters || 0;
  const avgGotv = results.avgGOTV || 0;
  const avgLean = results.avgPartisanLean || 0;
  const jurisdictions = results.jurisdictions || [];

  const insights: string[] = [];

  // Universe size insight
  if (count <= 5) {
    insights.push(
      `**Focused Universe**: Only ${count} precincts match — this is a highly targeted segment. ` +
      `Your team can do deep engagement with quality over quantity.`
    );
  } else if (count <= 15) {
    insights.push(
      `**Manageable Universe**: ${count} precincts with ~${voters.toLocaleString()} voters is an actionable canvassing universe. ` +
      `This is roughly ${Math.ceil(count / 3)}-${Math.ceil(count / 2)} canvassing shifts of work.`
    );
  } else if (count > 30) {
    insights.push(
      `**Large Universe**: ${count} precincts may need further filtering for efficient resource allocation. ` +
      `Consider prioritizing the top 10-15 by your key metric.`
    );
  }

  // Partisan composition insight
  if (Math.abs(avgLean) < 5) {
    insights.push(
      `**Battleground Territory**: Average lean is ${avgLean > 0 ? 'R+' : 'D+'}${Math.abs(avgLean).toFixed(0)} — these precincts are truly competitive.`
    );
  } else if (avgLean < -10) {
    insights.push(
      `**Democratic Base**: Average D+${Math.abs(avgLean).toFixed(0)} lean — ideal for GOTV rather than persuasion.`
    );
  } else if (avgLean > 10) {
    insights.push(
      `**Republican Territory**: Average R+${avgLean.toFixed(0)} lean — consider if resources are better spent elsewhere for Democrats, or ideal GOTV for Republicans.`
    );
  }

  // Strategic recommendation
  if (avgGotv > 70 && Math.abs(avgLean) > 5) {
    insights.push(
      `**Recommendation**: High GOTV priority (${avgGotv.toFixed(0)}/100) with clear partisan lean suggests pure turnout strategy over persuasion.`
    );
  }

  // Wave 6B.7: Spatial/geographic insight
  if (jurisdictions.length > 0) {
    const uniqueJurisdictions = [...new Set(jurisdictions)];
    if (uniqueJurisdictions.length === 1) {
      insights.push(
        `**Geographic Focus**: All precincts are in ${uniqueJurisdictions[0]} — efficient for a concentrated canvassing effort.`
      );
    } else if (uniqueJurisdictions.length <= 3 && count <= 10) {
      insights.push(
        `**Geographic Clustering**: Precincts span ${uniqueJurisdictions.length} jurisdictions (${uniqueJurisdictions.join(', ')}) — consider cluster-based canvassing routes.`
      );
    } else if (uniqueJurisdictions.length > 5) {
      insights.push(
        `**Geographic Spread**: Precincts span ${uniqueJurisdictions.length} jurisdictions — may require multiple field teams or prioritization by cluster.`
      );
    }
  }

  if (insights.length > 0) {
    return `\n\n**📊 Strategic Insight**\n${insights.slice(0, 3).join('\n\n')}`; // Show up to 3 insights for spatial
  }

  return '';
}

/**
 * Generate "So What" for comparison results
 */
function generateComparisonSoWhat(
  precinct1: PrecinctData,
  precinct2: PrecinctData
): string {
  const insights: string[] = [];

  // Swing difference
  const swingDiff = Math.abs(precinct1.electoral.swingPotential - precinct2.electoral.swingPotential);
  if (swingDiff > 20) {
    const higher = precinct1.electoral.swingPotential > precinct2.electoral.swingPotential ? precinct1 : precinct2;
    const lower = precinct1.electoral.swingPotential > precinct2.electoral.swingPotential ? precinct2 : precinct1;
    insights.push(
      `**Key Difference**: ${higher.name} has ${swingDiff.toFixed(0)} points higher swing potential. ` +
      `For persuasion budget, prioritize ${higher.name}; for base turnout, ${lower.name} may be more predictable.`
    );
  }

  // Partisan lean difference
  const leanDiff = precinct1.electoral.partisanLean - precinct2.electoral.partisanLean;
  if (Math.abs(leanDiff) > 10) {
    insights.push(
      `**Strategic Divergence**: ${Math.abs(leanDiff).toFixed(0)}-point partisan gap means these precincts require different messaging strategies.`
    );
  }

  // Turnout comparison
  // Note: avgTurnout is already stored as percentage (e.g., 70 = 70%)
  const turnoutDiff = Math.abs(precinct1.electoral.avgTurnout - precinct2.electoral.avgTurnout);
  if (turnoutDiff > 5) {  // 5 percentage point difference
    const higherTO = precinct1.electoral.avgTurnout > precinct2.electoral.avgTurnout ? precinct1 : precinct2;
    const lowerTO = precinct1.electoral.avgTurnout > precinct2.electoral.avgTurnout ? precinct2 : precinct1;
    insights.push(
      `**Turnout Opportunity**: ${lowerTO.name} has ${turnoutDiff.toFixed(0)} percentage points lower turnout than ${higherTO.name}. ` +
      `GOTV investments may have higher ROI in ${lowerTO.name}.`
    );
  }

  // Demographic similarity
  const incomeDiff = Math.abs(precinct1.demographics.medianHHI - precinct2.demographics.medianHHI);
  const eduDiff = Math.abs(precinct1.demographics.collegePct - precinct2.demographics.collegePct);
  if (incomeDiff < 10000 && eduDiff < 10) {
    insights.push(
      `**Demographic Similarity**: Similar income and education profiles suggest similar messaging may work for both.`
    );
  }

  if (insights.length > 0) {
    return `\n\n**📊 Strategic Insight**\n${insights.slice(0, 2).join('\n\n')}`;
  }

  return `\n\n**📊 Strategic Insight**\nThese precincts have different strategic profiles. Consider your resource constraints when deciding which to prioritize.`;
}

/**
 * Generate scenario projection for a precinct
 * Shows "What If" calculations
 */
function generateScenarioProjection(precinct: PrecinctData): string {
  const { electoral, demographics } = precinct;
  const vap = demographics.population18up;
  const currentTurnout = electoral.avgTurnout;
  const lean = electoral.partisanLean;

  // Calculate scenarios
  const currentVotes = Math.round(vap * currentTurnout);
  const boostVotes = Math.round(vap * (currentTurnout + 0.08)); // +8 point turnout boost
  const additionalVotes = boostVotes - currentVotes;

  // Partisan vote estimate
  const demShare = (50 - lean) / 100;
  const netVotesIfDem = Math.round(additionalVotes * demShare) - Math.round(additionalVotes * (1 - demShare));

  let projection = `\n\n**🔮 Quick Scenario**\n`;
  projection += `If turnout increases 8 points: +${additionalVotes.toLocaleString()} votes cast.\n`;

  if (Math.abs(lean) < 10) {
    projection += `In this battleground, that's roughly split — persuasion matters more than turnout.`;
  } else if (lean < -5) {
    projection += `With D+${Math.abs(lean).toFixed(0)} lean, that's ~${Math.abs(netVotesIfDem).toLocaleString()} net Democratic votes.`;
  } else if (lean > 5) {
    projection += `With R+${lean.toFixed(0)} lean, that's ~${Math.abs(netVotesIfDem).toLocaleString()} net Republican votes.`;
  }

  return projection;
}

// ============================================================================
// Expertise-Based Response Formatting (Phase 12)
// ============================================================================

type ExpertiseLevel = 'novice' | 'intermediate' | 'power_user';

interface ExpertiseFormattingOptions {
  precinctId?: string;
  precinctName?: string;
  metrics?: {
    swingPotential?: number;
    gotvPriority?: number;
    partisanLean?: number;
    turnout?: number;
  };
  fullExplanation?: string;
  shortExplanation?: string;
}

/**
 * Get current user expertise level from state manager
 */
function getUserExpertiseLevel(): ExpertiseLevel {
  try {
    const stateManager = getStateManager();
    return stateManager.getUserExpertiseLevel();
  } catch {
    return 'intermediate'; // Default
  }
}

/**
 * Format a precinct summary based on user expertise level
 */
function formatPrecinctByExpertise(options: ExpertiseFormattingOptions): string {
  const expertise = getUserExpertiseLevel();
  const { precinctId, precinctName, metrics } = options;

  if (!metrics) {
    return precinctName || precinctId || 'Unknown precinct';
  }

  const swing = metrics.swingPotential ?? 0;
  const gotv = metrics.gotvPriority ?? 0;
  const lean = metrics.partisanLean ?? 0;
  // Note: turnout is already stored as percentage (e.g., 67.5 = 67.5%)
  const turnout = metrics.turnout ?? 0;

  switch (expertise) {
    case 'power_user':
      // Terse, data-dense format
      const leanStr = lean > 0 ? `R+${lean.toFixed(0)}` : `D+${Math.abs(lean).toFixed(0)}`;
      return `**${precinctId}**: Swing ${swing.toFixed(0)}, GOTV ${gotv.toFixed(0)}, ${leanStr}, TO ${turnout.toFixed(0)}%`;

    case 'novice':
      // Explanatory format
      const partyName = lean > 0 ? 'Republican' : 'Democratic';
      const marginDesc = Math.abs(lean) > 15 ? 'strongly' : Math.abs(lean) > 5 ? 'leans' : 'marginally';
      return `**${precinctName || precinctId}**
- *Swing Potential*: ${swing.toFixed(0)}/100 ${swing > 70 ? '(high - competitive area)' : swing > 40 ? '(moderate)' : '(low - safe district)'}
- *GOTV Priority*: ${gotv.toFixed(0)}/100 ${gotv > 70 ? '(prioritize turnout efforts here)' : ''}
- *Political Lean*: ${marginDesc} ${partyName} (${Math.abs(lean).toFixed(0)} points)
- *Turnout Rate*: ${turnout.toFixed(0)}% of eligible voters typically vote`;

    case 'intermediate':
    default:
      // Balanced format
      const leanStrMed = lean > 0 ? `R+${lean.toFixed(0)}` : `D+${Math.abs(lean).toFixed(0)}`;
      return `**${precinctName || precinctId}**
- Swing: ${swing.toFixed(0)} | GOTV: ${gotv.toFixed(0)} | Lean: ${leanStrMed} | Turnout: ${turnout.toFixed(0)}%`;
  }
}

/**
 * Format a metric explanation based on user expertise
 */
function formatMetricExplanation(metricName: string, value: number): string {
  const expertise = getUserExpertiseLevel();

  // Power users don't need explanations
  if (expertise === 'power_user') {
    return `${metricName}: ${value.toFixed(1)}`;
  }

  // Novices get full context
  // Note: turnout is already stored as percentage (e.g., 67.5 = 67.5%)
  if (expertise === 'novice') {
    const explanations: Record<string, string> = {
      'swing_potential': `**Swing Potential** (${value.toFixed(0)}/100): Measures how likely this area is to change party preference. Higher scores indicate more "persuadable" voters who might be swayed by campaign messaging.`,
      'gotv_priority': `**GOTV Priority** (${value.toFixed(0)}/100): "Get Out The Vote" score. Higher values mean more supporters who don't always vote - targeting these voters for turnout drives has high impact.`,
      'partisan_lean': `**Partisan Lean** (${value > 0 ? 'R' : 'D'}+${Math.abs(value).toFixed(0)}): Historical voting pattern. ${value > 0 ? 'Positive' : 'Negative'} values indicate ${value > 0 ? 'Republican' : 'Democratic'} lean.`,
      'turnout': `**Turnout Rate** (${value.toFixed(0)}%): Percentage of eligible voters who typically vote in elections. Lower turnout = more room for GOTV impact.`,
    };
    return explanations[metricName] || `${metricName}: ${value.toFixed(1)}`;
  }

  // Intermediate users get brief context
  const briefExplanations: Record<string, string> = {
    'swing_potential': `Swing: ${value.toFixed(0)} (${value > 70 ? 'high' : value > 40 ? 'moderate' : 'low'})`,
    'gotv_priority': `GOTV: ${value.toFixed(0)} (${value > 70 ? 'priority' : 'standard'})`,
    'partisan_lean': `Lean: ${value > 0 ? 'R' : 'D'}+${Math.abs(value).toFixed(0)}`,
    'turnout': `Turnout: ${value.toFixed(0)}%`,
  };
  return briefExplanations[metricName] || `${metricName}: ${value.toFixed(1)}`;
}

/**
 * Add explanatory context to response if user is novice
 */
function addExpertiseAppropriateContext(response: string, topic: string): string {
  const expertise = getUserExpertiseLevel();

  if (expertise === 'novice') {
    const topicHelpers: Record<string, string> = {
      'comparison': '\n\n💡 *Tip: When comparing precincts, look at both Swing Potential and GOTV Priority to identify different campaign strategies.*',
      'segment': '\n\n💡 *Tip: A "segment" is a saved group of precincts with similar characteristics - useful for targeted outreach.*',
      'canvassing': '\n\n💡 *Tip: Canvassing efficiency varies by area density. Urban areas allow 25-30 doors/hour, while rural areas may only allow 12-15.*',
      'heatmap': '\n\n💡 *Tip: Heatmaps use color intensity to show where metrics are highest. Darker colors = higher values.*',
    };
    return response + (topicHelpers[topic] || '');
  }

  return response;
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Calculate geographic bounds for a set of precincts
 * Returns extent object for setExtent map command
 *
 * Note: Since PrecinctData doesn't contain centroid coordinates,
 * we use jurisdiction-based approximations for Ingham County
 */
function calculateBoundsForPrecincts(precincts: PrecinctData[]): { xmin: number; ymin: number; xmax: number; ymax: number } {
  // Default to Ingham County bounds
  const INGHAM_BOUNDS = {
    xmin: -84.85,
    ymin: 42.42,
    xmax: -84.15,
    ymax: 42.85
  };

  // Approximate bounds by jurisdiction
  const JURISDICTION_BOUNDS: Record<string, { xmin: number; ymin: number; xmax: number; ymax: number }> = {
    'east lansing': { xmin: -84.52, ymin: 42.70, xmax: -84.45, ymax: 42.77 },
    'lansing': { xmin: -84.60, ymin: 42.68, xmax: -84.48, ymax: 42.78 },
    'meridian': { xmin: -84.45, ymin: 42.68, xmax: -84.35, ymax: 42.75 },
    'delhi': { xmin: -84.60, ymin: 42.60, xmax: -84.50, ymax: 42.68 },
    'alaiedon': { xmin: -84.45, ymin: 42.60, xmax: -84.35, ymax: 42.68 },
    'williamston': { xmin: -84.32, ymin: 42.68, xmax: -84.25, ymax: 42.72 },
    'mason': { xmin: -84.48, ymin: 42.55, xmax: -84.42, ymax: 42.60 }
  };

  if (!precincts || precincts.length === 0) {
    return INGHAM_BOUNDS;
  }

  // Get unique jurisdictions and combine their bounds
  const jurisdictions = [...new Set(precincts.map(p => p.jurisdiction.toLowerCase()))];

  if (jurisdictions.length === 1 && JURISDICTION_BOUNDS[jurisdictions[0]]) {
    return JURISDICTION_BOUNDS[jurisdictions[0]];
  }

  // For multiple jurisdictions, combine bounds
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  let hasValidBounds = false;

  for (const j of jurisdictions) {
    const bounds = JURISDICTION_BOUNDS[j];
    if (bounds) {
      xmin = Math.min(xmin, bounds.xmin);
      ymin = Math.min(ymin, bounds.ymin);
      xmax = Math.max(xmax, bounds.xmax);
      ymax = Math.max(ymax, bounds.ymax);
      hasValidBounds = true;
    }
  }

  if (hasValidBounds) {
    // Add 10% padding
    const lngPadding = (xmax - xmin) * 0.1 || 0.05;
    const latPadding = (ymax - ymin) * 0.1 || 0.05;
    return {
      xmin: xmin - lngPadding,
      ymin: ymin - latPadding,
      xmax: xmax + lngPadding,
      ymax: ymax + latPadding
    };
  }

  return INGHAM_BOUNDS;
}

export interface HandlerResult {
  response: string;
  mapCommands?: MapCommand[];
  suggestedActions?: SuggestedAction[];
  data?: any;
  metadata?: {
    showGraph?: boolean;
    entities?: any[];
    relationships?: any[];
    [key: string]: any;
  };
}

interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: string;
  jurisdictionType: 'city' | 'township';
  demographics: {
    totalPopulation: number;
    population18up: number;
    registeredVoters?: number;  // From election data
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
    competitiveness: string;
    avgTurnout: number;
    turnoutDropoff: number;
  };
  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };
  engagement?: {
    politicalDonorPct: number;
    cnnMsnbcPct: number;
    foxNewsmaxPct: number;
    socialMediaPct: number;
    nprPct: number;
  };
}

/**
 * Fetch all precinct data
 */
async function fetchPrecincts(): Promise<PrecinctData[]> {
  const response = await fetch('/api/segments?action=precincts');
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch precincts');
  }

  return data.precincts || [];
}

/**
 * Handler for district/precinct queries
 */
export async function handleDistrictQuery(query: string, entities: string[]): Promise<HandlerResult> {
  try {
    const precincts = await fetchPrecincts();

    // If no specific entity mentioned, provide overview
    if (entities.length === 0) {
      // Generate visualization alternatives with context
      const vizAlternatives = generateVisualizationAlternatives('choropleth', 'partisan_lean', 'general');

      return {
        response: `I have data for ${precincts.length} precincts across Ingham County. Which precinct would you like to analyze? You can click on the map or tell me a precinct name.`,
        suggestedActions: [
          {
            id: 'show-swing',
            label: 'Show swing precincts',
            action: 'map:showHeatmap',
            icon: 'filter',
            metadata: { metric: 'swing_potential' }
          },
          {
            id: 'show-high-turnout',
            label: 'Show high turnout areas',
            action: 'map:showHeatmap',
            icon: 'trending-up',
            metadata: { metric: 'gotv_priority' }
          },
          // Add one multi-variable visualization option
          ...vizAlternatives.filter(a => a.action.includes('Bivariate') || a.action.includes('bivariate')).slice(0, 1)
        ],
        mapCommands: [
          { type: 'showChoropleth', metric: 'partisan_lean' }
        ]
      };
    }

    // Find matching precinct
    const precinctNames = precincts.map(p => p.name);
    const matchedName = fuzzyMatchPrecinct(entities[0], precinctNames);

    if (!matchedName) {
      return {
        response: `I couldn't find a precinct matching "${entities[0]}". Available areas include East Lansing, Lansing, Meridian Township, Delhi Township, and Williamston. Can you be more specific?`,
        suggestedActions: [
          {
            id: 'list-precincts',
            label: 'List all precincts',
            action: 'List all precincts',
            icon: 'list'
          }
        ]
      };
    }

    const precinct = precincts.find(p => p.name === matchedName);
    if (!precinct) {
      throw new Error('Precinct not found after fuzzy match');
    }

    // Format response with confidence indicators (Phase 14) and context awareness (Phase 2)
    const baseResponse = formatPrecinctSummaryWithConfidence(precinct);
    let enhancedResponse = enhanceResponseWithContext(baseResponse, precinct.name);

    // Wave 6B.5: Check for serendipitous cross-domain insights
    enhancedResponse = await checkAndAppendSerendipitousInsight(
      enhancedResponse,
      'precinct_selection',
      { precincts: [precinct.name] }
    );

    // Data-aware suggestions based on precinct metrics (Wave 4B #9)
    const baseSuggestions: SuggestedAction[] = [];

    // Extract targeting and electoral metrics
    const targeting = precinct.targeting || {};
    const electoral = precinct.electoral || {};
    const gotvPriority = targeting.gotvPriority || 0;
    const swingPotential = electoral.swingPotential || 0;
    const persuasionOpportunity = targeting.persuasionOpportunity || 0;

    // High GOTV priority → suggest canvassing
    if (gotvPriority > 70) {
      baseSuggestions.push({
        id: 'canvass',
        label: 'Plan canvassing (high GOTV)',
        action: `Plan canvassing for ${precinct.name}`,
        icon: 'route'
      });
    }

    // High swing potential → suggest comparison
    if (swingPotential > 60) {
      baseSuggestions.push({
        id: 'compare-swing',
        label: 'Compare to similar swing precincts',
        action: `Compare ${precinct.name} to other swing precincts`,
        icon: 'git-compare'
      });
    } else {
      // Otherwise, generic comparison
      baseSuggestions.push({
        id: 'compare-similar',
        label: 'Compare to similar precincts',
        action: `Compare ${precinct.name} to similar precincts`,
        icon: 'layers'
      });
    }

    // High persuasion opportunity → suggest messaging
    if (persuasionOpportunity > 50) {
      baseSuggestions.push({
        id: 'persuasion',
        label: 'Persuasion messaging insights',
        action: `What messaging works in ${precinct.name}?`,
        icon: 'message-circle'
      });
    }

    // Always include demographics and report as fallbacks
    baseSuggestions.push({
      id: 'show-demographics',
      label: 'Show detailed demographics',
      action: `Show demographics for ${precinct.name}`,
      icon: 'users'
    });

    baseSuggestions.push({
      id: 'generate-report',
      label: 'Generate precinct report',
      action: `Generate report for ${precinct.name}`,
      icon: 'file-text'
    });

    // Wave 6D.5: Check for cross-tool insights (donor-GOTV, segment-canvass)
    if (gotvPriority > 70) {
      const donorGOTVCheck = checkDonorGOTVOverlap();
      if (donorGOTVCheck.hasOverlap) {
        enhancedResponse += `\n\n${donorGOTVCheck.insight}`;
      }
    }

    const segmentCanvassCheck = checkSegmentCanvassOpportunity();
    if (segmentCanvassCheck.hasOpportunity) {
      enhancedResponse += `\n\n${segmentCanvassCheck.insight}`;
    }

    // Add context-aware suggestions (Phase 2) and limit to 5 total
    const contextAwareSuggestions = getContextAwareSuggestions(baseSuggestions, precinct.name).slice(0, 5);

    // Use pulseFeature for attention-grabbing highlight when showing a single precinct
    return {
      response: enhancedResponse,
      mapCommands: [
        {
          type: 'pulseFeature',
          target: precinct.name,
          duration: 2000,
          color: '#33a852'
        },
        {
          type: 'flyTo',
          target: precinct.name
        }
      ],
      suggestedActions: contextAwareSuggestions,
      data: precinct
    };
  } catch (error) {
    console.error('Error in handleDistrictQuery:', error);
    return {
      response: 'I encountered an error retrieving precinct data. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ]
    };
  }
}

/**
 * Handler for multi-level district analysis
 * Handles queries like "Show State House 73", "Analyze MI-07", "Senate District 21"
 */
export async function handleDistrictAnalysis(
  districtParams: {
    congressional?: string;
    stateSenate?: string;
    stateHouse?: string;
    schoolDistrict?: string;
    countyCommissioner?: string;
    districtLevel?: 'congressional' | 'state_senate' | 'state_house' | 'school' | 'county_commissioner';
  }
): Promise<HandlerResult> {
  try {
    // Dynamic import to avoid SSR issues
    const { politicalDataService } = await import('@/lib/services/PoliticalDataService');

    // Determine which district type was requested
    const districtType = districtParams.districtLevel ||
      (districtParams.congressional ? 'congressional' :
        districtParams.stateSenate ? 'state_senate' :
          districtParams.stateHouse ? 'state_house' :
            districtParams.schoolDistrict ? 'school' :
              districtParams.countyCommissioner ? 'county_commissioner' : null);

    const districtId =
      districtParams.congressional ||
      districtParams.stateSenate ||
      districtParams.stateHouse ||
      districtParams.schoolDistrict ||
      districtParams.countyCommissioner;

    if (!districtType || !districtId) {
      return {
        response: `Please specify a district to analyze. Examples:\n• "Analyze State House 73"\n• "Show MI-07"\n• "What's in Senate District 21?"\n• "Mason Public Schools district"`,
        suggestedActions: [
          { id: 'hd-73', label: 'State House 73', action: 'Show State House 73', icon: 'map-pin' },
          { id: 'hd-74', label: 'State House 74', action: 'Show State House 74', icon: 'map-pin' },
          { id: 'sd-21', label: 'Senate District 21', action: 'Show Senate District 21', icon: 'map-pin' },
          { id: 'mi-07', label: 'MI-07 Congressional', action: 'Analyze MI-07', icon: 'map-pin' },
        ]
      };
    }

    // Get precincts for the specified district using PoliticalDataService crosswalk
    let precincts: Awaited<ReturnType<typeof politicalDataService.getPrecinctsByStateHouseDistrict>>= [];
    let districtLabel = '';
    let candidateContext: CandidateContext | null = null;

    // Map the service method based on district type
    const serviceMethodMap = {
      'congressional': 'getPrecinctsByCongressionalDistrict',
      'state_senate': 'getPrecinctsByStateSenateDistrict',
      'state_house': 'getPrecinctsByStateHouseDistrict',
      'school': 'getPrecinctsBySchoolDistrict',
    } as const;

    if (districtType === 'congressional') {
      precincts = await politicalDataService.getPrecinctsByCongressionalDistrict(districtId);
      districtLabel = `Congressional District ${districtId.replace('mi-', '').toUpperCase()}`;
      // Load candidate context from Knowledge Graph
      try {
        candidateContext = await getCongressionalContext();
      } catch (e) {
        console.warn('[handleDistrictAnalysis] Could not load congressional context:', e);
      }
    } else if (districtType === 'state_senate') {
      precincts = await politicalDataService.getPrecinctsByStateSenateDistrict(districtId);
      const distNum = districtId.replace('mi-senate-', '');
      districtLabel = `State Senate District ${distNum}`;
      // Load candidate context from Knowledge Graph
      try {
        candidateContext = await getStateSenateContext(distNum);
      } catch (e) {
        console.warn('[handleDistrictAnalysis] Could not load state senate context:', e);
      }
    } else if (districtType === 'state_house') {
      precincts = await politicalDataService.getPrecinctsByStateHouseDistrict(districtId);
      const distNum = districtId.replace('mi-house-', '');
      districtLabel = `State House District ${distNum}`;
      // Load candidate context from Knowledge Graph
      try {
        candidateContext = await getStateHouseContext(distNum);
      } catch (e) {
        console.warn('[handleDistrictAnalysis] Could not load state house context:', e);
      }
    } else if (districtType === 'school') {
      precincts = await politicalDataService.getPrecinctsBySchoolDistrict(districtId);
      // Format school district name nicely
      districtLabel = districtId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    } else if (districtType === 'county_commissioner') {
      // County commissioner districts need to be implemented separately if needed
      return {
        response: `County Commissioner district analysis is coming soon. For now, try State House, State Senate, Congressional, or School districts.`,
        suggestedActions: [
          { id: 'hd-73', label: 'State House 73', action: 'Show State House 73', icon: 'map-pin' },
          { id: 'sd-21', label: 'Senate District 21', action: 'Show Senate District 21', icon: 'map-pin' },
        ]
      };
    }

    if (precincts.length === 0) {
      return {
        response: `No precincts found for ${districtLabel}. This district may not be in Ingham County or the data is not available yet.`,
        suggestedActions: [
          { id: 'list-districts', label: 'List available districts', action: 'What districts are in Ingham County?', icon: 'list' },
          { id: 'try-hd', label: 'Try State House 73', action: 'Show State House 73', icon: 'map-pin' },
        ]
      };
    }

    // Get enrichment context (RAG + Knowledge Graph)
    let enrichmentContext: EnrichmentContext | null = null;
    try {
      const enrichDistrictType = districtType === 'state_house' ? 'state_house' :
        districtType === 'state_senate' ? 'state_senate' :
        districtType === 'congressional' ? 'congressional' : 'county';
      const distNum = districtId.replace(/mi-(house|senate)-/, '');
      enrichmentContext = await enrichDistrictAnalysis(enrichDistrictType, distNum);
      console.log('[handleDistrictAnalysis] Enrichment:', {
        ragDocs: enrichmentContext.rag.documents.length,
        intel: enrichmentContext.rag.currentIntel.length,
        relevance: enrichmentContext.relevance.overallScore.toFixed(2)
      });
    } catch (e) {
      console.warn('[handleDistrictAnalysis] Enrichment failed:', e);
    }

    // Get aggregate statistics using PoliticalDataService
    const aggregate = await politicalDataService.getDistrictAggregate(
      districtType === 'state_house' ? 'stateHouse' :
        districtType === 'state_senate' ? 'stateSenate' :
          districtType === 'congressional' ? 'congressional' :
            'schoolDistrict',
      districtId
    );

    // Format the response - UnifiedPrecinct uses 'name' property

    // Helper function to classify competitiveness
    const getCompetitivenessLabel = (lean: number): { label: string; emoji: string; analysis: string } => {
      const absLean = Math.abs(lean);
      const party = lean >= 0 ? 'Democratic' : 'Republican';
      const shortParty = lean >= 0 ? 'D' : 'R';

      if (absLean > 20) return {
        label: `Safe ${party}`,
        emoji: '🔒',
        analysis: `This is a safely ${party.toLowerCase()} district with a ${shortParty}+${absLean.toFixed(0)} lean. Barring major political shifts, this seat is unlikely to change hands.`
      };
      if (absLean > 10) return {
        label: `Likely ${party}`,
        emoji: '📊',
        analysis: `Leans ${party.toLowerCase()} at ${shortParty}+${absLean.toFixed(0)}. While not competitive most cycles, a wave election could put this in play.`
      };
      if (absLean > 5) return {
        label: `Lean ${party}`,
        emoji: '⚖️',
        analysis: `A competitive district leaning ${party.toLowerCase()} at ${shortParty}+${absLean.toFixed(0)}. This could be a key battleground in close elections.`
      };
      return {
        label: 'Toss-Up',
        emoji: '🎯',
        analysis: `This is a true battleground at ${shortParty}+${absLean.toFixed(0)}. Both parties should consider this a priority target.`
      };
    };

    // Helper to interpret swing score
    const getSwingAnalysis = (swing: number): string => {
      if (swing >= 75) return 'High volatility — outcomes here have varied significantly across recent elections.';
      if (swing >= 50) return 'Moderate volatility — some ticket-splitting and competitive races in recent cycles.';
      if (swing >= 25) return 'Low volatility — voters here are fairly consistent in their choices.';
      return 'Very stable — this area votes predictably.';
    };

    // Helper to interpret GOTV priority
    const getGOTVAnalysis = (gotv: number, turnout: number): string => {
      if (gotv >= 70 && turnout < 60) return `High priority for GOTV — turnout of ${turnout.toFixed(0)}% is below average with significant untapped potential.`;
      if (gotv >= 70) return 'Strong GOTV target due to favorable demographics and room for improvement.';
      if (gotv >= 40) return 'Moderate GOTV potential — consider targeting if resources allow.';
      return 'Lower priority for GOTV efforts.';
    };

    // Build header with candidate context from Knowledge Graph
    let headerSection = `## ${districtLabel}\n\n`;
    if (candidateContext?.incumbent) {
      const { incumbent, office } = candidateContext;
      const partyLabel = incumbent.party === 'DEM' ? 'Democrat' : incumbent.party === 'REP' ? 'Republican' : incumbent.party;
      const partyEmoji = incumbent.party === 'DEM' ? '🔵' : incumbent.party === 'REP' ? '🔴' : '⚪';
      headerSection += `${partyEmoji} **${incumbent.name}** (${partyLabel})\n`;

      // Add 2024 election result if available
      if (incumbent.election2024?.percentage !== undefined) {
        const pct = incumbent.election2024.percentage;
        const opponent = incumbent.election2024.opponent;
        headerSection += `*2024 Result: Won with ${pct.toFixed(1)}%${opponent ? ` vs ${opponent}` : ''}*\n`;
      }

      // Add next election info
      if (office?.nextElection) {
        const nextDate = new Date(office.nextElection);
        const dateStr = nextDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        headerSection += `*Next Election: ${dateStr}*\n`;
      }

      headerSection += '\n';
    }

    // Build analysis section with interpretation
    let analysisSection = '';
    if (aggregate) {
      const { scores, precinctCount, registeredVoters } = aggregate;
      const turnoutDisplay = scores.avgTurnout > 1 ? scores.avgTurnout : scores.avgTurnout * 100;
      const competitiveness = getCompetitivenessLabel(scores.partisanLean);
      const leanDirection = scores.partisanLean >= 0 ? 'D' : 'R';
      const leanValue = Math.abs(scores.partisanLean).toFixed(1);

      // Strategic Assessment (the "So What")
      analysisSection += `### ${competitiveness.emoji} Strategic Assessment\n\n`;
      analysisSection += `**${competitiveness.label}** — ${leanDirection}+${leanValue}\n\n`;
      analysisSection += `${competitiveness.analysis}\n\n`;

      // Key Metrics - using definition list style (survives entity segmentation)
      const turnoutAssess = turnoutDisplay > 65 ? 'above average' : turnoutDisplay > 55 ? 'average' : 'below average';
      const swingAssess = scores.swingPotential >= 50 ? 'competitive' : 'stable';
      const gotvAssess = scores.gotvPriority >= 60 ? 'high value' : 'moderate';
      const persuasionAssess = scores.persuasionOpportunity >= 50 ? 'good target' : 'lower priority';

      analysisSection += `### 📈 Key Metrics\n\n`;
      analysisSection += `**${registeredVoters.toLocaleString()}** registered voters across **${precinctCount}** precincts\n\n`;
      analysisSection += `- **Turnout:** ${turnoutDisplay.toFixed(1)}% (${turnoutAssess})\n`;
      analysisSection += `- **Swing:** ${scores.swingPotential.toFixed(0)}/100 (${swingAssess})\n`;
      analysisSection += `- **GOTV:** ${scores.gotvPriority.toFixed(0)}/100 (${gotvAssess})\n`;
      analysisSection += `- **Persuasion:** ${scores.persuasionOpportunity.toFixed(0)}/100 (${persuasionAssess})\n\n`;

      // Tactical Insights
      analysisSection += `### 💡 What This Means\n\n`;
      analysisSection += `**Swing:** ${getSwingAnalysis(scores.swingPotential)}\n\n`;
      analysisSection += `**Turnout:** ${getGOTVAnalysis(scores.gotvPriority, turnoutDisplay)}\n\n`;
      if (scores.persuasionOpportunity >= 45) {
        analysisSection += `**Persuasion:** With a ${scores.persuasionOpportunity.toFixed(0)}/100 score, direct voter contact could move opinions here.\n\n`;
      }
    } else {
      analysisSection += `This district contains **${precincts.length} precincts**. Detailed metrics are being calculated.\n\n`;
    }

    // NOTE: Enrichment sections (intel, issues, endorsements) are added by the handler
    // via formatEnrichmentSections() - do not duplicate here

    // Build main response without precincts/sources (those go in collapsible sections)
    const mainResponse = headerSection + analysisSection;

    // Collapsible sections for precincts and sources
    const precinctNames = precincts.map(p => p.name);
    const precinctsCollapsible = createPrecinctsSection(precinctNames, 8);
    const sourcesCollapsible = createSourcesSection(['elections', 'gis', 'demographics']);

    const fullResponse = mainResponse + '\n\n' + precinctsCollapsible + '\n\n' + sourcesCollapsible;

    // Get precinct IDs for highlighting on map - UnifiedPrecinct uses 'id' and 'name'
    const precinctIds = precincts.map(p => p.id || p.name);

    // Suggested actions based on district type
    const suggestedActions: SuggestedAction[] = [
      {
        id: 'show-swing',
        label: 'Show swing precincts',
        action: 'map:showHeatmap',
        icon: 'trending-up',
        metadata: { metric: 'swing_potential' }
      },
      {
        id: 'show-gotv',
        label: 'Show GOTV priority',
        action: 'map:showHeatmap',
        icon: 'users',
        metadata: { metric: 'gotv_priority' }
      },
      {
        id: 'plan-canvass',
        label: 'Plan canvassing',
        action: `Plan canvassing for ${districtLabel}`,
        icon: 'route'
      },
      {
        id: 'generate-report',
        label: 'Generate district report',
        action: `Generate report for ${districtLabel}`,
        icon: 'file-text'
      },
    ];

    // Add compare suggestion if state house
    if (districtType === 'state_house') {
      const currentNum = parseInt(districtId.replace('mi-house-', ''));
      const otherDistricts = [73, 74, 75, 77].filter(n => n !== currentNum);
      if (otherDistricts.length > 0) {
        suggestedActions.push({
          id: 'compare-district',
          label: `Compare to HD-${otherDistricts[0]}`,
          action: `Compare State House ${currentNum} to State House ${otherDistricts[0]}`,
          icon: 'git-compare'
        });
      }
    }

    return {
      response: fullResponse,
      mapCommands: [
        {
          type: 'highlight',
          target: precinctIds.slice(0, 50) // Limit to 50 for performance
        },
        {
          type: 'setExtent',
          target: precinctIds.slice(0, 50)
        }
      ],
      suggestedActions,
      data: {
        districtType,
        districtId,
        districtLabel,
        precinctCount: precincts.length,
        aggregate,
        precinctIds
      }
    };
  } catch (error) {
    console.error('Error in handleDistrictAnalysis:', error);
    return {
      response: `I encountered an error analyzing this district. Let me help you recover.`,
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What districts are in Ingham County?', icon: 'refresh-cw' },
        { id: 'browse', label: 'Browse all precincts', action: 'Show me all precincts', icon: 'list' },
      ]
    };
  }
}

/**
 * Handler for comparison requests
 */
export async function handleComparison(entity1: string, entity2: string): Promise<HandlerResult> {
  try {
    // Check if entities are missing
    if (!entity1 || !entity2) {
      return {
        response: "I can compare any two precincts, municipalities, or districts. To get started:",
        suggestedActions: generateRecoverySuggestions('comparison'),
        mapCommands: [
          { type: 'showChoropleth', metric: 'partisan_lean' }
        ],
      };
    }

    const precincts = await fetchPrecincts();
    const precinctNames = precincts.map(p => p.name);

    // Match entities to precincts or jurisdictions
    const match1 = fuzzyMatchPrecinct(entity1, precinctNames);
    const match2 = fuzzyMatchPrecinct(entity2, precinctNames);

    if (!match1 || !match2) {
      return {
        response: `I need two valid precincts or jurisdictions to compare. I ${!match1 ? "couldn't find " + entity1 : ""} ${!match1 && !match2 ? "and " : ""} ${!match2 ? "couldn't find " + entity2 : ""}. Please specify which areas to compare.`,
        suggestedActions: [
          {
            id: 'list-jurisdictions',
            label: 'List available areas',
            action: 'List all jurisdictions',
            icon: 'list'
          }
        ]
      };
    }

    const precinct1 = precincts.find(p => p.name === match1);
    const precinct2 = precincts.find(p => p.name === match2);

    if (!precinct1 || !precinct2) {
      throw new Error('Precinct not found after fuzzy match');
    }

    // Call comparison API
    const response = await fetch(
      `/api/comparison?left=${precinct1.id}&right=${precinct2.id}&leftType=precinct&rightType=precinct`
    );
    const comparisonData = await response.json();

    if (comparisonData.error) {
      throw new Error(comparisonData.error);
    }

    // Get enrichment context for comparison
    let enrichmentContext: EnrichmentContext | null = null;
    try {
      enrichmentContext = await enrichComparison(
        `Compare ${precinct1.name} to ${precinct2.name}`,
        precinct1.name,
        precinct2.name
      );
    } catch (e) {
      console.warn('[handleComparison] Enrichment failed:', e);
    }

    // Format comparison response
    // NOTE: Enrichment sections are added by the handler via formatEnrichmentSections()
    const comparisonText = formatComparisonSummary(precinct1, precinct2, comparisonData);

    return {
      response: comparisonText,
      mapCommands: [
        {
          type: 'highlightComparison',
          leftEntityId: precinct1.id,
          rightEntityId: precinct2.id
        }
      ],
      suggestedActions: [
        {
          id: 'detailed-comparison',
          label: 'Show detailed comparison table',
          action: `Show detailed comparison of ${precinct1.name} and ${precinct2.name}`,
          icon: 'table'
        },
        {
          id: 'find-similar',
          label: 'Find similar precincts',
          action: `Find precincts similar to ${precinct1.name}`,
          icon: 'search'
        }
      ],
      data: comparisonData
    };
  } catch (error) {
    console.error('Error in handleComparison:', error);
    return {
      response: 'I encountered an error comparing these areas. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ]
    };
  }
}

/**
 * Handler for filter/segment requests
 */
export async function handleFilterRequest(filterCriteria: any): Promise<HandlerResult> {
  try {
    // Build filters from criteria
    const filters: SegmentFilters = {};

    if (filterCriteria.metric === 'swing_potential') {
      filters.targeting = {
        min_swing_potential: filterCriteria.threshold || 60
      };
    } else if (filterCriteria.metric === 'margin') {
      // Margin < 5% means competitive
      filters.political = {
        competitiveness: ['toss_up', 'lean_d', 'lean_r']
      };
    } else if (filterCriteria.metric === 'turnout') {
      filters.targeting = {
        min_turnout: filterCriteria.threshold || 60
      };
    } else if (filterCriteria.metric === 'gotv_priority') {
      filters.targeting = {
        min_gotv_priority: filterCriteria.threshold || 70
      };
    } else if (filterCriteria.metric === 'persuasion_opportunity') {
      filters.targeting = {
        min_persuasion: filterCriteria.threshold || 60
      };
    }

    // Call segments API
    const response = await fetch('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to filter precincts');
    }

    const results = data.results;
    const count = results.matchingPrecincts?.length || 0;

    // Get enrichment context for filter query
    let enrichmentContext: EnrichmentContext | null = null;
    try {
      const precinctNames = results.matchingPrecincts?.slice(0, 10).map((p: any) => p.name) || [];
      const queryDescription = `${filterCriteria.metric || 'filtered'} precincts`;
      enrichmentContext = await enrichFilterQuery(queryDescription, precinctNames);
    } catch (e) {
      console.warn('[handleFilterRequest] Enrichment failed:', e);
    }

    // Format response
    // NOTE: Enrichment sections are added by the handler via formatEnrichmentSections()
    const responseText = formatFilterResults(filterCriteria, results);

    // Determine appropriate visualization
    const mapCommands: MapCommand[] = [];

    // Show heatmap for numeric metrics
    if (filterCriteria.metric && ['swing_potential', 'gotv_priority', 'persuasion_opportunity', 'combined_score', 'turnout'].includes(filterCriteria.metric)) {
      mapCommands.push({
        type: 'showHeatmap',
        metric: filterCriteria.metric
      });
    } else if (filterCriteria.metric === 'margin') {
      // Show choropleth for competitive precincts
      mapCommands.push({
        type: 'showChoropleth'
      });
    }

    // Highlight matching precincts if we have specific results
    if (results.matchingPrecincts && results.matchingPrecincts.length > 0 && results.matchingPrecincts.length <= 10) {
      const precinctNames = results.matchingPrecincts.map((p: any) => p.name);
      mapCommands.push({
        type: 'highlight',
        target: precinctNames
      });

      // Add numbered markers for ranked lists (top 5)
      const topPrecincts = results.matchingPrecincts.slice(0, 5);
      if (topPrecincts.length > 0) {
        mapCommands.push({
          type: 'showNumberedMarkers',
          numberedMarkers: topPrecincts.map((p: any, i: number) => ({
            precinctId: p.id,
            number: i + 1,
            label: p.name
          }))
        });
      }
    }

    // Determine visualization context for alternatives
    const vizContext = filterCriteria.metric === 'gotv_priority' ? 'gotv'
      : filterCriteria.metric === 'persuasion_opportunity' ? 'persuasion'
      : 'targeting';

    // Get current viz type from mapCommands
    const currentVizType = mapCommands[0]?.type === 'showHeatmap' ? 'heatmap'
      : mapCommands[0]?.type === 'showChoropleth' ? 'choropleth'
      : 'heatmap';

    // Generate visualization alternatives
    const vizAlternatives = generateVisualizationAlternatives(
      currentVizType,
      filterCriteria.metric,
      vizContext
    );

    // Combine core actions with visualization alternatives
    const baseSuggestions: SuggestedAction[] = [
      {
        id: 'refine-filter',
        label: 'Refine filter criteria',
        action: 'Refine my filter',
        icon: 'sliders'
      },
      {
        id: 'export-list',
        label: 'Export precinct list',
        action: 'Export these precincts to CSV',
        icon: 'download'
      },
      {
        id: 'plan-canvassing',
        label: 'Plan canvassing route',
        action: 'Plan canvassing for these precincts',
        icon: 'route'
      },
      // Add visualization alternatives (max 2 to not overwhelm)
      ...vizAlternatives.slice(0, 2)
    ];

    // Enhance response with context (Phase 2)
    const context = getExplorationContext();
    let enhancedResponse = responseText;

    // If user has filtered before, show comparative context
    if (context.filtersApplied > 1) {
      enhancedResponse += `\n\n📊 *This is your ${ordinalSuffix(context.filtersApplied)} filter this session. Consider combining criteria for more targeted results.*`;
    }

    // Wave 6B.5: Check for serendipitous cross-domain insights
    const precinctNames = results.matchingPrecincts?.slice(0, 10).map((p: any) => p.name || p.precinctId) || [];
    enhancedResponse = await checkAndAppendSerendipitousInsight(
      enhancedResponse,
      'filter_applied',
      { precincts: precinctNames, metric: filterCriteria.metric }
    );

    // Wave 6D.5: Check for cross-tool insights (donor-GOTV, segment-canvass)
    if (filterCriteria.metric === 'gotv_priority' || filterCriteria.metric === 'swing_potential') {
      const donorGOTVCheck = checkDonorGOTVOverlap();
      if (donorGOTVCheck.hasOverlap) {
        enhancedResponse += `\n\n${donorGOTVCheck.insight}`;
      }
    }

    const segmentCanvassCheck = checkSegmentCanvassOpportunity();
    if (segmentCanvassCheck.hasOpportunity && count > 0 && count <= 20) {
      enhancedResponse += `\n\n${segmentCanvassCheck.insight}`;
    }

    // Add context-aware suggestions
    const contextAwareSuggestions = getContextAwareSuggestions(baseSuggestions);

    return {
      response: enhancedResponse,
      mapCommands,
      suggestedActions: contextAwareSuggestions,
      data: results
    };
  } catch (error) {
    console.error('Error in handleFilterRequest:', error);
    return {
      response: 'I encountered an error filtering precincts. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ]
    };
  }
}

/**
 * Handler for multi-variable visualization requests
 */
export async function handleMultiVariableVisualization(vizType: string, params: any): Promise<HandlerResult> {
  const mapCommands: MapCommand[] = [];
  let responseText = '';
  const suggestedActions: SuggestedAction[] = [];

  if (vizType === 'bivariate') {
    const xMetric = params.xMetric || 'partisan_lean';
    const yMetric = params.yMetric || 'turnout';
    const preset = params.preset;

    mapCommands.push({
      type: 'showBivariate',
      xMetric,
      yMetric,
      bivariatePreset: preset
    });

    responseText = `**Bivariate Analysis: ${formatMetricName(xMetric)} × ${formatMetricName(yMetric)}**\n\n` +
      `This visualization shows two variables simultaneously:\n` +
      `- **X-axis (columns)**: ${formatMetricName(xMetric)}\n` +
      `- **Y-axis (rows)**: ${formatMetricName(yMetric)}\n\n` +
      `The 3×3 color grid helps identify precincts with specific combinations. `;

    if (xMetric === 'partisan_lean' && yMetric === 'turnout') {
      responseText += `For example, look for **blue bottom-row cells** to find low-turnout Democratic areas (GOTV targets), ` +
        `or **purple center cells** for competitive swing precincts.`;
    } else if (xMetric === 'persuasion_opportunity' && yMetric === 'gotv_priority') {
      responseText += `Look for **dark purple top-right cells** where both persuasion AND GOTV scores are high - ` +
        `these are your highest-value targets.`;
    }

    suggestedActions.push(
      {
        id: 'switch-to-gotv-targets',
        label: 'GOTV Targets (Partisan × Turnout)',
        action: 'map:showBivariate',
        metadata: { preset: 'gotv_targets' }
      },
      {
        id: 'switch-to-persuasion-gotv',
        label: 'Persuasion × GOTV',
        action: 'map:showBivariate',
        metadata: { preset: 'persuasion_gotv' }
      },
      {
        id: 'show-proportional',
        label: 'Switch to proportional symbols',
        action: 'map:showProportional',
        metadata: { preset: 'voter_population' }
      }
    );

  } else if (vizType === 'proportional') {
    const sizeMetric = params.sizeMetric || 'registered_voters';
    const colorMetric = params.colorMetric || 'partisan_lean';
    const preset = params.preset;

    mapCommands.push({
      type: 'showProportional',
      sizeMetric,
      colorMetric,
      proportionalPreset: preset
    });

    responseText = `**Proportional Symbol Map: ${formatMetricName(sizeMetric)} × ${formatMetricName(colorMetric)}**\n\n` +
      `This visualization uses:\n` +
      `- **Circle SIZE**: ${formatMetricName(sizeMetric)} (larger = more)\n` +
      `- **Circle COLOR**: ${formatMetricName(colorMetric)}\n\n` +
      `This helps identify population centers and their political characteristics at a glance.`;

    suggestedActions.push(
      {
        id: 'switch-to-gotv-pop',
        label: 'Voters × GOTV Priority',
        action: 'map:showProportional',
        metadata: { preset: 'gotv_population' }
      },
      {
        id: 'switch-to-bivariate',
        label: 'Switch to bivariate choropleth',
        action: 'map:showBivariate',
        metadata: { preset: 'gotv_targets' }
      }
    );

  } else if (vizType === 'valueByAlpha') {
    const valueMetric = params.valueMetric || 'partisan_lean';
    const alphaMetric = params.alphaMetric || 'confidence';
    const preset = params.preset;

    mapCommands.push({
      type: 'showValueByAlpha',
      metric: valueMetric,
      alphaMetric,
      valueByAlphaPreset: preset
    });

    responseText = `**Value by Confidence: ${formatMetricName(valueMetric)} (opacity = ${formatMetricName(alphaMetric)})**\n\n` +
      `This visualization shows:\n` +
      `- **COLOR**: ${formatMetricName(valueMetric)}\n` +
      `- **OPACITY/TRANSPARENCY**: ${formatMetricName(alphaMetric)}\n\n` +
      `More transparent areas have less reliable data (smaller sample size, older data, etc.). ` +
      `Focus on the more opaque areas for confident decision-making.`;

    suggestedActions.push(
      {
        id: 'switch-partisan-confidence',
        label: 'Partisan Lean by Confidence',
        action: 'map:showValueByAlpha',
        metadata: { preset: 'partisan_confidence' }
      },
      {
        id: 'switch-turnout-sample',
        label: 'Turnout by Sample Size',
        action: 'map:showValueByAlpha',
        metadata: { preset: 'turnout_sample_size' }
      }
    );

  } else if (vizType === 'temporal') {
    // Temporal visualization for election trends over time
    const metric = params.metric || 'partisan_lean';
    const years = params.years || [2020, 2022, 2024];
    const autoPlay = params.autoPlay ?? false;

    mapCommands.push({
      type: 'showTemporal',
      metric,
      years,
      autoPlay
    });

    responseText = `**Temporal Analysis: ${formatMetricName(metric)} Over Time**\n\n` +
      `This visualization animates ${formatMetricName(metric)} across election years: **${years.join(', ')}**.\n\n`;

    if (autoPlay) {
      responseText += `🎬 **Auto-playing** - watch how the political landscape has evolved.\n\n`;
    }

    responseText += `**How to read this**:\n` +
      `- Use the timeline slider to compare specific years\n` +
      `- Look for precincts that shift significantly between elections\n` +
      `- Stable colors = reliable patterns; shifting colors = potential targets\n\n`;

    if (metric === 'partisan_lean') {
      responseText += `💡 *Tip: Precincts that swing between red and blue are prime battleground targets.*`;
    } else if (metric === 'turnout') {
      responseText += `💡 *Tip: Precincts with declining turnout may respond to GOTV investment.*`;
    }

    suggestedActions.push(
      {
        id: 'show-2020',
        label: 'Focus on 2020',
        action: 'Show partisan lean for 2020',
        icon: 'calendar'
      },
      {
        id: 'show-2024',
        label: 'Focus on 2024',
        action: 'Show partisan lean for 2024',
        icon: 'calendar'
      },
      {
        id: 'compare-years',
        label: 'Compare 2020 vs 2024',
        action: 'map:showComparison',
        metadata: { leftMetric: 'partisan_lean_2020', rightMetric: 'partisan_lean_2024' }
      },
      {
        id: 'find-swing',
        label: 'Find swing precincts',
        action: 'Which precincts changed the most between 2020 and 2024?',
        icon: 'trending-up'
      }
    );
  }

  return {
    response: responseText,
    mapCommands,
    suggestedActions
  };
}

/**
 * Format metric name for display
 */
function formatMetricName(metric: string): string {
  const names: Record<string, string> = {
    partisan_lean: 'Partisan Lean',
    turnout: 'Turnout',
    gotv_priority: 'GOTV Priority',
    persuasion_opportunity: 'Persuasion Opportunity',
    swing_potential: 'Swing Potential',
    combined_score: 'Combined Score',
    median_income: 'Median Income',
    college_pct: 'College Education %',
    registered_voters: 'Registered Voters',
    total_population: 'Population',
    total_donations: 'Total Donations',
    donor_count: 'Donor Count',
    avg_donation: 'Avg Donation',
    confidence: 'Confidence',
    sample_size: 'Sample Size',
    data_quality: 'Data Quality',
    voter_count: 'Voter Count',
    contact_rate: 'Contact Rate',
    canvass_doors: 'Canvass Doors',
  };
  return names[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Generate alternative visualization suggestions based on current context
 * @param currentVizType - The visualization type currently displayed
 * @param currentMetric - The primary metric currently shown
 * @param context - Additional context like 'targeting', 'demographics', 'comparison'
 */
export function generateVisualizationAlternatives(
  currentVizType: 'heatmap' | 'choropleth' | 'bivariate' | 'proportional' | 'valueByAlpha' | 'scatter' | 'highlights',
  currentMetric?: string,
  context?: 'targeting' | 'demographics' | 'comparison' | 'gotv' | 'persuasion' | 'general'
): SuggestedAction[] {
  const alternatives: SuggestedAction[] = [];

  // Always offer to switch between geometry types (H3 hexagons vs precinct boundaries)
  if (currentVizType === 'heatmap') {
    alternatives.push({
      id: 'switch-to-precincts',
      label: 'Show as precinct boundaries',
      action: 'map:showChoropleth',
      icon: 'map',
      description: 'View data on actual precinct boundaries instead of uniform hexagons',
      metadata: { metric: currentMetric || 'partisan_lean' }
    });
  } else if (currentVizType === 'choropleth') {
    alternatives.push({
      id: 'switch-to-hexagons',
      label: 'Show as H3 hexagon heatmap',
      action: 'map:showHeatmap',
      icon: 'hexagon',
      description: 'Uniform hexagonal grid eliminates precinct size bias',
      metadata: { metric: currentMetric || 'combined_score' }
    });
  }

  // Multi-variable alternatives based on context
  if (context === 'targeting' || context === 'gotv' || context === 'persuasion') {
    // Suggest bivariate for targeting analysis
    if (currentVizType !== 'bivariate') {
      alternatives.push({
        id: 'show-bivariate-gotv',
        label: 'GOTV × Persuasion matrix',
        action: 'map:showBivariate',
        icon: 'grid-3x3',
        description: 'See where both GOTV and persuasion scores are high',
        metadata: { xMetric: 'gotv_priority', yMetric: 'persuasion_opportunity' }
      });
    }

    // Suggest proportional for seeing population concentrations
    if (currentVizType !== 'proportional') {
      alternatives.push({
        id: 'show-proportional-voters',
        label: 'Voter concentration bubbles',
        action: 'map:showProportional',
        icon: 'circle',
        description: 'Size = voters, color = targeting score',
        metadata: { sizeMetric: 'registered_voters', colorMetric: currentMetric || 'combined_score' }
      });
    }
  }

  if (context === 'demographics') {
    // Suggest bivariate for demographic patterns
    if (currentVizType !== 'bivariate') {
      alternatives.push({
        id: 'show-bivariate-demo',
        label: 'Income × Education matrix',
        action: 'map:showBivariate',
        icon: 'grid-3x3',
        description: 'See socioeconomic patterns across precincts',
        metadata: { xMetric: 'median_income', yMetric: 'college_pct' }
      });
    }

    // Suggest scatter for correlation analysis
    alternatives.push({
      id: 'show-scatter-demo',
      label: 'Income vs Partisan Lean scatter',
      action: 'Show a scatter plot of income versus partisan lean',
      icon: 'scatter-chart',
      description: 'See if income correlates with voting patterns'
    });
  }

  if (context === 'comparison') {
    // Suggest side-by-side for direct comparison
    alternatives.push({
      id: 'show-split-view',
      label: 'Split-screen comparison',
      action: 'Show split-screen comparison view',
      icon: 'columns',
      description: 'Compare two areas side-by-side'
    });
  }

  // Value-by-alpha for data quality awareness
  if (currentVizType !== 'valueByAlpha' && (currentMetric === 'partisan_lean' || currentMetric === 'swing_potential')) {
    alternatives.push({
      id: 'show-confidence',
      label: 'Show with confidence overlay',
      action: 'map:showValueByAlpha',
      icon: 'eye',
      description: 'Fade out areas with less reliable data',
      metadata: { metric: currentMetric, alphaMetric: 'confidence' }
    });
  }

  // Different single-variable metrics
  const metricAlternatives: Array<{ id: string; label: string; metric: string; context?: string[] }> = [
    { id: 'show-swing', label: 'Swing potential', metric: 'swing_potential', context: ['targeting', 'general'] },
    { id: 'show-gotv', label: 'GOTV priority', metric: 'gotv_priority', context: ['targeting', 'gotv'] },
    { id: 'show-persuasion', label: 'Persuasion opportunity', metric: 'persuasion_opportunity', context: ['targeting', 'persuasion'] },
    { id: 'show-turnout', label: 'Turnout rates', metric: 'turnout', context: ['gotv', 'general'] },
    { id: 'show-partisan', label: 'Partisan lean', metric: 'partisan_lean', context: ['general', 'comparison'] },
  ];

  // Add 2-3 metric alternatives that differ from current
  const relevantMetrics = metricAlternatives
    .filter(m => m.metric !== currentMetric)
    .filter(m => !context || !m.context || m.context.includes(context))
    .slice(0, 2);

  relevantMetrics.forEach(m => {
    alternatives.push({
      id: m.id,
      label: `Show ${m.label}`,
      action: currentVizType === 'choropleth' ? 'map:showChoropleth' : 'map:showHeatmap',
      icon: 'bar-chart',
      metadata: { metric: m.metric }
    });
  });

  // Limit to 4 alternatives to not overwhelm
  return alternatives.slice(0, 4);
}

/**
 * Handler for data requests
 */
export async function handleDataRequest(dataType: string, entity?: string): Promise<HandlerResult> {
  try {
    const precincts = await fetchPrecincts();

    if (dataType === 'demographics') {
      if (!entity) {
        // County-wide demographics
        const totalPop = precincts.reduce((sum, p) => sum + p.demographics.totalPopulation, 0);
        const avgMedianAge = precincts.reduce((sum, p) => sum + p.demographics.medianAge, 0) / precincts.length;
        const avgMedianIncome = precincts.reduce((sum, p) => sum + p.demographics.medianHHI, 0) / precincts.length;

        return {
          response: `Ingham County Demographics:\n\n` +
            `Total Population: ${totalPop.toLocaleString()}\n` +
            `Average Median Age: ${avgMedianAge.toFixed(1)} years\n` +
            `Average Median Income: ${formatCurrency(avgMedianIncome)}\n\n` +
            `Would you like demographics for a specific precinct?`,
          mapCommands: [
            {
              type: 'showChoropleth',
            }
          ],
          suggestedActions: [
            {
              id: 'demographic-heatmap',
              label: 'Show demographic heatmap',
              action: 'map:showHeatmap',
              icon: 'map',
              metadata: { metric: 'combined_score' }
            }
          ]
        };
      } else {
        // Specific precinct demographics
        const precinctNames = precincts.map(p => p.name);
        const matchedName = fuzzyMatchPrecinct(entity, precinctNames);
        const precinct = precincts.find(p => p.name === matchedName);

        if (!precinct) {
          return {
            response: `I couldn't find demographic data for "${entity}". Please specify a valid precinct.`,
            suggestedActions: [
              { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
              { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
              { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
            ]
          };
        }

        return {
          response: formatDemographics(precinct),
          mapCommands: [
            {
              type: 'highlight',
              target: precinct.name
            }
          ],
          suggestedActions: [
            {
              id: 'compare-demographics',
              label: 'Compare to county average',
              action: `Compare ${precinct.name} demographics to county average`,
              icon: 'bar-chart'
            }
          ],
          data: precinct.demographics
        };
      }
    } else if (dataType === 'elections' || dataType === 'turnout') {
      const avgTurnout = precincts.reduce((sum, p) => sum + p.electoral.avgTurnout, 0) / precincts.length;
      const highTurnout = precincts.filter(p => p.electoral.avgTurnout > avgTurnout).length;

      return {
        response: `Election Data Summary:\n\n` +
          `Average Turnout: ${avgTurnout.toFixed(1)}%\n` +
          `Precincts with Above-Average Turnout: ${highTurnout} of ${precincts.length}\n\n` +
          `Would you like to see high-turnout precincts or specific election results?`,
        mapCommands: [
          {
            type: 'showHeatmap',
            metric: 'turnout'
          }
        ],
        suggestedActions: [
          {
            id: 'show-high-turnout',
            label: 'Show high turnout precincts',
            action: 'map:filter',
            icon: 'trending-up',
            metadata: { metric: 'turnout', threshold: 65, operator: 'greater_than' }
          },
          {
            id: 'turnout-heatmap',
            label: 'Show turnout heatmap',
            action: 'map:showHeatmap',
            icon: 'map',
            metadata: { metric: 'gotv_priority' }
          }
        ]
      };
    } else {
      return {
        response: `I can provide data on demographics, election results, and turnout. What specific data are you looking for?`,
        suggestedActions: [
          { id: 'demographics', label: 'Demographics', action: 'Show me demographic data for Lansing', icon: 'users' },
          { id: 'elections', label: 'Elections', action: 'Show me recent election results', icon: 'vote' },
          { id: 'turnout', label: 'Turnout', action: 'Show me turnout data', icon: 'trending-up' }
        ]
      };
    }
  } catch (error) {
    console.error('Error in handleDataRequest:', error);
    return {
      response: 'I encountered an error retrieving data. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ]
    };
  }
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatPrecinctSummary(precinct: PrecinctData): string {
  const { name, jurisdiction, demographics, electoral, targeting } = precinct;
  const expertise = getUserExpertiseLevel();

  // Wave 6D.1: Calculate confidence for this precinct's data
  const confidence = calculatePrecinctDataConfidence(precinct);

  // Wave 6D.3: Format based on expertise level
  if (expertise === 'power_user') {
    // Terse, data-dense format for power users
    const leanStr = electoral.partisanLean > 0 ? `R+${electoral.partisanLean.toFixed(0)}` : `D+${Math.abs(electoral.partisanLean).toFixed(0)}`;
    const baseInfo = (
      `**${name}** (${jurisdiction})\n` +
      `Pop: ${demographics.totalPopulation.toLocaleString()} | Age: ${demographics.medianAge.toFixed(0)} | Inc: $${Math.round(demographics.medianHHI / 1000)}K | Ed: ${demographics.collegePct.toFixed(0)}%\n` +
      `${leanStr} | Swing: ${electoral.swingPotential.toFixed(0)} | GOTV: ${targeting.gotvPriority.toFixed(0)} | TO: ${electoral.avgTurnout.toFixed(0)}%`
    );
    // Wave 6B: Add "So What" strategic insight
    const soWhat = generatePrecinctSoWhat(precinct);
    return baseInfo + soWhat;
  }

  // Format with confidence indicators for intermediate/novice
  const leanStr = electoral.partisanLean > 0 ? `R+${electoral.partisanLean.toFixed(0)}` : `D+${Math.abs(electoral.partisanLean).toFixed(0)}`;
  const leanWithConf = formatWithConfidence(leanStr, confidence.partisanLean, { compact: true });
  const swingWithConf = formatWithConfidence(`${electoral.swingPotential.toFixed(0)}/100`, confidence.swingPotential, { compact: true });
  const gotvWithConf = formatWithConfidence(`${targeting.gotvPriority.toFixed(0)}/100`, confidence.gotvPriority, { compact: true });

  let baseInfo = (
    `**${name}** (${jurisdiction})\n\n` +
    `**Demographics:**\n` +
    `• Population: ${demographics.totalPopulation.toLocaleString()}\n` +
    `• Median Age: ${demographics.medianAge.toFixed(1)} years\n` +
    `• Median Income: ${formatCurrency(demographics.medianHHI)}\n` +
    `• College Degree: ${demographics.collegePct.toFixed(1)}%\n\n` +
    `**Electoral Profile:**\n` +
    `• Partisan Lean: ${leanWithConf}\n` +
    `• Competitiveness: ${electoral.competitiveness.replace(/_/g, ' ').toUpperCase()}\n` +
    `• Swing Potential: ${swingWithConf}\n` +
    `• Average Turnout: ${electoral.avgTurnout.toFixed(1)}%\n\n` +
    `**Targeting:**\n` +
    `• GOTV Priority: ${gotvWithConf}\n` +
    `• Persuasion Opportunity: ${targeting.persuasionOpportunity.toFixed(0)}/100\n` +
    `• Strategy: ${targeting.strategy}`
  );

  // Wave 6D.1: Add confidence summary for novice users
  if (expertise === 'novice' && confidence.demographics) {
    baseInfo += `\n\n📊 *Data confidence: ${confidence.partisanLean.level} for electoral data, ${confidence.demographics.level} for demographics*`;
  }

  // Wave 6B: Add "So What" strategic insight
  const soWhat = generatePrecinctSoWhat(precinct);

  // Wave 6B.8: Add scenario projection ("What if" calculation)
  const scenario = generateScenarioProjection(precinct);

  // Wave 6D.2: Add citations
  const fullResponse = baseInfo + soWhat + scenario;
  return addCitationsToResponse(fullResponse, ['ELECTIONS', 'DEMOGRAPHICS', 'TARGETING', 'SCORES']);
}

function formatComparisonSummary(
  precinct1: PrecinctData,
  precinct2: PrecinctData,
  comparisonData: any
): string {
  const expertise = getUserExpertiseLevel();
  const insights = comparisonData.insights || [];
  // InsightGenerator returns string[], not objects with .text property
  const topInsights = insights.slice(0, 3).map((i: string) => `• ${i}`).join('\n');

  // Wave 6D.3: Expertise-based formatting
  if (expertise === 'power_user') {
    // Terse comparison for power users
    const lean1 = precinct1.electoral.partisanLean > 0 ? `R+${Math.abs(precinct1.electoral.partisanLean).toFixed(0)}` : `D+${Math.abs(precinct1.electoral.partisanLean).toFixed(0)}`;
    const lean2 = precinct2.electoral.partisanLean > 0 ? `R+${Math.abs(precinct2.electoral.partisanLean).toFixed(0)}` : `D+${Math.abs(precinct2.electoral.partisanLean).toFixed(0)}`;
    const baseInfo = (
      `**${precinct1.name} vs ${precinct2.name}**\n` +
      `Pop: ${precinct1.demographics.totalPopulation.toLocaleString()}/${precinct2.demographics.totalPopulation.toLocaleString()} | ` +
      `Lean: ${lean1}/${lean2} | ` +
      `Swing: ${precinct1.electoral.swingPotential.toFixed(0)}/${precinct2.electoral.swingPotential.toFixed(0)} | ` +
      `GOTV: ${precinct1.targeting.gotvPriority.toFixed(0)}/${precinct2.targeting.gotvPriority.toFixed(0)}`
    );
    const soWhat = generateComparisonSoWhat(precinct1, precinct2);
    return baseInfo + soWhat;
  }

  // Wave 5A: Issue #19 - Weave confidence into comparison narrative
  const confidence1 = calculatePrecinctDataConfidence(precinct1);
  const confidence2 = calculatePrecinctDataConfidence(precinct2);

  // Build lean comparison with confidence context
  const leanDiff = Math.abs(precinct1.electoral.partisanLean - precinct2.electoral.partisanLean);
  let leanComparison = `${precinct1.electoral.partisanLean > 0 ? 'R+' : 'D+'}${Math.abs(precinct1.electoral.partisanLean).toFixed(0)} vs ${precinct2.electoral.partisanLean > 0 ? 'R+' : 'D+'}${Math.abs(precinct2.electoral.partisanLean).toFixed(0)}`;

  if (leanDiff > 10 && confidence1.partisanLean.score >= 70 && confidence2.partisanLean.score >= 70) {
    leanComparison += ` (${leanDiff.toFixed(0)}-point gap confirmed by multiple elections)`;
  } else if (confidence1.partisanLean.score < 60 || confidence2.partisanLean.score < 60) {
    leanComparison += ` (preliminary - both need more data to confirm trend)`;
  }

  // Build swing comparison with confidence context
  const swingDiff = Math.abs(precinct1.electoral.swingPotential - precinct2.electoral.swingPotential);
  let swingComparison = `${precinct1.electoral.swingPotential.toFixed(0)} vs ${precinct2.electoral.swingPotential.toFixed(0)}`;

  if (swingDiff > 20) {
    const higher = precinct1.electoral.swingPotential > precinct2.electoral.swingPotential ? precinct1.name : precinct2.name;
    swingComparison += `. ${higher} shows ${swingDiff.toFixed(0)} points more volatility`;
  }

  // Standard format with insights
  const baseInfo = (
    `**Comparison: ${precinct1.name} vs ${precinct2.name}**\n\n` +
    `**Key Differences:**\n${topInsights}\n\n` +
    `**Demographics:**\n` +
    `• Population: ${precinct1.demographics.totalPopulation.toLocaleString()} vs ${precinct2.demographics.totalPopulation.toLocaleString()}\n` +
    `• Median Income: ${formatCurrency(precinct1.demographics.medianHHI)} vs ${formatCurrency(precinct2.demographics.medianHHI)}\n\n` +
    `**Electoral:**\n` +
    `• Partisan Lean: ${leanComparison}\n` +
    `• Turnout: ${precinct1.electoral.avgTurnout.toFixed(1)}% vs ${precinct2.electoral.avgTurnout.toFixed(1)}%\n` +
    `• Swing Potential: ${swingComparison}`
  );

  // Wave 6B: Add "So What" strategic insight for comparison
  const soWhat = generateComparisonSoWhat(precinct1, precinct2);

  // Wave 6D.2: Add citations
  const fullResponse = baseInfo + soWhat;
  return addCitationsToResponse(fullResponse, ['ELECTIONS', 'DEMOGRAPHICS', 'COMPARISON_METHOD']);
}

function formatFilterResults(criteria: any, results: any): string {
  const expertise = getUserExpertiseLevel();
  const count = results.matchingPrecincts?.length || 0;
  const totalVoters = results.estimatedVoters || 0;
  const matchingPrecincts = results.matchingPrecincts || [];

  let criteriaText = '';
  if (criteria.metric) {
    criteriaText = `with ${criteria.metric.replace(/_/g, ' ')}`;
    if (criteria.threshold) {
      const operator = criteria.operator === 'less_than' ? '<' : criteria.operator === 'greater_than' ? '>' : '=';
      criteriaText += ` ${operator} ${criteria.threshold}`;
    }
  }

  // Assess confidence based on data quality and result count
  const confidence = assessConfidence({
    dataPoints: count,
    sampleSize: totalVoters,
  });

  // Generate confidence-aware recommendation based on result count
  let insightText: string;
  let methodologyNote: string;

  if (count < 5) {
    insightText = `${count} precincts match your criteria — a highly focused targeting segment`;
    methodologyNote = 'Focused selection allows deep engagement';
  } else if (count <= 15) {
    insightText = `${count} precincts match your criteria — an actionable canvassing universe`;
    methodologyNote = `${totalVoters.toLocaleString()} voters across manageable territory`;
  } else if (count <= 30) {
    insightText = `${count} precincts match your criteria — consider prioritizing top performers`;
    methodologyNote = 'May benefit from additional filtering for resource efficiency';
  } else {
    insightText = `${count} precincts match your criteria — broad selection may need refinement`;
    methodologyNote = 'Consider narrowing criteria for more targeted outreach';
  }

  const recommendation = expressConfidence(confidence, insightText, methodologyNote);

  // Wave 6D.3: Expertise-based formatting
  if (expertise === 'power_user') {
    // Terse format for power users
    let response = `**${recommendation}** ${criteriaText}\n`;
    if (matchingPrecincts.length > 0 && matchingPrecincts.length <= 10) {
      const topPrecincts = matchingPrecincts.slice(0, 5);
      response += topPrecincts.map((p: any, i: number) => {
        const metricValue = criteria.metric === 'swing_potential' ? p.electoral?.swingPotential
          : criteria.metric === 'gotv_priority' ? p.targeting?.gotvPriority
          : criteria.metric === 'persuasion_opportunity' ? p.targeting?.persuasionOpportunity
          : null;
        return `${i + 1}. ${p.name}${metricValue !== null ? ` (${Math.round(metricValue)})` : ''}`;
      }).join(' | ') + '\n';
    }
    response += `Avg: GOTV ${results.avgGOTV?.toFixed(0) || 'N/A'} | Pers ${results.avgPersuasion?.toFixed(0) || 'N/A'} | Lean ${results.avgPartisanLean > 0 ? 'R+' : 'D+'}${Math.abs(results.avgPartisanLean || 0).toFixed(0)} | TO ${results.avgTurnout?.toFixed(0) || 'N/A'}%`;

    const jurisdictions = matchingPrecincts.map((p: any) => p.jurisdiction || p.jurisdictionType || 'Unknown');
    const soWhat = generateFilterSoWhat(criteria, {
      precinctCount: count,
      estimatedVoters: totalVoters,
      avgGOTV: results.avgGOTV,
      avgPartisanLean: results.avgPartisanLean,
      jurisdictions,
    });
    return response + soWhat;
  }

  let response = (
    `**Filter Results ${criteriaText}:**\n\n` +
    `Found **${count} precincts** with approximately **${totalVoters.toLocaleString()} registered voters**.\n\n`
  );

  // Add top 5 precincts if available
  if (matchingPrecincts.length > 0 && matchingPrecincts.length <= 10) {
    const topPrecincts = matchingPrecincts.slice(0, 5);
    response += `**Top ${Math.min(5, count)} Precincts:**\n`;
    topPrecincts.forEach((p: any, i: number) => {
      const metricValue = criteria.metric === 'swing_potential' ? p.electoral?.swingPotential
        : criteria.metric === 'gotv_priority' ? p.targeting?.gotvPriority
        : criteria.metric === 'persuasion_opportunity' ? p.targeting?.persuasionOpportunity
        : null;

      response += `${i + 1}. **${p.name}**${metricValue !== null ? ` (${Math.round(metricValue)})` : ''}\n`;
    });
    response += '\n';
  }

  response += (
    `**Averages:**\n` +
    `• GOTV Priority: ${results.avgGOTV?.toFixed(0) || 'N/A'}/100\n` +
    `• Persuasion Opportunity: ${results.avgPersuasion?.toFixed(0) || 'N/A'}/100\n` +
    `• Partisan Lean: ${results.avgPartisanLean > 0 ? 'R+' : 'D+'}${Math.abs(results.avgPartisanLean || 0).toFixed(0)}\n` +
    `• Turnout: ${results.avgTurnout?.toFixed(1) || 'N/A'}%\n\n` +
    `These precincts are highlighted on the map${matchingPrecincts.length > 0 && matchingPrecincts.length <= 10 ? ' with numbered markers' : ''}.`
  );

  // Wave 6B: Add "So What" strategic insight
  // Wave 6B.7: Extract jurisdictions for spatial reasoning
  const jurisdictions = matchingPrecincts.map((p: any) => p.jurisdiction || p.jurisdictionType || 'Unknown');
  const soWhat = generateFilterSoWhat(criteria, {
    precinctCount: count,
    estimatedVoters: totalVoters,
    avgGOTV: results.avgGOTV,
    avgPartisanLean: results.avgPartisanLean,
    jurisdictions,
  });

  // Wave 6D.2: Add citations
  const fullResponse = response + soWhat;
  return addCitationsToResponse(fullResponse, ['ELECTIONS', 'SEGMENT_METHODOLOGY', 'TARGETING']);
}

function formatDemographics(precinct: PrecinctData): string {
  const { name, demographics } = precinct;
  const expertise = getUserExpertiseLevel();

  // Wave 6D.3: Expertise-based formatting
  if (expertise === 'power_user') {
    const response = (
      `**${name} Demographics**\n` +
      `Pop: ${demographics.totalPopulation.toLocaleString()} (${demographics.population18up.toLocaleString()} 18+) | ` +
      `Age: ${demographics.medianAge.toFixed(0)} | Inc: $${Math.round(demographics.medianHHI / 1000)}K | ` +
      `Ed: ${demographics.collegePct.toFixed(0)}% | Own: ${demographics.homeownerPct.toFixed(0)}%`
    );
    return addCitationsToResponse(response, ['DEMOGRAPHICS', 'CENSUS_ACS']);
  }

  const response = (
    `**Demographics for ${name}:**\n\n` +
    `• Total Population: ${demographics.totalPopulation.toLocaleString()}\n` +
    `• Voting Age Population: ${demographics.population18up.toLocaleString()}\n` +
    `• Median Age: ${demographics.medianAge.toFixed(1)} years\n` +
    `• Median Household Income: ${formatCurrency(demographics.medianHHI)}\n` +
    `• College Degree: ${demographics.collegePct.toFixed(1)}%\n` +
    `• Homeownership Rate: ${demographics.homeownerPct.toFixed(1)}%\n` +
    `• Diversity Index: ${demographics.diversityIndex}/100\n` +
    `• Population Density: ${demographics.populationDensity.toLocaleString()} per sq mi`
  );

  // Wave 6D.2: Add citations
  return addCitationsToResponse(response, ['DEMOGRAPHICS', 'CENSUS_ACS']);
}

// ============================================================================
// Confidence & Citation Helpers (Phase 14)
// ============================================================================

/**
 * Calculate confidence for precinct data based on available information
 */
function calculatePrecinctDataConfidence(precinct: PrecinctData): {
  partisanLean: ConfidenceMetadata;
  swingPotential: ConfidenceMetadata;
  gotvPriority: ConfidenceMetadata;
  demographics?: ConfidenceMetadata;
} {
  const engine = getConfidenceEngine();

  // Determine redistricting status based on precinct data
  // (In real data, this would come from the precinct record)
  const redistrictingStatus: 'stable' | 'recent' | 'new' = 'stable';

  // Calculate confidence for each metric
  const partisanLean = engine.calculatePartisanLeanConfidence({
    electionCount: 3, // 2020, 2022, 2024
    mostRecentYear: 2024,
    redistrictingStatus,
    marginVolatility: 5, // Typical volatility
  });

  const swingPotential = engine.calculateSwingPotentialConfidence({
    electionCount: 3,
    mostRecentYear: 2024,
    redistrictingStatus,
    hasTicketSplittingData: true,
    hasDemographicData: true,
  });

  const gotvPriority = engine.calculateGotvConfidence({
    hasTurnoutHistory: true,
    hasPartisanData: true,
    hasDemographicData: true,
    turnoutElections: 3,
    redistrictingStatus,
  });

  const demographics = engine.calculateDemographicConfidence({
    acsVintage: '2019-2023',
    interpolated: true,
    blockGroupCoverage: 0.9,
  });

  return { partisanLean, swingPotential, gotvPriority, demographics };
}

/**
 * Format a metric value with confidence indicator
 */
function formatWithConfidence(
  value: string | number,
  confidence: ConfidenceMetadata,
  options?: { showRange?: boolean; compact?: boolean }
): string {
  const engine = getConfidenceEngine();
  return engine.formatValueWithConfidence(value, confidence, options);
}

/**
 * Add citations to a response based on content
 */
function addCitationsToResponse(
  response: string,
  explicitCitations: CitationKey[] = []
): string {
  const citationService = getCitationService();

  // Auto-detect additional citations from content
  const suggestedCitations = citationService.suggestCitations(response);

  // Combine explicit and suggested, remove duplicates
  const allCitations = [...new Set([...explicitCitations, ...suggestedCitations])];

  return citationService.addCitationsToResponse(response, allCitations);
}

/**
 * Format precinct summary with confidence indicators (enhanced version)
 */
function formatPrecinctSummaryWithConfidence(precinct: PrecinctData): string {
  const { name, jurisdiction, demographics, electoral, targeting } = precinct;
  const confidence = calculatePrecinctDataConfidence(precinct);
  const engine = getConfidenceEngine();

  // Wave 5A: Issue #19 - Weave confidence naturally into narrative
  // Instead of just showing numbers with confidence indicators, explain what they mean

  // Build partisan lean narrative with confidence context
  const leanValue = Math.abs(electoral.partisanLean).toFixed(0);
  const leanParty = electoral.partisanLean > 0 ? 'Republican' : 'Democratic';
  const leanStr = electoral.partisanLean > 0 ? `R+${leanValue}` : `D+${leanValue}`;

  let leanNarrative = `${leanStr} ${leanParty} lean`;
  if (confidence.partisanLean.score >= 80) {
    leanNarrative += ` (based on 3 elections, consistent pattern)`;
  } else if (confidence.partisanLean.score >= 60) {
    leanNarrative += ` (recent elections show this trend)`;
  } else {
    leanNarrative += ` (limited data, treat as preliminary)`;
  }

  // Build swing potential narrative with confidence context
  const swingValue = electoral.swingPotential.toFixed(0);
  let swingNarrative = `Swing potential ${swingValue}/100`;
  if (confidence.swingPotential.score >= 80 && electoral.swingPotential > 60) {
    swingNarrative += `. Historical volatility confirms this is genuinely competitive`;
  } else if (confidence.swingPotential.score >= 80 && electoral.swingPotential < 40) {
    swingNarrative += `. Historical consistency shows this is stable ${leanParty} territory`;
  } else if (confidence.swingPotential.score < 60) {
    swingNarrative += ` (preliminary - needs more election cycles to confirm)`;
  }

  // Build GOTV narrative
  const gotvValue = targeting.gotvPriority.toFixed(0);
  let gotvNarrative = `GOTV priority ${gotvValue}/100`;
  if (confidence.gotvPriority.score >= 70) {
    gotvNarrative += ` [TARGETING]`;
  }

  let response = (
    `**${name}** (${jurisdiction})\n\n` +
    `**Demographics:** [DEMOGRAPHICS]\n` +
    `• Population: ${demographics.totalPopulation.toLocaleString()}\n` +
    `• Median Age: ${demographics.medianAge.toFixed(1)} years\n` +
    `• Median Income: ${formatCurrency(demographics.medianHHI)}\n` +
    `• College Degree: ${demographics.collegePct.toFixed(1)}%\n\n` +
    `**Electoral Profile:** [ELECTIONS]\n` +
    `• ${leanNarrative}\n` +
    `• Competitiveness: ${electoral.competitiveness.replace(/_/g, ' ').toUpperCase()}\n` +
    `• ${swingNarrative} [SCORES]\n` +
    `• Average Turnout: ${electoral.avgTurnout.toFixed(1)}%\n\n` +
    `**Targeting:**\n` +
    `• ${gotvNarrative}\n` +
    `• Persuasion Opportunity: ${targeting.persuasionOpportunity.toFixed(0)}/100\n` +
    `• Strategy: ${targeting.strategy}\n`
  );

  // Wave 5A: Issue #20 - Add "So What" impact framing
  const soWhat = generatePrecinctSoWhat(precinct);
  response += soWhat;

  // Add citations
  return addCitationsToResponse(response, ['ELECTIONS', 'DEMOGRAPHICS', 'SCORES', 'TARGETING']);
}

// ============================================================================
// Output Intent Handler
// ============================================================================

export interface OutputContext {
  precinctsExplored: number;
  hasActiveSegment: boolean;
  segmentPrecinctCount: number;
  hasAnalysisResults: boolean;
  messageCount: number;
  currentTool: string;
  hasMapSelection: boolean;
}

/**
 * Handler for save/export/download requests
 * Returns context-aware suggestions based on what the user can output
 */
export async function handleOutputIntent(
  outputParams: { requestType: 'save' | 'export' | 'download' | 'share'; targetType?: string },
  context: OutputContext
): Promise<HandlerResult> {
  const { requestType, targetType } = outputParams;
  const {
    precinctsExplored,
    hasActiveSegment,
    segmentPrecinctCount,
    hasAnalysisResults,
    messageCount,
    currentTool,
    hasMapSelection,
  } = context;

  // Build context-aware suggestions
  const suggestions: SuggestedAction[] = [];
  const availableOutputs: string[] = [];

  // Segment save (if user has explored precincts or has active filters)
  if (precinctsExplored > 0 || hasActiveSegment) {
    const precinctCount = hasActiveSegment ? segmentPrecinctCount : precinctsExplored;
    suggestions.push({
      id: 'save-segment',
      label: `Save as segment (${precinctCount} precincts)`,
      action: 'output:saveSegment',
      icon: 'bookmark',
      description: 'Save these precincts as a reusable segment for future analysis',
      metadata: { precinctCount },
    });
    availableOutputs.push(`segment with ${precinctCount} precincts`);
  }

  // CSV export (always available if any data exists)
  if (precinctsExplored > 0 || hasActiveSegment || hasAnalysisResults) {
    suggestions.push({
      id: 'export-csv',
      label: 'Export to CSV',
      action: 'output:exportCSV',
      icon: 'file-spreadsheet',
      description: 'Download precinct data with targeting scores as spreadsheet',
    });
    availableOutputs.push('CSV with precinct data');
  }

  // VAN/VoteBuilder export (for Democratic campaigns)
  if (precinctsExplored > 0 || hasActiveSegment || hasAnalysisResults) {
    suggestions.push({
      id: 'export-van',
      label: 'Export for VAN/VoteBuilder',
      action: 'output:exportVAN',
      icon: 'database',
      description: 'Export in VAN-compatible format for Democratic campaign tools',
    });
    availableOutputs.push('VAN-compatible CSV');
  }

  // PDF report (if there's meaningful analysis)
  if (hasAnalysisResults || hasMapSelection || precinctsExplored >= 3) {
    suggestions.push({
      id: 'generate-report',
      label: 'Generate PDF report',
      action: 'output:generateReport',
      icon: 'file-text',
      description: 'Create a comprehensive Political Profile report',
    });
    availableOutputs.push('PDF Political Profile report');
  }

  // Conversation export (if there's conversation history)
  if (messageCount >= 3) {
    suggestions.push({
      id: 'export-conversation',
      label: 'Export this conversation',
      action: 'output:exportConversation',
      icon: 'message-square',
      description: 'Download chat history as a text file',
    });
    availableOutputs.push('conversation transcript');
  }

  // Canvassing plan (if there's a segment or explored precincts)
  if ((hasActiveSegment && segmentPrecinctCount > 0) || precinctsExplored >= 2) {
    suggestions.push({
      id: 'plan-canvass',
      label: 'Plan canvassing operation',
      action: 'output:planCanvass',
      icon: 'route',
      description: 'Create a canvassing plan for these precincts',
    });
    availableOutputs.push('canvassing plan');
  }

  // Generate response based on request type and available outputs
  let response: string;

  if (suggestions.length === 0) {
    // Nothing to save/export yet
    response = getEmptyContextResponse(requestType);
  } else if (targetType && targetType !== 'general') {
    // User specified what they want to output
    response = getTargetedResponse(requestType, targetType, availableOutputs, suggestions);
  } else {
    // General request - show all options
    response = getGeneralResponse(requestType, availableOutputs);
  }

  // Build map commands to highlight explored/saved areas
  const mapCommands: MapCommand[] = [];
  const stateManager = getStateManager();
  const state = stateManager.getState();

  if (precinctsExplored > 0 || hasActiveSegment) {
    // Get precinct IDs from exploration history or active segment
    const precinctIds: string[] = [];

    if (hasActiveSegment && state.segmentation?.matchingPrecincts?.length) {
      // Use matching precincts from active segment filter
      precinctIds.push(...state.segmentation.matchingPrecincts);
    } else if (precinctsExplored > 0) {
      // Use recently explored precincts
      const history = state.explorationHistory || [];
      const recentPrecincts = history
        .filter(e => e.precinctIds && e.precinctIds.length > 0)
        .slice(-10) // Last 10 explorations
        .flatMap(e => e.precinctIds || []);
      precinctIds.push(...Array.from(new Set(recentPrecincts))); // Deduplicate
    }

    if (precinctIds.length > 0) {
      mapCommands.push({
        type: 'highlight',
        target: precinctIds,
      });
    }
  }

  return {
    response,
    suggestedActions: suggestions.slice(0, 5), // Limit to 5 options
    mapCommands: mapCommands.length > 0 ? mapCommands : undefined,
  };
}

/**
 * Response when there's nothing to save/export
 */
function getEmptyContextResponse(requestType: string): string {
  const action = requestType === 'save' ? 'save' : requestType === 'share' ? 'share' : 'export';

  return (
    `I'd be happy to help you ${action} your work, but there isn't much to ${action} yet.\n\n` +
    `**To get started, try:**\n` +
    `• Click on a precinct on the map to explore it\n` +
    `• Use the QuickStart IQ button to run an analysis\n` +
    `• Ask me to "Find swing precincts" or "Show high GOTV areas"\n\n` +
    `Once you've explored some data, I'll offer relevant save and export options.`
  );
}

/**
 * Response for targeted export request (user specified what they want)
 */
function getTargetedResponse(
  requestType: string,
  targetType: string,
  availableOutputs: string[],
  suggestions: SuggestedAction[]
): string {
  const targetMap: Record<string, string> = {
    analysis: 'analysis results',
    conversation: 'conversation',
    segment: 'segment',
    report: 'report',
    data: 'data',
    map: 'map view',
  };

  const targetLabel = targetMap[targetType] || targetType;
  const relevantSuggestion = suggestions.find(s => {
    if (targetType === 'analysis') return s.id === 'generate-report' || s.id === 'export-csv';
    if (targetType === 'conversation') return s.id === 'export-conversation';
    if (targetType === 'segment') return s.id === 'save-segment';
    if (targetType === 'report') return s.id === 'generate-report';
    if (targetType === 'data') return s.id === 'export-csv';
    return false;
  });

  if (relevantSuggestion) {
    return (
      `I can ${requestType} your ${targetLabel}. Here are the best options:\n\n` +
      `Based on your current session, you have:\n` +
      availableOutputs.map(o => `• ${o}`).join('\n') +
      `\n\nSelect an option below to proceed.`
    );
  }

  return (
    `I understand you want to ${requestType} your ${targetLabel}.\n\n` +
    `While I don't have that specific output ready, here's what I can ${requestType} right now:\n` +
    availableOutputs.map(o => `• ${o}`).join('\n') +
    `\n\nWould any of these work for you?`
  );
}

/**
 * Response for general export request
 */
function getGeneralResponse(requestType: string, availableOutputs: string[]): string {
  const actionVerb = requestType === 'save' ? 'save' : requestType === 'share' ? 'share' : 'export';

  return (
    `I can ${actionVerb} your work in several ways.\n\n` +
    `**Based on your current session:**\n` +
    availableOutputs.map(o => `• ${o}`).join('\n') +
    `\n\nWhat would be most useful for you?`
  );
}

// ============================================================================
// Report Intent Handler
// ============================================================================

export interface ReportContext {
  precinctsExplored: number;
  hasActiveSegment: boolean;
  segmentPrecinctCount: number;
  hasComparisonData: boolean;
  comparisonEntities?: [string, string];
  hasDonorData: boolean;
  hasCanvassingData: boolean;
  currentTool: string;
  hasMapSelection: boolean;
  selectedPrecinctNames?: string[];
}

interface ReportOption {
  id: string;
  type: string;
  label: string;
  description: string;
  pages: string;
  action: string;
  icon: string;
  emoji: string;  // Emoji icon for visual distinction
  available: boolean;
  recommended?: boolean;
  metadata?: Record<string, unknown>;
}

// Emoji icons for report types
const REPORT_EMOJIS: Record<string, string> = {
  executive: '📋',
  targeting: '🎯',
  profile: '📊',
  comparison: '⚖️',
  segment: '🔍',
  canvass: '🚶',
  donor: '💰',
};

/**
 * Handler for report generation requests
 * Returns context-aware report suggestions based on session state
 */
export async function handleReportIntent(
  reportParams: {
    requestType: 'generate' | 'preview' | 'customize';
    reportType?: string;
    targetArea?: string;
    comparisonAreas?: [string, string];
  },
  context: ReportContext
): Promise<HandlerResult> {
  const { requestType, reportType, targetArea, comparisonAreas } = reportParams;
  const {
    precinctsExplored,
    hasActiveSegment,
    segmentPrecinctCount,
    hasComparisonData,
    hasDonorData,
    hasCanvassingData,
    currentTool,
    hasMapSelection,
    selectedPrecinctNames,
  } = context;

  // Build available report options based on context
  const reportOptions: ReportOption[] = [];

  // Executive Summary - always available if any data
  if (precinctsExplored > 0 || hasMapSelection || hasActiveSegment) {
    const precinctCount = hasActiveSegment ? segmentPrecinctCount : precinctsExplored;
    reportOptions.push({
      id: 'executive-summary',
      type: 'executive',
      label: 'Executive Summary',
      description: `One-page overview with key metrics${precinctCount > 0 ? ` (${precinctCount} precincts)` : ''}`,
      pages: '1 page',
      action: 'report:executive',
      icon: 'file-text',
      emoji: REPORT_EMOJIS.executive,
      available: true,
      recommended: precinctCount <= 3,
      metadata: { precinctCount, precinctNames: selectedPrecinctNames },
    });
  }

  // Targeting Brief - available if exploring multiple precincts
  if (precinctsExplored >= 2 || hasActiveSegment) {
    const precinctCount = hasActiveSegment ? segmentPrecinctCount : precinctsExplored;
    reportOptions.push({
      id: 'targeting-brief',
      type: 'targeting',
      label: 'Targeting Brief',
      description: `Ranked precincts with GOTV/Persuasion scores (${precinctCount} precincts)`,
      pages: '1-2 pages',
      action: 'report:targeting',
      icon: 'target',
      emoji: REPORT_EMOJIS.targeting,
      available: true,
      recommended: precinctCount >= 5 && currentTool !== 'canvass',
      metadata: { precinctCount, precinctNames: selectedPrecinctNames },
    });
  }

  // Political Profile - full 7-page report
  if (precinctsExplored > 0 || hasMapSelection || hasActiveSegment) {
    reportOptions.push({
      id: 'political-profile',
      type: 'profile',
      label: 'Political Profile',
      description: 'Comprehensive 7-page analysis with demographics, elections, and AI insights',
      pages: '7 pages',
      action: 'report:profile',
      icon: 'book-open',
      emoji: REPORT_EMOJIS.profile,
      available: true,
      recommended: precinctsExplored === 1 && !hasActiveSegment,
      metadata: { precinctNames: selectedPrecinctNames },
    });
  }

  // Comparison Report - available if comparison data exists
  if (hasComparisonData || (comparisonAreas && comparisonAreas.length === 2)) {
    const areas = comparisonAreas || context.comparisonEntities;
    reportOptions.push({
      id: 'comparison-report',
      type: 'comparison',
      label: 'Comparison Report',
      description: areas ? `Side-by-side analysis: ${areas[0]} vs ${areas[1]}` : 'Side-by-side analysis of two areas',
      pages: '2-4 pages',
      action: 'report:comparison',
      icon: 'columns',
      emoji: REPORT_EMOJIS.comparison,
      available: true,
      recommended: hasComparisonData,
      metadata: { comparisonAreas: areas },
    });
  }

  // Segment Report - available if segment is active
  if (hasActiveSegment && segmentPrecinctCount > 0) {
    reportOptions.push({
      id: 'segment-report',
      type: 'segment',
      label: 'Segment Report',
      description: `Document your segment definition and ${segmentPrecinctCount} matching precincts`,
      pages: '2-3 pages',
      action: 'report:segment',
      icon: 'filter',
      emoji: REPORT_EMOJIS.segment,
      available: true,
      recommended: currentTool === 'segments',
      metadata: { precinctCount: segmentPrecinctCount },
    });
  }

  // Canvassing Plan - available if on canvass tool or has segment
  if (hasCanvassingData || (hasActiveSegment && segmentPrecinctCount > 0) || precinctsExplored >= 3) {
    const precinctCount = hasActiveSegment ? segmentPrecinctCount : precinctsExplored;
    reportOptions.push({
      id: 'canvassing-plan',
      type: 'canvass',
      label: 'Canvassing Plan',
      description: `Field operation document with turf assignments (~${precinctCount} precincts)`,
      pages: '3-5 pages',
      action: 'report:canvass',
      icon: 'map-pin',
      emoji: REPORT_EMOJIS.canvass,
      available: true,
      recommended: currentTool === 'canvass' || hasCanvassingData,
      metadata: { precinctCount },
    });
  }

  // Donor Analysis - available if on donor tool or has donor data
  if (hasDonorData || currentTool === 'donors') {
    reportOptions.push({
      id: 'donor-analysis',
      type: 'donor',
      label: 'Donor Analysis',
      description: 'Fundraising intelligence with geographic concentration and prospects',
      pages: '3-4 pages',
      action: 'report:donor',
      icon: 'dollar-sign',
      emoji: REPORT_EMOJIS.donor,
      available: true,
      recommended: currentTool === 'donors' || hasDonorData,
    });
  }

  // Generate response based on request type and available options
  let response: string;
  let suggestions: SuggestedAction[] = [];

  if (reportOptions.length === 0) {
    // No data to generate reports - use recovery suggestions
    return {
      response: "I'd love to create a report for you! First, let's define the area to analyze. You can:",
      suggestedActions: generateRecoverySuggestions('selection'),
      mapCommands: [
        { type: 'showChoropleth', metric: 'partisan_lean' }
      ],
    };
  } else if (reportType && reportType !== 'general') {
    // User requested specific report type
    response = getSpecificReportResponse(reportType, reportOptions, targetArea);
    suggestions = buildReportSuggestions(reportOptions.filter(r => r.type === reportType || r.recommended));
  } else {
    // General request - show contextual options
    response = getContextualReportResponse(reportOptions, currentTool, precinctsExplored, hasActiveSegment);
    suggestions = buildReportSuggestions(reportOptions);
  }

  // Build map commands to show report area
  const mapCommands: MapCommand[] = [];

  if (hasMapSelection || precinctsExplored > 0 || hasActiveSegment) {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const precinctIds: string[] = [];

    // Get precinct IDs from active segment or exploration history
    if (hasActiveSegment && state.segmentation?.matchingPrecincts?.length) {
      // Use matching precincts from active segment filter
      precinctIds.push(...state.segmentation.matchingPrecincts);
    } else if (precinctsExplored > 0) {
      const history = state.explorationHistory || [];
      const recentPrecincts = history
        .filter(e => e.precinctIds && e.precinctIds.length > 0)
        .slice(-10)
        .flatMap(e => e.precinctIds || []);
      precinctIds.push(...Array.from(new Set(recentPrecincts)));
    }

    if (precinctIds.length > 0) {
      mapCommands.push({
        type: 'highlight',
        target: precinctIds,
      });
    }
  }

  return {
    response,
    suggestedActions: suggestions.slice(0, 6), // Limit to 6 options
    mapCommands: mapCommands.length > 0 ? mapCommands : undefined,
  };
}

/**
 * Response when there's no data to generate reports
 */
function getNoDataReportResponse(): string {
  return (
    `I'd be happy to generate a report, but I need some data first.\n\n` +
    `**To get started:**\n` +
    `• Click on a precinct on the map to explore it\n` +
    `• Use the segment builder to filter precincts\n` +
    `• Run a QuickStart IQ analysis\n\n` +
    `Once you've explored some data, I'll suggest the best report types for your needs.`
  );
}

/**
 * Response for specific report type request
 */
function getSpecificReportResponse(
  reportType: string,
  options: ReportOption[],
  targetArea?: string
): string {
  const typeLabels: Record<string, string> = {
    executive: 'Executive Summary',
    targeting: 'Targeting Brief',
    comparison: 'Comparison Report',
    segment: 'Segment Report',
    canvass: 'Canvassing Plan',
    donor: 'Donor Analysis',
    profile: 'Political Profile',
  };

  const matchingOption = options.find(o => o.type === reportType);
  const label = typeLabels[reportType] || 'Report';

  if (matchingOption) {
    const areaText = targetArea ? ` for ${targetArea}` : '';
    return (
      `**${label}${areaText}**\n\n` +
      `${matchingOption.description}\n\n` +
      `**What's included:**\n` +
      getReportContents(reportType) +
      `\n\nReady to generate? Click below to create your ${matchingOption.pages} report.`
    );
  }

  // Report type not available - suggest alternatives
  const alternatives = options.filter(o => o.available).slice(0, 3);
  return (
    `I don't have enough data to create a ${label} right now.\n\n` +
    `**Available alternatives:**\n` +
    alternatives.map(o => `• **${o.label}** - ${o.description}`).join('\n') +
    `\n\nWould any of these work for you?`
  );
}

/**
 * Get report contents description
 */
function getReportContents(reportType: string): string {
  const contents: Record<string, string> = {
    executive: '• Key metrics overview\n• Quick assessment\n• Top recommendation',
    targeting: '• Ranked precinct list\n• GOTV and Persuasion scores\n• Priority recommendations',
    comparison: '• Side-by-side metrics\n• Key differences\n• Strategic implications',
    segment: '• Filter criteria\n• Matching precincts\n• Aggregate demographics',
    canvass: '• Operation overview\n• Turf assignments\n• Staffing recommendations',
    donor: '• Fundraising summary\n• Geographic concentration\n• Prospect identification',
    profile: '• Political overview\n• Election history\n• Demographics\n• Political attitudes\n• Engagement profile\n• AI analysis',
  };

  return contents[reportType] || '• Comprehensive analysis';
}

/**
 * Response for general/contextual report request
 */
function getContextualReportResponse(
  options: ReportOption[],
  currentTool: string,
  precinctsExplored: number,
  hasActiveSegment: boolean
): string {
  // Group options by category
  const quickReports = options.filter(o => ['executive', 'targeting'].includes(o.type));
  const detailedReports = options.filter(o => ['profile', 'comparison'].includes(o.type));
  const operationalReports = options.filter(o => ['segment', 'canvass', 'donor'].includes(o.type));

  const recommended = options.find(o => o.recommended);

  let response = `I can create several types of reports based on your session.\n\n`;

  if (quickReports.length > 0) {
    response += `**Quick Reports (1-2 pages):**\n`;
    quickReports.forEach(r => {
      const recLabel = r.recommended ? ' ⭐ *Recommended*' : '';
      response += `${r.emoji} **${r.label}** - ${r.description}${recLabel}\n`;
    });
    response += '\n';
  }

  if (detailedReports.length > 0) {
    response += `**Detailed Reports:**\n`;
    detailedReports.forEach(r => {
      const recLabel = r.recommended ? ' ⭐ *Recommended*' : '';
      response += `${r.emoji} **${r.label}** (${r.pages}) - ${r.description}${recLabel}\n`;
    });
    response += '\n';
  }

  if (operationalReports.length > 0) {
    response += `**Operational Reports:**\n`;
    operationalReports.forEach(r => {
      const recLabel = r.recommended ? ' ⭐ *Recommended*' : '';
      response += `${r.emoji} **${r.label}** (${r.pages}) - ${r.description}${recLabel}\n`;
    });
    response += '\n';
  }

  // Add recommendation
  if (recommended) {
    response += `Based on your exploration, I'd suggest starting with the **${recommended.label}**.`;
  } else {
    response += `Which would be most useful for you?`;
  }

  return response;
}

/**
 * Build suggested actions from report options
 */
function buildReportSuggestions(options: ReportOption[]): SuggestedAction[] {
  // Sort by recommended first, then by type priority
  const sortedOptions = [...options].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return 0;
  });

  const suggestions: SuggestedAction[] = sortedOptions.map(option => ({
    id: option.id,
    label: `${option.emoji} ${option.label} (${option.pages})`,
    action: option.action,
    icon: option.icon,
    description: option.description,
    metadata: option.metadata,
  }));

  // Add customize option if there are reports available
  if (sortedOptions.length > 0) {
    suggestions.push({
      id: 'customize-report',
      label: '⚙️ Customize report sections',
      action: 'customize report',
      icon: 'settings',
      description: 'Choose which sections to include in your report',
    });
  }

  return suggestions;
}

// ============================================================================
// Report History Handler
// ============================================================================

/**
 * Handle requests to view report history
 */
export async function handleReportHistoryRequest(): Promise<HandlerResult> {
  const recentReports = getRecentReports(10);

  if (recentReports.length === 0) {
    return {
      response: `📜 **Report History**\n\nYou haven't generated any reports yet.\n\n` +
        `To create your first report, explore some precincts on the map or build a segment, then ask me to "generate a report".`,
      suggestedActions: [
        { id: 'generate-report', label: '📊 Generate a report', action: 'generate a report', icon: 'file-text' },
        { id: 'explore-map', label: '🗺️ Explore the map', action: 'navigate:/political-ai', icon: 'map' },
      ],
    };
  }

  // Format the history
  let response = `📜 **Recent Reports** (${recentReports.length})\n\n`;

  recentReports.forEach((entry, index) => {
    const config = REPORT_TYPE_CONFIG[entry.reportType] || { emoji: '📄', label: entry.reportType };
    const date = new Date(entry.generatedAt);
    const timeAgo = getTimeAgo(date);

    response += `${index + 1}. ${config.emoji} **${entry.title}**\n`;
    response += `   - ${entry.precinctCount} precinct${entry.precinctCount > 1 ? 's' : ''}\n`;
    response += `   - Generated ${timeAgo}\n`;
    response += `   - File: \`${entry.filename}\`\n\n`;
  });

  response += `\n_Note: Reports are stored locally. Clear your browser data to reset history._`;

  // Build actions to regenerate recent reports
  const regenerateActions: SuggestedAction[] = recentReports.slice(0, 3).map(entry => {
    const config = REPORT_TYPE_CONFIG[entry.reportType] || { emoji: '📄', label: entry.reportType };
    return {
      id: `regen-${entry.id}`,
      label: `${config.emoji} Regenerate ${entry.title}`,
      action: `report:${entry.reportType}`,
      icon: 'refresh-cw',
      metadata: { precinctNames: entry.precinctNames },
    };
  });

  // Build map commands to highlight most recent report area
  const mapCommands: MapCommand[] = [];
  if (recentReports.length > 0 && recentReports[0].precinctNames) {
    mapCommands.push({
      type: 'highlight',
      target: recentReports[0].precinctNames,
    });
  }

  return {
    response,
    suggestedActions: [
      ...regenerateActions,
      { id: 'new-report', label: '📑 Generate new report', action: 'generate a report', icon: 'file-plus' },
    ],
    mapCommands: mapCommands.length > 0 ? mapCommands : undefined,
  };
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Report Customization Handler
// ============================================================================

/**
 * Handle requests to customize report sections
 */
export async function handleReportCustomization(
  reportType?: string
): Promise<HandlerResult> {
  const availableReportTypes = Object.keys(REPORT_TYPE_CONFIG);

  // If no report type specified, show all available report types to choose from
  if (!reportType || reportType === 'general') {
    let response = `⚙️ **Report Customization**\n\n`;
    response += `Choose a report type to customize:\n\n`;

    availableReportTypes.forEach(type => {
      const config = REPORT_TYPE_CONFIG[type];
      response += `${config.emoji} **${config.label}** - ${config.sections.length} sections\n`;
    });

    response += `\nSelect a report type below to see its customizable sections.`;

    const suggestions: SuggestedAction[] = availableReportTypes.map(type => {
      const config = REPORT_TYPE_CONFIG[type];
      return {
        id: `customize-${type}`,
        label: `${config.emoji} ${config.label}`,
        action: `customize ${type} report sections`,
        icon: 'settings',
        description: `${config.sections.length} sections available`,
      };
    });

    return {
      response,
      suggestedActions: suggestions.slice(0, 6),
      mapCommands: undefined, // No specific area to show when listing all report types
    };
  }

  // Show sections for the specified report type
  const config = REPORT_TYPE_CONFIG[reportType];

  if (!config) {
    return {
      response: `I don't recognize the report type "${reportType}".\n\nAvailable types: ${availableReportTypes.join(', ')}`,
      suggestedActions: [
        { id: 'precinct', label: 'Precinct Profile', action: 'Generate a precinct profile report', icon: 'file-text' },
        { id: 'comparison', label: 'Comparison', action: 'Generate a comparison report', icon: 'git-compare' },
        { id: 'help', label: 'Get help', action: 'What reports can you generate?', icon: 'help-circle' }
      ],
      mapCommands: undefined,
    };
  }

  let response = `⚙️ **Customize ${config.emoji} ${config.label}**\n\n`;
  response += `This report has ${config.sections.length} sections:\n\n`;

  // Group sections by required/optional
  const requiredSections = config.sections.filter(s => s.required);
  const optionalSections = config.sections.filter(s => !s.required);

  if (requiredSections.length > 0) {
    response += `**Required Sections** (always included):\n`;
    requiredSections.forEach(section => {
      response += `• ✓ ${section.label}\n`;
    });
    response += '\n';
  }

  if (optionalSections.length > 0) {
    response += `**Optional Sections** (can be excluded):\n`;
    optionalSections.forEach(section => {
      response += `• ☐ ${section.label}\n`;
    });
    response += '\n';
  }

  response += `\n_Note: Section customization is applied when generating the report. `;
  response += `Simply tell me which sections to exclude (e.g., "generate ${reportType} report without demographics")._`;

  // Build suggestions for excluding each optional section
  const excludeSuggestions: SuggestedAction[] = optionalSections.slice(0, 3).map(section => ({
    id: `exclude-${section.id}`,
    label: `Exclude "${section.label}"`,
    action: `generate ${reportType} report without ${section.label.toLowerCase()}`,
    icon: 'minus-circle',
    description: `Skip the ${section.label} section`,
  }));

  // Add a "generate with all sections" option
  excludeSuggestions.unshift({
    id: 'generate-full',
    label: `${config.emoji} Generate full ${config.label}`,
    action: `report:${reportType}`,
    icon: 'file-text',
    description: `Include all ${config.sections.length} sections`,
  });

  // Add option to customize a different report type
  excludeSuggestions.push({
    id: 'other-report-types',
    label: '⚙️ Customize different report',
    action: 'customize report sections',
    icon: 'settings',
    description: 'Choose a different report type',
  });

  return {
    response,
    suggestedActions: excludeSuggestions.slice(0, 5),
    mapCommands: undefined, // Customization doesn't need map commands
  };
}

// ============================================================================
// Scenario Modeling Handlers (Phase 8)
// ============================================================================

import { getScenarioEngine, type TurnoutScenario, type PersuasionScenario, type ResourceScenario } from './scenarioModeling';

/**
 * Handle "what if" scenario queries
 */
export async function handleScenarioQuery(
  scenarioParams: {
    scenarioType: 'turnout' | 'persuasion' | 'resource' | 'general';
    targetGroup?: string;
    change?: number;
    direction?: 'D' | 'R';
    precincts?: string[];
  }
): Promise<HandlerResult> {
  const engine = getScenarioEngine();
  const { scenarioType, targetGroup, change, direction, precincts } = scenarioParams;

  try {
    // If general request, show available scenarios
    if (scenarioType === 'general' || !targetGroup) {
      return getScenarioOverview(engine);
    }

    // Run specific scenario
    if (scenarioType === 'turnout') {
      const scenario: TurnoutScenario = {
        type: 'turnout',
        name: `${targetGroup} Turnout Change`,
        description: `Model ${change || 10} point turnout change for ${targetGroup}`,
        targetGroup: (targetGroup as TurnoutScenario['targetGroup']) || 'all',
        turnoutChange: change || 10,
        affectedPrecincts: precincts,
        assumptions: [],
      };

      const result = await engine.modelTurnoutScenario(scenario);
      return formatTurnoutResult(result);
    }

    if (scenarioType === 'persuasion') {
      const scenario: PersuasionScenario = {
        type: 'persuasion',
        name: `${targetGroup} Persuasion`,
        description: `Model persuading ${change || 5}% of ${targetGroup} toward ${direction || 'D'}`,
        targetGroup: (targetGroup as PersuasionScenario['targetGroup']) || 'independents',
        persuasionRate: change || 5,
        direction: direction || 'D',
        affectedPrecincts: precincts,
        assumptions: [],
      };

      const result = await engine.modelPersuasionScenario(scenario);
      return formatPersuasionResult(result);
    }

    if (scenarioType === 'resource') {
      const scenario: ResourceScenario = {
        type: 'resource',
        name: 'Resource Allocation',
        description: `Allocate ${change || 100} ${targetGroup || 'canvassers'} optimally`,
        resourceType: (targetGroup as ResourceScenario['resourceType']) || 'canvassers',
        totalResources: change || 100,
        allocationStrategy: 'gotv_priority',
        assumptions: [],
      };

      const result = await engine.modelResourceScenario(scenario);
      return formatResourceResult(result);
    }

    return getScenarioOverview(engine);
  } catch (error) {
    console.error('[ScenarioHandler] Error:', error);
    return {
      response: 'I encountered an error running that scenario. Please try again with different parameters.',
      suggestedActions: getScenarioSuggestions(),
    };
  }
}

function getScenarioOverview(engine: ReturnType<typeof getScenarioEngine>): HandlerResult {
  const presets = engine.getPresetScenarios();

  let response = `## 📊 Scenario Modeling\n\n`;
  response += `I can model "what if" scenarios to help you plan your campaign strategy. Here are some common scenarios:\n\n`;

  response += `### Turnout Scenarios\n`;
  response += `Model how changes in voter turnout affect election outcomes.\n`;
  response += `• "What if student turnout increases by 10%?"\n`;
  response += `• "What if low-propensity voters turn out at higher rates?"\n\n`;

  response += `### Persuasion Scenarios\n`;
  response += `Model the impact of persuading different voter groups.\n`;
  response += `• "What if we persuade 5% of independents?"\n`;
  response += `• "What if ticket-splitters consolidate for Democrats?"\n\n`;

  response += `### Resource Allocation\n`;
  response += `Optimize where to deploy campaign resources.\n`;
  response += `• "Where should we deploy 100 canvassers?"\n`;
  response += `• "How should we allocate our GOTV budget?"\n\n`;

  response += `_Select a preset scenario below or describe your own scenario._`;

  const suggestions: SuggestedAction[] = presets.slice(0, 4).map((preset, i) => ({
    id: `preset-${i}`,
    label: preset.name,
    action: `scenario:${preset.type}:${JSON.stringify({
      targetGroup: (preset as any).targetGroup,
      change: (preset as any).turnoutChange || (preset as any).persuasionRate,
      direction: (preset as any).direction,
    })}`,
    icon: preset.type === 'turnout' ? 'trending-up' : preset.type === 'persuasion' ? 'users' : 'map-pin',
    description: preset.description,
  }));

  suggestions.push({
    id: 'custom-scenario',
    label: 'Custom scenario',
    action: 'Help me create a custom campaign scenario',
    icon: 'settings',
    description: 'Describe your own what-if scenario',
  });

  return {
    response,
    suggestedActions: suggestions,
  };
}

function formatTurnoutResult(result: Awaited<ReturnType<ReturnType<typeof getScenarioEngine>['modelTurnoutScenario']>>): HandlerResult {
  const { scenario, baselineVotes, projectedVotes, netChange, marginChange, flippedPrecincts, keyInsights, confidence } = result;

  // Type guard - scenario is TurnoutScenario
  const turnoutScenario = scenario as TurnoutScenario;

  let response = `## 📊 Turnout Scenario: ${turnoutScenario.name}\n\n`;

  response += `### Scenario Parameters\n`;
  response += `• Target Group: ${turnoutScenario.targetGroup.replace(/_/g, ' ')}\n`;
  response += `• Turnout Change: ${turnoutScenario.turnoutChange > 0 ? '+' : ''}${turnoutScenario.turnoutChange} percentage points\n`;
  response += `• Confidence: ${confidence.toUpperCase()}\n\n`;

  response += `### Projected Impact\n`;
  response += `| Metric | Baseline | Projected | Change |\n`;
  response += `|--------|----------|-----------|--------|\n`;
  response += `| Dem Votes | ${baselineVotes.dem.toLocaleString()} | ${projectedVotes.dem.toLocaleString()} | ${(projectedVotes.dem - baselineVotes.dem > 0 ? '+' : '')}${(projectedVotes.dem - baselineVotes.dem).toLocaleString()} |\n`;
  response += `| Rep Votes | ${baselineVotes.rep.toLocaleString()} | ${projectedVotes.rep.toLocaleString()} | ${(projectedVotes.rep - baselineVotes.rep > 0 ? '+' : '')}${(projectedVotes.rep - baselineVotes.rep).toLocaleString()} |\n`;
  response += `| Margin | - | - | ${marginChange > 0 ? '+' : ''}${marginChange.toFixed(1)} pts |\n\n`;

  response += `### Key Insights\n`;
  keyInsights.forEach(insight => {
    response += `• ${insight}\n`;
  });

  if (flippedPrecincts.length > 0) {
    // Express scenario confidence based on result certainty
    const scenarioConfidence = confidence === 'high' ? 'high' as const :
                               confidence === 'medium' ? 'medium' as const : 'low' as const;

    const turnoutIncrease = Math.abs(turnoutScenario.turnoutChange);
    const flipInsight = expressConfidence(
      scenarioConfidence,
      `+${turnoutIncrease}% turnout would flip ${flippedPrecincts.length} precincts`,
      'Historical turnout patterns'
    );

    response += `\n### Precincts That Would Flip\n`;
    response += `${flipInsight}\n\n`;
    flippedPrecincts.slice(0, 5).forEach(p => {
      response += `• **${p.name}**: ${p.baselineMargin > 0 ? 'D' : 'R'}+${Math.abs(p.baselineMargin).toFixed(1)} → ${p.projectedMargin > 0 ? 'D' : 'R'}+${Math.abs(p.projectedMargin).toFixed(1)}\n`;
    });
    if (flippedPrecincts.length > 5) {
      response += `• _...and ${flippedPrecincts.length - 5} more_\n`;
    }
  }

  response += `\n_${result.methodology}_`;

  // Wave 6D.5: Check for cross-tool insights
  const donorGOTVCheck = checkDonorGOTVOverlap();
  if (donorGOTVCheck.hasOverlap) {
    response += `\n\n${donorGOTVCheck.insight}`;
  }

  const segmentCanvassCheck = checkSegmentCanvassOpportunity();
  if (segmentCanvassCheck.hasOpportunity && flippedPrecincts.length > 0) {
    response += `\n\n${segmentCanvassCheck.insight}`;
  }

  return {
    response,
    suggestedActions: [
      {
        id: 'try-different-turnout',
        label: 'Try different turnout %',
        action: `What if ${turnoutScenario.targetGroup} turnout changes by ${turnoutScenario.turnoutChange * 2}%?`,
        icon: 'refresh-cw',
      },
      {
        id: 'highlight-flipped',
        label: 'Highlight flipped precincts',
        action: 'map:highlight',
        icon: 'map-pin',
        metadata: { target: flippedPrecincts.map(p => p.name) },
      },
      {
        id: 'try-persuasion',
        label: 'Try persuasion scenario',
        action: 'scenario:persuasion:{"targetGroup":"independents","change":5,"direction":"D"}',
        icon: 'users',
      },
    ],
  };
}

function formatPersuasionResult(result: Awaited<ReturnType<ReturnType<typeof getScenarioEngine>['modelPersuasionScenario']>>): HandlerResult {
  const { scenario, baselineVotes, projectedVotes, netChange, marginChange, flippedPrecincts, keyInsights, confidence } = result;

  // Type guard - scenario is PersuasionScenario
  const persuasionScenario = scenario as PersuasionScenario;

  let response = `## 📊 Persuasion Scenario: ${persuasionScenario.name}\n\n`;

  response += `### Scenario Parameters\n`;
  response += `• Target Group: ${persuasionScenario.targetGroup.replace(/_/g, ' ')}\n`;
  response += `• Persuasion Rate: ${persuasionScenario.persuasionRate}%\n`;
  response += `• Direction: Toward ${persuasionScenario.direction === 'D' ? 'Democrats' : 'Republicans'}\n`;
  response += `• Confidence: ${confidence.toUpperCase()}\n\n`;

  response += `### Projected Impact\n`;
  const netLabel = netChange > 0 ? 'Dem' : 'Rep';
  response += `• Net Vote Change: **${netLabel} +${Math.abs(netChange).toLocaleString()}**\n`;
  response += `• Margin Shift: **${marginChange > 0 ? '+' : ''}${marginChange.toFixed(1)} points**\n\n`;

  response += `### Key Insights\n`;
  keyInsights.forEach(insight => {
    response += `• ${insight}\n`;
  });

  if (flippedPrecincts.length > 0) {
    response += `\n### Precincts That Would Flip (${flippedPrecincts.length})\n`;
    flippedPrecincts.slice(0, 5).forEach(p => {
      response += `• **${p.name}**: ${p.baselineMargin > 0 ? 'D' : 'R'}+${Math.abs(p.baselineMargin).toFixed(1)} → ${p.projectedMargin > 0 ? 'D' : 'R'}+${Math.abs(p.projectedMargin).toFixed(1)}\n`;
    });
  }

  // Wave 6D.5: Check for cross-tool insights
  const donorGOTVCheck = checkDonorGOTVOverlap();
  if (donorGOTVCheck.hasOverlap) {
    response += `\n\n${donorGOTVCheck.insight}`;
  }

  const segmentCanvassCheck = checkSegmentCanvassOpportunity();
  if (segmentCanvassCheck.hasOpportunity && flippedPrecincts.length > 0) {
    response += `\n\n${segmentCanvassCheck.insight}`;
  }

  return {
    response,
    suggestedActions: [
      {
        id: 'try-different-rate',
        label: 'Try 10% persuasion',
        action: `What if we persuade 10% of ${persuasionScenario.targetGroup}?`,
        icon: 'refresh-cw',
      },
      {
        id: 'highlight-swing',
        label: 'Show persuadable precincts',
        action: 'map:showHeatmap',
        icon: 'map',
        metadata: { metric: 'persuasion_opportunity' },
      },
      {
        id: 'try-turnout',
        label: 'Try turnout scenario',
        action: 'What if student turnout increases by 10%?',
        icon: 'trending-up',
      },
    ],
  };
}

function formatResourceResult(result: Awaited<ReturnType<ReturnType<typeof getScenarioEngine>['modelResourceScenario']>>): HandlerResult {
  const { allocations, totalExpectedImpact, insights } = result;

  let response = `## 📊 Resource Allocation Recommendation\n\n`;

  response += `### Expected Impact\n`;
  response += `• Total Additional Votes: **${totalExpectedImpact.toLocaleString()}**\n\n`;

  response += `### Key Insights\n`;
  insights.forEach(insight => {
    response += `• ${insight}\n`;
  });

  response += `\n### Top Allocation Targets\n`;
  response += `| Precinct | Allocation | Expected Impact | Rationale |\n`;
  response += `|----------|------------|-----------------|----------|\n`;
  allocations.slice(0, 10).forEach(a => {
    response += `| ${a.precinctName} | ${a.allocation} | +${a.expectedImpact} votes | ${a.rationale.substring(0, 40)}... |\n`;
  });

  // Wave 6D.5: Check for cross-tool insights
  const donorGOTVCheck = checkDonorGOTVOverlap();
  if (donorGOTVCheck.hasOverlap) {
    response += `\n\n${donorGOTVCheck.insight}`;
  }

  const segmentCanvassCheck = checkSegmentCanvassOpportunity();
  if (segmentCanvassCheck.hasOpportunity) {
    response += `\n\n${segmentCanvassCheck.insight}`;
  }

  return {
    response,
    suggestedActions: [
      {
        id: 'highlight-targets',
        label: 'Highlight target precincts',
        action: 'map:highlight',
        icon: 'map-pin',
        metadata: { target: allocations.slice(0, 10).map(a => a.precinctName) },
      },
      {
        id: 'gotv-heatmap',
        label: 'Show GOTV priority heatmap',
        action: 'map:showHeatmap',
        icon: 'map',
        metadata: { metric: 'gotv_priority' },
      },
      {
        id: 'plan-canvassing',
        label: 'Create canvassing plan',
        action: 'navigate:canvass',
        icon: 'route',
        metadata: { precincts: allocations.slice(0, 10).map(a => a.precinctName) },
      },
    ],
  };
}

function getScenarioSuggestions(): SuggestedAction[] {
  return [
    {
      id: 'student-turnout',
      label: 'Student turnout +10%',
      action: 'What if student turnout increases by 10%?',
      icon: 'trending-up',
    },
    {
      id: 'persuade-independents',
      label: 'Persuade 5% of independents',
      action: 'What if we persuade 5% of independents?',
      icon: 'users',
    },
    {
      id: 'deploy-canvassers',
      label: 'Deploy 100 canvassers',
      action: 'Where should we deploy 100 canvassers?',
      icon: 'map-pin',
    },
  ];
}

// ============================================================================
// Spatial Analysis Handler (Principle 16)
// ============================================================================

interface SpatialPrecinctInput {
  precinctId: string;
  precinctName: string;
  jurisdiction: string;
  centroid: [number, number];
  estimatedDoors: number;
  density: 'urban' | 'suburban' | 'rural';
  gotvPriority: number;
  persuasionOpportunity: number;
  swingPotential: number;
}

/**
 * Handle spatial analysis of selected precincts
 * Implements Principle 16: Spatial Reasoning
 */
export async function handleSpatialAnalysis(
  precincts: PrecinctData[]
): Promise<HandlerResult> {
  if (precincts.length < 2) {
    return {
      response: 'Select at least 2 precincts to analyze their spatial characteristics.',
      suggestedActions: [
        {
          id: 'explore-map',
          label: 'Explore the map',
          action: 'Click precincts to select them',
          icon: 'map',
        },
      ],
    };
  }

  // Convert to spatial input format
  // Handle both nested (local interface) and flat snake_case (API) formats
  const spatialInputs: SpatialPrecinctInput[] = precincts.map(p => {
    const jurisdiction = typeof p.jurisdiction === 'string'
      ? p.jurisdiction
      : ((p.jurisdiction as { name?: string })?.name || 'Unknown');

    // Get voter/population count - use demographics for nested, registered_voters for flat
    const voterCount = p.demographics?.population18up ||
                       p.demographics?.totalPopulation ||
                       (p as unknown as { registered_voters?: number }).registered_voters ||
                       0;

    return {
      precinctId: p.id || p.name,
      precinctName: p.name,
      jurisdiction,
      centroid: getPrecinctCentroid(p.id || p.name, jurisdiction),
      estimatedDoors: voterCount ? Math.round(voterCount * 0.4) : 50,
      density: inferDensity(p),
      gotvPriority: p.targeting?.gotvPriority ||
                    (p.targeting as unknown as { gotv_priority?: number })?.gotv_priority || 50,
      persuasionOpportunity: p.targeting?.persuasionOpportunity ||
                             (p.targeting as unknown as { persuasion_opportunity?: number })?.persuasion_opportunity || 50,
      swingPotential: p.electoral?.swingPotential ||
                      (p.electoral as unknown as { swing_potential?: number })?.swing_potential || 50,
    };
  });

  const engine = getSpatialReasoningEngine();
  const analysis = engine.analyze(spatialInputs);

  // Build response
  const { summary, clusters, outliers, efficiency, suggestions, nearbyOpportunities } = analysis;

  let response = `## Spatial Analysis: ${precincts.length} Precincts\n\n`;

  // Quick stats
  response += `**Overview**: ${summary.quickStats.totalDoors.toLocaleString()} estimated doors, `;
  response += `${summary.quickStats.estimatedHours.toFixed(1)} hours of canvassing, `;
  response += `${summary.quickStats.doorsPerHour.toFixed(1)} doors/hour efficiency\n\n`;

  // Cluster analysis
  response += `### Geographic Clusters\n`;
  response += summary.clusterDescription + '\n\n';

  if (clusters.length > 0) {
    response += `| Cluster | Precincts | Doors | Hours | GOTV Avg |\n`;
    response += `|---------|-----------|-------|-------|----------|\n`;
    clusters.forEach(c => {
      response += `| ${c.name} | ${c.metrics.totalPrecincts} | ${c.metrics.totalDoors} | ${c.metrics.estimatedHours.toFixed(1)}h | ${c.metrics.avgGotvPriority.toFixed(0)} |\n`;
    });
    response += '\n';
  }

  // Outliers
  if (outliers.length > 0) {
    response += `### Outliers\n`;
    response += summary.outlierDescription + '\n\n';

    outliers.forEach(o => {
      const icon = o.impactAnalysis.recommendation === 'drop' ? '⚠️' : '✅';
      response += `${icon} **${o.precinctName}**: ${o.reason} - ${o.distanceToNearestCluster.toFixed(1)}km from nearest cluster\n`;
      if (o.impactAnalysis.recommendation === 'drop') {
        response += `   → Adds ${o.impactAnalysis.additionalTravelMinutes.toFixed(0)} min travel for ${o.impactAnalysis.additionalDoors} doors (efficiency: ${o.impactAnalysis.efficiencyDelta.toFixed(1)} doors/hr delta)\n`;
      }
    });
    response += '\n';
  }

  // Efficiency comparison
  if (summary.quickStats.potentialImprovement > 5) {
    response += `### Optimization Opportunity\n`;
    response += `Current efficiency: **${efficiency.asSelected.doorsPerHour.toFixed(1)}** doors/hour\n`;
    response += `Optimized (without outliers): **${efficiency.optimized.doorsPerHour.toFixed(1)}** doors/hour\n`;
    response += `**+${summary.quickStats.potentialImprovement.toFixed(0)}%** improvement possible\n\n`;
  }

  // Nearby opportunities
  if (nearbyOpportunities.length > 0) {
    response += `### Nearby Precincts to Consider\n`;
    const top3 = nearbyOpportunities.slice(0, 3);
    top3.forEach(n => {
      const connector = n.wouldConnectClusters ? ' (connects clusters!)' : '';
      response += `• **${n.precinctName}**: ${n.metrics.doors} doors, ${n.distanceToNearestSelected.toFixed(1)}km away, GOTV ${n.metrics.gotvPriority}${connector}\n`;
    });
    response += '\n';
  }

  // Top recommendation
  response += `### Recommendation\n`;
  response += summary.topRecommendation;

  // Build map commands
  const mapCommands: MapCommand[] = [];

  // Highlight all selected precincts
  mapCommands.push({
    type: 'highlight',
    target: precincts.map(p => p.id || p.name),
  });

  // If multiple clusters, show cluster visualization
  if (clusters.length >= 2) {
    mapCommands.push({
      type: 'showClusters',
      clusters: clusters.map((c, i) => ({
        id: c.id,
        precinctIds: c.precinctIds,
        color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
      })),
    });
  }

  // Build suggested actions from spatial suggestions
  const suggestedActions: SuggestedAction[] = [];

  // Add spatial suggestions
  suggestions.slice(0, 3).forEach(s => {
    suggestedActions.push({
      id: s.id,
      label: s.title,
      action: buildSpatialAction(s),
      icon: getSpatialIcon(s.type),
      metadata: {
        type: s.type,
        impact: s.impact,
      },
    });
  });

  // Always add route visualization
  suggestedActions.push({
    id: 'show-route',
    label: 'Show optimized route',
    action: 'map:showOptimizedRoute',
    icon: 'route',
    metadata: {
      precinctIds: precincts.map(p => p.id || p.name),
      totalDoors: summary.quickStats.totalDoors,
      estimatedHours: summary.quickStats.estimatedHours,
    },
  });

  // Add canvassing plan action
  suggestedActions.push({
    id: 'plan-canvass',
    label: 'Create canvassing plan',
    action: 'navigate:canvass',
    icon: 'clipboard-list',
    metadata: {
      precinctIds: precincts.map(p => p.id || p.name),
    },
  });

  return {
    response,
    mapCommands,
    suggestedActions,
  };
}

// Cluster colors for visualization
const CLUSTER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
];

/**
 * Get approximate centroid for a precinct based on jurisdiction
 */
function getPrecinctCentroid(precinctId: string, jurisdiction: string): [number, number] {
  const JURISDICTION_CENTERS: Record<string, [number, number]> = {
    'East Lansing': [-84.4839, 42.7369],
    'Lansing': [-84.5555, 42.7337],
    'Meridian Township': [-84.4100, 42.7100],
    'Delhi Township': [-84.5800, 42.6500],
    'Williamston': [-84.2830, 42.6890],
    'Unknown': [-84.55, 42.73],
  };

  const baseCenter = JURISDICTION_CENTERS[jurisdiction] || JURISDICTION_CENTERS['Unknown'];
  const hash = precinctId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const offsetLng = ((hash % 100) - 50) / 5000;
  const offsetLat = (((hash * 7) % 100) - 50) / 5000;

  return [baseCenter[0] + offsetLng, baseCenter[1] + offsetLat];
}

/**
 * Infer density from precinct data
 */
function inferDensity(precinct: PrecinctData): 'urban' | 'suburban' | 'rural' {
  // Try to get population density from demographics
  // Handle both camelCase (local interface) and snake_case (API) formats
  const popDensity = precinct.demographics?.populationDensity ||
                     (precinct.demographics as unknown as { population_density?: number })?.population_density || 0;

  if (popDensity > 3000) return 'urban';
  if (popDensity > 1000) return 'suburban';
  if (popDensity > 0) return 'rural';

  // Fallback to heuristics based on name and voter count
  const voters = (precinct as unknown as { registered_voters?: number }).registered_voters ||
                 precinct.demographics?.population18up || 0;
  const name = (precinct.name || '').toLowerCase();

  if (name.includes('lansing') && !name.includes('township')) {
    return 'urban';
  }
  if (voters > 3000) {
    return 'urban';
  }
  if (name.includes('township') || name.includes('twp')) {
    if (voters < 1500) {
      return 'rural';
    }
  }

  return 'suburban';
}

/**
 * Build action string for spatial suggestion
 */
function buildSpatialAction(suggestion: { type: string; action: { type: string; precinctIds?: string[]; clusterIds?: string[] } }): string {
  switch (suggestion.type) {
    case 'drop_outlier':
      return `spatial:removePrecincts:${JSON.stringify(suggestion.action.precinctIds)}`;
    case 'add_connector':
    case 'add_nearby':
      return `spatial:addPrecincts:${JSON.stringify(suggestion.action.precinctIds)}`;
    case 'split_clusters':
      return `spatial:splitClusters:${JSON.stringify(suggestion.action.clusterIds)}`;
    case 'merge_clusters':
      return `spatial:mergeClusters:${JSON.stringify(suggestion.action.clusterIds)}`;
    default:
      return 'dismiss';
  }
}

/**
 * Get icon for spatial suggestion type
 */
function getSpatialIcon(type: string): string {
  switch (type) {
    case 'drop_outlier':
      return 'x-circle';
    case 'add_connector':
      return 'link';
    case 'add_nearby':
      return 'plus-circle';
    case 'split_clusters':
      return 'scissors';
    case 'merge_clusters':
      return 'git-merge';
    case 'reorder_route':
      return 'route';
    default:
      return 'map-pin';
  }
}

// ============================================================================
// Serendipitous Insight Handlers (Phase 13)
// ============================================================================

/**
 * Handle a serendipitous insight for display in the AI chat
 */
export async function handleSerendipitousInsight(insight: Insight): Promise<HandlerResult> {
  // Frame the message with "Did you know..." style
  const framedMessage = frameAsDiscovery({
    title: insight.title,
    message: insight.message,
  });

  // Build suggested actions from insight actions
  const suggestedActions: SuggestedAction[] = insight.suggestedActions.map((action, index) => ({
    id: action.id || `insight-action-${index}`,
    label: action.label,
    action: action.action,
    icon: getInsightIcon(insight.category),
    metadata: action.metadata,
  }));

  // Add follow-up questions as suggestions
  const followUps = getFollowUpQuestions(insight.category);
  if (followUps.length > 0) {
    suggestedActions.push({
      id: 'insight-followup-0',
      label: 'Tell me more',
      action: followUps[0],
      icon: 'help-circle',
    });
  }

  // Add actionable recommendations
  const recommendations = getActionableRecommendations(insight.category);
  if (recommendations.length > 0) {
    const topRec = recommendations[0];
    suggestedActions.push({
      id: 'insight-recommendation',
      label: topRec.action,
      action: topRec.action,
      icon: 'lightbulb',
      metadata: {
        impact: topRec.impact,
        effort: topRec.effort,
      },
    });
  }

  // Add dismiss option
  suggestedActions.push({
    id: `dismiss-insight-${insight.category}`,
    label: "Don't show insights like this",
    action: `dismiss_insight_category:${insight.category}`,
    icon: 'x',
  });

  // Build map commands based on insight type
  const mapCommands: MapCommand[] = [];

  if (insight.relatedPrecincts && insight.relatedPrecincts.length > 0) {
    mapCommands.push({
      type: 'highlight',
      target: insight.relatedPrecincts.slice(0, 10),
    });
  }

  // Add visualization based on insight category
  switch (insight.category) {
    case 'donor_gotv_overlap':
      mapCommands.push({
        type: 'showHeatmap',
        metric: 'gotv_priority',
      });
      break;
    case 'geographic_cluster':
      if (insight.relatedPrecincts) {
        mapCommands.push({
          type: 'flyTo',
          center: [-84.55, 42.73], // Ingham County center as fallback
          zoomLevel: 11,
        });
      }
      break;
    case 'tapestry_turnout':
    case 'demographic_swing':
      mapCommands.push({
        type: 'showChoropleth',
        metric: 'swing_potential',
      });
      break;
  }

  // Limit to 4 suggested actions
  return {
    response: framedMessage,
    mapCommands,
    suggestedActions: suggestedActions.slice(0, 4),
  };
}

/**
 * Check for and surface any relevant serendipitous insights
 * Call this after major user actions (selection, filter, navigation)
 */
export async function checkAndSurfaceInsights(
  trigger: 'precinct_selection' | 'filter_applied' | 'segment_created' | 'tool_navigation' | 'exploration_milestone'
): Promise<HandlerResult | null> {
  try {
    const stateManager = getStateManager();
    const explorationDepth = stateManager.getExplorationDepth();

    // Only check for insights after sufficient exploration
    if (explorationDepth < 20) {
      return null;
    }

    const insightEngine = getInsightEngine();
    const result = await insightEngine.checkForInsights({
      trigger,
      minExplorationDepth: explorationDepth,
    });

    if (result.hasInsight && result.insights.length > 0) {
      // Return the highest priority insight
      const topInsight = result.insights.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      })[0];

      return handleSerendipitousInsight(topInsight);
    }

    return null;
  } catch (error) {
    console.error('[handleInsight] Error checking for insights:', error);
    return null;
  }
}

/**
 * Get icon for insight category
 */
function getInsightIcon(category: InsightCategory): string {
  switch (category) {
    case 'donor_gotv_overlap':
      return 'dollar-sign';
    case 'tapestry_turnout':
      return 'bar-chart';
    case 'demographic_swing':
      return 'trending-up';
    case 'geographic_cluster':
      return 'map-pin';
    case 'temporal_anomaly':
      return 'clock';
    case 'cross_tool_connection':
      return 'link';
    default:
      return 'lightbulb';
  }
}

/**
 * Dismiss an insight category (user clicked "don't show again")
 */
export function dismissInsightCategory(category: string): void {
  const insightEngine = getInsightEngine();
  insightEngine.disableCategory(category as InsightCategory);
}

/**
 * Record engagement with an insight (user clicked on suggestion)
 */
export function recordInsightEngagement(insightId: string): void {
  const insightEngine = getInsightEngine();
  insightEngine.recordInsightClick(insightId);
}

// ============================================================================
// Donor Analysis Handlers
// ============================================================================

/**
 * Format currency values
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  } else {
    return `$${amount.toFixed(0)}`;
  }
}

/**
 * Handle donor-related queries
 */
export async function handleDonorQuery(
  intentType: string,
  params?: {
    minValue?: number;
    priority?: string;
    zip?: string;
    minScore?: number;
  }
): Promise<HandlerResult> {
  try {
    // Load donor data files
    const zipAggregatesResponse = await fetch('/data/donors/zip-aggregates.json');
    const lapsedDonorsResponse = await fetch('/data/donors/lapsed-donors.json');
    const upgradeProspectsResponse = await fetch('/data/donors/upgrade-prospects.json');

    if (!zipAggregatesResponse.ok) {
      throw new Error('Failed to load donor data');
    }

    const zipAggregates = await zipAggregatesResponse.json();

    let response = '';
    const mapCommands: MapCommand[] = [];
    const suggestedActions: SuggestedAction[] = [];

    switch (intentType) {
      case 'donor_overview':
      case 'donor_geographic': {
        // Sort ZIP codes by total donation amount
        const topZips = zipAggregates
          .sort((a: any, b: any) => b.totalAmount - a.totalAmount)
          .slice(0, 5);

        const totalDonations = topZips.reduce((sum: number, z: any) => sum + z.totalAmount, 0);
        const totalDonors = topZips.reduce((sum: number, z: any) => sum + z.donorCount, 0);

        response = `**Top Donor ZIP Codes in Ingham County**\n\n`;

        topZips.forEach((zip: any, index: number) => {
          const pct = ((zip.totalAmount / totalDonations) * 100).toFixed(1);
          response += `${index + 1}. **${zip.zipCode} (${zip.city})** - ${formatCurrency(zip.totalAmount)} from ${zip.donorCount.toLocaleString()} donors (${pct}%)\n`;
        });

        const topThreeTotal = topZips.slice(0, 3).reduce((sum: number, z: any) => sum + z.totalAmount, 0);
        const topThreePct = ((topThreeTotal / totalDonations) * 100).toFixed(0);

        response += `\n💰 These top 3 ZIPs account for ${topThreePct}% of donations from the top 5 areas.\n`;
        response += `\n📊 Total: ${formatCurrency(totalDonations)} from ${totalDonors.toLocaleString()} donors`;

        // Wave 6D.5: Check for donor-GOTV cross-tool serendipity
        const donorGOTVCheck = checkDonorGOTVOverlap();
        if (donorGOTVCheck.hasOverlap) {
          response += `\n\n${donorGOTVCheck.insight}`;
        }

        // Wave 6D.2: Add citations
        response = addCitationsToResponse(response, ['FEC', 'DONOR_ANALYSIS']);

        // Log top ZIPs for cross-tool tracking
        const stateManager = getStateManager();
        stateManager.logExploration({
          tool: 'donors',
          action: 'donor_overview',
          metadata: { topZips: topZips.map((z: any) => z.zipCode) }
        });

        // Map command to show donor heatmap
        mapCommands.push({
          type: 'showProportional',
          proportionalPreset: 'donor_concentration'
        });

        // Suggested actions
        suggestedActions.push(
          {
            id: 'show-lapsed',
            label: 'Find lapsed donors',
            action: 'Show me lapsed donors to reactivate',
            icon: 'user-x'
          },
          {
            id: 'show-upgrade',
            label: 'Find upgrade prospects',
            action: 'Who are the best upgrade prospects?',
            icon: 'trending-up'
          },
          {
            id: 'donor-momentum',
            label: 'Show donation momentum',
            action: 'Show donation momentum over time',
            icon: 'activity'
          }
        );
        break;
      }

      case 'donor_lapsed':
      case 'donor_lapsed_clusters': {
        if (!lapsedDonorsResponse.ok) {
          response = 'Lapsed donor data is currently unavailable.';
          break;
        }

        const lapsedData = await lapsedDonorsResponse.json();
        const { metadata, donors } = lapsedData;

        // Get high priority lapsed donors
        const highPriority = donors
          .filter((d: any) => d.priority === 'high')
          .sort((a: any, b: any) => b.recoveryScore - a.recoveryScore)
          .slice(0, 5);

        response = `**Lapsed Donor Recovery Opportunities**\n\n`;
        response += `📊 **Overview**: ${metadata.totalLapsed} lapsed donors with ${formatCurrency(metadata.totalHistoricalValue)} in past giving\n`;
        response += `💰 **Recovery Potential**: ${formatCurrency(metadata.estimatedRecoveryValue)} estimated recoverable value\n\n`;
        response += `**Top 5 High-Priority Recovery Targets**:\n\n`;

        highPriority.forEach((donor: any, index: number) => {
          response += `${index + 1}. **${donor.city}** (${donor.zipCode}) - Recovery Score: ${donor.recoveryScore}\n`;
          response += `   - Past giving: ${formatCurrency(donor.totalHistoricalAmount)} (${donor.giftCount} gifts)\n`;
          response += `   - Last gift: ${donor.lastGiftAmount > 100 ? formatCurrency(donor.lastGiftAmount) : `$${donor.lastGiftAmount}`} (${donor.monthsSinceLastGift} months ago)\n`;
          response += `   - Recommended: ${donor.recommendedChannel} outreach\n\n`;
        });

        response += `\n💡 Average recovery score: ${metadata.avgRecoveryScore.toFixed(0)}/100`;

        // Add filter command to switch to lapsed tab (using filter type to pass tab switch data)
        mapCommands.push({
          type: 'filter',
          data: { switchTab: 'lapsed', targetLayer: 'donors' },
        });

        // Suggested actions
        suggestedActions.push(
          {
            id: 'export-lapsed',
            label: 'Export lapsed list',
            action: 'output:exportCSV',
            icon: 'download'
          },
          {
            id: 'show-by-zip',
            label: 'Group by ZIP code',
            action: 'Show lapsed donors grouped by ZIP',
            icon: 'map-pin'
          },
          {
            id: 'reactivation-plan',
            label: 'Create reactivation plan',
            action: 'Create a donor reactivation campaign plan',
            icon: 'mail'
          }
        );
        break;
      }

      case 'donor_upgrade':
      case 'donor_upgrade_top': {
        if (!upgradeProspectsResponse.ok) {
          response = 'Upgrade prospect data is currently unavailable.';
          break;
        }

        const upgradeData = await upgradeProspectsResponse.json();
        const { metadata, prospects } = upgradeData;

        // Get top upgrade prospects
        const topProspects = prospects
          .filter((p: any) => p.upgradeScore >= 60)
          .sort((a: any, b: any) => b.upgradeScore - a.upgradeScore)
          .slice(0, 5);

        response = `**Donor Upgrade Opportunities**\n\n`;
        response += `📊 **Portfolio**: ${metadata.totalDonors.toLocaleString()} active donors giving ${formatCurrency(metadata.totalCurrentGiving)}\n`;
        response += `📈 **Upgrade Potential**: ${formatCurrency(metadata.totalUpgradeGap)} in untapped capacity\n\n`;
        response += `**Top 5 Upgrade Prospects** (Score ≥60):\n\n`;

        topProspects.forEach((prospect: any, index: number) => {
          const utilizationPct = (prospect.currentUtilization * 100).toFixed(0);
          response += `${index + 1}. **${prospect.city}** (${prospect.zipCode}) - Upgrade Score: ${prospect.upgradeScore}\n`;
          response += `   - Current giving: ${formatCurrency(prospect.currentTotalGiven)} (${utilizationPct}% of capacity)\n`;
          response += `   - Upgrade gap: ${formatCurrency(prospect.upgradeGap)}\n`;
          response += `   - Recommended ask: ${formatCurrency(prospect.recommendedAsk)} via ${prospect.recommendedChannel}\n`;
          response += `   - Rationale: ${prospect.askRationale}\n\n`;
        });

        response += `\n💡 Average upgrade score across all prospects: ${metadata.avgUpgradeScore}/100`;

        // Add filter command to switch to upgrade tab (using filter type to pass tab switch data)
        mapCommands.push({
          type: 'filter',
          data: { switchTab: 'upgrade', targetLayer: 'donors' },
        });

        // Suggested actions
        suggestedActions.push(
          {
            id: 'export-prospects',
            label: 'Export prospect list',
            action: 'output:exportCSV',
            icon: 'download'
          },
          {
            id: 'upgrade-campaign',
            label: 'Plan upgrade campaign',
            action: 'Create a donor upgrade campaign strategy',
            icon: 'target'
          },
          {
            id: 'capacity-analysis',
            label: 'Analyze capacity by ZIP',
            action: 'Show donor capacity analysis by ZIP code',
            icon: 'bar-chart'
          }
        );
        break;
      }

      case 'donor_momentum': {
        try {
          // Fetch time-series data
          const timeSeriesResponse = await fetch('/data/donors/time-series.json');
          if (!timeSeriesResponse.ok) {
            throw new Error('Failed to fetch time-series data');
          }
          const timeSeriesData = await timeSeriesResponse.json();
          const monthlyData = timeSeriesData.monthlyTotals || [];

          if (monthlyData.length === 0) {
            response = `**Donor Momentum Analysis**\n\nNo time-series data available yet.`;
            break;
          }

          // Sort by month to ensure chronological order
          monthlyData.sort((a: any, b: any) => a.month.localeCompare(b.month));

          // Calculate last 12 months metrics
          const last12Months = monthlyData.slice(-12);
          const prior12Months = monthlyData.slice(-24, -12);

          const last12Total = last12Months.reduce((sum: number, m: any) => sum + m.totalAmount, 0);
          const last12Count = last12Months.reduce((sum: number, m: any) => sum + m.contributionCount, 0);
          const last12NewDonors = last12Months.reduce((sum: number, m: any) => sum + (m.newDonorCount || 0), 0);
          const last12ReturningDonors = last12Months.reduce((sum: number, m: any) => sum + (m.returningDonorCount || 0), 0);

          const prior12Total = prior12Months.length > 0
            ? prior12Months.reduce((sum: number, m: any) => sum + m.totalAmount, 0)
            : 0;

          const avgContribution = last12Count > 0 ? last12Total / last12Count : 0;
          const yoyChange = prior12Total > 0 ? ((last12Total - prior12Total) / prior12Total) * 100 : 0;

          // Find peak months (top 3)
          const sortedByAmount = [...last12Months].sort((a: any, b: any) => b.totalAmount - a.totalAmount);
          const peakMonths = sortedByAmount.slice(0, 3);

          // Determine trend direction
          let trendDirection = 'stable';
          let trendEmoji = '➡️';
          if (yoyChange > 10) {
            trendDirection = 'increasing';
            trendEmoji = '📈';
          } else if (yoyChange < -10) {
            trendDirection = 'decreasing';
            trendEmoji = '📉';
          }

          // Format response
          response = `**Donor Momentum Analysis**\n\n`;
          response += `${trendEmoji} **Trend**: Donations are ${yoyChange >= 0 ? 'UP' : 'DOWN'} ${Math.abs(yoyChange).toFixed(1)}% year-over-year\n\n`;

          response += `**Last 12 Months**:\n`;
          response += `- Total raised: ${formatCurrency(last12Total)}\n`;
          response += `- Contributions: ${last12Count.toLocaleString()}\n`;
          response += `- Avg gift: ${formatCurrency(Math.round(avgContribution))}\n\n`;

          if (prior12Months.length > 0) {
            response += `**Compared to Prior Period**:\n`;
            response += `- Previous 12 months: ${formatCurrency(prior12Total)}\n`;
            response += `- Change: ${yoyChange >= 0 ? '+' : ''}${formatCurrency(Math.abs(last12Total - prior12Total))} (${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%)\n\n`;
          }

          response += `**Peak Months**:\n`;
          peakMonths.forEach((m: any, i: number) => {
            const monthName = new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            response += `${i + 1}. ${monthName}: ${formatCurrency(m.totalAmount)}\n`;
          });

          response += `\n**Donor Composition**:\n`;
          const totalDonorActivity = last12NewDonors + last12ReturningDonors;
          if (totalDonorActivity > 0) {
            const newPct = ((last12NewDonors / totalDonorActivity) * 100).toFixed(0);
            const returningPct = ((last12ReturningDonors / totalDonorActivity) * 100).toFixed(0);
            response += `- New donors: ${newPct}% of activity\n`;
            response += `- Returning donors: ${returningPct}% of activity`;
          } else {
            response += `- Donor composition data not available`;
          }

          // Add map command for donor concentration visualization
          mapCommands.push({
            type: 'showTemporal',
            metric: 'donor_amount',
            years: [2020, 2022, 2024],
            autoPlay: false,
          });

          // Add suggested actions
          suggestedActions.push(
            {
              id: 'show-concentration',
              label: 'Show donor concentration',
              action: 'Where are donors concentrated?',
              icon: 'map'
            },
            {
              id: 'find-lapsed',
              label: 'Find lapsed donors',
              action: 'Show me lapsed donors to reactivate',
              icon: 'user-x'
            },
            {
              id: 'peak-analysis',
              label: 'Analyze peak months',
              action: `What drove donations in ${new Date(peakMonths[0].month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}?`,
              icon: 'trending-up'
            }
          );

        } catch (error) {
          console.error('Error in donor_momentum handler:', error);
          response = `**Donor Momentum Analysis**\n\nUnable to load time-series data. Please try again.`;
        }
        break;
      }

      case 'donor_ie':
      case 'donor_ie_spending': {
        try {
          const ieResponse = await fetch('/data/donors/independent-expenditures.json');
          if (!ieResponse.ok) {
            response = `**Independent Expenditures**\n\nIE spending data is currently unavailable. This data tracks outside spending by PACs and other groups.\n\nTry exploring other donor data in the meantime.`;
            suggestedActions.push(
              { id: 'donor-concentration', label: 'View donor concentration', action: 'Where are donors concentrated?', icon: 'map' },
              { id: 'donor-trends', label: 'View donation trends', action: 'Show donation momentum over time', icon: 'trending-up' }
            );
            break;
          }

          const ieData = await ieResponse.json();
          const totalSpending = ieData.spending?.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) || 0;
          const topCommittees = ieData.spending?.slice(0, 5) || [];

          response = `**Independent Expenditures Analysis**\n\n`;
          response += `Total IE Spending: ${formatCurrency(totalSpending)}\n\n`;

          if (topCommittees.length > 0) {
            response += `**Top Spenders:**\n`;
            topCommittees.forEach((c: any, i: number) => {
              response += `${i + 1}. ${c.committee_name || 'Unknown'}: ${formatCurrency(c.amount || 0)}\n`;
            });
          }

          response += `\n💡 IE spending can indicate competitive races and third-party interest in your district.`;

          suggestedActions.push(
            { id: 'compare-to-direct', label: 'Compare to direct donations', action: 'How does IE spending compare to direct contributions?', icon: 'git-compare' },
            { id: 'ie-by-race', label: 'IE spending by race', action: 'Show IE spending by race type', icon: 'bar-chart' }
          );
        } catch (error) {
          console.error('Error in donor_ie handler:', error);
          response = `**Independent Expenditures**\n\nUnable to load IE data. Please try again.`;
        }
        break;
      }

      case 'donor_comparison': {
        // Compare donor metrics between areas or time periods
        response = `**Donor Comparison Analysis**\n\n`;
        response += `I can compare donor metrics across:\n`;
        response += `- ZIP codes (donor concentration, avg gift size)\n`;
        response += `- Time periods (YoY changes, seasonal patterns)\n`;
        response += `- Donor segments (Champions vs At-Risk)\n\n`;
        response += `What would you like to compare?`;

        suggestedActions.push(
          { id: 'compare-top-zips', label: 'Compare top ZIP codes', action: 'Compare the top 3 donor ZIP codes', icon: 'git-compare' },
          { id: 'compare-yoy', label: 'Year-over-year comparison', action: 'Compare this year to last year', icon: 'calendar' },
          { id: 'compare-segments', label: 'Compare donor segments', action: 'Compare Champion donors to At-Risk donors', icon: 'users' }
        );

        mapCommands.push({
          type: 'showChoropleth',
        });
        break;
      }

      case 'donor_by_candidate': {
        try {
          const candidatesResponse = await fetch('/data/donors/mi-candidates.json');
          if (!candidatesResponse.ok) {
            response = `**Donations by Candidate**\n\nCandidate-level donation data is currently unavailable.\n\nTry exploring aggregate donor data in the meantime.`;
            suggestedActions.push(
              { id: 'donor-concentration', label: 'View donor concentration', action: 'Where are donors concentrated?', icon: 'map' }
            );
            break;
          }

          const candidateData = await candidatesResponse.json();
          const candidates = candidateData.candidates || [];

          response = `**Donations by Candidate**\n\n`;

          if (candidates.length > 0) {
            response += `**Top Recipients:**\n`;
            const topCandidates = candidates.slice(0, 8);
            topCandidates.forEach((c: any, i: number) => {
              const party = c.party === 'D' ? '(D)' : c.party === 'R' ? '(R)' : '';
              response += `${i + 1}. **${c.name}** ${party} - ${formatCurrency(c.totalRaised || 0)}\n`;
            });

            response += `\n💡 Tip: Candidate fundraising success often correlates with voter enthusiasm.`;
          } else {
            response += `No candidate data available for this cycle.`;
          }

          suggestedActions.push(
            { id: 'filter-by-party', label: 'Filter by party', action: 'Show only Democratic candidates', icon: 'filter' },
            { id: 'filter-by-office', label: 'Filter by office', action: 'Show state legislative candidates', icon: 'landmark' },
            { id: 'compare-candidates', label: 'Compare candidates', action: 'Compare the top two candidates', icon: 'git-compare' }
          );
        } catch (error) {
          console.error('Error in donor_by_candidate handler:', error);
          response = `**Donations by Candidate**\n\nUnable to load candidate data. Please try again.`;
        }
        break;
      }

      case 'donor_committee': {
        try {
          const candidatesResponse = await fetch('/data/donors/mi-candidates.json');
          if (!candidatesResponse.ok) {
            response = `**Committee Analysis**\n\nCommittee data is currently unavailable.`;
            break;
          }

          const data = await candidatesResponse.json();
          const committees = data.committees || data.candidates || [];

          response = `**Committee Analysis**\n\n`;
          response += `Tracking ${committees.length} active committees in Ingham County.\n\n`;

          if (committees.length > 0) {
            const topByTotal = [...committees].sort((a: any, b: any) => (b.totalRaised || 0) - (a.totalRaised || 0)).slice(0, 5);
            response += `**Top Committees by Total Raised:**\n`;
            topByTotal.forEach((c: any, i: number) => {
              response += `${i + 1}. ${c.name}: ${formatCurrency(c.totalRaised || 0)}\n`;
            });
          }

          suggestedActions.push(
            { id: 'committee-trends', label: 'Committee trends', action: 'Show committee fundraising trends', icon: 'trending-up' },
            { id: 'pac-spending', label: 'PAC spending', action: 'Show PAC expenditures', icon: 'dollar-sign' }
          );
        } catch (error) {
          console.error('Error in donor_committee handler:', error);
          response = `**Committee Analysis**\n\nUnable to load committee data. Please try again.`;
        }
        break;
      }

      default: {
        response = `I can help with donor analysis. Try asking:\n\n`;
        response += `- "Where are donors concentrated?"\n`;
        response += `- "Show me lapsed donors to reactivate"\n`;
        response += `- "Who are the best upgrade prospects?"\n`;
        response += `- "Show donation momentum over time"\n`;
        response += `- "Show IE spending"\n`;
        response += `- "Show donations by candidate"`;
      }
    }

    return {
      response,
      mapCommands,
      suggestedActions,
    };

  } catch (error) {
    console.error('[handleDonorQuery] Error:', error);
    return {
      response: 'Sorry, I encountered an error loading donor data. Please try again.',
      suggestedActions: [
        {
          id: 'retry',
          label: 'Try again',
          action: 'Where are donors concentrated?',
          icon: 'refresh-cw'
        }
      ]
    };
  }
}

// ============================================================================
// Canvassing Handlers (P2-3)
// ============================================================================

/**
 * Handle canvassing queries - plan operations, estimate staffing, optimize routes
 * Supports queries like:
 * - "Plan canvassing for high-GOTV precincts"
 * - "Optimize routes in East Lansing"
 * - "How many doors in downtown Lansing?"
 */
export async function handleCanvassingQuery(
  intentType: string,
  params?: {
    jurisdiction?: string;
    doorCount?: number;
    precinctIds?: string[];
  }
): Promise<HandlerResult> {
  try {
    const precincts = await fetchPrecincts();

    // Check if user is trying to plan without context
    if (intentType === 'canvass_plan' && (!params?.precinctIds || params.precinctIds.length === 0) && !params?.jurisdiction) {
      return {
        response: "Let's plan your canvassing routes! First, I need to know which areas to target. You can:",
        suggestedActions: generateRecoverySuggestions('segment'),
        mapCommands: [
          { type: 'showHeatmap', metric: 'gotv_priority' }
        ],
      };
    }

    let response = '';
    const mapCommands: MapCommand[] = [];
    const suggestedActions: SuggestedAction[] = [];

    switch (intentType) {
      case 'canvass_plan':
      case 'canvass_optimize': {
        // Get high-GOTV precincts for canvassing
        const gotvPrecincts = precincts
          .filter(p => p.targeting && p.targeting.gotvPriority > 60)
          .sort((a, b) => (b.targeting?.gotvPriority || 0) - (a.targeting?.gotvPriority || 0))
          .slice(0, 10);

        if (gotvPrecincts.length === 0) {
          response = `**No High-GOTV Precincts Found**\n\nI couldn't find any precincts with GOTV priority above 60. Try lowering your threshold or checking different areas.`;
          suggestedActions.push(
            {
              id: 'show-all',
              label: 'Show all precincts',
              action: 'Show all precincts on map',
              icon: 'map'
            }
          );
          break;
        }

        const totalDoors = gotvPrecincts.reduce((sum, p) => {
          // Use population18up (voting-age population) as proxy for registered voters
          const doors = p.demographics?.population18up || Math.round((p.demographics?.totalPopulation || 0) / 2.5);
          return sum + doors;
        }, 0);
        const estimatedHours = Math.ceil(totalDoors / 40); // 40 doors/hour
        const volunteersFor4Hr = Math.ceil(estimatedHours / 4);
        const volunteersFor8Hr = Math.ceil(estimatedHours / 8);
        const expectedContacts = Math.floor(totalDoors * 0.35); // 35% contact rate

        response = `**Canvassing Plan - Top ${gotvPrecincts.length} GOTV Precincts**\n\n`;
        response += `**Precincts**:\n`;

        gotvPrecincts.forEach((p, i) => {
          // Use population18up (voting-age population) as proxy for registered voters
          const doors = p.demographics?.population18up || Math.round((p.demographics?.totalPopulation || 0) / 2.5);
          const gotvScore = Math.round(p.targeting?.gotvPriority || 0);
          response += `${i + 1}. **${p.name}** - GOTV Priority: ${gotvScore}%, ~${doors.toLocaleString()} doors\n`;
        });

        response += `\n**Operation Summary**:\n`;
        response += `- Total estimated doors: **${totalDoors.toLocaleString()}**\n`;
        response += `- Expected contacts (35% rate): **${expectedContacts.toLocaleString()}**\n`;
        response += `- Total hours needed: **${estimatedHours.toLocaleString()}**\n\n`;

        response += `**Staffing Options**:\n`;
        response += `- ${volunteersFor4Hr} volunteers (4-hour shifts)\n`;
        response += `- ${volunteersFor8Hr} volunteers (8-hour shifts)\n\n`;

        response += `💡 *Assuming 40 doors/hour average pace in mixed-density areas*`;

        // Wave 6D.5: Check for cross-tool insights (donor-GOTV overlap)
        const donorGOTVCheck = checkDonorGOTVOverlap();
        if (donorGOTVCheck.hasOverlap) {
          response += `\n\n${donorGOTVCheck.insight}`;
        }

        // Check for segment-canvass opportunity
        const segmentCanvassCheck = checkSegmentCanvassOpportunity();
        if (segmentCanvassCheck.hasOpportunity) {
          response += `\n\n${segmentCanvassCheck.insight}`;
        }

        // Log GOTV precincts for cross-tool tracking
        const stateManager = getStateManager();
        stateManager.logExploration({
          tool: 'canvass',
          action: 'canvass_plan',
          precinctIds: gotvPrecincts.map(p => p.id),
          metadata: {
            gotvPriority: gotvPrecincts[0]?.targeting?.gotvPriority,
            precinctCount: gotvPrecincts.length,
            totalDoors
          }
        });

        // Map commands to show route with numbered waypoints and heatmap
        mapCommands.push(
          {
            type: 'showRoute',
            waypoints: gotvPrecincts.map((p, idx) => ({
              precinctId: p.id,
              order: idx + 1,
              label: `${idx + 1}. ${p.name}`
            })),
            optimized: false // Initial display is priority-ordered, not route-optimized
          },
          {
            type: 'showHeatmap',
            metric: 'gotv_priority'
          },
          {
            type: 'setExtent',
            extent: calculateBoundsForPrecincts(gotvPrecincts)
          }
        );

        // Suggested actions
        suggestedActions.push(
          {
            id: 'export',
            label: 'Export walk list',
            action: 'output:exportCSV',
            icon: 'download'
          },
          {
            id: 'optimize-routes',
            label: 'Optimize routes',
            action: 'Optimize canvassing routes for these precincts',
            icon: 'route'
          },
          {
            id: 'expand-plan',
            label: 'Add more precincts',
            action: 'Add 5 more precincts to canvassing plan',
            icon: 'plus'
          },
          {
            id: 'turf-assignments',
            label: 'Create turf assignments',
            action: 'Assign volunteers to turfs',
            icon: 'users'
          }
        );
        break;
      }

      case 'canvass_estimate': {
        // Estimate staffing for specific jurisdiction or door count
        const jurisdiction = params?.jurisdiction;
        const targetDoors = params?.doorCount || 10000;

        let targetPrecincts = precincts;
        if (jurisdiction) {
          targetPrecincts = precincts.filter(p =>
            p.jurisdiction.toLowerCase().includes(jurisdiction.toLowerCase())
          );
        }

        const jurisdictionDoors = targetPrecincts.reduce((sum, p) => {
          const doors = Math.round((p.demographics?.totalPopulation || 0) / 2.5);
          return sum + doors;
        }, 0);

        const doorsToUse = jurisdiction ? jurisdictionDoors : targetDoors;
        const hours = Math.ceil(doorsToUse / 40);
        const volunteersFor4Hr = Math.ceil(hours / 4);
        const volunteersFor8Hr = Math.ceil(hours / 8);
        const expectedContacts = Math.floor(doorsToUse * 0.35);
        const days4Hr = Math.ceil(volunteersFor4Hr / 20); // 20 volunteers/day
        const days8Hr = Math.ceil(volunteersFor8Hr / 20);

        response = `**Canvassing Staffing Estimate**\n\n`;
        if (jurisdiction) {
          response += `**Area**: ${jurisdiction}\n`;
          response += `**Precincts**: ${targetPrecincts.length}\n\n`;
        }

        response += `**Operation Details**:\n`;
        response += `- Total doors: **${doorsToUse.toLocaleString()}**\n`;
        response += `- Total hours: **${hours.toLocaleString()}**\n`;
        response += `- Expected contacts (35% rate): **${expectedContacts.toLocaleString()}**\n\n`;

        response += `**Staffing Options**:\n`;
        response += `- ${volunteersFor4Hr} volunteers (4hr shifts) - ${days4Hr} days @ 20 volunteers/day\n`;
        response += `- ${volunteersFor8Hr} volunteers (8hr shifts) - ${days8Hr} days @ 20 volunteers/day\n\n`;

        response += `💡 *Based on 40 doors/hour average pace*`;

        suggestedActions.push(
          {
            id: 'create-plan',
            label: 'Create canvassing plan',
            action: `Plan canvassing for ${jurisdiction || 'these areas'}`,
            icon: 'clipboard'
          },
          {
            id: 'adjust-pace',
            label: 'Adjust pace estimate',
            action: 'How does pace change with 30 doors/hour?',
            icon: 'settings'
          }
        );

        if (jurisdiction) {
          mapCommands.push({
            type: 'flyTo',
            target: jurisdiction
          });
        }
        break;
      }

      case 'canvass_analysis': {
        // Analyze specific precincts
        const targetIds = params?.precinctIds || [];
        const targetPrecincts = targetIds.length > 0
          ? precincts.filter(p => targetIds.includes(p.id))
          : precincts.filter(p => p.targeting?.gotvPriority > 70).slice(0, 5);

        if (targetPrecincts.length === 0) {
          response = `**No Precincts Selected**\n\nPlease select precincts to analyze or I can show you the highest-GOTV precincts.`;
          suggestedActions.push({
            id: 'show-top',
            label: 'Show top GOTV precincts',
            action: 'Plan canvassing for high-GOTV precincts',
            icon: 'target'
          });
          break;
        }

        response = `**Canvassing Analysis - ${targetPrecincts.length} Precincts**\n\n`;

        targetPrecincts.forEach((p, i) => {
          // Use population18up (voting-age population) as proxy for registered voters
          const doors = p.demographics?.population18up || Math.round((p.demographics?.totalPopulation || 0) / 2.5);
          const gotvScore = Math.round(p.targeting?.gotvPriority || 0);
          const density = p.demographics?.populationDensity || 0;
          const paceEstimate = density > 5000 ? 45 : density > 2000 ? 40 : 30;

          response += `**${i + 1}. ${p.name}**\n`;
          response += `- GOTV Priority: ${gotvScore}%\n`;
          response += `- Estimated doors: ${doors.toLocaleString()}\n`;
          response += `- Density: ${Math.round(density).toLocaleString()} per sq mi\n`;
          response += `- Estimated pace: ~${paceEstimate} doors/hour\n`;
          response += `- Time to complete: ~${Math.ceil(doors / paceEstimate)} hours\n\n`;
        });

        const totalDoors = targetPrecincts.reduce((sum, p) =>
          // Use population18up (voting-age population) as proxy for registered voters
          sum + (p.demographics?.population18up || Math.round((p.demographics?.totalPopulation || 0) / 2.5)), 0
        );

        response += `**Total**: ${totalDoors.toLocaleString()} doors across ${targetPrecincts.length} precincts`;

        mapCommands.push({
          type: 'highlight',
          target: targetPrecincts.map(p => p.id)
        });

        suggestedActions.push(
          {
            id: 'create-plan',
            label: 'Create canvassing plan',
            action: 'Create a canvassing plan for these precincts',
            icon: 'clipboard'
          },
          {
            id: 'compare',
            label: 'Compare precincts',
            action: 'Compare these precincts side by side',
            icon: 'git-compare'
          }
        );
        break;
      }

      default: {
        response = `I can help plan canvassing operations. Try asking:\n\n`;
        response += `- "Plan canvassing for high-GOTV precincts"\n`;
        response += `- "How many doors in East Lansing?"\n`;
        response += `- "Estimate staffing for 5,000 doors"\n`;
        response += `- "Optimize canvassing routes"`;

        suggestedActions.push(
          {
            id: 'plan',
            label: 'Plan canvassing',
            action: 'Plan canvassing for top GOTV precincts',
            icon: 'route'
          },
          {
            id: 'estimate',
            label: 'Get staffing estimate',
            action: 'How many volunteers for 10,000 doors?',
            icon: 'users'
          }
        );
      }
    }

    return {
      response,
      mapCommands,
      suggestedActions,
    };

  } catch (error) {
    console.error('[handleCanvassingQuery] Error:', error);
    return {
      response: 'Sorry, I encountered an error planning canvassing. Please try again.',
      suggestedActions: [
        {
          id: 'retry',
          label: 'Try again',
          action: 'Plan canvassing for high-GOTV precincts',
          icon: 'refresh-cw'
        },
        {
          id: 'help',
          label: 'Get help',
          action: 'What canvassing options do I have?',
          icon: 'help-circle'
        }
      ]
    };
  }
}

// ============================================================================
// Knowledge Graph Handlers (Phase 16)
// ============================================================================

import { getKnowledgeGraph, type Entity, type Relationship, type RelationshipType } from '@/lib/knowledge-graph';
import { summarizeGraph } from '@/lib/knowledge-graph/visualizationHelpers';

/**
 * Handle knowledge graph exploration request
 */
export async function handleGraphExploration(params: {
  entityId?: string;
  entityName?: string;
  entityType?: string;
  relationshipTypes?: RelationshipType[];
  maxDepth?: number;
}): Promise<HandlerResult> {
  try {
    const graph = getKnowledgeGraph();
    const { entityId, entityName, entityType, relationshipTypes, maxDepth = 2 } = params;

    let entities: Entity[] = [];
    let relationships: Relationship[] = [];

    // Find starting entity
    if (entityId) {
      const entity = graph.getEntity(entityId);
      if (entity) {
        entities = [entity];
      }
    } else if (entityName) {
      // Search by name
      const queryResult = graph.query({
        namePattern: entityName,
        entityTypes: entityType ? [entityType as any] : undefined,
      });
      entities = queryResult.entities;
    }

    // If no entities found, return suggestion
    if (entities.length === 0) {
      const stats = graph.getStats();
      return {
        response: `I couldn't find an entity matching "${entityName || entityId}". ` +
          `The knowledge graph contains ${stats.entityCount} entities. ` +
          `Try searching for a candidate, office, jurisdiction, or organization.`,
        suggestedActions: [
          { id: 'graph-candidates', label: 'Show all candidates', action: 'Show me all candidates in the knowledge graph', icon: 'users' },
          { id: 'graph-offices', label: 'Show all offices', action: 'Show me all offices in the knowledge graph', icon: 'building' },
          { id: 'graph-stats', label: 'Show graph statistics', action: 'What is in the knowledge graph?', icon: 'bar-chart' },
        ],
      };
    }

    // Get connections for found entities
    const primaryEntity = entities[0];
    const connections = graph.getConnections(primaryEntity.id, relationshipTypes);

    // Collect connected entities and relationships
    const connectedEntities = connections.map(c => c.entity);
    relationships = connections.map(c => c.relationship);

    // If we want deeper traversal
    if (maxDepth > 1 && connections.length > 0) {
      const secondLevelIds = new Set<string>();
      for (const conn of connections) {
        const secondConnections = graph.getConnections(conn.entity.id, relationshipTypes);
        for (const sc of secondConnections.slice(0, 5)) { // Limit second level
          if (sc.entity.id !== primaryEntity.id && !connectedEntities.find(e => e.id === sc.entity.id)) {
            secondLevelIds.add(sc.entity.id);
            relationships.push(sc.relationship);
          }
        }
      }
      for (const id of secondLevelIds) {
        const entity = graph.getEntity(id);
        if (entity) connectedEntities.push(entity);
      }
    }

    // All entities for the graph
    const allEntities = [primaryEntity, ...connectedEntities];

    // Build response
    const graphData = {
      nodes: allEntities.map(e => ({ id: e.id, type: e.type, label: e.name })),
      edges: relationships,
    };

    let response = `**${primaryEntity.name}** (${primaryEntity.type})\n\n`;
    response += `Found ${connections.length} direct connections:\n\n`;

    // Group connections by relationship type
    const connectionsByType: Record<string, typeof connections> = {};
    for (const conn of connections) {
      const type = conn.relationship.type;
      if (!connectionsByType[type]) connectionsByType[type] = [];
      connectionsByType[type].push(conn);
    }

    for (const [type, conns] of Object.entries(connectionsByType)) {
      const readableType = type.toLowerCase().replace(/_/g, ' ');
      response += `**${readableType}**:\n`;
      for (const conn of conns.slice(0, 5)) {
        const arrow = conn.direction === 'outgoing' ? '→' : '←';
        response += `- ${arrow} ${conn.entity.name} (${conn.entity.type})\n`;
      }
      if (conns.length > 5) {
        response += `- ... and ${conns.length - 5} more\n`;
      }
      response += '\n';
    }

    // Build suggested actions
    const suggestedActions: SuggestedAction[] = [];

    // Suggest exploring connected entities
    const importantConnections = connections
      .filter(c => ['candidate', 'office', 'jurisdiction'].includes(c.entity.type))
      .slice(0, 2);

    for (const conn of importantConnections) {
      suggestedActions.push({
        id: `explore-${conn.entity.id}`,
        label: `Explore ${conn.entity.name}`,
        action: `Show me relationships for ${conn.entity.name}`,
        icon: 'search',
      });
    }

    // Suggest showing on map if precinct/jurisdiction
    if (primaryEntity.type === 'precinct' || primaryEntity.type === 'jurisdiction') {
      suggestedActions.push({
        id: 'show-on-map',
        label: 'Show on map',
        action: `Show ${primaryEntity.name} on the map`,
        icon: 'map',
      });
    }

    // Suggest finding path to another entity
    suggestedActions.push({
      id: 'find-path',
      label: 'Find connections',
      action: `How is ${primaryEntity.name} connected to other entities?`,
      icon: 'git-branch',
    });

    // Extract precinct IDs for map commands
    const precinctEntities = allEntities.filter(e => e.type === 'precinct');
    const precinctIds = precinctEntities.length > 0
      ? precinctEntities.map(e => e.id)
      : undefined;

    return {
      response,
      suggestedActions: suggestedActions.slice(0, 4),
      mapCommands: precinctIds ? [
        { type: 'highlight', target: precinctIds }
      ] : undefined,
      data: {
        graphData,
        primaryEntity,
        connections: connections.length,
      },
      metadata: {
        showGraph: true,
        entities: allEntities,
        relationships,
      },
    };
  } catch (error) {
    console.error('[handleGraphExploration] Error:', error);
    return {
      response: 'I encountered an error exploring the knowledge graph. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ],
    };
  }
}

/**
 * Handle request to find path between two entities
 */
export async function handleFindPath(params: {
  sourceName: string;
  targetName: string;
  maxDepth?: number;
}): Promise<HandlerResult> {
  try {
    const graph = getKnowledgeGraph();
    const { sourceName, targetName, maxDepth = 5 } = params;

    // Find source entity
    const sourceResult = graph.query({ namePattern: sourceName, limit: 1 });
    if (sourceResult.entities.length === 0) {
      return {
        response: `I couldn't find an entity matching "${sourceName}".`,
        suggestedActions: [
          { id: 'graph-search', label: 'Search entities', action: `Search for ${sourceName} in the graph`, icon: 'search' },
        ],
      };
    }

    // Find target entity
    const targetResult = graph.query({ namePattern: targetName, limit: 1 });
    if (targetResult.entities.length === 0) {
      return {
        response: `I couldn't find an entity matching "${targetName}".`,
        suggestedActions: [
          { id: 'graph-search', label: 'Search entities', action: `Search for ${targetName} in the graph`, icon: 'search' },
        ],
      };
    }

    const source = sourceResult.entities[0];
    const target = targetResult.entities[0];

    // Find path
    const path = graph.findPath(source.id, target.id, maxDepth);

    if (!path) {
      return {
        response: `I couldn't find a path between **${source.name}** and **${target.name}** within ${maxDepth} hops. ` +
          `They may not be connected in the knowledge graph.`,
        suggestedActions: [
          { id: 'explore-source', label: `Explore ${source.name}`, action: `Show relationships for ${source.name}`, icon: 'search' },
          { id: 'explore-target', label: `Explore ${target.name}`, action: `Show relationships for ${target.name}`, icon: 'search' },
        ],
      };
    }

    // Build response
    let response = `**Path from ${source.name} to ${target.name}**\n\n`;
    response += `Found a connection in ${path.edges.length} steps:\n\n`;

    for (let i = 0; i < path.nodes.length; i++) {
      const node = path.nodes[i];
      response += `${i + 1}. **${node.name}** (${node.type})`;

      if (i < path.edges.length) {
        const edge = path.edges[i];
        const readableType = edge.type.toLowerCase().replace(/_/g, ' ');
        response += ` → _${readableType}_`;
      }
      response += '\n';
    }

    // Extract precinct IDs from path for map commands
    const precinctNodes = path.nodes.filter(n => n.type === 'precinct');
    const precinctIds = precinctNodes.length > 0
      ? precinctNodes.map(n => n.id)
      : undefined;

    return {
      response,
      suggestedActions: [
        { id: 'explore-path-start', label: `Explore ${source.name}`, action: `Show relationships for ${source.name}`, icon: 'search' },
        { id: 'explore-path-end', label: `Explore ${target.name}`, action: `Show relationships for ${target.name}`, icon: 'search' },
      ],
      mapCommands: precinctIds ? [
        { type: 'highlight', target: precinctIds }
      ] : undefined,
      data: {
        path,
        source,
        target,
      },
      metadata: {
        showGraph: true,
        entities: path.nodes,
        relationships: path.edges,
      },
    };
  } catch (error) {
    console.error('[handleFindPath] Error:', error);
    return {
      response: 'I encountered an error finding the path. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ],
    };
  }
}

/**
 * Handle request for graph statistics/overview
 */
export async function handleGraphOverview(): Promise<HandlerResult> {
  try {
    const graph = getKnowledgeGraph();
    const stats = graph.getStats();

    let response = `**Knowledge Graph Overview**\n\n`;
    response += `The graph contains **${stats.entityCount} entities** and **${stats.relationshipCount} relationships**.\n\n`;

    if (stats.entityCount > 0) {
      response += `**Entity Types:**\n`;
      for (const [type, count] of Object.entries(stats.entitiesByType)) {
        if (count > 0) {
          response += `- ${type}: ${count}\n`;
        }
      }
      response += '\n';
    }

    if (stats.relationshipCount > 0) {
      response += `**Relationship Types:**\n`;
      const sortedRels = Object.entries(stats.relationshipsByType)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      for (const [type, count] of sortedRels) {
        const readable = type.toLowerCase().replace(/_/g, ' ');
        response += `- ${readable}: ${count}\n`;
      }
    }

    // Suggest exploration actions
    const suggestedActions: SuggestedAction[] = [];

    // Find most connected entities
    const typeWithMost = Object.entries(stats.entitiesByType)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])[0];

    if (typeWithMost) {
      suggestedActions.push({
        id: 'show-type',
        label: `Show ${typeWithMost[0]}s`,
        action: `Show me all ${typeWithMost[0]}s in the knowledge graph`,
        icon: 'list',
      });
    }

    suggestedActions.push({
      id: 'explore-candidate',
      label: 'Explore a candidate',
      action: 'Show me relationships for a candidate',
      icon: 'user',
    });

    suggestedActions.push({
      id: 'find-connections',
      label: 'Find connections',
      action: 'How are candidates connected to jurisdictions?',
      icon: 'git-branch',
    });

    return {
      response,
      suggestedActions,
      data: { stats },
    };
  } catch (error) {
    console.error('[handleGraphOverview] Error:', error);
    return {
      response: 'I encountered an error retrieving the knowledge graph statistics. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ],
    };
  }
}

/**
 * Handle request to list entities of a specific type
 */
export async function handleListEntities(entityType: string): Promise<HandlerResult> {
  try {
    const graph = getKnowledgeGraph();

    const result = graph.query({
      entityTypes: [entityType as any],
      limit: 20,
    });

    if (result.entities.length === 0) {
      return {
        response: `No ${entityType}s found in the knowledge graph.`,
        suggestedActions: [
          { id: 'graph-overview', label: 'Show graph overview', action: 'What is in the knowledge graph?', icon: 'bar-chart' },
        ],
      };
    }

    let response = `**${entityType.charAt(0).toUpperCase() + entityType.slice(1)}s** (${result.entities.length} found)\n\n`;

    for (const entity of result.entities) {
      response += `- **${entity.name}**`;
      if (entity.metadata) {
        const meta = entity.metadata as Record<string, unknown>;
        if (meta.party) response += ` (${meta.party})`;
        if (meta.level) response += ` - ${meta.level}`;
      }
      response += '\n';
    }

    if (result.metadata.totalEntities > 20) {
      response += `\n... and ${result.metadata.totalEntities - 20} more`;
    }

    // Suggest exploring specific entities
    const suggestedActions: SuggestedAction[] = result.entities.slice(0, 3).map(entity => ({
      id: `explore-${entity.id}`,
      label: `Explore ${entity.name}`,
      action: `Show relationships for ${entity.name}`,
      icon: 'search',
    }));

    // Extract geographic entities for map commands if applicable
    const geoEntities = result.entities.filter(e =>
      e.type === 'jurisdiction'
    );
    const entityIds = geoEntities.length > 0
      ? geoEntities.map(e => e.id)
      : undefined;

    return {
      response,
      suggestedActions,
      mapCommands: entityIds ? [
        { type: 'highlight', target: entityIds }
      ] : undefined,
      data: { entities: result.entities },
      metadata: {
        showGraph: true,
        entities: result.entities,
        relationships: [],
      },
    };
  } catch (error) {
    console.error('[handleListEntities] Error:', error);
    return {
      response: 'I encountered an error listing entities. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ],
    };
  }
}

/**
 * Handler for historical trend queries
 */
export async function handleTrendQuery(precinctName?: string): Promise<HandlerResult> {
  try {
    // Dynamic import to avoid SSR issues
    const { loadElectionHistory, analyzeTrends, formatTrendSummary, getPrecinctHistory } =
      await import('@/lib/analysis/TrendAnalyzer');

    await loadElectionHistory();

    if (!precinctName) {
      // General trend overview
      return {
        response: `I can show you historical voting trends from 2020-2024.\n\n**Available analyses:**\n• Turnout trends (which areas are voting more/less)\n• Margin shifts (which areas are becoming more D or R)\n• Flip risk (precincts that have changed or nearly changed)\n• Volatility (unstable voting patterns)\n\nAsk about a specific precinct like "What's the trend in East Lansing Precinct 3?" or "Show me precincts shifting Democratic"`,
        suggestedActions: [
          { id: 'shifting-dem', label: 'Show precincts shifting D', action: 'Show precincts shifting Democratic', icon: 'trending-up' },
          { id: 'flip-risk', label: 'Show flip risk areas', action: 'Show precincts with flip risk', icon: 'alert-triangle' },
          { id: 'turnout-trends', label: 'Show turnout trends', action: 'Show turnout trends since 2020', icon: 'bar-chart' }
        ]
      };
    }

    // Analyze specific precinct
    const precincts = await fetchPrecincts();
    const precinctNames = precincts.map(p => p.name);
    const matchedName = fuzzyMatchPrecinct(precinctName, precinctNames);

    if (!matchedName) {
      return {
        response: `I couldn't find a precinct matching "${precinctName}". Try asking about East Lansing, Lansing, Meridian, Delhi, or Williamston precincts.`,
        suggestedActions: [
          { id: 'lansing', label: 'Lansing trends', action: 'Show me historical trends for Lansing', icon: 'trending-up' },
          { id: 'eastlansing', label: 'East Lansing', action: 'Show me historical trends for East Lansing', icon: 'trending-up' },
          { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
        ]
      };
    }

    const precinct = precincts.find(p => p.name === matchedName);
    if (!precinct) throw new Error('Precinct not found');

    const analysis = analyzeTrends(precinct.id);
    const history = getPrecinctHistory(precinct.id);

    if (!analysis || !history) {
      return {
        response: `I don't have historical data for ${matchedName}. Historical trends are available for select precincts.`,
        suggestedActions: [
          { id: 'lansing', label: 'Lansing trends', action: 'Show me historical trends for Lansing', icon: 'trending-up' },
          { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
          { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
        ]
      };
    }

    // Format response
    const years = Object.keys(history).sort();
    let response = `**Historical Trends: ${matchedName}**\n\n`;

    // Assess confidence based on data quality
    const confidence = assessConfidence({
      historicalElections: years.length,
      margin: analysis.marginChange,
    });

    const trendDirection = analysis.marginChange > 5 ? 'Democratic' :
                          analysis.marginChange < -5 ? 'Republican' : 'stable';

    const trendInsight = expressConfidence(
      confidence,
      `${matchedName} shows ${trendDirection} trend over ${years.length} election cycles`,
      `${years.length} elections analyzed`
    );

    response += `📊 **Summary:** ${trendInsight}\n\n`;
    response += `**Election History:**\n`;

    years.forEach(year => {
      const data = history[year];
      const marginStr = data.margin > 0 ? `D+${data.margin}` : `R+${Math.abs(data.margin)}`;
      response += `• **${year}**: ${(data.turnout * 100).toFixed(0)}% turnout, ${marginStr}\n`;
    });

    response += `\n**Analysis:**\n`;
    response += `• Turnout change: ${analysis.turnoutChange > 0 ? '+' : ''}${(analysis.turnoutChange * 100).toFixed(0)}%\n`;
    response += `• Margin change: ${analysis.marginChange > 0 ? '+' : ''}${analysis.marginChange.toFixed(0)} points\n`;
    response += `• Volatility: ${analysis.volatility.toFixed(1)} (${analysis.volatility > 10 ? 'high' : analysis.volatility > 5 ? 'moderate' : 'low'})\n`;

    if (analysis.flipRisk) {
      response += `\n⚠️ **Flip Risk**: This precinct has crossed or nearly crossed the partisan threshold.`;
    }

    return {
      response,
      mapCommands: [
        { type: 'highlight', target: matchedName },
        { type: 'flyTo', target: matchedName }
      ],
      suggestedActions: [
        { id: 'compare-nearby', label: 'Compare to nearby precincts', action: `Compare ${matchedName} to neighboring precincts`, icon: 'git-compare' },
        { id: 'show-all-trends', label: 'Show all trend data', action: 'Show all precincts with trend analysis', icon: 'bar-chart' }
      ]
    };
  } catch (error) {
    console.error('Error in handleTrendQuery:', error);
    return {
      response: 'I encountered an error loading trend data. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ]
    };
  }
}

/**
 * Handler for knowledge graph queries (P0 Issue S6B-001)
 * Uses real data from the knowledge graph API
 */
export async function handleGraphQuery(graphParams?: {
  queryType: 'overview' | 'explore' | 'path' | 'list' | 'search';
  entityName?: string;
  entityType?: string;
  sourceName?: string;
  targetName?: string;
  searchTerm?: string;
}): Promise<HandlerResult> {
  try {
    if (!graphParams) {
      // Get stats for the intro message
      const statsResponse = await fetch('/api/knowledge-graph?action=stats');
      const statsData = await statsResponse.json();

      let introMessage = `**Knowledge Graph** lets you explore relationships between entities in Ingham County:\n`;

      if (statsData.success && statsData.stats) {
        const stats = statsData.stats;
        introMessage += `\n**Current Graph:**\n`;
        introMessage += `• ${stats.entityCount.toLocaleString()} entities\n`;
        introMessage += `• ${stats.relationshipCount.toLocaleString()} relationships\n`;

        if (stats.entityTypeBreakdown) {
          introMessage += `\n**Entity Types:**\n`;
          Object.entries(stats.entityTypeBreakdown)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([type, count]: [string, any]) => {
              introMessage += `• ${count} ${type}${count !== 1 ? 's' : ''}\n`;
            });
        }
      }

      introMessage += `\nTry asking:\n`;
      introMessage += `• "Show me the knowledge graph overview"\n`;
      introMessage += `• "Explore connections for [entity name]"\n`;
      introMessage += `• "What connects [entity A] to [entity B]?"\n`;
      introMessage += `• "List all candidates" or "List all precincts"`;

      return {
        response: introMessage,
        suggestedActions: [
          { id: 'graph-overview', label: 'Show graph overview', action: 'Show me the knowledge graph overview', icon: 'share-2' },
          { id: 'explore-precincts', label: 'Explore precincts', action: 'List all precincts in the graph', icon: 'map' },
          { id: 'search', label: 'Search entities', action: 'Search for entities related to East Lansing', icon: 'search' }
        ],
        metadata: {
          showGraph: true
        }
      };
    }

    const { queryType, entityName, entityType, sourceName, targetName, searchTerm } = graphParams;

    // Handle different query types
    switch (queryType) {
      case 'overview': {
        // Get full graph data
        const response = await fetch('/api/knowledge-graph?action=all');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch graph data');
        }

        const { entities, relationships, stats } = data;

        let responseText = `**Knowledge Graph Overview**\n\n`;
        responseText += `**Total Entities:** ${stats.entityCount.toLocaleString()}\n`;
        responseText += `**Total Relationships:** ${stats.relationshipCount.toLocaleString()}\n\n`;

        if (stats.entityTypeBreakdown) {
          responseText += `**Entity Types:**\n`;
          Object.entries(stats.entityTypeBreakdown)
            .sort((a: any, b: any) => b[1] - a[1])
            .forEach(([type, count]: [string, any]) => {
              responseText += `• ${count} ${type}${count !== 1 ? 's' : ''}\n`;
            });
        }

        if (stats.relationshipTypeBreakdown) {
          responseText += `\n**Top Relationship Types:**\n`;
          Object.entries(stats.relationshipTypeBreakdown)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([type, count]: [string, any]) => {
              responseText += `• ${count} ${type} relationships\n`;
            });
        }

        return {
          response: responseText,
          suggestedActions: [
            { id: 'explore-entity', label: 'Explore an entity', action: 'Show me connections for East Lansing', icon: 'git-branch' },
            { id: 'list-candidates', label: 'List candidates', action: 'List all candidates', icon: 'users' },
            { id: 'list-precincts', label: 'List precincts', action: 'List all precincts', icon: 'map' }
          ],
          metadata: {
            showGraph: true,
            graphData: { entities, relationships }
          }
        };
      }

      case 'explore': {
        if (!entityName) {
          return {
            response: 'To explore connections, specify an entity name like "East Lansing" or a precinct name.',
            suggestedActions: [
              { id: 'example', label: 'Try an example', action: 'Show connections for East Lansing', icon: 'git-branch' }
            ]
          };
        }

        // Search for the entity
        const searchResponse = await fetch(`/api/knowledge-graph?action=search&name=${encodeURIComponent(entityName)}${entityType ? `&type=${entityType}` : ''}`);
        const searchData = await searchResponse.json();

        if (!searchData.success || searchData.entities.length === 0) {
          return {
            response: `Could not find entity "${entityName}". Try:\n• Checking the spelling\n• Using a different name variant\n• Listing all entities of a type first`,
            suggestedActions: [
              { id: 'list', label: 'List entities', action: 'List all entities', icon: 'list' },
              { id: 'search', label: 'Search differently', action: `Search for ${entityName.split(' ')[0]}`, icon: 'search' }
            ]
          };
        }

        // Get the first matching entity
        const entity = searchData.entities[0];

        // Get connections for this entity
        const connectionsResponse = await fetch(`/api/knowledge-graph?action=entity&id=${encodeURIComponent(entity.id)}`);
        const connectionsData = await connectionsResponse.json();

        if (!connectionsData.success) {
          throw new Error('Failed to fetch entity connections');
        }

        const { entity: fullEntity, connections } = connectionsData;

        let responseText = `**Exploring: ${fullEntity.name}**\n`;
        responseText += `Type: ${fullEntity.type}\n\n`;

        if (connections && connections.length > 0) {
          responseText += `**Connected to ${connections.length} entities:**\n\n`;

          // Group connections by relationship type
          const groupedConnections: Record<string, any[]> = {};
          connections.forEach((conn: any) => {
            if (!groupedConnections[conn.relationship]) {
              groupedConnections[conn.relationship] = [];
            }
            groupedConnections[conn.relationship].push(conn);
          });

          // Show top relationship types
          Object.entries(groupedConnections)
            .slice(0, 5)
            .forEach(([relType, conns]) => {
              responseText += `**${relType}** (${conns.length}):\n`;
              conns.slice(0, 3).forEach((conn: any) => {
                responseText += `• ${conn.entity.name} (${conn.entity.type})\n`;
              });
              if (conns.length > 3) {
                responseText += `• ...and ${conns.length - 3} more\n`;
              }
              responseText += `\n`;
            });
        } else {
          responseText += `No connections found for this entity.\n`;
        }

        // Build map commands for precincts
        const mapCommands: MapCommand[] = [];
        if (fullEntity.type === 'precinct') {
          mapCommands.push(
            { type: 'highlight', target: fullEntity.name },
            { type: 'flyTo', target: fullEntity.name }
          );
        }

        return {
          response: responseText,
          mapCommands: mapCommands.length > 0 ? mapCommands : undefined,
          suggestedActions: [
            { id: 'similar', label: 'Find similar entities', action: `Find entities similar to ${fullEntity.name}`, icon: 'users' },
            { id: 'path', label: 'Find connections', action: `What connects ${fullEntity.name} to other entities?`, icon: 'git-merge' },
            { id: 'details', label: 'Show details', action: `Tell me more about ${fullEntity.name}`, icon: 'info' }
          ],
          metadata: {
            showGraph: true,
            focusEntity: fullEntity.id,
            entityData: fullEntity
          }
        };
      }

      case 'path': {
        if (!sourceName || !targetName) {
          return {
            response: 'To find a path, specify both source and target. Example: "What connects East Lansing to [entity name]?"',
            suggestedActions: [
              { id: 'example', label: 'Try an example', action: 'What connects East Lansing to swing precincts?', icon: 'git-merge' }
            ]
          };
        }

        // Search for source entity
        const sourceResponse = await fetch(`/api/knowledge-graph?action=search&name=${encodeURIComponent(sourceName)}`);
        const sourceData = await sourceResponse.json();

        // Search for target entity
        const targetResponse = await fetch(`/api/knowledge-graph?action=search&name=${encodeURIComponent(targetName)}`);
        const targetData = await targetResponse.json();

        if (!sourceData.success || sourceData.entities.length === 0 ||
            !targetData.success || targetData.entities.length === 0) {
          return {
            response: `Could not find one or both entities. Make sure both "${sourceName}" and "${targetName}" exist in the graph.`,
            suggestedActions: [
              { id: 'list', label: 'List entities', action: 'List all entities', icon: 'list' }
            ]
          };
        }

        const sourceEntity = sourceData.entities[0];
        const targetEntity = targetData.entities[0];

        // Find path between entities
        const pathResponse = await fetch(
          `/api/knowledge-graph?action=path&source=${encodeURIComponent(sourceEntity.id)}&target=${encodeURIComponent(targetEntity.id)}`
        );
        const pathData = await pathResponse.json();

        if (!pathData.success || !pathData.path || pathData.path.length === 0) {
          return {
            response: `No path found between ${sourceEntity.name} and ${targetEntity.name}. They may not be connected in the current graph.`,
            suggestedActions: [
              { id: 'explore-source', label: `Explore ${sourceEntity.name}`, action: `Show me connections for ${sourceEntity.name}`, icon: 'git-branch' },
              { id: 'explore-target', label: `Explore ${targetEntity.name}`, action: `Show me connections for ${targetEntity.name}`, icon: 'git-branch' }
            ]
          };
        }

        // Format the path
        let responseText = `**Path from ${sourceEntity.name} to ${targetEntity.name}:**\n\n`;

        pathData.path.forEach((step: any, index: number) => {
          if (index > 0) {
            responseText += ` →\n`;
          }
          responseText += `${index + 1}. **${step.entity.name}** (${step.entity.type})`;
          if (step.relationship) {
            responseText += `\n   via ${step.relationship}`;
          }
          responseText += `\n`;
        });

        return {
          response: responseText,
          suggestedActions: [
            { id: 'explore-source', label: `Explore ${sourceEntity.name}`, action: `Show me connections for ${sourceEntity.name}`, icon: 'git-branch' },
            { id: 'explore-target', label: `Explore ${targetEntity.name}`, action: `Show me connections for ${targetEntity.name}`, icon: 'git-branch' }
          ],
          metadata: {
            showGraph: true,
            highlightPath: pathData.path.map((step: any) => step.entity.id)
          }
        };
      }

      case 'list': {
        const listType = entityType || 'all';
        const searchUrl = listType === 'all'
          ? '/api/knowledge-graph?action=search&limit=50'
          : `/api/knowledge-graph?action=search&type=${listType}&limit=50`;

        const response = await fetch(searchUrl);
        const data = await response.json();

        if (!data.success || data.entities.length === 0) {
          return {
            response: `No entities found${listType !== 'all' ? ` of type "${listType}"` : ''}.`,
            suggestedActions: [
              { id: 'overview', label: 'Show graph overview', action: 'Show me the knowledge graph overview', icon: 'share-2' }
            ]
          };
        }

        let responseText = `**${listType === 'all' ? 'Entities' : listType.charAt(0).toUpperCase() + listType.slice(1) + 's'} in Knowledge Graph:**\n\n`;

        // Group by type if showing all
        if (listType === 'all') {
          const grouped: Record<string, any[]> = {};
          data.entities.forEach((entity: any) => {
            if (!grouped[entity.type]) {
              grouped[entity.type] = [];
            }
            grouped[entity.type].push(entity);
          });

          Object.entries(grouped).forEach(([type, entities]) => {
            responseText += `**${type.charAt(0).toUpperCase() + type.slice(1)}s** (${entities.length}):\n`;
            entities.slice(0, 5).forEach((entity: any) => {
              responseText += `• ${entity.name}\n`;
            });
            if (entities.length > 5) {
              responseText += `• ...and ${entities.length - 5} more\n`;
            }
            responseText += `\n`;
          });
        } else {
          data.entities.slice(0, 20).forEach((entity: any) => {
            responseText += `• ${entity.name}\n`;
          });
          if (data.entities.length > 20) {
            responseText += `\n...and ${data.entities.length - 20} more`;
          }
        }

        return {
          response: responseText,
          suggestedActions: [
            { id: 'explore', label: 'Explore an entity', action: `Show me connections for ${data.entities[0].name}`, icon: 'git-branch' },
            { id: 'filter', label: 'Filter by type', action: 'List all candidates', icon: 'filter' }
          ],
          metadata: {
            entities: data.entities
          }
        };
      }

      case 'search': {
        if (!searchTerm) {
          return {
            response: 'Provide a search term to find entities. Example: "Search for East Lansing"',
            suggestedActions: [
              { id: 'list', label: 'List all entities', action: 'List all entities', icon: 'list' }
            ]
          };
        }

        const response = await fetch(`/api/knowledge-graph?action=search&name=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();

        if (!data.success || data.entities.length === 0) {
          return {
            response: `No entities found matching "${searchTerm}". Try:\n• Using different keywords\n• Checking spelling\n• Being more specific`,
            suggestedActions: [
              { id: 'list', label: 'List all entities', action: 'List all entities', icon: 'list' }
            ]
          };
        }

        let responseText = `**Search results for "${searchTerm}":**\n\n`;
        responseText += `Found ${data.entities.length} matching entities:\n\n`;

        data.entities.slice(0, 10).forEach((entity: any) => {
          responseText += `• **${entity.name}** (${entity.type})\n`;
          if (entity.metadata) {
            const metadataStr = Object.entries(entity.metadata)
              .slice(0, 2)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
            if (metadataStr) {
              responseText += `  ${metadataStr}\n`;
            }
          }
        });

        if (data.entities.length > 10) {
          responseText += `\n...and ${data.entities.length - 10} more results`;
        }

        return {
          response: responseText,
          suggestedActions: [
            { id: 'explore', label: `Explore ${data.entities[0].name}`, action: `Show me connections for ${data.entities[0].name}`, icon: 'git-branch' },
            { id: 'refine', label: 'Refine search', action: `Search for ${searchTerm} candidates`, icon: 'search' }
          ],
          metadata: {
            searchResults: data.entities
          }
        };
      }

      default:
        return {
          response: `I can help you explore the knowledge graph. Try:\n• "Show graph overview"\n• "Explore [entity name] connections"\n• "What connects [entity A] to [entity B]?"\n• "List all [entity type]"\n• "Search for [term]"`,
          suggestedActions: [
            { id: 'overview', label: 'Graph overview', action: 'Show me the knowledge graph overview', icon: 'share-2' },
            { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
          ]
        };
    }
  } catch (error) {
    console.error('Error in handleGraphQuery:', error);
    return {
      response: `I encountered an error exploring the knowledge graph: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'overview', label: 'Graph overview', action: 'Show me the knowledge graph overview', icon: 'share-2' }
      ]
    };
  }
}

// ============================================================================
// NAVIGATION HANDLER (P0-6)
// ============================================================================

/**
 * Known landmarks in Ingham County for navigation
 */
const KNOWN_LANDMARKS: Record<string, { lat: number; lng: number; name: string }> = {
  'msu': { lat: 42.7251, lng: -84.4791, name: 'Michigan State University' },
  'michigan state': { lat: 42.7251, lng: -84.4791, name: 'Michigan State University' },
  'michigan state university': { lat: 42.7251, lng: -84.4791, name: 'Michigan State University' },
  'capitol': { lat: 42.7336, lng: -84.5553, name: 'Michigan State Capitol' },
  'state capitol': { lat: 42.7336, lng: -84.5553, name: 'Michigan State Capitol' },
  'the capitol': { lat: 42.7336, lng: -84.5553, name: 'Michigan State Capitol' },
  'lansing': { lat: 42.7325, lng: -84.5555, name: 'Downtown Lansing' },
  'downtown lansing': { lat: 42.7325, lng: -84.5555, name: 'Downtown Lansing' },
  'east lansing': { lat: 42.7369, lng: -84.4839, name: 'East Lansing' },
  'meridian': { lat: 42.7197, lng: -84.4233, name: 'Meridian Township' },
  'meridian township': { lat: 42.7197, lng: -84.4233, name: 'Meridian Township' },
  'delhi': { lat: 42.6567, lng: -84.6053, name: 'Delhi Township' },
  'delhi township': { lat: 42.6567, lng: -84.6053, name: 'Delhi Township' },
  'okemos': { lat: 42.7225, lng: -84.4272, name: 'Okemos' },
  'haslett': { lat: 42.7464, lng: -84.4011, name: 'Haslett' },
  'holt': { lat: 42.6406, lng: -84.5153, name: 'Holt' },
  'mason': { lat: 42.5792, lng: -84.4436, name: 'Mason' },
  'williamston': { lat: 42.6889, lng: -84.2831, name: 'Williamston' },
  'webberville': { lat: 42.6678, lng: -84.1747, name: 'Webberville' },
  'spartan stadium': { lat: 42.7284, lng: -84.4844, name: 'Spartan Stadium' },
  'frandor': { lat: 42.7359, lng: -84.5155, name: 'Frandor Shopping Center' },
  'old town': { lat: 42.7386, lng: -84.5528, name: 'Old Town Lansing' },
  'lansing mall': { lat: 42.7029, lng: -84.5772, name: 'Lansing Mall' },
  'eastwood': { lat: 42.7361, lng: -84.5133, name: 'Eastwood Towne Center' },
  'ingham county': { lat: 42.6000, lng: -84.4000, name: 'Ingham County' },
};

/**
 * Handle navigation requests - zoom/fly to locations (P0-6)
 */
export async function handleNavigationRequest(
  location: string,
  metric?: string
): Promise<HandlerResult> {
  const locationLower = location.toLowerCase().trim();

  // Try exact match first
  let geocoded = KNOWN_LANDMARKS[locationLower];

  // Try partial match if no exact match
  if (!geocoded) {
    const partialMatch = Object.entries(KNOWN_LANDMARKS).find(([key]) =>
      locationLower.includes(key) || key.includes(locationLower)
    );

    if (partialMatch) {
      geocoded = partialMatch[1];
    }
  }

  // If still not found, return error with suggestions
  if (!geocoded) {
    return {
      response: `I couldn't find "${location}". Try one of these locations:\n\n` +
        `**Cities & Townships:**\n` +
        `- Downtown Lansing, East Lansing, Meridian Township\n` +
        `- Delhi Township, Okemos, Haslett, Holt, Mason\n\n` +
        `**Landmarks:**\n` +
        `- MSU, State Capitol, Spartan Stadium, Frandor, Old Town\n\n` +
        `Or click directly on the map to explore.`,
      suggestedActions: [
        { id: 'lansing', label: 'Go to Lansing', action: 'Zoom to Lansing', icon: 'map-pin' },
        { id: 'msu', label: 'Go to MSU', action: 'Zoom to MSU', icon: 'graduation-cap' },
        { id: 'eastlansing', label: 'Go to East Lansing', action: 'Zoom to East Lansing', icon: 'map-pin' },
        { id: 'explore', label: 'Reset map view', action: 'map:resetView', icon: 'maximize' }
      ]
    };
  }

  // Build map commands
  const mapCommands: MapCommand[] = [
    {
      type: 'flyTo',
      target: `${geocoded.lat},${geocoded.lng}`,
      zoomLevel: locationLower.includes('msu') || locationLower.includes('stadium') ? 15 : 13
    }
  ];

  let responseText = `Centered on **${geocoded.name}**.`;

  // Add metric visualization if specified
  if (metric) {
    const metricMap: Record<string, string> = {
      'median age': 'median_age',
      'age': 'median_age',
      'income': 'median_income',
      'median income': 'median_income',
      'population': 'population',
      'turnout': 'turnout',
      'swing': 'swing_potential',
      'swing potential': 'swing_potential',
      'partisan': 'partisan_lean',
      'partisan lean': 'partisan_lean',
      'gotv': 'gotv_priority',
      'gotv priority': 'gotv_priority',
      'demographics': 'combined_score',
      'voter density': 'registered_voters',
      'registered voters': 'registered_voters'
    };

    const metricKey = Object.entries(metricMap).find(([key]) =>
      metric.toLowerCase().includes(key)
    )?.[1] || 'combined_score';

    mapCommands.push({ type: 'showChoropleth', metric: metricKey });
    responseText += ` Showing **${metric}** data on the map.`;
  }

  return {
    response: responseText,
    mapCommands,
    suggestedActions: [
      { id: 'swing', label: 'Show swing potential', action: 'map:showChoropleth', icon: 'target', metadata: { metric: 'swing_potential' } },
      { id: 'gotv', label: 'Show GOTV priority', action: 'map:showHeatmap', icon: 'trending-up', metadata: { metric: 'gotv_priority' } },
      { id: 'demographics', label: 'Analyze this area', action: `What are the demographics around ${geocoded.name}?`, icon: 'users' }
    ]
  };
}

// ============================================================================
// Segment Intent Handlers (S2A-005)
// ============================================================================

/**
 * Handle segment-related intents (segment_create, segment_find, segment_save, segment_compare)
 */
export async function handleSegmentIntent(
  intentType: 'segment_create' | 'segment_find' | 'segment_save' | 'segment_compare',
  params?: Record<string, any>
): Promise<HandlerResult> {
  switch (intentType) {
    case 'segment_create':
      return handleSegmentCreate(params);
    case 'segment_find':
      return handleSegmentFind(params);
    case 'segment_save':
      return handleSegmentSave(params);
    case 'segment_compare':
      return handleSegmentCompare(params);
    default:
      return {
        response: `Unknown segment intent: ${intentType}`,
        suggestedActions: [
          { id: 'segments', label: 'Go to Segments', action: 'navigate:segments', icon: 'filter' }
        ]
      };
  }
}

/**
 * Create a new segment from filters
 */
async function handleSegmentCreate(params?: Record<string, any>): Promise<HandlerResult> {
  try {
    // Extract filters from params
    const filters: SegmentFilters = params?.filters || {};

    // Import SegmentEngine and PoliticalDataService
    const { SegmentEngine } = await import('@/lib/segmentation/SegmentEngine');
    const { politicalDataService } = await import('@/lib/services/PoliticalDataService');

    // Get precinct data
    const precincts = await politicalDataService.getSegmentEnginePrecincts();

    // Create engine and run query
    const engine = new SegmentEngine(precincts);
    const results = engine.query(filters);

    const count = results.precinctCount;
    const voters = results.estimatedVoters;

    if (count === 0) {
      return {
        response: `No precincts match those criteria. Try broadening your filters.`,
        suggestedActions: [
          { id: 'broaden', label: 'Show all precincts', action: 'Find all precincts', icon: 'filter' },
          { id: 'segments', label: 'Browse segments', action: 'navigate:segments', icon: 'list' }
        ]
      };
    }

    // Build response
    const avgGotv = results.avgGOTV.toFixed(1);
    const avgPersuasion = results.avgPersuasion.toFixed(1);
    const avgLean = results.avgPartisanLean > 0
      ? `R+${results.avgPartisanLean.toFixed(1)}`
      : `D+${Math.abs(results.avgPartisanLean).toFixed(1)}`;

    const response = `Found **${count} precincts** with ~${voters.toLocaleString()} voters.\n\n` +
      `**Avg Scores:** GOTV ${avgGotv} | Persuasion ${avgPersuasion} | Lean ${avgLean}\n\n` +
      `**Strategy Mix:** ${Object.entries(results.strategyBreakdown)
        .map(([strategy, count]) => `${strategy}: ${count}`)
        .join(', ')}`;

    // Map commands: highlight matching precincts
    const mapCommands: MapCommand[] = [
      {
        type: 'highlight',
        target: results.matchingPrecincts.map(p => p.precinctId)
      }
    ];

    // Suggested actions
    const suggestedActions: SuggestedAction[] = [
      {
        id: 'save-segment',
        label: 'Save this segment',
        action: 'output:saveSegment',
        icon: 'bookmark',
        metadata: { results, filters }
      },
      {
        id: 'export-csv',
        label: 'Export to CSV',
        action: 'output:exportCSV',
        icon: 'download',
        metadata: { results }
      },
      {
        id: 'canvass-plan',
        label: 'Plan canvassing',
        action: 'navigate:canvass',
        icon: 'map',
        metadata: { precincts: results.matchingPrecincts.map(p => p.precinctId) }
      }
    ];

    return {
      response,
      mapCommands,
      suggestedActions,
      data: results
    };

  } catch (error) {
    console.error('[handleSegmentCreate] Error:', error);
    return {
      response: `Failed to create segment: ${(error as Error).message}`,
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'Create a segment', icon: 'refresh-cw' }
      ]
    };
  }
}

/**
 * Find/list saved segments
 */
async function handleSegmentFind(params?: Record<string, any>): Promise<HandlerResult> {
  try {
    const { segmentStore } = await import('@/lib/segmentation/SegmentStore');

    const segments = segmentStore.getAll();

    if (segments.length === 0) {
      return {
        response: `You don't have any saved segments yet. Create one by applying filters and saving the results.`,
        suggestedActions: [
          { id: 'create', label: 'Create a segment', action: 'navigate:segments', icon: 'plus' },
          { id: 'example', label: 'Find high GOTV precincts', action: 'Find precincts with GOTV priority above 70', icon: 'target' }
        ]
      };
    }

    // Build response with segment list
    const segmentList = segments
      .map((seg, idx) => {
        const count = seg.cachedResults?.precinctCount || 0;
        const voters = seg.cachedResults?.estimatedVoters || 0;
        return `${idx + 1}. **${seg.name}** - ${count} precincts, ~${voters.toLocaleString()} voters`;
      })
      .join('\n');

    const response = `You have **${segments.length} saved segments**:\n\n${segmentList}\n\n` +
      `Click a segment name to load it, or ask me to analyze a specific segment.`;

    // Suggested actions: load each segment
    const suggestedActions: SuggestedAction[] = segments.slice(0, 5).map(seg => ({
      id: `load-${seg.id}`,
      label: `Load "${seg.name}"`,
      action: `Load segment ${seg.name}`,
      icon: 'folder-open',
      metadata: { segmentId: seg.id }
    }));

    suggestedActions.push({
      id: 'manage',
      label: 'Manage segments',
      action: 'navigate:settings',
      icon: 'settings'
    });

    return {
      response,
      suggestedActions,
      data: segments
    };

  } catch (error) {
    console.error('[handleSegmentFind] Error:', error);
    return {
      response: `Failed to load segments: ${(error as Error).message}`,
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'Show my saved segments', icon: 'refresh-cw' }
      ]
    };
  }
}

/**
 * Save current filters as a segment
 */
async function handleSegmentSave(params?: Record<string, any>): Promise<HandlerResult> {
  try {
    const { segmentStore } = await import('@/lib/segmentation/SegmentStore');

    const name = params?.name || `Segment ${new Date().toLocaleDateString()}`;
    const description = params?.description;
    const filters = params?.filters || {};
    const results = params?.results;

    // Create segment definition
    const segment: any = {
      id: `seg-${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      filters,
      cachedResults: results
    };

    // Save to store
    const success = segmentStore.save(segment);

    if (!success) {
      const error = segmentStore.getLastError();
      return {
        response: `Failed to save segment: ${error || 'Unknown error'}\n\n` +
          `Try exporting to file instead.`,
        suggestedActions: [
          { id: 'export', label: 'Export to file', action: 'output:exportSegment', icon: 'download', metadata: { segment } }
        ]
      };
    }

    const count = results?.precinctCount || 0;
    const voters = results?.estimatedVoters || 0;

    const response = `Saved segment **"${name}"** with ${count} precincts and ~${voters.toLocaleString()} voters.`;

    return {
      response,
      suggestedActions: [
        { id: 'view-segments', label: 'View all segments', action: 'Show my saved segments', icon: 'list' },
        { id: 'compare', label: 'Compare segments', action: 'Compare my segments', icon: 'git-compare' },
        { id: 'canvass', label: 'Plan canvassing', action: 'navigate:canvass', icon: 'map', metadata: { segmentId: segment.id } }
      ],
      data: segment
    };

  } catch (error) {
    console.error('[handleSegmentSave] Error:', error);
    return {
      response: `Failed to save segment: ${(error as Error).message}`,
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'Save this segment', icon: 'refresh-cw' }
      ]
    };
  }
}

/**
 * Compare two or more saved segments
 */
async function handleSegmentCompare(params?: Record<string, any>): Promise<HandlerResult> {
  try {
    const { segmentStore } = await import('@/lib/segmentation/SegmentStore');

    const segmentIds = params?.segmentIds || params?.segments || [];

    if (segmentIds.length < 2) {
      const allSegments = segmentStore.getAll();
      if (allSegments.length < 2) {
        return {
          response: `You need at least 2 saved segments to compare. Create more segments first.`,
          suggestedActions: [
            { id: 'create', label: 'Create a segment', action: 'navigate:segments', icon: 'plus' }
          ]
        };
      }

      return {
        response: `Which segments would you like to compare? You have:\n\n` +
          allSegments.map((seg, idx) => `${idx + 1}. ${seg.name}`).join('\n'),
        suggestedActions: allSegments.slice(0, 4).map(seg => ({
          id: `select-${seg.id}`,
          label: `Select "${seg.name}"`,
          action: `Compare ${seg.name}`,
          icon: 'check-square'
        }))
      };
    }

    // Load segments
    const segments = segmentIds.map((id: string) => segmentStore.getById(id)).filter(Boolean);

    if (segments.length < 2) {
      return {
        response: `Could not find segments with those IDs. Please select from your saved segments.`,
        suggestedActions: [
          { id: 'list', label: 'Show my segments', action: 'Show my saved segments', icon: 'list' }
        ]
      };
    }

    // Build comparison
    const comparison = segments.map((seg: any) => {
      const results = seg.cachedResults;
      return {
        name: seg.name,
        precincts: results?.precinctCount || 0,
        voters: results?.estimatedVoters || 0,
        avgGotv: results?.avgGOTV || 0,
        avgPersuasion: results?.avgPersuasion || 0,
        avgLean: results?.avgPartisanLean || 0
      };
    });

    const response = `**Segment Comparison**\n\n` +
      comparison.map((seg: any) => {
        const lean = seg.avgLean > 0 ? `R+${seg.avgLean.toFixed(1)}` : `D+${Math.abs(seg.avgLean).toFixed(1)}`;
        return `**${seg.name}**\n` +
          `- ${seg.precincts} precincts, ~${seg.voters.toLocaleString()} voters\n` +
          `- GOTV: ${seg.avgGotv.toFixed(1)} | Persuasion: ${seg.avgPersuasion.toFixed(1)} | Lean: ${lean}`;
      }).join('\n\n');

    // Map commands: highlight all segments with different colors (if comparing 2)
    const mapCommands: MapCommand[] = [];
    if (segments.length === 2) {
      const seg1Precincts = segments[0].cachedResults?.matchingPrecincts?.map((p: any) => p.precinctId) || [];
      const seg2Precincts = segments[1].cachedResults?.matchingPrecincts?.map((p: any) => p.precinctId) || [];

      mapCommands.push({
        type: 'highlightComparison',
        leftEntityId: seg1Precincts[0] || '',
        rightEntityId: seg2Precincts[0] || ''
      } as any);
    }

    return {
      response,
      mapCommands,
      suggestedActions: [
        { id: 'overlap', label: 'Show overlap', action: 'Show which precincts are in both segments', icon: 'intersect' },
        { id: 'unique', label: 'Show unique precincts', action: 'Show precincts unique to each segment', icon: 'git-branch' },
        { id: 'export', label: 'Export comparison', action: 'output:exportComparison', icon: 'download', metadata: { segments } }
      ],
      data: { segments, comparison }
    };

  } catch (error) {
    console.error('[handleSegmentCompare] Error:', error);
    return {
      response: `Failed to compare segments: ${(error as Error).message}`,
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'Compare my segments', icon: 'refresh-cw' }
      ]
    };
  }
}
