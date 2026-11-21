-- Lectio: core schema.
-- Bible text (imported deterministically), passages, cards and their readings
-- per tradition, verified sources, liturgy, and the user tables inherited from Stash.
-- Row Level Security and functions live in the next migration.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

-- Theme categories (two levels: main category > subcategory), as in Stash.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_fr text not null,
  name_en text not null,
  parent_id uuid references public.categories (id) on delete cascade,
  description text,
  description_en text,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index categories_parent_id_idx on public.categories (parent_id);

-- Traditions are data, not code: another tradition can be added with one row.
create table public.traditions (
  code text primary key check (code ~ '^[a-z_]+$'),
  name_fr text not null,
  name_en text not null,
  sort_order integer not null default 0
);

create table public.liturgical_seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_fr text not null,
  name_en text not null,
  description_fr text,
  description_en text,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Bible text
-- ---------------------------------------------------------------------------
create table public.bible_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]+$'),
  name text not null,
  language text not null check (language in ('fr', 'en', 'grc')),
  textual_tradition text not null check (textual_tradition in ('hebrew', 'septuagint', 'vulgate', 'greek_byzantine')),
  -- How Psalms are numbered: mt = Hebrew numbering, titles counted as verses (LSG);
  -- eng = Hebrew numbering, titles not numbered (WEB, KJV); lxx = Greek/Vulgate numbering.
  versification text not null check (versification in ('mt', 'eng', 'lxx')),
  scope text not null check (scope in ('nt', 'psalms', 'nt_psalms')),
  license text not null,
  source_url text not null,
  source_sha256 text not null,
  attribution text not null,
  verse_count integer not null default 0,
  imported_at timestamptz
);

create table public.bible_verses (
  id bigint generated always as identity primary key,
  version_id uuid not null references public.bible_versions (id) on delete cascade,
  language text not null check (language in ('fr', 'en', 'grc')),
  book_code text not null check (book_code ~ '^[1-3A-Z]{3}$'),
  chapter smallint not null check (chapter between 1 and 151),
  verse smallint not null check (verse between 1 and 200),
  text text not null check (char_length(text) between 1 and 2000),
  search tsvector generated always as (
    to_tsvector(
      case language when 'fr' then 'french'::regconfig when 'en' then 'english'::regconfig else 'simple'::regconfig end,
      text
    )
  ) stored,
  unique (version_id, book_code, chapter, verse)
);
create index bible_verses_lookup_idx on public.bible_verses (book_code, chapter, verse);
create index bible_verses_search_idx on public.bible_verses using gin (search);

-- Per chapter and version: verse count found vs expected. A chapter whose
-- verse division differs from the reference numbering is "not aligned": the
-- app never maps verse numbers into it and falls back to another version.
create table public.bible_chapter_stats (
  version_id uuid not null references public.bible_versions (id) on delete cascade,
  book_code text not null,
  chapter smallint not null,
  verse_count smallint not null,
  expected_count smallint not null,
  aligned boolean not null,
  primary key (version_id, book_code, chapter)
);

-- Hebrew <-> Greek (Septuagint / Vulgate) Psalm numbering, at verse level:
-- Hebrew psalm P, verses [start, end] = Greek psalm L, verse + lxx_verse_offset.
create table public.psalm_numbering (
  id smallint primary key,
  hebrew_psalm smallint not null check (hebrew_psalm between 1 and 150),
  hebrew_verse_start smallint not null,
  hebrew_verse_end smallint not null,
  lxx_psalm smallint not null check (lxx_psalm between 1 and 151),
  lxx_verse_offset smallint not null default 0,
  note text,
  unique (hebrew_psalm, hebrew_verse_start)
);

-- ---------------------------------------------------------------------------
-- Passages and cards
-- ---------------------------------------------------------------------------

-- Passages use the reference numbering: NT as in every version, Psalms in the
-- Hebrew numbering with titles counted as verses (LSG). Psalm 151 exists only
-- in the Septuagint: chapter 151, psalm_number_hebrew null.
create table public.passages (
  id uuid primary key default gen_random_uuid(),
  book_code text not null check (book_code ~ '^[1-3A-Z]{3}$'),
  chapter_start smallint not null,
  verse_start smallint not null,
  chapter_end smallint not null,
  verse_end smallint not null,
  psalm_number_hebrew smallint check (psalm_number_hebrew between 1 and 150),
  psalm_number_lxx text,
  sort_key integer not null,
  created_at timestamptz not null default now(),
  unique (book_code, chapter_start, verse_start, chapter_end, verse_end),
  check ((chapter_end, verse_end) >= (chapter_start, verse_start))
);
create index passages_book_idx on public.passages (book_code, sort_key);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source text not null check (source in ('seed', 'admin', 'manual', 'import')),
  scope text,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  cards_created integer not null default 0,
  cards_rejected integer not null default 0,
  model_calls integer not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  errors jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb
);
create index ingestion_runs_started_at_idx on public.ingestion_runs (started_at desc);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.passages (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  status text not null default 'draft' check (status in ('draft', 'published', 'rejected')),
  quality_score numeric(4, 2) check (quality_score is null or quality_score between 0 and 10),
  theology_score numeric(4, 2) check (theology_score is null or theology_score between 0 and 10),
  content_hash text not null unique,
  -- sha256 of the reference text of the passage when the card was written:
  -- check:db recomputes it to prove the Bible text has not drifted.
  passage_text_hash text not null,
  source_type text not null default 'pipeline' check (source_type in ('seed', 'pipeline', 'manual')),
  ingestion_run_id uuid references public.ingestion_runs (id) on delete set null,
  rejection_reason text,
  stash_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index cards_passage_idx on public.cards (passage_id);
create index cards_category_idx on public.cards (category_id);
create index cards_status_idx on public.cards (status);

create table public.card_translations (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  language text not null check (language in ('fr', 'en')),
  plain_explanation text not null check (char_length(plain_explanation) between 80 and 1400),
  action_step text not null check (char_length(action_step) between 10 and 400),
  -- [{ "lemma": "ἀγάπη", "transliteration": "agapē", "gloss": "...", "source_id": "uuid" }]
  key_words jsonb not null default '[]'::jsonb check (jsonb_typeof(key_words) = 'array'),
  style_score numeric(4, 2) check (style_score is null or style_score between 0 and 10),
  status text not null default 'draft' check (status in ('draft', 'published', 'rejected')),
  embedding extensions.vector(384),
  search tsvector generated always as (
    to_tsvector(
      case when language = 'fr' then 'french'::regconfig else 'english'::regconfig end,
      coalesce(plain_explanation, '') || ' ' || coalesce(action_step, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  unique (card_id, language)
);
create index card_translations_lang_status_idx on public.card_translations (language, status);
create index card_translations_search_idx on public.card_translations using gin (search);
create index card_translations_embedding_idx on public.card_translations using hnsw (embedding extensions.vector_cosine_ops);

create table public.card_perspectives (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  language text not null check (language in ('fr', 'en')),
  tradition text not null references public.traditions (code),
  body text not null check (char_length(body) between 80 and 1400),
  divergence_type text not null default 'none' check (divergence_type in ('agree', 'differ', 'none')),
  divergence_summary text check (divergence_summary is null or char_length(divergence_summary) <= 400),
  -- Free slug for the "where traditions differ" filter: filioque, primacy, marian-dogmas, purgatory, theosis, icons...
  divergence_topic text check (divergence_topic is null or divergence_topic ~ '^[a-z0-9-]+$'),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'reviewed', 'corrected', 'rejected')),
  reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 2000),
  reviewed_at timestamptz,
  embedding extensions.vector(384),
  search tsvector generated always as (
    to_tsvector(case when language = 'fr' then 'french'::regconfig else 'english'::regconfig end, coalesce(body, ''))
  ) stored,
  created_at timestamptz not null default now(),
  unique (card_id, language, tradition)
);
create index card_perspectives_review_idx on public.card_perspectives (review_status, tradition);
create index card_perspectives_divergence_idx on public.card_perspectives (divergence_type, divergence_topic);
create index card_perspectives_search_idx on public.card_perspectives using gin (search);
create index card_perspectives_embedding_idx on public.card_perspectives using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Verified sources and liturgy
-- ---------------------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  tradition text not null references public.traditions (code),
  kind text not null check (kind in ('patristic', 'magisterial_reference', 'liturgical', 'lexicon', 'commentary_pd')),
  author text not null,
  work text not null,
  section text not null,
  language text not null check (language in ('fr', 'en', 'grc', 'la', 'he')),
  -- Full text only when it is free of rights; null for references (e.g. Catechism paragraph numbers).
  text text,
  -- Bible references this extract comments on, e.g. {"JHN 3:16","JHN 3:17"}.
  bible_refs text[] not null default '{}',
  url text not null,
  license text not null,
  verified boolean not null default false,
  content_hash text not null unique,
  embedding extensions.vector(384),
  search tsvector generated always as (
    to_tsvector(case when language = 'fr' then 'french'::regconfig when language = 'en' then 'english'::regconfig else 'simple'::regconfig end,
      coalesce(author, '') || ' ' || coalesce(work, '') || ' ' || coalesce(text, ''))
  ) stored,
  imported_at timestamptz not null default now(),
  check (kind = 'magisterial_reference' or text is not null)
);
create index sources_refs_idx on public.sources using gin (bible_refs);
create index sources_search_idx on public.sources using gin (search);
create index sources_embedding_idx on public.sources using hnsw (embedding extensions.vector_cosine_ops);

create table public.perspective_sources (
  perspective_id uuid not null references public.card_perspectives (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete restrict,
  usage text not null check (usage in ('quote', 'paraphrase', 'reference')),
  quote text check (quote is null or array_length(regexp_split_to_array(btrim(quote), '\s+'), 1) < 25),
  primary key (perspective_id, source_id)
);
create index perspective_sources_source_idx on public.perspective_sources (source_id);

create table public.liturgical_uses (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid references public.passages (id) on delete cascade,
  -- The use may cover a wider range than one passage (a whole psalm, a pericope).
  book_code text not null,
  chapter_start smallint not null,
  verse_start smallint not null,
  chapter_end smallint not null,
  verse_end smallint not null,
  tradition text not null references public.traditions (code),
  rite text not null check (rite in ('roman', 'byzantine')),
  occasion_type text not null check (occasion_type in ('sunday_cycle', 'feast', 'hours', 'kathisma', 'prokeimenon', 'other')),
  description_fr text not null,
  description_en text not null,
  calendar text not null check (calendar in ('gregorian', 'julian', 'revised_julian', 'none')),
  season_id uuid references public.liturgical_seasons (id) on delete set null,
  source_id uuid references public.sources (id) on delete restrict,
  verified boolean not null default false,
  check (not verified or source_id is not null)
);
create index liturgical_uses_ref_idx on public.liturgical_uses (book_code, chapter_start, chapter_end);

create table public.card_seasons (
  card_id uuid not null references public.cards (id) on delete cascade,
  season_id uuid not null references public.liturgical_seasons (id) on delete cascade,
  primary key (card_id, season_id)
);
create index card_seasons_season_idx on public.card_seasons (season_id);

-- ---------------------------------------------------------------------------
-- User data (inherited from Stash)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  interests uuid[] not null default '{}',
  daily_goal smallint not null default 5 check (daily_goal in (3, 5, 10)),
  streak_count integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  language text not null default 'fr' check (language in ('fr', 'en')),
  onboarded boolean not null default false,
  daily_limit text not null default 'unlimited' check (daily_limit in ('50', 'unlimited')),
  timezone text not null default 'UTC',
  include_reread boolean not null default false,
  reread_ratio smallint not null default 20 check (reread_ratio in (10, 20, 30, 50)),
  -- Lectio
  tradition_view text not null default 'both' check (tradition_view in ('both', 'catholic', 'orthodox', 'neutral')),
  bible_version_fr text not null default 'LSG1910',
  bible_version_en text not null default 'WEB',
  show_greek boolean not null default false,
  reviewed_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stashes (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index stashes_card_id_idx on public.stashes (card_id);
create index stashes_user_created_idx on public.stashes (user_id, created_at desc);

create table public.card_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  rating smallint check (rating is null or rating between 1 and 4),
  next_review_at timestamptz not null default now(),
  interval_days integer not null default 0 check (interval_days >= 0),
  ease_factor numeric(4, 2) not null default 2.5 check (ease_factor >= 1.3),
  repetitions integer not null default 0,
  last_reviewed_at timestamptz,
  primary key (user_id, card_id)
);
create index card_reviews_due_idx on public.card_reviews (user_id, next_review_at);

-- "Learn this verse": SM-2 on the passage text, with progressive word masking.
create table public.verse_memory (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  mask_level smallint not null default 0 check (mask_level between 0 and 5),
  rating smallint check (rating is null or rating between 1 and 4),
  next_review_at timestamptz not null default now(),
  interval_days integer not null default 0 check (interval_days >= 0),
  ease_factor numeric(4, 2) not null default 2.5 check (ease_factor >= 1.3),
  repetitions integer not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index verse_memory_due_idx on public.verse_memory (user_id, next_review_at);

create table public.card_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  action text not null check (action in ('seen', 'skipped', 'stashed', 'completed', 'reread')),
  created_at timestamptz not null default now()
);
create index card_views_user_card_idx on public.card_views (user_id, card_id);
create index card_views_user_created_idx on public.card_views (user_id, created_at desc);

create table public.user_card_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  first_read_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  read_count integer not null default 1 check (read_count >= 0),
  is_stashed boolean not null default false,
  primary key (user_id, card_id)
);
create index user_card_state_recent_idx on public.user_card_state (user_id, last_read_at desc);
create index user_card_state_card_idx on public.user_card_state (card_id);

create table public.daily_deck (
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_date date not null,
  card_id uuid not null references public.cards (id) on delete cascade,
  position integer not null check (position >= 1),
  seen_at timestamptz,
  primary key (user_id, deck_date, position),
  unique (user_id, deck_date, card_id)
);
create index daily_deck_card_idx on public.daily_deck (card_id);

create table public.daily_deck_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_date date not null,
  current_position integer not null default 1 check (current_position >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_date)
);

-- Continuous reading ("read in order"): last card read per book.
create table public.reading_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_code text not null,
  last_card_id uuid references public.cards (id) on delete set null,
  last_sort_key integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_code)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lang text := coalesce(new.raw_user_meta_data ->> 'language', 'fr');
begin
  if lang not in ('fr', 'en') then
    lang := 'fr';
  end if;
  insert into public.profiles (id, display_name, language)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 60),
    lang
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_stash_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.cards set stash_count = stash_count + 1 where id = new.card_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.cards set stash_count = greatest(stash_count - 1, 0) where id = old.card_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger stashes_count_trigger
  after insert or delete on public.stashes
  for each row execute function public.sync_stash_count();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.track_card_read()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action in ('seen', 'reread') then
    insert into public.user_card_state (user_id, card_id, first_read_at, last_read_at, read_count)
    values (new.user_id, new.card_id, new.created_at, new.created_at, 1)
    on conflict (user_id, card_id) do update
      set first_read_at = case
            when public.user_card_state.read_count = 0 then excluded.first_read_at
            else public.user_card_state.first_read_at
          end,
          last_read_at = excluded.last_read_at,
          read_count = public.user_card_state.read_count + 1;
  end if;
  return new;
end;
$$;

create trigger card_views_track_read
  after insert on public.card_views
  for each row execute function public.track_card_read();

create or replace function public.track_card_stash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.user_card_state (user_id, card_id, read_count, is_stashed)
    values (new.user_id, new.card_id, 0, true)
    on conflict (user_id, card_id) do update set is_stashed = true;
    return new;
  end if;
  update public.user_card_state set is_stashed = false
  where user_id = old.user_id and card_id = old.card_id;
  return old;
end;
$$;

create trigger stashes_track_state
  after insert or delete on public.stashes
  for each row execute function public.track_card_stash();
