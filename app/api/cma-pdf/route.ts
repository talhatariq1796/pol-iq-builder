import { NextRequest, NextResponse } from 'next/server';
import { CMAReportPDFGenerator } from '@/lib/pdf/CMAReportPDFGenerator';
import type { DemographicData } from '@/lib/services/DemographicDataService';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Ensure Node.js runtime for canvas support
export const maxDuration = 60; // Allow up to 60 seconds for PDF generation
export const fetchCache = 'force-no-store'; // Disable fetch cache
export const revalidate = 0; // Never cache, always regenerate

// Note: Body size limit in App Router is controlled by Vercel deployment settings
// Default is 4.5MB. To increase, configure in vercel.json or project settings.
// We've optimized images to stay under the limit (800x600 JPG @ 75% quality)

/**
 * Reverse geocode coordinates to get a street address
 * Uses ArcGIS World Geocoding Service REST API (server-side compatible)
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Resolved address string or null if failed
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&f=json&outSR=4326`;
    console.log('[CMA PDF API] Reverse geocoding coordinates:', { lat, lng });

    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[CMA PDF API] Reverse geocode HTTP error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.address?.Match_addr) {
      console.log('[CMA PDF API] ✅ Reverse geocode successful:', data.address.Match_addr);
      return data.address.Match_addr;
    }

    console.warn('[CMA PDF API] Reverse geocode returned no address');
    return null;
  } catch (error) {
    console.error('[CMA PDF API] Reverse geocode error:', error);
    return null;
  }
}

/**
 * Server-side PDF generation endpoint
 * POST /api/cma-pdf
 *
 * Body: PDFReportConfig
 * Returns: PDF blob
 */
export async function POST(request: NextRequest) {
  try {
    const config = await request.json();

    console.log('[CMA PDF API] Generating PDF for:', config.reportType);
    console.log('[CMA PDF API] Property category:', config.propertyCategory || 'not specified');
    console.log('[CMA PDF API] Properties count (selected comparables):', config.properties?.length || 0);
    console.log('[CMA PDF API] Area properties count (full area):', config.areaProperties?.length || 0);
    console.log('[CMA PDF API] Selection info:', config.selectionInfo);

    // Log first few property IDs to verify correct data
    if (config.properties?.length > 0) {
      const sampleIds = config.properties.slice(0, 5).map((p: any) => p.id || p.centris_no);
      console.log('[CMA PDF API] Sample property IDs received:', sampleIds);
    }

    // Server-side reverse geocoding for click coordinates
    // This is needed when user draws an area on map without selecting a specific property or searching an address
    if (config.clickCoordinates && !config.selectedProperty?.attributes?.address && !config.searchAddress) {
      console.log('[CMA PDF API] No property/search address available, attempting reverse geocode for:', config.clickCoordinates);

      const geocodedAddress = await reverseGeocode(
        config.clickCoordinates.lat,
        config.clickCoordinates.lng
      );

      if (geocodedAddress) {
        // Store the geocoded address so extractors can use it
        config.geocodedAddress = geocodedAddress;
        console.log('[CMA PDF API] ✅ Geocoded address will be used for PDF cover page:', geocodedAddress);
      }
    }

    // Load demographic data for the area (for Page 4 charts and metrics)
    // Server-side: Read blob-urls.json from filesystem instead of fetch()
    let demographicData: DemographicData | null = null;

    try {
      const blobUrlsPath = path.join(process.cwd(), 'public', 'data', 'blob-urls.json');
      const blobUrls = JSON.parse(fs.readFileSync(blobUrlsPath, 'utf-8'));
      const demographicUrl = blobUrls['demographic-analysis'];

      if (demographicUrl) {
        console.log('[CMA PDF API] Loading demographic data from blob storage...');
        const response = await fetch(demographicUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            demographicData = data.features[0].properties as DemographicData;
            console.log('[CMA PDF API] ✅ Demographic data loaded successfully:', {
              population: demographicData.ECYPTAPOP,
              households: demographicData.ECYTENHHD,
              medianIncome: demographicData.ECYHNIMED,
              avgIncome: demographicData.ECYHNIAVG,
              ownershipRate: demographicData.ECYTENOWN_P
            });
            // Add demographic data to config
            config.demographicData = demographicData;
          }
        }
      } else {
        console.warn('[CMA PDF API] No demographic-analysis URL in blob-urls.json');
      }
    } catch (error) {
      console.error('[CMA PDF API] Error loading demographic data:', error);
      console.warn('[CMA PDF API] Page 4 will use fallback demographic values');
    }

    // Generate PDF server-side (where canvas is available)
    // Note: PropertyCategory determines which columns appear in Page 3 comparables table
    // - 'residential': bedrooms, bathrooms, square footage
    // - 'revenue': GIM, NOI, Cap Rate, PGI
    // - 'both': refers to sold + active (not mixed property types)
    const generator = new CMAReportPDFGenerator();
    const pdfBlob = await generator.generateReport(config);

    // Convert blob to buffer for response
    const buffer = await pdfBlob.arrayBuffer();

    // Return PDF with appropriate headers (no caching)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CMA-Report-${config.reportType}-${Date.now()}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[CMA PDF API] Error generating PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
