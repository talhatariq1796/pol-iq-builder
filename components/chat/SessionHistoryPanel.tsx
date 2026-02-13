import React, { useEffect, useState } from 'react';
import { useChatContext } from '@/components/chat-context-provider';
import { Button } from '@/components/ui/button';
import { Loader2, Trash, Link, Merge } from 'lucide-react';

interface SessionSummary {
  sessionId: string;
  start: number;
  end: number;
  messageCount: number;
}

interface Props {
  userId: string;
  onClose: () => void;
}

const SessionHistoryPanel: React.FC<Props> = ({ userId, onClose }) => {
  const { bridgeSession, currentSessionId } = useChatContext();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const prettyTime = (ts: number) => new Date(ts).toLocaleString();

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2"><Loader2 className="animate-spin" />Loading…</div>
    );
  }
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="w-[300px] h-full bg-white border-l shadow-lg flex flex-col">
      <div className="p-3 border-b flex justify-between items-center">
        <h3 className="text-sm font-semibold">Session History</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
        {sessions.map((s) => (
          <div key={s.sessionId} className="border rounded p-2 space-y-1">
            <div className="font-mono break-all">{s.sessionId}</div>
            <div>Start: {prettyTime(s.start)}</div>
            <div>Msgs: {s.messageCount}</div>
            <div className="flex gap-2 pt-1">
              {currentSessionId && currentSessionId !== s.sessionId && (
                <Button size="sm" variant="outline" onClick={() => bridgeSession(s.sessionId)}>
                  <Link className="h-3 w-3 mr-1" />Load Context
                </Button>
              )}
              {currentSessionId && currentSessionId !== s.sessionId && (
                <Button size="sm" variant="outline" onClick={async () => {
                  await fetch('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId,
                      sourceSessionId: s.sessionId,
                      targetSessionId: currentSessionId,
                    }),
                  });
                  fetchSessions();
                }}>
                  <Merge className="h-3 w-3 mr-1" />Merge
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={async () => {
                await fetch(`/api/sessions?userId=${userId}&sessionId=${s.sessionId}`, { method: 'DELETE' });
                fetchSessions();
              }}>
                <Trash className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SessionHistoryPanel; 