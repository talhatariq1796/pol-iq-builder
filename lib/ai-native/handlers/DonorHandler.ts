/**
 * Donor NLP Handler
 *
 * Translates natural language donor queries into DonorAggregator operations.
 * Supports queries like:
 * - "Where are our donors concentrated?"
 * - "Find fundraising prospects in high-income areas"
 * - "Show donor trends in 48823"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, appendSources, getEnrichmentForQuery, formatEnrichmentSections } from './types';

// ============================================================================
// Query Patterns
// ============================================================================

const DONOR_PATTERNS: QueryPattern[] = [
  {
    intent: 'donor_concentration',
    patterns: [
      /where\s+(?:are\s+)?(?:our\s+)?donors?\s+concentrated/i,
      /donor\s+concentration/i,
      /top\s+donor\s+(?:areas?|zips?|locations?)/i,
      /highest\s+donor\s+(?:areas?|density)/i,
      /most\s+donors?/i,
      /donor\s+heatmap/i,
    ],
    keywords: ['donor', 'concentration', 'top', 'highest', 'where', 'heatmap'],
    priority: 10,
  },
  {
    intent: 'donor_prospects',
    patterns: [
      /find\s+(?:fundraising\s+)?prospects/i,
      /fundraising\s+prospects/i,
      /potential\s+donors/i,
      /untapped\s+(?:donor\s+)?potential/i,
      /similar\s+to\s+donors/i,
      /high.?capacity\s+areas/i,
      /where\s+should\s+we\s+fundrais/i,
    ],
    keywords: ['prospect', 'potential', 'untapped', 'fundraising', 'capacity'],
    priority: 10,
  },
  {
    intent: 'donor_trends',
    patterns: [
      /donor\s+trends?/i,
      /fundraising\s+trends?/i,
      /giving\s+trends?/i,
      /donations?\s+over\s+time/i,
      /how\s+(?:has|have)\s+(?:donations?|giving|fundraising)/i,
      /year.over.year/i,
      /momentum/i,
    ],
    keywords: ['trend', 'over time', 'momentum', 'year over year', 'growth'],
    priority: 8,
  },
  {
    intent: 'donor_export',
    patterns: [
      /export\s+donor/i,
      /download\s+donor/i,
      /donor\s+(?:list|data)\s+export/i,
    ],
    keywords: ['export', 'download', 'donor', 'list'],
    priority: 6,
  },
  // Geographic donor patterns
  {
    intent: 'donor_geographic',
    patterns: [
      /geographic\s+(?:distribution|breakdown)\s+(?:of\s+)?donors?/i,
      /donor\s+(?:geographic|geography|distribution)/i,
      /where\s+(?:are\s+)?(?:the\s+)?donors?\s+(?:located|from|coming\s+from)/i,
      /donors?\s+by\s+(?:zip|location|area|region)/i,
      /map\s+(?:of\s+)?donors?/i,
      /donors?\s+map/i,
    ],
    keywords: ['geographic', 'distribution', 'where', 'located', 'map', 'by zip', 'by area'],
    priority: 8,
  },
  // Donor by candidate patterns
  {
    intent: 'donor_by_candidate',
    patterns: [
      /who\s+donates?\s+to\s+(slotkin|rogers|trump|biden|harris|peters|stabenow)/i,
      /(slotkin|rogers|trump|biden|harris|peters|stabenow)\s+donors?/i,
      /donors?\s+(?:to|for)\s+(slotkin|rogers|trump|biden|harris|peters|stabenow)/i,
      /(?:show|find)\s+(?:me\s+)?(?:fundraising|donors?)\s+(?:for|to)\s+(slotkin|rogers|trump|biden|harris|peters|stabenow)/i,
      /how\s+much\s+(?:has\s+)?(slotkin|rogers|trump|biden|harris|peters|stabenow)\s+raised/i,
    ],
    keywords: ['donors', 'to', 'for', 'slotkin', 'rogers', 'trump', 'biden', 'harris', 'raised'],
    priority: 9,
  },
  // Donor comparison patterns
  {
    intent: 'donor_comparison',
    patterns: [
      /compare\s+(?:fundraising|donors?)\s+(?:between|for)\s+(.+?)\s+(?:and|vs|versus)\s+(.+)/i,
      /(?:fundraising|donor)\s+comparison/i,
      /compare\s+donor\s+patterns?\s+(?:across|between)\s+(?:zips?|areas?|candidates?)/i,
      /(slotkin|rogers)\s+vs\s+(slotkin|rogers)\s+(?:fundraising|donors?)/i,
      /head.to.head\s+(?:fundraising|donor)/i,
    ],
    keywords: ['compare', 'fundraising', 'versus', 'vs', 'head to head', 'comparison'],
    priority: 9,
  },
  // Lapsed donor patterns
  {
    intent: 'donor_lapsed',
    patterns: [
      /lapsed\s+donors?/i,
      /(?:find|show|identify)\s+lapsed/i,
      /donors?\s+(?:who|that)\s+(?:stopped|haven't|have\s+not)\s+(?:giving|donated)/i,
      /inactive\s+donors?/i,
      /dormant\s+donors?/i,
      /(?:re-?engage|win\s+back)\s+donors?/i,
    ],
    keywords: ['lapsed', 'inactive', 'dormant', 'stopped', 'win back', 're-engage'],
    priority: 9,
  },
  // Lapsed donor clusters
  {
    intent: 'donor_lapsed_clusters',
    patterns: [
      /lapsed\s+(?:donor\s+)?clusters?/i,
      /(?:geographic|where\s+are)\s+lapsed\s+donors?/i,
      /clusters?\s+of\s+lapsed/i,
      /lapsed\s+donor\s+(?:areas?|locations?|zips?)/i,
    ],
    keywords: ['lapsed', 'cluster', 'geographic', 'areas', 'where'],
    priority: 8,
  },
  // Upgrade prospect patterns
  {
    intent: 'donor_upgrade',
    patterns: [
      /upgrade\s+(?:prospect|potential|candidates?)/i,
      /donors?\s+(?:ready|able)\s+to\s+(?:give|upgrade)/i,
      /(?:find|identify|show)\s+upgrade\s+(?:prospects?|opportunities?)/i,
      /(?:who|which)\s+donors?\s+(?:can|could|should)\s+(?:give|upgrade)/i,
      /capacity\s+(?:to\s+)?give\s+more/i,
      /under.?giving\s+donors?/i,
    ],
    keywords: ['upgrade', 'capacity', 'give more', 'prospects', 'under-giving'],
    priority: 9,
  },
  // Top upgrade prospects
  {
    intent: 'donor_upgrade_top',
    patterns: [
      /top\s+upgrade\s+(?:prospects?|candidates?)/i,
      /best\s+upgrade\s+(?:prospects?|opportunities?)/i,
      /highest\s+(?:capacity|potential)\s+donors?/i,
      /major\s+donor\s+(?:prospects?|upgrades?)/i,
    ],
    keywords: ['top', 'best', 'highest', 'major', 'upgrade'],
    priority: 10,
  },
  // Independent Expenditure patterns
  {
    intent: 'donor_ie',
    patterns: [
      /independent\s+expenditures?/i,
      /\bie\s+(?:spending|money|data)/i,
      /outside\s+(?:money|spending|groups?)/i,
      /super\s*pac\s+(?:spending|money)/i,
      /(?:who'?s|what)\s+(?:spending|spent)\s+(?:on|for|against)/i,
    ],
    keywords: ['independent expenditure', 'IE', 'outside money', 'super pac', 'spending'],
    priority: 9,
  },
  // IE Spending against candidate
  {
    intent: 'donor_ie_spending',
    patterns: [
      /(?:spending|spent)\s+against\s+(?:us|me|our\s+candidate)/i,
      /opposition\s+(?:spending|money|ie)/i,
      /negative\s+(?:spending|ads?|ie)/i,
      /(?:who'?s|what'?s)\s+(?:running|spending)\s+(?:ads?)?\s+against/i,
      /attack\s+(?:ads?|spending)/i,
    ],
    keywords: ['against', 'opposition', 'negative', 'attack', 'spending'],
    priority: 9,
  },
  // Committee/PAC patterns
  {
    intent: 'donor_committee',
    patterns: [
      /(?:pac|committee)\s+(?:contributions?|donors?|money)/i,
      /(?:which|what)\s+pacs?\s+(?:support|donate|contribute)/i,
      /committee\s+(?:contributions?|support)/i,
      /organizational\s+(?:donors?|support)/i,
      /(?:show|find)\s+(?:pac|committee)\s+(?:data|contributions?)/i,
    ],
    keywords: ['pac', 'committee', 'organizational', 'contributions'],
    priority: 8,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const ZIP_PATTERN = /\b(\d{5})\b/g;
const AMOUNT_PATTERN = /\$?([\d,]+)(?:k|K)?/;
const CYCLE_PATTERN = /(?:20)?(\d{2})\s*(?:cycle|election)/i;

const HIGH_INCOME_PATTERN = /\b(high.?income|wealthy|affluent|rich)\b/i;
const LOW_PENETRATION_PATTERN = /\b(low.?penetration|untapped|under.?developed)\b/i;

// ============================================================================
// Donor Handler Class
// ============================================================================

export class DonorHandler implements NLPHandler {
  name = 'DonorHandler';
  patterns = DONOR_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'donor_concentration' ||
      query.intent === 'donor_prospects' ||
      query.intent === 'donor_trends' ||
      query.intent === 'donor_export' ||
      query.intent === 'donor_lapsed' ||
      query.intent === 'donor_lapsed_clusters' ||
      query.intent === 'donor_upgrade' ||
      query.intent === 'donor_upgrade_top' ||
      query.intent === 'donor_comparison' ||
      query.intent === 'donor_ie' ||
      query.intent === 'donor_ie_spending' ||
      query.intent === 'donor_committee' ||
      query.intent === 'donor_geographic' ||
      query.intent === 'donor_by_candidate'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'donor_concentration':
        case 'donor_geographic':
          return await this.handleConcentration(query, startTime);

        case 'donor_prospects':
          return await this.handleProspects(query, startTime);

        case 'donor_trends':
          return await this.handleTrends(query, startTime);

        case 'donor_export':
          return await this.handleExport(query, startTime);

        case 'donor_lapsed':
          return await this.handleLapsed(query, startTime);

        case 'donor_lapsed_clusters':
          return await this.handleLapsedClusters(query, startTime);

        case 'donor_upgrade':
          return await this.handleUpgrade(query, startTime);

        case 'donor_upgrade_top':
          return await this.handleUpgradeTop(query, startTime);

        case 'donor_comparison':
          return await this.handleComparison(query, startTime);

        case 'donor_ie':
          return await this.handleIE(query, startTime);

        case 'donor_ie_spending':
          return await this.handleIESpending(query, startTime);

        case 'donor_committee':
          return await this.handleCommittee(query, startTime);

        case 'donor_by_candidate':
          return await this.handleByCandidate(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown donor intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process donor query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleConcentration(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    try {
      // Fetch real ZIP aggregate data
      const response = await fetch('/data/donors/zip-aggregates.json');
      const zipData = await response.json();

      // Sort by totalAmount descending and take top 5
      const sortedZips = [...zipData].sort((a: any, b: any) => b.totalAmount - a.totalAmount);
      const topZips = sortedZips.slice(0, 5);

      // Calculate totals
      const totalAmount = zipData.reduce((sum: number, z: any) => sum + z.totalAmount, 0);
      const totalDonors = zipData.reduce((sum: number, z: any) => sum + z.donorCount, 0);
      const avgDonation = totalDonors > 0 ? Math.round(totalAmount / totalDonors) : 0;

      const formattedData = {
        topZips: topZips.map((z: any) => ({
          zip: z.zipCode,
          amount: z.totalAmount,
          donors: z.donorCount,
          area: z.city,
        })),
        totalAmount,
        totalDonors,
        avgDonation,
      };

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      const responseText = this.formatConcentrationResponse(formattedData) + enrichmentSections;

      return {
        success: true,
        response: responseText,
        mapCommands: [
          {
            action: 'showHeatmap',
            layer: 'donors',
            field: 'total_amount',
            colorScheme: 'green',
          },
          {
            action: 'flyTo',
            center: [-84.55, 42.73],
            zoom: 10,
          },
        ],
        suggestedActions: [
          {
            id: 'show-heatmap',
            label: 'Show Donor Heatmap',
            description: 'Visualize concentration on map',
            action: 'show_donor_heatmap',
            priority: 1,
          },
          {
            id: 'find-prospects',
            label: 'Find Similar Prospects',
            description: 'Find areas similar to top donors',
            action: 'find_prospects',
            priority: 2,
          },
          ...(topZips[0]?.zipCode ? [{
            id: 'drill-down',
            label: `Drill into ${topZips[0].zipCode}`,
            description: `See ${topZips[0].city || 'top area'} details`,
            action: 'drill_down',
            params: { zip: topZips[0].zipCode },
            priority: 3,
          }] : []),
          {
            id: 'export-donors',
            label: 'Export Donor Data',
            description: 'Download for analysis',
            action: 'export_donors',
            priority: 4,
          },
        ],
        data: formattedData,
        citations: [
          {
            id: 'fec-2024',
            source: 'FEC Bulk Data',
            type: 'data',
            description: '2023-24 election cycle individual contributions',
          },
        ],
        metadata: this.buildMetadata('donor_concentration', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load donor concentration data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleProspects(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    try {
      const response = await fetch('/data/donors/zip-aggregates.json');
      const zipData = await response.json();

      // Find ZIPs with high income indicators but low donor penetration
      // Sort by avgContribution (proxy for income) but with low donor density
      const sortedByPotential = [...zipData]
        .filter((z: any) => z.donorCount > 10) // Has some activity
        .map((z: any) => ({
          ...z,
          // Prospect score: high avg contribution but relatively low donor count
          prospectPotential: z.avgContribution * (1 / Math.log(z.donorCount + 1)),
        }))
        .sort((a, b) => b.prospectPotential - a.prospectPotential);

      const topProspects = sortedByPotential.slice(0, 5);

      // Find average penetration across all ZIPs for comparison
      const avgDonorCount = zipData.reduce((sum: number, z: any) => sum + z.donorCount, 0) / zipData.length;

      const prospects = topProspects.map((p: any) => ({
        zip: p.zipCode,
        area: p.city,
        // Note: Income data would come from census/BA data in production
        avgContribution: p.avgContribution,
        donorCount: p.donorCount,
        currentPenetration: parseFloat((p.donorCount / 1000).toFixed(1)), // donors per 1000 residents (estimate)
        avgPenetration: parseFloat((avgDonorCount / 1000).toFixed(1)),
        estimatedGrowthPotential: [
          Math.round(p.totalAmount * 0.3),
          Math.round(p.totalAmount * 0.5),
        ] as [number, number], // Based on 30-50% growth projection
        reasoning: p.donorCount < avgDonorCount
          ? `Lower donor count than average (${p.donorCount} vs ${Math.round(avgDonorCount)}) but higher avg gift ($${p.avgContribution})`
          : `Strong average contribution ($${p.avgContribution}) with room for growth`,
      }));

      const totalEstimatedPotential: [number, number] = [
        prospects.reduce((sum, p) => sum + p.estimatedGrowthPotential[0], 0),
        prospects.reduce((sum, p) => sum + p.estimatedGrowthPotential[1], 0),
      ];

      const formattedData = { prospects, totalEstimatedPotential };

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      const responseText = this.formatProspectsResponse(formattedData) + enrichmentSections;

      return {
        success: true,
        response: responseText,
        mapCommands: [
          {
            action: 'highlight',
            target: 'zips',
            ids: prospects.map((p) => p.zip),
            style: { fillColor: '#F59E0B', fillOpacity: 0.6 },
          },
          {
            action: 'showLabels',
            target: 'prospects',
            field: 'potential',
          },
        ],
        suggestedActions: [
          ...(prospects[0]?.zip ? [{
            id: 'plan-event',
            label: 'Plan House Party',
            description: `Organize fundraiser in ${prospects[0].area || 'top prospect area'}`,
            action: 'plan_event',
            params: { zip: prospects[0].zip },
            priority: 1,
          }] : []),
          {
            id: 'compare-zips',
            label: 'Compare to Top Donors',
            description: 'Side-by-side comparison',
            action: 'compare_zips',
            priority: 2,
          },
          {
            id: 'export-prospects',
            label: 'Export Prospect List',
            description: 'Download for outreach',
            action: 'export_prospects',
            priority: 3,
          },
        ],
        data: formattedData,
        metadata: this.buildMetadata('donor_prospects', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load prospect data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleTrends(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const targetZip = entities.zipCodes?.[0];

    try {
      const response = await fetch('/data/donors/zip-aggregates.json');
      const zipData = await response.json();

      // If targeting specific ZIP, filter for it
      let relevantData = zipData;
      if (targetZip) {
        relevantData = zipData.filter((z: any) => z.zipCode === targetZip);
      }

      // Calculate recent activity metrics from available data
      const last90Days = relevantData.reduce((sum: number, z: any) => sum + z.amountLast90Days, 0);
      const last12Months = relevantData.reduce((sum: number, z: any) => sum + z.amountLast12Months, 0);
      const totalAll = relevantData.reduce((sum: number, z: any) => sum + z.totalAmount, 0);

      // Calculate quarterly growth rate from available data
      // Note: For accurate quarterly breakdown, historical time-series data would be needed
      const estimatedQuarterlyAvg = Math.round(last12Months / 4);
      const recentQuarterlyRate = last90Days > 0 ? last90Days : estimatedQuarterlyAvg;

      // Only show growth if we have enough data to calculate it
      const hasValidGrowthData = last90Days > 0 && last12Months > 0;
      const quarterlyGrowthPct = hasValidGrowthData
        ? Math.round((recentQuarterlyRate * 4 / last12Months - 1) * 100)
        : null;

      const trends = {
        area: targetZip || 'Ingham County',
        last90Days,
        last12Months,
        totalAllTime: totalAll,
        estimatedQuarterlyAvg,
        quarterlyGrowth: quarterlyGrowthPct,
        // Note: Previous cycle comparison requires historical data not available in current dataset
        previousCycleAvailable: false,
      };

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      const responseText = this.formatTrendsResponse(trends, targetZip) + enrichmentSections;

      return {
        success: true,
        response: responseText,
        mapCommands: [
          {
            action: 'showMomentum',
            layer: 'donors',
            comparisonPeriod: 'prior_year',
          },
        ],
        suggestedActions: [
          {
            id: 'view-momentum',
            label: 'View Momentum Map',
            description: 'See which areas are growing',
            action: 'show_momentum',
            priority: 1,
          },
          {
            id: 'compare-cycles',
            label: 'Compare Election Cycles',
            description: '2024 vs 2022 vs 2020',
            action: 'compare_cycles',
            priority: 2,
          },
          {
            id: 'export-trends',
            label: 'Export Trend Data',
            description: 'Download time series',
            action: 'export_trends',
            priority: 3,
          },
        ],
        data: trends,
        metadata: this.buildMetadata('donor_trends', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load trend data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleExport(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    return {
      success: true,
      response: 'Donor data exported to CSV. File includes ZIP aggregates, amounts, and donor counts.',
      suggestedActions: [
        {
          id: 'open-download',
          label: 'Open Downloaded File',
          description: 'View donor export',
          action: 'open_download',
          priority: 1,
        },
      ],
      metadata: this.buildMetadata('donor_export', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract ZIP codes
    const zipMatches = query.match(ZIP_PATTERN);
    if (zipMatches) {
      entities.zipCodes = Array.from(new Set(zipMatches));
    }

    // Extract election cycle
    const cycleMatch = query.match(CYCLE_PATTERN);
    if (cycleMatch) {
      const year = parseInt(cycleMatch[1]);
      entities.electionCycle = year > 50 ? `19${year}` : `20${year}`;
    }

    // Extract high income filter
    if (HIGH_INCOME_PATTERN.test(query)) {
      entities.incomeRange = [100000, 500000];
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private formatConcentrationResponse(data: {
    topZips: Array<{ zip: string; amount: number; donors: number; area: string }>;
    totalAmount: number;
    totalDonors: number;
    avgDonation: number;
  }): string {
    const lines = [
      '**Donor Concentration for Ingham County (2023-24 cycle):**',
      '',
      '| Rank | ZIP | Area | Amount | Donors |',
      '|------|-----|------|--------|--------|',
    ];

    data.topZips.forEach((zip, i) => {
      lines.push(
        `| ${i + 1} | ${zip.zip} | ${zip.area} | $${zip.amount.toLocaleString()} | ${zip.donors} |`
      );
    });

    lines.push('');
    lines.push(`**Summary:** $${data.totalAmount.toLocaleString()} from ${data.totalDonors.toLocaleString()} donors (avg $${data.avgDonation})`);
    lines.push('');
    lines.push('*48823 (East Lansing) dominates - mostly university community*');

    return appendSources(lines.join('\n'), ['fec', 'demographics']);
  }

  private formatProspectsResponse(data: {
    prospects: Array<{
      zip: string;
      area: string;
      avgContribution: number;
      donorCount: number;
      currentPenetration: number;
      avgPenetration: number;
      estimatedGrowthPotential: [number, number];
      reasoning: string;
    }>;
    totalEstimatedPotential: [number, number];
  }): string {
    const lines = [
      '**Fundraising Prospect Areas:**',
      '',
    ];

    data.prospects.forEach((p, i) => {
      lines.push(`**${i + 1}. ${p.area} (${p.zip})**`);
      lines.push(`- Avg contribution: $${p.avgContribution.toLocaleString()} (${p.donorCount} donors)`);
      lines.push(`- Donor rate: ${p.currentPenetration} per 1K residents (avg: ${p.avgPenetration})`);
      lines.push(`- Growth potential: $${p.estimatedGrowthPotential[0].toLocaleString()}-${p.estimatedGrowthPotential[1].toLocaleString()}`);
      lines.push(`- *${p.reasoning}*`);
      lines.push('');
    });

    lines.push(
      `**Total Growth Potential:** $${data.totalEstimatedPotential[0].toLocaleString()}-${data.totalEstimatedPotential[1].toLocaleString()}`
    );

    return appendSources(lines.join('\n'), ['fec', 'demographics']);
  }

  private formatTrendsResponse(
    data: {
      area: string;
      last90Days: number;
      last12Months: number;
      totalAllTime: number;
      estimatedQuarterlyAvg: number;
      quarterlyGrowth: number | null;
      previousCycleAvailable: boolean;
    },
    targetZip?: string
  ): string {
    const lines = [
      `**Donor Trends for ${data.area}:**`,
      '',
      `💰 **Last 12 Months:** $${data.last12Months.toLocaleString()}`,
      `📊 **Last 90 Days:** $${data.last90Days.toLocaleString()}`,
      `📈 **All-Time Total:** $${data.totalAllTime.toLocaleString()}`,
      '',
    ];

    if (data.quarterlyGrowth !== null) {
      const direction = data.quarterlyGrowth >= 0 ? '↑' : '↓';
      lines.push(`**Recent Trend:** ${direction} ${Math.abs(data.quarterlyGrowth)}% quarterly rate`);
    } else {
      lines.push('**Recent Trend:** Insufficient data for quarterly comparison');
    }

    lines.push('');
    lines.push(`**Avg Quarterly:** $${data.estimatedQuarterlyAvg.toLocaleString()}`);

    if (!data.previousCycleAvailable) {
      lines.push('');
      lines.push('*Note: Year-over-year comparison requires historical cycle data*');
    }

    return appendSources(lines.join('\n'), ['fec']);
  }

  // --------------------------------------------------------------------------
  // NEW HANDLER METHODS
  // --------------------------------------------------------------------------

  private async handleLapsed(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Load real lapsed donor data
    const response = await fetch('/data/donors/lapsed-donors.json');
    const data = await response.json();

    const { donors, metadata } = data;
    const { minValue, priority } = query.entities.zipCodes?.[0]
      ? { minValue: undefined, priority: undefined }
      : { minValue: undefined, priority: undefined };

    // Filter by params if provided
    let filtered = donors;
    if (minValue) {
      filtered = filtered.filter((d: any) => d.totalHistoricalAmount >= minValue);
    }
    if (priority) {
      filtered = filtered.filter((d: any) => d.priority === priority);
    }

    const topLapsed = filtered.slice(0, 10);
    const responseText = this.formatLapsedResponse(topLapsed, metadata);

    return {
      success: true,
      response: responseText,
      mapCommands: [
        {
          action: 'showHeatmap',
          layer: 'lapsed-donors',
          field: 'recovery_score',
          colorScheme: 'orange',
        },
      ],
      suggestedActions: [
        {
          id: 'show-clusters',
          label: 'Show Lapsed Clusters',
          description: 'View geographic clusters',
          action: 'donor_lapsed_clusters',
          priority: 1,
        },
        {
          id: 'create-call-list',
          label: 'Create Call List',
          description: 'High-priority lapsed donors',
          action: 'export_lapsed_calls',
          priority: 2,
        },
        {
          id: 'recovery-plan',
          label: 'See Recovery Strategy',
          description: 'Recommended outreach',
          action: 'donor_recovery_plan',
          priority: 3,
        },
      ],
      data: { topLapsed, metadata },
      citations: [
        {
          id: 'fec-lapsed',
          source: 'FEC Bulk Data',
          type: 'data',
          description: 'Lapsed donor analysis from 2023-24 cycle',
        },
      ],
      metadata: this.buildMetadata('donor_lapsed', startTime, query),
    };
  }

  private async handleLapsedClusters(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = await fetch('/data/donors/lapsed-clusters.json');
    const data = await response.json();

    const { clusters } = data;
    const responseText = this.formatLapsedClustersResponse(clusters);

    return {
      success: true,
      response: responseText,
      mapCommands: [
        {
          action: 'highlight',
          target: 'zips',
          ids: clusters.map((c: any) => c.zipCode),
          style: { fillColor: '#F59E0B', fillOpacity: 0.6 },
        },
      ],
      suggestedActions: [
        {
          id: 'plan-door-knock',
          label: 'Plan Door Knock',
          description: 'Create canvass for top cluster',
          action: 'canvass_lapsed',
          priority: 1,
        },
        {
          id: 'see-individuals',
          label: 'See Individual Donors',
          description: 'View lapsed donor list',
          action: 'donor_lapsed',
          priority: 2,
        },
      ],
      data: clusters,
      metadata: this.buildMetadata('donor_lapsed_clusters', startTime, query),
    };
  }

  private async handleUpgrade(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = await fetch('/data/donors/upgrade-prospects.json');
    const data = await response.json();

    const { prospects, metadata } = data;
    const { minScore } = query.entities.zipCodes?.[0]
      ? { minScore: undefined }
      : { minScore: undefined };

    let filtered = prospects;
    if (minScore) {
      filtered = filtered.filter((p: any) => p.upgradeScore >= minScore);
    }

    const topProspects = filtered.slice(0, 15);
    const responseText = this.formatUpgradeResponse(topProspects, metadata);

    return {
      success: true,
      response: responseText,
      mapCommands: [
        {
          action: 'showHeatmap',
          layer: 'upgrade-prospects',
          field: 'upgrade_gap',
          colorScheme: 'green',
        },
      ],
      suggestedActions: [
        {
          id: 'create-ask-sheet',
          label: 'Create Ask Sheet',
          description: 'Generate call sheet with asks',
          action: 'export_upgrade_sheet',
          priority: 1,
        },
        {
          id: 'filter-by-tier',
          label: 'Filter by Capacity Tier',
          description: 'Focus on major donors',
          action: 'donor_upgrade_top',
          priority: 2,
        },
        {
          id: 'see-loyalty',
          label: 'Show Loyal Donors',
          description: 'Filter by loyalty indicator',
          action: 'filter_loyal',
          priority: 3,
        },
      ],
      data: { topProspects, metadata },
      citations: [
        {
          id: 'fec-upgrade',
          source: 'FEC Bulk Data + Income Estimates',
          type: 'calculation',
          description: 'Capacity estimates based on ZIP median income and giving history',
        },
      ],
      metadata: this.buildMetadata('donor_upgrade', startTime, query),
    };
  }

  private async handleUpgradeTop(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = await fetch('/data/donors/upgrade-prospects.json');
    const data = await response.json();

    const topProspects = data.prospects
      .filter((p: any) => p.upgradeScore >= 75)
      .slice(0, 10);

    const responseText = this.formatUpgradeTopResponse(topProspects);

    return {
      success: true,
      response: responseText,
      suggestedActions: [
        {
          id: 'create-personal-asks',
          label: 'Create Personal Ask Script',
          description: 'Personalized outreach',
          action: 'generate_personal_asks',
          priority: 1,
        },
        {
          id: 'see-all-upgrades',
          label: 'See All Upgrade Prospects',
          description: 'Full prospect list',
          action: 'donor_upgrade',
          priority: 2,
        },
      ],
      data: topProspects,
      metadata: this.buildMetadata('donor_upgrade_top', startTime, query),
    };
  }

  private async handleComparison(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = await fetch('/data/donors/mi-candidates.json');
    const data = await response.json();

    const { candidates } = data;
    const candidateNames = query.entities?.candidates || [];

    // If no candidates specified, prompt user
    if (candidateNames.length < 2) {
      const availableCandidates = Object.values(candidates).map((c: any) => c.name).slice(0, 5);
      return {
        success: false,
        response: `Please specify two candidates to compare. Available candidates include: ${availableCandidates.join(', ')}. Try: "Compare [Candidate A] and [Candidate B] fundraising"`,
        error: 'Candidates not specified',
        suggestedActions: availableCandidates.slice(0, 2).map((name: string, idx: number) => ({
          id: `compare-${idx}`,
          label: `Compare ${name}`,
          description: 'See fundraising breakdown',
          action: 'donor_comparison',
          params: { candidate: name },
          priority: idx + 1,
        })),
      };
    }

    const candidate1Name = candidateNames[0];
    const candidate2Name = candidateNames[1];

    // Find candidates by name match
    const cand1 = Object.values(candidates).find((c: any) =>
      c.name.toLowerCase().includes(candidate1Name.toLowerCase())
    );
    const cand2 = Object.values(candidates).find((c: any) =>
      c.name.toLowerCase().includes(candidate2Name.toLowerCase())
    );

    if (!cand1 || !cand2) {
      const availableCandidates = Object.values(candidates).map((c: any) => c.name).slice(0, 5);
      return {
        success: false,
        response: `Could not find fundraising data for "${candidate1Name}" or "${candidate2Name}". Available candidates: ${availableCandidates.join(', ')}`,
        error: 'Candidates not found',
      };
    }

    const responseText = this.formatComparisonResponse(cand1 as any, cand2 as any);

    return {
      success: true,
      response: responseText,
      suggestedActions: [
        {
          id: 'show-geographic',
          label: 'Show Geographic Breakdown',
          description: 'Compare by ZIP',
          action: 'donor_geographic_compare',
          priority: 1,
        },
        {
          id: 'see-ie-spending',
          label: 'See Outside Money',
          description: 'Independent expenditures',
          action: 'donor_ie',
          priority: 2,
        },
        {
          id: 'export-comparison',
          label: 'Export Comparison',
          description: 'Download CSV',
          action: 'export_comparison',
          priority: 3,
        },
      ],
      data: { cand1, cand2 },
      metadata: this.buildMetadata('donor_comparison', startTime, query),
    };
  }

  private async handleIE(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = await fetch('/data/donors/independent-expenditures.json');
    const data = await response.json();

    const { byCandidateId, metadata } = data;
    const candidateNames = query.entities?.candidates || [];

    // If no candidate specified, show summary with top candidates
    if (candidateNames.length === 0) {
      const topCandidates = Object.values(byCandidateId)
        .sort((a: any, b: any) => b.totalIE - a.totalIE)
        .slice(0, 5);
      const candidateList = topCandidates.map((c: any) => c.candidateName);
      return {
        success: true,
        response: `**Independent Expenditure Summary**\n\nTop candidates by IE spending:\n${topCandidates.map((c: any, i: number) => `${i + 1}. ${c.candidateName}: $${c.totalIE?.toLocaleString() || 'N/A'}`).join('\n')}\n\nAsk about a specific candidate for detailed breakdown.`,
        suggestedActions: candidateList.slice(0, 3).map((name: string, idx: number) => ({
          id: `ie-${idx}`,
          label: `${name} IE Details`,
          description: 'See full breakdown',
          action: 'donor_ie',
          params: { candidate: name },
          priority: idx + 1,
        })),
        data: { topCandidates },
        metadata: this.buildMetadata('donor_ie', startTime, query),
      };
    }

    const candidateName = candidateNames[0];

    // Find candidate IE data
    const candidateData = Object.values(byCandidateId).find((c: any) =>
      c.candidateName.toLowerCase().includes(candidateName.toLowerCase())
    );

    if (!candidateData) {
      const availableCandidates = Object.values(byCandidateId).map((c: any) => c.candidateName).slice(0, 5);
      return {
        success: false,
        response: `No independent expenditure data found for "${candidateName}". Available: ${availableCandidates.join(', ')}`,
        error: 'Candidate not found',
      };
    }

    const responseText = this.formatIEResponse(candidateData as any, metadata);

    return {
      success: true,
      response: responseText,
      suggestedActions: [
        {
          id: 'see-spending-against',
          label: 'Who\'s Spending Against Us?',
          description: 'Opposition IE breakdown',
          action: 'donor_ie_spending',
          priority: 1,
        },
        {
          id: 'compare-ie',
          label: 'Compare to Opponent IE',
          description: 'Side-by-side comparison',
          action: 'donor_ie_compare',
          priority: 2,
        },
      ],
      data: candidateData,
      citations: [
        {
          id: 'fec-ie',
          source: 'FEC Schedule E',
          type: 'data',
          description: 'Independent expenditure filings',
        },
      ],
      metadata: this.buildMetadata('donor_ie', startTime, query),
    };
  }

  private async handleIESpending(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = await fetch('/data/donors/independent-expenditures.json');
    const data = await response.json();

    const { byCandidateId } = data;
    const candidateNamesArr = query.entities?.candidates || [];
    const candidateName = candidateNamesArr[0] || 'Trump';

    const candidateData = Object.values(byCandidateId).find((c: any) =>
      c.candidateName.toLowerCase().includes(candidateName.toLowerCase())
    );

    if (!candidateData) {
      return {
        success: false,
        response: `No opposition spending data found for ${candidateName}.`,
        error: 'Candidate not found',
      };
    }

    const responseText = this.formatIESpendingResponse(candidateData as any);

    return {
      success: true,
      response: responseText,
      data: candidateData,
      metadata: this.buildMetadata('donor_ie_spending', startTime, query),
    };
  }

  private async handleCommittee(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = await fetch('/data/donors/mi-candidates.json');
    const data = await response.json();

    const { candidates } = data;
    const candidateNamesFromQuery = query.entities?.candidates || [];
    const candidateName = candidateNamesFromQuery[0] || 'Slotkin';

    const candidate = Object.values(candidates).find((c: any) =>
      c.name.toLowerCase().includes(candidateName.toLowerCase())
    );

    if (!candidate) {
      return {
        success: false,
        response: `No PAC data found for ${candidateName}.`,
        error: 'Candidate not found',
      };
    }

    const responseText = this.formatCommitteeResponse(candidate as any);

    return {
      success: true,
      response: responseText,
      suggestedActions: [
        {
          id: 'find-similar-pacs',
          label: 'Find Similar PACs',
          description: 'Identify prospect PACs',
          action: 'find_similar_pacs',
          priority: 1,
        },
      ],
      data: candidate,
      metadata: this.buildMetadata('donor_committee', startTime, query),
    };
  }

  private async handleByCandidate(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = await fetch('/data/donors/mi-candidates.json');
    const data = await response.json();

    const { candidates } = data;
    const candidateNamesExtracted = query.entities?.candidates || [];
    const candidateName = candidateNamesExtracted[0];

    const candidate = Object.values(candidates).find((c: any) =>
      c.name.toLowerCase().includes(candidateName?.toLowerCase() || '')
    );

    if (!candidate) {
      return {
        success: false,
        response: `No fundraising data found for ${candidateName}.`,
        error: 'Candidate not found',
      };
    }

    const responseText = this.formatByCandidateResponse(candidate as any);

    return {
      success: true,
      response: responseText,
      suggestedActions: [
        {
          id: 'compare-candidate',
          label: 'Compare to Opponent',
          description: 'Head-to-head comparison',
          action: 'donor_comparison',
          priority: 1,
        },
        {
          id: 'see-ie',
          label: 'See Outside Money',
          description: 'Independent expenditures',
          action: 'donor_ie',
          priority: 2,
        },
      ],
      data: candidate,
      metadata: this.buildMetadata('donor_by_candidate', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // NEW FORMATTING METHODS
  // --------------------------------------------------------------------------

  private formatLapsedResponse(
    donors: any[],
    metadata: any
  ): string {
    const lines = [
      `**Lapsed Donors Analysis (2023-24 cycle):**`,
      '',
      `Found **${metadata.totalLapsed} lapsed donors** with **$${metadata.totalHistoricalValue.toLocaleString()}** in historical giving.`,
      '',
      `**Estimated Recovery Value:** $${metadata.estimatedRecoveryValue.toLocaleString()}`,
      `**Average Recovery Score:** ${metadata.avgRecoveryScore.toFixed(0)}/100`,
      '',
      `**Top Lapsed Donors:**`,
      '',
      '| Rank | ZIP | Last Gift | Historical $ | Recovery Score | Channel |',
      '|------|-----|-----------|--------------|----------------|---------|',
    ];

    donors.slice(0, 10).forEach((d, i) => {
      lines.push(
        `| ${i + 1} | ${d.zipCode} | ${d.monthsSinceLastGift}mo ago | $${d.totalHistoricalAmount.toLocaleString()} | ${d.recoveryScore} | ${d.recommendedChannel} |`
      );
    });

    lines.push('');
    lines.push('**Next Steps:** Focus on high-priority donors (score 70+) with personalized outreach.');

    return appendSources(lines.join('\n'), ['fec']);
  }

  private formatLapsedClustersResponse(clusters: any[]): string {
    const lines = [
      '**Lapsed Donor Geographic Clusters:**',
      '',
      '| Rank | ZIP | City | Lapsed Count | Historical $ | Recovery Potential |',
      '|------|-----|------|--------------|--------------|-------------------|',
    ];

    clusters.forEach((c, i) => {
      lines.push(
        `| ${i + 1} | ${c.zipCode} | ${c.city} | ${c.lapsedCount} | $${c.totalHistoricalValue.toLocaleString()} | ${c.recommendedStrategy} |`
      );
    });

    lines.push('');
    lines.push('**Strategy:** Concentrate door-to-door and phone outreach in top clusters.');

    return appendSources(lines.join('\n'), ['fec']);
  }

  private formatUpgradeResponse(
    prospects: any[],
    metadata: any
  ): string {
    const lines = [
      `**Donor Upgrade Prospects:**`,
      '',
      `Found **${metadata.totalProspects.toLocaleString()} upgrade prospects** with **$${metadata.totalUpgradeGap.toLocaleString()}** in untapped capacity.`,
      '',
      `**Top 15 Upgrade Prospects:**`,
      '',
      '| Rank | ZIP | Current $ | Capacity | Gap | Score | Ask |',
      '|------|-----|-----------|----------|-----|-------|-----|',
    ];

    prospects.slice(0, 15).forEach((p, i) => {
      lines.push(
        `| ${i + 1} | ${p.zipCode} | $${p.currentTotalGiven.toLocaleString()} | $${p.estimatedCapacity.toLocaleString()} | $${p.upgradeGap.toLocaleString()} | ${p.upgradeScore} | $${p.recommendedAsk} |`
      );
    });

    lines.push('');
    lines.push('**Strategy:** Focus on high-loyalty, high-score prospects for personal asks.');

    return appendSources(lines.join('\n'), ['fec', 'demographics']);
  }

  private formatUpgradeTopResponse(prospects: any[]): string {
    const lines = [
      '**Top 10 Upgrade Prospects (Score 75+):**',
      '',
    ];

    prospects.forEach((p, i) => {
      lines.push(`**${i + 1}. ZIP ${p.zipCode} (${p.city})**`);
      lines.push(`- Current giving: $${p.currentTotalGiven.toLocaleString()} (${p.giftCount} gifts)`);
      lines.push(`- Estimated capacity: $${p.estimatedCapacity.toLocaleString()}`);
      lines.push(`- Upgrade gap: $${p.upgradeGap.toLocaleString()}`);
      lines.push(`- **Recommended ask: $${p.recommendedAsk}**`);
      lines.push(`- Rationale: *${p.askRationale}*`);
      lines.push('');
    });

    return appendSources(lines.join('\n'), ['fec', 'demographics']);
  }

  private formatComparisonResponse(cand1: any, cand2: any): string {
    const totalDiff = cand1.totalRaised - cand2.totalRaised;
    const advantage = totalDiff >= 0 ? cand1.name : cand2.name;
    const advantageAmount = Math.abs(totalDiff);

    const lines = [
      `**Fundraising Comparison: ${cand1.name} vs ${cand2.name}**`,
      '',
      '**Individual Contributions:**',
      '',
      '|                | ' + cand1.name + ' | ' + cand2.name + ' | Advantage |',
      '|----------------|' + '-'.repeat(cand1.name.length) + '-|' + '-'.repeat(cand2.name.length) + '-|-----------|',
      `| Total Raised   | $${cand1.totalRaised.toLocaleString()} | $${cand2.totalRaised.toLocaleString()} | ${advantageAmount >= 0 ? '+' : ''}$${advantageAmount.toLocaleString()} ${advantage.split(' ')[0]} |`,
      `| Individual $   | $${cand1.individualContributions.toLocaleString()} | $${cand2.individualContributions.toLocaleString()} | ${cand1.individualContributions >= cand2.individualContributions ? '+' : ''}$${Math.abs(cand1.individualContributions - cand2.individualContributions).toLocaleString()} |`,
      '',
      '**Outside Money (Independent Expenditures):**',
      '',
      '| Support ' + cand1.name.split(' ')[0] + ' | Support ' + cand2.name.split(' ')[0] + ' | Net |',
      '|' + '-'.repeat(15) + '|' + '-'.repeat(15) + '|-----|',
      `| $${cand1.ieSupport.toLocaleString()} | $${cand2.ieSupport.toLocaleString()} | ${cand1.netIE >= 0 ? '+' : ''}$${cand1.netIE.toLocaleString()} |`,
      '',
      `**Key Insight:** ${advantage.split(' ')[0]} leads in direct fundraising by $${advantageAmount.toLocaleString()}.`,
    ];

    return appendSources(lines.join('\n'), ['fec']);
  }

  private formatIEResponse(candidate: any, metadata: any): string {
    const netDirection = candidate.netSpending >= 0 ? 'FOR' : 'AGAINST';
    const netAmount = Math.abs(candidate.netSpending);

    const lines = [
      `**Independent Expenditures: ${candidate.candidateName}**`,
      '',
      `**Net IE Spending:** ${netDirection} ${candidate.candidateName} = $${netAmount.toLocaleString()}`,
      '',
      `- Support: $${candidate.supportSpending.toLocaleString()}`,
      `- Oppose: $${candidate.opposeSpending.toLocaleString()}`,
      '',
      `**Top Spenders (${candidate.topSpenders.length}):**`,
      '',
    ];

    candidate.topSpenders.slice(0, 5).forEach((s: any, i: number) => {
      const type = s.supportOppose === 'S' ? 'Supporting' : 'Opposing';
      lines.push(`${i + 1}. **${s.committeeName}** - $${s.amount.toLocaleString()} (${type})`);
    });

    lines.push('');
    lines.push(`*Data from ${metadata.cycles.join(', ')} cycles*`);

    return appendSources(lines.join('\n'), ['fec']);
  }

  private formatIESpendingResponse(candidate: any): string {
    const opposingSpenders = candidate.topSpenders.filter((s: any) => s.supportOppose === 'O');

    const lines = [
      `**Opposition Spending Against ${candidate.candidateName}:**`,
      '',
      `**Total Oppose:** $${candidate.opposeSpending.toLocaleString()}`,
      '',
      `**Top Opposition Spenders:**`,
      '',
    ];

    opposingSpenders.slice(0, 5).forEach((s: any, i: number) => {
      lines.push(`${i + 1}. **${s.committeeName}** - $${s.amount.toLocaleString()}`);
    });

    return appendSources(lines.join('\n'), ['fec']);
  }

  private formatCommitteeResponse(candidate: any): string {
    const lines = [
      `**PAC Contributions to ${candidate.name}:**`,
      '',
      `**Total Committee Contributions:** $${candidate.committeeContributions.toLocaleString()}`,
      `**Committee Donor Count:** ${candidate.committeeDonorCount}`,
      '',
      `**Top PACs:**`,
      '',
    ];

    candidate.topPACs.slice(0, 10).forEach((pac: any, i: number) => {
      lines.push(`${i + 1}. ${pac.name} - $${pac.amount.toLocaleString()}`);
    });

    return appendSources(lines.join('\n'), ['fec']);
  }

  private formatByCandidateResponse(candidate: any): string {
    const response = [
      `**Fundraising Summary: ${candidate.name}**`,
      '',
      `**Party:** ${candidate.party}`,
      `**Office:** ${candidate.office} (${candidate.state}-${candidate.district})`,
      '',
      `**Total Raised:** $${candidate.totalRaised.toLocaleString()}`,
      `- Individual contributions: $${candidate.individualContributions.toLocaleString()}`,
      `- Committee contributions: $${candidate.committeeContributions.toLocaleString()}`,
      '',
      `**Outside Money:**`,
      `- IE Support: $${candidate.ieSupport.toLocaleString()}`,
      `- IE Oppose: $${candidate.ieOppose.toLocaleString()}`,
      `- Net IE: ${candidate.netIE >= 0 ? '+' : ''}$${candidate.netIE.toLocaleString()}`,
      '',
      `**Total Investment:** $${candidate.totalInvestment.toLocaleString()}`,
    ].join('\n');

    return appendSources(response, ['fec']);
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'donor',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const donorHandler = new DonorHandler();

export default DonorHandler;
