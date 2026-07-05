import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const sourceType = pgEnum('source_type', ['job_posting', 'faq', 'help']);
export const documentStatus = pgEnum('document_status', [
  'pending',
  'indexed',
  'failed',
]);
export const chatRole = pgEnum('chat_role', ['user', 'assistant']);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  sourceType: sourceType('source_type').notNull(),
  rawText: text('raw_text').notNull(),
  status: documentStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull(),
    pineconeId: text('pinecone_id').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    documentIndex: index('chunks_document_id_idx').on(table.documentId),
  }),
);

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  lineUserId: text('line_user_id').notNull().unique(),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: chatRole('role').notNull(),
    content: text('content').notNull(),
    retrievedChunkIds: jsonb('retrieved_chunk_ids').notNull().default([]),
    model: text('model'),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sessionIndex: index('chat_messages_session_id_idx').on(table.sessionId),
  }),
);
