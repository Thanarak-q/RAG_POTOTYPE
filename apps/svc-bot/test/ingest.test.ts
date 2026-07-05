import type { LlmProvider } from '@line-rag/llm-gateway';
import type { KnowledgeDocument } from '@line-rag/shared';
import { describe, expect, it, vi } from 'vitest';
import { ingestDocument } from '../src/services/ingest';
import type {
  KnowledgeRepository,
  VectorRepository,
} from '../src/repositories/types';

describe('ingestDocument', () => {
  it('chunks, embeds, upserts vectors, stores chunks, and marks the document indexed', async () => {
    const document = fakeDocument();
    const knowledgeRepository = fakeKnowledgeRepository(document);
    const vectorRepository = fakeVectorRepository();
    const llm = fakeLlm();

    const result = await ingestDocument({
      request: {
        title: document.title,
        sourceType: document.sourceType,
        rawText: 'One paragraph.\n\nSecond paragraph.',
      },
      knowledgeRepository,
      vectorRepository,
      llm,
    });

    expect(result).toEqual({ documentId: document.id, chunkCount: 1 });
    expect(llm.embed).toHaveBeenCalledWith([
      'One paragraph.\n\nSecond paragraph.',
    ]);
    expect(vectorRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'faq' }),
    );
    expect(knowledgeRepository.insertChunks).toHaveBeenCalledWith([
      expect.objectContaining({ documentId: 'doc-1', pineconeId: 'doc-1:0' }),
    ]);
    expect(knowledgeRepository.markDocumentIndexed).toHaveBeenCalledWith(
      'doc-1',
    );
  });

  it('marks the document failed when indexing throws', async () => {
    const document = fakeDocument();
    const knowledgeRepository = fakeKnowledgeRepository(document);
    const vectorRepository = fakeVectorRepository();
    vi.mocked(vectorRepository.upsert).mockRejectedValue(
      new Error('pinecone down'),
    );

    await expect(
      ingestDocument({
        request: {
          title: document.title,
          sourceType: document.sourceType,
          rawText: 'FAQ text',
        },
        knowledgeRepository,
        vectorRepository,
        llm: fakeLlm(),
      }),
    ).rejects.toThrow('pinecone down');

    expect(knowledgeRepository.markDocumentFailed).toHaveBeenCalledWith(
      'doc-1',
      'pinecone down',
    );
  });
});

function fakeDocument(): KnowledgeDocument {
  return {
    id: 'doc-1',
    title: 'FAQ',
    sourceType: 'faq',
    rawText: 'FAQ text',
    status: 'pending',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function fakeKnowledgeRepository(
  document: KnowledgeDocument,
): KnowledgeRepository {
  return {
    createPendingDocument: vi.fn().mockResolvedValue(document),
    markDocumentIndexed: vi.fn().mockResolvedValue(undefined),
    markDocumentFailed: vi.fn().mockResolvedValue(undefined),
    insertChunks: vi.fn().mockResolvedValue(undefined),
    findChunksByPineconeIds: vi.fn().mockResolvedValue([]),
    listDocuments: vi.fn().mockResolvedValue([]),
    deleteDocument: vi.fn().mockResolvedValue([]),
    health: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeVectorRepository(): VectorRepository {
  return {
    query: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    health: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeLlm(): LlmProvider {
  return {
    chat: vi
      .fn()
      .mockResolvedValue({ content: 'answer', model: 'test', latencyMs: 1 }),
    embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  };
}
