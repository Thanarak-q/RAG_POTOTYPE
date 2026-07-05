import OpenAI from 'openai';
import { z } from 'zod';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  latencyMs: number;
}

export interface LlmProvider {
  chat(req: ChatRequest): Promise<ChatResponse>;
  embed(texts: string[]): Promise<number[][]>;
}

export const llmEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  LLM_PROVIDER: z.string().default('openai'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_BASE_URL: z.string().url().optional().or(z.literal('')),
});

export type LlmEnv = z.infer<typeof llmEnvSchema>;

export class OpenAiCompatProvider implements LlmProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(options: {
    apiKey: string;
    model: string;
    baseURL?: string;
    embeddingModel?: string;
    timeoutMs?: number;
  }) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL || undefined,
      timeout: options.timeoutMs ?? 25_000,
      maxRetries: 1,
    });
    this.model = options.model;
    this.embeddingModel = options.embeddingModel ?? 'text-embedding-3-small';
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 900,
    });
    return {
      content: response.choices[0]?.message.content?.trim() || "I don't know.",
      model: response.model || this.model,
      latencyMs: Date.now() - startedAt,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  }
}

export function createLlmProvider(env: LlmEnv): LlmProvider {
  const provider = env.LLM_PROVIDER.toLowerCase();
  if (provider === 'openai') {
    return new OpenAiCompatProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL,
    });
  }

  if (!env.LLM_BASE_URL) {
    throw new Error(`LLM_BASE_URL is required for provider "${provider}"`);
  }

  return new OpenAiCompatProvider({
    apiKey: env.OPENAI_API_KEY,
    model: env.LLM_MODEL,
    baseURL: env.LLM_BASE_URL,
  });
}
