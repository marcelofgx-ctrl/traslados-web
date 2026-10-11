-- Traslados: solicitud inmediata real, aislada de la agenda programada.
-- El pasajero no suministra la fecha/hora: se fijan en el servidor (Montevideo).
-- Cambio aditivo: ninguna reserva histórica ni RPC previa se modifica.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS pickup_mode text NOT NULL DEFAULT 'schedule',
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='reservations_pickup_mode_allowed' AND conrelid='public.reservations'::regclass) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_pickup_mode_allowed
      CHECK (pickup_mode IN ('schedule','now','10'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_urgent_request_id_idx
ON public.reservations(client_request_id)
WHERE client_request_id IS NOT NULL;

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
  IF p_request_id IS NULL OR v_mode NOT IN ('now','10') THEN
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
    WHERE r.pickup_mode IN ('now','10') AND r.created_at>now()-interval '15 minutes'
      AND (r.customer_id=v_customer_id AND v_customer_id IS NOT NULL OR
           regexp_replace(r.customer_phone,'[^0-9]','','g')=v_phone_digits);
  IF v_count>=3 THEN RAISE EXCEPTION 'Demasiadas solicitudes recientes. Esperá unos minutos'; END IF;
  IF EXISTS(SELECT 1 FROM public.reservations r
    WHERE r.pickup_mode IN ('now','10') AND r.created_at>now()-interval '2 minutes'
      AND r.status='PENDIENTE'
      AND (r.customer_id=v_customer_id AND v_customer_id IS NOT NULL OR
           regexp_replace(r.customer_phone,'[^0-9]','','g')=v_phone_digits)) THEN
    RAISE EXCEPTION 'Ya tenés una solicitud reciente pendiente. Consultá Mis traslados';
  END IF;
  SELECT count(*) INTO v_count FROM public.reservations
    WHERE pickup_mode IN ('now','10') AND created_at>now()-interval '1 minute';
  IF v_count>=30 THEN
    RAISE EXCEPTION 'Hay muchas solicitudes en este momento. Reintentá en un minuto';
  END IF;

  v_local_time:=(clock_timestamp() at time zone 'America/Montevideo')
    + CASE WHEN v_mode='10' THEN interval '10 minutes' ELSE interval '0 minutes' END;
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

REVOKE ALL ON FUNCTION public.customer_request_pickup_v1(
  uuid,text,text,double precision,double precision,text,double precision,double precision,integer,text,
  text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_request_pickup_v1(
  uuid,text,text,double precision,double precision,text,double precision,double precision,integer,text,
  text,text,text,text,text,jsonb) TO anon,authenticated,service_role;
