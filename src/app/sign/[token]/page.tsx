import { notFound } from "next/navigation";
import { AGREEMENTS_BUCKET, agreementsAdmin } from "@/lib/agreement-send";
import { SignArea } from "./sign-form";

export const dynamic = "force-dynamic";
// Token in the URL is the only credential; keep these pages out of search.
// The description override matters: without it the root layout's
// "Hive co-living" description would leak onto the unbranded (NY) pages.
export const metadata = {
  title: "Sign your agreement",
  description: "Review and sign your agreement online.",
  robots: { index: false, follow: false },
};

type RequestRow = {
  id: string;
  status: "pending" | "signed" | "dismissed";
  tenant_name: string;
  include_letterhead: boolean;
  unsigned_pdf_path: string;
  expires_at: string;
};

function linkExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

function StatusCard({
  branded,
  title,
  children,
}: {
  branded: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        {branded && (
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent-text">
            Hive
          </p>
        )}
        <h1 className="text-xl font-medium text-ink">{title}</h1>
        <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
      </div>
    </main>
  );
}

type PageProps = { params: Promise<{ token: string }> };

export default async function SignAgreementPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = agreementsAdmin();

  const { data: request } = await supabase
    .from("agreement_requests")
    .select(
      "id, status, tenant_name, include_letterhead, unsigned_pdf_path, expires_at",
    )
    .eq("token", token)
    .maybeSingle<RequestRow>();
  // Dismissed requests behave like dead links — the deal is off.
  if (!request || request.status === "dismissed") notFound();

  // NY agreements stay fully unbranded on this page too.
  const branded = request.include_letterhead;

  if (request.status === "signed") {
    return (
      <StatusCard branded={branded} title="Already signed">
        This agreement has already been signed — a copy was emailed to you. If
        you can&rsquo;t find it, check your spam folder or reply to the original
        email.
      </StatusCard>
    );
  }

  if (linkExpired(request.expires_at)) {
    return (
      <StatusCard branded={branded} title="This link has expired">
        Signing links are valid for 48 hours. Reply to the email you received
        and a fresh link will be sent to you.
      </StatusCard>
    );
  }

  // 1-hour window to read and sign; the page can simply be reloaded if it
  // goes stale.
  const { data: signedUrl } = await supabase.storage
    .from(AGREEMENTS_BUCKET)
    .createSignedUrl(request.unsigned_pdf_path, 3600);

  return (
    <main className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="text-center">
          {branded && (
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent-text">
              Hive
            </p>
          )}
          <h1 className="text-3xl tracking-tight text-ink">
            {branded ? (
              <span className="font-display italic text-accent-text">
                Agreement
              </span>
            ) : (
              <>Agreement</>
            )}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Prepared for <strong className="text-ink">{request.tenant_name}</strong>{" "}
            · review the agreement below, then sign at the bottom.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              The agreement
            </h2>
            {signedUrl && (
              <a
                href={signedUrl.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-stone bg-white px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-ink transition hover:bg-warm"
              >
                Open PDF in a new tab
              </a>
            )}
          </div>
          {signedUrl ? (
            // Desktop browsers render the PDF inline; iOS Safari may not — the
            // new-tab button above (and the email attachment) covers that.
            // The fragment hides the viewer's toolbar/thumbnail pane and fits
            // the page to the frame width; the frame itself matches the letter
            // page's aspect ratio so the whole agreement is readable without
            // inner scrolling.
            <object
              data={`${signedUrl.signedUrl}#toolbar=0&navpanes=0&view=FitH`}
              type="application/pdf"
              className="mt-4 w-full rounded-xl border border-stone/60"
              style={{ aspectRatio: "8.5 / 11.4" }}
            >
              <div className="flex h-40 items-center justify-center rounded-xl bg-warm/60 p-6 text-center text-sm text-muted">
                Your browser can&rsquo;t display the PDF here — use &ldquo;Open
                PDF in a new tab&rdquo; above, or the copy attached to your
                email.
              </div>
            </object>
          ) : (
            <p className="mt-4 text-sm text-muted">
              The PDF preview is unavailable right now — the copy attached to
              your email is identical.
            </p>
          )}

          <SignArea
            token={token}
            tenantName={request.tenant_name}
            branded={branded}
          />
        </section>

        <p className="pb-6 text-center text-xs text-muted">
          Questions? Reply to the email this link arrived in.
        </p>
      </div>
    </main>
  );
}
