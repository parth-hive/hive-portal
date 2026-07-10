-- The current lease's start date, replaced on every renewal.
--
-- tenancies.start_date is the move-in date and anchors ledger accrual — a
-- renewal must NOT move it, or months billed before the renewal would drop
-- out of the running balance. The profile's "Lease Start Date" shows
-- lease_start_date when set (a renewal has been recorded), falling back to
-- start_date for tenancies still on their original lease.
alter table tenancies add column lease_start_date date;
