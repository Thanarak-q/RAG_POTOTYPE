import { Pinecone } from '@pinecone-database/pinecone';
import type { VectorMatch, VectorRepository } from './types';

export class PineconeVectorRepository implements VectorRepository {
  private readonly index;

  constructor(options: { apiKey: string; indexName: string }) {
    const pinecone = new Pinecone({ apiKey: options.apiKey });
    this.index = pinecone.index(options.indexName);
  }

  async query(
    params: Parameters<VectorRepository['query']>[0],
  ): Promise<VectorMatch[]> {
    const query = {
      vector: params.embedding,
      topK: params.topK,
      includeMetadata: true,
      ...(params.sourceType
        ? { filter: { sourceType: { $eq: params.sourceType } } }
        : {}),
    };
    const response = await this.index.query(query);

    return (response.matches ?? []).map((match) => ({
      id: match.id,
      score: match.score ?? 0,
      documentId: String(match.metadata?.documentId ?? ''),
      sourceType: match.metadata?.sourceType as VectorMatch['sourceType'],
      title: String(match.metadata?.title ?? ''),
    }));
  }

  async upsert(
    params: Parameters<VectorRepository['upsert']>[0],
  ): Promise<void> {
    await this.index.namespace(params.namespace).upsert(
      params.vectors.map((vector) => ({
        id: vector.id,
        values: vector.values,
        metadata: {
          documentId: vector.metadata.documentId,
          sourceType: vector.metadata.sourceType,
          title: vector.metadata.title,
        },
      })),
    );
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.index.deleteMany(ids);
  }

  async health(): Promise<void> {
    await this.index.describeIndexStats();
  }
}
