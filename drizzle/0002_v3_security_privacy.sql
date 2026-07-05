create type deletion_request_status as enum ('new', 'processing', 'completed', 'failed');

alter table admin_users add column if not exists mfa_enrolled boolean not null default false;
alter table admin_users add column if not exists last_login_at timestamptz;

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role admin_role,
  tenant_id uuid references tenants(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  line_user_id text not null,
  policy_version text not null,
  consented_at timestamptz not null default now(),
  unique (tenant_id, line_user_id, policy_version)
);

create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  line_user_id text not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  status deletion_request_status not null default 'new'
);

create table retention_policies (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  chat_retention_days integer not null default 90 check (chat_retention_days >= 1),
  lead_retention_days integer not null default 365 check (lead_retention_days >= 1)
);

create index audit_logs_created_at_idx on audit_logs(created_at);
create index audit_logs_tenant_id_idx on audit_logs(tenant_id);
create index consents_tenant_line_user_idx on consents(tenant_id, line_user_id);
create index deletion_requests_tenant_line_user_idx on deletion_requests(tenant_id, line_user_id);
