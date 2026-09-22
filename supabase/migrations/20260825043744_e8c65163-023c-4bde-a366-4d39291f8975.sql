create extension if not exists pgcrypto;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  avatar_url text,
  pin_hash text not null,
  created_at timestamptz not null default now()
);
grant all on public.members to service_role;
alter table public.members enable row level security;

create table public.daily_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  date date not null,
  pushups integer not null default 0 check (pushups >= 0),
  situps integer not null default 0 check (situps >= 0),
  squats integer not null default 0 check (squats >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, date)
);
grant all on public.daily_records to service_role;
alter table public.daily_records enable row level security;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_records_updated_at
before update on public.daily_records
for each row execute function public.set_updated_at();