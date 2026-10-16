-- Tu viaje immediate/short-horizon: passenger sees a locked fare; PIN driver decides.
-- ADDITIVE: existing scheduled reservation, quote and transition RPCs untouched.
-- Do not apply until PR99 passenger + updated Conductor apps pass E2E validation.
BEGIN;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS fare_mode text NOT NULL DEFAULT 'quote';
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_fare_mode_check
  CHECK (fare_mode IN ('quote','fixed'));

-- Preserve all previous quote states and add the immutable waiting-for-driver
-- state, so an older Conductor cannot submit a modified price for a fixed trip.
ALTER TABLE public.reservations DROP CONSTRAINT reservations_quote_status_chk;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_quote_status_chk
  CHECK (quote_status IN (
    'SIN_PRESUPUESTO','ENVIADO','ACEPTADO','RECHAZADO','PRECIO_FIJO'
  ));

CREATE OR REPLACE FUNCTION public.customer_request_pickup_fixed_v1(
  p_request_id uuid,
  p_mode text,
  p_origin_text text, p_origin_lat double precision, p_origin_lng double precision,
  p_destination_text text, p_destination_lat double precision, p_destination_lng double precision,
  p_passengers integer, p_comments text,
  p_session_token text, p_customer_name text, p_customer_phone text,
  p_origin_department text, p_destination_department text, p_stops jsonb,
  p_route_distance_km numeric, p_route_duration_min integer,
  p_expected_rate numeric, p_expected_total numeric, p_route_source text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE
  receipt jsonb;
  v public.reservations%rowtype;
  rate numeric;
  fare numeric;
  line_km numeric;
BEGIN
  -- Do not convert scheduled reservations or unverified/offline routes to a locked fare.
  IF p_mode IS NULL OR p_mode='schedule'
     OR NOT (p_mode='now' OR p_mode ~ '^([1-9]|[1-9][0-9]|1[01][0-9]|120)$')
     OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'La tarifa directa solo corresponde a Tu viaje';
  END IF;
  IF p_route_source NOT IN ('openrouteservice','supabase_route_cache')
     OR p_route_distance_km IS NULL OR p_route_distance_km <= 0
     OR p_route_distance_km > 2500 OR scale(p_route_distance_km)>1
     OR p_route_duration_min IS NULL OR p_route_duration_min<1 OR p_route_duration_min>3000 THEN
    RAISE EXCEPTION 'No pudimos verificar la distancia y duración del trayecto. Reintentá';
  END IF;
  -- Plausibility check, not cryptographic proof: this value originates in the
  -- reviewed public road engine; the PIN driver must still approve the full fare.
  line_km:=public.availability_haversine_km_v11_4(
    p_origin_lat,p_origin_lng,p_destination_lat,p_destination_lng);
  IF line_km IS NULL OR p_route_distance_km < greatest(0.1,round(line_km::numeric*0.90,1)) THEN
    RAISE EXCEPTION 'La ruta indicada no coincide con el trayecto. Volvé a calcular';
  END IF;
  -- This existing RPC checks customer credentials, coordinates, stops, request
  -- quotas, and UUID idempotency. All effects roll back if later guards fail.
  receipt:=public.customer_request_pickup_v1(
    p_request_id,p_mode,p_origin_text,p_origin_lat,p_origin_lng,
    p_destination_text,p_destination_lat,p_destination_lng,p_passengers,p_comments,
    p_session_token,p_customer_name,p_customer_phone,p_origin_department,
    p_destination_department,p_stops
  )::jsonb;
  -- Authenticate and check UUID idempotency BEFORE validating a changed fare:
  -- a confirmed prior receipt remains recoverable after rate config changes.
  SELECT * INTO v FROM public.reservations
   WHERE id=(receipt->>'id')::uuid AND client_request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo verificar la solicitud'; END IF;
  IF v.fare_mode='fixed' THEN
    IF v.route_distance_km IS DISTINCT FROM p_route_distance_km
       OR v.route_duration_min IS DISTINCT FROM p_route_duration_min
       OR v.quote_final_total IS DISTINCT FROM fare
       OR v.quote_price_per_km IS DISTINCT FROM rate THEN
      RAISE EXCEPTION 'Solicitud ya utilizada con otro importe o recorrido';
    END IF;
  ELSIF v.fare_mode='quote' AND v.status='PENDIENTE'
         AND v.quote_status='SIN_PRESUPUESTO' AND receipt->>'reused'='false' THEN
  -- Serialize fare configuration changes with request creation.
  SELECT reference_rate_uyu_per_km INTO rate
    FROM public.driver_settings WHERE singleton_id=1 FOR SHARE;
  IF rate IS NULL OR rate<1 OR rate>1000 THEN
    RAISE EXCEPTION 'Tarifa temporalmente no disponible';
  END IF;
  fare:=round(p_route_distance_km*rate,2);
  IF p_expected_rate IS DISTINCT FROM rate OR p_expected_total IS DISTINCT FROM fare THEN
    RAISE EXCEPTION 'El precio cambió. Actualizá el trayecto antes de solicitar';
  END IF;
    UPDATE public.reservations SET
      fare_mode='fixed',
      route_distance_km=p_route_distance_km,
      route_duration_min=p_route_duration_min,
      quote_price_per_km=rate,
      quote_minimum=0,quote_tolls=0,quote_waiting=0,quote_pickup_extra=0,quote_other=0,
      quote_reference_total=fare,quote_final_total=fare,
      quote_status='PRECIO_FIJO',quote_includes='Traslado al precio indicado, sin extras',
      quote_sent_at=NULL
     WHERE id=v.id RETURNING * INTO v;
  ELSE
    RAISE EXCEPTION 'Esta solicitud ya usa otro proceso de confirmación';
  END IF;
  RETURN (receipt || jsonb_build_object(
    'fare_mode','fixed','quote_final_total',v.quote_final_total,
    'route_distance_km',v.route_distance_km,'route_duration_min',v.route_duration_min,
    'status',v.status,'quote_status',v.quote_status))::json;
END;
$function$;

CREATE OR REPLACE FUNCTION public.driver_decide_fixed_pickup_v1(
  p_pin text, p_reservation_id uuid, p_accept boolean
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE
  r public.reservations%rowtype;
  fit jsonb;
  duration integer;
BEGIN
  IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
  IF p_reservation_id IS NULL OR p_accept IS NULL THEN RAISE EXCEPTION 'Decisión inválida'; END IF;
  -- Lock order matches quote acceptance, preventing overlapping confirmations.
  IF p_accept THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('traslados_availability',0));
  END IF;
  SELECT * INTO r FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR r.fare_mode <> 'fixed' THEN
    RAISE EXCEPTION 'Esta solicitud no admite aceptación directa';
  END IF;
  IF r.status='ACEPTADA' AND r.quote_status='ACEPTADO' AND p_accept THEN
    RETURN json_build_object('id',r.id,'code',r.code,'status',r.status,
      'fare_mode',r.fare_mode,'quote_final_total',r.quote_final_total,'already_decided',true);
  END IF;
  IF r.status='RECHAZADA' AND r.quote_status='RECHAZADO' AND NOT p_accept THEN
    RETURN json_build_object('id',r.id,'code',r.code,'status',r.status,'already_decided',true);
  END IF;
  IF r.status <> 'PENDIENTE' OR r.quote_status <> 'PRECIO_FIJO'
     OR r.quote_final_total IS NULL OR r.quote_final_total<=0
     OR r.route_distance_km IS NULL OR r.route_distance_km<=0 THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta o su precio no está verificado';
  END IF;
  IF p_accept THEN
    IF r.created_at < now()-interval '90 minutes' THEN
      RAISE EXCEPTION 'La solicitud inmediata venció';
    END IF;
    duration:=public.availability_duration(r.route_duration_min);
    fit:=public.availability_route_check_v11_4(
       r.pickup_date,r.pickup_time,duration,r.origin_lat,r.origin_lng,
       r.destination_lat,r.destination_lng,r.id,false,false);
    IF fit->>'reason' <> 'AVAILABLE' THEN
      RAISE EXCEPTION 'HORARIO_YA_NO_DISPONIBLE' USING DETAIL=fit->>'reason';
    END IF;
    UPDATE public.reservations SET
      status='ACEPTADA',quote_status='ACEPTADO',
      quote_accepted_at=now(),confirmed_at=now()
      WHERE id=r.id RETURNING * INTO r;
  ELSE
    UPDATE public.reservations SET
      status='RECHAZADA',quote_status='RECHAZADO',quote_rejected_at=now()
      WHERE id=r.id RETURNING * INTO r;
  END IF;
  RETURN json_build_object('id',r.id,'code',r.code,'status',r.status,
    'fare_mode',r.fare_mode,'quote_status',r.quote_status,
    'quote_final_total',r.quote_final_total,'confirmed_at',r.confirmed_at,
    'pickup_phase',r.pickup_phase);
END;
$function$;

-- v2 list lacked mode; v3 used it and still works. Expose fixed/quote mode
-- explicitly in Conductor with a new additive RPC; do not change v3 readers.
CREATE OR REPLACE FUNCTION public.driver_list_reservations_v4(p_pin text)
RETURNS json LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
SELECT coalesce(json_agg(b.value || jsonb_build_object('fare_mode',r.fare_mode)),
                '[]'::json)
FROM jsonb_array_elements(public.driver_list_reservations_v3(p_pin)::jsonb) b(value)
JOIN public.reservations r ON r.id=(b.value->>'id')::uuid;
$function$;

CREATE OR REPLACE FUNCTION public.customer_list_reservations_v16(p_session_token text)
RETURNS json LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
SELECT coalesce(json_agg(b.value || jsonb_build_object(
    'fare_mode',r.fare_mode,'pickup_mode',r.pickup_mode)), '[]'::json)
FROM jsonb_array_elements(public.customer_list_reservations_v15(p_session_token)::jsonb) b(value)
JOIN public.reservations r ON r.id=(b.value->>'id')::uuid;
$function$;

CREATE OR REPLACE FUNCTION public.get_reservation_by_token_v5(p_token text)
RETURNS json LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
SELECT (b.value || jsonb_build_object(
    'fare_mode',r.fare_mode,'pickup_mode',r.pickup_mode))::json
FROM (SELECT public.get_reservation_by_token_v4(p_token)::jsonb AS value) b
JOIN public.reservations r ON r.id=(b.value->>'id')::uuid;
$function$;

REVOKE ALL ON FUNCTION public.driver_decide_fixed_pickup_v1(text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_decide_fixed_pickup_v1(text,uuid,boolean) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.driver_list_reservations_v4(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_list_reservations_v4(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.customer_request_pickup_fixed_v1(uuid,text,text,double precision,double precision,text,double precision,double precision,integer,text,text,text,text,text,text,jsonb,numeric,integer,numeric,numeric,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.customer_list_reservations_v16(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_reservation_by_token_v5(text) TO anon,authenticated;
COMMIT;
