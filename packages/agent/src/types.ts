import type {
  KnowledgeChunk,
  ProductRecord,
  SalesIntent,
} from '@line-rag/shared';

export interface SalesAgentInput {
  tenantId: string;
  lineUserId: string;
  message: string;
  tools: SalesAgentTools;
  llm: {
    chat(req: {
      messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
      temperature?: number;
      maxTokens?: number;
    }): Promise<{ content: string; model: string; latencyMs: number }>;
  };
}

export interface SalesAgentResult {
  intent: SalesIntent;
  reply: string;
  productHits: ProductRecord[];
  retrievedChunks: KnowledgeChunk[];
  toolCalls: { name: string; args: Record<string, unknown> }[];
  model?: string;
  latencyMs?: number;
}

export interface SalesAgentTools {
  findProducts(input: {
    tenantId: string;
    query: string;
    limit: number;
  }): Promise<ProductRecord[]>;
  retrieveChunks(input: {
    tenantId: string;
    query: string;
    topK: number;
  }): Promise<KnowledgeChunk[]>;
  createLead(input: {
    tenantId: string;
    lineUserId: string;
    productId?: string;
    customerNote: string;
  }): Promise<{ id: string }>;
  persistTurn(input: {
    tenantId: string;
    lineUserId: string;
    message: string;
    reply: string;
    intent: SalesIntent;
    retrievedChunkIds: string[];
    toolCalls: { name: string; args: Record<string, unknown> }[];
    model?: string;
    latencyMs?: number;
  }): Promise<void>;
}
