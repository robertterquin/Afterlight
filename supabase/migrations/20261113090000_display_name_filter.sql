-- Blocks offensive display names (English and Filipino) whenever a name is set or changed.
-- Existing names are not touched; the check runs on insert and on update of display_name.

create or replace function afterlight_private.is_blocked_name(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    -- Words caught anywhere in the name, even spelled with digits (sh1t) or split up (k u p a l).
    regexp_replace(translate(lower(p_name), '0134578', 'oieastb'), '[^a-z]', '', 'g')
      ~ '(fuck|fvck|shit|bitch|cunt|nigg|faggot|whore|slut|pussy|asshole|bastard|motherf|retard|porn|penis|vagina|hitler|putangina|tangina|tangena|putang|kupal|pakyu|pakshet|pakingshet|punyeta|tarantad|pokpok|pekpek|kantot|jakol|salsal|hindot|malibog|burat|inutil)'
    -- Short words only count as a whole word, so names like Classic, Therapist or Dickens stay allowed.
    or exists (
      select 1
      from regexp_split_to_table(lower(p_name), '[ _-]+') as token
      cross join lateral (values
        (regexp_replace(translate(regexp_replace(token, '^[0-9]+|[0-9]+$', '', 'g'), '0134578', 'oieastb'), '[^a-z]', '', 'g')),
        (case when token ~ '[a-z]' then regexp_replace(translate(token, '0134578', 'oieastb'), '[^a-z]', '', 'g') end)
      ) as variant(word)
      where variant.word = any (array[
        'fuk', 'fck', 'fag', 'fags', 'dick', 'cock', 'ass', 'rape', 'rapist', 'nazi', 'kys', 'sex', 'cum', 'tits', 'boobs', 'hoe', 'hoes',
        'puta', 'puke', 'gago', 'ulol', 'ulul', 'bobo', 'tanga', 'titi', 'tite', 'iyot', 'hayop', 'leche', 'bayag', 'libog', 'bilat'
      ])
    );
$function$;

create or replace function afterlight_private.check_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Generated names (Beacon-1A2B) are always allowed, so a new player can never be locked out.
  if new.display_name !~ '^Beacon-[0-9A-F]{4}$' and afterlight_private.is_blocked_name(new.display_name) then
    raise exception 'That name isn''t allowed. Try another.' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

revoke all on function afterlight_private.is_blocked_name(text) from public;
revoke all on function afterlight_private.check_display_name() from public;

create trigger player_profiles_display_name_filter
  before insert or update of display_name on public.player_profiles
  for each row execute function afterlight_private.check_display_name();
