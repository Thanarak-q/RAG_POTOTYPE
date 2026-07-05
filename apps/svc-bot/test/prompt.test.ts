import { describe, expect, it } from 'vitest';
import { buildRagMessages } from '../src/services/prompt';

describe('buildRagMessages', () => {
  it('delimits context and warns that retrieved instructions are untrusted', () => {
    const messages = buildRagMessages({
      question: 'What is the refund policy?',
      history: [{ role: 'user', content: 'hello' }],
      chunks: [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          chunkIndex: 0,
          content: 'Refunds are reviewed within 7 days.',
          tokenCount: 8,
          pineconeId: 'doc-1:0',
          sourceType: 'faq',
          title: 'Refund FAQ',
        },
      ],
    });

    expect(messages[0]?.content).toContain('untrusted data');
    expect(messages[1]?.content).toContain('chunk_id="chunk-1"');
    expect(messages[1]?.content).toContain('What is the refund policy?');
  });
});
