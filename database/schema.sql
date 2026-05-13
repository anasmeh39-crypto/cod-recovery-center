create extension if not exists "pgcrypto";

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null default 'recovery',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  sendit_order_id text unique not null,
  order_reference text,
  customer_name text,
  phone text,
  city text,
  address text,
  product_name text,
  amount numeric,
  current_status text,
  previous_status text,
  status_category text,
  is_problematic boolean default false,
  is_recovered boolean default false,
  assigned_employee_id uuid references employees(id) on delete set null,
  followup_attempts integer default 0,
  last_status_update timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  old_status text,
  new_status text,
  source text,
  raw_payload jsonb,
  created_at timestamptz default now()
);

create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  action_type text,
  note text,
  customer_response text,
  next_action text,
  created_at timestamptz default now()
);

create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  amount numeric default 15,
  reason text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  status text,
  language text,
  title text,
  message text,
  active boolean default true
);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text,
  event_type text,
  raw_payload jsonb,
  processed boolean default false,
  error_message text,
  created_at timestamptz default now()
);

create unique index if not exists commissions_one_per_order_idx on commissions(order_id);
create unique index if not exists message_templates_unique_seed_idx on message_templates(status, language, title);
create index if not exists orders_problematic_idx on orders(is_problematic, is_recovered, current_status);
create index if not exists orders_search_idx on orders(sendit_order_id, order_reference, phone);
create index if not exists order_status_history_order_idx on order_status_history(order_id, created_at desc);
create index if not exists followups_order_idx on followups(order_id, created_at desc);
create index if not exists commissions_employee_idx on commissions(employee_id, status);
create index if not exists message_templates_status_language_idx on message_templates(status, language, active);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
before update on orders
for each row execute function set_updated_at();

alter table employees enable row level security;
alter table orders enable row level security;
alter table order_status_history enable row level security;
alter table followups enable row level security;
alter table commissions enable row level security;
alter table message_templates enable row level security;
alter table webhook_events enable row level security;

-- Explicit Data API grants for Supabase's May/October 2026 permission changes.
-- The app reads and writes business data only through the backend service role.
grant usage on schema public to service_role;

grant select, insert, update, delete on table
  employees,
  orders,
  order_status_history,
  followups,
  commissions,
  message_templates,
  webhook_events
to service_role;

grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
grant usage, select on sequences to service_role;

-- Backend uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS policies.
-- Do not grant anon table access unless the frontend starts reading tables
-- directly with supabase-js. Keep customer/order data behind the Express API.
