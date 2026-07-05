import { llmEnvSchema } from '@line-rag/llm-gateway';
import { z } from 'zod';

export const svcBotEnvSchema = llmEnvSchema.extend({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PINECONE_API_KEY: z.string().min(1),
  PINECONE_INDEX: z.string().min(1).default('salesbot-kb'),
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  CREDENTIALS_ENC_KEY: z.string().length(32).optional(),
  UPSTASH_REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().min(1).optional(),
  INTERNAL_API_KEY: z.string().min(24),
  PLATFORM_SERVICE_KEY: z.string().min(24).optional(),
});

export type SvcBotEnv = z.infer<typeof svcBotEnvSchema>;

export function getEnv(source: NodeJS.ProcessEnv = process.env): SvcBotEnv {
  const parsed = svcBotEnvSchema.safeParse(source);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid svc-bot environment: ${message}`);
  }
  return parsed.data;
}
