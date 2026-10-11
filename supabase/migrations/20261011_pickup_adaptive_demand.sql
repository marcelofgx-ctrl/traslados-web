-- 2026-10-11. Extend the existing opt-in GPS heartbeat with a bounded
-- demand hint, so Android can publish more often only when passengers recently
-- requested an actual road ETA. No changes to public availability.
-- Same signature, same device credential checks, same GPS freshness validation.
-- No SELECT grants on the underlying request tables or GPS coordinates.
CREATE OR REPLACE FUNCTION public.mapa_presence_ping_v1(p_device_id uuid, p_device_secret text, p_shift_active boolean, p_shift_paused boolean, p_trip_active boolean, p_manually_busy boolean, p_lat double precision, p_lng double precision, p_accuracy_m real, p_gps_at_ms bigint, p_last_move_at_ms bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  gps_time timestamptz;
  moving_time timestamptz;
  loc_ok boolean:=false;
  recent_pickup_demand boolean:=false;
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
;
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
  -- Demand is derived ONLY from already rate-limited customer/guest ETA gates.
  -- This boolean goes solely to the authorized Mapa device; no passenger
  -- receives coordinates, active visitor IDs or demand history.
  if loc_ok then
    recent_pickup_demand :=
      exists(select 1 from public.driver_eta_public_requests
             where requested_at >= now()-interval '75 seconds')
      or exists(select 1 from public.driver_eta_customer_requests
                where requested_at >= now()-interval '75 seconds');
  end if;
  return jsonb_build_object(
    'ok',true,'eligible',loc_ok,
    'pickupDemandActive',loc_ok and recent_pickup_demand
  );
end;$function$;

-- Retain the existing function's authorization and revocation contracts.
REVOKE ALL ON FUNCTION public.mapa_presence_ping_v1(
 uuid,text,boolean,boolean,boolean,boolean,double precision,double precision,real,bigint,bigint
) FROM public;
GRANT EXECUTE ON FUNCTION public.mapa_presence_ping_v1(
 uuid,text,boolean,boolean,boolean,boolean,double precision,double precision,real,bigint,bigint
) TO anon,authenticated,service_role;
