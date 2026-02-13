/**
 * Polls API
 *
 * GET /api/polls - Get polls and aggregates
 * POST /api/polls/ingest - Run ingestion pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPollIngestionPipeline, PollAggregate } from '@/lib/poll-ingestion';

export const dynamic = 'force-dynamic';

/**
 * GET /api/polls
 *
 * Query parameters:
 * - type: 'aggregates' | 'polls' | 'competitive' | 'recent' | 'stats'
 * - race: Race ID for specific race data
 * - days: Number of days for recent polls (default 30)
 * - geography: Filter by geography
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'aggregates';
    const raceId = searchParams.get('race');
    const days = parseInt(searchParams.get('days') || '30', 10);
    const geography = searchParams.get('geography');

    const pipeline = getPollIngestionPipeline();

    switch (type) {
      case 'aggregates': {
        const aggregates = await pipeline.getAggregates();
        let result: PollAggregate[] = Array.from(aggregates.values());

        // Filter by geography if provided
        if (geography) {
          result = result.filter(
            (a: PollAggregate) => a.geography.toLowerCase().includes(geography.toLowerCase())
          );
        }

        return NextResponse.json({
          success: true,
          count: result.length,
          aggregates: result,
        });
      }

      case 'polls': {
        if (raceId) {
          const polls = await pipeline.getPollsForRace(raceId);
          return NextResponse.json({
            success: true,
            raceId,
            count: polls.length,
            polls,
          });
        }

        const polls = await pipeline.getRecentPolls(days);
        return NextResponse.json({
          success: true,
          days,
          count: polls.length,
          polls,
        });
      }

      case 'competitive': {
        const competitive = await pipeline.getCompetitiveRaces();
        return NextResponse.json({
          success: true,
          count: competitive.length,
          races: competitive,
        });
      }

      case 'recent': {
        const recent = await pipeline.getRecentPolls(days);
        return NextResponse.json({
          success: true,
          days,
          count: recent.length,
          polls: recent,
        });
      }

      case 'race': {
        if (!raceId) {
          return NextResponse.json(
            { success: false, error: 'race parameter required' },
            { status: 400 }
          );
        }

        const [aggregate, polls] = await Promise.all([
          pipeline.getAggregate(raceId),
          pipeline.getPollsForRace(raceId),
        ]);

        return NextResponse.json({
          success: true,
          raceId,
          aggregate: aggregate || null,
          polls,
        });
      }

      case 'michigan': {
        const michiganAggs = await pipeline.getMichiganAggregates();
        return NextResponse.json({
          success: true,
          count: michiganAggs.length,
          aggregates: michiganAggs,
        });
      }

      case 'summary': {
        const summary = await pipeline.getSummaryContext();
        return NextResponse.json({
          success: true,
          summary,
        });
      }

      case 'stats': {
        const stats = await pipeline.getStats();
        return NextResponse.json({
          success: true,
          ...stats,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[PollsAPI] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/polls
 *
 * Run the ingestion pipeline
 *
 * Body parameters:
 * - sources: Array of source names ('fivethirtyeight', 'votehub')
 * - state: State to filter (default 'Michigan')
 * - raceType: Race type to filter
 * - skipGraph: Skip knowledge graph sync
 * - skipRAG: Skip RAG document generation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const pipeline = getPollIngestionPipeline();

    const result = await pipeline.run({
      sources: body.sources,
      fetchOptions: {
        state: body.state || 'Michigan',
        race_type: body.raceType,
        start_date: body.startDate,
      },
      skipGraph: body.skipGraph,
      skipRAG: body.skipRAG,
      forceRefresh: body.forceRefresh,
    });

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error('[PollsAPI] Ingestion error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
