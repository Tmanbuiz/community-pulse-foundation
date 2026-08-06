-- =========================================================
-- THE COMMUNITY PULSE FOUNDATION — DATABASE SETUP
-- Run this once in Supabase → SQL Editor → New query → Run
-- =========================================================

create table if not exists public.pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,          -- e.g. "our-history"  →  page.html?slug=our-history
  title_en     text not null,
  title_fr     text,
  body_en      text,
  body_fr      text,
  show_in_menu boolean not null default true,
  menu_order   integer not null default 0,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Keep updated_at accurate
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists pages_touch_updated_at on public.pages;
create trigger pages_touch_updated_at
  before update on public.pages
  for each row execute function public.touch_updated_at();

-- =========================================================
-- SECURITY: visitors can only READ published pages.
-- Only signed-in admins can create, edit or delete.
-- =========================================================
alter table public.pages enable row level security;

drop policy if exists "visitors read published pages" on public.pages;
create policy "visitors read published pages"
  on public.pages for select
  to anon
  using (published = true);

drop policy if exists "admins read all pages" on public.pages;
create policy "admins read all pages"
  on public.pages for select
  to authenticated
  using (true);

drop policy if exists "admins create pages" on public.pages;
create policy "admins create pages"
  on public.pages for insert
  to authenticated
  with check (true);

drop policy if exists "admins edit pages" on public.pages;
create policy "admins edit pages"
  on public.pages for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "admins delete pages" on public.pages;
create policy "admins delete pages"
  on public.pages for delete
  to authenticated
  using (true);

-- Optional: one example page so you can see it working right away
insert into public.pages (slug, title_en, title_fr, body_en, body_fr, published, menu_order)
values (
  'our-history',
  'Our History',
  'Notre histoire',
  E'## How we started\n\nThe Community Pulse Foundation was incorporated in New Brunswick to bring newcomers and long-term residents together.\n\n- Community outreach and food drives\n- Advocacy for immigrant families\n- Storytelling through our podcast',
  E'## Nos débuts\n\nLa Fondation Community Pulse a été constituée au Nouveau-Brunswick pour rapprocher les nouveaux arrivants et les résidents de longue date.\n\n- Sensibilisation communautaire et collectes alimentaires\n- Plaidoyer pour les familles immigrantes\n- Récits à travers notre balado',
  true,
  1
)
on conflict (slug) do nothing;
