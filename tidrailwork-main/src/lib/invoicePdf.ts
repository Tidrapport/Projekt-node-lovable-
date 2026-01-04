type InvoiceLine = {
  item_no: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
};

type InvoiceTotals = {
  subtotal: number;
  vat: number;
  total: number;
  vat_rate: number;
};

type CompanyFooter = {
  name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  billing_email?: string | null;
  bankgiro?: string | null;
  bic_number?: string | null;
  iban_number?: string | null;
  logo_url?: string | null;
  org_number?: string | null;
  vat_number?: string | null;
  f_skatt?: boolean | number | string | null;
};

type InvoiceMeta = {
  invoice_date: string;
  invoice_number: string;
  ocr: string;
  customer_number: string;
  our_reference: string;
  their_reference: string;
  order_number: string;
  payment_terms: string;
  due_date: string;
  vat_number: string;
  late_interest: string;
  vat_label?: string;
  customer_address_lines: string[];
};

const TEMPLATE_PATH = "/faktura-template.pdf";

// Dynamic import from CDN to avoid bundling pdf-lib (network needed at runtime).
const loadPdfLib = async () => {
  const mod = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js");
  return mod;
};

const fetchTemplate = async () => {
  const res = await fetch(TEMPLATE_PATH);
  if (!res.ok) throw new Error("Kunde inte lasa PDF-mallen for faktura.");
  return res.arrayBuffer();
};

const toBlobPart = (data: Uint8Array) =>
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const downloadBlob = (data: Uint8Array, filename: string) => {
  const blob = new Blob([toBlobPart(data)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const formatNumber = (value: number, digits = 2) =>
  value.toLocaleString("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const COORDS = {
  address: { x: 325.2, y: [712.8, 700.2, 687.6, 674.9] },
  meta: {
    invoice_date: { x: 495.3, y: 764.5, w: 80 },
    invoice_number: { x: 495.3, y: 751.9, w: 80 },
    ocr: { x: 495.3, y: 739.3, w: 80 },
  },
  info: {
    customer_number: { x: 133.8, y: 599.2, w: 140 },
    our_reference: { x: 403.1, y: 599.2, w: 160 },
    their_reference: { x: 133.8, y: 586.6, w: 140 },
    payment_terms: { x: 403.1, y: 586.6, w: 160 },
    order_number: { x: 133.8, y: 573.9, w: 140 },
    due_date: { x: 403.1, y: 573.9, w: 160 },
    vat_number: { x: 133.8, y: 561.3, w: 180 },
    late_interest: { x: 403.1, y: 561.3, w: 160 },
  },
  table: {
    start_y: 510.7,
    row_h: 15.3,
    max_rows: 18,
    cols: {
      item_no: { x: 55.3, w: 48 },
      description: { x: 118.1, w: 160 },
      quantity: { x: 293.9, w: 55 },
      unit: { x: 351.1, w: 60 },
      unit_price: { x: 419.7, w: 70 },
      total: { x: 501.8, w: 80 },
    },
  },
  totals: {
    subtotal: { x: 55.3, y: 151.9, w: 120 },
    vat: { x: 195.8, y: 151.9, w: 120 },
    total: { x: 329.5, y: 151.9, w: 120 },
    total_big: { x: 463.5, y: 151.1, w: 120 },
    vat_line: { x: 55.3, y: 131.1, w: 320 },
  },
  iban_line: { x: 344.0, y: 131.1, w: 130 },
  bic_line: { x: 479.4, y: 131.1, w: 110 },
  logo: { x: 55.3, y: 702.8, w: 155.0, h: 93.0 },
  footer: {
    address_x: 55.3,
    address_y: [94.9, 82.2, 69.6, 57.0],
    address_w: 160,
    phone: { x: 229.2, y: 94.9, w: 130 },
    email: { x: 229.2, y: 65.7, w: 130 },
    bankgiro: { x: 403.0, y: 94.9, w: 55 },
    org_number: { x: 462.8, y: 94.9, w: 120 },
    vat_number: { x: 462.8, y: 65.7, w: 120 },
    f_skatt: { x: 462.8, y: 49.2, w: 120 },
  },
};

export async function generateInvoicePdf(
  meta: InvoiceMeta,
  lines: InvoiceLine[],
  totals: InvoiceTotals,
  companyFooter?: CompanyFooter
) {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const templateBytes = await fetchTemplate();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const clearArea = (x: number, y: number, width: number, height: number) => {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(1, 1, 1),
    });
  };

  const clearTextArea = (x: number, y: number, width: number, size: number) => {
    clearArea(x, y - 2, width, size + 4);
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    opts: { size?: number; bold?: boolean } = {}
  ) => {
    page.drawText(text, {
      x,
      y,
      size: opts.size ?? 9,
      font: opts.bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
  };

  const drawValue = (
    text: string,
    x: number,
    y: number,
    width: number,
    opts: { size?: number; bold?: boolean } = {}
  ) => {
    const safe = text || "";
    clearTextArea(x, y, width, opts.size ?? 9);
    drawText(safe, x, y, opts);
  };

  const drawLogo = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let image;
      try {
        image = await pdfDoc.embedPng(bytes);
      } catch {
        image = await pdfDoc.embedJpg(bytes);
      }
      const { width, height } = image.scale(1);
      const scale = Math.min(COORDS.logo.w / width, COORDS.logo.h / height);
      const drawWidth = width * scale;
      const drawHeight = height * scale;
      const drawX = COORDS.logo.x + (COORDS.logo.w - drawWidth) / 2;
      const drawY = COORDS.logo.y + (COORDS.logo.h - drawHeight) / 2;
      clearArea(COORDS.logo.x, COORDS.logo.y, COORDS.logo.w, COORDS.logo.h);
      page.drawImage(image, {
        x: drawX,
        y: drawY,
        width: drawWidth,
        height: drawHeight,
      });
    } catch {
      // Ignore logo errors to avoid breaking invoice generation.
    }
  };

  const addressLines = (meta.customer_address_lines || []).slice(0, 4);
  while (addressLines.length < 4) addressLines.push("");

  addressLines.forEach((line, idx) => {
    drawValue(line, COORDS.address.x, COORDS.address.y[idx], 240);
  });

  drawValue(meta.invoice_date, COORDS.meta.invoice_date.x, COORDS.meta.invoice_date.y, COORDS.meta.invoice_date.w);
  drawValue(
    meta.invoice_number,
    COORDS.meta.invoice_number.x,
    COORDS.meta.invoice_number.y,
    COORDS.meta.invoice_number.w
  );
  drawValue(meta.ocr, COORDS.meta.ocr.x, COORDS.meta.ocr.y, COORDS.meta.ocr.w);

  drawValue(
    meta.customer_number,
    COORDS.info.customer_number.x,
    COORDS.info.customer_number.y,
    COORDS.info.customer_number.w
  );
  drawValue(
    meta.our_reference,
    COORDS.info.our_reference.x,
    COORDS.info.our_reference.y,
    COORDS.info.our_reference.w
  );
  drawValue(
    meta.their_reference,
    COORDS.info.their_reference.x,
    COORDS.info.their_reference.y,
    COORDS.info.their_reference.w
  );
  drawValue(
    meta.payment_terms,
    COORDS.info.payment_terms.x,
    COORDS.info.payment_terms.y,
    COORDS.info.payment_terms.w
  );
  drawValue(
    meta.order_number,
    COORDS.info.order_number.x,
    COORDS.info.order_number.y,
    COORDS.info.order_number.w
  );
  drawValue(
    meta.due_date,
    COORDS.info.due_date.x,
    COORDS.info.due_date.y,
    COORDS.info.due_date.w
  );
  drawValue(meta.vat_number, COORDS.info.vat_number.x, COORDS.info.vat_number.y, COORDS.info.vat_number.w);
  drawValue(
    meta.late_interest,
    COORDS.info.late_interest.x,
    COORDS.info.late_interest.y,
    COORDS.info.late_interest.w
  );

  const { cols, start_y, row_h, max_rows } = COORDS.table;
  const rowCount = Math.min(max_rows, lines.length);
  for (let i = 0; i < max_rows; i += 1) {
    const y = start_y - i * row_h;
    clearTextArea(cols.item_no.x - 4, y, cols.item_no.w + 8, 9);
    clearTextArea(cols.description.x - 4, y, cols.description.w + 8, 9);
    clearTextArea(cols.quantity.x - 20, y, cols.quantity.w + 40, 9);
    clearTextArea(cols.unit.x - 4, y, cols.unit.w + 8, 9);
    clearTextArea(cols.unit_price.x - 20, y, cols.unit_price.w + 40, 9);
    clearTextArea(cols.total.x - 20, y, cols.total.w + 40, 9);
  }

  for (let i = 0; i < rowCount; i += 1) {
    const line = lines[i];
    const y = start_y - i * row_h;
    const quantityValue = Math.max(0, Number(line.quantity || 0));
    const quantityText = quantityValue === 0 ? "" : formatNumber(quantityValue);
    drawText(line.item_no, cols.item_no.x, y);
    drawText(line.description, cols.description.x, y);
    drawText(quantityText, cols.quantity.x, y);
    drawText(line.unit, cols.unit.x, y);
    drawText(formatNumber(Math.max(0, Number(line.unit_price || 0))), cols.unit_price.x, y);
    drawText(formatNumber(Math.max(0, Number(line.total || 0))), cols.total.x, y);
  }

  drawValue(formatNumber(totals.subtotal), COORDS.totals.subtotal.x, COORDS.totals.subtotal.y, COORDS.totals.subtotal.w);
  drawValue(formatNumber(totals.vat), COORDS.totals.vat.x, COORDS.totals.vat.y, COORDS.totals.vat.w);
  drawValue(formatNumber(totals.total), COORDS.totals.total.x, COORDS.totals.total.y, COORDS.totals.total.w);

  const totalText = `SEK ${formatNumber(totals.total)}`;
  drawValue(totalText, COORDS.totals.total_big.x, COORDS.totals.total_big.y, COORDS.totals.total_big.w, { bold: true, size: 11 });

  const vatLine = meta.vat_label
    ? meta.vat_label
    : `Moms ${formatNumber(totals.vat_rate, 0)}% ${formatNumber(totals.vat)} (${formatNumber(totals.subtotal)})`;
  drawValue(vatLine, COORDS.totals.vat_line.x, COORDS.totals.vat_line.y, COORDS.totals.vat_line.w);

  const ibanValue = companyFooter?.iban_number ? String(companyFooter.iban_number).trim() : "";
  const bicValue = companyFooter?.bic_number ? `BIC ${companyFooter.bic_number}` : "";
  drawValue(ibanValue, COORDS.iban_line.x, COORDS.iban_line.y, COORDS.iban_line.w);
  drawValue(bicValue, COORDS.bic_line.x, COORDS.bic_line.y, COORDS.bic_line.w);

  clearArea(COORDS.logo.x, COORDS.logo.y, COORDS.logo.w, COORDS.logo.h);
  if (companyFooter?.logo_url) {
    await drawLogo(companyFooter.logo_url);
  }

  if (companyFooter) {
    const addressFooterLines: string[] = [];
    if (companyFooter.name) addressFooterLines.push(companyFooter.name);
    const line1 = companyFooter.address_line1 || "";
    const line2 = companyFooter.address_line2 || "";
    if (line1 && line2) {
      addressFooterLines.push(`${line1}, ${line2}`);
    } else if (line1) {
      addressFooterLines.push(line1);
    } else if (line2) {
      addressFooterLines.push(line2);
    }
    const postalCity = [companyFooter.postal_code, companyFooter.city].filter(Boolean).join(" ");
    if (postalCity) addressFooterLines.push(postalCity);
    if (companyFooter.country) addressFooterLines.push(companyFooter.country);
    while (addressFooterLines.length < 4) addressFooterLines.push("");
    const footerLines = addressFooterLines.slice(0, 4);

    footerLines.forEach((line, idx) => {
      drawValue(line, COORDS.footer.address_x, COORDS.footer.address_y[idx], COORDS.footer.address_w);
    });

    drawValue(companyFooter.phone || "", COORDS.footer.phone.x, COORDS.footer.phone.y, COORDS.footer.phone.w);
    drawValue(
      companyFooter.billing_email || "",
      COORDS.footer.email.x,
      COORDS.footer.email.y,
      COORDS.footer.email.w
    );
    drawValue(companyFooter.bankgiro || "", COORDS.footer.bankgiro.x, COORDS.footer.bankgiro.y, COORDS.footer.bankgiro.w);
    drawValue(
      companyFooter.org_number || "",
      COORDS.footer.org_number.x,
      COORDS.footer.org_number.y,
      COORDS.footer.org_number.w
    );
    drawValue(
      companyFooter.vat_number || "",
      COORDS.footer.vat_number.x,
      COORDS.footer.vat_number.y,
      COORDS.footer.vat_number.w
    );
    const showFSkatt =
      companyFooter.f_skatt === true ||
      companyFooter.f_skatt === 1 ||
      companyFooter.f_skatt === "1" ||
      companyFooter.f_skatt === "true";
    drawValue(showFSkatt ? "Godkänd för F-skatt" : "", COORDS.footer.f_skatt.x, COORDS.footer.f_skatt.y, COORDS.footer.f_skatt.w);
  }

  const pdfBytes = await pdfDoc.save();
  downloadBlob(pdfBytes, `faktura_${meta.invoice_number || "utkast"}.pdf`);
}

export type { InvoiceLine, InvoiceMeta, InvoiceTotals, CompanyFooter };
