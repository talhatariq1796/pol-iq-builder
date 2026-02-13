import { NextResponse } from 'next/server';

/**
 * DEPRECATED API Endpoint
 *
 * This endpoint was for Quebec real estate composite index analysis.
 * The political analysis platform does not use composite indices.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Deprecated endpoint',
      message: 'This endpoint was for Quebec real estate analysis and has been deprecated. The political platform does not use composite indices.'
    },
    { status: 410 } // 410 Gone
  );
}
