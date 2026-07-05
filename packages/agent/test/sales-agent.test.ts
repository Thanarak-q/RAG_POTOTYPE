import type { ChatResponse, LlmProvider } from '@line-rag/llm-gateway';
import type { KnowledgeChunk, ProductRecord } from '@line-rag/shared';
import { describe, expect, it, vi } from 'vitest';
import { runSalesAgent } from '../src/index';
import type { SalesAgentTools } from '../src/types';

describe('runSalesAgent', () => {
  it('answers price questions from the tenant-scoped product table, not retrieved chunks', async () => {
    const tools = fakeTools({
      products: [
        product({
          tenantId: 'tenant-a',
          name: 'Golden Retriever',
          price: 25000,
          currency: 'THB',
        }),
      ],
      chunks: [
        chunk({
          tenantId: 'tenant-a',
          content: 'Golden Retriever is friendly. Price: 999999 THB.',
        }),
      ],
    });

    const result = await runSalesAgent({
      tenantId: 'tenant-a',
      lineUserId: 'U1',
      message: 'How much is golden retriever?',
      tools,
      llm: fakeLlm('The Golden Retriever is 25000 THB.'),
    });

    expect(result.intent).toBe('price_or_stock');
    expect(result.reply).toContain('25000 THB');
    expect(result.reply).not.toContain('999999');
    expect(tools.findProducts).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      query: 'How much is golden retriever?',
      limit: 3,
    });
  });

  it('keeps tenant retrieval isolated by passing tenantId into every tool call', async () => {
    const tools = fakeTools({
      products: [],
      chunks: [
        chunk({
          tenantId: 'tenant-a',
          content: 'Golden Retriever is good with kids.',
        }),
      ],
    });

    await runSalesAgent({
      tenantId: 'tenant-a',
      lineUserId: 'U1',
      message: 'Is golden retriever good with kids?',
      tools,
      llm: fakeLlm('Yes, based on the shop info.'),
    });

    expect(tools.retrieveChunks).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      query: 'Is golden retriever good with kids?',
      topK: 5,
    });
  });

  it('creates a lead for buying intent', async () => {
    const tools = fakeTools({
      products: [product({ tenantId: 'tenant-a', name: 'Poodle' })],
      chunks: [],
    });

    const result = await runSalesAgent({
      tenantId: 'tenant-a',
      lineUserId: 'U1',
      message: 'I want to buy poodle',
      tools,
      llm: fakeLlm(''),
    });

    expect(result.intent).toBe('buying_intent');
    expect(result.reply).toContain('connect you with the shop');
    expect(tools.createLead).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        lineUserId: 'U1',
        customerNote: 'I want to buy poodle',
      }),
    );
  });

  it('falls back honestly when product lookup has no matches', async () => {
    const result = await runSalesAgent({
      tenantId: 'tenant-a',
      lineUserId: 'U1',
      message: 'price of unicorn',
      tools: fakeTools({ products: [], chunks: [] }),
      llm: fakeLlm(''),
    });

    expect(result.intent).toBe('price_or_stock');
    expect(result.reply).toContain("couldn't find");
  });

  it('falls back honestly when RAG has no matching chunks', async () => {
    const result = await runSalesAgent({
      tenantId: 'tenant-a',
      lineUserId: 'U1',
      message: 'shipping policy',
      tools: fakeTools({ products: [], chunks: [] }),
      llm: fakeLlm(''),
    });

    expect(result.intent).toBe('general_faq');
    expect(result.reply).toContain("don't know");
  });

  it('handles smalltalk without tool calls', async () => {
    const tools = fakeTools({ products: [], chunks: [] });

    const result = await runSalesAgent({
      tenantId: 'tenant-a',
      lineUserId: 'U1',
      message: 'hello',
      tools,
      llm: fakeLlm(''),
    });

    expect(result.intent).toBe('smalltalk');
    expect(result.reply).toContain('Ask me about products');
    expect(tools.findProducts).not.toHaveBeenCalled();
  });
});

function fakeLlm(content: string): LlmProvider {
  return {
    chat: vi.fn().mockResolvedValue({
      content,
      model: 'test-model',
      latencyMs: 1,
    } satisfies ChatResponse),
    embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
  };
}

function fakeTools(input: {
  products: ProductRecord[];
  chunks: KnowledgeChunk[];
}): SalesAgentTools {
  return {
    findProducts: vi.fn().mockResolvedValue(input.products),
    retrieveChunks: vi.fn().mockResolvedValue(input.chunks),
    createLead: vi.fn().mockResolvedValue({ id: 'lead-1' }),
    persistTurn: vi.fn().mockResolvedValue(undefined),
  };
}

function product(overrides: Partial<ProductRecord>): ProductRecord {
  return {
    id: 'product-1',
    tenantId: 'tenant-a',
    sku: 'SKU-1',
    name: 'Golden Retriever',
    category: 'Dogs',
    price: 25000,
    currency: 'THB',
    stock: 2,
    attributes: {},
    description: 'Friendly dog',
    source: 'excel',
    active: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function chunk(overrides: Partial<KnowledgeChunk>): KnowledgeChunk {
  return {
    id: 'chunk-1',
    tenantId: 'tenant-a',
    documentId: 'doc-1',
    productId: 'product-1',
    chunkIndex: 0,
    content: 'Golden Retriever is friendly.',
    tokenCount: 10,
    pineconeId: 'tenant-a:product-1',
    sourceType: 'product_row',
    title: 'Golden Retriever',
    score: 0.9,
    ...overrides,
  };
}
