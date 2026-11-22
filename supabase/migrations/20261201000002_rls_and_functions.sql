-- Logion: Row Level Security, read views and RPC functions.

-- ---------------------------------------------------------------------------
-- RLS on every table
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.traditions enable row level security;
alter table public.liturgical_seasons enable row level security;
alter table public.bible_versions enable row level security;
alter table public.bible_verses enable row level security;
alter table public.bible_chapter_stats enable row level security;
alter table public.psalm_numbering enable row level security;
alter table public.passages enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.cards enable row level security;
alter table public.card_translations enable row level security;
alter table public.card_perspectives enable row level security;
alter table public.sources enable row level security;
alter table public.perspective_sources enable row level security;
alter table public.liturgical_uses enable row level security;
alter table public.card_seasons enable row level security;
alter table public.profiles enable row level security;
alter table public.stashes enable row level security;
alter table public.card_reviews enable row level security;
alter table public.verse_memory enable row level security;
alter table public.card_views enable row level security;
alter table public.user_card_state enable row level security;
alter table public.daily_deck enable row level security;
alter table public.daily_deck_state enable row level security;
alter table public.reading_progress enable row level security;

-- Public reference data. Writes: service role only (it bypasses RLS).
create policy "categories are public" on public.categories for select to anon, authenticated using (true);
create policy "traditions are public" on public.traditions for select to anon, authenticated using (true);
create policy "seasons are public" on public.liturgical_seasons for select to anon, authenticated using (true);
create policy "bible versions are public" on public.bible_versions for select to anon, authenticated using (true);
create policy "bible verses are public" on public.bible_verses for select to anon, authenticated using (true);
create policy "chapter stats are public" on public.bible_chapter_stats for select to anon, authenticated using (true);
create policy "psalm numbering is public" on public.psalm_numbering for select to anon, authenticated using (true);
create policy "passages are public" on public.passages for select to anon, authenticated using (true);

create policy "published cards are public" on public.cards
  for select to anon, authenticated using (status = 'published');

create policy "published translations are public" on public.card_translations
  for select to anon, authenticated
  using (status = 'published' and exists (select 1 from public.cards c where c.id = card_id and c.status = 'published'));

-- Rejected readings are never shown; unreviewed ones are shown with a notice.
create policy "readings of published cards are public" on public.card_perspectives
  for select to anon, authenticated
  using (review_status <> 'rejected' and exists (select 1 from public.cards c where c.id = card_id and c.status = 'published'));

create policy "verified sources are public" on public.sources
  for select to anon, authenticated using (verified);

create policy "links to verified sources are public" on public.perspective_sources
  for select to anon, authenticated
  using (
    exists (select 1 from public.sources s where s.id = source_id and s.verified)
    and exists (
      select 1 from public.card_perspectives p join public.cards c on c.id = p.card_id
      where p.id = perspective_id and c.status = 'published' and p.review_status <> 'rejected'
    )
  );

create policy "verified liturgical uses are public" on public.liturgical_uses
  for select to anon, authenticated using (verified);

create policy "seasons of published cards are public" on public.card_seasons
  for select to anon, authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and c.status = 'published'));

revoke insert, update, delete on
  public.categories, public.traditions, public.liturgical_seasons, public.bible_versions, public.bible_verses,
  public.bible_chapter_stats, public.psalm_numbering, public.passages, public.cards, public.card_translations,
  public.card_perspectives, public.sources, public.perspective_sources, public.liturgical_uses, public.card_seasons
from anon, authenticated;
revoke all on public.ingestion_runs from anon, authenticated;

-- Profiles: own row only; streak columns are maintained by record_activity().
create policy "read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (
  display_name, interests, daily_goal, language, onboarded, daily_limit, timezone, include_reread, reread_ratio,
  tradition_view, bible_version_fr, bible_version_en, show_greek, reviewed_only
) on public.profiles to authenticated;

-- Per-user tables: full access to own rows.
do $$
declare
  t text;
begin
  foreach t in array array['stashes', 'card_reviews', 'verse_memory', 'reading_progress'] loop
    execute format('create policy "read own %1$s" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "insert own %1$s" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "update own %1$s" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "delete own %1$s" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
  foreach t in array array['daily_deck', 'daily_deck_state'] loop
    execute format('create policy "read own %1$s" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "insert own %1$s" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "update own %1$s" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke delete on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- Views: append-only log.
create policy "read own views" on public.card_views for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own views" on public.card_views for insert to authenticated with check ((select auth.uid()) = user_id);
revoke update, delete on public.card_views from anon, authenticated;

-- Reading state: written by triggers only.
create policy "read own card state" on public.user_card_state for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.user_card_state from anon, authenticated;

-- ---------------------------------------------------------------------------
-- card_details: one row per (card, language), with passage and category.
-- ---------------------------------------------------------------------------
create view public.card_details
with (security_invoker = true)
as
select
  c.id,
  t.id as translation_id,
  c.passage_id,
  p.book_code,
  p.chapter_start,
  p.verse_start,
  p.chapter_end,
  p.verse_end,
  p.psalm_number_hebrew,
  p.psalm_number_lxx,
  p.sort_key,
  c.category_id,
  coalesce(cat.parent_id, cat.id) as main_category_id,
  cat.slug as category_slug,
  cat.name_fr as category_name_fr,
  cat.name_en as category_name_en,
  coalesce(parent.icon, cat.icon) as category_icon,
  t.plain_explanation,
  t.action_step,
  t.key_words,
  c.difficulty,
  t.language,
  t.status,
  c.quality_score,
  c.theology_score,
  t.style_score,
  c.stash_count,
  c.source_type,
  c.created_at
from public.cards c
join public.card_translations t on t.card_id = c.id
join public.passages p on p.id = c.passage_id
join public.categories cat on cat.id = c.category_id
left join public.categories parent on parent.id = cat.parent_id;

grant select on public.card_details to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Feed candidates: unseen published cards for the current user.
-- ---------------------------------------------------------------------------
create or replace function public.feed_candidates(
  p_language text,
  p_category_ids uuid[],
  p_include boolean,
  p_limit integer default 40
)
returns table (id uuid, main_category_id uuid, rank_score double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.id,
    d.main_category_id,
    (coalesce(d.quality_score, 7)::double precision * 0.3
      + coalesce(d.theology_score, 7)::double precision * 0.3
      + coalesce(d.style_score, 7)::double precision * 0.2
      + ln(1 + d.stash_count) * 0.5
      + random() * 2.5) as rank_score
  from public.card_details d
  where d.status = 'published'
    and d.language = p_language
    and (
      coalesce(array_length(p_category_ids, 1), 0) = 0
      or (p_include and d.main_category_id = any (p_category_ids))
      or (not p_include and not (d.main_category_id = any (p_category_ids)))
    )
    and not exists (select 1 from public.card_views v where v.user_id = (select auth.uid()) and v.card_id = d.id)
    and not exists (select 1 from public.stashes s where s.user_id = (select auth.uid()) and s.card_id = d.id)
  order by rank_score desc
  limit least(greatest(p_limit, 1), 200);
$$;

create or replace function public.daily_challenge(p_day date)
returns setof public.card_details
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select p.language, p.interests from public.profiles p where p.id = (select auth.uid()))
  select d.*
  from public.card_details d, me
  where d.status = 'published'
    and d.language = me.language
    and (coalesce(array_length(me.interests, 1), 0) = 0 or d.main_category_id = any (me.interests))
  order by md5((select auth.uid())::text || p_day::text || d.id::text)
  limit 1;
$$;

-- Streak (unchanged from Stash).
create or replace function public.record_activity(p_day date)
returns table (streak_count integer, longest_streak integer, last_active_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  prev date;
  cur integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_day < (now() at time zone 'utc')::date - 1 or p_day > (now() at time zone 'utc')::date + 1 then
    raise exception 'invalid day';
  end if;
  select p.last_active_date, p.streak_count into prev, cur from public.profiles p where p.id = uid for update;
  if prev is null or prev < p_day - 1 then
    cur := 1;
  elsif prev = p_day - 1 then
    cur := cur + 1;
  end if;
  update public.profiles p
  set streak_count = cur,
      longest_streak = greatest(p.longest_streak, cur),
      last_active_date = greatest(coalesce(p.last_active_date, p_day), p_day)
  where p.id = uid;
  return query select p.streak_count, p.longest_streak, p.last_active_date from public.profiles p where p.id = uid;
end;
$$;
revoke execute on function public.record_activity(date) from public, anon;
grant execute on function public.record_activity(date) to authenticated;

create or replace function public.category_progress()
returns table (
  category_id uuid, slug text, name_fr text, name_en text, icon text,
  total bigint, seen bigint, stashed bigint, completed bigint, reviewed bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select coalesce((select p.language from public.profiles p where p.id = (select auth.uid())), 'fr') as language
  ),
  pub as (
    select d.id, d.main_category_id from public.card_details d, me
    where d.status = 'published' and d.language = me.language
  )
  select
    m.id, m.slug, m.name_fr, m.name_en, m.icon,
    (select count(*) from pub where pub.main_category_id = m.id),
    (select count(distinct v.card_id) from public.card_views v join pub on pub.id = v.card_id
       where pub.main_category_id = m.id and v.user_id = (select auth.uid())),
    (select count(*) from public.stashes s join pub on pub.id = s.card_id
       where pub.main_category_id = m.id and s.user_id = (select auth.uid())),
    (select count(distinct v.card_id) from public.card_views v join pub on pub.id = v.card_id
       where pub.main_category_id = m.id and v.user_id = (select auth.uid()) and v.action = 'completed'),
    (select count(*) from public.card_reviews r join pub on pub.id = r.card_id
       where pub.main_category_id = m.id and r.user_id = (select auth.uid()) and r.repetitions > 0)
  from public.categories m
  where m.parent_id is null
  order by m.sort_order;
$$;

-- Reading progress per book: published cards and cards read by the current user.
create or replace function public.book_progress(p_language text)
returns table (book_code text, total bigint, read bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.book_code,
    count(*),
    count(*) filter (where exists (
      select 1 from public.user_card_state s
      where s.user_id = (select auth.uid()) and s.card_id = d.id and s.read_count > 0
    ))
  from public.card_details d
  where d.status = 'published' and d.language = p_language
  group by d.book_code;
$$;

-- ---------------------------------------------------------------------------
-- History and re-reading (from Stash)
-- ---------------------------------------------------------------------------
create or replace function public.history_cards(
  p_language text,
  p_category uuid default null,
  p_sub uuid default null,
  p_stashed boolean default false,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_q text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (card_id uuid, first_read_at timestamptz, last_read_at timestamptz, read_count integer, is_stashed boolean, total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.card_id, s.first_read_at, s.last_read_at, s.read_count, s.is_stashed, count(*) over () as total_count
  from public.user_card_state s
  join public.card_details d on d.id = s.card_id and d.language = p_language and d.status = 'published'
  where s.user_id = (select auth.uid())
    and s.read_count > 0
    and (p_category is null or d.main_category_id = p_category)
    and (p_sub is null or d.category_id = p_sub)
    and (not p_stashed or s.is_stashed)
    and (p_from is null or s.last_read_at >= p_from)
    and (p_to is null or s.last_read_at < p_to)
    and (
      p_q is null
      or exists (
        select 1 from public.card_translations t
        where t.card_id = s.card_id and t.language = p_language
          and t.search @@ websearch_to_tsquery(case when p_language = 'fr' then 'french'::regconfig else 'english'::regconfig end, p_q)
      )
    )
  order by s.last_read_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.reread_candidates(
  p_language text,
  p_mode text default 'random',
  p_category uuid default null,
  p_limit integer default 20,
  p_exclude uuid[] default '{}'
)
returns table (card_id uuid, read_count integer, last_read_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.card_id, s.read_count, s.last_read_at
  from public.user_card_state s
  join public.card_details d on d.id = s.card_id and d.language = p_language and d.status = 'published'
  where s.user_id = (select auth.uid())
    and s.read_count > 0
    and not (s.card_id = any (p_exclude))
    and (p_mode <> 'stashed' or s.is_stashed)
    and (p_category is null or d.main_category_id = p_category)
  order by
    case when p_mode in ('random', 'category', 'stashed') then random() end,
    case when p_mode = 'least' then s.read_count end asc,
    s.last_read_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Semantic search helpers (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.match_translations(
  query_embedding extensions.vector(384),
  match_language text,
  match_threshold double precision default 0.9,
  match_count integer default 5
)
returns table (card_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.card_id, 1 - (t.embedding operator(extensions.<=>) query_embedding)
  from public.card_translations t
  where t.embedding is not null and t.language = match_language and t.status in ('published', 'draft')
    and 1 - (t.embedding operator(extensions.<=>) query_embedding) > match_threshold
  order by t.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

create or replace function public.match_perspectives(
  query_embedding extensions.vector(384),
  match_language text,
  match_tradition text,
  match_threshold double precision default 0.9,
  match_count integer default 5
)
returns table (card_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.card_id, 1 - (p.embedding operator(extensions.<=>) query_embedding)
  from public.card_perspectives p
  where p.embedding is not null and p.language = match_language and p.tradition = match_tradition
    and p.review_status <> 'rejected'
    and 1 - (p.embedding operator(extensions.<=>) query_embedding) > match_threshold
  order by p.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

create or replace function public.match_sources(
  query_embedding extensions.vector(384),
  match_tradition text,
  match_count integer default 6
)
returns table (id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, 1 - (s.embedding operator(extensions.<=>) query_embedding)
  from public.sources s
  where s.verified and s.embedding is not null and s.tradition in (match_tradition, 'common')
  order by s.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 30);
$$;

create or replace function public.category_card_counts()
returns table (category_id uuid, slug text, language text, status text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, m.slug, t.language, t.status, count(*)
  from public.card_translations t
  join public.cards c on c.id = t.card_id
  join public.categories cat on cat.id = c.category_id
  join public.categories m on m.id = coalesce(cat.parent_id, cat.id)
  group by m.id, m.slug, t.language, t.status;
$$;

revoke execute on function public.match_translations(extensions.vector, text, double precision, integer) from public, anon, authenticated;
revoke execute on function public.match_perspectives(extensions.vector, text, text, double precision, integer) from public, anon, authenticated;
revoke execute on function public.match_sources(extensions.vector, text, integer) from public, anon, authenticated;
revoke execute on function public.category_card_counts() from public, anon, authenticated;
grant execute on function public.match_translations(extensions.vector, text, double precision, integer) to service_role;
grant execute on function public.match_perspectives(extensions.vector, text, text, double precision, integer) to service_role;
grant execute on function public.match_sources(extensions.vector, text, integer) to service_role;
grant execute on function public.category_card_counts() to service_role;
