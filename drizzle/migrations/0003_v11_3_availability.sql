-- v11.3: shared availability / agenda (additive)

CREATE TABLE IF NOT EXISTS public.driver_availability_settings (
  singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  enabled boolean NOT NULL DEFAULT true,
  day_start time NOT NULL DEFAULT '08:00',
  day_end time NOT NULL DEFAULT '22:00',
  active_weekdays smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  slot_interval_min integer NOT NULL DEFAULT 30,
  buffer_before_min integer NOT NULL DEFAULT 15,
  buffer_after_min integer NOT NULL DEFAULT 30,
  default_trip_min integer NOT NULL DEFAULT 60,
  pending_hold_min integer NOT NULL DEFAULT 30,
  lead_time_min integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT das_day_range_chk CHECK (day_end > day_start),
  CONSTRAINT das_weekdays_chk CHECK (active_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  CONSTRAINT das_slot_chk CHECK (slot_interval_min BETWEEN 5 AND 240),
  CONSTRAINT das_buffers_chk CHECK (buffer_before_min BETWEEN 0 AND 720 AND buffer_after_min BETWEEN 0 AND 720),
  CONSTRAINT das_trip_chk CHECK (default_trip_min BETWEEN 1 AND 2880),
  CONSTRAINT das_hold_chk CHECK (pending_hold_min BETWEEN 0 AND 10080),
  CONSTRAINT das_lead_chk CHECK (lead_time_min BETWEEN 0 AND 10080)
);
GRANT ALL ON public.driver_availability_settings TO service_role;
ALTER TABLE public.driver_availability_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.driver_schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dsb_range_chk CHECK (end_time > start_time)
);
GRANT ALL ON public.driver_schedule_blocks TO service_role;
ALTER TABLE public.driver_schedule_blocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS driver_schedule_blocks_date_idx ON public.driver_schedule_blocks(block_date);
CREATE INDEX IF NOT EXISTS reservations_pickup_status_idx ON public.reservations(pickup_date, status);

-- ===== Internal helpers (not callable by anon/authenticated) =====

CREATE OR REPLACE FUNCTION public.availability_settings_effective()
RETURNS public.driver_availability_settings LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r public.driver_availability_settings;
begin
  select * into r from public.driver_availability_settings where singleton_id=1;
  if not found then
    r.singleton_id := 1; r.enabled := true; r.day_start := '08:00'; r.day_end := '22:00';
    r.active_weekdays := '{0,1,2,3,4,5,6}'; r.slot_interval_min := 30; r.buffer_before_min := 15;
    r.buffer_after_min := 30; r.default_trip_min := 60; r.pending_hold_min := 30; r.lead_time_min := 30;
    r.updated_at := null;
  end if;
  return r;
end;
$function$;

CREATE OR REPLACE FUNCTION public.availability_session_customer(p_session_token text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select s.customer_id from public.customer_sessions s
  join public.customers c on c.id=s.customer_id
  where s.token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
    and s.active and s.expires_at>now() and c.active
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.availability_duration(p_trip_duration_min integer)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if p_trip_duration_min is not null and p_trip_duration_min > 0 then
    return least(p_trip_duration_min, 2880);
  end if;
  return (public.availability_settings_effective()).default_trip_min;
end;
$function$;

-- Conflict: reservations occupy [start-buffer_before, end+buffer_after) relative to the
-- new trip, and the new trip's own buffers are applied against existing trips.
CREATE OR REPLACE FUNCTION public.availability_has_conflict(
  p_date date, p_time time, p_duration_min integer, p_exclude uuid, p_include_pending boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  s public.driver_availability_settings := public.availability_settings_effective();
  ns timestamp := p_date + p_time;
  ne timestamp := (p_date + p_time) + make_interval(mins => p_duration_min);
  b interval := make_interval(mins => s.buffer_before_min);
  a interval := make_interval(mins => s.buffer_after_min);
begin
  if exists (
    select 1 from (
      select r.pickup_date + r.pickup_time as rs,
             r.pickup_date + r.pickup_time + make_interval(mins =>
               case when coalesce(r.route_duration_min,0) > 0 then r.route_duration_min else s.default_trip_min end) as re
      from public.reservations r
      where r.pickup_date between p_date - 3 and p_date + 3
        and not r.is_demo
        and (p_exclude is null or r.id <> p_exclude)
        and (
          r.status in ('ACEPTADA','EN_VIAJE')
          or (p_include_pending and r.status = 'PENDIENTE'
              and now() < greatest(r.created_at, coalesce(r.quote_sent_at, r.created_at))
                          + make_interval(mins => s.pending_hold_min))
        )
    ) x
    where (ns < x.re + a and x.rs - b < ne)
       or (ns - b < x.re and x.rs < ne + a)
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.driver_schedule_blocks k
    where k.block_date between p_date - 3 and p_date + 3
      and (k.block_date + k.start_time) < ne + a
      and (k.block_date + k.end_time) > ns - b
  ) then
    return true;
  end if;

  return false;
end;
$function$;

-- Reason for a NEW reservation request: AVAILABLE, CLOSED, OUTSIDE_SCHEDULE, TOO_SOON, OCCUPIED
CREATE OR REPLACE FUNCTION public.availability_reason(
  p_date date, p_time time, p_duration_min integer)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare s public.driver_availability_settings := public.availability_settings_effective();
begin
  if p_date is null or p_time is null then return 'OUTSIDE_SCHEDULE'; end if;
  if not s.enabled or not (extract(dow from p_date)::smallint = any(s.active_weekdays)) then
    return 'CLOSED';
  end if;
  if p_time < s.day_start or p_time >= s.day_end then return 'OUTSIDE_SCHEDULE'; end if;
  if (p_date + p_time) < (now() at time zone 'America/Montevideo') + make_interval(mins => s.lead_time_min) then
    return 'TOO_SOON';
  end if;
  if public.availability_has_conflict(p_date, p_time, p_duration_min, null, true) then
    return 'OCCUPIED';
  end if;
  return 'AVAILABLE';
end;
$function$;

CREATE OR REPLACE FUNCTION public.availability_free_times(p_date date, p_duration_min integer)
RETURNS time[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  s public.driver_availability_settings := public.availability_settings_effective();
  m integer; m_end integer; t time; res time[] := '{}';
begin
  if not s.enabled or not (extract(dow from p_date)::smallint = any(s.active_weekdays)) then return res; end if;
  m := (extract(epoch from s.day_start) / 60)::int;
  m_end := (extract(epoch from s.day_end) / 60)::int;
  while m < m_end loop
    t := time '00:00' + make_interval(mins => m);
    if public.availability_reason(p_date, t, p_duration_min) = 'AVAILABLE' then
      res := res || t;
    end if;
    m := m + s.slot_interval_min;
  end loop;
  return res;
end;
$function$;

REVOKE ALL ON FUNCTION public.availability_settings_effective() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_session_customer(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_duration(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_has_conflict(date,time,integer,uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_reason(date,time,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_free_times(date,integer) FROM PUBLIC, anon, authenticated;

-- ===== Customer RPCs =====

CREATE OR REPLACE FUNCTION public.customer_get_available_slots_v11_3(
  p_session_token text, p_pickup_date date, p_trip_duration_min integer DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  s public.driver_availability_settings := public.availability_settings_effective();
  d integer; times time[];
begin
  if public.availability_session_customer(p_session_token) is null then raise exception 'Sesión inválida'; end if;
  if p_pickup_date is null then raise exception 'Fecha inválida'; end if;
  d := public.availability_duration(p_trip_duration_min);
  times := public.availability_free_times(p_pickup_date, d);
  return json_build_object(
    'date', p_pickup_date,
    'enabled', s.enabled and (extract(dow from p_pickup_date)::smallint = any(s.active_weekdays)),
    'slot_interval_min', s.slot_interval_min,
    'duration_used_min', d,
    'available_times', coalesce((select json_agg(to_char(t,'HH24:MI') order by t) from unnest(times) t), '[]'::json));
end;
$function$;

CREATE OR REPLACE FUNCTION public.customer_check_availability_v11_3(
  p_session_token text, p_pickup_date date, p_pickup_time time, p_trip_duration_min integer DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare d integer; v_reason text; times time[];
begin
  if public.availability_session_customer(p_session_token) is null then raise exception 'Sesión inválida'; end if;
  if p_pickup_date is null or p_pickup_time is null then raise exception 'Fecha u hora inválida'; end if;
  d := public.availability_duration(p_trip_duration_min);
  v_reason := public.availability_reason(p_pickup_date, p_pickup_time, d);
  if v_reason = 'AVAILABLE' then
    times := '{}';
  else
    times := public.availability_free_times(p_pickup_date, d);
  end if;
  return json_build_object(
    'date', p_pickup_date,
    'time', to_char(p_pickup_time,'HH24:MI'),
    'available', v_reason = 'AVAILABLE',
    'reason', v_reason,
    'duration_used_min', d,
    'suggested_times', coalesce((
      select json_agg(to_char(t,'HH24:MI') order by t)
      from (select t from unnest(times) t where t > p_pickup_time order by t limit 6) q), '[]'::json));
end;
$function$;

CREATE OR REPLACE FUNCTION public.customer_create_reservation_v11_3(
  p_session_token text, p_pickup_date date, p_pickup_time time without time zone,
  p_passengers integer, p_comments text,
  p_origin_text text, p_origin_lat double precision, p_origin_lng double precision,
  p_destination_text text, p_destination_lat double precision, p_destination_lng double precision,
  p_route_distance_km numeric DEFAULT NULL, p_route_duration_min integer DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
declare v_reason text;
begin
  if public.availability_session_customer(p_session_token) is null then raise exception 'Sesión inválida'; end if;
  -- serialize availability decisions
  perform pg_advisory_xact_lock(hashtextextended('traslados_availability', 0));
  v_reason := public.availability_reason(p_pickup_date, p_pickup_time, public.availability_duration(p_route_duration_min));
  if v_reason <> 'AVAILABLE' then
    raise exception 'HORARIO_NO_DISPONIBLE' using detail = v_reason;
  end if;
  return public.customer_create_reservation_v10(
    p_session_token, p_pickup_date, p_pickup_time, p_passengers, p_comments,
    p_origin_text, p_origin_lat, p_origin_lng, p_destination_text, p_destination_lat, p_destination_lng,
    p_route_distance_km, p_route_duration_min);
end;
$function$;

CREATE OR REPLACE FUNCTION public.customer_quote_decision_v11_3(p_session_token text, p_reservation_id uuid, p_accept boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_customer_id uuid; r public.reservations;
begin
  v_customer_id := public.availability_session_customer(p_session_token);
  if v_customer_id is null then raise exception 'Sesión inválida'; end if;
  if p_accept is true then
    perform pg_advisory_xact_lock(hashtextextended('traslados_availability', 0));
    select * into r from public.reservations
     where id=p_reservation_id and customer_id=v_customer_id and status='PENDIENTE' and quote_status='ENVIADO'
     for update;
    if found and public.availability_has_conflict(
         r.pickup_date, r.pickup_time,
         public.availability_duration(r.route_duration_min), r.id, false) then
      raise exception 'HORARIO_YA_NO_DISPONIBLE';
    end if;
  end if;
  return public.customer_quote_decision_v10(p_session_token, p_reservation_id, p_accept);
end;
$function$;

-- ===== Driver RPCs =====

CREATE OR REPLACE FUNCTION public.driver_get_availability_settings_v11_3(p_pin text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    'lead_time_min', s.lead_time_min, 'updated_at', s.updated_at);
end;
$function$;

CREATE OR REPLACE FUNCTION public.driver_set_availability_settings_v11_3(
  p_pin text, p_enabled boolean, p_day_start time, p_day_end time, p_active_weekdays smallint[],
  p_slot_interval_min integer, p_buffer_before_min integer, p_buffer_after_min integer,
  p_default_trip_min integer, p_pending_hold_min integer, p_lead_time_min integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  if p_enabled is null or p_day_start is null or p_day_end is null or p_active_weekdays is null
     or p_slot_interval_min is null or p_buffer_before_min is null or p_buffer_after_min is null
     or p_default_trip_min is null or p_pending_hold_min is null or p_lead_time_min is null then
    raise exception 'Todos los campos son obligatorios';
  end if;
  if p_day_end <= p_day_start then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;
  if not (p_active_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]) then raise exception 'Días inválidos (0=domingo … 6=sábado)'; end if;
  if p_slot_interval_min not between 5 and 240 then raise exception 'Intervalo inválido (5-240 min)'; end if;
  if p_buffer_before_min not between 0 and 720 or p_buffer_after_min not between 0 and 720 then raise exception 'Márgenes inválidos (0-720 min)'; end if;
  if p_default_trip_min not between 1 and 2880 then raise exception 'Duración por defecto inválida (1-2880 min)'; end if;
  if p_pending_hold_min not between 0 and 10080 then raise exception 'Reserva provisoria inválida (0-10080 min)'; end if;
  if p_lead_time_min not between 0 and 10080 then raise exception 'Anticipación inválida (0-10080 min)'; end if;

  insert into public.driver_availability_settings(singleton_id, enabled, day_start, day_end, active_weekdays,
    slot_interval_min, buffer_before_min, buffer_after_min, default_trip_min, pending_hold_min, lead_time_min, updated_at)
  values (1, p_enabled, p_day_start, p_day_end,
    (select coalesce(array_agg(distinct x order by x), '{}') from unnest(p_active_weekdays) x),
    p_slot_interval_min, p_buffer_before_min, p_buffer_after_min, p_default_trip_min, p_pending_hold_min, p_lead_time_min, now())
  on conflict (singleton_id) do update set
    enabled=excluded.enabled, day_start=excluded.day_start, day_end=excluded.day_end,
    active_weekdays=excluded.active_weekdays, slot_interval_min=excluded.slot_interval_min,
    buffer_before_min=excluded.buffer_before_min, buffer_after_min=excluded.buffer_after_min,
    default_trip_min=excluded.default_trip_min, pending_hold_min=excluded.pending_hold_min,
    lead_time_min=excluded.lead_time_min, updated_at=now();

  return public.driver_get_availability_settings_v11_3(p_pin);
end;
$function$;

CREATE OR REPLACE FUNCTION public.driver_list_schedule_blocks_v11_3(p_pin text, p_from date, p_to date)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v json;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  select coalesce(json_agg(json_build_object(
      'id', k.id, 'date', k.block_date,
      'start', to_char(k.start_time,'HH24:MI'), 'end', to_char(k.end_time,'HH24:MI'),
      'note', k.note, 'created_at', k.created_at) order by k.block_date, k.start_time), '[]'::json)
  into v
  from public.driver_schedule_blocks k
  where (p_from is null or k.block_date >= p_from) and (p_to is null or k.block_date <= p_to);
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION public.driver_add_schedule_block_v11_3(p_pin text, p_date date, p_start time, p_end time, p_note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare k public.driver_schedule_blocks;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  if p_date is null or p_start is null or p_end is null then raise exception 'Fecha y horas obligatorias'; end if;
  if p_end <= p_start then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;
  insert into public.driver_schedule_blocks(block_date, start_time, end_time, note)
  values (p_date, p_start, p_end, nullif(btrim(coalesce(p_note,'')),''))
  returning * into k;
  return json_build_object('ok', true, 'id', k.id, 'date', k.block_date,
    'start', to_char(k.start_time,'HH24:MI'), 'end', to_char(k.end_time,'HH24:MI'),
    'note', k.note, 'created_at', k.created_at);
end;
$function$;

CREATE OR REPLACE FUNCTION public.driver_delete_schedule_block_v11_3(p_pin text, p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  delete from public.driver_schedule_blocks where id = p_id;
  return json_build_object('ok', true, 'deleted', found);
end;
$function$;

GRANT EXECUTE ON FUNCTION public.customer_get_available_slots_v11_3(text,date,integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_check_availability_v11_3(text,date,time,integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_create_reservation_v11_3(text,date,time without time zone,integer,text,text,double precision,double precision,text,double precision,double precision,numeric,integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_quote_decision_v11_3(text,uuid,boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_get_availability_settings_v11_3(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_set_availability_settings_v11_3(text,boolean,time,time,smallint[],integer,integer,integer,integer,integer,integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_list_schedule_blocks_v11_3(text,date,date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_add_schedule_block_v11_3(text,date,time,time,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_delete_schedule_block_v11_3(text,uuid) TO anon, authenticated, service_role;