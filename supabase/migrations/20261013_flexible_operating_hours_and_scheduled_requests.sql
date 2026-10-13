
-- Flexible request policy: scheduling is a request, never a promise of a trip.
-- Confirmed bookings, reposition times and explicit blocks remain authoritative.
ALTER TABLE public.driver_availability_settings
  ADD COLUMN IF NOT EXISTS allow_scheduled_any_time boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_live_outside_hours boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.schedule_request_policy_v1(p_date date,p_time time without time zone)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $body$
declare s public.driver_availability_settings:=public.availability_settings_effective();
        local_now timestamp:=(now() at time zone 'America/Montevideo');
begin
  if p_date is null or p_time is null or p_date+p_time<=local_now then
    return jsonb_build_object('requestable',false,'reason','PAST_OR_INVALID');
  end if;
  if not coalesce(s.enabled,false) then
    return jsonb_build_object('requestable',false,'reason','SCHEDULE_REQUESTS_PAUSED');
  end if;
  if not coalesce(s.allow_scheduled_any_time,false) and (
      not (extract(dow from p_date)::smallint=any(s.active_weekdays))
      or p_time<s.day_start or p_time>=s.day_end
      or p_date+p_time < local_now+make_interval(mins=>s.lead_time_min)
    ) then
    return jsonb_build_object('requestable',false,'reason','OUTSIDE_HABITUAL_HOURS');
  end if;
  return jsonb_build_object('requestable',true,'reason','PENDING_DRIVER_REVIEW');
end
$body$;

CREATE OR REPLACE FUNCTION public.validate_schedule_request_insert_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $body$
declare policy jsonb;
begin
  if new.pickup_mode='schedule' then
    policy:=public.schedule_request_policy_v1(new.pickup_date,new.pickup_time);
    if not coalesce((policy->>'requestable')::boolean,false) then
      raise exception 'SOLICITUD_PROGRAMADA_NO_HABILITADA' using detail=policy->>'reason';
    end if;
  end if;
  return new;
end
$body$;

DROP TRIGGER IF EXISTS reservation_schedule_request_policy_v1 ON public.reservations;
CREATE TRIGGER reservation_schedule_request_policy_v1
BEFORE INSERT ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_request_insert_v1();

-- New complete setter, separate signature keeps older Conductor v11.5-R5 compatible.
CREATE OR REPLACE FUNCTION public.driver_set_availability_settings_v12(
 p_pin text,p_enabled boolean,p_day_start time,p_day_end time,
 p_active_weekdays smallint[],p_slot_interval_min integer,
 p_buffer_before_min integer,p_buffer_after_min integer,
 p_default_trip_min integer,p_pending_hold_min integer,p_lead_time_min integer,
 p_allow_scheduled_any_time boolean,p_allow_live_outside_hours boolean
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $body$
begin
  if p_allow_scheduled_any_time is null or p_allow_live_outside_hours is null
  then raise exception 'Completá las opciones de recepción de solicitudes'; end if;
  perform public.driver_set_availability_settings_v11_3(
    p_pin,p_enabled,p_day_start,p_day_end,p_active_weekdays,p_slot_interval_min,
    p_buffer_before_min,p_buffer_after_min,p_default_trip_min,p_pending_hold_min,p_lead_time_min
  );
  update public.driver_availability_settings set
    allow_scheduled_any_time=p_allow_scheduled_any_time,
    allow_live_outside_hours=p_allow_live_outside_hours,updated_at=now()
  where singleton_id=1;
  return public.driver_get_availability_settings_v11_3(p_pin);
end
$body$;

-- A registered customer may REQUEST a slot even if it clashes; only after
-- a driver quote and customer acceptance does it become an accepted trip.
CREATE OR REPLACE FUNCTION public.customer_create_reservation_v11_4(
 p_session_token text,p_pickup_date date,p_pickup_time time,
 p_passengers integer,p_comments text,p_origin_text text,p_origin_lat double precision,
 p_origin_lng double precision,p_destination_text text,p_destination_lat double precision,
 p_destination_lng double precision,p_route_distance_km numeric DEFAULT NULL,
 p_route_duration_min integer DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions','pg_temp'
AS $body$
declare policy jsonb;
begin
  if public.availability_session_customer(p_session_token) is null
    then raise exception 'Sesión inválida'; end if;
  policy:=public.schedule_request_policy_v1(p_pickup_date,p_pickup_time);
  if not coalesce((policy->>'requestable')::boolean,false)
    then raise exception 'SOLICITUD_PROGRAMADA_NO_HABILITADA' using detail=policy->>'reason'; end if;
  return public.customer_create_reservation_v10(
    p_session_token,p_pickup_date,p_pickup_time,p_passengers,p_comments,
    p_origin_text,p_origin_lat,p_origin_lng,p_destination_text,p_destination_lat,p_destination_lng,
    p_route_distance_km,p_route_duration_min
  );
end;
$body$;

CREATE OR REPLACE FUNCTION public.availability_settings_effective()
 RETURNS driver_availability_settings
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.driver_availability_settings;
begin
  select * into r from public.driver_availability_settings where singleton_id=1;
  if not found then
    r.singleton_id := 1; r.enabled := true; r.day_start := '08:00'; r.day_end := '22:00';
    r.active_weekdays := '{0,1,2,3,4,5,6}'; r.slot_interval_min := 30; r.buffer_before_min := 15;
    r.buffer_after_min := 30; r.default_trip_min := 60; r.pending_hold_min := 30; r.lead_time_min := 30;
    r.updated_at := null;
    r.allow_scheduled_any_time := true;
    r.allow_live_outside_hours := true;
  end if;
  return r;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.driver_get_availability_settings_v11_3(p_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.driver_availability_settings;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  s := public.availability_settings_effective();
  return json_build_object(
    'enabled', s.enabled, 'day_start', to_char(s.day_start,'HH24:MI'), 'day_end', to_char(s.day_end,'HH24:MI'),
    'active_weekdays', s.active_weekdays, 'slot_interval_min', s.slot_interval_min,
    'buffer_before_min', s.buffer_before_min, 'buffer_after_min', s.buffer_after_min,
    'default_trip_min', s.default_trip_min, 'pending_hold_min', s.pending_hold_min,
    'lead_time_min', s.lead_time_min, 'allow_scheduled_any_time',s.allow_scheduled_any_time,
    'allow_live_outside_hours',s.allow_live_outside_hours,'updated_at', s.updated_at);
end;
$function$
;

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
  s public.driver_availability_settings := public.availability_settings_effective();
  within_hours boolean := true;
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
  local_now := (now() at time zone 'America/Montevideo')::timestamp;
  within_hours := coalesce(s.allow_live_outside_hours,false) or
    (extract(dow from local_now)::smallint=any(s.active_weekdays)
     and local_now::time>=s.day_start and local_now::time<s.day_end);
  if presence_ok and within_hours then
    select coalesce(p.last_moving_at >= now()-interval '45 seconds',false)
      into motion_recent
      from public.driver_live_presence p where p.singleton_id=1;
    agenda_busy := public.availability_has_conflict(
      local_now::date, local_now::time, 60, null, true
    );
  end if;
  return jsonb_build_object(
    'available', presence_ok and within_hours and not agenda_busy,
    'status', case when presence_ok and within_hours and not agenda_busy
      then 'available_for_requests' else 'not_available' end,
    'motionHint', case when presence_ok and within_hours and not agenda_busy and motion_recent
       then 'moving' else 'stationary' end,
    'checkedAt', now(), 'confirmationRequired', true
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.customer_check_availability_v11_4(p_session_token text, p_pickup_date date, p_pickup_time time without time zone, p_trip_duration_min integer DEFAULT NULL::integer, p_origin_lat double precision DEFAULT NULL::double precision, p_origin_lng double precision DEFAULT NULL::double precision, p_destination_lat double precision DEFAULT NULL::double precision, p_destination_lng double precision DEFAULT NULL::double precision)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d integer; ch jsonb; reason text; method text; s public.driver_availability_settings;
        m integer; m_end integer; t time; c2 jsonb; suggestions text[]:='{}';
        request_policy jsonb;
begin
  if public.availability_session_customer(p_session_token) is null then raise exception 'Sesión inválida'; end if;
  if p_pickup_date is null or p_pickup_time is null then raise exception 'Fecha u hora inválida'; end if;
  request_policy:=public.schedule_request_policy_v1(p_pickup_date,p_pickup_time);
  d:=public.availability_duration(p_trip_duration_min);
  ch:=public.availability_route_check_v11_4(
    p_pickup_date,p_pickup_time,d,p_origin_lat,p_origin_lng,p_destination_lat,p_destination_lng,null,true,true);
  reason:=ch->>'reason'; method:=coalesce(ch->>'method','ROAD');

  if reason<>'AVAILABLE' and not coalesce((request_policy->>'requestable')::boolean,false) then
    s:=public.availability_settings_effective();
    m:=(extract(epoch from greatest(p_pickup_time,s.day_start))/60)::integer;
    if mod(m,s.slot_interval_min)<>0 then m:=m+(s.slot_interval_min-mod(m,s.slot_interval_min)); end if;
    m_end:=(extract(epoch from s.day_end)/60)::integer;
    while m<m_end and coalesce(array_length(suggestions,1),0)<6 loop
      t:=time '00:00'+make_interval(mins=>m);
      if t>p_pickup_time then
        c2:=public.availability_route_check_v11_4(
          p_pickup_date,t,d,p_origin_lat,p_origin_lng,p_destination_lat,p_destination_lng,null,true,true);
        if c2->>'method'='ESTIMATED' then method:='ESTIMATED'; end if;
        if c2->>'reason'='AVAILABLE' then suggestions:=suggestions||to_char(t,'HH24:MI'); end if;
      end if;
      m:=m+s.slot_interval_min;
    end loop;
  end if;

  return json_build_object(
    'date',p_pickup_date,'time',to_char(p_pickup_time,'HH24:MI'),
    'available',reason='AVAILABLE','reason',reason,
    'requestable',(request_policy->>'requestable')::boolean,
    'request_reason',request_policy->>'reason','duration_used_min',d,
    'suggested_times',coalesce((select json_agg(x) from unnest(suggestions) x),'[]'::json),
    'reposition_method',method);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.customer_quote_decision_v13(p_reservation_id uuid DEFAULT NULL::uuid, p_accept boolean DEFAULT NULL::boolean, p_session_token text DEFAULT NULL::text, p_public_token text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_customer_id uuid;
  v_res public.reservations%rowtype;
  v_check jsonb;
  v_duration integer;
BEGIN
  IF p_accept IS NULL THEN RAISE EXCEPTION 'Decisión inválida'; END IF;
  IF nullif(btrim(coalesce(p_session_token,'')),'') IS NOT NULL THEN
    v_customer_id:=public.availability_session_customer(p_session_token);
    IF v_customer_id IS NULL OR p_reservation_id IS NULL THEN
      RAISE EXCEPTION 'Sesión inválida o reserva no identificada';
    END IF;
  ELSIF length(coalesce(p_public_token,''))<48 THEN
    RAISE EXCEPTION 'Acceso a la reserva inválido';
  END IF;

  IF p_accept THEN
    -- Misma exclusión por agenda que las reservas programadas.
    PERFORM pg_advisory_xact_lock(hashtextextended('traslados_availability',0));
  END IF;
  IF v_customer_id IS NOT NULL THEN
    SELECT * INTO v_res FROM public.reservations
    WHERE id=p_reservation_id AND customer_id=v_customer_id
      AND status='PENDIENTE' AND quote_status='ENVIADO'
    FOR UPDATE;
  ELSE
    SELECT * INTO v_res FROM public.reservations
    WHERE public_token=p_public_token
      AND (p_reservation_id IS NULL OR id=p_reservation_id)
      AND status='PENDIENTE' AND quote_status='ENVIADO'
    FOR UPDATE;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay un presupuesto pendiente de decisión para esta reserva';
  END IF;
  IF p_accept THEN
    IF v_res.pickup_mode IN ('now','10')
       AND v_res.created_at<now()-interval '90 minutes' THEN
       RAISE EXCEPTION 'La solicitud inmediata venció. Solicitá una nueva recogida';
    END IF;
    v_duration:=public.availability_duration(v_res.route_duration_min);
    v_check:=public.availability_route_check_v11_4(
      v_res.pickup_date,v_res.pickup_time,v_duration,
      v_res.origin_lat,v_res.origin_lng,v_res.destination_lat,v_res.destination_lng,
      v_res.id,false,false); -- Driver explicitly opted in by sending quote; still check confirmed conflicts
    IF v_check->>'reason'<>'AVAILABLE' THEN
      RAISE EXCEPTION 'HORARIO_YA_NO_DISPONIBLE' USING DETAIL=v_check->>'reason';
    END IF;
    UPDATE public.reservations SET
      quote_status='ACEPTADO',quote_accepted_at=now(),confirmed_at=now(),status='ACEPTADA'
    WHERE id=v_res.id AND status='PENDIENTE' AND quote_status='ENVIADO'
    RETURNING * INTO v_res;
  ELSE
    UPDATE public.reservations SET
      quote_status='RECHAZADO',quote_rejected_at=now(),status='RECHAZADA'
    WHERE id=v_res.id AND status='PENDIENTE' AND quote_status='ENVIADO'
    RETURNING * INTO v_res;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'El presupuesto ya recibió una respuesta'; END IF;
  RETURN json_build_object(
    'id',v_res.id,'code',v_res.code,'status',v_res.status,
    'quote_status',v_res.quote_status,'quote_final_total',v_res.quote_final_total,
    'quote_sent_at',v_res.quote_sent_at,'quote_accepted_at',v_res.quote_accepted_at,
    'quote_rejected_at',v_res.quote_rejected_at,'confirmed_at',v_res.confirmed_at,
    'updated_at',v_res.updated_at);
END
$function$
;

CREATE OR REPLACE FUNCTION public.driver_list_reservations_v3(p_pin text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT COALESCE(json_agg(x),'[]'::json)
  FROM (
    SELECT (b.value || jsonb_build_object('pickup_phase',r.pickup_phase,
      'pickup_phase_updated_at',r.pickup_phase_updated_at,
      'pickup_mode',r.pickup_mode,
      'stops',coalesce((select jsonb_agg(jsonb_build_object(
        'position',st.position,'address_text',st.address_text,
        'lat',st.lat,'lng',st.lng,'department',st.department
      ) order by st.position) from public.reservation_stops st
        where st.reservation_id=r.id),'[]'::jsonb))) AS x
    FROM jsonb_array_elements(public.driver_list_reservations_v2(p_pin)::jsonb) b(value)
    JOIN public.reservations r ON r.id=(b.value->>'id')::uuid
  ) q
$function$
;
-- Verify both customer cohorts use pending request semantics; there must be
-- no implicit quote, acceptance or status transition in this migration.
DO $verify$
begin
 if not exists(select 1 from information_schema.columns
 where table_schema='public' and table_name='driver_availability_settings'
 and column_name='allow_scheduled_any_time') then
   raise exception 'Missing scheduling policy column';
 end if;
 if position('stops' in pg_get_functiondef('public.driver_list_reservations_v3(text)'::regprocedure))=0
 then raise exception 'Conductor stops not exposed'; end if;
end
$verify$;
