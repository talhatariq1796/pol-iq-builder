/**
 * Canvassing NLP Handler
 *
 * Translates natural language canvassing queries into CanvassingEngine operations.
 * Supports queries like:
 * - "Create a canvass universe from the suburban swing segment"
 * - "Plan a 500-door canvass operation in Meridian"
 * - "How many volunteers do I need for 10,000 doors?"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, getEnrichmentForQuery, formatEnrichmentSections } from './types';
import type { CanvassingUniverse, CanvassSummary } from '@/lib/canvassing/types';
import { VolunteerManager } from '@/lib/canvassing/VolunteerManager';
import { AssignmentEngine } from '@/lib/canvassing/AssignmentEngine';
import { ProgressTracker } from '@/lib/canvassing/ProgressTracker';
import { ProgressAggregator } from '@/lib/canvassing/ProgressAggregator';
import { RouteOptimizer } from '@/lib/canvassing/RouteOptimizer';
import { PerformanceAnalyzer } from '@/lib/canvassing/PerformanceAnalyzer';

// ============================================================================
// Query Patterns
// ============================================================================

const CANVASS_PATTERNS: QueryPattern[] = [
  {
    intent: 'canvass_create',
    patterns: [
      /create\s+(?:a\s+)?canvass(?:ing)?\s+universe/i,
      /build\s+(?:a\s+)?canvass(?:ing)?\s+universe/i,
      /new\s+canvass(?:ing)?\s+universe/i,
      /canvass\s+from\s+segment/i,
    ],
    keywords: ['create', 'build', 'new', 'canvass', 'universe', 'from', 'segment'],
    priority: 10,
  },
  {
    intent: 'canvass_plan',
    patterns: [
      /plan\s+(?:a\s+)?canvass/i,
      /canvass(?:ing)?\s+plan/i,
      /(?:\d+).?door\s+canvass/i,
      /canvass\s+(?:in|for)\s+/i,
      /knock\s+doors/i,
      /door.?knock/i,
    ],
    keywords: ['plan', 'canvass', 'door', 'knock', 'operation'],
    priority: 8,
  },
  {
    intent: 'canvass_estimate',
    patterns: [
      /how\s+many\s+volunteers/i,
      /volunteers?\s+(?:do\s+)?(?:i|we)\s+need/i,
      /staffing\s+(?:for|estimate)/i,
      /estimate\s+(?:staffing|volunteers|hours)/i,
      /how\s+long\s+(?:will|would)/i,
      /hours?\s+(?:to|for)\s+canvass/i,
    ],
    keywords: ['volunteers', 'staffing', 'estimate', 'hours', 'need', 'how many'],
    priority: 8,
  },
  {
    intent: 'canvass_export',
    patterns: [
      /export\s+(?:walk\s+)?list/i,
      /download\s+(?:walk\s+)?list/i,
      /generate\s+walk\s+list/i,
      /export\s+turf/i,
      /van\s+export/i,
    ],
    keywords: ['export', 'download', 'walk', 'list', 'turf', 'van'],
    priority: 6,
  },
  {
    intent: 'canvassing_assign_volunteers',
    patterns: [
      /assign\s+volunteers?/i,
      /who\s+should\s+canvass/i,
      /recommend\s+volunteers?/i,
      /best\s+volunteers?\s+for/i,
      /volunteers?\s+for\s+turf/i,
    ],
    keywords: ['assign', 'volunteer', 'recommend', 'who should', 'turf'],
    priority: 8,
  },
  {
    intent: 'canvassing_view_progress',
    patterns: [
      /show\s+(?:canvassing\s+)?progress/i,
      /how\s+much\s+(?:is\s+)?complete/i,
      /completion\s+(?:rate|status)/i,
      /universe\s+progress/i,
      /canvass(?:ing)?\s+status/i,
    ],
    keywords: ['progress', 'complete', 'completion', 'status', 'universe'],
    priority: 8,
  },
  {
    intent: 'canvassing_optimize_route',
    patterns: [
      /optimize\s+route/i,
      /best\s+(?:walking\s+)?route/i,
      /route\s+(?:for|optimization)/i,
      /walking\s+order/i,
    ],
    keywords: ['optimize', 'route', 'walking', 'order'],
    priority: 7,
  },
  {
    intent: 'canvassing_performance',
    patterns: [
      /show\s+(?:top\s+)?(?:performing\s+)?(?:precincts?|turfs?)/i,
      /volunteer\s+efficiency/i,
      /performance\s+(?:analysis|metrics)/i,
      /top\s+performers?/i,
      /best\s+precincts?/i,
    ],
    keywords: ['performance', 'efficiency', 'top', 'metrics', 'analysis'],
    priority: 7,
  },
  {
    intent: 'canvassing_volunteer_stats',
    patterns: [
      /how\s+many\s+doors\s+(?:has|did)\s+\w+/i,
      /show\s+\w+\'?s\s+stats/i,
      /\w+\'?s\s+(?:canvassing\s+)?(?:stats|metrics|progress)/i,
      /volunteer\s+stats/i,
    ],
    keywords: ['doors', 'stats', 'metrics', 'volunteer', 'show'],
    priority: 8,
  },
  {
    intent: 'canvassing_stalled',
    patterns: [
      /show\s+stalled\s+turfs?/i,
      /(?:which|what)\s+turfs?\s+(?:need|stalled)/i,
      /turfs?\s+need(?:ing)?\s+attention/i,
      /behind\s+schedule/i,
      /inactive\s+turfs?/i,
    ],
    keywords: ['stalled', 'attention', 'behind', 'inactive', 'need'],
    priority: 7,
  },
  // Log canvass results
  {
    intent: 'canvassing_log_results',
    patterns: [
      /log\s+(?:canvass(?:ing)?\s+)?results?/i,
      /record\s+(?:canvass(?:ing)?\s+)?results?/i,
      /enter\s+(?:canvass(?:ing)?\s+)?(?:results?|data)/i,
      /update\s+(?:canvass(?:ing)?\s+)?(?:results?|data)/i,
      /submit\s+(?:canvass(?:ing)?\s+)?(?:results?|data)/i,
      /add\s+(?:door|contact)\s+(?:results?|data)/i,
    ],
    keywords: ['log', 'record', 'enter', 'update', 'results', 'submit', 'data'],
    priority: 8,
  },
  // Analyze canvassing performance
  {
    intent: 'canvassing_analyze_performance',
    patterns: [
      /analyze\s+(?:canvass(?:ing)?\s+)?performance/i,
      /(?:canvass(?:ing)?\s+)?performance\s+(?:analysis|report)/i,
      /how\s+(?:are\s+we|is\s+the\s+canvass)\s+doing/i,
      /(?:canvass(?:ing)?\s+)?effectiveness/i,
      /contact\s+rate\s+(?:analysis|report)/i,
      /(?:show|view)\s+(?:canvass(?:ing)?\s+)?analytics/i,
    ],
    keywords: ['analyze', 'performance', 'effectiveness', 'contact rate', 'analytics'],
    priority: 7,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const DOOR_PATTERN = /(\d{1,3}(?:,\d{3})*|\d+)\s*(?:k)?\s*doors?/i;
const VOLUNTEER_PATTERN = /(\d+)\s*volunteers?/i;
const TURF_SIZE_PATTERN = /(\d+)\s*doors?\s*per\s*turf/i;
const HOURS_PATTERN = /(\d+)\s*hours?/i;
const SHIFT_PATTERN = /(\d+).?(?:hr|hour)\s*shifts?/i;

const JURISDICTION_PATTERNS = [
  /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
  /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
  /\b(lansing|east\s+lansing|meridian|delhi|williamston|mason|okemos)/i,
];

const SEGMENT_REF_PATTERN = /(?:from|using)\s+(?:the\s+)?["']?([^"']+)["']?\s+segment/i;

// ============================================================================
// Canvassing Handler Class
// ============================================================================

export class CanvassingHandler implements NLPHandler {
  name = 'CanvassingHandler';
  patterns = CANVASS_PATTERNS;

  // Default parameters
  private defaultDoorsPerTurf = 200;
  private defaultDoorsPerHour = 40;
  private defaultContactRate = 0.35;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'canvass_create' ||
      query.intent === 'canvass_plan' ||
      query.intent === 'canvass_estimate' ||
      query.intent === 'canvass_export' ||
      query.intent === 'canvassing_assign_volunteers' ||
      query.intent === 'canvassing_view_progress' ||
      query.intent === 'canvassing_optimize_route' ||
      query.intent === 'canvassing_analyze_performance' ||
      query.intent === 'canvassing_log_results' ||
      query.intent === 'canvassing_performance' ||
      query.intent === 'canvassing_volunteer_stats' ||
      query.intent === 'canvassing_stalled'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'canvass_create':
          return await this.handleCreateUniverse(query, startTime);

        case 'canvass_plan':
          return await this.handlePlanCanvass(query, startTime);

        case 'canvass_estimate':
          return await this.handleEstimate(query, startTime);

        case 'canvass_export':
          return await this.handleExport(query, startTime);

        case 'canvassing_assign_volunteers':
          return await this.handleAssignVolunteers(query, startTime);

        case 'canvassing_view_progress':
          return await this.handleViewProgress(query, startTime);

        case 'canvassing_optimize_route':
          return await this.handleOptimizeRoute(query, startTime);

        case 'canvassing_analyze_performance':
        case 'canvassing_performance':
          return await this.handlePerformanceAnalysis(query, startTime);

        case 'canvassing_log_results':
          return await this.handleLogResults(query, startTime);

        case 'canvassing_volunteer_stats':
          return await this.handleVolunteerStats(query, startTime);

        case 'canvassing_stalled':
          return await this.handleStalledTurfs(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown canvassing intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process canvassing query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleCreateUniverse(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Check for segment reference
    const segmentName = entities.segmentName || 'Current Selection';

    // Calculate estimates
    const doorCount = entities.doorCount || 5000; // Default estimate
    const turfs = Math.ceil(doorCount / this.defaultDoorsPerTurf);
    const hours = Math.ceil(doorCount / this.defaultDoorsPerHour);
    const volunteersFor8Hr = Math.ceil(hours / 8);
    const volunteersFor4Hr = Math.ceil(hours / 4);

    const universeName = this.generateUniverseName(entities, segmentName);

    const response = this.formatUniverseResponse(
      universeName,
      doorCount,
      turfs,
      hours,
      volunteersFor8Hr,
      volunteersFor4Hr,
      entities.jurisdictions
    );

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands: [
        {
          action: 'highlight',
          target: 'canvass_area',
          style: { fillColor: '#10B981', fillOpacity: 0.5 },
        },
      ],
      suggestedActions: this.generateUniverseActions(universeName),
      data: {
        universeName,
        doorCount,
        turfs,
        hours,
        volunteers: { shift8hr: volunteersFor8Hr, shift4hr: volunteersFor4Hr },
      },
      metadata: this.buildMetadata('canvass_create', startTime, query),
    };
  }

  private async handlePlanCanvass(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Get door count from query or estimate
    let doorCount = entities.doorCount;

    if (!doorCount && entities.jurisdictions) {
      // Estimate based on jurisdiction (rough estimates)
      const jurisdictionSizes: Record<string, number> = {
        'lansing': 25000,
        'east lansing': 12000,
        'meridian': 8000,
        'delhi': 6000,
        'williamston': 2000,
        'mason': 3000,
        'okemos': 5000,
      };

      doorCount = entities.jurisdictions.reduce((sum, j) => {
        const lower = j.toLowerCase();
        return sum + (jurisdictionSizes[lower] || 5000);
      }, 0);
    }

    doorCount = doorCount || 10000;

    // Calculate plan
    const turfs = Math.ceil(doorCount / (entities.turfSize || this.defaultDoorsPerTurf));
    const hours = Math.ceil(doorCount / this.defaultDoorsPerHour);
    const expectedContacts = Math.floor(doorCount * this.defaultContactRate);
    const volunteersFor8Hr = Math.ceil(hours / 8);
    const volunteersFor4Hr = Math.ceil(hours / 4);

    const planName = entities.jurisdictions
      ? `${entities.jurisdictions.join(' & ')} Canvass`
      : `${doorCount.toLocaleString()}-Door Canvass`;

    const response = this.formatPlanResponse(
      planName,
      doorCount,
      turfs,
      hours,
      expectedContacts,
      volunteersFor8Hr,
      volunteersFor4Hr
    );

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands: entities.jurisdictions
        ? [
            {
              action: 'highlight',
              target: 'jurisdictions',
              names: entities.jurisdictions,
              style: { fillColor: '#10B981', fillOpacity: 0.4 },
            },
            {
              action: 'flyTo',
              target: 'jurisdictions',
              names: entities.jurisdictions,
            },
          ]
        : [],
      suggestedActions: [
        {
          id: 'create-universe',
          label: 'Create Canvass Universe',
          description: 'Save this as a canvassing universe',
          action: 'create_canvass',
          params: { name: planName, doors: doorCount },
          priority: 1,
        },
        {
          id: 'generate-turfs',
          label: 'Generate Turf Assignments',
          description: 'Create individual turfs',
          action: 'generate_turfs',
          priority: 2,
        },
        {
          id: 'export-walklist',
          label: 'Export Walk List',
          description: 'Download for VAN import',
          action: 'export_walklist',
          priority: 3,
        },
      ],
      data: {
        planName,
        doorCount,
        turfs,
        hours,
        expectedContacts,
        volunteers: { shift8hr: volunteersFor8Hr, shift4hr: volunteersFor4Hr },
      },
      metadata: this.buildMetadata('canvass_plan', startTime, query),
    };
  }

  private async handleEstimate(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Parse what we're estimating
    let doorCount = entities.doorCount;
    let volunteerCount = entities.volunteerCount;
    const shiftHours = entities.shiftHours || 4;

    if (doorCount) {
      // Estimating volunteers needed for X doors
      const totalHours = Math.ceil(doorCount / this.defaultDoorsPerHour);
      volunteerCount = Math.ceil(totalHours / shiftHours);
      const days = Math.ceil(volunteerCount / 20); // Assume 20 volunteers per day max

      const response = [
        `**Staffing Estimate for ${doorCount.toLocaleString()} doors:**`,
        '',
        `- Total canvassing hours: **${totalHours.toLocaleString()}**`,
        `- Volunteers needed (${shiftHours}hr shifts): **${volunteerCount}**`,
        `- Days to complete (20 volunteers/day): **${days}**`,
        `- Expected contacts (${Math.round(this.defaultContactRate * 100)}% rate): **${Math.floor(doorCount * this.defaultContactRate).toLocaleString()}**`,
        '',
        `*Based on ${this.defaultDoorsPerHour} doors/hour average pace*`,
      ].join('\n');

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      return {
        success: true,
        response: response + enrichmentSections,
        suggestedActions: [
          {
            id: 'adjust-pace',
            label: 'Adjust Pace',
            description: 'Change doors per hour assumption',
            action: 'adjust_pace',
            priority: 1,
          },
          {
            id: 'plan-canvass',
            label: 'Plan Full Canvass',
            description: 'Create detailed canvass plan',
            action: 'plan_canvass',
            priority: 2,
          },
        ],
        data: { doorCount, volunteerCount, totalHours, days },
        metadata: this.buildMetadata('canvass_estimate', startTime, query),
      };
    } else if (volunteerCount) {
      // Estimating doors possible with X volunteers
      const totalHours = volunteerCount * shiftHours;
      doorCount = totalHours * this.defaultDoorsPerHour;
      const expectedContacts = Math.floor(doorCount * this.defaultContactRate);

      const response = [
        `**Door Estimate for ${volunteerCount} volunteers (${shiftHours}hr shifts):**`,
        '',
        `- Total canvassing hours: **${totalHours.toLocaleString()}**`,
        `- Doors reachable: **${doorCount.toLocaleString()}**`,
        `- Expected contacts: **${expectedContacts.toLocaleString()}**`,
        '',
        `*Based on ${this.defaultDoorsPerHour} doors/hour average pace*`,
      ].join('\n');

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment2 = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections2 = formatEnrichmentSections(enrichment2);

      return {
        success: true,
        response: response + enrichmentSections2,
        suggestedActions: [
          {
            id: 'find-precincts',
            label: 'Find Target Precincts',
            description: `Find precincts with ~${doorCount.toLocaleString()} doors`,
            action: 'find_precincts',
            priority: 1,
          },
        ],
        data: { volunteerCount, doorCount, totalHours, expectedContacts },
        metadata: this.buildMetadata('canvass_estimate', startTime, query),
      };
    }

    return {
      success: false,
      response:
        "Please specify either a door count or volunteer count. For example: 'How many volunteers for 5,000 doors?' or 'How many doors can 10 volunteers knock?'",
      error: 'Missing door or volunteer count',
    };
  }

  private async handleExport(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const isVAN = /van/i.test(query.originalQuery);
    const format = isVAN ? 'VAN-compatible CSV' : 'CSV';

    return {
      success: true,
      response: RESPONSE_TEMPLATES.canvass.exported('Current Universe', format),
      suggestedActions: [
        {
          id: 'open-download',
          label: 'Open Downloaded File',
          description: 'View walk list',
          action: 'open_download',
          priority: 1,
        },
        {
          id: 'import-instructions',
          label: 'VAN Import Instructions',
          description: 'How to import into VAN',
          action: 'show_instructions',
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('canvass_export', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract door count
    const doorMatch = query.match(DOOR_PATTERN);
    if (doorMatch) {
      let count = parseInt(doorMatch[1].replace(/,/g, ''));
      if (query.toLowerCase().includes('k') && count < 1000) {
        count *= 1000;
      }
      entities.doorCount = count;
    }

    // Extract volunteer count
    const volunteerMatch = query.match(VOLUNTEER_PATTERN);
    if (volunteerMatch) {
      entities.volunteerCount = parseInt(volunteerMatch[1]);
    }

    // Extract turf size
    const turfMatch = query.match(TURF_SIZE_PATTERN);
    if (turfMatch) {
      entities.turfSize = parseInt(turfMatch[1]);
    }

    // Extract shift hours
    const shiftMatch = query.match(SHIFT_PATTERN);
    if (shiftMatch) {
      (entities as any).shiftHours = parseInt(shiftMatch[1]);
    }

    // Extract jurisdictions
    for (const pattern of JURISDICTION_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        if (!entities.jurisdictions) entities.jurisdictions = [];
        entities.jurisdictions.push(match[1].trim());
      }
    }

    // Extract segment reference
    const segmentMatch = query.match(SEGMENT_REF_PATTERN);
    if (segmentMatch) {
      entities.segmentName = segmentMatch[1].trim();
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private formatUniverseResponse(
    name: string,
    doors: number,
    turfs: number,
    hours: number,
    vol8hr: number,
    vol4hr: number,
    jurisdictions?: string[]
  ): string {
    const lines = [
      `**Canvass Universe Created: "${name}"**`,
      '',
      '**Operation Overview:**',
      `- Estimated doors: **${doors.toLocaleString()}**`,
      `- Total turfs: **${turfs}** (at ${this.defaultDoorsPerTurf} doors each)`,
      `- Total hours: **${hours.toLocaleString()}**`,
      '',
      '**Staffing Options:**',
      `- ${vol8hr} volunteers (8hr shifts)`,
      `- ${vol4hr} volunteers (4hr shifts)`,
      '',
      `*Expected contacts: ${Math.floor(doors * this.defaultContactRate).toLocaleString()} (${Math.round(this.defaultContactRate * 100)}% contact rate)*`,
    ];

    if (jurisdictions && jurisdictions.length > 0) {
      lines.splice(2, 0, `**Area:** ${jurisdictions.join(', ')}`);
    }

    return lines.join('\n');
  }

  private formatPlanResponse(
    name: string,
    doors: number,
    turfs: number,
    hours: number,
    contacts: number,
    vol8hr: number,
    vol4hr: number
  ): string {
    return [
      `**Canvass Plan: ${name}**`,
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Doors | ${doors.toLocaleString()} |`,
      `| Turfs | ${turfs} |`,
      `| Hours | ${hours.toLocaleString()} |`,
      `| Expected Contacts | ${contacts.toLocaleString()} |`,
      `| Volunteers (8hr) | ${vol8hr} |`,
      `| Volunteers (4hr) | ${vol4hr} |`,
      '',
      `*Contact rate: ${Math.round(this.defaultContactRate * 100)}% | Pace: ${this.defaultDoorsPerHour} doors/hr*`,
    ].join('\n');
  }

  private generateUniverseName(
    entities: ExtractedEntities,
    segmentName: string
  ): string {
    if (entities.jurisdictions) {
      return `${entities.jurisdictions.join(' & ')} Canvass`;
    }
    if (entities.doorCount) {
      return `${entities.doorCount.toLocaleString()}-Door Canvass`;
    }
    return `${segmentName} Canvass`;
  }

  private generateUniverseActions(name: string): any[] {
    return [
      {
        id: 'export-walklist',
        label: 'Export Walk List',
        description: 'Download CSV for field use',
        action: 'export_walklist',
        priority: 1,
      },
      {
        id: 'export-van',
        label: 'Export for VAN',
        description: 'Download VAN-compatible format',
        action: 'export_van',
        priority: 2,
      },
      {
        id: 'assign-turfs',
        label: 'Assign Turfs',
        description: 'Assign volunteers to turfs',
        action: 'assign_turfs',
        priority: 3,
      },
      {
        id: 'show-map',
        label: 'Show on Map',
        description: 'Visualize canvass area',
        action: 'show_canvass_map',
        priority: 4,
      },
    ];
  }

  // --------------------------------------------------------------------------
  // Additional Canvassing Handlers
  // --------------------------------------------------------------------------

  private async handleAssignVolunteers(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    return {
      success: true,
      response: [
        '**Volunteer Assignment**',
        '',
        'To assign volunteers to turfs, I need:',
        '- An active canvassing universe',
        '- A list of available volunteers',
        '',
        'Would you like to:',
        '1. Create a new canvassing universe first',
        '2. View your existing universes',
        '3. Add volunteers to a specific turf',
      ].join('\n'),
      suggestedActions: [
        { id: 'create-universe', label: 'Create Universe', action: 'canvass_create', priority: 1 },
        { id: 'view-universes', label: 'View Universes', action: 'canvass_list', priority: 2 },
      ],
      metadata: this.buildMetadata('canvassing_assign_volunteers', startTime, query),
    };
  }

  private async handleViewProgress(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Use ProgressAggregator to get real progress data
    const aggregator = new ProgressAggregator();

    return {
      success: true,
      response: [
        '**Canvassing Progress Overview**',
        '',
        'To view progress, select a canvassing universe or turf.',
        '',
        '**Available Actions:**',
        '- View universe completion rates',
        '- See volunteer activity',
        '- Check stalled turfs',
      ].join('\n'),
      suggestedActions: [
        { id: 'show-stalled', label: 'Show Stalled Turfs', action: 'canvassing_stalled', priority: 1 },
        { id: 'volunteer-stats', label: 'Volunteer Stats', action: 'canvassing_volunteer_stats', priority: 2 },
      ],
      metadata: this.buildMetadata('canvassing_view_progress', startTime, query),
    };
  }

  private async handleOptimizeRoute(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    return {
      success: true,
      response: [
        '**Route Optimization**',
        '',
        'Route optimization creates efficient walking paths for canvassers.',
        '',
        'I can optimize routes for:',
        '- A specific turf',
        '- Multiple adjacent turfs',
        '- An entire canvassing universe',
        '',
        'Specify which area you want to optimize.',
      ].join('\n'),
      suggestedActions: [
        { id: 'optimize-turf', label: 'Optimize Turf', action: 'optimize_turf', priority: 1 },
        { id: 'optimize-universe', label: 'Optimize Universe', action: 'optimize_universe', priority: 2 },
      ],
      metadata: this.buildMetadata('canvassing_optimize_route', startTime, query),
    };
  }

  private async handlePerformanceAnalysis(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const analyzer = new PerformanceAnalyzer();

    return {
      success: true,
      response: [
        '**Canvassing Performance Analysis**',
        '',
        'Performance metrics tracked:',
        '- **Doors/Hour**: Average knocking pace',
        '- **Contact Rate**: Successful contacts vs attempts',
        '- **Completion Rate**: Turf progress',
        '',
        'Select a universe or timeframe to see detailed analysis.',
      ].join('\n'),
      suggestedActions: [
        { id: 'top-performers', label: 'Top Performers', action: 'show_top_performers', priority: 1 },
        { id: 'weekly-report', label: 'Weekly Report', action: 'generate_weekly_report', priority: 2 },
      ],
      metadata: this.buildMetadata('canvassing_performance', startTime, query),
    };
  }

  private async handleLogResults(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    return {
      success: true,
      response: [
        '**Log Canvassing Results**',
        '',
        'To log results, I need:',
        '- Turf ID or name',
        '- Number of doors knocked',
        '- Number of contacts made',
        '- Any notes or outcomes',
        '',
        'You can also upload a VAN results file.',
      ].join('\n'),
      suggestedActions: [
        { id: 'upload-van', label: 'Upload VAN File', action: 'upload_van_results', priority: 1 },
        { id: 'manual-entry', label: 'Manual Entry', action: 'manual_result_entry', priority: 2 },
      ],
      metadata: this.buildMetadata('canvassing_log_results', startTime, query),
    };
  }

  private async handleVolunteerStats(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const volunteerManager = new VolunteerManager();

    return {
      success: true,
      response: [
        '**Volunteer Statistics**',
        '',
        'To see volunteer stats, specify a volunteer name or view all.',
        '',
        '**Available Metrics:**',
        '- Total doors knocked',
        '- Average doors/hour',
        '- Contact success rate',
        '- Turfs completed',
      ].join('\n'),
      suggestedActions: [
        { id: 'all-volunteers', label: 'All Volunteers', action: 'list_all_volunteers', priority: 1 },
        { id: 'top-volunteers', label: 'Top Performers', action: 'show_top_volunteers', priority: 2 },
      ],
      metadata: this.buildMetadata('canvassing_volunteer_stats', startTime, query),
    };
  }

  private async handleStalledTurfs(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const tracker = new ProgressTracker();

    return {
      success: true,
      response: [
        '**Stalled Turfs**',
        '',
        'Stalled turfs are those with no activity in the last 48 hours.',
        '',
        'To identify stalled turfs, select a canvassing universe.',
        '',
        '**Actions:**',
        '- Reassign stalled turfs',
        '- Contact assigned volunteers',
        '- Merge with adjacent turfs',
      ].join('\n'),
      suggestedActions: [
        { id: 'view-stalled', label: 'View Stalled', action: 'list_stalled_turfs', priority: 1 },
        { id: 'reassign', label: 'Reassign Turfs', action: 'reassign_stalled', priority: 2 },
      ],
      metadata: this.buildMetadata('canvassing_stalled', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'canvass',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const canvassingHandler = new CanvassingHandler();

export default CanvassingHandler;
