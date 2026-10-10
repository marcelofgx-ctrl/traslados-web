-- Traslados: anonymous pickup estimates without disclosing exact driver GPS.
-- The customer can see broad road-distance/ETA after selecting an origin, with
-- no login. This is deliberately COARSE; precise ETA remains session-protected.
-- Coordinates and rate-limit records are accessible to service_role only.
create table if not exists public.driver_eta_public_requests(
 request_id bigint generated always as identity primary key,
 visitor_hash text not null,
 origin_cell text not null,
 requested_at timestamptz not null default now(),
 check(length(visitor_hash)=64)
);
create index if not exists driver_eta_public_vis_t
 on public.driver_eta_public_requests(visitor_hash,requested_at desc);
create index if not exists driver_eta_public_t
 on public.driver_eta_public_requests(requested_at desc);
alter table public.driver_eta_public_requests enable row level security;
revoke all on public.driver_eta_public_requests from public,anon,authenticated;
grant select,insert,delete on public.driver_eta_public_requests to service_role;
grant usage,select on sequence public.driver_eta_public_requests_request_id_seq to service_role;

create or replace function public.driver_pickup_public_context_v1(
  p_visitor_hash text,p_origin_lat double precision,p_origin_lng double precision
) returns jsonb
language plpgsql volatile security definer
set search_path='public','pg_temp' as $func$
declare
  p public.driver_live_presence%rowtype;
  cell text;
  now_local timestamp;
  prior_cells integer;
begin
  if p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('available',false,'reason','invalid_request');
  end if;
  if p_origin_lat is null or p_origin_lng is null
     or not p_origin_lat between -35.3 and -30
     or not p_origin_lng between -58.8 and -52.9 then
    return jsonb_build_object('available',false,'reason','invalid_origin');
  end if;
  select * into p from public.driver_live_presence
    where singleton_id=1 and enabled and shift_active
      and not shift_paused and not trip_active and not manually_busy
      and lat is not null and lng is not null
      and accuracy_m <=45
      and received_at >= now()-interval '90 seconds'
      and gps_recorded_at between now()-interval '90 seconds' and now()+interval '10 seconds'
      and last_moving_at between now()-interval '5 minutes' and now()+interval '10 seconds';
  if not found then
    return jsonb_build_object('available',false,'reason','not_available');
  end if;
  now_local := (now() at time zone 'America/Montevideo')::timestamp;
  if public.availability_has_conflict(now_local::date,now_local::time,60,null,true) then
    return jsonb_build_object('available',false,'reason','occupied');
  end if;
  cell:=to_char(round(p_origin_lat::numeric,2),'FM999990.00')||':'||
        to_char(round(p_origin_lng::numeric,2),'FM999990.00');
  -- Total global budget bounds costs, even if source IP headers are spoofed.
  perform pg_advisory_xact_lock(2147482448);
  if (select count(*) from public.driver_eta_public_requests
        where requested_at > now()-interval '1 minute') >= 24
    or (select count(*) from public.driver_eta_public_requests
        where requested_at > now()-interval '1 hour') >= 600
    or (select count(*) from public.driver_eta_public_requests
        where visitor_hash=p_visitor_hash
        and requested_at>now()-interval '1 minute') >= 3
    or (select count(*) from public.driver_eta_public_requests
        where visitor_hash=p_visitor_hash
        and requested_at>now()-interval '1 hour') >= 45 then
    return jsonb_build_object('available',false,'reason','rate_limited');
  end if;
  select count(distinct origin_cell) into prior_cells
    from public.driver_eta_public_requests
    where visitor_hash=p_visitor_hash and requested_at > now()-interval '1 hour';
  if prior_cells >= 3 and not exists(
    select 1 from public.driver_eta_public_requests
    where visitor_hash=p_visitor_hash and origin_cell=cell
      and requested_at>now()-interval '1 hour') then
    return jsonb_build_object('available',false,'reason','rate_limited');
  end if;
  insert into public.driver_eta_public_requests(visitor_hash,origin_cell)
    values(p_visitor_hash,cell);
  -- 0.01° grid (~0.9–1.1 km in latitude). ONLY returns to the service-role
  -- Edge Function; anonymous visitors never receive these coordinates.
  return jsonb_build_object('available',true,
    'coarseDriverLat',round(p.lat::numeric,2),
    'coarseDriverLng',round(p.lng::numeric,2),
    'estimateType','coarse',
    'confirmationRequired',true);
end;
$func$;
revoke all on function public.driver_pickup_public_context_v1(text,double precision,double precision)
  from public,anon,authenticated;
grant execute on function public.driver_pickup_public_context_v1(text,double precision,double precision)
  to service_role;
comment on function public.driver_pickup_public_context_v1(text,double precision,double precision)
 is 'Only callable by Edge service_role; public ETA uses ~1 km-coarsened location, global/per-visitor rates and origin-grid diversity caps. No raw driver GPS returned to visitors.';
