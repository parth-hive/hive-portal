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

/** Generate the agreement PDF and return it as base64. Throws on API errors. */
export async function generateAgreementPdf(
  input: AgreementInput,
): Promise<GeneratedAgreement> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  return {
    filename: data.filename || "agreement.pdf",
    base64: data.base64,
  };
}
