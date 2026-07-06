-- Full audit coverage: every user-editable operational table gets the
-- generic audit_log_trigger (see 20260514081009_audit_log.sql), which
-- records each insert/update/delete with the acting user, before/after
-- snapshots, and the changed columns.
--
-- Deliberately skipped (they are logs/queues themselves, written by the
-- system rather than edited by users): audit_log, email_log, sms_log,
-- credential_access_log, telegram_activity_log, telegram_chat_messages,
-- telegram_updates, room_change_events, rent_reminder_batches,
-- rent_reminder_emails, posting_log, email_queue,
-- cleaner_schedule_change_queue.

-- Utilities
create trigger audit_utility_bills          after insert or update or delete on utility_bills          for each row execute function public.audit_log_trigger();
create trigger audit_utility_bill_charges   after insert or update or delete on utility_bill_charges   for each row execute function public.audit_log_trigger();
create trigger audit_utility_unit_hints     after insert or update or delete on utility_unit_hints     for each row execute function public.audit_log_trigger();
create trigger audit_utility_overage_alerts after insert or update or delete on utility_overage_alerts for each row execute function public.audit_log_trigger();

-- Rent ledger side-tables
create trigger audit_tenancy_charges        after insert or update or delete on tenancy_charges        for each row execute function public.audit_log_trigger();
create trigger audit_credit_allocations     after insert or update or delete on credit_allocations     for each row execute function public.audit_log_trigger();

-- Projects board
create trigger audit_board_tasks            after insert or update or delete on board_tasks            for each row execute function public.audit_log_trigger();
create trigger audit_board_comments         after insert or update or delete on board_comments         for each row execute function public.audit_log_trigger();
create trigger audit_board_prefs            after insert or update or delete on board_prefs            for each row execute function public.audit_log_trigger();

-- Inventory / marketing
create trigger audit_room_ads               after insert or update or delete on room_ads               for each row execute function public.audit_log_trigger();
create trigger audit_marketing_channels     after insert or update or delete on marketing_channels     for each row execute function public.audit_log_trigger();

-- Agreements
create trigger audit_agreement_addresses    after insert or update or delete on agreement_addresses    for each row execute function public.audit_log_trigger();

-- Reconciliation
create trigger audit_reconciliation_runs     after insert or update or delete on reconciliation_runs     for each row execute function public.audit_log_trigger();
create trigger audit_reconciliation_deposits after insert or update or delete on reconciliation_deposits for each row execute function public.audit_log_trigger();
create trigger audit_reconciliation_matches  after insert or update or delete on reconciliation_matches  for each row execute function public.audit_log_trigger();
