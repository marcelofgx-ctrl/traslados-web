-- Read-only, cache-only public route preview.
-- Reuses ROAD calculations produced by the existing, internal availability motor.
-- Critically, no call to external OSRM demo is made here.
create or replace function public.public_cached_route_preview_v1(p_points jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public','pg_temp'
as $function$
declare
  n integer;
  i integer;
  a jsonb;
  b jsonb;
  row_found record;
  km_total numeric := 0;
  minutes_total integer := 0;
  oldest_at timestamptz := now();
  from_lat numeric(10,5);
  from_lng numeric(10,5);
  to_lat numeric(10,5);
  to_lng numeric(10,5);
begin
  if p_points is null or jsonb_typeof(p_points) <> 'array' then
    return jsonb_build_object('available',false,'reason','invalid_points');
  end if;
  n:=jsonb_array_length(p_points);
  if n < 2 or n > 10 then
    return jsonb_build_object('available',false,'reason','invalid_points');
  end if;
  for i in 0..n-1 loop
    a:=p_points->i;
    if jsonb_typeof(a) <> 'object'
       or jsonb_typeof(a->'lat') <> 'number'
       or jsonb_typeof(a->'lng') <> 'number'
       or (a->>'lat')::numeric not between -35.1 and -30
       or (a->>'lng')::numeric not between -58.5 and -53 then
      return jsonb_build_object('available',false,'reason','invalid_points');
    end if;
  end loop;
  for i in 0..n-2 loop
    a:=p_points->i;
    b:=p_points->(i+1);
    from_lat:=round((a->>'lat')::numeric,5);
    from_lng:=round((a->>'lng')::numeric,5);
    to_lat:=round((b->>'lat')::numeric,5);
    to_lng:=round((b->>'lng')::numeric,5);
    if from_lat=to_lat and from_lng=to_lng then
      continue;
    end if;
    -- Non-ROAD calculations (including haversine estimates) are NOT billable route data.
    select c.distance_km,c.duration_min,c.updated_at into row_found
      from public.route_reposition_cache c
      where c.from_lat=from_lat and c.from_lng=from_lng
        and c.to_lat=to_lat and c.to_lng=to_lng
        and c.method='ROAD' and c.distance_km > 0 and c.duration_min>=0
        and c.updated_at > now()-interval '7 days'
      limit 1;
    if not found then
      return jsonb_build_object('available',false,'reason','cache_miss');
    end if;
    km_total:=km_total+row_found.distance_km;
    minutes_total:=minutes_total+row_found.duration_min;
    oldest_at:=least(oldest_at,row_found.updated_at);
  end loop;
  if km_total<=0 then
    return jsonb_build_object('available',false,'reason','no_route');
  end if;
  return jsonb_build_object(
    'available',true,
    'source','supabase_route_cache',
    'distanceKm',round(km_total,1),
    'durationMin',minutes_total,
    'geometry','[]'::jsonb,
    'calculatedAt',to_char(oldest_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end;
$function$;

revoke all on function public.public_cached_route_preview_v1(jsonb) from public;
grant execute on function public.public_cached_route_preview_v1(jsonb) to anon,authenticated,service_role;
comment on function public.public_cached_route_preview_v1(jsonb)
is 'Read-only anonymized route summary. Only recently cached ROAD segments, no demo OSRM requests or raw GPS exposure.';
