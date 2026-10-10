-- Only a boolean is publicly observable. Driver coordinates and event history
-- remain private. Consent is explicit from Mapa Trayectos (OFF by default).
-- Availability is an invitation to ASK, not a confirmed booking.
create or replace function public.public_driver_availability_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $func$
declare
  presence_ok boolean := false;
  agenda_busy boolean := true;
  local_now timestamp;
begin
  select exists(
    select 1 from public.driver_live_presence p
    where p.singleton_id = 1
      and p.enabled and p.shift_active
      and not p.shift_paused and not p.trip_active and not p.manually_busy
      and p.lat is not null and p.lng is not null
      and p.received_at >= now() - interval '90 seconds'
      and p.gps_recorded_at between now() - interval '90 seconds' and now() + interval '10 seconds'
      and p.last_moving_at between now() - interval '5 minutes' and now() + interval '10 seconds'
      and p.accuracy_m <= 45
  ) into presence_ok;
  if presence_ok then
    local_now := (now() at time zone 'America/Montevideo')::timestamp;
    agenda_busy := public.availability_has_conflict(
      local_now::date, local_now::time, 60, null, true
    );
  end if;
  return jsonb_build_object(
    'available', presence_ok and not agenda_busy,
    'status', case when presence_ok and not agenda_busy
      then 'available_for_requests' else 'not_available' end,
    'confirmationRequired', true
  );
end;
$func$;
revoke all on function public.public_driver_availability_v1() from public;
grant execute on function public.public_driver_availability_v1() to anon, authenticated, service_role;
comment on function public.public_driver_availability_v1()
 is 'Public yes/no availability only, based on an opted-in active Mapa heartbeat and real agenda. No GPS, timestamps, device IDs, routes or sensitive fields.';
