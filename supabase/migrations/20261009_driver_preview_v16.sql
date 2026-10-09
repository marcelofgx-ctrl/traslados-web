-- Traslados Web v16: presupuesto previo / presencia voluntaria del conductor
-- ADITIVA. No ejecutar automáticamente. Requiere proveedor de rutas autorizado antes de activar.
-- El motor de reposicionamiento anterior puede usar OSRM público de demostración:
-- NO habilitar esta función para clientes comerciales mientras dependa de ese servicio.
BEGIN;

CREATE TABLE IF NOT EXISTS public.driver_preview_settings_v16 (
  singleton_id integer PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  rate_per_km numeric(10,2) NOT NULL DEFAULT 42 CHECK (rate_per_km >= 0 AND rate_per_km <= 1000),
  minimum_fare numeric(10,2) NOT NULL DEFAULT 350 CHECK (minimum_fare >= 0),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.driver_preview_settings_v16(singleton_id)
VALUES(1) ON CONFLICT(singleton_id) DO NOTHING;
ALTER TABLE public.driver_preview_settings_v16 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.driver_preview_settings_v16 FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.driver_live_presence_v16 (
  singleton_id integer PRIMARY KEY DEFAULT 1 CHECK (singleton_id=1),
  jornada_abierta boolean NOT NULL DEFAULT false,
  libre boolean NOT NULL DEFAULT false,
  latitude double precision,
  longitude double precision,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR
         (latitude BETWEEN -35.25 AND -30 AND longitude BETWEEN -58.6 AND -53))
);
ALTER TABLE public.driver_live_presence_v16 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.driver_live_presence_v16 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.driver_set_preview_settings_v16(
 p_pin text, p_rate_per_km numeric, p_minimum_fare numeric, p_enabled boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x public.driver_preview_settings_v16;
BEGIN
 IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
 IF p_rate_per_km IS NULL OR p_rate_per_km < 0 OR p_rate_per_km > 1000 OR
    p_minimum_fare IS NULL OR p_minimum_fare < 0 OR p_enabled IS NULL
 THEN RAISE EXCEPTION 'Tarifa fuera de rango'; END IF;
 INSERT INTO public.driver_preview_settings_v16(singleton_id,rate_per_km,minimum_fare,enabled,updated_at)
 VALUES(1,p_rate_per_km,p_minimum_fare,p_enabled,now())
 ON CONFLICT(singleton_id) DO UPDATE SET
  rate_per_km=EXCLUDED.rate_per_km, minimum_fare=EXCLUDED.minimum_fare,
  enabled=EXCLUDED.enabled, updated_at=now()
 RETURNING * INTO x;
 RETURN jsonb_build_object('enabled',x.enabled,'rate_per_km',x.rate_per_km,
   'minimum_fare',x.minimum_fare,'updated_at',x.updated_at);
END $$;

-- Solo el APK autorizado con PIN informa ubicación. No compartir fuera de jornada/estado libre.
CREATE OR REPLACE FUNCTION public.driver_report_presence_v16(
 p_pin text, p_jornada_abierta boolean, p_libre boolean,
 p_latitude double precision DEFAULT NULL, p_longitude double precision DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE share boolean := coalesce(p_jornada_abierta,false) AND coalesce(p_libre,false);
BEGIN
 IF NOT public.driver_pin_valid(p_pin) THEN RAISE EXCEPTION 'PIN incorrecto'; END IF;
 IF share AND (p_latitude IS NULL OR p_longitude IS NULL OR
               p_latitude NOT BETWEEN -35.25 AND -30 OR p_longitude NOT BETWEEN -58.6 AND -53)
 THEN RAISE EXCEPTION 'GPS de Uruguay inválido'; END IF;
 INSERT INTO public.driver_live_presence_v16(singleton_id,jornada_abierta,libre,latitude,longitude,updated_at)
 VALUES(1,coalesce(p_jornada_abierta,false),share,
        CASE WHEN share THEN p_latitude ELSE NULL END,
        CASE WHEN share THEN p_longitude ELSE NULL END,now())
 ON CONFLICT(singleton_id) DO UPDATE SET
 jornada_abierta=EXCLUDED.jornada_abierta,libre=EXCLUDED.libre,
 latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,updated_at=now();
 RETURN jsonb_build_object('ok',true,'sharing',share,'expires_seconds',90);
END $$;

-- No devuelve coordenadas del conductor; solo distancia/ETA VIAL si libre, jornada abierta,
-- GPS actualizado hace menos de 90 segundos y viaje solicitado para las próximas 2 horas.
CREATE OR REPLACE FUNCTION public.customer_trip_preview_v16(
 p_session_token text,
 p_origin_lat double precision, p_origin_lng double precision,
 p_destination_lat double precision, p_destination_lng double precision,
 p_stops jsonb DEFAULT '[]'::jsonb,
 p_pickup_date date DEFAULT NULL, p_pickup_time time DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
 cfg public.driver_preview_settings_v16;
 presence public.driver_live_presence_v16;
 leg jsonb; point jsonb; eta jsonb;
 from_lat double precision := p_origin_lat;
 from_lng double precision := p_origin_lng;
 to_lat double precision; to_lng double precision;
 total_km numeric := 0; total_minutes integer := 0;
 known boolean := true; fare numeric;
 approach_km numeric; approach_min integer; nearby boolean := false;
 planned timestamp; local_now timestamp := now() at time zone 'America/Montevideo';
BEGIN
 IF public.availability_session_customer(p_session_token) IS NULL
 THEN RAISE EXCEPTION 'Sesión inválida'; END IF;
 IF p_origin_lat NOT BETWEEN -35.25 AND -30 OR p_origin_lng NOT BETWEEN -58.6 AND -53 OR
    p_destination_lat NOT BETWEEN -35.25 AND -30 OR p_destination_lng NOT BETWEEN -58.6 AND -53 OR
    p_origin_lat IS NULL OR p_origin_lng IS NULL OR p_destination_lat IS NULL OR p_destination_lng IS NULL
 THEN RAISE EXCEPTION 'Origen o destino no válidos'; END IF;
 IF p_stops IS NULL OR jsonb_typeof(p_stops) <> 'array' OR jsonb_array_length(p_stops)>8
 THEN RAISE EXCEPTION 'Lista de paradas inválida'; END IF;

 SELECT * INTO cfg FROM public.driver_preview_settings_v16 WHERE singleton_id=1;
 IF COALESCE(cfg.enabled,false) THEN
   FOR point IN SELECT value FROM jsonb_array_elements(p_stops) AS v(value) LOOP
     BEGIN
       to_lat := (point->>'lat')::double precision;
       to_lng := (point->>'lng')::double precision;
     EXCEPTION WHEN others THEN RAISE EXCEPTION 'Coordenadas de parada inválidas'; END;
     IF to_lat NOT BETWEEN -35.25 AND -30 OR to_lng NOT BETWEEN -58.6 AND -53
     THEN RAISE EXCEPTION 'Parada fuera de Uruguay'; END IF;
     leg := public.availability_reposition_v11_4(from_lat,from_lng,to_lat,to_lng);
     IF leg->>'method'<>'ROAD' OR (leg->>'distance_km') IS NULL OR (leg->>'minutes') IS NULL
     THEN known:=false; EXIT; END IF;
     total_km:=total_km+(leg->>'distance_km')::numeric;
     total_minutes:=total_minutes+(leg->>'minutes')::integer;
     from_lat:=to_lat;from_lng:=to_lng;
   END LOOP;
   IF known THEN
     leg := public.availability_reposition_v11_4(from_lat,from_lng,p_destination_lat,p_destination_lng);
     IF leg->>'method'<>'ROAD' OR (leg->>'distance_km') IS NULL OR (leg->>'minutes') IS NULL
     THEN known:=false;
     ELSE
       total_km:=total_km+(leg->>'distance_km')::numeric;
       total_minutes:=total_minutes+(leg->>'minutes')::integer;
     END IF;
   END IF;
 ELSE known:=false;
 END IF;
 IF known THEN
   fare := greatest(cfg.minimum_fare,round(total_km*cfg.rate_per_km,0));
 END IF;

 IF p_pickup_date IS NOT NULL AND p_pickup_time IS NOT NULL THEN
   planned := p_pickup_date+p_pickup_time;
   IF planned>=local_now AND planned<=local_now + interval '2 hours' AND COALESCE(cfg.enabled,false) THEN
     SELECT * INTO presence FROM public.driver_live_presence_v16 WHERE singleton_id=1;
     IF presence.jornada_abierta AND presence.libre AND
        presence.updated_at > now()-interval '90 seconds' AND
        presence.latitude IS NOT NULL AND presence.longitude IS NOT NULL THEN
       eta := public.availability_reposition_v11_4(presence.latitude,presence.longitude,p_origin_lat,p_origin_lng);
       IF eta->>'method'='ROAD' AND (eta->>'distance_km') IS NOT NULL AND (eta->>'minutes') IS NOT NULL THEN
         approach_km:=round((eta->>'distance_km')::numeric,1);
         approach_min:=(eta->>'minutes')::integer;
         nearby:=true;
       END IF;
     END IF;
   END IF;
 END IF;
 RETURN jsonb_build_object(
 'route_known',known,'route_distance_km',CASE WHEN known THEN round(total_km,1) ELSE NULL END,
 'route_duration_min',CASE WHEN known THEN total_minutes ELSE NULL END,
 'estimated_fare',fare,'currency','UYU','quote_is_final',false,
 'driver_nearby',nearby,'driver_distance_km',approach_km,'driver_eta_min',approach_min
 );
END $$;

GRANT EXECUTE ON FUNCTION public.driver_set_preview_settings_v16(text,numeric,numeric,boolean) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.driver_report_presence_v16(text,boolean,boolean,double precision,double precision) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.customer_trip_preview_v16(text,double precision,double precision,double precision,double precision,jsonb,date,time) TO anon,authenticated,service_role;
COMMIT;
