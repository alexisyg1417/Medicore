-- MediCore · esquema inicial para Supabase/PostgreSQL
-- Ejecuta este archivo en el SQL Editor del proyecto Supabase de MediCore.
-- Diseñado para Auth + Row Level Security; no habilita acceso anónimo a datos clínicos.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'patient'
    check (role in ('patient', 'doctor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_name text not null check (char_length(trim(patient_name)) between 1 and 120),
  specialty text not null default 'Medicina general' check (char_length(specialty) <= 100),
  appointment_date date not null,
  appointment_time time not null,
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  message text not null default '' check (char_length(message) <= 1000),
  type text not null default 'info' check (type in ('info', 'appointment', 'reminder', 'warning')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists appointments_owner_date_idx
  on public.appointments (owner_id, appointment_date, appointment_time);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;

-- Profiles: each user can read their own profile and update only their display name.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Appointments: each signed-in user manages only appointments they own.
drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own" on public.appointments
  for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own" on public.appointments
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "appointments_delete_own" on public.appointments;
create policy "appointments_delete_own" on public.appointments
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Notifications: users can read and manage only their own notifications.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Least-privilege grants for the Data API. Role is intentionally not client-updatable.
grant select on public.profiles to authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

-- Create a basic profile automatically on signup.
create or replace function public.handle_new_medicore_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_medicore_auth_user_created on auth.users;
create trigger on_medicore_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_medicore_user();

comment on table public.profiles is 'Perfil básico y rol de MediCore; el rol no se puede cambiar desde el cliente.';
comment on table public.appointments is 'Citas propiedad de la cuenta autenticada; no almacenar diagnósticos ni notas clínicas sensibles aquí.';
comment on table public.notifications is 'Notificaciones por usuario de MediCore.';

-- The trigger invokes this function internally; clients must not call it directly.
revoke all on function public.handle_new_medicore_user() from public, anon, authenticated;
