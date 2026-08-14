-- =========================================================
-- THE COMMUNITY PULSE FOUNDATION — FULL SITE DATABASE
-- Run this once in Supabase -> SQL Editor -> New query -> Run
-- Safe to run again later; it will not delete anything.
-- =========================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- ========== 1. PAGES (custom menu pages) ==========
create table if not exists public.pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title_en     text not null,
  title_fr     text,
  body_en      text,
  body_fr      text,
  image_url    text,
  show_in_menu boolean not null default true,
  menu_order   integer not null default 0,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.pages add column if not exists image_url text;


-- ========== 2. PROGRAMS ==========
create table if not exists public.programs (
  id              uuid primary key default gen_random_uuid(),
  title_en        text not null,
  title_fr        text,
  subtitle_en     text,
  subtitle_fr     text,
  description_en  text,
  description_fr  text,
  image_url       text,
  sort_order      integer not null default 0,
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);


-- ========== 3. EVENTS / PAST OUTREACHES ==========
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  title_en     text not null,
  title_fr     text,
  date_en      text,
  date_fr      text,
  location_en  text,
  location_fr  text,
  summary_en   text,
  summary_fr   text,
  details_en   text,
  details_fr   text,
  image_url    text,
  sort_order   integer not null default 0,
  visible      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);


-- ========== 4. TEAM ==========
create table if not exists public.team (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role_en     text,
  role_fr     text,
  bio_en      text,
  bio_fr      text,
  image_url   text,
  sort_order  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ========== 5. SITE SETTINGS ==========
create table if not exists public.settings (
  key        text primary key,
  value_en   text,
  value_fr   text,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value_en, value_fr) values
  ('heroTitle1',    'Connecting People.',              'Relier les gens.'),
  ('heroTitle2',    'Building Stronger Communities.',  'Batir des communautes plus fortes.'),
  ('heroSubtitle',  'A non-profit organization dedicated to strengthening communities through connection, inclusion, meaningful dialogue, and positive social impact across New Brunswick and beyond.', 'Un organisme sans but lucratif dedie a renforcer les communautes par la connexion, l''inclusion, le dialogue significatif et l''impact social positif, au Nouveau-Brunswick et au-dela.'),
  ('contactEmail',  'info@thecommunitypulsefoundation.ca', 'info@thecommunitypulsefoundation.ca'),
  ('contactPhone',  '506 995 0119 / 506 282 5901', '506 995 0119 / 506 282 5901'),
  ('contactPlace',  'Fredericton, New Brunswick, Canada', 'Fredericton, Nouveau-Brunswick, Canada'),
  ('donateEmail',   'donations@thecommunitypulsefoundation.ca', 'donations@thecommunitypulsefoundation.ca'),
  ('volunteerForm', 'get-involved.html', 'get-involved.html')
on conflict (key) do nothing;


-- ========== 6. TRIGGERS ==========
do $$
declare t text;
begin
  foreach t in array array['pages','programs','events','team','settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;


-- ========== 7. SECURITY ==========
alter table public.pages    enable row level security;
alter table public.programs enable row level security;
alter table public.events   enable row level security;
alter table public.team     enable row level security;
alter table public.settings enable row level security;

drop policy if exists "public read pages" on public.pages;
create policy "public read pages" on public.pages
  for select to anon using (published = true);

drop policy if exists "public read programs" on public.programs;
create policy "public read programs" on public.programs
  for select to anon using (visible = true);

drop policy if exists "public read events" on public.events;
create policy "public read events" on public.events
  for select to anon using (visible = true);

drop policy if exists "public read team" on public.team;
create policy "public read team" on public.team
  for select to anon using (visible = true);

drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings
  for select to anon using (true);

do $$
declare t text;
begin
  foreach t in array array['pages','programs','events','team','settings'] loop
    execute format('drop policy if exists "admin all %I" on public.%I', t, t);
    execute format(
      'create policy "admin all %I" on public.%I
       for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;


-- ========== 8. IMAGE STORAGE ==========
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

drop policy if exists "public view images" on storage.objects;
create policy "public view images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'site-images');

drop policy if exists "admin upload images" on storage.objects;
create policy "admin upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-images');

drop policy if exists "admin replace images" on storage.objects;
create policy "admin replace images" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-images');

drop policy if exists "admin remove images" on storage.objects;
create policy "admin remove images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-images');
