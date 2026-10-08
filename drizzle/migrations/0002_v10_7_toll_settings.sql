CREATE TABLE IF NOT EXISTS public.driver_settings (
  singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  default_toll_unit_value numeric NOT NULL DEFAULT 0 CHECK (default_toll_unit_value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.driver_settings TO service_role;
ALTER TABLE public.driver_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS quote_toll_count integer,
  ADD COLUMN IF NOT EXISTS quote_toll_unit_value numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reservations_v10_7_toll_nonneg_chk') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_v10_7_toll_nonneg_chk CHECK (
      (quote_toll_count IS NULL OR quote_toll_count >= 0) AND
      (quote_toll_unit_value IS NULL OR quote_toll_unit_value >= 0));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.driver_get_quote_settings_v10_7(p_pin text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v numeric; v_upd timestamptz;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  select default_toll_unit_value, updated_at into v, v_upd from public.driver_settings where singleton_id=1;
  return json_build_object('default_toll_unit_value', coalesce(v,0), 'updated_at', v_upd);
end;
$function$;

CREATE OR REPLACE FUNCTION public.driver_set_default_toll_v10_7(p_pin text, p_value numeric)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r public.driver_settings;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  if p_value is null or p_value < 0 then raise exception 'El valor del peaje debe ser mayor o igual a 0'; end if;
  insert into public.driver_settings(singleton_id, default_toll_unit_value, updated_at)
  values (1, p_value, now())
  on conflict (singleton_id) do update set default_toll_unit_value=excluded.default_toll_unit_value, updated_at=now()
  returning * into r;
  return json_build_object('ok', true, 'default_toll_unit_value', r.default_toll_unit_value, 'updated_at', r.updated_at);
end;
$function$;

CREATE OR REPLACE FUNCTION public.driver_send_quote_v10_7(
  p_pin text, p_reservation_id uuid,
  p_route_distance_km numeric, p_price_per_km numeric, p_minimum numeric,
  p_toll_count integer, p_toll_unit_value numeric,
  p_waiting numeric, p_pickup_extra numeric, p_other numeric,
  p_reference_total numeric, p_final_total numeric, p_includes text DEFAULT NULL,
  p_route_duration_min integer DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v public.reservations; v_count integer := coalesce(p_toll_count,0); v_unit numeric := coalesce(p_toll_unit_value,0);
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
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
           quote_tolls, quote_toll_count, quote_toll_unit_value, quote_waiting, quote_pickup_extra, quote_other, quote_reference_total,
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
           quote_tolls, quote_toll_count, quote_toll_unit_value, quote_waiting, quote_pickup_extra, quote_other, quote_reference_total,
           quote_final_total, quote_includes, quote_sent_at, quote_accepted_at, quote_rejected_at, confirmed_at
    from public.reservations
    where status in ('FINALIZADA','CANCELADA','RECHAZADA')
    order by updated_at desc limit 200
  ) x;
  return v;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.driver_get_quote_settings_v10_7(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_set_default_toll_v10_7(text,numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_send_quote_v10_7(text,uuid,numeric,numeric,numeric,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,integer) TO anon, authenticated, service_role;