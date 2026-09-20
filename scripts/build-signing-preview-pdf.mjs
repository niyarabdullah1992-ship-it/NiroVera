import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const NAVY = rgb(0.078, 0.157, 0.294);
const GREEN = rgb(0.118, 0.620, 0.388);
const MUTED = rgb(0.353, 0.420, 0.522);
const LINE = rgb(0.890, 0.906, 0.925);
const PAPER = rgb(1, 1, 1);

const pages = [
  {
    kicker: "NIROVERA  ·  SITE HANDOVER",
    title: "Pump handover — Line 3",
    ref: "PWC-AWAIT-001",
    rows: [
      ["Station", "North — Khafji"],
      ["Asset", "P-331 / P-332 centrifugal pumps"],
      ["Crew", "Ahmed Al-Salem  ·  Niyar Abdullah"],
      ["Date", "10 Sep 2026"],
      ["Status", "Awaiting parallel seal"],
    ],
    notes: [
      "Delivery checklist completed on site. Serial plates photographed.",
      "Gasket set replaced. Alignment within 0.05 mm. No leak on first run.",
      "Pending: recipient seal on this record. Parallel signing — others are not blocked.",
    ],
  },
  {
    kicker: "NIROVERA  ·  CHECKLIST",
    title: "Field checks",
    ref: "Page 2 of 4",
    rows: [
      ["Nameplate vs. PO", "Match"],
      ["Foundation bolts", "Torqued"],
      ["Coupling guard", "Fitted"],
      ["Earthing", "Continuous"],
      ["First-run vibration", "Within band"],
    ],
    notes: [
      "Supervisor walked the skid with the receiving technician.",
      "Punch items closed before this record was sent for seal.",
    ],
  },
  {
    kicker: "NIROVERA  ·  EVIDENCE",
    title: "Site photographs",
    ref: "Page 3 of 4",
    photos: true,
    notes: [
      "Three stills attached at capture time. Not a government certificate.",
      "Hash of the sealed file is written into the company registry after the last seal.",
    ],
  },
  {
    kicker: "NIROVERA  ·  SEAL",
    title: "Recipient field",
    ref: "Page 4 of 4",
    notes: [
      "The green field on page 1 is the assigned seal spot.",
      "Changing the studio shape updates the mark on that field before save.",
    ],
    signBand: true,
  },
];

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

for (const spec of pages) {
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });
  page.drawRectangle({ x: 36, y: height - 28, width: 80, height: 4, color: GREEN });
  page.drawText(spec.kicker, { x: 36, y: height - 52, size: 9, font: bold, color: GREEN });
  page.drawText(spec.title, { x: 36, y: height - 82, size: 20, font: bold, color: NAVY });
  page.drawText(spec.ref, { x: 36, y: height - 102, size: 10, font, color: MUTED });

  let y = height - 140;
  (spec.rows || []).forEach(([label, value], index) => {
    if (index % 2 === 0) page.drawRectangle({ x: 36, y: y - 8, width: width - 72, height: 28, color: rgb(0.969, 0.973, 0.980) });
    page.drawText(label, { x: 48, y: y + 2, size: 10, font, color: MUTED });
    page.drawText(value, { x: 220, y: y + 2, size: 10, font: bold, color: NAVY });
    y -= 28;
  });

  if (spec.photos) {
    y -= 10;
    [0, 1, 2].forEach((slot) => {
      const x = 36 + slot * 175;
      page.drawRectangle({ x, y: y - 130, width: 160, height: 120, borderColor: LINE, borderWidth: 1, color: rgb(0.973, 0.976, 0.980) });
      page.drawText(`Still ${slot + 1}`, { x: x + 52, y: y - 78, size: 10, font, color: MUTED });
    });
    y -= 160;
  }

  (spec.notes || []).forEach((line) => {
    page.drawText(line, { x: 36, y, size: 10, font, color: NAVY, maxWidth: width - 72 });
    y -= 18;
  });

  if (spec.signBand) {
    page.drawRectangle({ x: 36, y: 72, width: width - 72, height: 90, borderColor: GREEN, borderWidth: 1.2, color: rgb(0.94, 0.98, 0.95) });
    page.drawText("Assigned seal field  ·  page 1", { x: 52, y: 112, size: 11, font: bold, color: NAVY });
  }

  page.drawLine({ start: { x: 36, y: 48 }, end: { x: width - 36, y: 48 }, thickness: 0.6, color: LINE });
  page.drawText("NiroVera preview document  ·  not a government certificate", { x: 36, y: 34, size: 8, font, color: MUTED });
}

const bytes = await pdf.save();
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "signing-preview-pumps.pdf");
writeFileSync(out, bytes);
console.log(`wrote ${out} (${bytes.length} bytes, ${pdf.getPageCount()} pages)`);
