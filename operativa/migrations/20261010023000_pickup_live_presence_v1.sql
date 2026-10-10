-- Traslados: private, driver-consented live pickup presence.
-- No SELECT policy for clients. A privileged Edge function may read only after
-- validating an existing customer session and an atomic per-customer rate limit.
create table if not exists public.driver_live_presence (
  singleton_id smallint primary key default 1 check(singleton_id=1),
  device_id uuid not null references public.mapa_trayectos_devices(device_id),
  enabled boolean not null default false,
  shift_active boolean not null default false,
  shift_paused boolean not null default false,
  trip_active boolean not null default false,
  manually_busy boolean not null default false,
  lat double precision,
  lng double precision,
  accuracy_m real,
  gps_recorded_at timestamptz,
  last_moving_at timestamptz,
  received_at timestamptz,
  consented_at timestamptz,
  updated_at timestamptz not null default now(),
  check (lat is null or (lat between -35.3 and -30 and lng between -58.8 and -52.9)),
  check (accuracy_m is null or accuracy_m between 0 and 45)
);
alter table public.driver_live_presence enable row level security;
revoke all on public.driver_live_presence from public,anon,authenticated;
grant select,insert,update,delete on public.driver_live_presence to service_role;

create table if not exists public.driver_eta_customer_requests (
  request_id bigint generated always as identity primary key,
  customer_id uuid not null,
  requested_at timestamptz not null default now()
);
create index if not exists idx_driver_eta_request_customer_time
 on public.driver_eta_customer_requests(customer_id,requested_at desc);
alter table public.driver_eta_customer_requests enable row level security;
revoke all on public.driver_eta_customer_requests from public,anon,authenticated;
grant select,insert,delete on public.driver_eta_customer_requests to service_role;

create or replace function public.mapa_presence_consent_v1(
  p_device_id uuid,p_device_secret text,p_pin text,p_enabled boolean
) returns jsonb language plpgsql security definer
set search_path='public','pg_temp' as $$
begin
  if p_device_id is null or not exists (
    select 1 from public.mapa_trayectos_devices d
    where d.device_id=p_device_id and d.device_secret=p_device_secret
  ) then raise exception 'device authentication failed'; end if;
  if p_enabled and not public.driver_pin_valid(p_pin) then
    raise exception 'PIN incorrecto'; end if;
  if p_enabled then
    insert into public.driver_live_presence(singleton_id,device_id,enabled,consented_at)
    values(1,p_device_id,true,now())
    on conflict(singleton_id) do update set
      device_id=excluded.device_id,enabled=true,consented_at=now(),
      shift_active=false,shift_paused=false,trip_active=false,
      manually_busy=false,lat=null,lng=null,gps_recorded_at=null,
      last_moving_at=null,received_at=null,accuracy_m=null,updated_at=now();
  else
    update public.driver_live_presence set enabled=false,lat=null,lng=null,
       gps_recorded_at=null,received_at=null,last_moving_at=null,
       shift_active=false,updated_at=now()
    where singleton_id=1 and device_id=p_device_id;
  end if;
  return jsonb_build_object('ok',true,'enabled',p_enabled);
end;$$;
revoke all on function public.mapa_presence_consent_v1(uuid,text,text,boolean) from public;
grant execute on function public.mapa_presence_consent_v1(uuid,text,text,boolean) to anon,authenticated,service_role;

create or replace function public.mapa_presence_ping_v1(
 p_device_id uuid,p_device_secret text,
 p_shift_active boolean,p_shift_paused boolean,p_trip_active boolean,
 p_manually_busy boolean,p_lat double precision,p_lng double precision,
 p_accuracy_m real,p_gps_at_ms bigint,p_last_move_at_ms bigint
) returns jsonb language plpgsql security definer
set search_path='public','pg_temp' as $$
declare
  gps_time timestamptz;
  moving_time timestamptz;
  loc_ok boolean:=false;
begin
  if not exists(select 1 from public.driver_live_presence p
    join public.mapa_trayectos_devices d on d.device_id=p.device_id
    where p.singleton_id=1 and p.enabled and p.device_id=p_device_id
    and d.device_secret=p_device_secret) then
    return jsonb_build_object('ok',false,'reason','not_authorized');
  end if;
  if p_gps_at_ms is not null and p_gps_at_ms>0 then
    gps_time:=to_timestamp(p_gps_at_ms/1000.0);
  end if;
  if p_last_move_at_ms is not null and p_last_move_at_ms>0 then
    moving_time:=to_timestamp(p_last_move_at_ms/1000.0);
  end if;
  loc_ok:=coalesce(p_shift_active,false) and not coalesce(p_shift_paused,false)
    and not coalesce(p_trip_active,false) and not coalesce(p_manually_busy,false)
    and p_lat between -35.3 and -30 and p_lng between -58.8 and -52.9
    and p_accuracy_m between 0 and 45
    and gps_time between now()-interval '90 seconds' and now()+interval '10 seconds'
    and moving_time between now()-interval '5 minutes' and now()+interval '10 seconds';
  update public.driver_live_presence set
    shift_active=coalesce(p_shift_active,false),
    shift_paused=coalesce(p_shift_paused,false),
    trip_active=coalesce(p_trip_active,false),
    manually_busy=coalesce(p_manually_busy,false),
    lat=case when loc_ok then p_lat else null end,
    lng=case when loc_ok then p_lng else null end,
    accuracy_m=case when loc_ok then p_accuracy_m else null end,
    gps_recorded_at=case when loc_ok then gps_time else null end,
    last_moving_at=case when loc_ok then moving_time else null end,
    received_at=now(),updated_at=now()
  where singleton_id=1 and device_id=p_device_id;
  return jsonb_build_object('ok',true,'eligible',loc_ok);
end;$$;
revoke all on function public.mapa_presence_ping_v1(uuid,text,boolean,boolean,boolean,boolean,double precision,double precision,real,bigint,bigint) from public;
grant execute on function public.mapa_presence_ping_v1(uuid,text,boolean,boolean,boolean,boolean,double precision,double precision,real,bigint,bigint) to anon,authenticated,service_role;

-- Access ONLY by a server-side service-role Edge Function.
-- No anon client can request raw coordinates through this RPC.
create or replace function public.driver_pickup_eta_context_v1(
 p_session_token text,p_origin_lat double precision,p_origin_lng double precision
) returns jsonb language plpgsql volatile security definer
set search_path='public','pg_temp' as $$
declare
  cid uuid;
  p public.driver_live_presence%rowtype;
  stamp timestamp;
begin
  if p_origin_lat is null or p_origin_lng is null
     or p_origin_lat not between -35.3 and -30
     or p_origin_lng not between -58.8 and -52.9 then
    return jsonb_build_object('available',false,'reason','invalid_origin');
  end if;
  cid:=public.availability_session_customer(p_session_token);
  if cid is null then return jsonb_build_object('available',false,'reason','login_required'); end if;
  -- Serialize rate-limit checks for this customer even with concurrent requests.
  perform pg_advisory_xact_lock(hashtext(cid::text));
  if (select count(*) from public.driver_eta_customer_requests
        where customer_id=cid and requested_at>now()-interval '1 hour')>=20
     or (select count(*) from public.driver_eta_customer_requests
        where customer_id=cid and requested_at>now()-interval '1 minute')>=3 then
    return jsonb_build_object('available',false,'reason','rate_limited');
  end if;
  insert into public.driver_eta_customer_requests(customer_id) values(cid);
  select * into p from public.driver_live_presence where singleton_id=1;
  if not found or not p.enabled or not p.shift_active or p.shift_paused
     or p.trip_active or p.manually_busy or p.lat is null or p.lng is null
     or p.received_at<now()-interval '90 seconds'
     or p.gps_recorded_at<now()-interval '90 seconds'
     or p.last_moving_at<now()-interval '5 minutes'
     or p.accuracy_m>45 then
    return jsonb_build_object('available',false,'reason','not_available');
  end if;
  stamp := (now() at time zone 'America/Montevideo')::timestamp;
  if public.availability_has_conflict(stamp::date,stamp::time,60,null,true) then
    return jsonb_build_object('available',false,'reason','schedule_conflict');
  end if;
  return jsonb_build_object('available',true,
    'driverLat',p.lat,'driverLng',p.lng,
    'locationAgeSec',greatest(0,floor(extract(epoch from(now()-p.gps_recorded_at)))::integer));
end;$$;
revoke all on function public.driver_pickup_eta_context_v1(text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.driver_pickup_eta_context_v1(text,double precision,double precision) to service_role;
comment on function public.driver_pickup_eta_context_v1(text,double precision,double precision)
 is 'Private to service-role Edge Function; NEVER expose coordinates to passenger clients.';
