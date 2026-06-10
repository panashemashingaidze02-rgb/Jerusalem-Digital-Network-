-- Jerusaremu Digital Network (JDN) - Supabase SQL Schema & RLS Policies
-- PostgreSQL Database Definition

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Define Levels Enum
create type jdn_level as enum (
  'System',
  'Jerusalem',
  'National',
  'Provincial',
  'District',
  'Nyika',
  'Tabhera',
  'Wellness Center'
);

-- Define Member Groups Enum
create type member_group as enum (
  'Sunday School',
  'Masowani',
  'Ruwadzano',
  'Sungano'
);

-- 1. Profiles Table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  full_name text not null,
  phone_number text not null unique,
  national_id text not null unique,
  level jdn_level not null,
  level_code text not null, -- The code of their specific unit (e.g., Code for "Harare South District")
  parent_code text, -- Code of the level above them
  role text not null, -- Title of the role (e.g., Tabhera Secretary)
  is_active boolean not null default true,
  forced_password_change boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deactivated_at timestamp with time zone,
  deactivated_by uuid references public.profiles(id)
);

-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- 2. Level Codes Table (For registration validation)
create table public.level_codes (
  code_id uuid default gen_random_uuid() primary key,
  code_value text not null unique,
  created_by uuid references public.profiles(id) not null,
  level_scope jdn_level not null, -- The level this code is representing
  branch_name text not null, -- Human name, e.g., "Harare Province" or "Highfield Tabhera"
  expiry_date timestamp with time zone not null,
  use_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Level Codes
alter table public.level_codes enable row level security;

-- 3. Code Usage Log Table
create table public.code_usage_log (
  log_id uuid default gen_random_uuid() primary key,
  code_id uuid references public.level_codes(code_id) on delete cascade not null,
  user_phone text not null,
  registered_user_id uuid references public.profiles(id) on delete set null,
  used_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Code Usage Log
alter table public.code_usage_log enable row level security;

-- 4. Members Table
create table public.members (
  member_id uuid default gen_random_uuid() primary key,
  full_name text not null,
  date_of_birth date not null,
  gender text not null check (gender in ('Male', 'Female', 'Other')),
  marital_status text not null,
  group_id member_group not null,
  join_date date not null,
  tabhera_code text not null, -- Must match user's tabhera level_code
  is_jorodhani boolean not null default true,
  jorodhani_date date,
  promotion_history jsonb not null default '[]'::jsonb, -- Array of {fromGroup, toGroup, date, promotedBy}
  created_by uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  former_owners jsonb not null default '[]'::jsonb -- Audit trail when reassigning data on deactivation
);

alter table public.members enable row level security;

-- 5. Murairo Types (Contributions Definition)
create table public.murairo_types (
  murairo_id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  currency text[] default array['USD', 'ZWG', 'ZAR'] not null,
  created_by_level jdn_level not null,
  created_by_code text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.murairo_types enable row level security;

-- 6. Contribution Logs
create table public.contributions (
  contribution_id uuid default gen_random_uuid() primary key,
  member_id uuid references public.members(member_id) on delete restrict not null,
  murairo_id uuid references public.murairo_types(murairo_id) on delete restrict not null,
  amount numeric(12, 2) not null,
  currency text not null check (currency in ('USD', 'ZWG', 'ZAR')),
  date date not null,
  logged_by uuid references public.profiles(id) not null,
  tabhera_code text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  former_owners jsonb not null default '[]'::jsonb
);

alter table public.contributions enable row level security;

-- 7. Attendance Sessions
create table public.attendance_sessions (
  session_id uuid default gen_random_uuid() primary key,
  tabhera_code text not null,
  date date not null,
  service_type text not null check (service_type in ('Sunday Service', 'Midweek', 'Special')),
  logged_by uuid references public.profiles(id) not null,
  is_correction boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  former_owners jsonb not null default '[]'::jsonb
);

alter table public.attendance_sessions enable row level security;

-- 8. Attendance Records
create table public.attendance_records (
  record_id uuid default gen_random_uuid() primary key,
  session_id uuid references public.attendance_sessions(session_id) on delete cascade not null,
  member_id uuid references public.members(member_id) on delete restrict not null,
  status text not null check (status in ('Present', 'Absent', 'Excused')),
  excuse_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.attendance_records enable row level security;


-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Helper function to check parent-child branch hierarchies based on code values
-- In standard Supabase, this checks user claims or a structured schema mapping.
-- Example policy helper function details:
-- Profiles can only access data if they correspond to the correct branch.

-- Profiles Policies
create policy "Allow System admin read/write all profiles" on public.profiles
  for all to authenticated
  using (
    (select level from public.profiles where id = auth.uid()) = 'System'
  );

create policy "Allow users to read their own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "Allow admins to read profiles under their hierarchy" on public.profiles
  for select to authenticated
  using (
    -- Checks if child user's parent_code matches current user's level_code
    parent_code = (select level_code from public.profiles where id = auth.uid())
    -- Or self-comparisons
    or level_code = (select level_code from public.profiles where id = auth.uid())
  );

-- Level Codes Policies
create policy "Allow read level codes for registration validation" on public.level_codes
  for select to public
  using (is_active = true and expiry_date > now());

create policy "Allow level admins to create/manage codes for child units" on public.level_codes
  for all to authenticated
  using (
    -- Admins can manage codes they created
    created_by = auth.uid()
    -- Or System Admins can manage any codes
    or (select level from public.profiles where id = auth.uid()) = 'System'
  );

-- Members Policies
create policy "Tabhera Secretary can manage tabhera members" on public.members
  for all to authenticated
  using (
    tabhera_code = (select level_code from public.profiles where id = auth.uid())
  );

create policy "Upper levels can read members in their branch" on public.members
  for select to authenticated
  using (
    -- If current user's level_code is Jerusalem/National/Provincial/District/Nyika,
    -- they can see members belonging to tabheras that are descendants.
    -- To model this in SQL simple version, the user's level_code matched parent_code or they have systemic access.
    (select level from public.profiles where id = auth.uid()) in ('System', 'Jerusalem')
    or tabhera_code like (select level_code from public.profiles where id = auth.uid()) || '%'
  );

-- Contributions (Murairo) Policies
create policy "Tabhera Secretary can insert contributions" on public.contributions
  for insert to authenticated
  with check (
    tabhera_code = (select level_code from public.profiles where id = auth.uid())
  );

create policy "Tabhera Secretary can read their own tabhera's contributions" on public.contributions
  for select to authenticated
  using (
    tabhera_code = (select level_code from public.profiles where id = auth.uid())
  );

create policy "District and above can read aggregate contributions in their branch" on public.contributions
  for select to authenticated
  using (
    -- Strict Privacy Rule: Upper levels can only read if Privacy setting allows,
    -- or they can only read summaries handled via stored procedures, but raw RLS grants read 
    -- based on descendant code mapping.
    (select level from public.profiles where id = auth.uid()) in ('System', 'Jerusalem', 'National', 'Provincial', 'District')
    and tabhera_code like (select level_code from public.profiles where id = auth.uid()) || '%'
  );

-- Attendance Policies
create policy "Tabhera Secretary can log attendance sessions" on public.attendance_sessions
  for all to authenticated
  using (
    tabhera_code = (select level_code from public.profiles where id = auth.uid())
  );

create policy "Upper levels can view attendance sessions in their branch" on public.attendance_sessions
  for select to authenticated
  using (
    tabhera_code like (select level_code from public.profiles where id = auth.uid()) || '%'
    or (select level from public.profiles where id = auth.uid()) in ('System', 'Jerusalem')
  );

create policy "Tabhera Secretary can manage attendance records" on public.attendance_records
  for all to authenticated
  using (
    exists (
      select 1 from public.attendance_sessions s
      where s.session_id = attendance_records.session_id
      and s.tabhera_code = (select level_code from public.profiles where id = auth.uid())
    )
  );

create policy "Upper levels can view attendance records in their branch" on public.attendance_records
  for select to authenticated
  using (
    exists (
      select 1 from public.attendance_sessions s
      where s.session_id = attendance_records.session_id
      and (
        s.tabhera_code like (select level_code from public.profiles where id = auth.uid()) || '%'
        or (select level from public.profiles where id = auth.uid()) in ('System', 'Jerusalem')
      )
    )
  );
