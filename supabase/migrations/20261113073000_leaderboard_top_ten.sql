-- The daily board shows the top ten (was three), plus the player's own row when they rank lower.
create or replace function afterlight_private.fetch_daily_leaderboard(p_challenge_date date)
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
  where ranked.place <= 10 or ranked.player_id = (select auth.uid())
  order by ranked.place;
$function$;
