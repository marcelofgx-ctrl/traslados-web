-- Contrato aditivo para confirmar/rechazar presupuestos desde Cliente Premium.
-- Compatible con cuenta autenticada y acceso invitado por token aleatorio.
-- Conserva el bloqueo de agenda original; no acepta horarios obsoletos programados.
CREATE OR REPLACE FUNCTION public.customer_quote_decision_v13(
  p_reservation_id uuid DEFAULT NULL,
  p_accept boolean DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_public_token text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
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
      v_res.id,false,v_res.pickup_mode='schedule');
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
$function$;
REVOKE ALL ON FUNCTION public.customer_quote_decision_v13(uuid,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_quote_decision_v13(uuid,boolean,text,text) TO anon,authenticated,service_role;
