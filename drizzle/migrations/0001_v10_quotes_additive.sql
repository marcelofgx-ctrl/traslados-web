ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS route_distance_km numeric,
  ADD COLUMN IF NOT EXISTS route_duration_min integer,
  ADD COLUMN IF NOT EXISTS quote_status text NOT NULL DEFAULT 'SIN_PRESUPUESTO',
  ADD COLUMN IF NOT EXISTS quote_price_per_km numeric,
  ADD COLUMN IF NOT EXISTS quote_minimum numeric,
  ADD COLUMN IF NOT EXISTS quote_tolls numeric,
  ADD COLUMN IF NOT EXISTS quote_waiting numeric,
  ADD COLUMN IF NOT EXISTS quote_pickup_extra numeric,
  ADD COLUMN IF NOT EXISTS quote_other numeric,
  ADD COLUMN IF NOT EXISTS quote_reference_total numeric,
  ADD COLUMN IF NOT EXISTS quote_final_total numeric,
  ADD COLUMN IF NOT EXISTS quote_includes text,
  ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reservations_quote_status_chk') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_quote_status_chk
      CHECK (quote_status IN ('SIN_PRESUPUESTO','ENVIADO','ACEPTADO','RECHAZADO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reservations_v10_nonneg_chk') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_v10_nonneg_chk CHECK (
      (route_distance_km IS NULL OR route_distance_km >= 0) AND
      (route_duration_min IS NULL OR route_duration_min >= 0) AND
      (quote_price_per_km IS NULL OR quote_price_per_km >= 0) AND
      (quote_minimum IS NULL OR quote_minimum >= 0) AND
      (quote_tolls IS NULL OR quote_tolls >= 0) AND
      (quote_waiting IS NULL OR quote_waiting >= 0) AND
      (quote_pickup_extra IS NULL OR quote_pickup_extra >= 0) AND
      (quote_other IS NULL OR quote_other >= 0) AND
      (quote_reference_total IS NULL OR quote_reference_total >= 0) AND
      (quote_final_total IS NULL OR quote_final_total >= 0));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reservations_quote_status_idx ON public.reservations(quote_status);

-- A) customer_create_reservation_v10
CREATE OR REPLACE FUNCTION public.customer_create_reservation_v10(
  p_session_token text, p_pickup_date date, p_pickup_time time without time zone,
  p_passengers integer, p_comments text,
  p_origin_text text, p_origin_lat double precision, p_origin_lng double precision,
  p_destination_text text, p_destination_lat double precision, p_destination_lng double precision,
  p_route_distance_km numeric DEFAULT NULL, p_route_duration_min integer DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
declare v_customer public.customers; v_row public.reservations;
begin
  select c.* into v_customer from public.customer_sessions s
  join public.customers c on c.id=s.customer_id
  where s.token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
    and s.active and s.expires_at>now() and c.active limit 1;
  if not found then raise exception 'Sesión inválida'; end if;
  if (p_pickup_date + p_pickup_time) < ((now() at time zone 'America/Montevideo') - interval '10 minutes') then
    raise exception 'La fecha y hora deben ser futuras';
  end if;
  if p_route_distance_km is not null and p_route_distance_km < 0 then raise exception 'Distancia inválida'; end if;
  if p_route_duration_min is not null and p_route_duration_min < 0 then raise exception 'Duración inválida'; end if;

  insert into public.reservations(
    code,public_token,customer_id,customer_name,customer_phone,pickup_date,pickup_time,
    passengers,comments,origin_text,origin_lat,origin_lng,destination_text,destination_lat,destination_lng,
    status,quote_status,route_distance_km,route_duration_min
  ) values(
    public.generate_reservation_code(),encode(gen_random_bytes(32),'hex'),v_customer.id,v_customer.full_name,v_customer.phone_display,
    p_pickup_date,p_pickup_time,coalesce(p_passengers,1),nullif(btrim(coalesce(p_comments,'')),''),
    btrim(p_origin_text),p_origin_lat,p_origin_lng,btrim(p_destination_text),p_destination_lat,p_destination_lng,
    'PENDIENTE','SIN_PRESUPUESTO',p_route_distance_km,p_route_duration_min
  ) returning * into v_row;

  return json_build_object('id',v_row.id,'code',v_row.code,'public_token',v_row.public_token,
    'status',v_row.status,'quote_status',v_row.quote_status,
    'route_distance_km',v_row.route_distance_km,'route_duration_min',v_row.route_duration_min,
    'created_at',v_row.created_at);
end;
$function$;

-- B) driver_send_quote_v10
CREATE OR REPLACE FUNCTION public.driver_send_quote_v10(
  p_pin text, p_reservation_id uuid,
  p_route_distance_km numeric, p_price_per_km numeric, p_minimum numeric,
  p_tolls numeric, p_waiting numeric, p_pickup_extra numeric, p_other numeric,
  p_reference_total numeric, p_final_total numeric, p_includes text DEFAULT NULL,
  p_route_duration_min integer DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v public.reservations;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  if p_final_total is null or p_final_total < 0 then raise exception 'Total final inválido'; end if;
  if least(coalesce(p_route_distance_km,0),coalesce(p_price_per_km,0),coalesce(p_minimum,0),coalesce(p_tolls,0),
           coalesce(p_waiting,0),coalesce(p_pickup_extra,0),coalesce(p_other,0),coalesce(p_reference_total,0),
           coalesce(p_route_duration_min,0)) < 0 then
    raise exception 'Los importes no pueden ser negativos';
  end if;

  update public.reservations set
    route_distance_km=coalesce(p_route_distance_km,route_distance_km),
    route_duration_min=coalesce(p_route_duration_min,route_duration_min),
    quote_price_per_km=p_price_per_km, quote_minimum=p_minimum, quote_tolls=p_tolls,
    quote_waiting=p_waiting, quote_pickup_extra=p_pickup_extra, quote_other=p_other,
    quote_reference_total=p_reference_total, quote_final_total=p_final_total,
    quote_includes=nullif(btrim(coalesce(p_includes,'')),''),
    quote_status='ENVIADO', quote_sent_at=now()
  where id=p_reservation_id and status='PENDIENTE' and quote_status in ('SIN_PRESUPUESTO','ENVIADO')
  returning * into v;
  if not found then raise exception 'La reserva no admite presupuesto (no está pendiente o ya fue decidida)'; end if;

  return json_build_object('ok',true,'id',v.id,'code',v.code,'status',v.status,'quote_status',v.quote_status,
    'route_distance_km',v.route_distance_km,'route_duration_min',v.route_duration_min,
    'quote_price_per_km',v.quote_price_per_km,'quote_minimum',v.quote_minimum,'quote_tolls',v.quote_tolls,
    'quote_waiting',v.quote_waiting,'quote_pickup_extra',v.quote_pickup_extra,'quote_other',v.quote_other,
    'quote_reference_total',v.quote_reference_total,'quote_final_total',v.quote_final_total,
    'quote_includes',v.quote_includes,'quote_sent_at',v.quote_sent_at,'updated_at',v.updated_at);
end;
$function$;

-- C) customer_quote_decision_v10
CREATE OR REPLACE FUNCTION public.customer_quote_decision_v10(p_session_token text, p_reservation_id uuid, p_accept boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_customer_id uuid; v public.reservations;
begin
  select s.customer_id into v_customer_id from public.customer_sessions s
  join public.customers c on c.id=s.customer_id
  where s.token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
    and s.active and s.expires_at>now() and c.active limit 1;
  if v_customer_id is null then raise exception 'Sesión inválida'; end if;
  if p_accept is null then raise exception 'Decisión inválida'; end if;

  if p_accept then
    update public.reservations set quote_status='ACEPTADO', quote_accepted_at=now(), confirmed_at=now(), status='ACEPTADA'
    where id=p_reservation_id and customer_id=v_customer_id and status='PENDIENTE' and quote_status='ENVIADO'
    returning * into v;
  else
    update public.reservations set quote_status='RECHAZADO', quote_rejected_at=now(), status='RECHAZADA'
    where id=p_reservation_id and customer_id=v_customer_id and status='PENDIENTE' and quote_status='ENVIADO'
    returning * into v;
  end if;
  if not found then raise exception 'No hay un presupuesto pendiente de decisión para esta reserva'; end if;

  return json_build_object('id',v.id,'code',v.code,'status',v.status,'quote_status',v.quote_status,
    'route_distance_km',v.route_distance_km,'route_duration_min',v.route_duration_min,
    'quote_final_total',v.quote_final_total,'quote_includes',v.quote_includes,
    'quote_sent_at',v.quote_sent_at,'quote_accepted_at',v.quote_accepted_at,'confirmed_at',v.confirmed_at);
end;
$function$;

-- D) Existing read RPCs: same signatures, extra fields only
CREATE OR REPLACE FUNCTION public.customer_list_reservations(p_session_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_customer_id uuid; v_result json;
begin
  select s.customer_id into v_customer_id from public.customer_sessions s
  join public.customers c on c.id=s.customer_id
  where s.token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
    and s.active and s.expires_at>now() and c.active limit 1;
  if v_customer_id is null then raise exception 'Sesión inválida'; end if;

  select coalesce(json_agg(x order by x.pickup_date desc,x.pickup_time desc),'[]'::json) into v_result
  from (
    select id,code,status,customer_name,customer_phone,pickup_date,pickup_time,passengers,comments,
           origin_text,origin_lat,origin_lng,destination_text,destination_lat,destination_lng,
           created_at,updated_at,
           route_distance_km,route_duration_min,quote_status,quote_final_total,quote_includes,
           quote_sent_at,quote_accepted_at,confirmed_at
    from public.reservations where customer_id=v_customer_id
  ) x;
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_reservation_by_token(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_row public.reservations;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN RETURN NULL; END IF;
  SELECT * INTO v_row FROM public.reservations WHERE public_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN json_build_object(
    'code', v_row.code, 'status', v_row.status, 'customer_name', v_row.customer_name,
    'pickup_date', v_row.pickup_date, 'pickup_time', v_row.pickup_time, 'passengers', v_row.passengers,
    'origin_text', v_row.origin_text, 'destination_text', v_row.destination_text,
    'comments', v_row.comments, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at,
    'route_distance_km', v_row.route_distance_km, 'route_duration_min', v_row.route_duration_min,
    'quote_status', v_row.quote_status, 'quote_final_total', v_row.quote_final_total,
    'quote_includes', v_row.quote_includes, 'quote_sent_at', v_row.quote_sent_at,
    'quote_accepted_at', v_row.quote_accepted_at, 'confirmed_at', v_row.confirmed_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.driver_list_reservations_v2(p_pin text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v json;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  select coalesce(json_agg(x order by x.created_at desc),'[]'::json) into v
  from (
    select id, code, customer_name, customer_phone, pickup_date, pickup_time, passengers, comments,
           origin_text, origin_lat, origin_lng, destination_text, destination_lat, destination_lng,
           status, created_at, updated_at,
           route_distance_km, route_duration_min, quote_status, quote_price_per_km, quote_minimum,
           quote_tolls, quote_waiting, quote_pickup_extra, quote_other, quote_reference_total,
           quote_final_total, quote_includes, quote_sent_at, quote_accepted_at, quote_rejected_at, confirmed_at
    from public.reservations
    where status in ('PENDIENTE','ACEPTADA','EN_VIAJE')
    order by created_at desc limit 100
  ) x;
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION public.driver_history_v2(p_pin text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v json;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  select coalesce(json_agg(x order by x.updated_at desc),'[]'::json) into v
  from (
    select id, code, customer_name, customer_phone, pickup_date, pickup_time, passengers, comments,
           origin_text, destination_text, status, created_at, updated_at,
           route_distance_km, route_duration_min, quote_status, quote_price_per_km, quote_minimum,
           quote_tolls, quote_waiting, quote_pickup_extra, quote_other, quote_reference_total,
           quote_final_total, quote_includes, quote_sent_at, quote_accepted_at, quote_rejected_at, confirmed_at
    from public.reservations
    where status in ('FINALIZADA','CANCELADA','RECHAZADA')
    order by updated_at desc limit 200
  ) x;
  return v;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.customer_create_reservation_v10(text,date,time without time zone,integer,text,text,double precision,double precision,text,double precision,double precision,numeric,integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_send_quote_v10(text,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_quote_decision_v10(text,uuid,boolean) TO anon, authenticated, service_role;