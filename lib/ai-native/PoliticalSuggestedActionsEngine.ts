/**
 * PoliticalSuggestedActionsEngine
 *
 * Context-aware engine that generates relevant suggested actions
 * based on current analysis state, conversation history, and user intent.
 *
 * Key Principles:
 * 1. Actions adapt to current context (view, selection, last action)
 * 2. Prioritize high-value next steps based on political workflows
 * 3. Surface tool capabilities through actionable suggestions
 * 4. Maintain conversation flow with progressive disclosure
 */

import type { PoliticalAIContext, SuggestedAction, Message } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ActionContext extends PoliticalAIContext {
  // Extended context for action generation
  analysisResults?: AnalysisResult[];
  activeTool?: string;
  userPreferences?: UserPreferences;
}

export interface AnalysisResult {
  id: string;
  type: 'segment' | 'comparison' | 'canvass' | 'donor' | 'poll' | 'precinct' | 'jurisdiction';
  data: Record<string, unknown>;
  timestamp: Date;
  summary?: string;
}

export interface UserPreferences {
  defaultTargetingStrategy: 'gotv' | 'persuasion' | 'battleground';
  preferredExportFormat: 'csv' | 'pdf' | 'van';
}

export interface ActionCategory {
  id: string;
  label: string;
  priority: number;
  condition: (context: ActionContext) => boolean;
  actions: SuggestedAction[];
}

// ============================================================================
// Action Definitions
// ============================================================================

const UNIVERSAL_ACTIONS: SuggestedAction[] = [
  {
    id: 'find-targets',
    label: 'Find Target Precincts',
    action: 'workflow:find-targets',
    icon: 'target',
    variant: 'primary',
  },
  {
    id: 'ask-question',
    label: 'Ask a Question',
    action: 'input:focus',
    icon: 'message-circle',
    variant: 'secondary',
  },
];

const PRECINCT_ACTIONS: SuggestedAction[] = [
  {
    id: 'explain-score',
    label: 'Explain Targeting Score',
    action: 'analyze:explain-score',
    icon: 'info',
  },
  {
    id: 'find-similar',
    label: 'Find Similar Precincts',
    action: 'analyze:find-similar',
    icon: 'search',
  },
  {
    id: 'whatif-turnout',
    label: 'Model Turnout Scenarios',
    action: 'analyze:whatif-turnout',
    icon: 'trending-up',
  },
  {
    id: 'add-to-segment',
    label: 'Add to Segment',
    action: 'segment:add',
    icon: 'plus',
  },
  {
    id: 'view-history',
    label: 'View Election History',
    action: 'analyze:election-history',
    icon: 'clock',
  },
];

const JURISDICTION_ACTIONS: SuggestedAction[] = [
  {
    id: 'show-trends',
    label: 'Show Election Trends',
    action: 'analyze:show-trends',
    icon: 'bar-chart',
  },
  {
    id: 'demographics',
    label: 'Demographic Breakdown',
    action: 'analyze:demographics',
    icon: 'users',
  },
  {
    id: 'rank-precincts',
    label: 'Rank Precincts by Priority',
    action: 'analyze:rank-precincts',
    icon: 'list',
  },
  {
    id: 'create-canvass',
    label: 'Create Canvass Universe',
    action: 'canvass:create-from-jurisdiction',
    icon: 'map',
  },
];

const COMPARISON_ACTIONS: SuggestedAction[] = [
  {
    id: 'export-comparison',
    label: 'Export Comparison PDF',
    action: 'export:comparison-pdf',
    icon: 'download',
  },
  {
    id: 'swap-areas',
    label: 'Swap Comparison Areas',
    action: 'compare:swap',
    icon: 'refresh',
  },
  {
    id: 'compare-to-average',
    label: 'Compare to County Average',
    action: 'compare:to-average',
    icon: 'percent',
  },
  {
    id: 'add-third-area',
    label: 'Add Third Area',
    action: 'compare:add-area',
    icon: 'plus',
  },
];

const SEGMENT_ACTIONS: SuggestedAction[] = [
  {
    id: 'save-segment',
    label: 'Save Segment',
    action: 'segment:save',
    icon: 'save',
    variant: 'primary',
  },
  {
    id: 'show-on-map',
    label: 'Show on Map',
    action: 'map:highlight-segment',
    icon: 'map',
  },
  {
    id: 'create-canvass-from-segment',
    label: 'Create Canvass Universe',
    action: 'canvass:create-from-segment',
    icon: 'route',
  },
  {
    id: 'export-segment',
    label: 'Export to CSV',
    action: 'export:segment-csv',
    icon: 'download',
  },
  {
    id: 'refine-segment',
    label: 'Refine Filters',
    action: 'segment:refine',
    icon: 'filter',
  },
];

const CANVASS_ACTIONS: SuggestedAction[] = [
  {
    id: 'generate-walk-lists',
    label: 'Generate Walk Lists',
    action: 'canvass:generate-walks',
    icon: 'file-text',
    variant: 'primary',
  },
  {
    id: 'assign-volunteers',
    label: 'Assign Volunteers',
    action: 'canvass:assign',
    icon: 'users',
  },
  {
    id: 'export-van',
    label: 'Export to VAN',
    action: 'export:van',
    icon: 'upload',
  },
  {
    id: 'optimize-turfs',
    label: 'Optimize Turf Size',
    action: 'canvass:optimize',
    icon: 'sliders',
  },
];

const DONOR_ACTIONS: SuggestedAction[] = [
  {
    id: 'show-donor-heatmap',
    label: 'Show Donor Heatmap',
    action: 'map:donor-heatmap',
    icon: 'map',
  },
  {
    id: 'find-lapsed',
    label: 'Find Lapsed Donors',
    action: 'donor:lapsed',
    icon: 'user-x',
  },
  {
    id: 'upgrade-prospects',
    label: 'Find Upgrade Prospects',
    action: 'donor:upgrade',
    icon: 'trending-up',
  },
  {
    id: 'compare-fundraising',
    label: 'Compare Fundraising',
    action: 'donor:comparison',
    icon: 'layers',
  },
  {
    id: 'show-outside-money',
    label: 'Show Outside Money',
    action: 'donor:ie',
    icon: 'dollar-sign',
  },
  {
    id: 'show-momentum',
    label: 'Show Contribution Momentum',
    action: 'donor:momentum',
    icon: 'trending-up',
  },
  {
    id: 'export-donors',
    label: 'Export Donor List',
    action: 'export:donors-csv',
    icon: 'download',
  },
];

const POLL_ACTIONS: SuggestedAction[] = [
  {
    id: 'show-poll-trend',
    label: 'Show Poll Trend',
    action: 'poll:show-trend',
    icon: 'line-chart',
  },
  {
    id: 'compare-races',
    label: 'Compare to Other Races',
    action: 'poll:compare-races',
    icon: 'layers',
  },
  {
    id: 'view-methodology',
    label: 'View Methodology',
    action: 'poll:methodology',
    icon: 'info',
  },
];

const REPORT_ACTIONS: SuggestedAction[] = [
  {
    id: 'generate-report',
    label: 'Generate Campaign Report',
    action: 'report:generate',
    icon: 'file-text',
    variant: 'primary',
  },
  {
    id: 'add-to-report',
    label: 'Add to Report',
    action: 'report:add',
    icon: 'plus',
  },
  {
    id: 'preview-report',
    label: 'Preview Report',
    action: 'report:preview',
    icon: 'eye',
  },
];

const GOTV_STRATEGY_ACTIONS: SuggestedAction[] = [
  {
    id: 'gotv-priorities',
    label: 'Show GOTV Priorities',
    action: 'filter:gotv-priority',
    icon: 'users',
    variant: 'primary',
  },
  {
    id: 'low-turnout',
    label: 'Find Low-Turnout Areas',
    action: 'filter:low-turnout',
    icon: 'alert-triangle',
  },
  {
    id: 'base-voters',
    label: 'Identify Base Voters',
    action: 'filter:base-voters',
    icon: 'check-circle',
  },
];

const PERSUASION_STRATEGY_ACTIONS: SuggestedAction[] = [
  {
    id: 'persuasion-targets',
    label: 'Show Persuasion Targets',
    action: 'filter:persuasion',
    icon: 'message-circle',
    variant: 'primary',
  },
  {
    id: 'swing-voters',
    label: 'Find Swing Voters',
    action: 'filter:swing-potential',
    icon: 'repeat',
  },
  {
    id: 'ticket-splitters',
    label: 'Identify Ticket-Splitters',
    action: 'filter:ticket-split',
    icon: 'shuffle',
  },
];

// ============================================================================
// Engine Implementation
// ============================================================================

export class PoliticalSuggestedActionsEngine {
  private static instance: PoliticalSuggestedActionsEngine;
  private maxActions = 5;

  private constructor() {}

  static getInstance(): PoliticalSuggestedActionsEngine {
    if (!PoliticalSuggestedActionsEngine.instance) {
      PoliticalSuggestedActionsEngine.instance = new PoliticalSuggestedActionsEngine();
    }
    return PoliticalSuggestedActionsEngine.instance;
  }

  /**
   * Generate context-aware suggested actions
   */
  generateActions(context: ActionContext): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // 1. Add view-specific actions
    actions.push(...this.getViewActions(context));

    // 2. Add strategy-specific actions if strategy is set
    if (context.targetingStrategy) {
      actions.push(...this.getStrategyActions(context.targetingStrategy));
    }

    // 3. Add tool-specific actions based on active tool
    if (context.activeTool) {
      actions.push(...this.getToolActions(context.activeTool));
    }

    // 4. Add follow-up actions based on last action
    if (context.lastAction) {
      actions.push(...this.getFollowUpActions(context.lastAction, context));
    }

    // 5. Add report action if there are analysis results
    if (context.analysisResults && context.analysisResults.length > 0) {
      actions.push({
        id: 'generate-report',
        label: 'Generate Campaign Report',
        action: 'report:generate',
        icon: 'file-text',
        variant: 'secondary',
      });
    }

    // Deduplicate and limit
    const unique = this.deduplicateActions(actions);
    return this.prioritizeActions(unique).slice(0, this.maxActions);
  }

  /**
   * Get actions based on current view
   */
  private getViewActions(context: ActionContext): SuggestedAction[] {
    switch (context.currentView) {
      case 'precinct':
        return PRECINCT_ACTIONS;
      case 'jurisdiction':
        return JURISDICTION_ACTIONS;
      case 'comparison':
        return COMPARISON_ACTIONS;
      case 'overview':
      default:
        return UNIVERSAL_ACTIONS;
    }
  }

  /**
   * Get actions based on targeting strategy
   */
  private getStrategyActions(strategy: 'gotv' | 'persuasion' | 'battleground'): SuggestedAction[] {
    switch (strategy) {
      case 'gotv':
        return GOTV_STRATEGY_ACTIONS;
      case 'persuasion':
        return PERSUASION_STRATEGY_ACTIONS;
      case 'battleground':
        // Battleground combines both strategies
        return [...GOTV_STRATEGY_ACTIONS.slice(0, 1), ...PERSUASION_STRATEGY_ACTIONS.slice(0, 1)];
      default:
        return [];
    }
  }

  /**
   * Get actions based on active tool
   */
  private getToolActions(tool: string): SuggestedAction[] {
    switch (tool) {
      case 'segment':
        return SEGMENT_ACTIONS;
      case 'canvass':
        return CANVASS_ACTIONS;
      case 'donor':
        return DONOR_ACTIONS;
      case 'poll':
        return POLL_ACTIONS;
      case 'comparison':
        return COMPARISON_ACTIONS;
      default:
        return [];
    }
  }

  /**
   * Get follow-up actions based on what user just did
   */
  private getFollowUpActions(lastAction: string, context: ActionContext): SuggestedAction[] {
    // Parse last action
    const [category, operation] = lastAction.split(':');

    switch (category) {
      case 'segment':
        // After segmentation, suggest next steps
        if (operation === 'query' || operation === 'create') {
          return [
            { id: 'save-segment', label: 'Save Segment', action: 'segment:save', icon: 'save', variant: 'primary' },
            { id: 'create-canvass', label: 'Create Canvass', action: 'canvass:create-from-segment', icon: 'route' },
            { id: 'show-on-map', label: 'Show on Map', action: 'map:highlight-segment', icon: 'map' },
          ];
        }
        break;

      case 'canvass':
        // After canvass creation
        if (operation === 'create' || operation === 'create-from-segment') {
          return [
            { id: 'generate-walks', label: 'Generate Walk Lists', action: 'canvass:generate-walks', icon: 'file-text', variant: 'primary' },
            { id: 'optimize', label: 'Optimize Turfs', action: 'canvass:optimize', icon: 'sliders' },
          ];
        }
        break;

      case 'compare':
        // After comparison
        return [
          { id: 'export-pdf', label: 'Export PDF', action: 'export:comparison-pdf', icon: 'download' },
          { id: 'swap', label: 'Swap Areas', action: 'compare:swap', icon: 'refresh' },
        ];

      case 'donor':
        // After donor analysis
        if (operation === 'concentration' || operation === 'query' || operation === 'geographic') {
          return [
            { id: 'find-prospects', label: 'Find Prospects', action: 'donor:find-prospects', icon: 'search' },
            { id: 'show-heatmap', label: 'Show Heatmap', action: 'map:donor-heatmap', icon: 'map' },
          ];
        }
        if (operation === 'lapsed' || operation === 'lapsed_clusters') {
          return [
            { id: 'create-call-list', label: 'Create Call List', action: 'export:lapsed-calls', icon: 'phone' },
            { id: 'see-clusters', label: 'Show Clusters', action: 'donor:lapsed_clusters', icon: 'map' },
            { id: 'recovery-plan', label: 'Recovery Strategy', action: 'donor:recovery_plan', icon: 'target' },
          ];
        }
        if (operation === 'upgrade' || operation === 'upgrade_top') {
          return [
            { id: 'create-ask-sheet', label: 'Create Ask Sheet', action: 'export:upgrade_sheet', icon: 'file-text' },
            { id: 'filter-loyal', label: 'Show Loyal Donors', action: 'filter:loyal', icon: 'heart' },
          ];
        }
        if (operation === 'comparison') {
          return [
            { id: 'show-geographic', label: 'Geographic Breakdown', action: 'donor:geographic_compare', icon: 'map' },
            { id: 'see-ie', label: 'See Outside Money', action: 'donor:ie', icon: 'dollar-sign' },
          ];
        }
        if (operation === 'ie' || operation === 'ie_spending') {
          return [
            { id: 'compare-ie', label: 'Compare IE', action: 'donor:ie_compare', icon: 'layers' },
            { id: 'see-committees', label: 'PAC Details', action: 'donor:committee', icon: 'briefcase' },
          ];
        }
        break;

      case 'poll':
        // After poll query
        return [
          { id: 'show-trend', label: 'Show Trend', action: 'poll:show-trend', icon: 'line-chart' },
          { id: 'compare-races', label: 'Compare Races', action: 'poll:compare-races', icon: 'layers' },
        ];

      case 'map':
        // After map interaction
        if (operation === 'select' && context.selectedPrecincts.length > 0) {
          return context.selectedPrecincts.length === 1
            ? PRECINCT_ACTIONS.slice(0, 3)
            : [
                { id: 'compare-selected', label: 'Compare Selected', action: 'compare:selected', icon: 'layers' },
                { id: 'create-segment', label: 'Create Segment', action: 'segment:from-selection', icon: 'plus' },
              ];
        }
        break;

      case 'filter':
        // After applying a filter
        return [
          { id: 'save-as-segment', label: 'Save as Segment', action: 'segment:save-filter', icon: 'save' },
          { id: 'refine-filter', label: 'Refine Filter', action: 'filter:refine', icon: 'filter' },
          { id: 'clear-filter', label: 'Clear Filter', action: 'filter:clear', icon: 'x' },
        ];
    }

    return [];
  }

  /**
   * Generate actions from conversation context
   */
  generateFromConversation(messages: Message[]): SuggestedAction[] {
    if (messages.length === 0) return UNIVERSAL_ACTIONS;

    const lastMessage = messages[messages.length - 1];

    // If last message has actions, return them
    if (lastMessage.actions && lastMessage.actions.length > 0) {
      return lastMessage.actions;
    }

    // Analyze conversation for context clues
    const recentContent = messages
      .slice(-3)
      .map(m => m.content.toLowerCase())
      .join(' ');

    // Detect topics and return relevant actions
    if (recentContent.includes('donor') || recentContent.includes('fundrais')) {
      return DONOR_ACTIONS.slice(0, this.maxActions);
    }
    if (recentContent.includes('canvass') || recentContent.includes('door') || recentContent.includes('knock')) {
      return CANVASS_ACTIONS.slice(0, this.maxActions);
    }
    if (recentContent.includes('segment') || recentContent.includes('filter')) {
      return SEGMENT_ACTIONS.slice(0, this.maxActions);
    }
    if (recentContent.includes('poll') || recentContent.includes('survey')) {
      return POLL_ACTIONS.slice(0, this.maxActions);
    }
    if (recentContent.includes('compare') || recentContent.includes('versus') || recentContent.includes('vs')) {
      return COMPARISON_ACTIONS.slice(0, this.maxActions);
    }
    if (recentContent.includes('gotv') || recentContent.includes('turnout')) {
      return GOTV_STRATEGY_ACTIONS.slice(0, this.maxActions);
    }
    if (recentContent.includes('persuad') || recentContent.includes('swing')) {
      return PERSUASION_STRATEGY_ACTIONS.slice(0, this.maxActions);
    }

    // Default to universal actions
    return UNIVERSAL_ACTIONS;
  }

  /**
   * Remove duplicate actions
   */
  private deduplicateActions(actions: SuggestedAction[]): SuggestedAction[] {
    const seen = new Set<string>();
    return actions.filter(action => {
      if (seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    });
  }

  /**
   * Prioritize actions (primary first, then by relevance)
   */
  private prioritizeActions(actions: SuggestedAction[]): SuggestedAction[] {
    return actions.sort((a, b) => {
      // Primary variant first
      if (a.variant === 'primary' && b.variant !== 'primary') return -1;
      if (b.variant === 'primary' && a.variant !== 'primary') return 1;
      // Then secondary
      if (a.variant === 'secondary' && b.variant !== 'secondary') return -1;
      if (b.variant === 'secondary' && a.variant !== 'secondary') return 1;
      return 0;
    });
  }

  /**
   * Set maximum number of actions to return
   */
  setMaxActions(max: number): void {
    this.maxActions = max;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const suggestedActionsEngine = PoliticalSuggestedActionsEngine.getInstance();

export default PoliticalSuggestedActionsEngine;
