-- =========================================================
-- COMMUNITY PULSE — TEAM ACCESS (ROLES) + EDITABLE IMAGES
-- Run this in Supabase -> SQL Editor -> New query -> Run
-- Run supabase-setup.sql FIRST if you have not already.
-- Safe to run more than once.
-- =========================================================

-- ========== 1. PROFILES (who can do what) ==========
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'viewer'
             check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now()
);

-- Give every existing login a profile.
-- The very first account becomes the owner.
insert into public.profiles (id, email, role)
select u.id,
       u.email,
       case when not exists (select 1 from public.profiles where role = 'owner')
                 and u.created_at = (select min(created_at) from auth.users)
            then 'owner' else 'admin' end
from auth.users u
on conflict (id) do nothing;

-- New logins automatically get a profile
create or replace function public.cpf_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email,
          case when exists (select 1 from public.profiles where role = 'owner')
               then 'viewer' else 'owner' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists cpf_on_new_user on auth.users;
create trigger cpf_on_new_user
  after insert on auth.users
  for each row execute function public.cpf_new_user();


-- ========== 2. PERMISSION HELPERS ==========
-- security definer so they can read profiles without tripping RLS
create or replace function public.cpf_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer')
$$;

create or replace function public.cpf_can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select public.cpf_role() in ('owner','admin','editor')
$$;

create or replace function public.cpf_can_manage_users()
returns boolean language sql stable security definer set search_path = public as $$
  select public.cpf_role() in ('owner','admin')
$$;

create or replace function public.cpf_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.cpf_role() = 'owner'
$$;


-- ========== 3. PROFILE RULES ==========
alter table public.profiles enable row level security;

drop policy if exists "signed in can see the team" on public.profiles;
create policy "signed in can see the team" on public.profiles
  for select to authenticated using (true);

drop policy if exists "managers change roles" on public.profiles;
create policy "managers change roles" on public.profiles
  for update to authenticated
  using (public.cpf_can_manage_users())
  with check (public.cpf_can_manage_users());

drop policy if exists "owner removes people" on public.profiles;
create policy "owner removes people" on public.profiles
  for delete to authenticated using (public.cpf_is_owner());

-- Only the owner may create or remove another owner,
-- and nobody can demote the last owner.
create or replace function public.cpf_guard_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'owner' and old.role <> 'owner' and not public.cpf_is_owner() then
    raise exception 'Only the owner can make someone an owner';
  end if;

  if old.role = 'owner' and new.role <> 'owner' then
    if not public.cpf_is_owner() then
      raise exception 'Only the owner can change an owner''s role';
    end if;
    if (select count(*) from public.profiles where role = 'owner') <= 1 then
      raise exception 'The site must always have one owner';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists cpf_role_guard on public.profiles;
create trigger cpf_role_guard
  before update on public.profiles
  for each row execute function public.cpf_guard_roles();


-- ========== 4. CONTENT RULES NOW FOLLOW ROLES ==========
-- viewer  = can sign in and look, cannot change anything
-- editor  = can add and edit content
-- admin   = editor + can manage team access
-- owner   = full control
do $$
declare t text;
begin
  foreach t in array array['pages','programs','events','team','settings'] loop
    execute format('drop policy if exists "admin all %I" on public.%I', t, t);

    execute format('drop policy if exists "team reads %I" on public.%I', t, t);
    execute format('create policy "team reads %I" on public.%I
                    for select to authenticated using (true)', t, t);

    execute format('drop policy if exists "editors add %I" on public.%I', t, t);
    execute format('create policy "editors add %I" on public.%I
                    for insert to authenticated with check (public.cpf_can_edit())', t, t);

    execute format('drop policy if exists "editors change %I" on public.%I', t, t);
    execute format('create policy "editors change %I" on public.%I
                    for update to authenticated
                    using (public.cpf_can_edit()) with check (public.cpf_can_edit())', t, t);

    execute format('drop policy if exists "editors remove %I" on public.%I', t, t);
    execute format('create policy "editors remove %I" on public.%I
                    for delete to authenticated using (public.cpf_can_edit())', t, t);
  end loop;
end $$;

-- Photo uploads follow the same rule
drop policy if exists "admin upload images" on storage.objects;
create policy "admin upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-images' and public.cpf_can_edit());

drop policy if exists "admin replace images" on storage.objects;
create policy "admin replace images" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-images' and public.cpf_can_edit());

drop policy if exists "admin remove images" on storage.objects;
create policy "admin remove images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-images' and public.cpf_can_edit());


-- ========== 5. EDITABLE SITE IMAGES ==========
insert into public.settings (key, value_en, value_fr) values
  ('imgHero',      'assets/images/hero-community.jpg',    'assets/images/hero-community.jpg'),
  ('imgLogo',      'assets/images/logo-clean.jpg',        'assets/images/logo-clean.jpg'),
  ('imgAbout',     'assets/images/hero-community.jpg',    'assets/images/hero-community.jpg'),
  ('imgActionPlan','assets/images/action-plan.png',       'assets/images/action-plan.png'),
  ('imgImpact',    'assets/images/team-advocacy.jpg',     'assets/images/team-advocacy.jpg'),
  ('imgVolunteer', 'assets/images/volunteers-packing.jpg','assets/images/volunteers-packing.jpg')
on conflict (key) do nothing;
