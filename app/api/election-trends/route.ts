/**
 * Election Trends API
 *
 * Provides time-series election trend analysis data.
 *
 * Endpoints:
 * - GET /api/election-trends - County summary with all trends
 * - GET /api/election-trends?jurisdiction=Lansing - Jurisdiction-specific trends
 * - GET /api/election-trends?precinct=Lansing%20City%2C%20Precinct%201 - Precinct trends
 * - GET /api/election-trends?compare=Lansing,Mason - Compare two jurisdictions
 * - GET /api/election-trends?trend=shifting_dem - Get all precincts with a specific trend
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { electionTrendAnalysis } from '@/lib/analysis/ElectionTrendAnalysis';

export const maxDuration = 30;
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jurisdiction = searchParams.get('jurisdiction');
    const precinct = searchParams.get('precinct');
    const compare = searchParams.get('compare');
    const trend = searchParams.get('trend');
    const summary = searchParams.get('summary');

    console.log('[Election Trends API] Request:', { jurisdiction, precinct, compare, trend, summary });

    // Precinct-specific trend
    if (precinct) {
      const precinctTrend = await electionTrendAnalysis.getPrecinctTrend(precinct);

      if (!precinctTrend) {
        return NextResponse.json(
          { error: `Precinct not found: ${precinct}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        type: 'precinct',
        data: precinctTrend,
      });
    }

    // Jurisdiction-specific trend
    if (jurisdiction) {
      const jurisdictionTrend = await electionTrendAnalysis.getJurisdictionTrend(jurisdiction);

      if (!jurisdictionTrend) {
        return NextResponse.json(
          { error: `Jurisdiction not found: ${jurisdiction}` },
          { status: 404 }
        );
      }

      // Option to exclude precinct details for smaller response
      const includePrecincts = searchParams.get('includePrecincts') !== 'false';

      const response = includePrecincts
        ? jurisdictionTrend
        : {
            ...jurisdictionTrend,
            precinctTrends: jurisdictionTrend.precinctTrends.map(p => ({
              precinctName: p.precinctName,
              trendMetrics: p.trendMetrics,
            })),
          };

      return NextResponse.json({
        type: 'jurisdiction',
        data: response,
      });
    }

    // Compare two jurisdictions
    if (compare) {
      const [j1, j2] = compare.split(',').map(s => s.trim());

      if (!j1 || !j2) {
        return NextResponse.json(
          { error: 'Compare requires two comma-separated jurisdiction names' },
          { status: 400 }
        );
      }

      const comparison = await electionTrendAnalysis.compareJurisdictionTrends(j1, j2);

      return NextResponse.json({
        type: 'comparison',
        data: comparison,
      });
    }

    // Get precincts by trend category
    if (trend) {
      const validTrends = ['shifting_dem', 'shifting_rep', 'stable', 'volatile'];

      if (!validTrends.includes(trend)) {
        return NextResponse.json(
          { error: `Invalid trend. Valid values: ${validTrends.join(', ')}` },
          { status: 400 }
        );
      }

      const precincts = await electionTrendAnalysis.getPrecinctsByTrend(
        trend as 'shifting_dem' | 'shifting_rep' | 'stable' | 'volatile'
      );

      return NextResponse.json({
        type: 'trend_filter',
        trend,
        count: precincts.length,
        data: precincts.map(p => ({
          precinctName: p.precinctName,
          jurisdictionName: p.jurisdictionName,
          trendMetrics: p.trendMetrics,
        })),
      });
    }

    // Get all jurisdiction trends
    if (summary === 'jurisdictions') {
      const jurisdictions = await electionTrendAnalysis.getAllJurisdictionTrends();

      return NextResponse.json({
        type: 'jurisdictions_summary',
        count: jurisdictions.length,
        data: jurisdictions.map(j => ({
          jurisdictionName: j.jurisdictionName,
          precinctCount: j.precinctCount,
          elections: j.elections,
          trendMetrics: j.trendMetrics,
        })),
      });
    }

    // Default: County summary
    const countySummary = await electionTrendAnalysis.getCountySummary();

    return NextResponse.json({
      type: 'county_summary',
      data: countySummary,
    });
  } catch (error) {
    console.error('[Election Trends API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load election trend data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
