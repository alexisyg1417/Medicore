-- MediCore: esquema completo de datos y seguridad para Supabase.
-- Ejecuta TODO este archivo en SQL Editor del proyecto Supabase que utilizará MediCore.
-- Incluye tablas privadas por usuario y una agenda pública SOLO para datos ficticios.

create extension if not exists pgcrypto;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_name text not null check (char_length(trim(patient_name)) between 1 and 70),
  specialty text not null default 'Medicina general' check (char_length(trim(specialty)) between 1 and 100),
  appointment_date date not null,
  appointment_time time not null,
  note text not null default '' check (char_length(note) <= 180),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text not null default '' check (char_length(message) <= 1000),
  type text not null default 'info' check (type in ('appointment','reminder','info')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  birth_date date,
  sex text check (sex in ('female','male','other','unspecified')),
  height_m numeric(4,2) check (height_m > 0 and height_m < 3),
  weight_kg numeric(5,2) check (weight_kg > 0 and weight_kg < 700),
  bmi numeric(5,2) generated always as (
    case when height_m > 0 and weight_kg > 0 then round((weight_kg / (height_m * height_m))::numeric, 2) else null end
  ) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  summary text not null default '' check (char_length(summary) <= 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null default 'Plan nutricional' check (char_length(trim(title)) between 1 and 160),
  status text not null default 'pending' check (status in ('pending','authorized','denied')),
  created_at timestamptz not null default now()
);

create table if not exists public.diseases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null default 'General' check (char_length(category) <= 80),
  description text not null default '' check (char_length(description) <= 1000),
  recommendations text not null default '' check (char_length(recommendations) <= 1500),
  created_at timestamptz not null default now()
);

create table if not exists public.patient_diseases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  disease_id uuid not null references public.diseases(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(patient_id,disease_id)
);

-- Agenda pública separada: ÚNICAMENTE para la demo con datos ficticios.
create table if not exists public.demo_appointments (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null check (char_length(trim(patient_name)) between 1 and 50),
  specialty text not null default 'Consulta general',
  appointment_date date not null,
  appointment_time time not null,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists appointments_owner_date_idx on public.appointments(owner_id, appointment_date, appointment_time);
create index if not exists notifications_owner_created_idx on public.notifications(owner_id, created_at desc);
create index if not exists patients_owner_created_idx on public.patients(owner_id, created_at desc);
create index if not exists records_owner_patient_idx on public.medical_records(owner_id, patient_id);
create index if not exists plans_owner_status_idx on public.nutrition_plans(owner_id, status);
create index if not exists diseases_owner_name_idx on public.diseases(owner_id, name);

alter table public.appointments enable row level security;
alter table public.notifications enable row level security;
alter table public.patients enable row level security;
alter table public.medical_records enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.diseases enable row level security;
alter table public.patient_diseases enable row level security;
alter table public.demo_appointments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['appointments','notifications','patients','medical_records','nutrition_plans','diseases','patient_diseases'] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t || '_owner_all', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists demo_appointments_public_select on public.demo_appointments;
drop policy if exists demo_appointments_public_insert on public.demo_appointments;
drop policy if exists demo_appointments_public_delete on public.demo_appointments;
create policy demo_appointments_public_select on public.demo_appointments for select to anon, authenticated using (true);
create policy demo_appointments_public_insert on public.demo_appointments for insert to anon, authenticated with check (true);
create policy demo_appointments_public_delete on public.demo_appointments for delete to anon, authenticated using (true);
grant select, insert, delete on public.demo_appointments to anon, authenticated;

-- Las claves públicas del frontend NO deben ser secret/service_role.
-- Las tablas privadas solo son accesibles por el usuario autenticado propietario.
