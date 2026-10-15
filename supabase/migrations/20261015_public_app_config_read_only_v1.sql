-- Public configuration snapshot for all Traslados clients, deployed 2026-10-14 UYT.
-- Applied to Supabase project zetaudvvutlouiqxopvg as migration
-- public_app_config_read_only_v1. Idempotent source mirror for recovery.
-- Only publish non-sensitive URLs and release hashes.
create schema if not exists app_internal;
revoke all on schema app_internal from public;

create table if not exists app_internal.public_config (
  singleton_id smallint primary key default 1 check (singleton_id=1),
  revision integer not null check (revision>0),
  payload jsonb not null,
  published_at timestamptz not null default now(),
  constraint valid_config_payload check (
    jsonb_typeof(payload)='object'
    and jsonb_typeof(payload->'links')='object'
    and jsonb_typeof(payload->'releases')='object'
  )
);
revoke all on app_internal.public_config from public, anon, authenticated;
alter table app_internal.public_config enable row level security;

insert into app_internal.public_config (singleton_id,revision,payload)
values (1,1,$config$ {
  "links": {
    "booking_url":"https://marcelofgx-ctrl.github.io/traslados-android/web-pasajero/",
    "client_apk_url":"https://marcelofgx-ctrl.github.io/traslados-android/web-pasajero/downloads/traslados-cliente-premium-v16.apk"
  },
  "releases": {
    "cliente":{"version":"16","sha256":"9ab8b822bf8e27ef8c95ea7b348cc4c2771f1594b7e3ba46ce5c1c246fa29e8b"},
    "mapa":{"version":"R25.23","sha256":"390a25bfbe20c4157f2c3a2bd7dc304e72518e6c2a19785ab74760ba6ec39039"}
  }
} $config$::jsonb)
on conflict (singleton_id) do nothing;

create or replace function public.public_app_config_v1()
returns jsonb language sql stable security definer set search_path=''
as $fn$
  select pg_catalog.jsonb_build_object(
    'schema_version',1,
    'revision', c.revision,
    'published_at', c.published_at,
    'links', c.payload -> 'links',
    'releases', c.payload -> 'releases'
  ) from app_internal.public_config as c where c.singleton_id=1
$fn$;
revoke all on function public.public_app_config_v1() from public;
grant execute on function public.public_app_config_v1() to anon, authenticated;
comment on function public.public_app_config_v1() is
  'Read-only published links and release metadata; no driver info, GPS, sessions or credentials.';
