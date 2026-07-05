import { createLlmProvider } from '@line-rag/llm-gateway';
import { getEnv } from '@/env/server';
import { LineMessagingClient } from '@/line/client';
import {
  NeonChatRepository,
  NeonKnowledgeRepository,
} from '@/repositories/neon';
import { PineconeVectorRepository } from '@/repositories/pinecone';

export function createRuntime() {
  const env = getEnv();
  return {
    env,
    llm: createLlmProvider(env),
    lineClient: new LineMessagingClient(env.LINE_CHANNEL_ACCESS_TOKEN),
    knowledgeRepository: new NeonKnowledgeRepository(env.DATABASE_URL),
    chatRepository: new NeonChatRepository(env.DATABASE_URL),
    vectorRepository: new PineconeVectorRepository({
      apiKey: env.PINECONE_API_KEY,
      indexName: env.PINECONE_INDEX,
    }),
  };
}
