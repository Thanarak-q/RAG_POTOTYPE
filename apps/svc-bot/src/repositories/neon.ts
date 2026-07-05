import { neon } from '@neondatabase/serverless';
import type { KnowledgeChunk, KnowledgeDocument } from '@line-rag/shared';
import type { ChatRepository, KnowledgeRepository } from './types';

type Sql = ReturnType<typeof neon>;
type Row = Record<string, unknown>;

export class NeonKnowledgeRepository implements KnowledgeRepository {
  private readonly sql: Sql;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async createPendingDocument(input: {
    title: string;
    sourceType: KnowledgeDocument['sourceType'];
    rawText: string;
  }): Promise<KnowledgeDocument> {
    const rows = (await this.sql`
      insert into documents (title, source_type, raw_text, status)
      values (${input.title}, ${input.sourceType}, ${input.rawText}, 'pending')
      returning id, title, source_type, raw_text, status, created_at, updated_at
    `) as Row[];
    const row = rows[0];
    if (!row) {
      throw new Error('Failed to create document');
    }
    return mapDocument(row);
  }

  async markDocumentIndexed(documentId: string): Promise<void> {
    await this.sql`
      update documents set status = 'indexed', updated_at = now()
      where id = ${documentId}
    `;
  }

  async markDocumentFailed(documentId: string, reason: string): Promise<void> {
    await this.sql`
      update documents set status = 'failed', raw_text = raw_text || E'\n\nIndexing error: ' || ${reason}, updated_at = now()
      where id = ${documentId}
    `;
  }

  async insertChunks(chunks: Omit<KnowledgeChunk, 'score'>[]): Promise<void> {
    for (const chunk of chunks) {
      await this.sql`
        insert into chunks (id, document_id, chunk_index, content, token_count, pinecone_id)
        values (${chunk.id}, ${chunk.documentId}, ${chunk.chunkIndex}, ${chunk.content}, ${chunk.tokenCount}, ${chunk.pineconeId})
      `;
    }
  }

  async findChunksByPineconeIds(ids: string[]): Promise<KnowledgeChunk[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = (await this.sql`
      select c.id, c.document_id, c.chunk_index, c.content, c.token_count, c.pinecone_id,
             d.source_type, d.title
      from chunks c
      join documents d on d.id = c.document_id
      where c.pinecone_id = any(${ids})
    `) as Row[];
    return rows.map(mapChunk);
  }

  async listDocuments(): Promise<KnowledgeDocument[]> {
    const rows = (await this.sql`
      select id, title, source_type, raw_text, status, created_at, updated_at
      from documents
      order by created_at desc
    `) as Row[];
    return rows.map(mapDocument);
  }

  async deleteDocument(documentId: string): Promise<string[]> {
    const rows = (await this.sql`
      delete from chunks where document_id = ${documentId}
      returning pinecone_id
    `) as Row[];
    await this.sql`delete from documents where id = ${documentId}`;
    return rows.map((row) => String(row.pinecone_id));
  }

  async health(): Promise<void> {
    await this.sql`select 1`;
  }
}

export class NeonChatRepository implements ChatRepository {
  private readonly sql: Sql;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async getOrCreateSession(lineUserId: string): Promise<string> {
    const rows = (await this.sql`
      insert into chat_sessions (line_user_id)
      values (${lineUserId})
      on conflict (line_user_id)
      do update set last_active_at = now()
      returning id
    `) as Row[];
    return String(rows[0]?.id);
  }

  async listRecentMessages(
    sessionId: string,
    limit: number,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const rows = (await this.sql`
      select role, content from chat_messages
      where session_id = ${sessionId}
      order by created_at desc
      limit ${limit}
    `) as Row[];
    return rows.reverse().map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: String(row.content),
    }));
  }

  async appendMessage(input: {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    retrievedChunkIds?: string[];
    model?: string;
    latencyMs?: number;
  }): Promise<void> {
    await this.sql`
      insert into chat_messages (session_id, role, content, retrieved_chunk_ids, model, latency_ms)
      values (${input.sessionId}, ${input.role}, ${input.content}, ${JSON.stringify(input.retrievedChunkIds ?? [])}, ${input.model ?? null}, ${input.latencyMs ?? null})
    `;
  }

  async listSessions(): Promise<
    {
      id: string;
      lineUserId: string;
      startedAt: string;
      lastActiveAt: string;
      messages: {
        role: 'user' | 'assistant';
        content: string;
        retrievedChunkIds: string[];
        model?: string;
        latencyMs?: number;
        createdAt: string;
      }[];
    }[]
  > {
    const sessions = (await this.sql`
      select id, line_user_id, started_at, last_active_at
      from chat_sessions
      order by last_active_at desc
      limit 50
    `) as Row[];
    const result = [];
    for (const session of sessions) {
      const messages = (await this.sql`
        select role, content, retrieved_chunk_ids, model, latency_ms, created_at
        from chat_messages
        where session_id = ${session.id}
        order by created_at asc
        limit 50
      `) as Row[];
      result.push({
        id: String(session.id),
        lineUserId: String(session.line_user_id),
        startedAt: new Date(String(session.started_at)).toISOString(),
        lastActiveAt: new Date(String(session.last_active_at)).toISOString(),
        messages: messages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: String(message.content),
          retrievedChunkIds: Array.isArray(message.retrieved_chunk_ids)
            ? message.retrieved_chunk_ids.map(String)
            : [],
          ...(message.model ? { model: String(message.model) } : {}),
          ...(message.latency_ms
            ? { latencyMs: Number(message.latency_ms) }
            : {}),
          createdAt: new Date(String(message.created_at)).toISOString(),
        })),
      });
    }
    return result;
  }
}

function mapDocument(row: Record<string, unknown>): KnowledgeDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    sourceType: row.source_type as KnowledgeDocument['sourceType'],
    rawText: String(row.raw_text),
    status: row.status as KnowledgeDocument['status'],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapChunk(row: Record<string, unknown>): KnowledgeChunk {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    chunkIndex: Number(row.chunk_index),
    content: String(row.content),
    tokenCount: Number(row.token_count),
    pineconeId: String(row.pinecone_id),
    sourceType: row.source_type as KnowledgeChunk['sourceType'],
    title: String(row.title),
  };
}
