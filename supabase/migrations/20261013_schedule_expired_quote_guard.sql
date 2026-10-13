-- Additional protection for manually accepted scheduled requests outside habitual hours.
-- Preserve existing function signatures, authorization and conflict checks.
DO $migration$
declare source text; marker text; insert_guard text; fun text;
begin
  marker := '  IF p_accept THEN' || chr(10) ||
    '    IF v_res.pickup_mode IN (''now'',''10'')';
  insert_guard := '  IF p_accept THEN' || chr(10) ||
    '    IF v_res.pickup_mode=''schedule'' AND v_res.pickup_date+v_res.pickup_time <= (now() at time zone ''America/Montevideo'') THEN' || chr(10) ||
    '      RAISE EXCEPTION ''La hora de recogida programada ya pasó. Solicitá un nuevo traslado'';' || chr(10) ||
    '    END IF;' || chr(10) ||
    '    IF v_res.pickup_mode IN (''now'',''10'')';
  select pg_get_functiondef('public.customer_quote_decision_v13(uuid,boolean,text,text)'::regprocedure) into source;
  if position(marker in source)=0 then
    raise exception 'Expected scheduled acceptance anchor missing'; end if;
  execute replace(source,marker,insert_guard);

  for fun in select unnest(array['driver_send_quote_v10','driver_send_quote_v10_7']) loop
    select pg_get_functiondef(p.oid) into source
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=fun;
    if source is null then raise exception 'Missing RPC %',fun; end if;
    marker:='  -- The customer_quote_decision_v13 RPC rejects immediate requests after';
    insert_guard:='  if exists(select 1 from public.reservations r' || chr(10) ||
      '    where r.id=p_reservation_id and r.status=''PENDIENTE''' || chr(10) ||
      '      and r.pickup_mode=''schedule''' || chr(10) ||
      '      and r.pickup_date+r.pickup_time <= (now() at time zone ''America/Montevideo'')) then' || chr(10) ||
      '    raise exception ''La hora de recogida programada ya pasó. Pedile al pasajero que envíe una nueva solicitud.'';' || chr(10) ||
      '  end if;' || chr(10) || marker;
    if position(marker in source)=0 then raise exception 'Expected quote guard anchor missing in %',fun;end if;
    execute replace(source,marker,insert_guard);
  end loop;
end
$migration$;