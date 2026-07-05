import { z } from 'zod';

export const webAdminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SVC_BOT_URL: z.string().url(),
  INTERNAL_API_KEY: z.string().min(24),
  ADMIN_PASSWORD: z.string().min(12),
});

export type WebAdminEnv = z.infer<typeof webAdminEnvSchema>;

export function getEnv(source: NodeJS.ProcessEnv = process.env): WebAdminEnv {
  const parsed = webAdminEnvSchema.safeParse(source);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid web-admin environment: ${message}`);
  }
  return parsed.data;
}
