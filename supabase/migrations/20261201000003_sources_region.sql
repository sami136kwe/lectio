-- Lectio: where a Father belongs (Greek/Syriac East or Latin West), so that the
-- Orthodox reading can favour Eastern Fathers and the Catholic reading Western ones.
alter table public.sources
  add column region text check (region is null or region in ('east', 'west'));
create index sources_region_idx on public.sources (region);
