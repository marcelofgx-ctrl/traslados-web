-- Recogida rápida 1..120 minutos sin convertirse en reserva programada.
-- Compatible con ahora/10; conserva histórico, cuotas e idempotencia.
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_pickup_mode_allowed;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_pickup_mode_allowed
CHECK (pickup_mode IN ('schedule','now') OR pickup_mode ~ '^([1-9]|[1-9][0-9]|1[01][0-9]|120)$');
ALTER TABLE public.driver_settings ADD COLUMN IF NOT EXISTS vehicle_plate text NOT NULL DEFAULT 'APP-0061';




CREATE OR REPLACE FUNCTION public.customer_request_pickup_v1(
  p_request_id uuid,
  p_mode text,
  p_origin_text text,
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_destination_text text,
  p_destination_lat double precision,
  p_destination_lng double precision,
  p_passengers integer,
  p_comments text,
  p_session_token text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_origin_department text DEFAULT NULL,
  p_destination_department text DEFAULT NULL,
  p_stops jsonb DEFAULT '[]'::jsonb
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE
  v_customer_id uuid;
  v_name text;
  v_phone text;
  v_phone_digits text;
  v_mode text := btrim(coalesce(p_mode,''));
  v_stops jsonb := coalesce(p_stops,'[]'::jsonb);
  v_item jsonb;
  v_position integer:=0;
  v_local_time timestamp;
  v_row public.reservations%rowtype;
  v_existing public.reservations%rowtype;
  v_count integer;
BEGIN
  IF p_request_id IS NULL OR NOT (v_mode='now' OR
    (v_mode ~ '^([1-9]|[1-9][0-9]|1[01][0-9]|120)$')) THEN
    RAISE EXCEPTION 'Modo de recogida o identificador inválido';
  END IF;
  IF p_session_token IS NOT NULL AND btrim(p_session_token)<>'' THEN
    v_customer_id:=public.availability_session_customer(p_session_token);
    IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Sesión inválida'; END IF;
    SELECT c.full_name,c.phone_display INTO v_name,v_phone
      FROM public.customers c WHERE c.id=v_customer_id AND c.active;
    IF v_name IS NULL THEN RAISE EXCEPTION 'Cuenta inactiva'; END IF;
  ELSE
    v_name:=btrim(coalesce(p_customer_name,''));
    v_phone:=btrim(coalesce(p_customer_phone,''));
  END IF;
  v_phone_digits:=regexp_replace(coalesce(v_phone,''),'[^0-9]','','g');
  IF length(v_name) NOT BETWEEN 2 AND 120 OR length(v_phone_digits) NOT BETWEEN 8 AND 15 THEN
    RAISE EXCEPTION 'Indicá un nombre y teléfono válidos';
  END IF;
  IF p_passengers IS NULL OR p_passengers NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'Cantidad de pasajeros inválida';
  END IF;
  IF length(coalesce(p_comments,''))>500 THEN
    RAISE EXCEPTION 'Indicaciones demasiado extensas';
  END IF;
  IF length(btrim(coalesce(p_origin_text,''))) NOT BETWEEN 3 AND 500
     OR length(btrim(coalesce(p_destination_text,''))) NOT BETWEEN 3 AND 500
     OR p_origin_lat IS NULL OR p_origin_lng IS NULL
     OR p_destination_lat IS NULL OR p_destination_lng IS NULL
     OR NOT (p_origin_lat BETWEEN -35.3 AND -30 AND p_destination_lat BETWEEN -35.3 AND -30
         AND p_origin_lng BETWEEN -58.8 AND -52.9 AND p_destination_lng BETWEEN -58.8 AND -52.9)
     OR (p_origin_lat=p_destination_lat AND p_origin_lng=p_destination_lng) THEN
    RAISE EXCEPTION 'Origen o destino sin dirección verificada en Uruguay';
  END IF;
  IF jsonb_typeof(v_stops)<>'array' OR jsonb_array_length(v_stops)>8 THEN
    RAISE EXCEPTION 'Paradas inválidas';
  END IF;
  IF jsonb_array_length(v_stops)>0 AND v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Iniciá sesión para agregar paradas';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_stops)
  LOOP
    v_position:=v_position+1;
    IF jsonb_typeof(v_item)<>'object' OR (v_item->>'position')::integer IS DISTINCT FROM v_position
       OR length(btrim(coalesce(v_item->>'address_text',''))) NOT BETWEEN 3 AND 500
       OR (v_item->>'lat')::double precision NOT BETWEEN -35.3 AND -30
       OR (v_item->>'lng')::double precision NOT BETWEEN -58.8 AND -52.9 THEN
      RAISE EXCEPTION 'Parada % inválida',v_position;
    END IF;
  END LOOP;

  -- Una sola transacción concurrente por teléfono; protege contra doble toque.
  PERFORM pg_advisory_xact_lock(hashtextextended('pickup:'||v_phone_digits,0));
  SELECT * INTO v_existing FROM public.reservations
    WHERE client_request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.pickup_mode<>v_mode OR
       (v_customer_id IS NOT NULL AND v_existing.customer_id IS DISTINCT FROM v_customer_id) OR
       (v_customer_id IS NULL AND
          (v_existing.customer_id IS NOT NULL OR regexp_replace(v_existing.customer_phone,'[^0-9]','','g')<>v_phone_digits)) THEN
      RAISE EXCEPTION 'Solicitud ya utilizada con otros datos';
    END IF;
    RETURN json_build_object('id',v_existing.id,'code',v_existing.code,
      'public_token',CASE WHEN v_customer_id IS NULL THEN v_existing.public_token ELSE NULL END,
      'status',v_existing.status,'pickup_mode',v_existing.pickup_mode,
      'pickup_date',v_existing.pickup_date,'pickup_time',to_char(v_existing.pickup_time,'HH24:MI'),
      'created_at',v_existing.created_at,'reused',true);
  END IF;
  SELECT count(*) INTO v_count FROM public.reservations r
    WHERE r.pickup_mode <> 'schedule' AND r.created_at>now()-interval '15 minutes'
      AND (r.customer_id=v_customer_id AND v_customer_id IS NOT NULL OR
           regexp_replace(r.customer_phone,'[^0-9]','','g')=v_phone_digits);
  IF v_count>=3 THEN RAISE EXCEPTION 'Demasiadas solicitudes recientes. Esperá unos minutos'; END IF;
  IF EXISTS(SELECT 1 FROM public.reservations r
    WHERE r.pickup_mode <> 'schedule' AND r.created_at>now()-interval '2 minutes'
      AND r.status='PENDIENTE'
      AND (r.customer_id=v_customer_id AND v_customer_id IS NOT NULL OR
           regexp_replace(r.customer_phone,'[^0-9]','','g')=v_phone_digits)) THEN
    RAISE EXCEPTION 'Ya tenés una solicitud reciente pendiente. Consultá Mis traslados';
  END IF;
  SELECT count(*) INTO v_count FROM public.reservations
    WHERE pickup_mode <> 'schedule' AND created_at>now()-interval '1 minute';
  IF v_count>=30 THEN
    RAISE EXCEPTION 'Hay muchas solicitudes en este momento. Reintentá en un minuto';
  END IF;

  v_local_time:=(clock_timestamp() at time zone 'America/Montevideo')
    + CASE WHEN v_mode='now' THEN interval '0 minutes' ELSE v_mode::integer * interval '1 minute' END;
  INSERT INTO public.reservations (
    code,public_token,customer_id,customer_name,customer_phone,
    pickup_date,pickup_time,pickup_mode,client_request_id,
    passengers,comments,origin_text,origin_lat,origin_lng,origin_department,
    destination_text,destination_lat,destination_lng,destination_department,
    status,quote_status
  ) VALUES (
    public.generate_reservation_code(),encode(extensions.gen_random_bytes(32),'hex'),
    v_customer_id,v_name,v_phone,
    v_local_time::date,v_local_time::time,v_mode,p_request_id,
    p_passengers,nullif(btrim(coalesce(p_comments,'')),''),
    btrim(p_origin_text),p_origin_lat,p_origin_lng,nullif(btrim(coalesce(p_origin_department,'')),''),
    btrim(p_destination_text),p_destination_lat,p_destination_lng,
    nullif(btrim(coalesce(p_destination_department,'')),''),
    'PENDIENTE','SIN_PRESUPUESTO'
  ) RETURNING * INTO v_row;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_stops)
  LOOP
    INSERT INTO public.reservation_stops (reservation_id,position,address_text,lat,lng,department)
      VALUES(v_row.id,(v_item->>'position')::integer,btrim(v_item->>'address_text'),
             (v_item->>'lat')::double precision,(v_item->>'lng')::double precision,
             nullif(btrim(coalesce(v_item->>'department','')),''));
  END LOOP;
  RETURN json_build_object('id',v_row.id,'code',v_row.code,
    'public_token',CASE WHEN v_customer_id IS NULL THEN v_row.public_token ELSE NULL END,
    'status',v_row.status,'pickup_mode',v_row.pickup_mode,
    'pickup_date',v_row.pickup_date,'pickup_time',to_char(v_row.pickup_time,'HH24:MI'),
    'created_at',v_row.created_at,'reused',false);
END;
$function$;


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
    IF v_res.pickup_mode='schedule' AND v_res.pickup_date+v_res.pickup_time <= (now() at time zone 'America/Montevideo') THEN
      RAISE EXCEPTION 'La hora de recogida programada ya pasó. Solicitá un nuevo traslado';
    END IF;
    IF v_res.pickup_mode <> 'schedule'
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


CREATE OR REPLACE FUNCTION public.driver_send_quote_v10(p_pin text, p_reservation_id uuid, p_route_distance_km numeric, p_price_per_km numeric, p_minimum numeric, p_tolls numeric, p_waiting numeric, p_pickup_extra numeric, p_other numeric, p_reference_total numeric, p_final_total numeric, p_includes text DEFAULT NULL::text, p_route_duration_min integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.reservations;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  if exists(select 1 from public.reservations r
    where r.id=p_reservation_id and r.status='PENDIENTE'
      and r.pickup_mode='schedule'
      and r.pickup_date+r.pickup_time <= (now() at time zone 'America/Montevideo')) then
    raise exception 'La hora de recogida programada ya pasó. Pedile al pasajero que envíe una nueva solicitud.';
  end if;
  -- The customer_quote_decision_v13 RPC rejects immediate requests after
  -- 90 minutes. Do not let Conductor send an unacceptably late quote.
  if exists (
    select 1 from public.reservations r
    where r.id=p_reservation_id and r.status='PENDIENTE'
      and r.pickup_mode <> 'schedule'
      and r.created_at < now()-interval '90 minutes'
  ) then
    raise exception 'La solicitud inmediata venció. Pedile al pasajero que envíe una nueva solicitud.';
  end if;
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
$function$


CREATE OR REPLACE FUNCTION public.driver_send_quote_v10_7(p_pin text, p_reservation_id uuid, p_route_distance_km numeric, p_price_per_km numeric, p_minimum numeric, p_toll_count integer, p_toll_unit_value numeric, p_waiting numeric, p_pickup_extra numeric, p_other numeric, p_reference_total numeric, p_final_total numeric, p_includes text DEFAULT NULL::text, p_route_duration_min integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.reservations; v_count integer := coalesce(p_toll_count,0); v_unit numeric := coalesce(p_toll_unit_value,0);
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  if exists(select 1 from public.reservations r
    where r.id=p_reservation_id and r.status='PENDIENTE'
      and r.pickup_mode='schedule'
      and r.pickup_date+r.pickup_time <= (now() at time zone 'America/Montevideo')) then
    raise exception 'La hora de recogida programada ya pasó. Pedile al pasajero que envíe una nueva solicitud.';
  end if;
  -- The customer_quote_decision_v13 RPC rejects immediate requests after
  -- 90 minutes. Do not let Conductor send an unacceptably late quote.
  if exists (
    select 1 from public.reservations r
    where r.id=p_reservation_id and r.status='PENDIENTE'
      and r.pickup_mode <> 'schedule'
      and r.created_at < now()-interval '90 minutes'
  ) then
    raise exception 'La solicitud inmediata venció. Pedile al pasajero que envíe una nueva solicitud.';
  end if;
  if v_count < 0 or v_unit < 0 then raise exception 'Los peajes no pueden ser negativos'; end if;
  if p_final_total is null or p_final_total < 0 then raise exception 'Total final inválido'; end if;
  if least(coalesce(p_route_distance_km,0),coalesce(p_price_per_km,0),coalesce(p_minimum,0),
           coalesce(p_waiting,0),coalesce(p_pickup_extra,0),coalesce(p_other,0),coalesce(p_reference_total,0),
           coalesce(p_route_duration_min,0)) < 0 then
    raise exception 'Los importes no pueden ser negativos';
  end if;

  update public.reservations set
    route_distance_km=coalesce(p_route_distance_km,route_distance_km),
    route_duration_min=coalesce(p_route_duration_min,route_duration_min),
    quote_price_per_km=p_price_per_km, quote_minimum=p_minimum,
    quote_toll_count=v_count, quote_toll_unit_value=v_unit, quote_tolls=v_count * v_unit,
    quote_waiting=p_waiting, quote_pickup_extra=p_pickup_extra, quote_other=p_other,
    quote_reference_total=p_reference_total, quote_final_total=p_final_total,
    quote_includes=nullif(btrim(coalesce(p_includes,'')),''),
    quote_status='ENVIADO', quote_sent_at=now()
  where id=p_reservation_id and status='PENDIENTE' and quote_status in ('SIN_PRESUPUESTO','ENVIADO')
  returning * into v;
  if not found then raise exception 'La reserva no admite presupuesto (no está pendiente o ya fue decidida)'; end if;

  return json_build_object('ok',true,'id',v.id,'code',v.code,'status',v.status,'quote_status',v.quote_status,
    'route_distance_km',v.route_distance_km,'route_duration_min',v.route_duration_min,
    'quote_price_per_km',v.quote_price_per_km,'quote_minimum',v.quote_minimum,
    'quote_toll_count',v.quote_toll_count,'quote_toll_unit_value',v.quote_toll_unit_value,'quote_tolls',v.quote_tolls,
    'quote_waiting',v.quote_waiting,'quote_pickup_extra',v.quote_pickup_extra,'quote_other',v.quote_other,
    'quote_reference_total',v.quote_reference_total,'quote_final_total',v.quote_final_total,
    'quote_includes',v.quote_includes,'quote_sent_at',v.quote_sent_at,'updated_at',v.updated_at);
end;
$function$


CREATE OR REPLACE FUNCTION public.driver_get_vehicle_settings_v1(p_pin text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $body$
BEGIN
 IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
 RETURN (SELECT json_build_object('plate',vehicle_plate) FROM public.driver_settings WHERE singleton_id=1);
END;
$body$;
CREATE OR REPLACE FUNCTION public.driver_set_vehicle_plate_v1(p_pin text,p_plate text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $body$
DECLARE v_plate text := upper(btrim(coalesce(p_plate,'')));
BEGIN
 IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
 IF v_plate !~ '^[A-Z0-9]{2,4}-[A-Z0-9]{3,5}$' THEN RAISE EXCEPTION 'Matrícula inválida, formato APP-0061'; END IF;
 UPDATE public.driver_settings SET vehicle_plate=v_plate,updated_at=now() WHERE singleton_id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Configuración del vehículo no disponible'; END IF;
 RETURN json_build_object('plate',v_plate,'saved',true);
END;
$body$;
CREATE OR REPLACE FUNCTION public.driver_public_vehicle_v1()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $body$
 SELECT coalesce((SELECT json_build_object('plate',vehicle_plate) FROM public.driver_settings WHERE singleton_id=1),json_build_object('plate','APP-0061'));
$body$;
REVOKE ALL ON FUNCTION public.driver_get_vehicle_settings_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_set_vehicle_plate_v1(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_public_vehicle_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_get_vehicle_settings_v1(text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.driver_set_vehicle_plate_v1(text,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.driver_public_vehicle_v1() TO anon,authenticated,service_role;
