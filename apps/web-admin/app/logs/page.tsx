import { readEnvelope, svcBotFetch } from '@/lib/svcBot';

export const dynamic = 'force-dynamic';

interface SessionLog {
  id: string;
  lineUserId: string;
  lastActiveAt: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    retrievedChunkIds: string[];
    model?: string;
    latencyMs?: number;
    createdAt: string;
  }[];
}

export default async function LogsPage() {
  const data = await readEnvelope<{ sessions: SessionLog[] }>(
    await svcBotFetch('/api/logs'),
  ).catch(() => ({ sessions: [] }));

  return (
    <div className="grid">
      <header className="page-header">
        <h1>Logs</h1>
      </header>
      {data.sessions.map((session) => (
        <section className="panel" key={session.id}>
          <h2>{session.lineUserId}</h2>
          <p className="muted">
            Last active {new Date(session.lastActiveAt).toLocaleString()}
          </p>
          {session.messages.map((message, index) => (
            <div className="message" key={`${session.id}-${index}`}>
              <strong>{message.role}</strong>
              <p>{message.content}</p>
              {message.retrievedChunkIds.length > 0 ? (
                <p className="muted">
                  Chunks: {message.retrievedChunkIds.join(', ')}
                </p>
              ) : null}
              {message.model ? (
                <p className="muted">
                  {message.model} · {message.latencyMs ?? 0}ms
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
