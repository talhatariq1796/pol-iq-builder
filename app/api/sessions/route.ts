import { NextRequest, NextResponse } from 'next/server';
import { sessionAnalytics } from '@/lib/analytics/session-analytics';
import { SessionStorage } from '@/lib/storage/session-storage';
import { mergeSessions } from '@/lib/chat/session-utils';

const store = new SessionStorage();

// Utility to read JSON safely
async function readJSON<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const sessions = await store.listSessions(userId);
  return NextResponse.json({ sessions });
}

interface MergeBody {
  userId: string;
  sourceSessionId: string;
  targetSessionId: string;
  keepSource?: boolean;
  messageStrategy?: 'concat' | 'source-first' | 'target-first';
}

export async function POST(req: NextRequest) {
  const body = await readJSON<MergeBody>(req);
  if (!body)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { userId, sourceSessionId, targetSessionId, keepSource, messageStrategy } = body;
  if (!userId || !sourceSessionId || !targetSessionId)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (sourceSessionId === targetSessionId)
    return NextResponse.json({ error: 'source and target cannot be same' }, { status: 400 });

  try {
    await mergeSessions(store, userId, sourceSessionId, targetSessionId, {
      keepSource,
      messageStrategy,
    });
    sessionAnalytics.track({
      type: 'session_end',
      userId,
      sessionId: sourceSessionId,
      durationMs: 0,
      messageCount: 0,
      timestamp: Date.now(),
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const sessionId = searchParams.get('sessionId');
  if (!userId || !sessionId) {
    return NextResponse.json({ error: 'userId and sessionId required' }, { status: 400 });
  }
  try {
    await store.deleteSession(userId, sessionId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 