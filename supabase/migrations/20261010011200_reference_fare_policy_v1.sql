-- One authoritative, internal reference rate used by Web Premium and the Pages PWA.
-- The existing final conductor quote flow is not modified.
alter table public.driver_settings
  add column if not exists reference_rate_uyu_per_km numeric(8,2) not null default 40;
alter table public.driver_settings
  drop constraint if exists driver_settings_reference_rate_positive;
alter table public.driver_settings
  add constraint driver_settings_reference_rate_positive
  check (reference_rate_uyu_per_km >= 1 and reference_rate_uyu_per_km <= 1000);

create or replace function public.public_reference_quote_v1(p_distance_km numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public','pg_temp'
as $func$
declare rate numeric;
begin
  if p_distance_km is null or p_distance_km<=0 or p_distance_km>2500 then
    return jsonb_build_object('available',false,'reason','invalid_distance');
  end if;
  select reference_rate_uyu_per_km into rate
  from public.driver_settings where singleton_id=1;
  rate:=coalesce(rate,40);
  return jsonb_build_object('available',true,
    'referenceFareUyu',greatest(10,round(p_distance_km*rate/10)*10)::integer,
    'currency','UYU','finalQuoteRequired',true);
end;
$func$;
revoke all on function public.public_reference_quote_v1(numeric) from public;
grant execute on function public.public_reference_quote_v1(numeric) to anon,authenticated,service_role;

create or replace function public.driver_set_reference_rate_v1(p_pin text,p_rate numeric)
returns jsonb
language plpgsql
security definer
set search_path = 'public','pg_temp'
as $func$
declare updated numeric;
begin
  if not public.driver_pin_valid(p_pin) then raise exception 'PIN incorrecto'; end if;
  if p_rate is null or p_rate < 1 or p_rate > 1000 then
    raise exception 'La tarifa por km debe estar entre 1 y 1000 UYU';
  end if;
  update public.driver_settings
    set reference_rate_uyu_per_km=round(p_rate,2),updated_at=now()
    where singleton_id=1 returning reference_rate_uyu_per_km into updated;
  if not found then
    raise exception 'Configuración del conductor no disponible';
  end if;
  return jsonb_build_object('ok',true,'rateUyuPerKm',updated);
end;
$func$;
revoke all on function public.driver_set_reference_rate_v1(text,numeric) from public;
grant execute on function public.driver_set_reference_rate_v1(text,numeric) to anon,authenticated,service_role;
comment on function public.public_reference_quote_v1(numeric)
is 'Public indicative fare only, calculated from a private driver-set rate. It never confirms a booking.';
