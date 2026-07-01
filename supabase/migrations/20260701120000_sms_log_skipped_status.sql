-- Allow a third SMS outcome: 'skipped'. Non-US/Canada (+1) numbers are never
-- texted (Zoom Phone SMS is US/Canada only); recording them as 'failed' made
-- intentional skips look like errors. Reclassify the existing ones too.

alter table sms_log drop constraint if exists sms_log_status_check;
alter table sms_log
  add constraint sms_log_status_check check (status in ('sent', 'failed', 'skipped'));

update sms_log
  set status = 'skipped'
  where status = 'failed'
    and error like 'Unusable phone number:%';
