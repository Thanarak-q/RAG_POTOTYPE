import type { LlmProvider } from '@line-rag/llm-gateway';
import type { KnowledgeChunk } from '@line-rag/shared';
import { describe, expect, it, vi } from 'vitest';
import { answerQuestion } from '../src/services/rag';
import type {
  ChatRepository,
  KnowledgeRepository,
  VectorRepository,
} from '../src/repositories/types';

describe('answerQuestion', () => {
  it('retrieves matching chunks, builds a grounded prompt, and stores both chat messages', async () => {
    const chunk = fakeChunk();
    const chatRepository = fakeChatRepository();
    const knowledgeRepository = fakeKnowledgeRepository([chunk]);
    const vectorRepository = fakeVectorRepository([
      {
        id: chunk.pineconeId,
        score: 0.9,
        documentId: chunk.documentId,
        sourceType: chunk.sourceType,
        title: chunk.title,
      },
      {
        id: 'low-score',
        score: 0.1,
        documentId: 'doc-2',
        sourceType: 'faq',
        title: 'Ignored',
      },
    ]);
    const llm = fakeLlm();

    const result = await answerQuestion({
      request: { lineUserId: 'U123', message: 'refund?' },
      knowledgeRepository,
      chatRepository,
      vectorRepository,
      llm,
    });

    expect(vectorRepository.query).toHaveBeenCalledWith({
      embedding: [0.2, 0.3],
      topK: 5,
    });
    expect(llm.chat).toHaveBeenCalledWith({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          content: expect.stringContaining('Refunds take 7 days'),
        }),
      ]),
    });
    expect(chatRepository.appendMessage).toHaveBeenCalledTimes(2);
    expect(result.retrievedChunks).toEqual([{ ...chunk, score: 0.9 }]);
    expect(result.answer).toBe('Grounded answer');
  });

  it('passes source filters to vector search', async () => {
    const vectorRepository = fakeVectorRepository([]);

    await answerQuestion({
      request: { message: 'jobs?', sourceType: 'job_posting' },
      knowledgeRepository: fakeKnowledgeRepository([]),
      chatRepository: fakeChatRepository(),
      vectorRepository,
      llm: fakeLlm(),
    });

    expect(vectorRepository.query).toHaveBeenCalledWith({
      embedding: [0.2, 0.3],
      topK: 5,
      sourceType: 'job_posting',
    });
  });
});

function fakeChunk(): KnowledgeChunk {
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'Refunds take 7 days.',
    tokenCount: 5,
    pineconeId: 'doc-1:0',
    sourceType: 'faq',
    title: 'Refund FAQ',
  };
}

function fakeChatRepository(): ChatRepository {
  return {
    getOrCreateSession: vi.fn().mockResolvedValue('session-1'),
    listRecentMessages: vi
      .fn()
      .mockResolvedValue([{ role: 'user', content: 'hello' }]),
    appendMessage: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([]),
  };
}

function fakeKnowledgeRepository(
  chunks: KnowledgeChunk[],
): KnowledgeRepository {
  return {
    createPendingDocument: vi.fn(),
    markDocumentIndexed: vi.fn(),
    markDocumentFailed: vi.fn(),
    insertChunks: vi.fn(),
    findChunksByPineconeIds: vi.fn().mockResolvedValue(chunks),
    listDocuments: vi.fn(),
    deleteDocument: vi.fn(),
    health: vi.fn(),
  };
}

function fakeVectorRepository(
  matches: Awaited<ReturnType<VectorRepository['query']>>,
): VectorRepository {
  return {
    query: vi.fn().mockResolvedValue(matches),
    upsert: vi.fn(),
    delete: vi.fn(),
    health: vi.fn(),
  };
}

function fakeLlm(): LlmProvider {
  return {
    embed: vi.fn().mockResolvedValue([[0.2, 0.3]]),
    chat: vi.fn().mockResolvedValue({
      content: 'Grounded answer',
      model: 'test-model',
      latencyMs: 12,
    }),
  };
}
