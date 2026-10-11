-- Traslados: canal bidireccional por reserva, SIN ubicación del conductor.
-- Migración aditiva; acceso exclusivamente mediante RPCs con sesión/token/PIN.
CREATE TABLE IF NOT EXISTS public.reservation_chat_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','driver')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 800),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reservation_id,sender_role,request_id)
);
CREATE INDEX IF NOT EXISTS reservation_chat_messages_recent_idx
ON public.reservation_chat_messages(reservation_id,id DESC);
CREATE INDEX IF NOT EXISTS reservation_chat_messages_driver_feed_idx
ON public.reservation_chat_messages(id) WHERE sender_role='customer';
ALTER TABLE public.reservation_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reservation_chat_messages FROM anon,authenticated;
REVOKE ALL ON SEQUENCE public.reservation_chat_messages_id_seq FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.customer_trip_chat_v1(
 p_reservation_id uuid,p_session_token text DEFAULT NULL,
 p_public_token text DEFAULT NULL,p_after_id bigint DEFAULT 0
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $$
DECLARE permitted boolean := false; customer uuid;
BEGIN
 IF p_reservation_id IS NULL THEN RAISE EXCEPTION 'Reserva requerida'; END IF;
 IF nullif(btrim(coalesce(p_session_token,'')),'') IS NOT NULL THEN
   customer:=public.availability_session_customer(p_session_token);
   IF customer IS NULL THEN RAISE EXCEPTION 'Sesión inválida'; END IF;
   SELECT EXISTS(SELECT 1 FROM public.reservations
     WHERE id=p_reservation_id AND customer_id=customer) INTO permitted;
 ELSE
   IF length(coalesce(p_public_token,'')) < 48 THEN RAISE EXCEPTION 'Acceso a reserva inválido'; END IF;
   SELECT EXISTS(SELECT 1 FROM public.reservations
     WHERE id=p_reservation_id AND public_token=p_public_token) INTO permitted;
 END IF;
 IF NOT permitted THEN RAISE EXCEPTION 'Acceso a reserva no autorizado'; END IF;
 RETURN (
  SELECT COALESCE(json_agg(to_jsonb(m) ORDER BY m.id),'[]'::json)
  FROM (SELECT id,sender_role,body,created_at FROM public.reservation_chat_messages
    WHERE reservation_id=p_reservation_id AND id>greatest(coalesce(p_after_id,0),0)
    ORDER BY id DESC LIMIT 80) m);
END $$;

CREATE OR REPLACE FUNCTION public.customer_trip_chat_send_v1(
 p_reservation_id uuid,p_body text,p_request_id uuid,
 p_session_token text DEFAULT NULL,p_public_token text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $$
DECLARE customer uuid; r public.reservations%rowtype; msg public.reservation_chat_messages%rowtype;
  clean text:=btrim(coalesce(p_body,'')); recent_count integer;
BEGIN
 IF p_reservation_id IS NULL OR p_request_id IS NULL OR char_length(clean) NOT BETWEEN 1 AND 800 THEN
   RAISE EXCEPTION 'Mensaje inválido (máximo 800 caracteres)';
 END IF;
 IF clean ~ '[[:cntrl:]]' THEN
   clean:=btrim(regexp_replace(clean,'[[:cntrl:]]+',' ','g'));
 END IF;
 IF char_length(clean) NOT BETWEEN 1 AND 800 THEN RAISE EXCEPTION 'Mensaje inválido'; END IF;
 IF nullif(btrim(coalesce(p_session_token,'')),'') IS NOT NULL THEN
   customer:=public.availability_session_customer(p_session_token);
   IF customer IS NULL THEN RAISE EXCEPTION 'Sesión inválida'; END IF;
   SELECT * INTO r FROM public.reservations WHERE id=p_reservation_id AND customer_id=customer;
 ELSE
   IF length(coalesce(p_public_token,''))<48 THEN RAISE EXCEPTION 'Acceso a reserva inválido'; END IF;
   SELECT * INTO r FROM public.reservations WHERE id=p_reservation_id AND public_token=p_public_token;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no autorizada'; END IF;
 IF r.status IN ('FINALIZADA','CANCELADA','RECHAZADA','RECHAZADA_CLIENTE')
   THEN RAISE EXCEPTION 'La conversación está cerrada'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('customer-chat:'||r.id::text,0));
 SELECT * INTO msg FROM public.reservation_chat_messages
   WHERE reservation_id=r.id AND sender_role='customer' AND request_id=p_request_id;
 IF FOUND THEN
   RETURN json_build_object('id',msg.id,'sender_role',msg.sender_role,'body',msg.body,'created_at',msg.created_at,'reused',true);
 END IF;
 SELECT count(*) INTO recent_count FROM public.reservation_chat_messages
   WHERE reservation_id=r.id AND sender_role='customer' AND created_at>now()-interval '10 minutes';
 IF recent_count>=15 THEN RAISE EXCEPTION 'Demasiados mensajes. Esperá unos minutos'; END IF;
 INSERT INTO public.reservation_chat_messages(reservation_id,sender_role,body,request_id)
 VALUES (r.id,'customer',clean,p_request_id) RETURNING * INTO msg;
 RETURN json_build_object('id',msg.id,'sender_role',msg.sender_role,'body',msg.body,'created_at',msg.created_at,'reused',false);
END $$;

CREATE OR REPLACE FUNCTION public.driver_trip_chat_v1(
 p_pin text,p_reservation_id uuid,p_after_id bigint DEFAULT 0
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $$
BEGIN
 IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
 IF p_reservation_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=p_reservation_id) THEN
   RAISE EXCEPTION 'Reserva no encontrada';
 END IF;
 RETURN (SELECT COALESCE(json_agg(to_jsonb(m) ORDER BY m.id),'[]'::json)
 FROM (SELECT id,sender_role,body,created_at FROM public.reservation_chat_messages
   WHERE reservation_id=p_reservation_id AND id>greatest(coalesce(p_after_id,0),0)
   ORDER BY id DESC LIMIT 80) m);
END $$;

CREATE OR REPLACE FUNCTION public.driver_trip_chat_send_v1(
 p_pin text,p_reservation_id uuid,p_body text,p_request_id uuid
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $$
DECLARE clean text:=btrim(coalesce(p_body,'')); r public.reservations%rowtype;
  msg public.reservation_chat_messages%rowtype; recent_count integer;
BEGIN
 IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
 IF p_reservation_id IS NULL OR p_request_id IS NULL OR char_length(clean) NOT BETWEEN 1 AND 800 THEN
   RAISE EXCEPTION 'Mensaje inválido (máximo 800 caracteres)';
 END IF;
 clean:=btrim(regexp_replace(clean,'[[:cntrl:]]+',' ','g'));
 SELECT * INTO r FROM public.reservations WHERE id=p_reservation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
 IF r.status IN ('FINALIZADA','CANCELADA','RECHAZADA','RECHAZADA_CLIENTE') THEN
   RAISE EXCEPTION 'La conversación está cerrada';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('driver-chat:'||r.id::text,0));
 SELECT * INTO msg FROM public.reservation_chat_messages
  WHERE reservation_id=r.id AND sender_role='driver' AND request_id=p_request_id;
 IF FOUND THEN
   RETURN json_build_object('id',msg.id,'sender_role',msg.sender_role,'body',msg.body,'created_at',msg.created_at,'reused',true);
 END IF;
 SELECT count(*) INTO recent_count FROM public.reservation_chat_messages
   WHERE reservation_id=r.id AND sender_role='driver' AND created_at>now()-interval '10 minutes';
 IF recent_count>=25 THEN RAISE EXCEPTION 'Demasiados mensajes. Esperá unos minutos'; END IF;
 INSERT INTO public.reservation_chat_messages(reservation_id,sender_role,body,request_id)
 VALUES (r.id,'driver',clean,p_request_id) RETURNING * INTO msg;
 RETURN json_build_object('id',msg.id,'sender_role',msg.sender_role,'body',msg.body,'created_at',msg.created_at,'reused',false);
END $$;

CREATE OR REPLACE FUNCTION public.driver_trip_chat_feed_v1(
 p_pin text,p_after_id bigint DEFAULT 0
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $$
BEGIN
 IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
 RETURN (SELECT COALESCE(json_agg(to_jsonb(m) ORDER BY m.id),'[]'::json)
 FROM (SELECT c.id,c.reservation_id,r.code,c.created_at
   FROM public.reservation_chat_messages c
   JOIN public.reservations r ON r.id=c.reservation_id
   WHERE c.sender_role='customer' AND c.id>greatest(coalesce(p_after_id,0),0)
   ORDER BY c.id DESC LIMIT 40) m);
END $$;

CREATE OR REPLACE FUNCTION public.customer_list_reservations_v15(p_session_token text)
RETURNS json LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp' AS $$
 SELECT COALESCE(json_agg(x ORDER BY x->>'pickup_date' DESC,x->>'pickup_time' DESC),'[]'::json)
 FROM (
 SELECT b.value||jsonb_build_object(
   'last_driver_message_id', (SELECT MAX(id) FROM public.reservation_chat_messages c
      WHERE c.reservation_id=r.id AND c.sender_role='driver'),
   'last_driver_message_at',(SELECT MAX(created_at) FROM public.reservation_chat_messages c
      WHERE c.reservation_id=r.id AND c.sender_role='driver')
 ) AS x
 FROM jsonb_array_elements(public.customer_list_reservations_v13(p_session_token)::jsonb) b(value)
 JOIN public.reservations r ON r.id=(b.value->>'id')::uuid
 ) q
$$;
CREATE OR REPLACE FUNCTION public.get_reservation_by_token_v4(p_token text)
RETURNS json LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp' AS $$
 SELECT (public.get_reservation_by_token_v2(p_token)::jsonb || jsonb_build_object(
  'last_driver_message_id',(SELECT MAX(c.id) FROM public.reservation_chat_messages c JOIN public.reservations r
   ON r.id=c.reservation_id WHERE r.public_token=p_token AND c.sender_role='driver'),
  'last_driver_message_at',(SELECT MAX(c.created_at) FROM public.reservation_chat_messages c JOIN public.reservations r
   ON r.id=c.reservation_id WHERE r.public_token=p_token AND c.sender_role='driver')
 ))::json
$$;

REVOKE ALL ON FUNCTION public.customer_trip_chat_v1(uuid,text,text,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_trip_chat_send_v1(uuid,text,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_trip_chat_v1(text,uuid,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_trip_chat_send_v1(text,uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_trip_chat_feed_v1(text,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_list_reservations_v15(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_reservation_by_token_v4(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_trip_chat_v1(uuid,text,text,bigint) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.customer_trip_chat_send_v1(uuid,text,uuid,text,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.driver_trip_chat_v1(text,uuid,bigint) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.driver_trip_chat_send_v1(text,uuid,text,uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.driver_trip_chat_feed_v1(text,bigint) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.customer_list_reservations_v15(text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_reservation_by_token_v4(text) TO anon,authenticated,service_role;
