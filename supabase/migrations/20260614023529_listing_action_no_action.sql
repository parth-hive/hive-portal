-- Retire the "new_ad" listing action in favor of an explicit "no_action"
-- default. Fresh/vacant rooms now start with no action flagged rather than
-- being auto-marked as needing a new ad.
--
-- Postgres can't drop an enum value in place, so the type is recreated and
-- existing 'new_ad' rows are migrated to 'no_action'.

alter table rooms alter column listing_action drop default;

alter type listing_action rename to listing_action_old;

create type listing_action as enum (
  'no_action',
  'update_price_or_date',
  'delete_listing',
  'boost_post',
  'priority'
);

alter table rooms
  alter column listing_action type listing_action
  using (
    case listing_action::text
      when 'new_ad' then 'no_action'
      else listing_action::text
    end
  )::listing_action;

alter table rooms
  alter column listing_action set default 'no_action';

drop type listing_action_old;
