-- Run once in Supabase → SQL Editor. Stores options created from new Instagram saves.
create table if not exists custom_options (
  id         text primary key,          -- ig-<post code>-<n>
  day        text not null,
  slot       text not null,
  source_url text,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists ig_seen (
  url     text primary key,              -- Instagram post already checked
  seen_at timestamptz not null default now()
);
alter table custom_options enable row level security;
alter table ig_seen        enable row level security;
