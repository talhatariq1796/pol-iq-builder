import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    console.log('[BlobUpload] Received request');
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Log token generation request
        console.log('[BlobUpload] Generating token:', {
          pathname,
          payloadSize: clientPayload?.length || 0
        });

        try {
          const payload = clientPayload ? JSON.parse(clientPayload) : {};
          console.log('[BlobUpload] Client payload:', {
            timestamp: payload.timestamp,
            fileSize: payload.fileSize,
            fileName: payload.fileName
          });
        } catch (e) {
          console.warn('[BlobUpload] Failed to parse client payload:', e);
        }

        return {
          allowedContentTypes: ['application/json'],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB limit
          tokenPayload: clientPayload
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Log successful upload
        console.log('[BlobUpload] Upload completed:', {
          url: blob.url,
          pathname: blob.pathname,
          contentType: blob.contentType,
          tokenPayload: tokenPayload ? JSON.parse(tokenPayload) : null
        });
      },
    });

    console.log('[BlobUpload] Returning response to client');
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[BlobUpload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    );
  }
} 