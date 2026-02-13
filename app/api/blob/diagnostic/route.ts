/* eslint-disable prefer-const */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// export const runtime = 'edge'; // Disabled due to CommonJS compatibility issues

export async function GET() {
  return NextResponse.json({
    status: 'success',
    environment: {
      blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ? 'configured' : 'missing',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
      nodeEnv: process.env.NODE_ENV
    },
    message: 'Diagnostic endpoint is functioning'
  });
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Analyze the data structure
    const featureCountsByLayer = [];
    let totalFeatures = 0;
    let uniqueZipCodes = new Set();
    
    if (data.features && Array.isArray(data.features)) {
      for (const layer of data.features) {
        const layerFeatureCount = layer.features?.length || 0;
        totalFeatures += layerFeatureCount;
        
        // Check for ZIP codes in first 10 features of each layer
        const sampleSize = Math.min(10, layerFeatureCount);
        const zipCodesInLayer = new Set();
        
        for (let i = 0; i < sampleSize; i++) {
          if (layer.features && layer.features[i]) {
            const feature = layer.features[i];
            const props = feature.properties || feature;
            
            // Check for any ZIP code field
            const zipFields = ['DESCRIPTION', 'ZIP_CODE', 'ZIP', 'ZIPCODE', 'POSTAL_CODE'];
            for (const field of zipFields) {
              if (props[field]) {
                zipCodesInLayer.add(props[field]);
                uniqueZipCodes.add(props[field]);
                break;
              }
            }
            
            // Check for synthetic ZIP codes including those in DESCRIPTION
            if (props.DESCRIPTION && (props.DESCRIPTION.startsWith('SYN-') || props.DESCRIPTION.startsWith('GEN-'))) {
              zipCodesInLayer.add(props.DESCRIPTION);
              uniqueZipCodes.add(props.DESCRIPTION);
            } else if (props.ZIP_CODE && props.ZIP_CODE.startsWith('GEN-')) {
              zipCodesInLayer.add(props.ZIP_CODE);
              uniqueZipCodes.add(props.ZIP_CODE);
            }
          }
        }
        
        featureCountsByLayer.push({
          layerId: layer.layerId || 'unknown',
          featureCount: layerFeatureCount,
          zipCodeSamples: Array.from(zipCodesInLayer).slice(0, 5),
          sampleThematicValues: layer.features?.slice(0, 3).map((f: any) => 
            (f.properties?.thematic_value !== undefined) 
              ? f.properties.thematic_value 
              : 'missing'
          ) || []
        });
      }
    }
    
    return NextResponse.json({
      status: 'success',
      dataAnalysis: {
        layerCount: data.features?.length || 0,
        totalFeatures,
        uniqueZipCodeCount: uniqueZipCodes.size,
        zipCodeSamples: Array.from(uniqueZipCodes).slice(0, 10),
        featureCountsByLayer,
        isComplete: data.isComplete || false,
        timestamp: data.timestamp || 'missing'
      },
      message: 'Data structure analyzed successfully'
    });
  } catch (error) {
    console.error('Error in diagnostic endpoint:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to analyze data structure'
    }, { status: 500 });
  }
} 