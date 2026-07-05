-- Operator can dismiss a bill's over-$200 flag from the banner; the badge on
-- the bill card itself stays. Dismissals persist per bill.
alter table public.utility_bills
  add column if not exists overage_dismissed boolean not null default false;
