/**
 * Client for the Hive agreement generator at agreements.hiveny.com.
 *
 * The public Supabase edge function takes the lease fields and returns a PDF.
 * We request `format: "base64"` so we get JSON back and can attach the PDF to
 * an email draft without juggling binary streams.
 *
 * Docs: https://agreements.hiveny.com/api-docs.html
 */

const ENDPOINT =
  "https://zjcmgbhxfewkbyocxodi.supabase.co/functions/v1/generate-agreement";

export type AgreementInput = {
  tenantName: string;
  sublessorName: string;
  propertyAddress: string;
  rent: string;
  securityDeposit: string;
  leaseStartDate: string; // "YYYY-MM-DD"
  leaseEndDate: string; // "YYYY-MM-DD"
  agreementDate: string; // "YYYY-MM-DD"
  /** New York units go out without letterhead → pass false. Defaults to true. */
  includeLetterhead?: boolean;
  proRateRent?: string;
};

export type GeneratedAgreement = {
  filename: string;
  base64: string;
};

// A real PDF starts with "%PDF-" — "JVBERi" once base64-encoded. Anything else
// (an HTML error page served as 200, a truncated payload) must never reach a
// tenant as their lease.
const PDF_BASE64_MAGIC = "JVBERi";
const MIN_PDF_BASE64_LENGTH = 1_000;

// The generator names the file; it's an external service, so strip anything
// that isn't filename-safe and force a .pdf extension before the name goes
// into a MIME attachment header.
function safePdfFilename(name: string): string {
  const cleaned = name.replace(/[^\w. -]+/g, "_").replace(/\.+$/, "").trim();
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned || "agreement"}.pdf`;
}

/** Generate the agreement PDF and return it as base64. Throws on API errors. */
export async function generateAgreementPdf(
  input: AgreementInput,
): Promise<GeneratedAgreement> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Shared secret the generator's edge function can enforce, so the
        // public endpoint (and its 10/min rate limit) isn't open to anyone.
        // Harmless until the function checks it — set AGREEMENT_API_KEY here
        // and in the generator project, then require it server-side.
        ...(process.env.AGREEMENT_API_KEY
          ? { "x-agreement-key": process.env.AGREEMENT_API_KEY }
          : {}),
      },
      // Bounded so a hung edge function fails fast instead of eating the
      // whole serverless time budget.
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        tenantName: input.tenantName,
        sublessorName: input.sublessorName,
        propertyAddress: input.propertyAddress,
        rent: input.rent,
        securityDeposit: input.securityDeposit,
        leaseStartDate: input.leaseStartDate,
        leaseEndDate: input.leaseEndDate,
        agreementDate: input.agreementDate,
        includeLetterhead: input.includeLetterhead ?? true,
        ...(input.proRateRent ? { proRateRent: input.proRateRent } : {}),
        format: "base64",
      }),
    });
  } catch (e) {
    throw new Error(
      `Agreement generator unreachable: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (res.status === 429) {
    throw new Error(
      "Agreement generator is rate-limited (10/min). Wait a minute and try again.",
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Agreement generator failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    filename?: string;
    base64?: string;
  };
  if (!data.base64) {
    throw new Error("Agreement generator returned no PDF data.");
  }
  if (
    !data.base64.startsWith(PDF_BASE64_MAGIC) ||
    data.base64.length < MIN_PDF_BASE64_LENGTH
  ) {
    throw new Error(
      "Agreement generator returned data that is not a valid PDF — not sending.",
    );
  }
  return {
    filename: safePdfFilename(data.filename || "agreement.pdf"),
    base64: data.base64,
  };
}
