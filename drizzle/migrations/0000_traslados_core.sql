-- ============ ENUM ============
CREATE TYPE public.reservation_status AS ENUM (
  'PENDIENTE','ACEPTADA','EN_VIAJE','FINALIZADA','CANCELADA','RECHAZADA'
);

-- ============ DRIVERS ============
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver reads own row" ON public.drivers
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.is_driver(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.drivers WHERE id = _user_id AND active);
$$;

-- ============ RESERVATIONS ============
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  public_token text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  pickup_date date NOT NULL,
  pickup_time time NOT NULL,
  passengers integer NOT NULL DEFAULT 1,
  comments text,
  origin_text text NOT NULL,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  destination_text text NOT NULL,
  destination_lat double precision NOT NULL,
  destination_lng double precision NOT NULL,
  status public.reservation_status NOT NULL DEFAULT 'PENDIENTE',
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT passengers_range CHECK (passengers BETWEEN 1 AND 20),
  CONSTRAINT name_len CHECK (char_length(customer_name) BETWEEN 2 AND 120),
  CONSTRAINT phone_len CHECK (char_length(customer_phone) BETWEEN 6 AND 30),
  CONSTRAINT lat_range CHECK (origin_lat BETWEEN -90 AND 90 AND destination_lat BETWEEN -90 AND 90),
  CONSTRAINT lng_range CHECK (origin_lng BETWEEN -180 AND 180 AND destination_lng BETWEEN -180 AND 180)
);
CREATE INDEX reservations_status_idx ON public.reservations (status, pickup_date, pickup_time);
CREATE INDEX reservations_created_idx ON public.reservations (created_at DESC);
CREATE INDEX reservations_token_idx ON public.reservations (public_token);

GRANT SELECT, UPDATE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers read reservations" ON public.reservations
  FOR SELECT TO authenticated USING (public.is_driver(auth.uid()));
CREATE POLICY "drivers update reservations" ON public.reservations
  FOR UPDATE TO authenticated USING (public.is_driver(auth.uid()))
  WITH CHECK (public.is_driver(auth.uid()));

-- ============ EVENTS ============
CREATE TABLE public.reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  from_status public.reservation_status,
  to_status public.reservation_status NOT NULL,
  actor uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservation_events_res_idx ON public.reservation_events (reservation_id, created_at DESC);
GRANT SELECT ON public.reservation_events TO authenticated;
GRANT ALL ON public.reservation_events TO service_role;
ALTER TABLE public.reservation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers read events" ON public.reservation_events
  FOR SELECT TO authenticated USING (public.is_driver(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_reservation_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.reservation_events (reservation_id, from_status, to_status, actor)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
    RETURN NEW;
  END IF;
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.reservation_events (reservation_id, from_status, to_status, actor)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reservations_event_insert AFTER INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_event();
CREATE TRIGGER reservations_event_update BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_event();

-- ============ PUSH SUBSCRIPTIONS ============
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_driver_idx ON public.push_subscriptions (driver_id);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver manages own subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());

-- ============ PUBLIC RPCs ============
CREATE OR REPLACE FUNCTION public.generate_reservation_code()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'TR-' || to_char(now() AT TIME ZONE 'America/Montevideo', 'YYMMDD') || '-' ||
         upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));
$$;

CREATE OR REPLACE FUNCTION public.create_reservation(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_date date,
  p_pickup_time time,
  p_passengers integer,
  p_comments text,
  p_origin_text text,
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_destination_text text,
  p_destination_lat double precision,
  p_destination_lng double precision
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token text;
  v_code text;
  v_row public.reservations;
BEGIN
  IF (p_pickup_date + p_pickup_time) < ((now() AT TIME ZONE 'America/Montevideo') - interval '10 minutes') THEN
    RAISE EXCEPTION 'La fecha y hora deben ser futuras';
  END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  v_code := public.generate_reservation_code();

  INSERT INTO public.reservations (
    code, public_token, customer_name, customer_phone, pickup_date, pickup_time,
    passengers, comments, origin_text, origin_lat, origin_lng,
    destination_text, destination_lat, destination_lng, status
  ) VALUES (
    v_code, v_token, btrim(p_customer_name), btrim(p_customer_phone), p_pickup_date, p_pickup_time,
    COALESCE(p_passengers, 1), NULLIF(btrim(COALESCE(p_comments, '')), ''),
    btrim(p_origin_text), p_origin_lat, p_origin_lng,
    btrim(p_destination_text), p_destination_lat, p_destination_lng, 'PENDIENTE'
  ) RETURNING * INTO v_row;

  RETURN json_build_object(
    'code', v_row.code,
    'public_token', v_row.public_token,
    'status', v_row.status,
    'created_at', v_row.created_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_reservation(text,text,date,time,integer,text,text,double precision,double precision,text,double precision,double precision) FROM public;
GRANT EXECUTE ON FUNCTION public.create_reservation(text,text,date,time,integer,text,text,double precision,double precision,text,double precision,double precision) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_reservation_by_token(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.reservations;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN RETURN NULL; END IF;
  SELECT * INTO v_row FROM public.reservations WHERE public_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN json_build_object(
    'code', v_row.code,
    'status', v_row.status,
    'customer_name', v_row.customer_name,
    'pickup_date', v_row.pickup_date,
    'pickup_time', v_row.pickup_time,
    'passengers', v_row.passengers,
    'origin_text', v_row.origin_text,
    'destination_text', v_row.destination_text,
    'comments', v_row.comments,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_reservation_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_reservation_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_reservation_by_token(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.reservations;
BEGIN
  UPDATE public.reservations SET status = 'CANCELADA'
   WHERE public_token = p_token AND status IN ('PENDIENTE','ACEPTADA')
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN json_build_object('code', v_row.code, 'status', v_row.status);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_reservation_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_reservation_by_token(text) TO anon, authenticated;

-- ============ DRIVER BOOTSTRAP ============
CREATE OR REPLACE FUNCTION public.driver_setup_state()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('has_driver', EXISTS (SELECT 1 FROM public.drivers));
$$;
REVOKE ALL ON FUNCTION public.driver_setup_state() FROM public;
GRANT EXECUTE ON FUNCTION public.driver_setup_state() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_first_driver(p_full_name text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_email text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM public.drivers WHERE id = v_uid) THEN
    RETURN json_build_object('ok', true, 'already', true);
  END IF;
  IF EXISTS (SELECT 1 FROM public.drivers) THEN
    RAISE EXCEPTION 'El alta de conductores ya está cerrada';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  INSERT INTO public.drivers (id, email, full_name) VALUES (v_uid, v_email, NULLIF(btrim(COALESCE(p_full_name,'')),''));
  RETURN json_build_object('ok', true, 'already', false);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_first_driver(text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_first_driver(text) TO authenticated;

-- ============ REALTIME ============
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;