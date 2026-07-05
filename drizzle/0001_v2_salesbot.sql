create type tenant_plan as enum ('trial', 'starter', 'pro');
create type tenant_status as enum ('active', 'suspended');
create type admin_role as enum ('super_admin', 'tenant_admin');
create type product_source as enum ('excel', 'manual', 'sync');
create type source_file_kind as enum ('xlsx', 'csv', 'txt', 'md');
create type source_file_status as enum ('pending', 'processed', 'failed');
create type lead_status as enum ('new', 'contacted', 'closed');

alter type source_type add value if not exists 'product_row';
alter type source_type add value if not exists 'policy';
alter type source_type add value if not exists 'description';

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan tenant_plan not null default 'trial',
  status tenant_status not null default 'active',
  line_channel_secret_enc text,
  line_channel_token_enc text,
  created_at timestamptz not null default now()
);

create table admin_users (
  id uuid primary key,
  email text not null unique,
  role admin_role not null,
  tenant_id uuid references tenants(id) on delete cascade
);

create table source_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  kind source_file_kind not null,
  column_mapping jsonb not null default '{}'::jsonb,
  status source_file_status not null default 'pending',
  row_count integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku text,
  name text not null,
  category text,
  price numeric not null check (price >= 0),
  currency text not null default 'THB',
  stock integer,
  attributes jsonb not null default '{}'::jsonb,
  description text not null default '',
  source product_source not null default 'excel',
  source_file_id uuid references source_files(id) on delete set null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

alter table documents add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table chunks add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table chunks add column if not exists product_id uuid references products(id) on delete set null;
alter table chat_sessions add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table chat_messages add column if not exists intent text;
alter table chat_messages add column if not exists tool_calls jsonb not null default '[]'::jsonb;
alter table chat_messages add column if not exists prompt_tokens integer;
alter table chat_messages add column if not exists completion_tokens integer;

create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  session_id uuid references chat_sessions(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  customer_note text not null,
  status lead_status not null default 'new',
  created_at timestamptz not null default now()
);

create table usage_daily (
  tenant_id uuid not null references tenants(id) on delete cascade,
  date date not null,
  messages integer not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  est_cost_usd numeric not null default 0,
  primary key (tenant_id, date)
);

create index products_tenant_name_idx on products(tenant_id, name);
create index chunks_tenant_id_idx on chunks(tenant_id);
create index leads_tenant_id_idx on leads(tenant_id);
