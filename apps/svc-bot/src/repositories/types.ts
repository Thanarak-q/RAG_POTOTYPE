import type {
  KnowledgeChunk,
  KnowledgeDocument,
  SourceType,
} from '@line-rag/shared';

export interface VectorMatch {
  id: string;
  score: number;
  documentId: string;
  sourceType: SourceType;
  title: string;
}

export interface VectorRepository {
  query(params: {
    embedding: number[];
    topK: number;
    sourceType?: SourceType;
  }): Promise<VectorMatch[]>;
  upsert(params: {
    namespace: SourceType;
    vectors: {
      id: string;
      values: number[];
      metadata: { documentId: string; sourceType: SourceType; title: string };
    }[];
  }): Promise<void>;
  delete(ids: string[]): Promise<void>;
  health(): Promise<void>;
}

export interface KnowledgeRepository {
  createPendingDocument(input: {
    title: string;
    sourceType: SourceType;
    rawText: string;
  }): Promise<KnowledgeDocument>;
  markDocumentIndexed(documentId: string): Promise<void>;
  markDocumentFailed(documentId: string, reason: string): Promise<void>;
  insertChunks(chunks: Omit<KnowledgeChunk, 'score'>[]): Promise<void>;
  findChunksByPineconeIds(ids: string[]): Promise<KnowledgeChunk[]>;
  listDocuments(): Promise<KnowledgeDocument[]>;
  deleteDocument(documentId: string): Promise<string[]>;
  health(): Promise<void>;
}

export interface ChatRepository {
  getOrCreateSession(lineUserId: string): Promise<string>;
  listRecentMessages(
    sessionId: string,
    limit: number,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]>;
  appendMessage(input: {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    retrievedChunkIds?: string[];
    model?: string;
    latencyMs?: number;
  }): Promise<void>;
  listSessions(): Promise<
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
  >;
}
