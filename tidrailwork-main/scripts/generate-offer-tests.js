import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const TEMPLATE = path.join(process.cwd(), "public", "offert-template.pdf");
const OUT_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const COORDS = {
  totals: {
    subtotal: { x: 55.3, y: 151.9 },
    vat: { x: 195.8, y: 151.9 },
    total: { x: 329.5, y: 151.9 },
    total_big: { x: 463.5, y: 151.1 },
    vat_line: { x: 55.3, y: 131.1 },
  },
  iban: { x: 344.0, y: 131.1 },
  bic: { x: 479.4, y: 131.1 },
};

async function generate(filename, includeVat) {
  const tpl = fs.readFileSync(TEMPLATE);
  const pdfDoc = await PDFDocument.load(tpl);
  const page = pdfDoc.getPages()[0];
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawText = (text, x, y, size = 9, bold = false) => {
    page.drawText(String(text || ""), {
      x,
      y,
      size,
      font: bold ? helveticaBold : helvetica,
      color: rgb(0, 0, 0),
    });
  };

  // sample lines
  const lines = [
    { description: "Hel traktamente", total: 290 },
    { description: "Halv traktamente", total: 145 },
  ];

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const vatRate = includeVat ? 25 : 0;
  const vat = Math.round((subtotal * vatRate) / 100 * 100) / 100;
  const total = subtotal + vat;

  // Draw totals
  drawText(subtotal.toLocaleString("sv-SE", { minimumFractionDigits: 2 }), COORDS.totals.subtotal.x, COORDS.totals.subtotal.y);
  drawText(vat.toLocaleString("sv-SE", { minimumFractionDigits: 2 }), COORDS.totals.vat.x, COORDS.totals.vat.y);
  drawText(total.toLocaleString("sv-SE", { minimumFractionDigits: 2 }), COORDS.totals.total.x, COORDS.totals.total.y);
  drawText(`SEK ${total.toLocaleString("sv-SE", { minimumFractionDigits: 2 })}`, COORDS.totals.total_big.x, COORDS.totals.total_big.y, 11, true);
  drawText(`Moms ${vatRate}% ${vat.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} (${subtotal.toLocaleString("sv-SE", { minimumFractionDigits: 2 })})`, COORDS.totals.vat_line.x, COORDS.totals.vat_line.y);

  // IBAN/BIC
  const iban = includeVat ? "SE5555555555555555555555" : "";
  const bic = includeVat ? "BIC SWEDSESS" : "";

  // Draw IBAN/BIC
  drawText(iban, COORDS.iban.x, COORDS.iban.y);
  drawText(bic, COORDS.bic.x, COORDS.bic.y);

  const bytes = await pdfDoc.save();
  fs.writeFileSync(path.join(OUT_DIR, filename), bytes);
  console.log("Wrote:", path.join(OUT_DIR, filename));
}

(async () => {
  try {
    await generate("offert_test_with_vat2.pdf", true);
    await generate("offert_test_no_vat.pdf", false);
    console.log("Done");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
