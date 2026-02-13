/**
 * Canvassing API Route
 *
 * Handles canvassing universe creation and operations using real CanvassingEngine.
 * Note: Storage operations (save/load/delete) are client-side only via CanvassingStore
 * since they use localStorage which is not available in server-side API routes.
 *
 * GET endpoints:
 *   - ?action=precincts - Return all precinct data (works server-side)
 *
 * POST endpoints:
 *   - Body: { action: 'create', name, precinctIds, params?, segmentId? } - Create new universe
 *   - Body: { action: 'optimize', universe, sortBy } - Re-sort/optimize universe turfs
 *   - Body: { action: 'calculate', universe, canvassDays, hoursPerShift } - Calculate staffing
 *   - Body: { action: 'export', universe, format: 'csv' | 'summary' } - Export universe
 *
 * Client-side only operations (use CanvassingStore directly in browser):
 *   - GET ?action=list - List all universes
 *   - GET ?action=get&id=X - Get specific universe
 *   - POST { action: 'save', universe } - Save universe
 *   - DELETE ?id=X - Delete universe
 */

import { NextRequest, NextResponse } from 'next/server';
import type { CanvassingParams, CanvassingUniverse } from '@/lib/canvassing/types';

// Import CanvassingEngine and canvassingStore singleton
import { CanvassingEngine, canvassingStore } from '@/lib/canvassing';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// Internal precinct data type matching SegmentEngine expectations
type PrecinctDataJSON = Awaited<ReturnType<typeof politicalDataService.getSegmentEnginePrecincts>>[number];

/**
 * Load precinct data from PoliticalDataService (single source of truth)
 * Uses blob storage for consistent data across all components
 */
async function loadPrecinctData(): Promise<PrecinctDataJSON[]> {
  try {
    const precincts = await politicalDataService.getSegmentEnginePrecincts();
    console.log(`[canvassing/route] Loaded ${precincts.length} precincts from PoliticalDataService`);
    return precincts;
  } catch (error) {
    console.error('Error loading precinct data:', error);
    throw new Error('Failed to load precinct data');
  }
}

/**
 * GET /api/canvassing
 *
 * Query parameters:
 *   - action=precincts: Return all precinct data
 *   - action=list: Return all saved universes (alias for universes)
 *   - action=universes: Return all saved universes
 *   - action=get&id=X: Get specific universe by ID
 *   - action=universe&id=X: Get specific universe by ID (legacy)
 *   - action=turfs&universeId=X: Get turfs for a universe
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Return all precincts
    if (action === 'precincts') {
      const precincts = await loadPrecinctData();
      return NextResponse.json({
        success: true,
        precincts,
      });
    }

    // Return all saved universes (list or universes action)
    // Note: These endpoints require client-side localStorage, not available server-side
    if (action === 'list' || action === 'universes') {
      return NextResponse.json({
        success: false,
        error: 'Universe listing is client-side only. Use CanvassingStore in browser.',
      }, { status: 501 });
    }

    // Return specific universe (get or universe action)
    if (action === 'get' || action === 'universe') {
      return NextResponse.json({
        success: false,
        error: 'Universe retrieval is client-side only. Use CanvassingStore in browser.',
      }, { status: 501 });
    }

    // Get turfs for a universe
    if (action === 'turfs') {
      return NextResponse.json({
        success: false,
        error: 'Turf retrieval is client-side only. Use CanvassingStore in browser.',
      }, { status: 501 });
    }

    // Unknown action
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action parameter. Use: precincts, list, get, turfs',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in GET /api/canvassing:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/canvassing
 *
 * Body formats:
 *   - { action: 'create', name, precinctIds, params?, segmentId? } - Create new universe
 *   - { action: 'optimize', universeId, sortBy } - Re-sort/optimize universe turfs
 *   - { action: 'calculate', universeId, canvassDays, hoursPerShift } - Calculate staffing
 *   - { action: 'save', universe } - Save universe
 *   - { action: 'export', universeId, format: 'csv' | 'summary' } - Export universe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing action in request body',
        },
        { status: 400 }
      );
    }

    // Create new universe
    if (action === 'create') {
      const { name, precinctIds, params, segmentId } = body;

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing name parameter',
          },
          { status: 400 }
        );
      }

      if (!precinctIds || !Array.isArray(precinctIds) || precinctIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing or invalid precinctIds parameter',
          },
          { status: 400 }
        );
      }

      // Load precinct data for the engine
      const precincts = await loadPrecinctData();

      // Create engine instance with precinct data
      const engine = new CanvassingEngine(precincts as any);

      // Create universe
      const universe = engine.createUniverse(
        name,
        precinctIds,
        params as Partial<CanvassingParams> | undefined
      );

      // Add segmentId if provided
      if (segmentId) {
        universe.segmentId = segmentId;
      }

      // Note: In API routes, we don't save to localStorage (server-side)
      // The client will save after receiving the response
      return NextResponse.json({
        success: true,
        universe,
      });
    }

    // Optimize/re-sort universe turfs
    if (action === 'optimize') {
      const { universe, sortBy } = body;

      if (!universe) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing universe in request body',
          },
          { status: 400 }
        );
      }

      if (!sortBy) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing sortBy parameter',
          },
          { status: 400 }
        );
      }

      // Load precinct data and create engine
      const precincts = await loadPrecinctData();
      const engine = new CanvassingEngine(precincts as any);

      // Re-sort universe
      const optimizedUniverse = engine.sortUniverse(universe, sortBy);

      return NextResponse.json({
        success: true,
        universe: optimizedUniverse,
      });
    }

    // Calculate staffing metrics
    if (action === 'calculate') {
      const { universe, canvassDays, hoursPerShift } = body;

      if (!universe) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing universe in request body',
          },
          { status: 400 }
        );
      }

      if (!canvassDays || typeof canvassDays !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing or invalid canvassDays parameter',
          },
          { status: 400 }
        );
      }

      if (!hoursPerShift || typeof hoursPerShift !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing or invalid hoursPerShift parameter',
          },
          { status: 400 }
        );
      }

      // Load precinct data and create engine
      const precincts = await loadPrecinctData();
      const engine = new CanvassingEngine(precincts as any);

      // Calculate staffing
      const staffing = engine.estimateStaffing(universe, canvassDays, hoursPerShift);

      return NextResponse.json({
        success: true,
        universeId: universe.id,
        universeName: universe.name,
        staffing,
      });
    }

    // Save universe - client-side only
    if (action === 'save') {
      return NextResponse.json({
        success: false,
        error: 'Universe saving is client-side only. Use CanvassingStore in browser.',
      }, { status: 501 });
    }

    // Export universe
    if (action === 'export') {
      const { universe, format } = body;

      if (!universe) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing universe in request body',
          },
          { status: 400 }
        );
      }

      if (!format) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing format parameter',
          },
          { status: 400 }
        );
      }

      // CSV export
      if (format === 'csv') {
        const csv = generateCSVExport(universe);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${universe.name}-export.csv"`,
          },
        });
      }

      // Summary export
      if (format === 'summary') {
        const precincts = await loadPrecinctData();
        const engine = new CanvassingEngine(precincts as any);
        const summary = engine.generateSummary(universe);

        return NextResponse.json({
          success: true,
          summary,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid format. Use: csv or summary',
        },
        { status: 400 }
      );
    }

    // Unknown action
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use: create, optimize, calculate, or export',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/canvassing:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/canvassing?id=xxx
 *
 * Delete a canvassing universe by ID
 * Note: This is client-side only as universes are stored in localStorage
 */
export async function DELETE(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Universe deletion is client-side only. Use CanvassingStore in browser.',
  }, { status: 501 });
}

/**
 * Generate CSV export for canvassing universe
 */
function generateCSVExport(universe: CanvassingUniverse): string {
  const headers = [
    'Rank',
    'Precinct ID',
    'Precinct Name',
    'Jurisdiction',
    'Registered Voters',
    'Active Voters',
    'Estimated Doors',
    'Estimated Turfs',
    'Estimated Hours',
    'GOTV Priority',
    'Persuasion Opportunity',
    'Swing Potential',
    'Targeting Strategy',
  ];

  const rows = universe.precincts.map((p) => [
    p.priorityRank,
    p.precinctId,
    p.precinctName,
    p.jurisdiction,
    p.registeredVoters,
    p.activeVoters || '',
    p.estimatedDoors,
    p.estimatedTurfs,
    p.estimatedHours.toFixed(1),
    p.gotvPriority,
    p.persuasionOpportunity,
    p.swingPotential,
    p.targetingStrategy,
  ]);

  // Add summary row
  const summaryRow = [
    'TOTAL',
    '',
    '',
    '',
    universe.precincts.reduce((sum, p) => sum + p.registeredVoters, 0),
    universe.precincts.reduce((sum, p) => sum + (p.activeVoters || 0), 0),
    universe.totalEstimatedDoors,
    universe.estimatedTurfs,
    universe.estimatedHours.toFixed(1),
    '',
    '',
    '',
    '',
  ];

  const csvContent = [
    // Universe metadata
    `Universe Name: ${universe.name}`,
    `Created: ${new Date(universe.createdAt).toLocaleDateString()}`,
    `Total Precincts: ${universe.totalPrecincts}`,
    `Parameters: ${universe.targetDoorsPerTurf} doors/turf, ${universe.targetDoorsPerHour} doors/hr, ${
      universe.targetContactRate * 100
    }% contact rate`,
    '',
    // Data table
    headers.join(','),
    ...rows.map((row) => row.join(',')),
    '',
    summaryRow.join(','),
    '',
    // Summary statistics
    `Expected Contacts: ${Math.round(universe.totalEstimatedDoors * universe.targetContactRate)}`,
    `Volunteers Needed (8hr shifts): ${universe.volunteersNeeded}`,
    `Volunteers Needed (4hr shifts): ${Math.ceil(universe.volunteersNeeded * 2)}`,
  ].join('\n');

  return csvContent;
}
