import { WeldingReport, WeldingEntry } from "@/types/weldingReport";

// Dynamisk import från CDN för att slippa lokal node_modules (nät krävs vid användning)
const loadPdfLib = async () => {
  const mod = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js");
  return mod;
};

const TEMPLATE_PATH = "/welding-template.pdf";

const fetchTemplate = async () => {
  const res = await fetch(TEMPLATE_PATH);
  if (!res.ok) {
    throw new Error("Kunde inte läsa PDF-mallen för svetsrapport.");
  }
  return res.arrayBuffer();
};

const downloadBlob = (data: Uint8Array, filename: string) => {
  const blob = new Blob([data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Hjälpmetod: fyll raderna och se till att vi alltid har minst 13
const normalizeRows = (entries: WeldingEntry[]) => {
  const padded = [...entries];
  while (padded.length < 13) {
    padded.push({
      nr: padded.length + 1,
      date: "",
      location: "",
      switchImage: "",
      beforeMm: "",
      afterMm: "",
      temp: "",
      model: "",
      material: "",
      rail: "",
      workType: "",
      weldingMethod: "",
      additiveMaterial: "",
      batchNr: "",
      wpsNr: "",
    });
  }
  return padded;
};

export async function generateWeldingReportPDF(
  report: WeldingReport & { profiles?: { full_name: string } | null },
  companyName: string
) {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const templateBytes = await fetchTemplate();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  // Remove all interactive fields so checkboxes can't be selected in the output.
  form.getFields().forEach((field) => form.removeField(field));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize(); // A4: ca 595 x 842

  const draw = (
    text: string | number | null | undefined,
    x: number,
    y: number,
    opts: { size?: number; bold?: boolean } = {}
  ) => {
    page.drawText(String(text ?? ""), {
      x,
      y,
      size: opts.size ?? 9,
      font: opts.bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
  };

  // Debuggrid för kalibrering (sätt till false när vi är klara)
  const DEBUG_GRID = false;
  if (DEBUG_GRID) {
    page.setFont(font);
    page.setFontSize(6);
    page.drawLine({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }); // no-op to ensure methods exist
    const step = 20;
    for (let x = 0; x <= Math.floor(width); x += step) {
      page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, color: rgb(0.8, 0.8, 0.8), thickness: 0.2 });
      draw(x, x + 2, height - 8, { size: 6 });
    }
    for (let y = 0; y <= Math.floor(height); y += step) {
      page.drawLine({ start: { x: 0, y }, end: { x: width, y }, color: rgb(0.8, 0.8, 0.8), thickness: 0.2 });
      draw(y, 2, y + 2, { size: 6 });
    }
  }

  // Koordinater från manuellt nät (Y, X) => (x, y)
  // Topprad (företag/enhet, Ao, år/månad)
  draw(companyName, 80, 505, { bold: true, size: 9 }); // Företag/enhet
  draw(report.own_ao_number || "", 280, 505, { bold: true, size: 9 }); // Eget Ao nr
  draw(report.customer_ao_number || "", 410, 505, { bold: true, size: 9 }); // Kundens Ao nr
  draw(report.report_year || "", 280, 465, { bold: true, size: 9 }); // År
  draw(report.report_month || "", 320, 465, { bold: true, size: 9 }); // Månad

  // Rad 2: Namn/svets-ID och Bessy/Ofelia
  draw(`${report.welder_name || ""} ${report.welder_id || ""}`, 80, 465, { bold: true, size: 9 });
  draw(report.bessy_anm_ofelia || "", 410, 465, { bold: true, size: 9 });

  // Svetsrader (tabell)
  const rows = normalizeRows(report.welding_entries || []);
  const rowY = [410, 385, 365, 345, 325, 305, 285, 265, 245, 225];
  const extraRowStep = 20;

  // X-koordinater per kolumn, centrerade i rutorna
  const colX = {
    nr: 60,
    date: 80,
    location: 100,
    switchImage: 240,
    beforeMm: 280,
    afterMm: 305,
    temp: 340,
    model: 365,
    material: 410,
    rail: 485,
    workType: 535,
    weldingMethod: 590,
    additiveMaterial: 645,
    batchNr: 700,
    wpsNr: 760,
  };

  rows.forEach((entry, idx) => {
    const y =
      idx < rowY.length
        ? rowY[idx]
        : rowY[rowY.length - 1] - (idx - (rowY.length - 1)) * extraRowStep;
    draw(entry.date || "", colX.date, y, { size: 7 });
    draw(entry.location || "", colX.location, y, { size: 7 });
    draw(entry.switchImage || "", colX.switchImage, y, { size: 7 });
    draw(entry.beforeMm || "", colX.beforeMm, y + 1, { size: 7 });
    draw(entry.afterMm || "", colX.afterMm, y, { size: 7 });
    draw(entry.temp || "", colX.temp, y, { size: 7 });
    draw(entry.model || "", colX.model, y, { size: 7 });
    draw(entry.material || "", colX.material, y, { size: 7 });
    draw(entry.rail || "", colX.rail, y, { size: 7 });
    draw(entry.workType || "", colX.workType, y, { size: 7 });
    draw(entry.weldingMethod || "", colX.weldingMethod, y, { size: 7 });
    draw(entry.additiveMaterial || "", colX.additiveMaterial, y, { size: 7 });
    draw(entry.batchNr || "", colX.batchNr, y, { size: 7 });
    draw(entry.wpsNr || "", colX.wpsNr, y, { size: 7 });
  });

  // Egenkontroll och noter längst ned
  const bottomY = 120;
  // Höger kolumn: svetsansvarig, telefon, avvikelse, kommentarer (anpassat efter givna koordinater)
  draw(report.welding_supervisor || "", 465, 205, { bold: true, size: 9 }); // Svetsansvarig
  draw(report.supervisor_phone || "", 465, 185, { bold: true, size: 9 }); // Telefon
  draw(report.deviations || "", 465, 165, { size: 9 }); // Avvikelser (höger sida)
  draw(report.comments || "", 365, 120, { size: 9 }); // Kommentarer (fält till höger)

  // Checkboxar (markera med X)
  const markXOffset = 12;
  const mark = (cond: boolean | null | undefined, x: number, y: number) => {
    if (cond) draw("X", x + markXOffset, y, { bold: true, size: 11 });
  };
  mark(report.id_marked_weld, 200, 185);
  mark(report.geometry_control, 200, 165);
  mark(report.cleaned_workplace, 200, 145);
  mark(report.restored_rail_quantity, 200, 130);
  mark(report.welded_in_cold_climate, 200, 110);
  mark(report.ensured_gas_flow, 200, 90);
  mark(report.protected_cooling, 200, 70);

  const pdfBytes = await pdfDoc.save();
  downloadBlob(pdfBytes, `svetsrapport_${report.id || "rapport"}.pdf`);
}
