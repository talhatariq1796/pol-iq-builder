import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  ComparisonEngine,
  BatchComparisonEngine,
  type PrecinctDataFile,
  type MunicipalityDataFile,
  type StateHouseDataFile,
  type BoundaryType,
  type ComparisonEntity,
  type BatchComparisonResult,
  type BatchComparisonOptions,
} from '@/lib/comparison';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

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
 * Build comparison entities from entity IDs
 */
function buildEntities(
  entityIds: string[],
  boundaryType: BoundaryType,
  engine: ComparisonEngine
): ComparisonEntity[] {
  const entities: ComparisonEntity[] = [];

  for (const entityId of entityIds) {
    let entity: ComparisonEntity | null = null;

    try {
      // Build entity based on boundary type
      switch (boundaryType) {
        case 'precincts':
          entity = engine.buildPrecinctEntity(entityId);
          break;
        case 'municipalities':
          entity = engine.buildMunicipalityEntity(entityId);
          break;
        case 'state_house':
          entity = engine.buildStateHouseEntity(entityId);
          break;
        default:
          // Try jurisdiction entity (from precinct data file)
          entity = engine.buildJurisdictionEntity(entityId);
          break;
      }

      if (entity) {
        entities.push(entity);
      }
    } catch (error) {
      console.error(`Failed to build entity ${entityId}:`, error);
      // Continue to next entity
    }
  }

  return entities;
}

/**
 * POST /api/comparison/batch
 *
 * Request body:
 * {
 *   entityIds: string[];  // 3-8 entity IDs
 *   boundaryType: 'precincts' | 'municipalities' | 'state_house';
 *   options?: {
 *     includeSimilarities?: boolean;  // Include pairwise similarity matrix
 *     includeClustering?: boolean;  // Include cluster analysis
 *     clusterCount?: number;  // Number of clusters (default: 3)
 *     includeCorrelations?: boolean;  // Include metric correlations
 *   }
 * }
 *
 * Returns BatchComparisonResult with:
 * - entities: Built comparison entities
 * - analytics: Matrix-level statistical analysis (demographics, political, targeting)
 * - rankings: Rankings by different metrics (GOTV, persuasion, ROI, etc.)
 * - clusters: K-means clusters (if includeClustering)
 * - pairwiseSimilarities: Pairwise similarities (if includeSimilarities)
 * - timestamp: Comparison timestamp
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityIds, boundaryType = 'precincts', options = {} } = body;

    // Validate entityIds
    if (!entityIds || !Array.isArray(entityIds)) {
      return NextResponse.json(
        { error: 'entityIds must be an array of entity IDs' },
        { status: 400 }
      );
    }

    if (entityIds.length < 3) {
      return NextResponse.json(
        { error: 'Batch comparison requires at least 3 entities' },
        { status: 400 }
      );
    }

    if (entityIds.length > 8) {
      return NextResponse.json(
        { error: 'Batch comparison supports maximum 8 entities' },
        { status: 400 }
      );
    }

    // Validate boundary type
    const validBoundaryTypes: BoundaryType[] = ['precincts', 'municipalities', 'state_house'];
    if (!validBoundaryTypes.includes(boundaryType)) {
      return NextResponse.json(
        {
          error: `Invalid boundaryType. Must be one of: ${validBoundaryTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Load boundary data
    const data = await loadBoundaryData(boundaryType);

    // Initialize engines
    const comparisonEngine = new ComparisonEngine(data);
    const batchEngine = new BatchComparisonEngine();

    // Build entities
    const entities = buildEntities(entityIds, boundaryType, comparisonEngine);

    if (entities.length < 3) {
      return NextResponse.json(
        {
          error: `Could only build ${entities.length} valid entities from provided IDs. Batch comparison requires at least 3 valid entities.`,
        },
        { status: 400 }
      );
    }

    // Parse options
    const batchOptions: Partial<BatchComparisonOptions> = {
      includeSimilarities: options.includeSimilarities ?? false,
      includeClustering: options.includeClustering ?? true,
      clusterCount: options.clusterCount ?? 3,
      includeCorrelations: options.includeCorrelations ?? true,
    };

    // Perform batch comparison
    const result: BatchComparisonResult = batchEngine.compareBatch(entities, batchOptions);

    // Generate insights
    const insights = batchEngine.generateInsights(result);

    // Return result with insights
    return NextResponse.json({
      ...result,
      insights,
    });
  } catch (error) {
    console.error('Batch comparison API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Batch comparison failed',
      },
      { status: 500 }
    );
  }
}
