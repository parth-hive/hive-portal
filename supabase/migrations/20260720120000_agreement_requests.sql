-- Lease-signing requests: one row per agreement emailed out with a signing
-- link. The tally on /agreements is built from these. "expired" is derived
-- (status='pending' and expires_at < now()) so no cron is needed; a resend
-- rotates the token and pushes expires_at forward on the same row.
create table agreement_requests (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'signed', 'dismissed')),
  tenant_name text not null,
  recipient_email text not null,
  property_address text not null,
  property_id uuid references properties(id) on delete set null,
  -- false = New York: plain Gmail send and a fully unbranded signing page.
  include_letterhead boolean not null,
  channel text not null check (channel in ('gmail', 'outlook')),
  -- Full AgreementInput snapshot; the signed PDF is re-rendered from this at
  -- sign time so signature placement stays deterministic.
  input jsonb not null,
  unsigned_pdf_path text not null,      -- operator-signed, tenant-unsigned
  signed_pdf_path text,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  signed_at timestamptz,
  tenant_signature_kind text
    check (tenant_signature_kind in ('drawn', 'typed')),
  sign_ip text,
  dismissed_at timestamptz,
  assigned_tenancy_id uuid references tenancies(id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index agreement_requests_token_idx on agreement_requests (token);
create index agreement_requests_status_idx on agreement_requests (status, sent_at desc);

alter table agreement_requests enable row level security;

-- Single-operator model, same as the rest of the schema. No anon policies:
-- the public signing page goes through the service role only.
create policy "authenticated all agreement_requests"
  on agreement_requests
  for all
  to authenticated
  using (true)
  with check (true);

-- Private bucket for agreement artifacts: the operator signature PNG plus the
-- sent and signed PDFs per request. Paths: operator/signature.png,
-- requests/{id}/sent.pdf, requests/{id}/signed.pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agreements',
  'agreements',
  false,
  20971520,                          -- 20 MB
  array['application/pdf', 'image/png']
)
on conflict (id) do nothing;

drop policy if exists "authenticated read agreements" on storage.objects;
create policy "authenticated read agreements"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'agreements');

drop policy if exists "authenticated write agreements" on storage.objects;
create policy "authenticated write agreements"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'agreements');

drop policy if exists "authenticated update agreements" on storage.objects;
create policy "authenticated update agreements"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'agreements')
  with check (bucket_id = 'agreements');

drop policy if exists "authenticated delete agreements" on storage.objects;
create policy "authenticated delete agreements"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'agreements');
