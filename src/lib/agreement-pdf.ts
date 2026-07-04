/**
 * Hive sublease agreement PDF builder, ported in-house from the
 * agreement-gen project (github.com/parth-hive/agreement-gen) so the portal
 * no longer depends on the agreements.hiveny.com edge function.
 *
 * Pure jsPDF — no filesystem, DOM, or network access — so the same module
 * runs on the server (email attachments via `@/lib/agreements`) and in the
 * browser (direct downloads on /agreements).
 */

import { jsPDF } from "jspdf";
import { HIVE_LOGO_DATA_URL, HIVE_LOGO_ASPECT } from "./agreement-logo";

export type AgreementPdfData = {
  tenantName: string;
  sublessorName: string;
  propertyAddress: string;
  rent: string;
  securityDeposit: string;
  /** "YYYY-MM-DD" */
  leaseStartDate: string;
  /** "YYYY-MM-DD" */
  leaseEndDate: string;
  /** "YYYY-MM-DD" */
  agreementDate: string;
  /** New York units go out without letterhead. */
  includeLetterhead: boolean;
  proRateRent?: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Date-only strings are formatted from their Y/M/D parts directly. Going
// through `new Date("YYYY-MM-DD")` parses as UTC midnight, and this server is
// pinned to America/New_York (src/instrumentation.ts) — every lease date
// would render one day early.
function parseParts(dateStr: string): { y: number; m: number; d: number } {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`Invalid agreement date "${dateStr}" — expected YYYY-MM-DD.`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** "2026-07-01" → "July 1, 2026" */
function formatDate(dateStr: string): string {
  const { y, m, d } = parseParts(dateStr);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-07-01" → "07/01/26" */
function formatShortDate(dateStr: string): string {
  const { y, m, d } = parseParts(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(m)}/${pad(d)}/${pad(y % 100)}`;
}

/** Write text, bolding any word belonging to a highlighted name/address. */
function writeWithBold(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  boldPhrases: string[],
  fontSize = 10,
): number {
  pdf.setFontSize(fontSize);
  const lines = pdf.splitTextToSize(text, maxWidth) as string[];
  const lineHeight = 4.2;
  const boldParts = boldPhrases.flatMap((p) =>
    p.split(" ").filter((part) => part.length > 2),
  );

  for (const line of lines) {
    let currentX = x;
    const words = line.split(" ");
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const isLastWord = i === words.length - 1;
      const bold = boldParts.some((part) => word.includes(part));
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.text(word + (isLastWord ? "" : " "), currentX, y);
      currentX += pdf.getTextWidth(word + " ");
    }
    y += lineHeight;
  }

  pdf.setFont("helvetica", "normal");
  return y;
}

export function agreementFilename(tenantName: string): string {
  return `${tenantName} Agreement.pdf`;
}

/** Build the agreement document. Callers pick the output format they need. */
export function buildAgreementPdf(data: AgreementPdfData): jsPDF {
  const pdf = new jsPDF("p", "mm", "letter");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 18;

  // Tighter spacing when letterhead is present so everything stays on one page.
  const hasLetterhead = data.includeLetterhead;
  const clauseSpacing = hasLetterhead ? 1.8 : 2.5;
  const sectionSpacing = hasLetterhead ? 5 : 8;

  if (hasLetterhead) {
    const logoWidth = 48;
    const logoHeight = logoWidth * HIVE_LOGO_ASPECT;
    // "SLOW" = maximum flate compression on the decoded RGBA image — without
    // it jsPDF embeds the logo raw and the PDF balloons to ~2 MB.
    pdf.addImage(
      HIVE_LOGO_DATA_URL,
      "PNG",
      margin,
      yPos,
      logoWidth,
      logoHeight,
      undefined,
      "SLOW",
    );

    // Contact details on top right
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const rightX = pageWidth - margin;
    let contactY = yPos + 6;
    pdf.text("917-622-9847", rightX, contactY, { align: "right" });
    contactY += 4;
    pdf.text("Vineet.Dutta@HiveNY.com", rightX, contactY, { align: "right" });
    contactY += 4;
    pdf.text("442 5th Avenue Suite #2478", rightX, contactY, { align: "right" });
    contactY += 4;
    pdf.text("New York, NY 10018", rightX, contactY, { align: "right" });

    yPos += logoHeight + 1;

    // Yellow divider line
    pdf.setDrawColor(255, 204, 0);
    pdf.setLineWidth(0.7);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
  }

  // Introduction paragraph with bold names and address
  const intro = `This agreement is made between ${data.tenantName} and ${data.sublessorName} for the period beginning ${formatDate(data.leaseStartDate)}, and ending ${formatDate(data.leaseEndDate)}, and will convert to a month-to-month at ${data.propertyAddress}.`;
  yPos = writeWithBold(pdf, intro, margin, yPos, contentWidth, [
    data.tenantName,
    data.sublessorName,
    data.propertyAddress,
  ]);
  yPos += 4;

  // Rent, optional prorated rent, security deposit
  pdf.setFontSize(10);
  pdf.text(`1. Rent: $${data.rent}`, margin + 4, yPos);
  yPos += hasLetterhead ? 4 : 5;
  let clauseNumber = 2;
  if (data.proRateRent && data.proRateRent.trim() !== "") {
    pdf.text(`${clauseNumber}. Prorated Rent: $${data.proRateRent}`, margin + 4, yPos);
    yPos += hasLetterhead ? 4 : 5;
    clauseNumber++;
  }
  pdf.text(`${clauseNumber}. Security Deposit: $${data.securityDeposit}`, margin + 4, yPos);
  yPos += sectionSpacing + (hasLetterhead ? 4 : 0);

  pdf.text("The parties agree:", margin, yPos);
  yPos += hasLetterhead ? 9 : 11;

  const names = [data.tenantName, data.sublessorName];

  const clauses = [
    `If the monthly electric bill exceeds $200, the amount over $200 will be divided equally among the number of occupants residing in unit. ${data.tenantName} will be responsible for his/her share of the excess charge.`,
    `Rent will be paid on the first of the month, if payment is not received by the 3rd of the month a $50 late fee will be applied.`,
    `Both ${data.sublessorName} and ${data.tenantName} will be required to give a 30-day notice period in the event parties want to terminate the agreement earlier.`,
  ];

  const subClauses = [
    `${data.tenantName} must provide 30 days' notice before the end date of the agreement if he/she decides to vacate by the end of the agreement.`,
    `If a 30-day notice is not given security deposit will be forfeited by ${data.tenantName}.`,
    `${data.tenantName} will be charged for a full month's rent in the event the move takes place in the middle of the month.`,
  ];

  const remainingClauses = [
    `Security deposit will be returned within 21 days of moving out.`,
    `Smoking is strictly prohibited within the apartment and building. If you are found smoking in the apartment, a $1,000 fine will be issued.`,
    `${data.tenantName} agrees to adhere to cleanliness standards or additional incurred charges for maid services will be required.`,
    `${data.tenantName} shall pay for all property damage he/she is responsible for in the event something happens during sublease.`,
    `A move out cleaning fee of $100 will be applied.`,
    `A joint inspection of the premises shall be conducted by ${data.sublessorName} and ${data.tenantName} recording any damage or deficiencies that exist as the start of the sublease period.`,
    `${data.tenantName} shall be liable for the cost of any cleaning or repair to correct damages caused by ${data.tenantName} at the end of the period if not recorded at the start of the agreement, normal wear and tears excepted. Security deposit will be refunded after vacating the apartment given there is no damage (except normal wear and tear) found prior to vacating.`,
    `${data.tenantName} must reimburse ${data.sublessorName} for the following fee and expenses incurred by ${data.sublessorName.split(" ")[0]}: Any legal fees and disbursements for the preparation and service of legal notices; legal actions or proceedings brought by ${data.sublessorName} against ${data.tenantName} because of a default by ${data.tenantName} under this agreement; or for defending lawsuits brought against ${data.sublessorName} because of the actions of ${data.tenantName}, or any associates of ${data.tenantName}.`,
  ];

  for (let i = 0; i < clauses.length; i++) {
    yPos = writeWithBold(pdf, `${1 + i}. ${clauses[i]}`, margin + 4, yPos, contentWidth - 8, names);
    yPos += clauseSpacing;
    if (i === 2) {
      for (let j = 0; j < subClauses.length; j++) {
        yPos = writeWithBold(
          pdf,
          `${String.fromCharCode(97 + j)}. ${subClauses[j]}`,
          margin + 12,
          yPos,
          contentWidth - 16,
          names,
        );
        yPos += hasLetterhead ? 1 : 1.5;
      }
    }
  }

  for (let i = 0; i < remainingClauses.length; i++) {
    yPos = writeWithBold(pdf, `${4 + i}. ${remainingClauses[i]}`, margin + 4, yPos, contentWidth - 8, names);
    yPos += clauseSpacing;
  }

  // Signature section
  yPos += hasLetterhead ? 3 : 5;
  pdf.setFontSize(10);

  pdf.setFont("helvetica", "normal");
  pdf.text("Sublessor: ", margin, yPos);
  pdf.setFont("helvetica", "bold");
  pdf.text(data.sublessorName, margin + pdf.getTextWidth("Sublessor: "), yPos);
  pdf.setFont("helvetica", "normal");
  pdf.text("Date", pageWidth - margin - 25, yPos);
  yPos += 7;
  pdf.text(`${data.sublessorName} ______________`, margin, yPos);
  pdf.text(`________${formatShortDate(data.agreementDate)}___________`, pageWidth - margin - 50, yPos);
  yPos += 10;

  pdf.text("Sublessee: ", margin, yPos);
  pdf.setFont("helvetica", "bold");
  pdf.text(data.tenantName, margin + pdf.getTextWidth("Sublessee: "), yPos);
  pdf.setFont("helvetica", "normal");
  pdf.text("Date", pageWidth - margin - 25, yPos);
  yPos += 7;
  pdf.text("__________________________", margin, yPos);
  pdf.text("________________________", pageWidth - margin - 50, yPos);

  return pdf;
}
