alter table public.daily_scores
  add column tower_profile jsonb not null default '{"blocks": [], "perfectLevels": []}'::jsonb,
  add constraint daily_scores_tower_profile_shape
    check (
      coalesce(
        jsonb_typeof(tower_profile) = 'object'
        and jsonb_typeof(tower_profile -> 'blocks') = 'array'
        and jsonb_typeof(tower_profile -> 'perfectLevels') = 'array'
        and jsonb_array_length(tower_profile -> 'blocks') <= 501
        and jsonb_array_length(tower_profile -> 'perfectLevels') <= 500,
        false
      )
    );

drop function public.get_daily_leaderboard(date);
drop function afterlight_private.fetch_daily_leaderboard(date);

create function afterlight_private.fetch_daily_leaderboard(p_challenge_date date)
returns table (
  rank bigint,
  display_name text,
  height integer,
  perfects integer,
  tower_profile jsonb,
  is_you boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  with ranked as (
    select
      row_number() over (
        order by ds.height desc, ds.perfects desc, ds.accepted_at asc, ds.player_id asc
      ) as place,
      ds.player_id,
      coalesce(
        pp.display_name,
        'Beacon-' || upper(left(replace(ds.player_id::text, '-', ''), 4))
      ) as player_name,
      ds.height,
      ds.perfects,
      ds.tower_profile
    from public.daily_scores as ds
    left join public.player_profiles as pp on pp.user_id = ds.player_id
    where ds.challenge_date = p_challenge_date
      and p_challenge_date between
        ((now() at time zone 'UTC')::date - 1) and (now() at time zone 'UTC')::date
      and (select auth.uid()) is not null
  )
  select
    ranked.place,
    ranked.player_name,
    ranked.height,
    ranked.perfects,
    ranked.tower_profile,
    ranked.player_id = (select auth.uid())
  from ranked
  where ranked.place <= 3 or ranked.player_id = (select auth.uid())
  order by ranked.place;
$function$;

revoke all on function afterlight_private.fetch_daily_leaderboard(date) from public;
grant execute on function afterlight_private.fetch_daily_leaderboard(date) to authenticated;

create function public.get_daily_leaderboard(p_challenge_date date)
returns table (
  rank bigint,
  display_name text,
  height integer,
  perfects integer,
  tower_profile jsonb,
  is_you boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from afterlight_private.fetch_daily_leaderboard(p_challenge_date);
$function$;

revoke all on function public.get_daily_leaderboard(date) from public;
grant execute on function public.get_daily_leaderboard(date) to authenticated;

drop function public.record_daily_score(uuid, date, integer, integer);

create function public.record_daily_score(
  p_player_id uuid,
  p_challenge_date date,
  p_height integer,
  p_perfects integer,
  p_tower_profile jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  score_updated boolean := false;
begin
  if not coalesce(
    jsonb_typeof(p_tower_profile) = 'object'
    and jsonb_typeof(p_tower_profile -> 'blocks') = 'array'
    and jsonb_typeof(p_tower_profile -> 'perfectLevels') = 'array'
    and jsonb_array_length(p_tower_profile -> 'blocks') = p_height + 1
    and jsonb_array_length(p_tower_profile -> 'perfectLevels') = p_perfects,
    false
  ) then
    raise exception 'Invalid tower profile.';
  end if;

  insert into public.daily_scores as existing_score (
    player_id, challenge_date, height, perfects, tower_profile
  ) values (
    p_player_id, p_challenge_date, p_height, p_perfects, p_tower_profile
  )
  on conflict (player_id, challenge_date) do update
    set height = excluded.height,
        perfects = excluded.perfects,
        tower_profile = excluded.tower_profile,
        accepted_at = now()
    where (excluded.height, excluded.perfects)
      > (existing_score.height, existing_score.perfects)
  returning true into score_updated;

  return coalesce(score_updated, false);
end;
$function$;

revoke all on function public.record_daily_score(uuid, date, integer, integer, jsonb) from public;
revoke all on function public.record_daily_score(uuid, date, integer, integer, jsonb) from anon, authenticated;
grant execute on function public.record_daily_score(uuid, date, integer, integer, jsonb) to service_role;

notify pgrst, 'reload schema';
