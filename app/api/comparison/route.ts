import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { ComparisonEngine, InsightGenerator } from '@/lib/comparison';
import type { PrecinctDataFile, MunicipalityDataFile, StateHouseDataFile, BoundaryType } from '@/lib/comparison';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// Force dynamic rendering for this route (uses fs for non-precinct data)
export const dynamic = 'force-dynamic';

// Cache the data in memory by boundary type
const dataCache: Record<string, PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile> = {};

/**
 * Load boundary data based on type
 * Uses PoliticalDataService for precincts (blob storage),
 * local files for municipalities and state_house (not yet in blob storage)
 */
async function loadBoundaryData(
  boundaryType: BoundaryType
): Promise<PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile> {
  // Return cached data if available
  if (dataCache[boundaryType]) {
    return dataCache[boundaryType];
  }

  // For precincts, use PoliticalDataService (single source of truth)
  if (boundaryType === 'precincts') {
    const data = await politicalDataService.getPrecinctDataFileFormat();
    dataCache[boundaryType] = data as PrecinctDataFile;
    console.log(`[comparison/route] Loaded ${Object.keys(data.precincts).length} precincts from PoliticalDataService`);
    return data as PrecinctDataFile;
  }

  // For other boundary types, still use local files
  let fileName: string;
  switch (boundaryType) {
    case 'municipalities':
      fileName = 'ingham_municipalities.json';
      break;
    case 'state_house':
      fileName = 'ingham_state_house.json';
      break;
    default:
      fileName = 'ingham_precincts.json';
      break;
  }

  const filePath = path.join(process.cwd(), 'public/data/political', fileName);
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(fileContent);

  // Cache and return
  dataCache[boundaryType] = data;
  return data;
}

/**
 * Valid boundary types for comparison
 */
const VALID_BOUNDARY_TYPES: BoundaryType[] = ['precincts', 'municipalities', 'state_house'];

/**
 * Valid list types
 */
const VALID_LIST_TYPES = ['precincts', 'jurisdictions', 'municipalities', 'state_house'] as const;

/**
 * GET /api/comparison
 *
 * Query params:
 * - left: ID of left entity
 * - right: ID of right entity
 * - leftType: 'precinct' | 'jurisdiction' | 'municipality' | 'state_house'
 * - rightType: 'precinct' | 'jurisdiction' | 'municipality' | 'state_house'
 * - boundaryType: 'precincts' | 'municipalities' | 'state_house' (required for comparison)
 *
 * Or for listing:
 * - list: 'precincts' | 'jurisdictions' | 'municipalities' | 'state_house'
 * - boundaryType: 'precincts' | 'municipalities' | 'state_house' (required for list)
 * - jurisdiction: (optional) filter precincts by jurisdiction
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const list = searchParams.get('list');
    const boundaryTypeParam = searchParams.get('boundaryType') || 'precincts';

    // Validate boundaryType
    if (!VALID_BOUNDARY_TYPES.includes(boundaryTypeParam as BoundaryType)) {
      return NextResponse.json(
        {
          error: 'Invalid boundaryType parameter',
          message: `boundaryType must be one of: ${VALID_BOUNDARY_TYPES.join(', ')}`,
          received: boundaryTypeParam
        },
        { status: 400 }
      );
    }

    const boundaryType = boundaryTypeParam as BoundaryType;

    // Validate list parameter if provided
    if (list && !VALID_LIST_TYPES.includes(list as typeof VALID_LIST_TYPES[number])) {
      return NextResponse.json(
        {
          error: 'Invalid list parameter',
          message: `list must be one of: ${VALID_LIST_TYPES.join(', ')}`,
          received: list
        },
        { status: 400 }
      );
    }

    const data = await loadBoundaryData(boundaryType);
    const engine = new ComparisonEngine(data);

    // List mode
    if (list === 'precincts') {
      const jurisdiction = searchParams.get('jurisdiction');
      let precincts = engine.getPrecinctList();

      if (jurisdiction) {
        precincts = precincts.filter(
          p => p.jurisdiction.toLowerCase() === jurisdiction.toLowerCase()
        );
      }

      return NextResponse.json({ precincts });
    }

    if (list === 'jurisdictions') {
      const jurisdictions = engine.getJurisdictionList();
      return NextResponse.json({ jurisdictions });
    }

    if (list === 'municipalities') {
      const municipalities = engine.getMunicipalityList();
      return NextResponse.json({ municipalities });
    }

    if (list === 'state_house') {
      const districts = engine.getStateHouseList();
      return NextResponse.json({ districts });
    }

    // Comparison mode
    const leftId = searchParams.get('left');
    const rightId = searchParams.get('right');

    // Validate entity IDs are provided
    if (!leftId || !rightId) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'Both left and right entity IDs are required for comparison',
          missing: [
            !leftId ? 'left' : null,
            !rightId ? 'right' : null
          ].filter(Boolean)
        },
        { status: 400 }
      );
    }

    // Validate entity IDs are non-empty strings
    const trimmedLeftId = leftId.trim();
    const trimmedRightId = rightId.trim();

    if (!trimmedLeftId || !trimmedRightId) {
      return NextResponse.json(
        {
          error: 'Invalid entity IDs',
          message: 'Entity IDs cannot be empty or whitespace-only',
          received: {
            left: leftId,
            right: rightId
          }
        },
        { status: 400 }
      );
    }

    // Build entities based on boundary type
    let leftEntity;
    let rightEntity;

    // Determine entity builder based on boundaryType
    switch (boundaryType) {
      case 'precincts':
        leftEntity = engine.buildPrecinctEntity(trimmedLeftId);
        rightEntity = engine.buildPrecinctEntity(trimmedRightId);
        break;
      case 'municipalities':
        leftEntity = engine.buildMunicipalityEntity(trimmedLeftId);
        rightEntity = engine.buildMunicipalityEntity(trimmedRightId);
        break;
      case 'state_house':
        leftEntity = engine.buildStateHouseEntity(trimmedLeftId);
        rightEntity = engine.buildStateHouseEntity(trimmedRightId);
        break;
      default:
        // For other types, try jurisdiction entity (from precinct data file)
        leftEntity = engine.buildJurisdictionEntity(trimmedLeftId);
        rightEntity = engine.buildJurisdictionEntity(trimmedRightId);
        break;
    }

    // Validate entities were successfully built
    if (!leftEntity) {
      return NextResponse.json(
        {
          error: 'Entity not found',
          message: `Left entity with ID "${trimmedLeftId}" not found in ${boundaryType}`,
          entityId: trimmedLeftId,
          boundaryType
        },
        { status: 404 }
      );
    }

    if (!rightEntity) {
      return NextResponse.json(
        {
          error: 'Entity not found',
          message: `Right entity with ID "${trimmedRightId}" not found in ${boundaryType}`,
          entityId: trimmedRightId,
          boundaryType
        },
        { status: 404 }
      );
    }

    // Compare
    const comparison = engine.compare(leftEntity, rightEntity);

    // Generate insights
    const insightGenerator = new InsightGenerator();
    comparison.insights = insightGenerator.generateInsights(comparison);

    return NextResponse.json(comparison);
  } catch (error) {
    console.error('Comparison API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Comparison failed' },
      { status: 500 }
    );
  }
}
