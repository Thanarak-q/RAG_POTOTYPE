import { z } from 'zod';

export const sourceTypeSchema = z.enum([
  'job_posting',
  'faq',
  'help',
  'product_row',
  'policy',
  'description',
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const documentStatusSchema = z.enum(['pending', 'indexed', 'failed']);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const roleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof roleSchema>;

export const ingestRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sourceType: sourceTypeSchema,
  rawText: z.string().trim().min(1).max(200_000),
});
export type IngestRequest = z.infer<typeof ingestRequestSchema>;

export const chatRequestSchema = z.object({
  lineUserId: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(5000),
  sourceType: sourceTypeSchema.optional(),
});
export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

export const apiEnvelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    data: data.optional(),
    error: z.string().optional(),
  });

export type ApiEnvelope<T> =
  { success: true; data: T } | { success: false; error: string };

export interface KnowledgeDocument {
  id: string;
  tenantId?: string;
  title: string;
  sourceType: SourceType;
  rawText: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  tenantId?: string;
  documentId: string;
  productId?: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pineconeId: string;
  sourceType: SourceType;
  title: string;
  score?: number;
}

export const tenantPlanSchema = z.enum(['trial', 'starter', 'pro']);
export type TenantPlan = z.infer<typeof tenantPlanSchema>;

export const tenantStatusSchema = z.enum(['active', 'suspended']);
export type TenantStatus = z.infer<typeof tenantStatusSchema>;

export const adminRoleSchema = z.enum(['super_admin', 'tenant_admin']);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const productSourceSchema = z.enum(['excel', 'manual', 'sync']);
export type ProductSource = z.infer<typeof productSourceSchema>;

export const salesIntentSchema = z.enum([
  'price_or_stock',
  'product_info',
  'general_faq',
  'buying_intent',
  'smalltalk',
]);
export type SalesIntent = z.infer<typeof salesIntentSchema>;

export const tenantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(120),
  plan: tenantPlanSchema,
  status: tenantStatusSchema,
});
export type TenantRecord = z.infer<typeof tenantSchema>;

export const productRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  sku: z.string().min(1).nullable(),
  name: z.string().min(1),
  category: z.string().nullable(),
  price: z.number().nonnegative(),
  currency: z.string().min(1).default('THB'),
  stock: z.number().int().nullable(),
  attributes: z.record(z.unknown()),
  description: z.string(),
  source: productSourceSchema,
  active: z.boolean(),
  updatedAt: z.string(),
});
export type ProductRecord = z.infer<typeof productRecordSchema>;

export const productUpsertSchema = z.object({
  tenantId: z.string().min(1),
  sku: z.string().trim().min(1).nullable(),
  name: z.string().trim().min(1),
  category: z.string().trim().nullable(),
  price: z.number().nonnegative(),
  currency: z.string().trim().min(1).default('THB'),
  stock: z.number().int().nullable(),
  attributes: z.record(z.unknown()).default({}),
  description: z.string().default(''),
  source: productSourceSchema.default('excel'),
  sourceFileId: z.string().min(1).nullable().optional(),
});
export type ProductUpsert = z.infer<typeof productUpsertSchema>;

export const tenantChatRequestSchema = z.object({
  tenantId: z.string().trim().min(1).max(120),
  lineUserId: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(5000),
});
export type TenantChatRequest = z.infer<typeof tenantChatRequestSchema>;

export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(120),
  plan: tenantPlanSchema.default('trial'),
  lineChannelSecret: z.string().min(1),
  lineChannelAccessToken: z.string().min(1),
});
export type CreateTenantRequest = z.infer<typeof createTenantSchema>;

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  retrievedChunkIds: string[];
  model?: string;
  latencyMs?: number;
  createdAt: string;
}
