-- Traslados · memoria operativa interna v1 (18/10/2026)
-- NO TOCA datos de reservas, usuarios, recorridos, GPS ni configuración del producto.
-- Esquema privado: NO exponer en PostgREST, PWA ni APK.
create schema if not exists project_ops;
revoke all on schema project_ops from public, anon, authenticated, service_role;

create table project_ops.work_memory (
  memory_key text primary key
    check (memory_key ~ '^[a-z][a-z0-9:._-]{2,95}$'),
  category text not null
    check (category in ('principle','decision','regression','component','dependency','handoff')),
  title text not null check (length(title) between 1 and 160),
  status text not null
    check (status in ('active','open','in_qa','blocked','implemented','resolved','superseded','historical','unknown')),
  priority smallint check (priority is null or priority between 0 and 3),
  summary text not null check (length(summary) between 1 and 3000),
  next_action text check (next_action is null or length(next_action) <= 1500),
  source_repo text,
  source_ref text,
  source_url text check (source_url is null or source_url like 'https://%'),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details)='object'),
  verified_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index work_memory_status_priority_idx
  on project_ops.work_memory (status,priority,updated_at desc);
create index work_memory_category_updated_idx
  on project_ops.work_memory (category,updated_at desc);

create table project_ops.work_memory_events (
  event_id bigint generated always as identity primary key,
  memory_key text not null references project_ops.work_memory(memory_key) on delete restrict,
  operation text not null check (operation in ('INSERT','UPDATE')),
  before_value jsonb,
  after_value jsonb not null,
  actor_db_role text not null default current_user,
  recorded_at timestamptz not null default now()
);
create index work_memory_events_key_idx
  on project_ops.work_memory_events(memory_key,event_id desc);

create function project_ops.work_memory_before_change()
returns trigger language plpgsql set search_path = pg_catalog, project_ops
as $$
begin
  if tg_op='UPDATE' then
    if new.memory_key is distinct from old.memory_key then
      raise exception 'memory_key is immutable';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
    new.updated_at := clock_timestamp();
  else
    new.revision := 1;
    new.created_at := clock_timestamp();
    new.updated_at := new.created_at;
  end if;
  return new;
end; $$;

create function project_ops.work_memory_audit()
returns trigger language plpgsql set search_path = pg_catalog, project_ops
as $$
begin
  insert into project_ops.work_memory_events(memory_key,operation,before_value,after_value)
  values(new.memory_key,tg_op,
         case when tg_op='INSERT' then null else to_jsonb(old) end,
         to_jsonb(new));
  return null;
end; $$;

create function project_ops.work_memory_block_delete()
returns trigger language plpgsql set search_path = pg_catalog, project_ops
as $$
begin
  raise exception 'operational memory is append-only: change status to superseded/historical instead';
end; $$;

create trigger work_memory_prepare
  before insert or update on project_ops.work_memory
  for each row execute function project_ops.work_memory_before_change();
create trigger work_memory_history
  after insert or update on project_ops.work_memory
  for each row execute function project_ops.work_memory_audit();
create trigger work_memory_no_delete
  before delete on project_ops.work_memory
  for each row execute function project_ops.work_memory_block_delete();
create trigger work_memory_events_immutable
  before update or delete on project_ops.work_memory_events
  for each row execute function project_ops.work_memory_block_delete();

alter table project_ops.work_memory enable row level security;
alter table project_ops.work_memory_events enable row level security;
-- Sin políticas públicas. Solo conexiones administrativas confiables ejecutan SQL.
revoke all on all tables in schema project_ops from public, anon, authenticated, service_role;
revoke all on all sequences in schema project_ops from public, anon, authenticated, service_role;
revoke execute on all functions in schema project_ops from public, anon, authenticated, service_role;
alter default privileges in schema project_ops
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema project_ops
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema project_ops
  revoke execute on functions from public, anon, authenticated, service_role;
