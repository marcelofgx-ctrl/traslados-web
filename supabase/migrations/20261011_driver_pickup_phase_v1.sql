-- Fase seguimiento conductor: estado de recogida independiente del viaje.
-- NO modifica reservation_status ni la agenda existente.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS pickup_phase text NOT NULL DEFAULT 'SIN_INICIAR',
  ADD COLUMN IF NOT EXISTS pickup_phase_updated_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.reservations'::regclass
     AND conname='reservations_pickup_phase_allowed') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_pickup_phase_allowed
      CHECK (pickup_phase IN ('SIN_INICIAR','EN_CAMINO','EN_PUNTO'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.driver_set_pickup_phase_v1(
  p_pin text,p_reservation_id uuid,p_phase text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE r public.reservations%rowtype;
BEGIN
  IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
  IF p_reservation_id IS NULL OR p_phase NOT IN ('EN_CAMINO','EN_PUNTO') THEN
    RAISE EXCEPTION 'Estado de recogida inválido';
  END IF;
  SELECT * INTO r FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
  IF r.status<>'ACEPTADA' THEN
    RAISE EXCEPTION 'La recogida solo puede marcarse tras la aceptación del traslado';
  END IF;
  IF r.pickup_phase=p_phase THEN
    RETURN json_build_object('id',r.id,'code',r.code,'pickup_phase',r.pickup_phase,
      'pickup_phase_updated_at',r.pickup_phase_updated_at);
  END IF;
  IF p_phase='EN_PUNTO' AND r.pickup_phase<>'EN_CAMINO' THEN
    RAISE EXCEPTION 'Primero marcá En camino';
  END IF;
  IF r.pickup_phase='EN_PUNTO' THEN
    RAISE EXCEPTION 'El conductor ya indicó que llegó';
  END IF;
  UPDATE public.reservations SET pickup_phase=p_phase,pickup_phase_updated_at=now()
  WHERE id=p_reservation_id RETURNING * INTO r;
  RETURN json_build_object('id',r.id,'code',r.code,
    'pickup_phase',r.pickup_phase,'pickup_phase_updated_at',r.pickup_phase_updated_at);
END
$function$;

CREATE OR REPLACE FUNCTION public.customer_list_reservations_v13(p_session_token text)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','extensions','pg_temp'
AS $function$
  SELECT COALESCE(json_agg(x ORDER BY
    (x->>'pickup_date') DESC, (x->>'pickup_time') DESC),'[]'::json)
  FROM (
    SELECT (b.value || jsonb_build_object(
      'pickup_phase',r.pickup_phase,
      'pickup_phase_updated_at',r.pickup_phase_updated_at)) AS x
    FROM jsonb_array_elements(public.customer_list_reservations_v12(p_session_token)::jsonb) b(value)
    JOIN public.reservations r ON r.id=(b.value->>'id')::uuid
  ) q
$function$;

CREATE OR REPLACE FUNCTION public.get_reservation_by_token_v2(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE old_data jsonb; phase_data record;
BEGIN
  old_data:=public.get_reservation_by_token(p_token)::jsonb;
  IF old_data IS NULL THEN RETURN NULL; END IF;
  SELECT r.pickup_phase,r.pickup_phase_updated_at INTO phase_data
    FROM public.reservations r WHERE r.public_token=p_token;
  RETURN (old_data||jsonb_build_object('pickup_phase',phase_data.pickup_phase,
    'pickup_phase_updated_at',phase_data.pickup_phase_updated_at))::json;
END
$function$;

CREATE OR REPLACE FUNCTION public.driver_list_reservations_v3(p_pin text)
RETURNS json LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
  SELECT COALESCE(json_agg(x),'[]'::json)
  FROM (
    SELECT (b.value || jsonb_build_object('pickup_phase',r.pickup_phase,
      'pickup_phase_updated_at',r.pickup_phase_updated_at)) AS x
    FROM jsonb_array_elements(public.driver_list_reservations_v2(p_pin)::jsonb) b(value)
    JOIN public.reservations r ON r.id=(b.value->>'id')::uuid
  ) q
$function$;

REVOKE ALL ON FUNCTION public.driver_set_pickup_phase_v1(text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_list_reservations_v13(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_reservation_by_token_v2(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_list_reservations_v3(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_set_pickup_phase_v1(text,uuid,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.customer_list_reservations_v13(text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_reservation_by_token_v2(text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.driver_list_reservations_v3(text) TO anon,authenticated,service_role;
