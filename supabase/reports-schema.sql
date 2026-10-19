-- MediCore: tablas complementarias para reportes y recomendaciones.
-- Ejecutar en el SQL Editor del proyecto Supabase correcto después de verificar el proyecto.
create table if not exists public.patients (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 full_name text not null check (char_length(trim(full_name)) between 1 and 120),
 birth_date date,
 sex text check (sex in ('female','male','other','unspecified')),
 height_m numeric(4,2) check (height_m > 0 and height_m < 3),
 weight_kg numeric(5,2) check (weight_kg > 0 and weight_kg < 700),
 bmi numeric(5,2) generated always as (case when height_m > 0 then round((weight_kg / (height_m * height_m))::numeric, 2) else null end) stored,
 created_at timestamptz not null default now()
);
create table if not exists public.medical_records (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 patient_id uuid not null references public.patients(id) on delete cascade,
 summary text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.nutrition_plans (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 patient_id uuid not null references public.patients(id) on delete cascade,
 title text not null default 'Plan nutricional',
 status text not null default 'pending' check (status in ('pending','authorized','denied')),
 created_at timestamptz not null default now()
);
create table if not exists public.diseases (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 120),
 category text not null default 'General',
 description text not null default '',
 recommendations text not null default '',
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
create index if not exists patients_owner_created_idx on public.patients(owner_id,created_at desc);
create index if not exists records_owner_patient_idx on public.medical_records(owner_id,patient_id);
create index if not exists plans_owner_status_idx on public.nutrition_plans(owner_id,status);
create index if not exists diseases_owner_name_idx on public.diseases(owner_id,name);
alter table public.patients enable row level security;
alter table public.medical_records enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.diseases enable row level security;
alter table public.patient_diseases enable row level security;
do $$ declare t text; begin
 foreach t in array array['patients','medical_records','nutrition_plans','diseases','patient_diseases'] loop
  execute format('drop policy if exists %I on public.%I',t||'_owner_all',t);
  execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',t||'_owner_all',t);
  execute format('grant select, insert, update, delete on public.%I to authenticated',t);
 end loop;
end $$;
