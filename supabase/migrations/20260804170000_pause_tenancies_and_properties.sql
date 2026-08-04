-- Pause switch: a paused tenancy accrues no new rent, is skipped by every
-- automated action (rent reminders, late fees, lease reminders) and excluded
-- from manual balance reminders. Pausing a property stamps all its current
-- tenancies (pause_source = 'property') so consumers only ever check
-- tenancies.paused_at; unpausing the property clears only property-stamped
-- pauses. properties.paused_at additionally removes the unit from cleaning.
alter table public.tenancies
  add column if not exists paused_at timestamptz,
  add column if not exists pause_source text
    check (pause_source in ('tenant', 'property'));

alter table public.properties
  add column if not exists paused_at timestamptz;
