create or replace function public.driver_get_reference_rate_v1(p_pin text)
returns jsonb
language plpgsql stable security definer
set search_path = 'public','pg_temp'
as $func$
declare rate numeric;
begin
  if not public.driver_pin_valid(p_pin) then
    raise exception 'PIN incorrecto';
  end if;
  select reference_rate_uyu_per_km into rate from public.driver_settings where singleton_id=1;
  return jsonb_build_object('rateUyuPerKm',coalesce(rate,40),'currency','UYU');
end;
$func$;
revoke all on function public.driver_get_reference_rate_v1(text) from public;
grant execute on function public.driver_get_reference_rate_v1(text) to anon,authenticated,service_role;
