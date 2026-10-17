-- Schema-only multi-major curriculum registry. No curriculum rows are seeded
-- here. The backend remains the sole access boundary and resolves membership
-- through plan_key, never plan_number alone.

create table public.curriculum_faculties (
  faculty_code text primary key check (btrim(faculty_code) <> ''),
  name_ar text not null check (btrim(name_ar) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.curriculum_majors (
  major_code text primary key check (btrim(major_code) <> ''),
  faculty_code text not null references public.curriculum_faculties(faculty_code) on delete restrict,
  name_ar text not null check (btrim(name_ar) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (faculty_code, major_code)
);

create table public.curriculum_plans (
  plan_key text primary key check (btrim(plan_key) <> ''),
  major_code text not null references public.curriculum_majors(major_code) on delete restrict,
  plan_number text not null check (btrim(plan_number) <> ''),
  total_required_credits numeric(6,2) not null check (total_required_credits >= 0),
  active boolean not null default true,
  source_status text not null default 'user_supplied_unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (major_code, plan_number)
);

create table public.curriculum_requirement_groups (
  plan_key text not null references public.curriculum_plans(plan_key) on delete cascade,
  group_code text not null check (btrim(group_code) <> ''),
  name_ar text not null check (btrim(name_ar) <> ''),
  scope text not null check (btrim(scope) <> ''),
  requirement_type text not null check (requirement_type in ('required', 'elective')),
  required_credit_hours numeric(6,2) not null check (required_credit_hours >= 0),
  display_order integer not null,
  primary key (plan_key, group_code)
);

create table public.curriculum_plan_courses (
  plan_key text not null references public.curriculum_plans(plan_key) on delete cascade,
  course_code text not null check (btrim(course_code) <> ''),
  name_ar text not null check (btrim(name_ar) <> ''),
  credit_hours numeric(6,2) not null check (credit_hours >= 0),
  group_code text not null,
  learning_type text,
  delivery_mode text,
  raw_prerequisite_text text,
  prerequisite_codes jsonb not null default '[]'::jsonb check (jsonb_typeof(prerequisite_codes) = 'array'),
  prerequisite_logic_status text not null
    check (prerequisite_logic_status in ('not_applicable', 'verified', 'unresolved')),
  review_required boolean not null default false,
  review_reason text,
  display_order integer not null,
  primary key (plan_key, course_code),
  foreign key (plan_key, group_code)
    references public.curriculum_requirement_groups(plan_key, group_code) on delete restrict
);

create index curriculum_plan_courses_course_code_idx
  on public.curriculum_plan_courses (course_code);

alter table public.curriculum_faculties enable row level security;
alter table public.curriculum_majors enable row level security;
alter table public.curriculum_plans enable row level security;
alter table public.curriculum_requirement_groups enable row level security;
alter table public.curriculum_plan_courses enable row level security;

revoke all privileges on table public.curriculum_faculties from anon, authenticated;
revoke all privileges on table public.curriculum_majors from anon, authenticated;
revoke all privileges on table public.curriculum_plans from anon, authenticated;
revoke all privileges on table public.curriculum_requirement_groups from anon, authenticated;
revoke all privileges on table public.curriculum_plan_courses from anon, authenticated;

grant select, insert, update, delete on table public.curriculum_faculties to service_role;
grant select, insert, update, delete on table public.curriculum_majors to service_role;
grant select, insert, update, delete on table public.curriculum_plans to service_role;
grant select, insert, update, delete on table public.curriculum_requirement_groups to service_role;
grant select, insert, update, delete on table public.curriculum_plan_courses to service_role;
