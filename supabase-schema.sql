-- Run in the Supabase SQL editor. All customer tables are private and never exposed to anonymous clients.
create table if not exists public.orders (
 id text primary key, created_at timestamptz not null default now(),
 customer_name text not null, phone text not null, whatsapp text, email text,
 customer_type text, company text, delivery_type text, address text, city text,
 location_note text, desired_date text, notes text, items_json jsonb not null,
 total_ghs integer not null check(total_ghs>=0), payment_method text not null,
 payment_status text not null default 'pending', order_status text not null default 'new'
);
create table if not exists public.reservations (
 id text primary key, created_at timestamptz not null default now(), full_name text not null,
 phone text not null, whatsapp text, email text, organization text, event_type text not null,
 event_date text not null, guest_count integer not null check(guest_count>0),
 venue_address text, city text, notes text, status text not null default 'new'
);
create table if not exists public.contacts (
 id text primary key, created_at timestamptz not null default now(), full_name text not null,
 phone text, whatsapp text, email text, organization text, location text,
 message text not null, status text not null default 'new'
);
alter table public.orders enable row level security;
alter table public.reservations enable row level security;
alter table public.contacts enable row level security;
-- No public/anon policies. Server functions use service_role key, which must never be exposed to browser.
