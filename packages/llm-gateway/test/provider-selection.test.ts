import { describe, expect, it } from 'vitest';
import { createLlmProvider, OpenAiCompatProvider } from '../src/index';

describe('createLlmProvider', () => {
  it('creates the OpenAI provider without a base URL', () => {
    const provider = createLlmProvider({
      OPENAI_API_KEY: 'test-key',
      LLM_PROVIDER: 'openai',
      LLM_MODEL: 'gpt-4o-mini',
      LLM_BASE_URL: '',
    });

    expect(provider).toBeInstanceOf(OpenAiCompatProvider);
  });

  it('requires a base URL for OpenAI-compatible alternative providers', () => {
    expect(() =>
      createLlmProvider({
        OPENAI_API_KEY: 'test-key',
        LLM_PROVIDER: 'openrouter',
        LLM_MODEL: 'openai/gpt-4o-mini',
        LLM_BASE_URL: '',
      }),
    ).toThrow('LLM_BASE_URL is required');
  });

  it('accepts a base URL for compatible providers', () => {
    const provider = createLlmProvider({
      OPENAI_API_KEY: 'test-key',
      LLM_PROVIDER: 'groq',
      LLM_MODEL: 'llama-3.3-70b-versatile',
      LLM_BASE_URL: 'https://api.groq.com/openai/v1',
    });

    expect(provider).toBeInstanceOf(OpenAiCompatProvider);
  });
});
