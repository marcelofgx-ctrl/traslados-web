-- Vehículo: exponer matrícula únicamente al pasajero dueño de un traslado activo.
-- Supabase puede admitir visitantes con token de reserva o sesiones de cliente.
-- No se devuelve matrícula para pasajeros no autorizados, reservas pendientes o cerradas.
CREATE OR REPLACE FUNCTION public.customer_reservation_vehicle_v1(
  p_reservation_id uuid,
  p_session_token text DEFAULT NULL,
  p_public_token text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $body$
DECLARE
  v_res public.reservations%rowtype;
  v_customer_id uuid;
BEGIN
  IF p_reservation_id IS NULL THEN RETURN json_build_object('plate',NULL); END IF;
  IF nullif(btrim(coalesce(p_session_token,'')),'') IS NOT NULL THEN
    v_customer_id := public.availability_session_customer(p_session_token);
    IF v_customer_id IS NULL THEN RETURN json_build_object('plate',NULL); END IF;
    SELECT * INTO v_res FROM public.reservations
     WHERE id=p_reservation_id AND customer_id=v_customer_id;
  ELSE
    IF length(coalesce(p_public_token,''))<48 THEN
      RETURN json_build_object('plate',NULL);
    END IF;
    SELECT * INTO v_res FROM public.reservations
      WHERE id=p_reservation_id AND public_token=p_public_token;
  END IF;
  IF NOT FOUND THEN RETURN json_build_object('plate',NULL); END IF;
  IF v_res.status IN ('ACEPTADA','ACEPTADA_CLIENTE','CONFIRMADA','EN_VIAJE')
     AND (v_res.pickup_phase IN ('EN_CAMINO','EN_PUNTO')
          OR v_res.status='EN_VIAJE') THEN
    RETURN (SELECT json_build_object('plate',vehicle_plate) FROM public.driver_settings WHERE singleton_id=1);
  END IF;
  RETURN json_build_object('plate',NULL);
END;
$body$;
REVOKE ALL ON FUNCTION public.customer_reservation_vehicle_v1(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_reservation_vehicle_v1(uuid,text,text) TO anon,authenticated,service_role;
-- Se retira el acceso público indiscriminado de la primera función piloto.
REVOKE EXECUTE ON FUNCTION public.driver_public_vehicle_v1() FROM anon,authenticated,service_role;
