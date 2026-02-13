/**
 * Political Chat API
 *
 * Natural language interface for political data queries.
 * Supports queries like:
 * - "Compare Lansing vs Mason"
 * - "Which precincts have highest swing potential?"
 * - "What's the partisan lean of East Lansing?"
 *
 * Includes RAG (Retrieval-Augmented Generation) for methodology
 * and data source documentation, with citation support.
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { politicalQueryRouter, ParsedPoliticalQuery } from '@/lib/analysis/PoliticalQueryRouter';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getDocumentRetriever } from '@/lib/rag';
import { getKnowledgeGraph, getGraphPopulator, Entity, Relationship } from '@/lib/knowledge-graph';
import { enrich, formatForSystemPrompt as formatEnrichmentForSystemPrompt, type EnrichmentContext } from '@/lib/context';
import type { MapCommand } from '@/lib/ai-native/types';

export const maxDuration = 120;
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  console.log('[Political Chat API] Endpoint called');

  try {
    const { messages, includeData = true, context, currentQuery, userContext } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Log context if provided (Phase 3 - Claude Integration)
    if (context) {
      console.log('[Political Chat API] Session context provided:', {
        hasContext: !!context,
        contextLength: context?.length || 0,
      });
    }

    // Get the latest user message
    const latestMessage = messages[messages.length - 1];
    if (latestMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    const userQuery = latestMessage.content;
    console.log('[Political Chat API] User query:', userQuery);

    // Parse the query using PoliticalQueryRouter
    const routeResult = politicalQueryRouter.parseQuery(userQuery);
    console.log('[Political Chat API] Query parsed:', {
      type: routeResult.parsed.type,
      handler: routeResult.handler,
      locations: routeResult.parsed.locationNames,
      confidence: routeResult.parsed.confidence,
    });

    // Fetch relevant data based on parsed query
    let contextData = '';
    if (includeData && routeResult.parsed.confidence > 0.4) {
      contextData = await fetchDataForQuery(routeResult.parsed);
    }

    // Unified Context Enrichment: RAG + Knowledge Graph in one call
    let enrichmentContext: EnrichmentContext | null = null;
    let enrichmentPromptContext = '';
    try {
      // Determine enrichment options from parsed query
      const jurisdiction = routeResult.parsed.locationNames.length > 0
        ? routeResult.parsed.locationNames[0]
        : 'Ingham County';

      enrichmentContext = await enrich(userQuery, {
        jurisdiction,
        includeMethodology: userQuery.toLowerCase().includes('how') || userQuery.toLowerCase().includes('why'),
        includeCurrentIntel: true,
        includeCandidates: true,
        includeIssues: true,
      });

      if (enrichmentContext.relevance.shouldInclude) {
        enrichmentPromptContext = formatEnrichmentForSystemPrompt(enrichmentContext);
        console.log('[Political Chat API] Unified enrichment:', {
          ragDocs: enrichmentContext.rag.documents.length,
          intel: enrichmentContext.rag.currentIntel.length,
          candidates: enrichmentContext.graph.candidates.length,
          relevance: enrichmentContext.relevance.overallScore.toFixed(2),
        });
      }
    } catch (enrichmentError) {
      console.warn('[Political Chat API] Unified enrichment failed:', enrichmentError);
      // Continue without enrichment context
    }

    // Legacy: Keep separate calls as fallback (can be removed once unified service is proven)
    let ragContext = '';
    let graphContext = '';
    if (!enrichmentPromptContext) {
      // Fallback to legacy RAG retrieval
      try {
        const retriever = getDocumentRetriever();
        const jurisdiction = routeResult.parsed.locationNames.length > 0
          ? routeResult.parsed.locationNames[0]
          : undefined;

        const retrievalResult = await retriever.retrieve(userQuery, {
          maxDocs: 2,
          maxIntel: 3,
          jurisdiction,
        });

        if (retrievalResult.documents.length > 0 || retrievalResult.currentIntel.length > 0) {
          ragContext = retriever.formatForSystemPrompt(retrievalResult);
        }
      } catch (ragError) {
        console.warn('[Political Chat API] Legacy RAG retrieval failed:', ragError);
      }

      // Fallback to legacy Knowledge Graph
      try {
        const graphResult = await getKnowledgeGraphContext(userQuery, routeResult.parsed);
        if (graphResult.context) {
          graphContext = graphResult.context;
        }
      } catch (graphError) {
        console.warn('[Political Chat API] Legacy Knowledge Graph failed:', graphError);
      }
    }

    // Extract expertise level from userContext if available
    const expertiseLevel = userContext?.expertiseLevel || 'intermediate';

    // Build system prompt with political domain knowledge + enrichment context + Session context + Expertise context
    // Prefer unified enrichment, fall back to legacy if needed
    const contextToUse = enrichmentPromptContext || (ragContext + graphContext);
    const systemPrompt = buildPoliticalSystemPrompt(contextData, contextToUse, '', context, expertiseLevel);

    // Call Claude with political context
    const claudeMessages = messages.map((msg: ChatMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log('[Political Chat API] Calling Claude...');
    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: claudeMessages,
      system: systemPrompt,
    });

    const content =
      response.content[0]?.type === 'text' ? response.content[0].text : 'No response generated';

    // Parse action directives from Claude response and convert to mapCommands
    const mapCommands = parseActionDirectivesToMapCommands(content, routeResult.parsed);

    console.log('[Political Chat API] Response generated successfully');
    return NextResponse.json({
      content,
      metadata: {
        queryType: routeResult.parsed.type,
        locations: routeResult.parsed.locationNames,
        metric: routeResult.parsed.metric,
        confidence: routeResult.parsed.confidence,
        handler: routeResult.handler,
      },
      mapCommands,
      rag: {
        documents: enrichmentContext?.rag.documents.map(d => d.id) || [],
        currentIntel: enrichmentContext?.rag.currentIntel.map(d => d.id) || [],
        citations: enrichmentContext?.rag.citations.map(c => ({
          key: c.citation_key,
          description: c.description,
          source: c.source,
        })) || [],
      },
      graph: {
        entities: enrichmentContext?.graph.candidates.map(c => c.incumbent?.name || '').filter(Boolean) || [],
      },
      enrichment: {
        relevance: enrichmentContext?.relevance.overallScore || 0,
        included: enrichmentContext?.relevance.shouldInclude || false,
      },
    });
  } catch (error) {
    console.error('[Political Chat API] Error:', error);
    return NextResponse.json(
      {
        error: 'Chat API error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch relevant data based on parsed query
 */
async function fetchDataForQuery(parsed: ParsedPoliticalQuery): Promise<string> {
  const dataParts: string[] = [];

  try {
    switch (parsed.type) {
      case 'comparison': {
        if (parsed.locationNames.length >= 2) {
          const comparison = await politicalDataService.compareJurisdictions(
            parsed.locationNames[0],
            parsed.locationNames[1]
          );
          if (comparison) {
            dataParts.push(formatComparison(comparison));
          }
        }
        break;
      }

      case 'ranking': {
        // Filter to metrics supported by ranking functions
        const rankableMetric = (parsed.metric && ['partisan_lean', 'swing_potential', 'gotv_priority', 'persuasion_opportunity', 'turnout'].includes(parsed.metric))
          ? parsed.metric as 'partisan_lean' | 'swing_potential' | 'gotv_priority' | 'persuasion_opportunity' | 'turnout'
          : 'swing_potential';

        if (parsed.locationNames.length > 0) {
          // Rank precincts within a jurisdiction
          const rankings = await politicalDataService.rankPrecinctsInJurisdiction(
            parsed.locationNames[0],
            rankableMetric,
            parsed.ranking || 'highest',
            parsed.limit || 10
          );
          dataParts.push(formatPrecinctRankings(parsed.locationNames[0], rankings, parsed.metric));
        } else {
          // Rank jurisdictions
          const rankings = await politicalDataService.rankJurisdictionsByMetric(
            rankableMetric,
            parsed.ranking || 'highest',
            parsed.limit || 10
          );
          dataParts.push(formatJurisdictionRankings(rankings, parsed.metric));
        }
        break;
      }

      case 'profile': {
        if (parsed.locationNames.length > 0) {
          const profile = await politicalDataService.getJurisdictionAggregate(
            parsed.locationNames[0]
          );
          if (profile) {
            dataParts.push(formatJurisdictionProfile(profile));
          }
        }
        break;
      }

      case 'aggregation':
      case 'general': {
        // Provide general context
        if (parsed.locationNames.length > 0) {
          for (const location of parsed.locationNames.slice(0, 3)) {
            const profile = await politicalDataService.getJurisdictionAggregate(location);
            if (profile) {
              dataParts.push(formatJurisdictionProfile(profile));
            }
          }
        } else {
          // Provide county-level summary
          const summary = await politicalDataService.getCountySummary();
          dataParts.push(formatCountySummary(summary));
        }
        break;
      }
    }
  } catch (error) {
    console.error('[Political Chat API] Error fetching data:', error);
    dataParts.push('(Note: Some data could not be loaded)');
  }

  return dataParts.join('\n\n');
}

/**
 * Format jurisdiction comparison for context
 */
function formatComparison(comparison: any): string {
  const j1 = comparison.jurisdiction1;
  const j2 = comparison.jurisdiction2;
  const diff = comparison.differences;

  return `## Jurisdiction Comparison: ${j1.jurisdictionName} vs ${j2.jurisdictionName}

### ${j1.jurisdictionName}
- Precincts: ${j1.precinctCount}
- Population: ${j1.totalPopulation.toLocaleString()}
- Partisan Lean: ${j1.scores.partisanLean > 0 ? 'D+' : 'R+'}${Math.abs(j1.scores.partisanLean).toFixed(1)}
- Swing Potential: ${j1.scores.swingPotential.toFixed(1)}
- GOTV Priority: ${j1.scores.gotvPriority.toFixed(1)}
- Avg Turnout: ${j1.scores.averageTurnout.toFixed(1)}%
- Dominant Strategy: ${j1.dominantStrategy}

### ${j2.jurisdictionName}
- Precincts: ${j2.precinctCount}
- Population: ${j2.totalPopulation.toLocaleString()}
- Partisan Lean: ${j2.scores.partisanLean > 0 ? 'D+' : 'R+'}${Math.abs(j2.scores.partisanLean).toFixed(1)}
- Swing Potential: ${j2.scores.swingPotential.toFixed(1)}
- GOTV Priority: ${j2.scores.gotvPriority.toFixed(1)}
- Avg Turnout: ${j2.scores.averageTurnout.toFixed(1)}%
- Dominant Strategy: ${j2.dominantStrategy}

### Differences
- Partisan Lean: ${diff.partisanLean > 0 ? '+' : ''}${diff.partisanLean.toFixed(1)} points
- Swing Potential: ${diff.swingPotential > 0 ? '+' : ''}${diff.swingPotential.toFixed(1)}
- Turnout: ${diff.turnout > 0 ? '+' : ''}${diff.turnout.toFixed(1)}%

### Summary
${comparison.summary}`;
}

/**
 * Format precinct rankings for context
 */
function formatPrecinctRankings(jurisdiction: string, rankings: any[], metric?: string): string {
  const metricLabel =
    metric?.replace('_', ' ') || 'swing potential';
  const lines = rankings.map(
    (r, i) =>
      `${i + 1}. ${r.precinctName}: ${r.value.toFixed(1)} (${r.competitiveness}, ${r.strategy})`
  );

  return `## Top Precincts in ${jurisdiction} by ${metricLabel}

${lines.join('\n')}`;
}

/**
 * Format jurisdiction rankings for context
 */
function formatJurisdictionRankings(rankings: any[], metric?: string): string {
  const metricLabel =
    metric?.replace('_', ' ') || 'swing potential';
  const lines = rankings.map(
    (r, i) =>
      `${i + 1}. ${r.jurisdictionName}: ${r.value.toFixed(1)} (${r.precinctCount} precincts, ${r.dominantStrategy})`
  );

  return `## Ingham County Jurisdictions Ranked by ${metricLabel}

${lines.join('\n')}`;
}

/**
 * Format jurisdiction profile for context
 */
function formatJurisdictionProfile(profile: any): string {
  const lean = profile.scores.partisanLean;
  const leanStr = lean > 0 ? `D+${lean.toFixed(1)}` : `R+${Math.abs(lean).toFixed(1)}`;

  return `## ${profile.jurisdictionName} Political Profile

### Overview
- Type: ${profile.precinctCount > 10 ? 'Major' : profile.precinctCount > 5 ? 'Medium' : 'Small'} jurisdiction
- Precincts: ${profile.precinctCount}
- Est. Population: ${profile.totalPopulation.toLocaleString()}

### Political Scores
- Partisan Lean: ${leanStr}
- Swing Potential: ${profile.scores.swingPotential.toFixed(1)}/100
- GOTV Priority: ${profile.scores.gotvPriority.toFixed(1)}/100
- Persuasion Opportunity: ${profile.scores.persuasionOpportunity.toFixed(1)}/100
- Average Turnout: ${profile.scores.averageTurnout.toFixed(1)}%

### Strategy Analysis
- Dominant Competitiveness: ${profile.dominantCompetitiveness}
- Recommended Strategy: ${profile.dominantStrategy}

### Party Affiliation (Estimated)
- Democratic: ${profile.demographics.demAffiliation.toFixed(1)}%
- Republican: ${profile.demographics.repAffiliation.toFixed(1)}%
- Independent: ${profile.demographics.indAffiliation.toFixed(1)}%`;
}

/**
 * Format county summary for context
 */
function formatCountySummary(summary: any): string {
  return `## Ingham County Political Summary

- Total Precincts: ${summary.totalPrecincts}
- Overall Lean: ${summary.overallLean > 0 ? 'D+' : 'R+'}${Math.abs(summary.overallLean).toFixed(1)}
- Overall Turnout: ${summary.overallTurnout.toFixed(1)}%

### Score Ranges
- Partisan Lean: ${summary.scoreRanges.partisan_lean.min.toFixed(1)} to ${summary.scoreRanges.partisan_lean.max.toFixed(1)} (mean: ${summary.scoreRanges.partisan_lean.mean.toFixed(1)})
- Swing Potential: ${summary.scoreRanges.swing_potential.min.toFixed(1)} to ${summary.scoreRanges.swing_potential.max.toFixed(1)} (mean: ${summary.scoreRanges.swing_potential.mean.toFixed(1)})
- Turnout: ${summary.scoreRanges.turnout_avg.min.toFixed(1)}% to ${summary.scoreRanges.turnout_avg.max.toFixed(1)}% (mean: ${summary.scoreRanges.turnout_avg.mean.toFixed(1)}%)

### Available Jurisdictions
Lansing (36 precincts), Meridian (22 precincts), East Lansing (16 precincts), Delhi (9 precincts), Mason, Leslie, Williamston, and 12 townships.`;
}

/**
 * Get knowledge graph context for the query
 */
async function getKnowledgeGraphContext(
  query: string,
  parsed: ParsedPoliticalQuery
): Promise<{ context: string; entityIds: string[] }> {
  // Ensure graph is populated
  const graph = getKnowledgeGraph();
  const stats = graph.getStats();

  if (stats.entityCount === 0) {
    const populator = getGraphPopulator();
    await populator.populate({ includePrecincts: true });
  }

  const queryLower = query.toLowerCase();
  const entityIds: string[] = [];
  const contextParts: string[] = [];

  // Check for candidate-related queries
  if (
    queryLower.includes('candidate') ||
    queryLower.includes('running') ||
    queryLower.includes('2026') ||
    queryLower.includes('senate') ||
    queryLower.includes('governor')
  ) {
    // Get candidates for 2026 races
    const senateCandidates = graph.getCandidatesForOffice('office:mi-us-senate-class-1');
    if (senateCandidates.length > 0) {
      contextParts.push('## 2026 U.S. Senate Race Candidates');
      senateCandidates.forEach(c => {
        entityIds.push(c.id);
        const party = c.metadata.party === 'DEM' ? 'Democratic' : 'Republican';
        const status = c.metadata.status === 'declared' ? 'Declared' : c.metadata.status;
        contextParts.push(`- **${c.name}** (${party}) - ${status}`);
      });
    }

    // Check for specific candidate names
    const candidateNames = [
      'haley stevens', 'mallory mcmorrow', 'mike rogers', 'abdul el-sayed',
      'garlin gilchrist', 'dana nessel', 'jocelyn benson'
    ];
    for (const name of candidateNames) {
      if (queryLower.includes(name.split(' ')[0].toLowerCase()) ||
          queryLower.includes(name.split(' ').pop()?.toLowerCase() || '')) {
        const result = graph.query({ namePattern: name, entityTypes: ['candidate'], limit: 1 });
        if (result.entities.length > 0) {
          const candidate = result.entities[0] as Entity & { metadata: { party: string; status: string } };
          entityIds.push(candidate.id);

          // Get connections
          const connections = graph.getConnections(candidate.id);
          const offices = connections.filter(c => c.relationship.type === 'RUNNING_FOR');
          const party = connections.find(c => c.relationship.type === 'MEMBER_OF');

          contextParts.push(`\n## ${candidate.name}`);
          if (party) contextParts.push(`- Party: ${party.entity.name}`);
          if (offices.length > 0) {
            contextParts.push(`- Running for: ${offices.map(o => o.entity.name).join(', ')}`);
          }
          contextParts.push(`- Status: ${candidate.metadata?.status || 'Unknown'}`);
        }
      }
    }
  }

  // Check for jurisdiction-related queries
  if (parsed.locationNames.length > 0) {
    for (const location of parsed.locationNames.slice(0, 2)) {
      const jurisdictionId = `jurisdiction:${location.toLowerCase().replace(/\s+/g, '-')}`;
      const jurisdiction = graph.getEntity(jurisdictionId);

      if (jurisdiction && jurisdiction.type === 'jurisdiction') {
        entityIds.push(jurisdiction.id);
        const meta = (jurisdiction as any).metadata || {};

        // Get precincts in jurisdiction
        const precinctConnections = graph.query({
          relationshipTypes: ['PART_OF'],
          entityTypes: ['precinct'],
          filters: [{ field: 'metadata.jurisdiction', operator: 'eq', value: jurisdictionId }],
          limit: 5,
        });

        contextParts.push(`\n## ${jurisdiction.name} (Knowledge Graph)`);
        if (meta.partisanLean !== undefined) {
          const leanStr = meta.partisanLean > 0 ? `D+${meta.partisanLean}` : `R+${Math.abs(meta.partisanLean)}`;
          contextParts.push(`- Partisan Lean: ${leanStr}`);
        }
        if (meta.density) contextParts.push(`- Density: ${meta.density}`);
        if (precinctConnections.entities.length > 0) {
          contextParts.push(`- Sample precincts: ${precinctConnections.entities.slice(0, 3).map(e => e.name).join(', ')}`);
        }
      }
    }
  }

  // Check for election-related queries
  if (queryLower.includes('election') || queryLower.includes('primary') || queryLower.includes('november')) {
    const elections = graph.query({ entityTypes: ['election'], limit: 5 });
    if (elections.entities.length > 0) {
      contextParts.push('\n## Upcoming Elections');
      elections.entities.forEach(e => {
        entityIds.push(e.id);
        const meta = (e as any).metadata || {};
        contextParts.push(`- **${e.name}**: ${meta.date || 'Date TBD'} (${meta.electionType || 'general'})`);
      });
    }
  }

  return {
    context: contextParts.length > 0 ? contextParts.join('\n') : '',
    entityIds,
  };
}

/**
 * Parse ACTION directives from Claude response and convert to MapCommand objects
 */
function parseActionDirectivesToMapCommands(
  content: string,
  parsed: ParsedPoliticalQuery
): MapCommand[] {
  const mapCommands: MapCommand[] = [];

  // Look for [ACTION:actionType:{"key":"value"}] patterns
  const actionRegex = /\[ACTION:(\w+):(.*?)\]/g;
  let match;

  while ((match = actionRegex.exec(content)) !== null) {
    const actionType = match[1];
    let actionData: Record<string, unknown> = {};

    try {
      actionData = JSON.parse(match[2]);
    } catch (e) {
      console.warn('[Political Chat API] Failed to parse action data:', match[2]);
      continue;
    }

    // Convert ACTION directives to MapCommand format
    switch (actionType) {
      case 'showOnMap':
        if (actionData.precinctIds && Array.isArray(actionData.precinctIds)) {
          mapCommands.push({
            type: 'highlight',
            target: actionData.precinctIds as string[]
          });
        }
        break;

      case 'highlightEntity':
        if (actionData.entityId) {
          mapCommands.push({
            type: 'highlight',
            target: actionData.entityId as string
          });
        }
        break;

      case 'setComparison':
        if (actionData.left && actionData.right) {
          mapCommands.push({
            type: 'highlightComparison',
            leftEntityId: actionData.left as string,
            rightEntityId: actionData.right as string
          });
        }
        break;
    }
  }

  // If no ACTION directives found, infer map commands from query type and parsed data
  if (mapCommands.length === 0) {
    const queryLower = content.toLowerCase();

    // P2 Enhancement: Expanded visualization keyword detection
    const visualizationKeywords = ['show', 'display', 'visualize', 'map', 'highlight', 'where are', 'find', 'which precincts', 'which areas', 'target', 'identify'];
    const hasVisualizationIntent = visualizationKeywords.some(kw => queryLower.includes(kw));

    if (hasVisualizationIntent) {
      // P2 Enhancement: Check for combined metric queries (e.g., "high GOTV and persuasion")
      const hasSwing = queryLower.includes('swing') || parsed.metric === 'swing_potential' || queryLower.includes('competitive') || queryLower.includes('battleground');
      const hasGotv = queryLower.includes('gotv') || queryLower.includes('turnout') || queryLower.includes('mobiliz') || parsed.metric === 'gotv_priority';
      const hasPersuasion = queryLower.includes('persuasion') || queryLower.includes('persuadable') || parsed.metric === 'persuasion_opportunity';
      const hasPartisan = queryLower.includes('partisan') || queryLower.includes('lean') || queryLower.includes('democrat') || queryLower.includes('republican') || parsed.metric === 'partisan_lean';
      const hasCombined = queryLower.includes('combined') || queryLower.includes('overall') || queryLower.includes('targeting score');

      // Priority order: combined > specific metrics
      if (hasCombined) {
        mapCommands.push({ type: 'showHeatmap', metric: 'combined_score' });
      } else if (hasSwing && hasGotv) {
        // Both swing and GOTV mentioned - use bivariate
        mapCommands.push({ type: 'showBivariate', xMetric: 'swing_potential', yMetric: 'gotv_priority' });
      } else if (hasSwing && hasPersuasion) {
        mapCommands.push({ type: 'showBivariate', xMetric: 'swing_potential', yMetric: 'persuasion_opportunity' });
      } else if (hasGotv && hasPersuasion) {
        mapCommands.push({ type: 'showBivariate', xMetric: 'gotv_priority', yMetric: 'persuasion_opportunity' });
      } else if (hasSwing) {
        mapCommands.push({ type: 'showHeatmap', metric: 'swing_potential' });
      } else if (hasGotv) {
        mapCommands.push({ type: 'showHeatmap', metric: 'gotv_priority' });
      } else if (hasPersuasion) {
        mapCommands.push({ type: 'showHeatmap', metric: 'persuasion_opportunity' });
      } else if (hasPartisan) {
        mapCommands.push({ type: 'showChoropleth' });
      }
    }

    // P2 Enhancement: Navigation commands detection
    const navigationPatterns = [
      { pattern: /zoom\s+(?:to|in\s+on)\s+(.+?)(?:\.|$)/i, action: 'flyTo' },
      { pattern: /focus\s+on\s+(.+?)(?:\.|$)/i, action: 'flyTo' },
      { pattern: /center\s+(?:on|at)\s+(.+?)(?:\.|$)/i, action: 'flyTo' },
      { pattern: /fly\s+to\s+(.+?)(?:\.|$)/i, action: 'flyTo' },
    ];

    for (const { pattern, action } of navigationPatterns) {
      const match = content.match(pattern);
      if (match) {
        mapCommands.push({ type: action as 'flyTo', target: match[1].trim() });
        break;
      }
    }

    // Ranking queries should highlight top results
    if (parsed.type === 'ranking' && parsed.locationNames.length > 0) {
      mapCommands.push({ type: 'highlight', target: parsed.locationNames });
    }

    // Comparison queries should highlight both entities
    if (parsed.type === 'comparison' && parsed.locationNames.length >= 2) {
      mapCommands.push({
        type: 'highlightComparison',
        leftEntityId: parsed.locationNames[0],
        rightEntityId: parsed.locationNames[1]
      });
    }

    // P2 Enhancement: Also detect comparison language in general queries
    if (mapCommands.length === 0 && parsed.locationNames.length >= 2) {
      const comparisonPatterns = /\b(versus|vs\.?|compared to|difference between|how does.*compare)\b/i;
      if (comparisonPatterns.test(content)) {
        mapCommands.push({
          type: 'highlightComparison',
          leftEntityId: parsed.locationNames[0],
          rightEntityId: parsed.locationNames[1]
        });
      }
    }

    // Profile queries should highlight the location
    if (parsed.type === 'profile' && parsed.locationNames.length > 0) {
      mapCommands.push({ type: 'highlight', target: parsed.locationNames[0] });
    }

    // P2 Enhancement: Highlight any mentioned locations if no other command generated
    if (mapCommands.length === 0 && parsed.locationNames.length > 0) {
      mapCommands.push({ type: 'highlight', target: parsed.locationNames });
    }
  }

  return mapCommands;
}

/**
 * Build system prompt with political domain knowledge
 * Phase 3: Added sessionContext parameter for cross-session awareness
 * Phase 12: Added expertiseLevel parameter for expertise-aware responses
 */
function buildPoliticalSystemPrompt(
  contextData: string,
  ragContext: string = '',
  graphContext: string = '',
  sessionContext: string = '',
  expertiseLevel: 'novice' | 'intermediate' | 'power_user' = 'intermediate'
): string {
  const basePrompt = `You are a political analyst assistant for Ingham County, Michigan (Lansing metro area). You help campaign strategists, political consultants, and canvassing coordinators understand the political landscape.

## Your Expertise
- Precinct-level political analysis
- Voter targeting strategies (GOTV, Persuasion)
- Demographic analysis for campaigns
- Electoral trends and swing potential
- Canvassing optimization

## Key Metrics You Understand
- **Partisan Lean**: -100 (Solid R) to +100 (Solid D). Positive = Democratic lean.
- **Swing Potential**: 0-100 score. Higher = more volatile/persuadable.
- **GOTV Priority**: 0-100 score. Higher = more value from turnout mobilization.
- **Persuasion Opportunity**: 0-100 score. Higher = more persuadable voters.
- **Turnout**: Historical average voter turnout percentage.

## Targeting Strategies
- **Battleground**: Competitive precincts needing both GOTV and persuasion
- **Base Mobilization**: Strong partisan areas needing turnout focus
- **Persuasion Target**: Areas with many persuadable voters
- **Maintenance**: Safe areas requiring minimal resources

## Ingham County Context
- County seat: Mason
- State capital: Lansing (largest city)
- Major university: Michigan State University (East Lansing)
- 19 jurisdictions: Cities (Lansing, East Lansing, Mason, Leslie, Williamston) and Townships
- Generally Democratic-leaning county with variation between urban/suburban/rural areas

## Response Guidelines
1. Be concise and actionable
2. Use data to support recommendations
3. Explain political implications clearly
4. Suggest next steps when appropriate
5. Be politically neutral - present facts, not opinions
6. When citing data, use source tags like [ELECTIONS], [DEMOGRAPHICS], [TARGETING]
7. When referencing current political news/events, use [NEWS], [POLL], [ANALYSIS], [OFFICIAL], or [UPCOMING]
8. If explaining methodology, reference the approach without exposing implementation details
9. NEVER start responses with greetings like "Welcome!", "Hello!", "Hi!", or "Great question!" - jump directly into the analysis
10. Format percentages correctly: use "52.3%" not "5230%" - never multiply by 100 twice

## Current Intelligence Guidelines
When current intel is provided in the context:
- Integrate relevant recent news, polls, and analysis naturally into your responses
- Always cite the source type when referencing current events (e.g., "Recent polling shows... [POLL]")
- For upcoming elections, mention key candidates and dates when relevant [UPCOMING]
- Make connections between historical data and current political dynamics
- Note when information has a publication date to maintain temporal context

## UI ACTION DIRECTIVES

When your response should trigger a UI action (like applying filters, setting comparisons, or navigation), include an action directive at the END of your response in this exact format:

\`[ACTION:actionType:{"key":"value"}]\`

Available action types:

1. **setComparison** - Set comparison pane entities (Split Screen page)
   Example: User asks "compare Lansing to East Lansing"
   \`[ACTION:setComparison:{"left":"lansing","right":"east-lansing"}]\`

2. **applyFilter** - Apply segment/donor filters
   \`[ACTION:applyFilter:{"filters":{"targeting":{"gotvPriorityRange":[70,100]}}}]\`

3. **navigateTo** - Navigate to a tab or page
   \`[ACTION:navigateTo:{"tab":"lapsed"}]\`

4. **showOnMap** - Highlight areas on the map
   \`[ACTION:showOnMap:{"precinctIds":["EL-01","EL-02"]}]\`

5. **highlightEntity** - Highlight a specific entity
   \`[ACTION:highlightEntity:{"entityId":"lansing"}]\`

IMPORTANT:
- Only include ONE action directive per response
- Place it at the very END of your response (after all text)
- Use exact JSON format with no extra spaces inside braces
- Only use action directives when the user clearly wants a UI change (comparison, filter, etc.)
- For general information questions, do NOT include action directives`;

  let fullPrompt = basePrompt;

  // Add RAG documentation context
  if (ragContext) {
    fullPrompt += `\n\n${ragContext}`;
  }

  // Add knowledge graph context
  if (graphContext) {
    fullPrompt += `

## Knowledge Graph Context
The following entities and relationships are relevant to the query:

${graphContext}

Use this information about candidates, offices, and jurisdictions when relevant.`;
  }

  // Add data context
  if (contextData) {
    fullPrompt += `

## Current Data Context
${contextData}

Use this data to inform your response. Reference specific numbers when helpful.`;
  }

  // Add session context (Phase 3 - Claude Integration)
  if (sessionContext) {
    fullPrompt += `

## Current Session Context
The user has been exploring the platform this session. Here's what they've done:

${sessionContext}

Use this context to:
- Reference precincts they've already explored
- Suggest comparisons with areas they've looked at
- Offer relevant next steps based on their exploration depth
- Acknowledge their journey and provide continuity`;
  }

  // Add user expertise context (Phase 12 - Expertise-Aware Responses)
  const expertiseGuidance = {
    novice: {
      level: 'novice',
      guidance: 'Explain terminology, provide context, suggest next steps. Avoid jargon. Use analogies and examples. Break down complex concepts into simple explanations.'
    },
    intermediate: {
      level: 'intermediate',
      guidance: 'Balance detail with efficiency. Assume familiarity with basic political concepts. Use standard terminology. Provide explanations for advanced concepts.'
    },
    power_user: {
      level: 'power_user',
      guidance: 'Be concise, use data shorthand, skip basic explanations. Assume deep expertise in political analysis. Use technical terminology freely. Focus on insights and actionable recommendations.'
    }
  };

  const expertise = expertiseGuidance[expertiseLevel];
  fullPrompt += `

## User Expertise Level
Level: ${expertise.level}
Guidance: ${expertise.guidance}

Tailor your response to match this expertise level:
- Novice: Explain concepts, define terms, provide step-by-step guidance
- Intermediate: Balance detail with conciseness, use standard terminology
- Power User: Be terse, use shorthand, focus on insights over explanations`;

  return fullPrompt;
}
