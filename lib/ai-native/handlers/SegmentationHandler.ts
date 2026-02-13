/**
 * Segmentation NLP Handler
 *
 * Translates natural language segment queries into SegmentEngine filters.
 * Supports queries like:
 * - "Build a segment of suburban swing voters"
 * - "Find precincts with high GOTV priority"
 * - "Show me young voter precincts in East Lansing"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ConvertedFilters,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, appendSources, getEnrichmentForQuery, formatEnrichmentSections, createPrecinctsSection, createSourcesSection } from './types';
import type { SegmentFilters, SegmentResults } from '@/lib/segmentation/types';
import { mapCommandBridge } from '../MapCommandBridge';
import { SegmentEngine } from '@/lib/segmentation/SegmentEngine';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// ============================================================================
// Query Patterns
// ============================================================================

const SEGMENT_PATTERNS: QueryPattern[] = [
  // Precinct lookup patterns (highest priority for direct lookups)
  {
    intent: 'precinct_lookup',
    patterns: [
      /tell\s+(?:me\s+)?about\s+(.+?)(?:\s+precinct|\s+ward)/i,
      /(?:show|display|view)\s+(?:me\s+)?(.+?)(?:\s+precinct|\s+ward)/i,
      /(?:what|how)\s+(?:is|about)\s+(.+?)(?:\s+precinct|\s+ward)/i,
      /precinct\s+(?:details?|info|profile)\s+(?:for\s+)?(.+)/i,
      /(?:details?|info|profile)\s+(?:for|of|on)\s+(.+?)(?:\s+precinct|\s+ward)/i,
      /^(.+?)\s+(?:precinct|ward)\s+(?:details?|info|profile)$/i,
    ],
    keywords: ['precinct', 'ward', 'about', 'tell', 'details', 'info', 'profile'],
    priority: 9,
  },
  // Segment by district patterns
  {
    intent: 'segment_by_district',
    patterns: [
      /(?:find|show|get)\s+(?:voters?|precincts?)\s+in\s+(?:state\s+house|house\s+district|hd)\s*(?:district\s*)?\s*[-\s]?(\d+)/i,
      /(?:state\s+house|house\s+district|hd)\s*(?:district\s*)?\s*[-\s]?(\d+)\s+(?:precincts?|voters?)/i,
      /precincts?\s+(?:in|within|belonging\s+to)\s+(?:state\s+house|senate|district)\s+(\d+)/i,
      /voters?\s+in\s+(?:mi|michigan)?\s*-?\s*(\d+)/i,
    ],
    keywords: ['voters', 'in', 'state house', 'house district', 'senate', 'district'],
    priority: 9,
  },
  // Segment by election patterns
  {
    intent: 'segment_by_election',
    patterns: [
      /precincts?\s+(?:that\s+)?voted\s+(\d+)%?\+?\s+(?:for\s+)?(?:biden|trump|harris|slotkin|rogers)/i,
      /(?:show|find)\s+(?:me\s+)?precincts?\s+(?:where|that)\s+(?:biden|trump|harris)\s+(?:won|got)\s+(?:over|more\s+than)\s+(\d+)%?/i,
      /(?:biden|trump|harris|democrat|republican)\s+precincts?\s+(?:above|over)\s+(\d+)%?/i,
      /precincts?\s+(?:with\s+)?(?:d|r)\s*\+\s*(\d+)/i,
      /(?:find|show)\s+(?:me\s+)?(?:strong|solid)\s+(?:democratic|republican|d|r)\s+precincts?/i,
    ],
    keywords: ['voted', 'biden', 'trump', 'harris', 'democrat', 'republican', 'won', 'election'],
    priority: 9,
  },
  // Segment by tapestry patterns
  {
    intent: 'segment_by_tapestry',
    patterns: [
      /(?:find|show|which)\s+(?:precincts?\s+)?(?:with|have|are)\s+(.+?)\s+tapestry/i,
      /tapestry\s+(?:segment\s+)?(.+?)\s+precincts?/i,
      /college\s+towns?\s+precincts?/i,
      /(.+?)\s+lifestyle\s+(?:segment|group)/i,
      /(?:find|show)\s+(?:me\s+)?(.+?)\s+tapestry\s+(?:areas?|precincts?)/i,
      /precincts?\s+(?:in|with)\s+(?:the\s+)?(.+?)\s+(?:tapestry|segment)/i,
    ],
    keywords: ['tapestry', 'lifestyle', 'segment', 'college towns', 'urban', 'suburban', 'rural'],
    priority: 8,
  },
  {
    intent: 'segment_create',
    patterns: [
      /build\s+(?:a\s+)?segment/i,
      /create\s+(?:a\s+)?segment/i,
      /make\s+(?:a\s+)?segment/i,
      /new\s+segment/i,
    ],
    keywords: ['build', 'create', 'make', 'segment', 'new'],
    priority: 10,
  },
  {
    intent: 'segment_find',
    patterns: [
      /find\s+(?:all\s+)?precincts(?!\s+near)/i, // Exclude spatial queries like "find precincts near X"
      /show\s+(?:me\s+)?precincts(?!\s+near)/i, // Exclude spatial queries
      /which\s+precincts/i,
      /what\s+precincts/i,
      /list\s+precincts/i,
      /precincts\s+(?:with|where|that)/i,
      // Targeting score patterns - high priority for voter targeting queries
      /find\s+(?:high\s+)?(?:swing|gotv|persuasion|turnout)\s+(?:potential\s+)?precincts?/i,
      /show\s+(?:me\s+)?(?:high\s+)?(?:swing|gotv|persuasion|turnout)\s+(?:potential\s+)?precincts?/i,
      /(?:high|low)\s+(?:swing|gotv|persuasion|turnout)\s+(?:potential\s+)?(?:precincts?|areas?)/i,
      /(?:swing|gotv|persuasion)\s+(?:target|priority|opportunity)\s+precincts?/i,
      /(?:suburban|urban|rural)\s+(?:swing|gotv|persuasion)\s+(?:precincts?|voters?)/i,
    ],
    keywords: ['find', 'show', 'which', 'what', 'list', 'precincts', 'where', 'swing', 'gotv', 'persuasion', 'turnout', 'targeting'],
    priority: 9, // Increase priority to beat IssueHandler
  },
  {
    intent: 'segment_save',
    patterns: [
      /save\s+(?:this\s+)?segment/i,
      /save\s+as/i,
      /name\s+this\s+segment/i,
    ],
    keywords: ['save', 'name', 'segment'],
    priority: 6,
  },
  {
    intent: 'segment_export',
    patterns: [
      /export\s+(?:this\s+)?segment/i,
      /download\s+segment/i,
      /export\s+to\s+csv/i,
    ],
    keywords: ['export', 'download', 'csv'],
    priority: 6,
  },
  // Compare segments
  {
    intent: 'segment_compare',
    patterns: [
      /compare\s+(?:my\s+)?(?:segments?|(.+?))\s+(?:to|vs|versus|and)\s+(.+?)\s+segments?/i,
      /segment\s+comparison/i,
      /(.+?)\s+vs\s+(.+?)\s+segment/i,
      /compare\s+(.+?)\s+(?:segment\s+)?(?:to|vs|and)\s+(.+)/i,
      /(?:side.?by.?side|head.?to.?head)\s+(?:segment\s+)?comparison/i,
    ],
    keywords: ['compare', 'segments', 'versus', 'vs', 'side by side', 'comparison'],
    priority: 9,
  },
  // Lookalike segments
  {
    intent: 'segment_lookalike',
    patterns: [
      /find\s+(?:precincts?\s+)?(?:like|similar\s+to)\s+(.+)/i,
      /(?:precincts?|areas?)\s+similar\s+to\s+(.+)/i,
      /lookalike\s+(?:for|of|to)\s+(.+)/i,
      /(?:more\s+)?precincts?\s+like\s+(.+)/i,
      /clone\s+(.+?)\s+segment/i,
      /expand\s+(?:from\s+)?(.+)/i,
    ],
    keywords: ['similar', 'like', 'lookalike', 'clone', 'expand', 'more like'],
    priority: 9,
  },
  // Donor overlap with segments
  {
    intent: 'segment_donor_overlap',
    patterns: [
      /(?:high.?donor|donor)\s+(?:and\s+)?(?:gotv|swing|persuasion)\s+precincts?/i,
      /(?:gotv|swing|persuasion)\s+precincts?\s+with\s+(?:high\s+)?donors?/i,
      /donor\s+overlap\s+(?:with\s+)?(.+)/i,
      /(?:combine|overlay|intersect)\s+donors?\s+(?:with|and)\s+(.+)/i,
      /(?:where|precincts?)\s+(?:are\s+)?(?:donors?\s+and\s+|both\s+)(.+)/i,
      /fundrais(?:ing|er)\s+(?:targets?|priority)\s+(?:with|and)\s+(?:gotv|swing)/i,
    ],
    keywords: ['donor', 'overlap', 'gotv', 'combine', 'intersect', 'high-donor'],
    priority: 9,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const DENSITY_PATTERNS: Record<string, RegExp> = {
  urban: /\b(urban|city|downtown|metro)\b/i,
  suburban: /\b(suburban|suburbs|outer)\b/i,
  rural: /\b(rural|country|farmland)\b/i,
};

const STRATEGY_PATTERNS: Record<string, RegExp> = {
  gotv: /\b(gotv|get\s*out\s*the\s*vote|turnout|mobiliz)/i,
  persuasion: /\b(persuad|swing|undecided|persuasion)/i,
  battleground: /\b(battleground|competitive|toss.?up|close)/i,
  base: /\b(base|loyal|safe|solid)/i,
};

const DEMOGRAPHIC_PATTERNS = {
  young: /\b(young|youth|millennial|gen.?z|18.?34|college.?age)\b/i,
  middle: /\b(middle.?age|35.?54|family|working.?age)\b/i,
  senior: /\b(senior|elderly|retired|55\+|65\+|older)\b/i,
  highIncome: /\b(high.?income|wealthy|affluent|rich)\b/i,
  lowIncome: /\b(low.?income|poor|working.?class)\b/i,
  college: /\b(college|educated|degree|university)\b/i,
};

const SCORE_PATTERNS = {
  high: /\bhigh\s+(gotv|persuasion|swing|turnout)/i,
  low: /\blow\s+(gotv|persuasion|swing|turnout)/i,
  threshold: /\b(gotv|persuasion|swing|turnout)\s*[><=]+\s*(\d+)/i,
  // Natural language thresholds: "swing potential over 60", "GOTV priority above 50"
  naturalThreshold: /\b(gotv|persuasion|swing|turnout)\s*(?:potential|priority|score|opportunity)?\s*(over|above|greater\s+than|more\s+than|at\s+least|minimum)\s*(\d+)/i,
  naturalThresholdBelow: /\b(gotv|persuasion|swing|turnout)\s*(?:potential|priority|score|opportunity)?\s*(under|below|less\s+than|fewer\s+than|at\s+most|maximum)\s*(\d+)/i,
  // Education threshold: "college education above 40%", "education level over 50"
  educationThreshold: /\b(?:college\s+)?(?:education|educated|degree)\s*(?:level|rate|percentage)?\s*(over|above|greater\s+than|more\s+than|at\s+least)\s*(\d+)/i,
  // Turnout threshold: "turnout under 65%", "turnout below 70"
  turnoutThreshold: /\bturnout\s*(?:rate|percentage)?\s*(under|below|less\s+than|at\s+most)\s*(\d+)%?/i,
  turnoutThresholdAbove: /\bturnout\s*(?:rate|percentage)?\s*(over|above|greater\s+than|at\s+least)\s*(\d+)%?/i,
};

// Partisan lean patterns: "D+15 or higher", "lean D+15+", "D+15 or more"
const PARTISAN_LEAN_PATTERNS = {
  // D+N or higher / D+N+ / D+N or more
  demMin: /\b(?:d|dem|democratic)\s*\+\s*(\d+)\s*(?:\+|or\s+(?:higher|more|greater|above))?/i,
  // R+N or higher / R+N+ / R+N or more
  repMin: /\b(?:r|rep|republican)\s*\+\s*(\d+)\s*(?:\+|or\s+(?:higher|more|greater|above))?/i,
  // "lean D+15" or "D+15 lean"
  leanDem: /\b(?:lean\s+)?(?:d|dem)\s*\+\s*(\d+)/i,
  leanRep: /\b(?:lean\s+)?(?:r|rep)\s*\+\s*(\d+)/i,
  // Range: "D+5 to D+15"
  demRange: /\b(?:d|dem)\s*\+\s*(\d+)\s+to\s+(?:d|dem)?\s*\+?\s*(\d+)/i,
};

const JURISDICTION_PATTERNS = [
  /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
  /\b(lansing|east\s+lansing|meridian|delhi|williamston|mason|okemos)/i,
];

// ============================================================================
// Segmentation Handler Class
// ============================================================================

export class SegmentationHandler implements NLPHandler {
  name = 'SegmentationHandler';
  patterns = SEGMENT_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'segment_create' ||
      query.intent === 'segment_find' ||
      query.intent === 'segment_save' ||
      query.intent === 'segment_export' ||
      query.intent === 'precinct_lookup' ||
      query.intent === 'segment_by_district' ||
      query.intent === 'segment_by_election' ||
      query.intent === 'segment_by_tapestry' ||
      query.intent === 'segment_compare' ||
      query.intent === 'segment_lookalike' ||
      query.intent === 'segment_donor_overlap'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'segment_create':
        case 'segment_find':
          return await this.handleSegmentQuery(query, startTime);

        case 'segment_save':
          return await this.handleSegmentSave(query, startTime);

        case 'segment_export':
          return await this.handleSegmentExport(query, startTime);

        case 'precinct_lookup':
          return await this.handlePrecinctLookup(query, startTime);

        case 'segment_by_district':
          return await this.handleSegmentByDistrict(query, startTime);

        case 'segment_by_election':
          return await this.handleSegmentByElection(query, startTime);

        case 'segment_by_tapestry':
          return await this.handleSegmentByTapestry(query, startTime);

        case 'segment_compare':
          return await this.handleSegmentCompare(query, startTime);

        case 'segment_lookalike':
          return await this.handleSegmentLookalike(query, startTime);

        case 'segment_donor_overlap':
          return await this.handleSegmentDonorOverlap(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown segment intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process segment query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleSegmentQuery(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract entities and convert to filters
    const entities = this.extractEntities(query.originalQuery);
    const filters = this.convertToFilters(entities);

    // Execute segment query
    const results = await this.executeSegmentQuery(filters);

    if (results.precinctCount === 0) {
      return {
        success: true,
        response: RESPONSE_TEMPLATES.segment.empty(this.describeFilters(entities)),
        suggestedActions: [
          {
            id: 'broaden-search',
            label: 'Broaden Search',
            description: 'Remove some filters to find more precincts',
            action: 'modify_filters',
            priority: 1,
          },
          {
            id: 'show-all',
            label: 'Show All Precincts',
            description: 'Display all precincts without filters',
            action: 'clear_filters',
            priority: 2,
          },
        ],
        metadata: this.buildMetadata('segment_find', startTime, query),
      };
    }

    // Generate map commands
    const mapCommands = this.generateMapCommands(results);

    // Generate response (includes collapsible precincts and sources sections)
    const segmentName = this.generateSegmentName(entities);

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    // Response already has collapsible sources, just add enrichment
    const response = this.generateResponse(results, entities, segmentName) + enrichmentSections;

    return {
      success: true,
      response,
      mapCommands,
      suggestedActions: this.generateSuggestedActions(results, segmentName),
      data: { results, filters, segmentName },
      metadata: this.buildMetadata('segment_find', startTime, query),
    };
  }

  private async handleSegmentSave(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract segment name from query
    const nameMatch = query.originalQuery.match(/save\s+(?:as\s+)?["']?([^"']+)["']?/i);
    const segmentName = nameMatch ? nameMatch[1].trim() : 'Untitled Segment';

    // Segment saving is done via /segments page, not chat
    return {
      success: true,
      response: `To save a segment called "${segmentName}":\n\n1. Go to **/segments** from the sidebar\n2. Apply your desired filters\n3. Click **Save Segment** and enter the name\n\nSaved segments can be exported to CSV, used for canvassing, or loaded for later analysis.`,
      suggestedActions: [
        {
          id: 'go-to-segments',
          label: 'Go to Segments',
          description: 'Open the Segment Builder',
          action: 'Navigate to /segments',
          priority: 1,
        },
      ],
      metadata: this.buildMetadata('segment_save', startTime, query),
    };
  }

  private async handleSegmentExport(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const format = query.originalQuery.includes('json') ? 'json' : 'csv';

    return {
      success: true,
      response: RESPONSE_TEMPLATES.segment.exported('Current Segment', format),
      suggestedActions: [
        {
          id: 'open-file',
          label: 'Open Downloaded File',
          description: 'View exported data',
          action: 'open_download',
          priority: 1,
        },
      ],
      metadata: this.buildMetadata('segment_export', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract density types
    const densities: ('urban' | 'suburban' | 'rural')[] = [];
    for (const [type, pattern] of Object.entries(DENSITY_PATTERNS)) {
      if (pattern.test(query)) {
        densities.push(type as 'urban' | 'suburban' | 'rural');
      }
    }
    if (densities.length > 0) entities.density = densities;

    // Extract targeting strategy (but NOT if query contains explicit score thresholds)
    // e.g., "swing > 40" should use score filter, not add persuasion strategy
    const hasExplicitScoreThreshold = SCORE_PATTERNS.naturalThreshold.test(query) ||
      SCORE_PATTERNS.naturalThresholdBelow.test(query) ||
      /\b(gotv|persuasion|swing|turnout)\s*[><=]+\s*\d+/i.test(query);

    if (!hasExplicitScoreThreshold) {
      const strategies: ('gotv' | 'persuasion' | 'battleground' | 'base')[] = [];
      for (const [type, pattern] of Object.entries(STRATEGY_PATTERNS)) {
        if (pattern.test(query)) {
          strategies.push(type as 'gotv' | 'persuasion' | 'battleground' | 'base');
        }
      }
      if (strategies.length > 0) entities.strategy = strategies;
    }

    // Extract age cohort
    if (DEMOGRAPHIC_PATTERNS.young.test(query)) {
      entities.ageRange = [18, 35];
    } else if (DEMOGRAPHIC_PATTERNS.middle.test(query)) {
      entities.ageRange = [35, 55];
    } else if (DEMOGRAPHIC_PATTERNS.senior.test(query)) {
      entities.ageRange = [55, 100];
    }

    // Extract income level
    if (DEMOGRAPHIC_PATTERNS.highIncome.test(query)) {
      entities.incomeRange = [100000, 500000];
    } else if (DEMOGRAPHIC_PATTERNS.lowIncome.test(query)) {
      entities.incomeRange = [0, 50000];
    }

    // Extract score thresholds
    entities.scoreThresholds = {};

    // High/low modifiers
    const highMatch = query.match(SCORE_PATTERNS.high);
    if (highMatch) {
      const metric = highMatch[1].toLowerCase();
      if (metric === 'gotv') entities.scoreThresholds.gotv = { min: 60 };
      if (metric === 'persuasion') entities.scoreThresholds.persuasion = { min: 60 };
      if (metric === 'swing') entities.scoreThresholds.swing = { min: 50 };
      if (metric === 'turnout') entities.scoreThresholds.turnout = { min: 60 };
    }

    const lowMatch = query.match(SCORE_PATTERNS.low);
    if (lowMatch) {
      const metric = lowMatch[1].toLowerCase();
      if (metric === 'gotv') entities.scoreThresholds.gotv = { max: 40 };
      if (metric === 'persuasion') entities.scoreThresholds.persuasion = { max: 40 };
      if (metric === 'swing') entities.scoreThresholds.swing = { max: 30 };
      if (metric === 'turnout') entities.scoreThresholds.turnout = { max: 50 };
    }

    // Explicit thresholds (mathematical operators)
    const thresholdMatch = query.match(/\b(gotv|persuasion|swing|turnout)\s*([><=]+)\s*(\d+)/gi);
    if (thresholdMatch) {
      for (const match of thresholdMatch) {
        const parts = match.match(/(\w+)\s*([><=]+)\s*(\d+)/i);
        if (parts) {
          const [, metric, operator, value] = parts;
          const numValue = parseInt(value);
          const key = metric.toLowerCase() as 'gotv' | 'persuasion' | 'swing' | 'turnout';

          if (!entities.scoreThresholds[key]) entities.scoreThresholds[key] = {};

          if (operator.includes('>')) {
            entities.scoreThresholds[key]!.min = numValue;
          } else if (operator.includes('<')) {
            entities.scoreThresholds[key]!.max = numValue;
          }
        }
      }
    }

    // Natural language thresholds: "swing potential over 60", "GOTV priority above 50"
    const naturalMatch = query.match(SCORE_PATTERNS.naturalThreshold);
    if (naturalMatch) {
      const [, metric, , value] = naturalMatch;
      const numValue = parseInt(value);
      const key = metric.toLowerCase() as 'gotv' | 'persuasion' | 'swing' | 'turnout';

      if (!entities.scoreThresholds[key]) entities.scoreThresholds[key] = {};
      entities.scoreThresholds[key]!.min = numValue;
    }

    const naturalBelowMatch = query.match(SCORE_PATTERNS.naturalThresholdBelow);
    if (naturalBelowMatch) {
      const [, metric, , value] = naturalBelowMatch;
      const numValue = parseInt(value);
      const key = metric.toLowerCase() as 'gotv' | 'persuasion' | 'swing' | 'turnout';

      if (!entities.scoreThresholds[key]) entities.scoreThresholds[key] = {};
      entities.scoreThresholds[key]!.max = numValue;
    }

    // Education threshold: "college education above 40%"
    const educationMatch = query.match(SCORE_PATTERNS.educationThreshold);
    if (educationMatch) {
      const numValue = parseInt(educationMatch[2]);
      // Store education threshold in a new field
      entities.educationThreshold = { min: numValue };
    }

    // Turnout threshold: "turnout under 65%"
    const turnoutBelowMatch = query.match(SCORE_PATTERNS.turnoutThreshold);
    if (turnoutBelowMatch) {
      const numValue = parseInt(turnoutBelowMatch[2]);
      if (!entities.scoreThresholds) entities.scoreThresholds = {};
      if (!entities.scoreThresholds.turnout) entities.scoreThresholds.turnout = {};
      entities.scoreThresholds.turnout.max = numValue;
    }

    const turnoutAboveMatch = query.match(SCORE_PATTERNS.turnoutThresholdAbove);
    if (turnoutAboveMatch) {
      const numValue = parseInt(turnoutAboveMatch[2]);
      if (!entities.scoreThresholds) entities.scoreThresholds = {};
      if (!entities.scoreThresholds.turnout) entities.scoreThresholds.turnout = {};
      entities.scoreThresholds.turnout.min = numValue;
    }

    // Partisan lean thresholds: "D+15 or higher", "R+10+"
    const demMinMatch = query.match(PARTISAN_LEAN_PATTERNS.demMin);
    if (demMinMatch) {
      const numValue = parseInt(demMinMatch[1]);
      // Positive partisanLean = Democratic in our data
      entities.partisanLeanRange = { min: numValue };
    }

    const repMinMatch = query.match(PARTISAN_LEAN_PATTERNS.repMin);
    if (repMinMatch) {
      const numValue = parseInt(repMinMatch[1]);
      // Negative partisanLean = Republican, so R+15 means lean <= -15
      entities.partisanLeanRange = { max: -numValue };
    }

    const demRangeMatch = query.match(PARTISAN_LEAN_PATTERNS.demRange);
    if (demRangeMatch) {
      const minVal = parseInt(demRangeMatch[1]);
      const maxVal = parseInt(demRangeMatch[2]);
      // D+5 to D+15 means partisanLean between 5 and 15
      entities.partisanLeanRange = { min: minVal, max: maxVal };
    }

    // Extract jurisdictions
    for (const pattern of JURISDICTION_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        const jurisdiction = match[1].trim();
        if (!entities.jurisdictions) entities.jurisdictions = [];
        entities.jurisdictions.push(jurisdiction);
      }
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Filter Conversion
  // --------------------------------------------------------------------------

  convertToFilters(entities: ExtractedEntities): SegmentFilters {
    const filters: SegmentFilters = {};

    // Demographics
    if (entities.density || entities.ageRange || entities.incomeRange) {
      filters.demographics = {};

      if (entities.density) {
        filters.demographics.density = entities.density;
      }

      if (entities.ageRange) {
        filters.demographics.ageRange = entities.ageRange;
      }

      if (entities.incomeRange) {
        filters.demographics.incomeRange = entities.incomeRange;
      }

      // Education filter: college education percentage
      if (entities.educationThreshold?.min) {
        filters.demographics.minCollegePct = entities.educationThreshold.min;
      }
    }

    // Political
    if (entities.partyLean || entities.competitiveness || entities.partisanLeanRange) {
      filters.political = {};

      if (entities.partyLean) {
        filters.political.partyLean = entities.partyLean;
      }

      if (entities.competitiveness) {
        filters.political.competitiveness = entities.competitiveness as any;
      }

      // Partisan lean range: D+15 means min=15, R+15 means max=-15
      if (entities.partisanLeanRange) {
        filters.political.partisanLeanRange = [
          entities.partisanLeanRange.min ?? -100,
          entities.partisanLeanRange.max ?? 100,
        ];
      }
    }

    // Targeting
    if (entities.scoreThresholds || entities.strategy) {
      filters.targeting = {};

      if (entities.scoreThresholds?.gotv) {
        filters.targeting.gotvPriorityRange = [
          entities.scoreThresholds.gotv.min ?? 0,
          entities.scoreThresholds.gotv.max ?? 100,
        ];
      }

      if (entities.scoreThresholds?.persuasion) {
        filters.targeting.persuasionRange = [
          entities.scoreThresholds.persuasion.min ?? 0,
          entities.scoreThresholds.persuasion.max ?? 100,
        ];
      }

      if (entities.scoreThresholds?.swing) {
        filters.targeting.swingPotentialRange = [
          entities.scoreThresholds.swing.min ?? 0,
          entities.scoreThresholds.swing.max ?? 100,
        ];
      }

      if (entities.scoreThresholds?.turnout) {
        filters.targeting.turnoutRange = [
          entities.scoreThresholds.turnout.min ?? 0,
          entities.scoreThresholds.turnout.max ?? 100,
        ];
      }

      if (entities.strategy) {
        // Map to actual data values (Title Case in precinct data)
        const strategyMap: Record<string, string> = {
          gotv: 'Base Mobilization',
          persuasion: 'Persuasion Focus',
          battleground: 'Battleground',
          base: 'Base Mobilization',
        };
        filters.targeting.strategy = entities.strategy.map(
          (s) => strategyMap[s] as any
        );
      }
    }

    return filters;
  }

  // --------------------------------------------------------------------------
  // Query Execution
  // --------------------------------------------------------------------------

  private async executeSegmentQuery(filters: SegmentFilters): Promise<SegmentResults> {
    try {
      // Get real precinct data from PoliticalDataService
      const precincts = await politicalDataService.getSegmentEnginePrecincts();

      if (!precincts || precincts.length === 0) {
        console.warn('[SegmentationHandler] No precinct data available');
        return {
          matchingPrecincts: [],
          precinctCount: 0,
          totalPrecincts: 0,
          estimatedVoters: 0,
          estimatedVAP: 0,
          avgGOTV: 0,
          avgPersuasion: 0,
          avgPartisanLean: 0,
          avgTurnout: 0,
          strategyBreakdown: {},
          calculatedAt: new Date().toISOString(),
        };
      }

      // Create SegmentEngine with real data and execute query
      const engine = new SegmentEngine(precincts);
      const results = engine.query(filters);

      console.log('[SegmentationHandler] Query results:', {
        filters: Object.keys(filters),
        matchingPrecincts: results.precinctCount,
        totalPrecincts: results.totalPrecincts,
      });

      return results;
    } catch (error) {
      console.error('[SegmentationHandler] Error executing segment query:', error);
      return {
        matchingPrecincts: [],
        precinctCount: 0,
        totalPrecincts: 0,
        estimatedVoters: 0,
        estimatedVAP: 0,
        avgGOTV: 0,
        avgPersuasion: 0,
        avgPartisanLean: 0,
        avgTurnout: 0,
        strategyBreakdown: {},
        calculatedAt: new Date().toISOString(),
      };
    }
  }

  // --------------------------------------------------------------------------
  // Response Generation
  // --------------------------------------------------------------------------

  private generateResponse(
    results: SegmentResults,
    entities: ExtractedEntities,
    segmentName: string
  ): string {
    const lines: string[] = [];

    // Header with segment name
    const displayName = segmentName === 'Custom Segment' ? 'Voter Segment' : segmentName;
    lines.push(`## ${displayName}`);
    lines.push('');

    // Strategic assessment based on what was found
    const strategyEmoji = this.getStrategyEmoji(results);
    const strategyLabel = this.getStrategyLabel(results, entities);
    lines.push(`### ${strategyEmoji} Segment Overview`);
    lines.push('');
    lines.push(`**${results.precinctCount} precincts** with **${results.estimatedVoters.toLocaleString()}** registered voters`);
    lines.push('');
    lines.push(strategyLabel);
    lines.push('');

    // Key metrics section
    if (results.precinctCount > 0) {
      const gotvAssess = results.avgGOTV >= 70 ? 'high priority' : results.avgGOTV >= 50 ? 'moderate' : 'lower priority';
      const persuasionAssess = results.avgPersuasion >= 60 ? 'good target' : results.avgPersuasion >= 40 ? 'moderate' : 'lower priority';
      const turnoutAssess = results.avgTurnout >= 65 ? 'high' : results.avgTurnout >= 50 ? 'average' : 'below average';

      lines.push(`### 📈 Key Metrics`);
      lines.push('');
      lines.push(`- **GOTV Priority:** ${results.avgGOTV.toFixed(0)}/100 (${gotvAssess})`);
      lines.push(`- **Persuasion:** ${results.avgPersuasion.toFixed(0)}/100 (${persuasionAssess})`);
      lines.push(`- **Avg Turnout:** ${results.avgTurnout.toFixed(0)}% (${turnoutAssess})`);
      if (results.avgPartisanLean !== undefined) {
        const leanDir = results.avgPartisanLean >= 0 ? 'D' : 'R';
        const leanVal = Math.abs(results.avgPartisanLean).toFixed(1);
        lines.push(`- **Partisan Lean:** ${leanDir}+${leanVal}`);
      }
      lines.push('');

      // Top precincts section
      if (results.matchingPrecincts.length > 0) {
        lines.push(`### 🎯 Top Targets`);
        lines.push('');
        const top5 = results.matchingPrecincts.slice(0, 5);
        for (const p of top5) {
          const score = p.matchScore !== undefined ? ` (score: ${p.matchScore.toFixed(0)})` : '';
          lines.push(`- **${p.precinctName}** — ${p.jurisdiction}${score}`);
        }
        lines.push('');
      }

      // What this means section
      lines.push(`### 💡 What This Means`);
      lines.push('');
      lines.push(this.generateInsight(results, entities));
      lines.push('');

      // Collapsible precincts section
      const precinctNames = results.matchingPrecincts.map(p => p.precinctName);
      lines.push(createPrecinctsSection(precinctNames, 8));
      lines.push('');

      // Collapsible sources section
      lines.push(createSourcesSection(['elections', 'demographics']));
    }

    return lines.join('\n');
  }

  private getStrategyEmoji(results: SegmentResults): string {
    if (results.avgGOTV >= 70) return '🗳️';
    if (results.avgPersuasion >= 60) return '💬';
    if (results.avgPartisanLean !== undefined && Math.abs(results.avgPartisanLean) < 10) return '⚖️';
    return '🎯';
  }

  private getStrategyLabel(results: SegmentResults, entities: ExtractedEntities): string {
    const parts: string[] = [];

    if (entities.scoreThresholds?.swing?.min) {
      parts.push(`swing potential over ${entities.scoreThresholds.swing.min}`);
    }
    if (entities.scoreThresholds?.gotv?.min) {
      parts.push(`GOTV priority above ${entities.scoreThresholds.gotv.min}`);
    }
    if (entities.educationThreshold?.min) {
      parts.push(`college education above ${entities.educationThreshold.min}%`);
    }
    if (entities.density?.length) {
      parts.push(`${entities.density.join('/')} areas`);
    }

    if (parts.length === 0) {
      return 'These precincts match your specified criteria and represent potential targets for campaign outreach.';
    }

    return `Precincts with ${parts.join(' and ')} — ideal targets for persuasion and outreach efforts.`;
  }

  private generateInsight(results: SegmentResults, entities: ExtractedEntities): string {
    const insights: string[] = [];

    if (results.avgGOTV >= 70 && results.avgTurnout < 60) {
      insights.push(`High GOTV potential with room for turnout improvement (${results.avgTurnout.toFixed(0)}% avg).`);
    }

    if (results.avgPersuasion >= 50) {
      insights.push(`Strong persuasion opportunity — direct voter contact could be effective here.`);
    }

    if (results.avgPartisanLean !== undefined && Math.abs(results.avgPartisanLean) < 10) {
      insights.push(`Competitive territory — these precincts could swing either way.`);
    }

    if (entities.educationThreshold?.min && entities.educationThreshold.min >= 40) {
      insights.push(`College-educated voters respond well to policy-focused messaging.`);
    }

    if (insights.length === 0) {
      insights.push(`Consider these precincts for targeted outreach based on your campaign priorities.`);
    }

    return insights.join(' ');
  }

  private generateSegmentName(entities: ExtractedEntities): string {
    const parts: string[] = [];

    if (entities.density) {
      parts.push(entities.density.join('/'));
    }

    if (entities.strategy) {
      const strategyNames: Record<string, string> = {
        gotv: 'GOTV',
        persuasion: 'Persuasion',
        battleground: 'Battleground',
        base: 'Base',
      };
      parts.push(entities.strategy.map((s) => strategyNames[s]).join('/'));
    }

    if (entities.ageRange) {
      if (entities.ageRange[0] <= 35) parts.push('Young');
      else if (entities.ageRange[0] >= 55) parts.push('Senior');
    }

    if (entities.jurisdictions) {
      parts.push(entities.jurisdictions.join(', '));
    }

    if (parts.length === 0) {
      return 'Custom Segment';
    }

    return parts.join(' ');
  }

  private describeFilters(entities: ExtractedEntities): string {
    const parts: string[] = [];

    if (entities.density) {
      parts.push(entities.density.join(' or ') + ' areas');
    }

    if (entities.strategy) {
      parts.push(entities.strategy.join(' or ') + ' targets');
    }

    if (entities.scoreThresholds) {
      for (const [metric, threshold] of Object.entries(entities.scoreThresholds)) {
        if (threshold?.min) parts.push(`${metric} > ${threshold.min}`);
        if (threshold?.max) parts.push(`${metric} < ${threshold.max}`);
      }
    }

    return parts.length > 0 ? parts.join(', ') : 'specified criteria';
  }

  // --------------------------------------------------------------------------
  // Map Commands
  // --------------------------------------------------------------------------

  private generateMapCommands(results: SegmentResults): any[] {
    const commands: any[] = [];

    if (results.matchingPrecincts.length > 0) {
      // Highlight matching precincts
      commands.push({
        action: 'highlight',
        target: 'precincts',
        ids: results.matchingPrecincts.map((p) => p.precinctId),
        style: { fillColor: '#3B82F6', fillOpacity: 0.6 },
      });

      // Fit map to selection
      commands.push({
        action: 'fitBounds',
        target: 'selection',
      });
    }

    return commands;
  }

  // --------------------------------------------------------------------------
  // Suggested Actions
  // --------------------------------------------------------------------------

  private generateSuggestedActions(
    results: SegmentResults,
    segmentName: string
  ): any[] {
    const actions: any[] = [];

    if (results.precinctCount > 0) {
      actions.push({
        id: 'show-heatmap',
        label: 'Show GOTV Heatmap',
        description: 'Visualize GOTV priority on map',
        action: 'map:showHeatmap',
        metadata: { metric: 'gotv_priority' },
        priority: 1,
      });

      actions.push({
        id: 'go-to-segments',
        label: 'Build in Segment Tool',
        description: 'Save & export in /segments',
        action: 'Navigate to /segments',
        priority: 2,
      });

      actions.push({
        id: 'go-to-canvass',
        label: 'Plan Canvassing',
        description: 'Create walk lists in /canvass',
        action: 'Navigate to /canvass',
        priority: 3,
      });
    }

    return actions;
  }

  // --------------------------------------------------------------------------
  // New Handler Methods
  // --------------------------------------------------------------------------

  private async handlePrecinctLookup(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract precinct name from query
    const precinctPatterns = [
      /tell\s+(?:me\s+)?about\s+(.+?)(?:\s+precinct|\s+ward)/i,
      /(?:show|display|view)\s+(?:me\s+)?(.+?)(?:\s+precinct|\s+ward)/i,
      /precinct\s+(?:details?|info|profile)\s+(?:for\s+)?(.+)/i,
    ];

    let precinctName: string | null = null;
    for (const pattern of precinctPatterns) {
      const match = query.originalQuery.match(pattern);
      if (match) {
        precinctName = match[1].trim();
        break;
      }
    }

    if (!precinctName) {
      return {
        success: false,
        response: 'Please specify a precinct name. For example: "Tell me about Lansing Ward 1 Precinct"',
        suggestedActions: [
          {
            id: 'show-precincts',
            label: 'Show All Precincts',
            action: 'List all precincts',
            priority: 1,
          },
        ],
        error: 'No precinct specified',
      };
    }

    try {
      // Look up precinct data
      const precinct = await politicalDataService.getUnifiedPrecinct(precinctName);

      if (!precinct) {
        return {
          success: false,
          response: `Could not find precinct "${precinctName}". Try searching by jurisdiction like "Show precincts in East Lansing"`,
          suggestedActions: [
            {
              id: 'search-jurisdiction',
              label: 'Search by City',
              action: 'Show precincts in East Lansing',
              priority: 1,
            },
          ],
          error: 'Precinct not found',
        };
      }

      // Access nested properties from UnifiedPrecinct
      const partisanLean = precinct.electoral?.partisanLean ?? 0;
      const registeredVoters = precinct.demographics?.registeredVoters;
      const swingPotential = precinct.electoral?.swingPotential;
      const gotvPriority = precinct.targeting?.gotvPriority;
      const avgTurnout = precinct.electoral?.avgTurnout;
      const medianIncome = precinct.demographics?.medianHHI;
      const density = precinct.demographics?.populationDensity;

      const response = [
        `**${precinct.name}** (${precinct.jurisdiction})`,
        '',
        '**Key Metrics:**',
        `- Registered Voters: ${registeredVoters?.toLocaleString() || 'N/A'}`,
        `- Partisan Lean: ${partisanLean > 0 ? 'R+' : 'D+'}${Math.abs(partisanLean).toFixed(1)}`,
        `- Swing Potential: ${swingPotential?.toFixed(0) || 'N/A'}/100`,
        `- GOTV Priority: ${gotvPriority?.toFixed(0) || 'N/A'}/100`,
        `- Average Turnout: ${avgTurnout?.toFixed(1) || 'N/A'}%`,
        '',
        '**Demographics:**',
        `- Population Density: ${density?.toFixed(0) || 'N/A'}`,
        `- Median Income: $${medianIncome?.toLocaleString() || 'N/A'}`,
      ].join('\n');

      return {
        success: true,
        response,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: [precinct.id],
          },
          {
            action: 'flyTo',
            target: precinct.name,
          },
        ],
        suggestedActions: [
          {
            id: 'find-similar',
            label: 'Find Similar Precincts',
            action: `Find precincts similar to ${precinctName}`,
            priority: 1,
          },
          {
            id: 'add-to-segment',
            label: 'Add to Segment',
            action: `Add ${precinctName} to current segment`,
            priority: 2,
          },
        ],
        data: precinct,
        metadata: this.buildMetadata('precinct_lookup', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to look up precinct data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleSegmentByDistrict(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract district from query
    const districtPattern = /(?:state\s+house|house\s+district|hd)\s*(?:district\s*)?\s*[-\s]?(\d+)/i;
    const match = query.originalQuery.match(districtPattern);
    const districtNum = match ? match[1] : null;

    if (!districtNum) {
      return {
        success: false,
        response: 'Please specify a district. For example: "Find voters in State House 73"',
        error: 'No district specified',
      };
    }

    try {
      const districtId = `mi-house-${districtNum}`;
      const precinctData = await politicalDataService.getPrecinctsByStateHouseDistrict(districtId);

      if (precinctData.length === 0) {
        return {
          success: false,
          response: `No precincts found in State House District ${districtNum}.`,
          error: 'No precincts in district',
        };
      }

      // Calculate aggregates from UnifiedPrecinct structure
      const totalVoters = precinctData.reduce((sum: number, p: any) => sum + (p.demographics?.registeredVoters || 0), 0);
      const avgLean = precinctData.reduce((sum: number, p: any) => sum + (p.electoral?.partisanLean || 0), 0) / precinctData.length;

      // Get enrichment context (RAG + Knowledge Graph) with district info
      const enrichment = await getEnrichmentForQuery(query.originalQuery, {
        districtType: 'state_house',
        districtNumber: districtNum,
      });
      const enrichmentSections = formatEnrichmentSections(enrichment);

      const response = [
        `**State House District ${districtNum}**`,
        '',
        `Found **${precinctData.length} precincts** with **${totalVoters.toLocaleString()} voters**.`,
        '',
        `**District Average:**`,
        `- Partisan Lean: ${avgLean > 0 ? 'R+' : 'D+'}${Math.abs(avgLean).toFixed(1)}`,
        '',
        `**Top Precincts:**`,
        ...precinctData.slice(0, 5).map((p: any, i: number) =>
          `${i + 1}. ${p.name} (${p.demographics?.registeredVoters?.toLocaleString() || 0} voters)`
        ),
      ].join('\n') + enrichmentSections;

      return {
        success: true,
        response,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: precinctData.map((p: any) => p.id),
          },
          {
            action: 'fitBounds',
            target: 'selection',
          },
        ],
        suggestedActions: [
          {
            id: 'district-analysis',
            label: 'Full District Analysis',
            action: `Show State House District ${districtNum}`,
            priority: 1,
          },
          {
            id: 'go-to-segments',
            label: 'Save in Segment Tool',
            action: 'Navigate to /segments',
            priority: 2,
          },
        ],
        data: { districtId, precincts: precinctData },
        metadata: this.buildMetadata('segment_by_district', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load district data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleSegmentByElection(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract candidate and threshold from query
    const candidatePattern = /(biden|trump|harris|slotkin|rogers)/i;
    const thresholdPattern = /(\d+)%?\+?/;

    const candidateMatch = query.originalQuery.match(candidatePattern);
    const thresholdMatch = query.originalQuery.match(thresholdPattern);

    const candidate = candidateMatch ? candidateMatch[1].toLowerCase() : 'biden';
    const threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : 60;

    try {
      const allPrecincts = await politicalDataService.getSegmentEnginePrecincts();

      // Filter based on partisan lean (using it as proxy for election results)
      const isDemocrat = ['biden', 'harris', 'slotkin'].includes(candidate);
      const matchingPrecincts = allPrecincts.filter((p: any) => {
        if (isDemocrat) {
          // For Democrats, negative lean means more Democratic
          return (50 - p.partisanLean / 2) >= threshold;
        } else {
          // For Republicans, positive lean means more Republican
          return (50 + p.partisanLean / 2) >= threshold;
        }
      });

      const totalVoters = matchingPrecincts.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);

      const response = [
        `**Precincts with ${threshold}%+ for ${candidate.charAt(0).toUpperCase() + candidate.slice(1)}:**`,
        '',
        `Found **${matchingPrecincts.length} precincts** with **${totalVoters.toLocaleString()} voters**.`,
        '',
        `**Top Precincts:**`,
        ...matchingPrecincts.slice(0, 5).map((p: any, i: number) => {
          const pct = isDemocrat ? (50 - p.partisanLean / 2) : (50 + p.partisanLean / 2);
          return `${i + 1}. ${p.precinctName}: ~${pct.toFixed(0)}% (${p.registeredVoters?.toLocaleString()} voters)`;
        }),
      ].join('\n');

      return {
        success: true,
        response,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: matchingPrecincts.map((p: any) => p.precinctId),
            style: { fillColor: isDemocrat ? '#2E5EAA' : '#C93135', fillOpacity: 0.6 },
          },
        ],
        suggestedActions: [
          {
            id: 'plan-canvass',
            label: 'Plan Canvassing',
            action: 'Navigate to /canvass',
            priority: 1,
          },
          {
            id: 'go-to-segments',
            label: 'Save in Segment Tool',
            action: 'Navigate to /segments',
            priority: 2,
          },
        ],
        data: { candidate, threshold, precincts: matchingPrecincts },
        metadata: this.buildMetadata('segment_by_election', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load election data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleSegmentByTapestry(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract tapestry segment from query
    const tapestryPatterns = [
      /college\s+towns?/i,
      /aspiring\s+young\s+families/i,
      /urban\s+chic/i,
      /senior\s+sun\s+seekers/i,
      /small\s+town\s+simplicity/i,
    ];

    let tapestrySegment = 'College Towns'; // Default
    for (const pattern of tapestryPatterns) {
      if (pattern.test(query.originalQuery)) {
        const match = query.originalQuery.match(pattern);
        if (match) {
          tapestrySegment = match[0].split(/\s+/).map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join(' ');
        }
        break;
      }
    }

    try {
      const allPrecincts = await politicalDataService.getSegmentEnginePrecincts();

      // Filter by tapestry (checking primaryTapestry field)
      const matchingPrecincts = allPrecincts.filter((p: any) =>
        p.primaryTapestry?.toLowerCase().includes(tapestrySegment.toLowerCase())
      );

      if (matchingPrecincts.length === 0) {
        return {
          success: true,
          response: `No precincts found with "${tapestrySegment}" tapestry segment. Try "College Towns" or search by demographics.`,
          suggestedActions: [
            {
              id: 'college-towns',
              label: 'Find College Towns',
              action: 'Find College Towns precincts',
              priority: 1,
            },
            {
              id: 'young-professionals',
              label: 'Find Young Professional Areas',
              action: 'Find young voter precincts',
              priority: 2,
            },
          ],
        };
      }

      const totalVoters = matchingPrecincts.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);

      const response = [
        `**"${tapestrySegment}" Tapestry Precincts:**`,
        '',
        `Found **${matchingPrecincts.length} precincts** with **${totalVoters.toLocaleString()} voters**.`,
        '',
        `**Top Precincts:**`,
        ...matchingPrecincts.slice(0, 5).map((p: any, i: number) =>
          `${i + 1}. ${p.precinctName} (${p.jurisdiction}): ${p.registeredVoters?.toLocaleString()} voters`
        ),
      ].join('\n');

      return {
        success: true,
        response,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: matchingPrecincts.map((p: any) => p.precinctId),
            style: { fillColor: '#8B5CF6', fillOpacity: 0.6 },
          },
        ],
        suggestedActions: [
          {
            id: 'go-to-segments',
            label: 'Build in Segment Tool',
            action: 'Navigate to /segments',
            priority: 1,
          },
          {
            id: 'view-tapestry-map',
            label: 'Show Tapestry Heatmap',
            action: 'map:showHeatmap',
            metadata: { metric: 'tapestry' },
            priority: 2,
          },
        ],
        data: { tapestrySegment, precincts: matchingPrecincts },
        metadata: this.buildMetadata('segment_by_tapestry', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load tapestry data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // New Segment Handlers (Compare, Lookalike, Donor Overlap)
  // --------------------------------------------------------------------------

  private async handleSegmentCompare(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    try {
      const allPrecincts = await politicalDataService.getSegmentEnginePrecincts();

      // Extract segment names from query (e.g., "compare Base vs Swing segment")
      const vsPattern = /(.+?)\s+(?:vs|versus|and|to)\s+(.+?)(?:\s+segment)?$/i;
      const match = query.originalQuery.match(vsPattern);

      // Default to GOTV vs Swing if not specified
      const segment1Name = match?.[1]?.trim() || 'High GOTV';
      const segment2Name = match?.[2]?.trim() || 'High Swing';

      // Create segments based on names
      const segment1 = allPrecincts.filter((p: any) => {
        if (segment1Name.toLowerCase().includes('gotv')) return p.gotvPriority >= 70;
        if (segment1Name.toLowerCase().includes('swing')) return p.swingPotential >= 70;
        if (segment1Name.toLowerCase().includes('base')) return Math.abs(p.partisanLean) >= 15;
        return p.gotvPriority >= 70;
      });

      const segment2 = allPrecincts.filter((p: any) => {
        if (segment2Name.toLowerCase().includes('gotv')) return p.gotvPriority >= 70;
        if (segment2Name.toLowerCase().includes('swing')) return p.swingPotential >= 70;
        if (segment2Name.toLowerCase().includes('base')) return Math.abs(p.partisanLean) >= 15;
        return p.swingPotential >= 70;
      });

      const s1Voters = segment1.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);
      const s2Voters = segment2.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);
      const s1AvgLean = segment1.reduce((sum: number, p: any) => sum + (p.partisanLean || 0), 0) / segment1.length;
      const s2AvgLean = segment2.reduce((sum: number, p: any) => sum + (p.partisanLean || 0), 0) / segment2.length;

      const response = [
        `**Segment Comparison: ${segment1Name} vs ${segment2Name}**`,
        '',
        '| Metric | ' + segment1Name + ' | ' + segment2Name + ' |',
        '|--------|' + '-'.repeat(segment1Name.length + 2) + '|' + '-'.repeat(segment2Name.length + 2) + '|',
        `| Precincts | ${segment1.length} | ${segment2.length} |`,
        `| Voters | ${s1Voters.toLocaleString()} | ${s2Voters.toLocaleString()} |`,
        `| Avg Lean | ${s1AvgLean > 0 ? 'R+' : 'D+'}${Math.abs(s1AvgLean).toFixed(1)} | ${s2AvgLean > 0 ? 'R+' : 'D+'}${Math.abs(s2AvgLean).toFixed(1)} |`,
        '',
        '**Overlap:** ' + segment1.filter((p1: any) => segment2.some((p2: any) => p1.precinctId === p2.precinctId)).length + ' precincts in both segments',
      ].join('\n');

      return {
        success: true,
        response,
        mapCommands: [
          {
            action: 'showBivariate',
            ids: segment1.map((p: any) => p.precinctId),
            data: {
              segment1Ids: segment1.map((p: any) => p.precinctId),
              segment2Ids: segment2.map((p: any) => p.precinctId),
            },
          },
        ],
        suggestedActions: [
          {
            id: 'go-to-segments',
            label: 'Build in Segment Tool',
            action: 'Navigate to /segments',
            priority: 1,
          },
          {
            id: 'go-to-compare',
            label: 'Open Comparison Tool',
            action: 'Navigate to /compare',
            priority: 2,
          },
        ],
        data: { segment1, segment2 },
        metadata: this.buildMetadata('segment_compare', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to compare segments. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleSegmentLookalike(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    try {
      const allPrecincts = await politicalDataService.getSegmentEnginePrecincts();

      // Extract target from query (e.g., "find precincts like East Lansing")
      const targetPattern = /(?:like|similar\s+to)\s+(.+?)(?:\s*$|\s+precincts?)/i;
      const match = query.originalQuery.match(targetPattern);
      const targetName = match?.[1]?.trim() || 'East Lansing';

      // Find target precinct(s)
      const targetPrecincts = allPrecincts.filter((p: any) =>
        p.precinctName?.toLowerCase().includes(targetName.toLowerCase()) ||
        p.jurisdiction?.toLowerCase().includes(targetName.toLowerCase())
      );

      if (targetPrecincts.length === 0) {
        return {
          success: false,
          response: `Could not find "${targetName}". Try a jurisdiction like "East Lansing" or "Meridian Township".`,
          error: 'Target not found',
        };
      }

      // Calculate average profile of target
      const avgLean = targetPrecincts.reduce((sum: number, p: any) => sum + (p.partisanLean || 0), 0) / targetPrecincts.length;
      const avgSwing = targetPrecincts.reduce((sum: number, p: any) => sum + (p.swingPotential || 0), 0) / targetPrecincts.length;
      const avgGOTV = targetPrecincts.reduce((sum: number, p: any) => sum + (p.gotvPriority || 0), 0) / targetPrecincts.length;

      // Find similar precincts (excluding targets)
      const targetIds = new Set(targetPrecincts.map((p: any) => p.precinctId));
      const similarPrecincts = allPrecincts
        .filter((p: any) => !targetIds.has(p.precinctId))
        .map((p: any) => ({
          ...p,
          similarity: 100 - (
            Math.abs((p.partisanLean || 0) - avgLean) * 0.4 +
            Math.abs((p.swingPotential || 0) - avgSwing) * 0.3 +
            Math.abs((p.gotvPriority || 0) - avgGOTV) * 0.3
          ),
        }))
        .filter((p: any) => p.similarity >= 70)
        .sort((a: any, b: any) => b.similarity - a.similarity);

      const totalVoters = similarPrecincts.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);

      const response = [
        `**Precincts Similar to ${targetName}:**`,
        '',
        `Found **${similarPrecincts.length} similar precincts** with **${totalVoters.toLocaleString()} voters**.`,
        '',
        `**Target Profile:**`,
        `- Avg Partisan Lean: ${avgLean > 0 ? 'R+' : 'D+'}${Math.abs(avgLean).toFixed(1)}`,
        `- Avg Swing Potential: ${avgSwing.toFixed(0)}/100`,
        `- Avg GOTV Priority: ${avgGOTV.toFixed(0)}/100`,
        '',
        `**Top Matches:**`,
        ...similarPrecincts.slice(0, 5).map((p: any, i: number) =>
          `${i + 1}. ${p.precinctName} (${p.similarity.toFixed(0)}% match, ${p.registeredVoters?.toLocaleString()} voters)`
        ),
      ].join('\n');

      return {
        success: true,
        response,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: similarPrecincts.map((p: any) => p.precinctId),
            style: { fillColor: '#10B981', fillOpacity: 0.6 },
          },
        ],
        suggestedActions: [
          {
            id: 'go-to-segments',
            label: 'Build in Segment Tool',
            action: 'Navigate to /segments',
            priority: 1,
          },
          {
            id: 'go-to-canvass',
            label: 'Plan Canvassing',
            action: 'Navigate to /canvass',
            priority: 2,
          },
        ],
        data: { target: targetPrecincts, similar: similarPrecincts },
        metadata: this.buildMetadata('segment_lookalike', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to find lookalike precincts. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleSegmentDonorOverlap(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    try {
      const allPrecincts = await politicalDataService.getSegmentEnginePrecincts();

      // Load donor data
      const donorResponse = await fetch('/data/donors/zip-aggregates.json');
      const donorData = await donorResponse.json();

      // Create high-donor ZIP lookup
      const avgDonorAmount = donorData.reduce((sum: number, z: any) => sum + z.totalAmount, 0) / donorData.length;
      const highDonorZips = new Set(
        donorData
          .filter((z: any) => z.totalAmount > avgDonorAmount * 1.5)
          .map((z: any) => z.zipCode)
      );

      // Determine targeting metric from query
      const isGOTV = /gotv|turnout|mobiliz/i.test(query.originalQuery);
      const isSwing = /swing|persuad/i.test(query.originalQuery);

      // Find overlap precincts
      const overlapPrecincts = allPrecincts.filter((p: any) => {
        const isHighDonor = highDonorZips.has(p.zipCode);
        const meetsTarget = isGOTV
          ? p.gotvPriority >= 70
          : isSwing
          ? p.swingPotential >= 70
          : p.gotvPriority >= 60 || p.swingPotential >= 60;
        return isHighDonor && meetsTarget;
      });

      const totalVoters = overlapPrecincts.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);
      const targetType = isGOTV ? 'GOTV' : isSwing ? 'Swing' : 'Target';

      const response = [
        `**High-Donor ${targetType} Precincts:**`,
        '',
        `Found **${overlapPrecincts.length} precincts** with both high donor activity and ${targetType.toLowerCase()} priority.`,
        `Total voters: **${totalVoters.toLocaleString()}**`,
        '',
        `**Top Overlap Precincts:**`,
        ...overlapPrecincts.slice(0, 5).map((p: any, i: number) =>
          `${i + 1}. ${p.precinctName}: ${isGOTV ? `GOTV ${p.gotvPriority.toFixed(0)}` : `Swing ${p.swingPotential.toFixed(0)}`}/100, ${p.registeredVoters?.toLocaleString()} voters`
        ),
        '',
        `*These precincts combine fundraising potential with ${targetType.toLowerCase()} opportunity.*`,
      ].join('\n');

      return {
        success: true,
        response,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: overlapPrecincts.map((p: any) => p.precinctId),
            style: { fillColor: '#F59E0B', fillOpacity: 0.7 },
          },
        ],
        suggestedActions: [
          {
            id: 'go-to-segments',
            label: 'Build in Segment Tool',
            action: 'Navigate to /segments',
            priority: 1,
          },
          {
            id: 'go-to-donors',
            label: 'View Donor Analysis',
            action: 'Navigate to /donors',
            priority: 2,
          },
          {
            id: 'go-to-canvass',
            label: 'Plan Canvassing',
            action: 'Navigate to /canvass',
            priority: 3,
          },
        ],
        data: { overlapPrecincts, targetType },
        metadata: this.buildMetadata('segment_donor_overlap', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to analyze donor overlap. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
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
      queryType: 'segment',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const segmentationHandler = new SegmentationHandler();

export default SegmentationHandler;
