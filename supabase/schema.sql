-- QA Test Management V1
-- Run this in Supabase SQL Editor.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  case_key text not null,
  title text not null,
  test_type text not null default 'Sanity' check (test_type in ('Smoke','Sanity','Regression','LQA')),
  module text not null default 'General',
  priority text not null default 'Medium' check (priority in ('Critical','High','Medium','Low')),
  precondition text default '',
  expected_result text not null default '',
  steps jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, case_key)
);

create table if not exists test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  build text not null default '',
  environment text not null default 'Live',
  created_at timestamptz not null default now()
);

create table if not exists test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references test_runs(id) on delete cascade,
  test_case_id uuid not null references test_cases(id) on delete cascade,
  status text not null default 'NOT RUN' check (status in ('PASS','FAIL','BLOCKED','NOT RUN')),
  actual_result text default '',
  tester text default '',
  executed_at timestamptz,
  bug_id text default '',
  created_at timestamptz not null default now(),
  unique(run_id, test_case_id)
);

alter table projects enable row level security;
alter table test_cases enable row level security;
alter table test_runs enable row level security;
alter table test_results enable row level security;

-- V1 development policies: any authenticated user can read/write.
-- Tighten these later with team/role policies.
create policy "authenticated users projects" on projects for all to authenticated using (true) with check (true);
create policy "authenticated users test cases" on test_cases for all to authenticated using (true) with check (true);
create policy "authenticated users test runs" on test_runs for all to authenticated using (true) with check (true);
create policy "authenticated users test results" on test_results for all to authenticated using (true) with check (true);

insert into projects (name,key)
values ('Gods & Glory','GNG')
on conflict (key) do nothing;

insert into test_cases
(project_id,case_key,title,test_type,module,priority,precondition,expected_result,steps,tags)
select id,'SMK-001','Game launches successfully','Smoke','Core','Critical',
'Game is installed and available.',
'Game launches without crash and reaches the expected initial screen.',
'[{"action":"Launch the game"},{"action":"Wait for initial screen"}]'::jsonb,
array['smoke','core']
from projects where key='GNG'
on conflict (project_id,case_key) do nothing;

insert into test_cases
(project_id,case_key,title,test_type,module,priority,precondition,expected_result,steps,tags)
select id,'SMK-002','Main lobby loads','Smoke','Core','Critical',
'User has successfully launched the game.',
'Main lobby loads and core UI elements are visible.',
'[{"action":"Wait for lobby"},{"action":"Verify core UI"}]'::jsonb,
array['smoke','core']
from projects where key='GNG'
on conflict (project_id,case_key) do nothing;

insert into test_cases
(project_id,case_key,title,test_type,module,priority,precondition,expected_result,steps,tags)
select id,'SAN-001','Alliance Festival offer is displayed','Sanity','Alliance Festival','High',
'Alliance Festival is active.',
'Festival offer is displayed with the correct contents, price and localization.',
'[{"action":"Open Alliance Festival"},{"action":"Open Shop"},{"action":"Locate Festival Offer"},{"action":"Verify contents, price and text"}]'::jsonb,
array['sanity','live-ops','offer','fsta0826']
from projects where key='GNG'
on conflict (project_id,case_key) do nothing;

-- Optional storage bucket for screenshots/videos.
insert into storage.buckets (id,name,public)
values ('qa-attachments','qa-attachments',false)
on conflict (id) do nothing;