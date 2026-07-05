// Hive letterhead lockup, drawn as vectors so it stays crisp at any size and
// adds nothing to the PDF weight. Geometry and styling mirror the hiveny.com
// nav logo: the gold hive glyph (inline SVG, viewBox 0 0 80 100) next to an
// uppercase letterspaced "HIVE" wordmark over the tagline.

import type { jsPDF } from "jspdf";

// Brand tokens from hiveny.com (light background variant).
const GOLD = [212, 146, 11] as const; // #d4920b honey gold
const INK = [26, 26, 24] as const; // #1a1a18
const MUTED = [138, 131, 120] as const; // #8a8378

// The icon's shapes, copied from the site SVG (fill-only, all gold).
const CIRCLES = [
  { cx: 40, cy: 8, r: 4.5 },
  { cx: 40, cy: 88, r: 4 },
];
const BARS = [
  { x: 28, y: 18, w: 24 },
  { x: 18, y: 32, w: 44 },
  { x: 15, y: 46, w: 50 },
  { x: 18, y: 60, w: 44 },
  { x: 28, y: 74, w: 24 },
]; // each 6 tall with fully rounded (rx 3) ends

/**
 * Draw the letterhead lockup with the icon's top-left corner at (x, y).
 * `iconHeight` is in document units (mm). Returns the lockup's footprint.
 * Leaves the PDF text color reset to black.
 */
export function drawHiveLetterhead(
  pdf: jsPDF,
  x: number,
  y: number,
  iconHeight: number,
): { width: number; height: number } {
  const s = iconHeight / 100; // SVG viewBox is 80 x 100
  pdf.setFillColor(...GOLD);
  for (const c of CIRCLES) {
    pdf.circle(x + c.cx * s, y + c.cy * s, c.r * s, "F");
  }
  for (const b of BARS) {
    pdf.roundedRect(x + b.x * s, y + b.y * s, b.w * s, 6 * s, 3 * s, 3 * s, "F");
  }

  // Text block, vertically centered against the icon like the site header.
  const textX = x + 80 * s + 3;
  const wordY = y + iconHeight * 0.48;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(...INK);
  pdf.text("HIVE", textX, wordY, { charSpace: 0.7 });

  const tagY = wordY + 3.6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.5);
  pdf.setTextColor(...MUTED);
  pdf.text("CITY LIVING, MADE SIMPLE", textX, tagY, { charSpace: 0.35 });

  pdf.setTextColor(0, 0, 0);
  const tagWidth = pdf.getTextWidth("CITY LIVING, MADE SIMPLE") + 0.35 * 24;
  return { width: 80 * s + 3 + tagWidth, height: iconHeight };
}

/** Divider color under the letterhead — the brand's honey gold. */
export const LETTERHEAD_GOLD = GOLD;
