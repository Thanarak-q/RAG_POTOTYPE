create type source_type as enum ('job_posting', 'faq', 'help');
create type document_status as enum ('pending', 'indexed', 'failed');
create type chat_role as enum ('user', 'assistant');

create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type source_type not null,
  raw_text text not null,
  status document_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null,
  pinecone_id text not null unique,
  created_at timestamptz not null default now()
);

create index chunks_document_id_idx on chunks(document_id);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role chat_role not null,
  content text not null,
  retrieved_chunk_ids jsonb not null default '[]'::jsonb,
  model text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index chat_messages_session_id_idx on chat_messages(session_id);
