/**
 * Political Boundaries API
 *
 * Serves GeoJSON boundary data for townships, school districts, and other political boundaries.
 * Supports filtering by type and returning pre-generated boundary files.
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Path to boundary data files
const DATA_DIR = path.join(process.cwd(), 'public/data/political');

// Boundary type to file mapping
const BOUNDARY_FILES: Record<string, string> = {
  township: 'ingham_townships.geojson',
  municipality: 'ingham_municipalities.geojson',
  'school-district': 'ingham_school_districts.geojson',
  // Note: county-commission removed - no GIS data available from Ingham County
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boundaryType = searchParams.get('type');

    if (!boundaryType) {
      // Return list of available boundary types
      return NextResponse.json({
        availableTypes: Object.keys(BOUNDARY_FILES),
        message: 'Specify ?type= parameter to get boundary data',
      });
    }

    const filename = BOUNDARY_FILES[boundaryType];
    if (!filename) {
      return NextResponse.json(
        {
          error: `Unknown boundary type: ${boundaryType}`,
          availableTypes: Object.keys(BOUNDARY_FILES),
        },
        { status: 400 }
      );
    }

    const filePath = path.join(DATA_DIR, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        {
          error: `Boundary data not found for type: ${boundaryType}`,
          message: 'Run the boundary derivation scripts to generate this data',
        },
        { status: 404 }
      );
    }

    // Read and return GeoJSON
    const geojsonData = fs.readFileSync(filePath, 'utf-8');
    const geojson = JSON.parse(geojsonData);

    // Filter out features with null geometry (placeholder entries)
    const validFeatures = geojson.features.filter(
      (f: GeoJSON.Feature) => f.geometry !== null
    );

    if (validFeatures.length === 0 && geojson.features.length > 0) {
      // All features are placeholders
      return NextResponse.json(
        {
          error: `Boundary data for ${boundaryType} contains only placeholder entries`,
          message: 'Geometry data needs to be fetched from Michigan GIS',
          placeholderCount: geojson.features.length,
        },
        { status: 404 }
      );
    }

    const response: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: validFeatures,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Type': 'application/geo+json',
      },
    });
  } catch (error) {
    console.error('[Political Boundaries API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load boundary data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Generate boundary data (admin endpoint)
 * In production, this could trigger re-derivation of boundaries
 */
export async function POST(req: NextRequest) {
  try {
    const { type, action } = await req.json();

    if (action === 'regenerate') {
      // For now, just return info - actual regeneration would call the scripts
      return NextResponse.json({
        message: `Boundary regeneration requested for type: ${type}`,
        status: 'not_implemented',
        hint: 'Run scripts/political/derive-township-boundaries.ts manually',
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
