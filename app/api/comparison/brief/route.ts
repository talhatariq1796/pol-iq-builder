import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  ComparisonEngine,
  FieldBriefGenerator,
  type PrecinctDataFile,
  type MunicipalityDataFile,
  type StateHouseDataFile,
  type BoundaryType,
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

interface BriefRequestBody {
  leftEntityId: string;
  rightEntityId: string;
  boundaryType: 'precincts' | 'municipalities' | 'state_house';
  options?: {
    includeROI?: boolean;
    includeDonorData?: boolean;
    format?: 'json' | 'markdown' | 'text' | 'html';
  };
}

/**
 * POST /api/comparison/brief
 *
 * Generates a field brief for canvassers comparing two entities
 *
 * Request body:
 * {
 *   leftEntityId: string,
 *   rightEntityId: string,
 *   boundaryType: 'precincts' | 'municipalities' | 'state_house',
 *   options?: {
 *     includeROI?: boolean,         // default true
 *     includeDonorData?: boolean,   // default true
 *     format?: 'json' | 'markdown' | 'text' | 'html'  // default 'json'
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body: BriefRequestBody = await req.json();
    const { leftEntityId, rightEntityId, boundaryType, options = {} } = body;

    // Validate required fields
    if (!leftEntityId || !rightEntityId) {
      return NextResponse.json(
        { error: 'Both leftEntityId and rightEntityId are required' },
        { status: 400 }
      );
    }

    if (!boundaryType) {
      return NextResponse.json(
        { error: 'boundaryType is required' },
        { status: 400 }
      );
    }

    // Load data and create engine
    const data = await loadBoundaryData(boundaryType);
    const engine = new ComparisonEngine(data);

    // Build entities based on boundary type
    let leftEntity;
    let rightEntity;

    switch (boundaryType) {
      case 'precincts':
        leftEntity = engine.buildPrecinctEntity(leftEntityId);
        rightEntity = engine.buildPrecinctEntity(rightEntityId);
        break;
      case 'municipalities':
        leftEntity = engine.buildMunicipalityEntity(leftEntityId);
        rightEntity = engine.buildMunicipalityEntity(rightEntityId);
        break;
      case 'state_house':
        leftEntity = engine.buildStateHouseEntity(leftEntityId);
        rightEntity = engine.buildStateHouseEntity(rightEntityId);
        break;
      default:
        return NextResponse.json(
          { error: `Invalid boundaryType: ${boundaryType}` },
          { status: 400 }
        );
    }

    // Generate brief
    const briefGenerator = new FieldBriefGenerator();
    const brief = await briefGenerator.generateBrief(
      leftEntity,
      rightEntity,
      {
        includeVoterProfiles: true,
        includeTalkingPoints: true,
        includeFieldOps: true,
      }
    );

    // Return in requested format
    const format = options.format || 'json';

    if (format === 'json') {
      return NextResponse.json(brief);
    }

    // Export to other formats
    const exported = briefGenerator.exportBrief(brief, format);

    // Set appropriate Content-Type
    let contentType: string;
    switch (format) {
      case 'markdown':
        contentType = 'text/markdown';
        break;
      case 'html':
        contentType = 'text/html';
        break;
      case 'text':
      default:
        contentType = 'text/plain';
        break;
    }

    return new NextResponse(exported, {
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
      },
    });
  } catch (error) {
    console.error('Brief generation API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Brief generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/comparison/brief
 *
 * Quick brief generation with query parameters
 *
 * Query params:
 * - left: left entity ID (required)
 * - right: right entity ID (required)
 * - boundaryType: 'precincts' | 'municipalities' | 'state_house' (required)
 * - format: 'json' | 'markdown' | 'text' | 'html' (default: 'json')
 * - includeROI: 'true' | 'false' (default: 'true')
 * - includeDonorData: 'true' | 'false' (default: 'true')
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const leftEntityId = searchParams.get('left');
    const rightEntityId = searchParams.get('right');
    const boundaryType = searchParams.get('boundaryType') as BoundaryType | null;
    const format = (searchParams.get('format') || 'json') as 'json' | 'markdown' | 'text' | 'html';
    const includeROI = searchParams.get('includeROI') !== 'false';
    const includeDonorData = searchParams.get('includeDonorData') !== 'false';

    // Validate required fields
    if (!leftEntityId || !rightEntityId) {
      return NextResponse.json(
        { error: 'Both left and right entity IDs are required' },
        { status: 400 }
      );
    }

    if (!boundaryType) {
      return NextResponse.json(
        { error: 'boundaryType is required' },
        { status: 400 }
      );
    }

    // Load data and create engine
    const data = await loadBoundaryData(boundaryType);
    const engine = new ComparisonEngine(data);

    // Build entities based on boundary type
    let leftEntity;
    let rightEntity;

    switch (boundaryType) {
      case 'precincts':
        leftEntity = engine.buildPrecinctEntity(leftEntityId);
        rightEntity = engine.buildPrecinctEntity(rightEntityId);
        break;
      case 'municipalities':
        leftEntity = engine.buildMunicipalityEntity(leftEntityId);
        rightEntity = engine.buildMunicipalityEntity(rightEntityId);
        break;
      case 'state_house':
        leftEntity = engine.buildStateHouseEntity(leftEntityId);
        rightEntity = engine.buildStateHouseEntity(rightEntityId);
        break;
      default:
        return NextResponse.json(
          { error: `Invalid boundaryType: ${boundaryType}` },
          { status: 400 }
        );
    }

    // Generate brief
    const briefGenerator = new FieldBriefGenerator();
    const brief = await briefGenerator.generateBrief(
      leftEntity,
      rightEntity,
      {
        includeVoterProfiles: true,
        includeTalkingPoints: true,
        includeFieldOps: true,
      }
    );

    // Return in requested format
    if (format === 'json') {
      return NextResponse.json(brief);
    }

    // Export to other formats
    const exported = briefGenerator.exportBrief(brief, format);

    // Set appropriate Content-Type
    let contentType: string;
    switch (format) {
      case 'markdown':
        contentType = 'text/markdown';
        break;
      case 'html':
        contentType = 'text/html';
        break;
      case 'text':
      default:
        contentType = 'text/plain';
        break;
    }

    return new NextResponse(exported, {
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
      },
    });
  } catch (error) {
    console.error('Brief generation API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Brief generation failed' },
      { status: 500 }
    );
  }
}
