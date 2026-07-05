import type { IngestRequest, KnowledgeChunk } from '@line-rag/shared';
import type { LlmProvider } from '@line-rag/llm-gateway';
import { randomUUID } from 'node:crypto';
import { chunkText } from './chunker';
import type {
  KnowledgeRepository,
  VectorRepository,
} from '@/repositories/types';

export async function ingestDocument(params: {
  request: IngestRequest;
  knowledgeRepository: KnowledgeRepository;
  vectorRepository: VectorRepository;
  llm: LlmProvider;
}): Promise<{ documentId: string; chunkCount: number }> {
  const document = await params.knowledgeRepository.createPendingDocument({
    title: params.request.title,
    sourceType: params.request.sourceType,
    rawText: params.request.rawText,
  });

  try {
    const chunks = chunkText(params.request.rawText);
    const embeddings = await params.llm.embed(
      chunks.map((chunk) => chunk.content),
    );
    const records: Omit<KnowledgeChunk, 'score'>[] = chunks.map(
      (chunk, index) => {
        const chunkId = randomUUID();
        return {
          id: chunkId,
          documentId: document.id,
          chunkIndex: index,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          pineconeId: `${document.id}:${index}`,
          sourceType: document.sourceType,
          title: document.title,
        };
      },
    );

    await params.vectorRepository.upsert({
      namespace: document.sourceType,
      vectors: records.map((record, index) => ({
        id: record.pineconeId,
        values: embeddings[index] ?? [],
        metadata: {
          documentId: document.id,
          sourceType: document.sourceType,
          title: document.title,
        },
      })),
    });
    await params.knowledgeRepository.insertChunks(records);
    await params.knowledgeRepository.markDocumentIndexed(document.id);
    return { documentId: document.id, chunkCount: records.length };
  } catch (error) {
    await params.knowledgeRepository.markDocumentFailed(
      document.id,
      error instanceof Error ? error.message : 'unknown error',
    );
    throw error;
  }
}
