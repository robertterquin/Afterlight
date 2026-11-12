create table public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint player_profiles_display_name_length
    check (char_length(display_name) between 3 and 18),
  constraint player_profiles_display_name_format
    check (display_name = btrim(display_name) and display_name ~ '^[A-Za-z0-9 _-]{3,18}$')
);

create table public.daily_scores (
  player_id uuid not null references auth.users (id) on delete cascade,
  challenge_date date not null,
  height integer not null check (height > 0),
  perfects integer not null check (perfects >= 0 and perfects <= height),
  accepted_at timestamptz not null default now(),
  primary key (player_id, challenge_date)
);

create index daily_scores_leaderboard_order
  on public.daily_scores (challenge_date, height desc, perfects desc, accepted_at asc);

create schema afterlight_private;
revoke all on schema afterlight_private from public;
grant usage on schema afterlight_private to authenticated;

alter table public.player_profiles enable row level security;
alter table public.daily_scores enable row level security;

create policy player_profiles_select_own
  on public.player_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy player_profiles_insert_own
  on public.player_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy player_profiles_update_own
  on public.player_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.player_profiles, public.daily_scores from public, anon, authenticated;
grant select (user_id, display_name), insert (user_id, display_name), update (display_name)
  on public.player_profiles to authenticated;

create function afterlight_private.fetch_daily_leaderboard(p_challenge_date date)
returns table (
  rank bigint,
  display_name text,
  height integer,
  perfects integer,
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
      ds.perfects
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

create function public.record_daily_score(
  p_player_id uuid,
  p_challenge_date date,
  p_height integer,
  p_perfects integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  score_updated boolean := false;
begin
  insert into public.daily_scores as existing_score (
    player_id, challenge_date, height, perfects
  ) values (
    p_player_id, p_challenge_date, p_height, p_perfects
  )
  on conflict (player_id, challenge_date) do update
    set height = excluded.height,
        perfects = excluded.perfects,
        accepted_at = now()
    where (excluded.height, excluded.perfects)
      > (existing_score.height, existing_score.perfects)
  returning true into score_updated;

  return coalesce(score_updated, false);
end;
$function$;

revoke all on function public.record_daily_score(uuid, date, integer, integer) from public;
revoke all on function public.record_daily_score(uuid, date, integer, integer) from anon, authenticated;
grant execute on function public.record_daily_score(uuid, date, integer, integer) to service_role;
