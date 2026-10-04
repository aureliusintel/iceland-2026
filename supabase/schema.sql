-- Iceland Fall 2026 trip app. Paste into Supabase → SQL Editor → Run.
-- All access goes through the Vercel API with the service-role key, so every
-- table has Row Level Security ON and no policies: the public anon key can't read anything.

create table if not exists travelers (
  id   text primary key,
  sort int  not null default 99,
  data jsonb not null default '{}'::jsonb
);

create table if not exists picks (
  id         text primary key,          -- day_slot_traveler
  day        text not null,
  slot       text not null,
  traveler   text not null references travelers(id) on delete cascade,
  option     text not null,
  updated_at timestamptz not null default now()
);

create table if not exists weather (
  id            text primary key,       -- always 'current'
  data          jsonb not null default '{}'::jsonb,
  fetched_at    timestamptz,
  refreshing_at timestamptz
);

alter table travelers enable row level security;
alter table picks     enable row level security;
alter table weather   enable row level security;

insert into travelers (id, sort, data) values
 ('bob', 1, '{"name":"Bob","age":"","color":"--bob","interests":["horses","hotsprings","hiking","waterfalls","nightlife","animals"],"arriveDate":"2026-10-07","arriveTime":"06:30","arriveAt":"KEF","departDate":"2026-10-13","departTime":"12:00","departAt":"KEF"}'),
 ('amanda', 2, '{"name":"Amanda","age":"48","color":"--amanda","interests":["nature","animals","horses","hiking","hotsprings","nightlife","dining","aurora","stays","coffee","shopping"],"arriveDate":"2026-10-07","arriveTime":"06:30","arriveAt":"KEF","departDate":"2026-10-13","departTime":"12:00","departAt":"KEF"}'),
 ('eva', 3, '{"name":"Eva","age":"21","color":"--eva","interests":["hiking","horses","sights","animals","nightlife","hotsprings","aurora","shopping","dining"],"arriveDate":"2026-10-09","arriveTime":"09:30","arriveAt":"KEF","departDate":"2026-10-13","departTime":"12:00","departAt":"KEF"}')
on conflict (id) do nothing;
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
