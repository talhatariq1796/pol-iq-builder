/**
 * Filter NLP Handler
 *
 * Translates natural language filter queries into map filter commands.
 * Supports queries like:
 * - "Show precincts with GOTV above 70"
 * - "Filter by swing potential"
 * - "Show only suburban areas"
 * - "Hide low-turnout precincts"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES } from './types';
import { handleFilterRequest } from '@/lib/ai/workflowHandlers';

// ============================================================================
// Query Patterns
// ============================================================================

const FILTER_PATTERNS: QueryPattern[] = [
  {
    intent: 'map_layer_change',
    patterns: [
      /filter\s+by\s+/i,
      /show\s+only\s+/i,
      /hide\s+/i,
      /precincts\s+with\s+/i,
      /precincts\s+where\s+/i,
      /areas\s+with\s+/i,
      /display\s+/i,
    ],
    keywords: ['filter', 'show', 'hide', 'only', 'with', 'where', 'display'],
    priority: 9,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const METRIC_PATTERNS: Record<string, RegExp> = {
  gotv: /\b(gotv|get\s*out\s*the\s*vote|turnout\s*priority)\b/i,
  persuasion: /\b(persuasion|persuadable|swing\s*voters)\b/i,
  swing: /\b(swing\s*potential|competitive|battleground)\b/i,
  turnout: /\b(turnout|voter\s*participation)\b/i,
  partisan_lean: /\b(partisan\s*lean|party\s*lean|dem|rep|democratic|republican)\b/i,
  combined: /\b(combined|overall|total\s*score)\b/i,
};

const DENSITY_PATTERNS: Record<string, RegExp> = {
  urban: /\b(urban|city|downtown|metro)\b/i,
  suburban: /\b(suburban|suburbs|outer)\b/i,
  rural: /\b(rural|country|farmland)\b/i,
};

const COMPARISON_PATTERNS = {
  above: /\b(above|greater\s*than|over|more\s*than|>\s*)\s*(\d+)/i,
  below: /\b(below|less\s*than|under|fewer\s*than|<\s*)\s*(\d+)/i,
  equals: /\b(equals?|exactly|=\s*)\s*(\d+)/i,
  between: /\bbetween\s+(\d+)\s+and\s+(\d+)/i,
};

const COMPETITIVENESS_PATTERNS: Record<string, RegExp> = {
  safe_d: /\b(safe\s*d|safely\s*democratic)\b/i,
  likely_d: /\b(likely\s*d|lean\s*democratic)\b/i,
  lean_d: /\b(lean\s*d)\b/i,
  toss_up: /\b(toss.?up|competitive|swing)\b/i,
  lean_r: /\b(lean\s*r)\b/i,
  likely_r: /\b(likely\s*r|lean\s*republican)\b/i,
  safe_r: /\b(safe\s*r|safely\s*republican)\b/i,
};

// ============================================================================
// Filter Handler Class
// ============================================================================

export class FilterHandler implements NLPHandler {
  name = 'FilterHandler';
  patterns = FILTER_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return query.intent === 'map_layer_change';
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      return await this.handleFilterQuery(query, startTime);
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('apply filters'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleFilterQuery(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract filter criteria
    const criteria = this.extractFilterCriteria(query.originalQuery);

    if (!criteria.metric && !criteria.density && !criteria.competitiveness) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
        suggestedActions: [
          {
            id: 'show-metrics',
            label: 'Show Available Metrics',
            description: 'See all filterable metrics',
            action: 'What metrics can I filter by?',
            priority: 1,
          },
          {
            id: 'example-filter',
            label: 'Example Filter',
            description: 'Show GOTV priority > 70',
            action: 'Show precincts with GOTV above 70',
            priority: 2,
          },
        ],
        metadata: this.buildMetadata('map_layer_change', startTime, query),
      };
    }

    // Execute filter via workflowHandlers
    const result = await handleFilterRequest(criteria);

    // Add metadata and ensure success is set
    return {
      ...result,
      success: true,
      metadata: this.buildMetadata('map_layer_change', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  private extractFilterCriteria(query: string): any {
    const criteria: any = {};

    // Extract metric
    for (const [metric, pattern] of Object.entries(METRIC_PATTERNS)) {
      if (pattern.test(query)) {
        criteria.metric = metric;
        break;
      }
    }

    // Extract density
    for (const [density, pattern] of Object.entries(DENSITY_PATTERNS)) {
      if (pattern.test(query)) {
        if (!criteria.density) criteria.density = [];
        criteria.density.push(density);
      }
    }

    // Extract competitiveness
    for (const [comp, pattern] of Object.entries(COMPETITIVENESS_PATTERNS)) {
      if (pattern.test(query)) {
        if (!criteria.competitiveness) criteria.competitiveness = [];
        criteria.competitiveness.push(comp);
      }
    }

    // Extract threshold
    const aboveMatch = query.match(COMPARISON_PATTERNS.above);
    if (aboveMatch) {
      criteria.threshold = parseInt(aboveMatch[2]);
      criteria.operator = '>=';
    }

    const belowMatch = query.match(COMPARISON_PATTERNS.below);
    if (belowMatch) {
      criteria.threshold = parseInt(belowMatch[2]);
      criteria.operator = '<=';
    }

    const equalsMatch = query.match(COMPARISON_PATTERNS.equals);
    if (equalsMatch) {
      criteria.threshold = parseInt(equalsMatch[2]);
      criteria.operator = '=';
    }

    const betweenMatch = query.match(COMPARISON_PATTERNS.between);
    if (betweenMatch) {
      criteria.minThreshold = parseInt(betweenMatch[1]);
      criteria.maxThreshold = parseInt(betweenMatch[2]);
      criteria.operator = 'between';
    }

    // Detect "high" or "low" modifiers
    if (/\bhigh\b/i.test(query) && !criteria.threshold) {
      criteria.threshold = 70;
      criteria.operator = '>=';
    }

    if (/\blow\b/i.test(query) && !criteria.threshold) {
      criteria.threshold = 40;
      criteria.operator = '<=';
    }

    return criteria;
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(
    intent: string,
    startTime: number,
    query: ParsedQuery
  ): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'filter',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const filterHandler = new FilterHandler();

export default FilterHandler;
