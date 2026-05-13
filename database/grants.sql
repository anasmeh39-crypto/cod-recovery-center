-- Run this once in Supabase SQL Editor for existing COD Recovery Center tables.
-- It makes table access explicit for Supabase Data API permission changes.
-- Safe for the current architecture: the frontend does not get direct table access.

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.employees,
  public.orders,
  public.order_status_history,
  public.followups,
  public.commissions,
  public.message_templates,
  public.webhook_events
to service_role;

grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
grant usage, select on sequences to service_role;
