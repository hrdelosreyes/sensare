-- Accounts for the partner portal and admin (replaces Supabase Auth).

create table if not exists sensare_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  password_changed_at timestamptz not null default now()
);
create unique index if not exists sensare_users_email_idx on sensare_users (lower(email));

-- Session cookies hold a random token; only its SHA-256 is stored.
create table if not exists sensare_sessions (
  token_hash text primary key,
  user_id uuid not null references sensare_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text
);
create index if not exists sensare_sessions_user_idx on sensare_sessions(user_id);

create table if not exists sensare_password_resets (
  token_hash text primary key,
  user_id uuid not null references sensare_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Failed sign-ins, for throttling password guessing.
create table if not exists sensare_login_failures (
  id bigserial primary key,
  email text not null,
  created_at timestamptz not null default now()
);
create index if not exists sensare_login_failures_idx on sensare_login_failures (lower(email), created_at);

create table if not exists sensare_admins (
  user_id uuid primary key references sensare_users(id) on delete cascade,
  email text not null,
  name text,
  created_by uuid references sensare_users(id) on delete set null,
  created_at timestamptz not null default now()
);
