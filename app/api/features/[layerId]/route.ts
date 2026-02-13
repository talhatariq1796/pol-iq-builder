import { NextResponse } from 'next/server';
import { layers } from '@/config/layers';

export async function GET(request: Request, { params }: { params: { layerId: string } }) {
  const layerId = params.layerId;
  const layer = layers[layerId];
  if (!layer) {
    return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
  }

  // Call ArcGIS REST API directly
  const url = `${layer.url}/query?where=1=1&outFields=*&f=geojson`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch from ArcGIS service' }, { status: 502 });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching features:', error);
    return NextResponse.json({ error: 'Failed to fetch features' }, { status: 500 });
  }
} 