import { beforeEach, describe, expect, it, vi } from 'vitest';

const createChatCompletion = vi.fn();
const createEmbedding = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: createChatCompletion,
      },
    };

    embeddings = {
      create: createEmbedding,
    };
  },
}));

describe('OpenAiCompatProvider', () => {
  beforeEach(() => {
    createChatCompletion.mockReset();
    createEmbedding.mockReset();
  });

  it('returns chat content, model, and latency metadata', async () => {
    createChatCompletion.mockResolvedValue({
      model: 'gpt-test',
      choices: [{ message: { content: '  hello  ' } }],
    });
    const { OpenAiCompatProvider } = await import('../src/index');
    const provider = new OpenAiCompatProvider({
      apiKey: 'key',
      model: 'gpt-test',
      timeoutMs: 100,
    });

    const response = await provider.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(createChatCompletion).toHaveBeenCalledWith({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      max_tokens: 900,
    });
    expect(response.content).toBe('hello');
    expect(response.model).toBe('gpt-test');
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('falls back when chat content is empty', async () => {
    createChatCompletion.mockResolvedValue({
      model: '',
      choices: [{ message: { content: '' } }],
    });
    const { OpenAiCompatProvider } = await import('../src/index');
    const provider = new OpenAiCompatProvider({
      apiKey: 'key',
      model: 'fallback-model',
    });

    await expect(provider.chat({ messages: [] })).resolves.toMatchObject({
      content: "I don't know.",
      model: 'fallback-model',
    });
  });

  it('embeds text batches and skips empty batches', async () => {
    createEmbedding.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
    });
    const { OpenAiCompatProvider } = await import('../src/index');
    const provider = new OpenAiCompatProvider({
      apiKey: 'key',
      model: 'gpt-test',
    });

    await expect(provider.embed([])).resolves.toEqual([]);
    await expect(provider.embed(['one', 'two'])).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(createEmbedding).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['one', 'two'],
    });
  });
});
