import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// Query type detection functions
const isCorrelationQuery = (query: string): boolean => {
  const correlationKeywords = [
    'correlation',
    'relationship',
    'compare',
    'versus',
    'vs',
    'between',
    'against'
  ];
  
  return correlationKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
};

const is3DVisualizationQuery = (query: string): boolean => {
  const threeDKeywords = [
    '3d',
    'three dimensional',
    'height',
    'elevation',
    'terrain',
    'buildings',
    'skyline'
  ];
  
  return threeDKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
};

const isSimpleDisplayQuery = (query: string): boolean => {
  const displayKeywords = [
    '^show',
    '^display',
    '^visualize',
    '^map',
    '^where'
  ];
  
  return displayKeywords.some(keyword => 
    new RegExp(keyword, 'i').test(query)
  );
};

interface LayerResult {
  features: any[];
  layer: {
    id: string;
    name: string;
    type: string;
    rendererField?: string;
  };
  weight: number;
}

// Visualization selection logic
const determineVisualizationType = (
  query: string,
  layerResults: LayerResult[]
): 'single' | 'point' | 'correlation' | '3d' => {
  // Check for 3D visualization first
  if (is3DVisualizationQuery(query)) {
    const hasPointLayer = layerResults.some(lr => lr.layer.type === 'point');
    const hasPolygonLayer = layerResults.some(lr => lr.layer.type === 'polygon' || lr.layer.type === 'index');
    
    if (hasPointLayer && hasPolygonLayer) {
      return '3d';
    }
  }

  // Check for correlation analysis
  if (isCorrelationQuery(query) && layerResults.length >= 2) {
    return 'correlation';
  }

  // Check for point layer visualization
  const pointLayer = layerResults.find(lr => lr.layer.type === 'point');
  if (pointLayer) {
    return 'point';
  }

  // Default to single layer visualization
  return 'single';
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Upload to Vercel blob storage
    const blob = await put('feature-data.json', JSON.stringify(body), {
      access: 'public',
      contentType: 'application/json'
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Error uploading blob:', error);
    return NextResponse.json(
      { error: 'Failed to upload blob', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 