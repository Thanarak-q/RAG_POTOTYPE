'use client';

import type { KnowledgeChunk } from '@line-rag/shared';
import { FormEvent, useState } from 'react';

interface ChatResult {
  answer: string;
  model: string;
  latencyMs: number;
  retrievedChunks: KnowledgeChunk[];
}

export function PlaygroundClient({ csrfToken }: { csrfToken: string }) {
  const [result, setResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const sourceType = String(formData.get('sourceType') ?? '');
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        message: String(formData.get('message') ?? ''),
        sourceType: sourceType || undefined,
      }),
    });
    const body = (await response.json()) as {
      success: boolean;
      data?: ChatResult;
      error?: string;
    };
    setIsLoading(false);
    if (!response.ok || !body.success || !body.data) {
      setError(body.error ?? 'Chat request failed');
      return;
    }
    setResult(body.data);
  }

  return (
    <div className="grid two-col">
      <section className="panel">
        <header className="page-header">
          <h1>Playground</h1>
        </header>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="message">Question</label>
            <textarea id="message" name="message" required />
          </div>
          <div className="field">
            <label htmlFor="sourceType">Source filter</label>
            <select id="sourceType" name="sourceType" defaultValue="">
              <option value="">All</option>
              <option value="faq">FAQ</option>
              <option value="help">Help</option>
              <option value="job_posting">Job posting</option>
            </select>
          </div>
          <button className="button" type="submit" disabled={isLoading}>
            {isLoading ? 'Asking...' : 'Ask'}
          </button>
          {error ? <p className="muted">{error}</p> : null}
        </form>
      </section>
      <section className="panel">
        <h2>Debug Output</h2>
        {result ? (
          <div className="grid">
            <div className="answer">
              <strong>Answer</strong>
              <p>{result.answer}</p>
              <p className="muted">
                {result.model} · {result.latencyMs}ms
              </p>
            </div>
            {result.retrievedChunks.map((chunk) => (
              <div className="chunk" key={chunk.id}>
                <strong>
                  {chunk.title} · {chunk.score?.toFixed(3) ?? 'n/a'}
                </strong>
                <p>{chunk.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            Submit a question to get a grounded answer and retrieved chunks.
          </p>
        )}
      </section>
    </div>
  );
}
