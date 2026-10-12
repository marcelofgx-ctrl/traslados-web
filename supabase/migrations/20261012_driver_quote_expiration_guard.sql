-- Traslados: protect quote sending against expired immediate pickups.
-- Matches customer_quote_decision_v13 90-minute acceptance cutoff.
-- Preserves signatures, SECURITY DEFINER, search_path, status workflow and existing prices.
-- Does not update/delete reservation data or touch scheduled bookings.

CREATE OR REPLACE FUNCTION public.driver_send_quote_v10(p_pin text, p_reservation_id uuid, p_route_distance_km numeric, p_price_per_km numeric, p_minimum numeric, p_tolls numeric, p_waiting numeric, p_pickup_extra numeric, p_other numeric, p_reference_total numeric, p_final_total numeric, p_includes text DEFAULT NULL::text, p_route_duration_min integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.reservations;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  -- The customer_quote_decision_v13 RPC rejects immediate requests after
  -- 90 minutes. Do not let Conductor send an unacceptably late quote.
  if exists (
    select 1 from public.reservations r
    where r.id=p_reservation_id and r.status='PENDIENTE'
      and r.pickup_mode in ('now','10')
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
;

CREATE OR REPLACE FUNCTION public.driver_send_quote_v10_7(p_pin text, p_reservation_id uuid, p_route_distance_km numeric, p_price_per_km numeric, p_minimum numeric, p_toll_count integer, p_toll_unit_value numeric, p_waiting numeric, p_pickup_extra numeric, p_other numeric, p_reference_total numeric, p_final_total numeric, p_includes text DEFAULT NULL::text, p_route_duration_min integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.reservations; v_count integer := coalesce(p_toll_count,0); v_unit numeric := coalesce(p_toll_unit_value,0);
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  -- The customer_quote_decision_v13 RPC rejects immediate requests after
  -- 90 minutes. Do not let Conductor send an unacceptably late quote.
  if exists (
    select 1 from public.reservations r
    where r.id=p_reservation_id and r.status='PENDIENTE'
      and r.pickup_mode in ('now','10')
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
;

-- Fail the migration if either contract accidentally loses the guard.
do $verify_expiry$
declare v_name text;
begin
  foreach v_name in array array['driver_send_quote_v10','driver_send_quote_v10_7'] loop
    if position('La solicitud inmediata venció' in
      pg_get_functiondef(('public.'||v_name||case when v_name='driver_send_quote_v10' then
        '(text,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,integer)'
      else '(text,uuid,numeric,numeric,numeric,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,integer)'
      end)::regprocedure))=0 then
      raise exception 'Quote expiry guard missing in %',v_name;
    end if;
  end loop;
end;
$verify_expiry$;
