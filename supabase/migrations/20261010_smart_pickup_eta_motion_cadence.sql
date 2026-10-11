-- Traslados 2026-10-10: refreshed arrival estimates 30s moving / 60s stationary.
-- Add a coarse motion hint to the already-public yes/no availability endpoint.
-- Never disclose GPS coordinates, raw speed, or route data through availability.
-- Raise per-visitor/per-customer hourly quota 45/20 -> 150 for the targeted 30s cadence.
-- Preserve per-minute ceilings, 3-cell visitor limit, global 24/min and 600/hour limits.
-- No modification to driver GPS authorization, journey/agenda, or position freshness.

CREATE OR REPLACE FUNCTION public.driver_pickup_eta_context_v1(p_session_token text, p_origin_lat double precision, p_origin_lng double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        where customer_id=cid and requested_at>now()-interval '1 hour')>=150
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
end;$function$;



CREATE OR REPLACE FUNCTION public.driver_pickup_public_context_v1(p_visitor_hash text, p_origin_lat double precision, p_origin_lng double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
;
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
        and requested_at>now()-interval '1 hour') >= 150 then
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
  -- Accurate GPS is for service-role-to-Edge road routing ONLY.
  -- Clients only receive rounded distance and travel time, never coordinates.
  return jsonb_build_object('available',true,
    'coarseDriverLat',round(p.lat::numeric,2),
    'coarseDriverLng',round(p.lng::numeric,2),
    'serviceDriverLat',p.lat,
    'serviceDriverLng',p.lng,
    'estimateType','coarse',
    'confirmationRequired',true);
end;
$function$;



CREATE OR REPLACE FUNCTION public.public_driver_availability_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  presence_ok boolean := false;
  agenda_busy boolean := true;
  local_now timestamp;
  motion_recent boolean := false;
begin
  select exists(
    select 1 from public.driver_live_presence p
    where p.singleton_id = 1
      and p.enabled and p.shift_active
      and not p.shift_paused and not p.trip_active and not p.manually_busy
      and p.lat is not null and p.lng is not null
      and p.received_at >= now() - interval '90 seconds'
      and p.gps_recorded_at between now() - interval '90 seconds' and now() + interval '10 seconds'
      and p.accuracy_m <= 45
  ) into presence_ok;
  if presence_ok then
    select coalesce(p.last_moving_at >= now()-interval '45 seconds',false)
      into motion_recent
      from public.driver_live_presence p where p.singleton_id=1;
    local_now := (now() at time zone 'America/Montevideo')::timestamp;
    agenda_busy := public.availability_has_conflict(
      local_now::date, local_now::time, 60, null, true
    );
  end if;
  return jsonb_build_object(
    'available', presence_ok and not agenda_busy,
    'status', case when presence_ok and not agenda_busy
      then 'available_for_requests' else 'not_available' end,
    'motionHint', case when presence_ok and not agenda_busy and motion_recent
       then 'moving' else 'stationary' end,
    'checkedAt', now(), 'confirmationRequired', true
  );
end;
$function$;

