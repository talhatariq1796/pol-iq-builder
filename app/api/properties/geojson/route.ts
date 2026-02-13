import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * API endpoint for property GeoJSON data
 * Used by PropertyQueryService for buffer queries and map visualization
 * 
 * CONSISTENCY NOTE: This endpoint now prioritizes the same Vercel Blob data source
 * used by the map layers to ensure complete data consistency across the platform.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'sold', or null for all
    
    // Strategy 1: Try Vercel Blob first (same source as map layers)
    const BLOB_URL = '""';
    
    try {
      console.log('[Properties API] 🔧 UNIFIED SOURCE - Attempting Vercel Blob (same as map layers)');
      const blobResponse = await fetch(BLOB_URL);
      
      if (blobResponse.ok) {
        const blobData = await blobResponse.json();
        
        if (blobData?.features?.length > 0) {
          console.log(`[Properties API] 🔧 UNIFIED SUCCESS - Using blob data: ${blobData.features.length} properties`);
          
          // Apply status filter if requested
          let filteredFeatures = blobData.features;
          if (status === 'active') {
            filteredFeatures = blobData.features.filter((f: any) => f.properties?.st === 'AC' || f.properties?.status === 'active');
          } else if (status === 'sold') {
            filteredFeatures = blobData.features.filter((f: any) => f.properties?.st === 'SO' || f.properties?.status === 'sold');
          }
          
          const filteredData = {
            ...blobData,
            features: filteredFeatures
          };
          
          console.log(`[Properties API] 🔧 FILTERED RESULT - ${filteredFeatures.length} properties (status: ${status || 'all'})`);
          return NextResponse.json(filteredData, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300',
            },
          });
        }
      }
    } catch (blobError) {
      console.error('[Properties API] 🚨 BLOB DATA UNAVAILABLE - No fallback, failing gracefully:', blobError);
      
      // 🚨 NO FALLBACK: Fail immediately if blob data unavailable
      // This ensures consistency - if map layers can't load, API also fails
      throw new Error(`BLOB DATA UNAVAILABLE: ${blobError instanceof Error ? blobError.message : String(blobError)}. Both map layers and API require the same data source.`);
    }
    
  } catch (error) {
    console.error('[Properties API] Critical error - blob data unavailable:', error);
    
    // 🚨 RETURN ERROR: Don't return empty data, return proper error
    // This ensures both map layers and CMA analysis fail together
    return NextResponse.json({
      error: 'Property data unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: 'The property data source (Vercel Blob) is currently unavailable. Both map layers and analysis features require this data.',
      timestamp: new Date().toISOString()
    }, {
      status: 503, // Service Unavailable
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

// Support OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}