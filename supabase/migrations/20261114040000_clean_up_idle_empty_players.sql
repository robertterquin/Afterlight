-- Every visit signs in an anonymous player, even if no run is ever finished, so empty players pile up.
-- Once a day, remove anonymous players who have never saved a score, kept the generated name, and have not
-- been back for 7 days. Their profile row goes with them (on delete cascade). If such a player ever returns,
-- the game starts a fresh anonymous player for them (see ensureAnonymousUser in src/supabase.ts).

create extension if not exists pg_cron with schema pg_catalog;

create or replace function afterlight_private.delete_idle_empty_players()
returns integer
language sql
security definer
set search_path = ''
as $function$
  with removed as (
    delete from auth.users as u
    where u.is_anonymous
      and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '7 days'
      and not exists (select 1 from public.daily_scores as s where s.player_id = u.id)
      and not exists (
        select 1 from public.player_profiles as p
        where p.user_id = u.id and p.display_name !~ '^Beacon-[0-9A-F]{4}$'
      )
      and not exists (
        select 1 from auth.sessions as se
        where se.user_id = u.id
          and greatest(se.refreshed_at::timestamptz, se.updated_at, se.created_at) > now() - interval '7 days'
      )
    returning 1
  )
  select count(*)::integer from removed;
$function$;

revoke all on function afterlight_private.delete_idle_empty_players() from public, anon, authenticated;

-- 04:17 UTC daily, a quiet hour well after the 00:00 UTC course reset.
select cron.schedule(
  'afterlight-clean-up-idle-empty-players',
  '17 4 * * *',
  'select afterlight_private.delete_idle_empty_players()'
);
