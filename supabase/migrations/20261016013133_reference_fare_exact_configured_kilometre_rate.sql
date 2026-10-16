create or replace function public.public_reference_quote_v1(p_distance_km numeric)
returns jsonb language plpgsql stable security definer
set search_path='public','pg_temp'
as $func$
declare rate numeric;
begin
  if p_distance_km is null or p_distance_km<=0 or p_distance_km>2500 then
    return jsonb_build_object('available',false,'reason','invalid_distance');
  end if;
  select reference_rate_uyu_per_km into rate from public.driver_settings where singleton_id=1;
  rate:=coalesce(rate,40);
  return jsonb_build_object('available',true,
    'referenceFareUyu',round(p_distance_km*rate,2),
    'rateUyuPerKm',rate,'currency','UYU','finalQuoteRequired',true);
end;
$func$;
-- Existing signature, grants, PIN-protected setting and final quotes preserved.
