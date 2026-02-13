import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

// export const runtime = 'edge'; // Disabled due to CommonJS compatibility issues

export async function POST(request: Request) {
  try {
    // Check for BLOB_READ_WRITE_TOKEN
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN is not configured');
      return NextResponse.json(
        { error: 'Storage configuration is missing. Please configure BLOB_READ_WRITE_TOKEN.' },
        { status: 500 }
      );
    }

    const { features } = await request.json();

    if (!features || !Array.isArray(features)) {
      return NextResponse.json(
        { error: 'Invalid features data - expected an array' },
        { status: 400 }
      );
    }

    // Validate feature structure
    if (features.length === 0) {
      return NextResponse.json(
        { error: 'Features array is empty' },
        { status: 400 }
      );
    }

    // Add timestamp to filename for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `features-${timestamp}.json`;

    const blob = await put(filename, JSON.stringify(features), {
      access: 'public',
      addRandomSuffix: true,
      ttl: 300
    } as any);

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Error uploading features:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to upload features: ${errorMessage}` },
      { status: 500 }
    );
  }
} 