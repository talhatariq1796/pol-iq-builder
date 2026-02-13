import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

// export const runtime = 'edge'; // Disabled due to CommonJS compatibility issues

export async function OPTIONS(request: Request) {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

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

    const { filename, contentType } = await request.json();
    
    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Missing filename or contentType' },
        { status: 400 }
      );
    }

    // Create a minimal JSON object to initialize the blob
    const initialContent = JSON.stringify({ initialized: true });
    const blob = await put(filename, new Blob([initialContent], { type: contentType }), {
      access: 'public',
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    // Format the response to include both url and uploadUrl
    return NextResponse.json({
      url: blob.url,
      uploadUrl: blob.url,
      pathname: blob.pathname
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
} 