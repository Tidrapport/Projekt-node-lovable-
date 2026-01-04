import { addDays, format } from "date-fns";

export type OfferCustomer = {
  id: string;
  name: string;
  customer_number?: string | null;
  org_number: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type OfferCompany = {
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
  invoice_payment_terms?: string | null;
  invoice_our_reference?: string | null;
  invoice_late_interest?: string | null;
};

type OfferLineItem = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

type Offer = {
  id: string;
  offer_number: string;
  title: string;
  description: string | null;
  status: string;
  valid_until: string | null;
  pricing_type: string;
  fixed_price: number | null;
  hourly_rate_day: number | null;
  hourly_rate_evening: number | null;
  hourly_rate_night: number | null;
  hourly_rate_weekend: number | null;
  travel_rate_per_km: number | null;
  per_diem_full: number | null;
  per_diem_half: number | null;
  estimated_hours: number | null;
  terms: string | null;
  notes: string | null;
  created_at: string;
  include_vat: boolean;
  line_items?: OfferLineItem[];
};

type OfferLine = {
  item_no: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
};

type OfferTotals = {
  subtotal: number;
  vat: number;
  total: number;
  vat_rate: number;
};

type OfferPdfOptions = {
  download?: boolean;
  filename?: string;
};

const TEMPLATE_PATH = "/offert-template.pdf";

const loadPdfLib = async () => {
  const mod = await import(
    /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js"
  );
  return mod;
};

const fetchTemplate = async () => {
  const res = await fetch(TEMPLATE_PATH);
  if (!res.ok) throw new Error("Kunde inte lasa PDF-mallen for offert.");
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

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const COORDS = {
  address: { x: 325.2, y: [712.8, 700.2, 687.6, 674.9] },
  meta: {
    invoice_date: { x: 495.3, y: 764.5, w: 80 },
    invoice_number: { x: 495.3, y: 751.9, w: 80 },
    ocr: { x: 495.3, y: 735.0, w: 80 },
  },
  info: {
    customer_number: { x: 133.8, y: 611.8, w: 140 },
    our_reference: { x: 403.1, y: 610.5, w: 160 },
    their_reference: { x: 133.8, y: 586.6, w: 140 },
    payment_terms: { x: 403.1, y: 586.6, w: 160 },
    order_number: { x: 133.8, y: 573.9, w: 140 },
    due_date: { x: 403.1, y: 573.9, w: 160 },
    vat_number: { x: 146.6, y: 597.8, w: 180 },
    late_interest: { x: 403.1, y: 561.3, w: 160 },
  },
  table: {
    start_y: 522.0,
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
    subtotal: { x: 55.3, y: 146.2, w: 120 },
    vat: { x: 195.8, y: 146.2, w: 120 },
    total: { x: 329.5, y: 146.2, w: 120 },
    total_big: { x: 463.5, y: 142.9, w: 120 },
    vat_line: { x: 55.3, y: 126.1, w: 320 },
  },
  iban_line: { x: 344.0, y: 126.1, w: 130 },
  bic_line: { x: 479.4, y: 126.1, w: 110 },
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

const buildOfferLines = (offer: Offer) => {
  const lines: OfferLine[] = [];
  const hours = offer.estimated_hours && offer.estimated_hours > 0 ? offer.estimated_hours : 1;
  let lineNo = 1;

  const addLine = (description: string, quantity: number, unit: string, unitPrice: number) => {
    const qty = Math.max(0, toNumber(quantity));
    const price = Math.max(0, toNumber(unitPrice));
    lines.push({
      item_no: String(lineNo++),
      description,
      quantity: qty,
      unit,
      unit_price: price,
      total: qty * price,
    });
  };

  const lineItems = (offer.line_items || []).filter(
    (item) => item.description || item.quantity || item.unit_price
  );

  if (lineItems.length > 0) {
    lineItems.forEach((item) => {
      addLine(item.description || "Artikel", item.quantity, item.unit || "", item.unit_price);
    });
  } else {
    if (offer.fixed_price) {
      addLine("Fast pris", 1, "st", Number(offer.fixed_price));
    }

    if (offer.hourly_rate_day) {
      addLine("Timpris dag", hours, "h", Number(offer.hourly_rate_day));
    }
    if (offer.hourly_rate_evening) {
      addLine("Timpris kväll", hours, "h", Number(offer.hourly_rate_evening));
    }
    if (offer.hourly_rate_night) {
      addLine("Timpris natt", hours, "h", Number(offer.hourly_rate_night));
    }
    if (offer.hourly_rate_weekend) {
      addLine("Timpris helg", hours, "h", Number(offer.hourly_rate_weekend));
    }
  }

  if (offer.travel_rate_per_km) {
    addLine("Reseersättning", 1, "km", Number(offer.travel_rate_per_km));
  }
  if (offer.per_diem_full) {
    addLine("Hel traktamente", 1, "dag", Number(offer.per_diem_full));
  }
  if (offer.per_diem_half) {
    addLine("Halv traktamente", 1, "dag", Number(offer.per_diem_half));
  }

  if (!lines.length) {
    addLine(offer.title || "Offert", 1, "st", 0);
  }

  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const vatRate = offer.include_vat === false ? 0 : 25;
  const vat = (subtotal * vatRate) / 100;
  const total = subtotal + vat;

  const totals: OfferTotals = {
    subtotal,
    vat,
    total,
    vat_rate: vatRate,
  };

  return { lines, totals };
};

export async function generateOfferPDF(
  offer: Offer,
  customer: OfferCustomer | null,
  company: OfferCompany,
  options: OfferPdfOptions = {}
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
      // Ignore logo errors to avoid breaking offer generation.
    }
  };

  const drawWrappedText = (
    text: string,
    box: { x: number; y: number; w: number; h: number },
    size = 12
  ) => {
    if (!text) return;
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      const width = fontBold.widthOfTextAtSize(next, size);
      if (width > box.w && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    const trimmed = lines.slice(0, 3);
    const lineHeight = size + 2;
    const totalHeight = trimmed.length * lineHeight;
    let y = box.y + (box.h + totalHeight) / 2 - lineHeight;
    trimmed.forEach((line) => {
      const width = fontBold.widthOfTextAtSize(line, size);
      const x = Math.max(box.x, box.x + (box.w - width) / 2);
      drawText(line, x, y, { size, bold: true });
      y -= lineHeight;
    });
  };

  const clearNumberCell = (x: number, y: number, width: number, size = 13) => {
    clearTextArea(x, y, width, size);
  };

  const offerDate = offer.created_at ? new Date(offer.created_at) : new Date();
  const offerDateText = format(offerDate, "yyyy-MM-dd");
  const paymentTermsText = company?.invoice_payment_terms || "";
  const paymentDaysMatch = paymentTermsText.match(/\d+/);
  const paymentDays = paymentDaysMatch ? Number(paymentDaysMatch[0]) : 0;
  const validUntilDate = paymentDays > 0
    ? addDays(offerDate, paymentDays)
    : offer.valid_until
    ? new Date(offer.valid_until)
    : offerDate;
  const validUntilText = format(validUntilDate, "yyyy-MM-dd");

  const addressLines = (customer
    ? [
        customer.name,
        customer.address,
        [customer.postal_code, customer.city].filter(Boolean).join(" "),
      ]
    : []
  ).filter(Boolean) as string[];
  const paddedAddress = addressLines.slice(0, 4);
  while (paddedAddress.length < 4) paddedAddress.push("");

  paddedAddress.forEach((line, idx) => {
    drawValue(line, COORDS.address.x, COORDS.address.y[idx], 240);
  });

  drawValue(offerDateText, COORDS.meta.invoice_date.x, COORDS.meta.invoice_date.y, COORDS.meta.invoice_date.w);
  drawValue(offer.offer_number || "", COORDS.meta.invoice_number.x, COORDS.meta.invoice_number.y, COORDS.meta.invoice_number.w);
  drawValue("", COORDS.meta.ocr.x, COORDS.meta.ocr.y, COORDS.meta.ocr.w);

  drawValue(
    customer?.customer_number || "",
    COORDS.info.customer_number.x,
    COORDS.info.customer_number.y,
    COORDS.info.customer_number.w
  );
  clearTextArea(COORDS.info.our_reference.x, COORDS.info.our_reference.y, COORDS.info.our_reference.w + 40, 9);
  drawValue(
    company?.invoice_our_reference || "",
    COORDS.info.our_reference.x,
    COORDS.info.our_reference.y,
    COORDS.info.our_reference.w
  );
  drawValue(
    customer?.contact_person || "",
    COORDS.info.their_reference.x,
    COORDS.info.their_reference.y,
    COORDS.info.their_reference.w
  );
  drawValue(
    paymentTermsText,
    COORDS.info.payment_terms.x,
    COORDS.info.payment_terms.y,
    COORDS.info.payment_terms.w
  );
  drawValue(offer.title || "", COORDS.info.order_number.x, COORDS.info.order_number.y, COORDS.info.order_number.w);
  drawValue(
    company?.invoice_late_interest || "",
    COORDS.info.due_date.x,
    COORDS.info.due_date.y,
    COORDS.info.due_date.w
  );
  drawValue(company?.org_number || "", COORDS.info.vat_number.x, COORDS.info.vat_number.y, COORDS.info.vat_number.w);
  drawValue(validUntilText, COORDS.info.late_interest.x, COORDS.info.late_interest.y, COORDS.info.late_interest.w);

  const { lines, totals } = buildOfferLines(offer);
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

  const formatOrBlank = (value: number) => (value === 0 ? "" : formatNumber(value));
  clearNumberCell(COORDS.totals.subtotal.x, COORDS.totals.subtotal.y, COORDS.totals.subtotal.w, 13);
  clearNumberCell(COORDS.totals.vat.x, COORDS.totals.vat.y, COORDS.totals.vat.w, 13);
  clearNumberCell(COORDS.totals.total.x, COORDS.totals.total.y, COORDS.totals.total.w, 13);
  clearNumberCell(COORDS.totals.total_big.x, COORDS.totals.total_big.y, COORDS.totals.total_big.w, 15);
  clearNumberCell(COORDS.totals.vat_line.x, COORDS.totals.vat_line.y, COORDS.totals.vat_line.w, 11);

  drawValue(formatOrBlank(totals.subtotal), COORDS.totals.subtotal.x, COORDS.totals.subtotal.y, COORDS.totals.subtotal.w);
  drawValue(formatOrBlank(totals.vat), COORDS.totals.vat.x, COORDS.totals.vat.y, COORDS.totals.vat.w);
  drawValue(formatOrBlank(totals.total), COORDS.totals.total.x, COORDS.totals.total.y, COORDS.totals.total.w);

  const totalText = totals.total === 0 ? "" : `SEK ${formatNumber(totals.total)}`;
  drawValue(totalText, COORDS.totals.total_big.x, COORDS.totals.total_big.y, COORDS.totals.total_big.w, { bold: true, size: 13 });

  const vatLine = totals.vat === 0
    ? ""
    : `Moms ${formatNumber(totals.vat_rate, 0)}% ${formatNumber(totals.vat)} (${formatNumber(totals.subtotal)})`;
  drawValue(vatLine, COORDS.totals.vat_line.x, COORDS.totals.vat_line.y, COORDS.totals.vat_line.w);

  const ibanValue = company?.iban_number ? `IBAN ${String(company.iban_number).trim()}` : "";
  const bicValue = company?.bic_number ? `BIC ${company.bic_number}` : "";
  drawValue(ibanValue, COORDS.iban_line.x, COORDS.iban_line.y, COORDS.iban_line.w);
  drawValue(bicValue, COORDS.bic_line.x, COORDS.bic_line.y, COORDS.bic_line.w);

  clearArea(COORDS.logo.x, COORDS.logo.y, COORDS.logo.w, COORDS.logo.h);
  if (company?.logo_url) {
    await drawLogo(company.logo_url);
  } else {
    const fallbackName = company?.name || "Rail work entreprenad i sverige ab";
    drawWrappedText(fallbackName, {
      x: COORDS.logo.x,
      y: COORDS.logo.y,
      w: COORDS.logo.w,
      h: COORDS.logo.h,
    });
  }

  const addressFooterLines: string[] = [];
  if (company?.name) addressFooterLines.push(company.name);
  const line1 = company?.address_line1 || "";
  const line2 = company?.address_line2 || "";
  if (line1 && line2) {
    addressFooterLines.push(`${line1}, ${line2}`);
  } else if (line1) {
    addressFooterLines.push(line1);
  } else if (line2) {
    addressFooterLines.push(line2);
  }
  const postalCity = [company?.postal_code, company?.city].filter(Boolean).join(" ");
  if (postalCity) addressFooterLines.push(postalCity);
  if (company?.country) addressFooterLines.push(company.country);
  while (addressFooterLines.length < 4) addressFooterLines.push("");
  const footerLines = addressFooterLines.slice(0, 4);

  footerLines.forEach((line, idx) => {
    drawValue(line, COORDS.footer.address_x, COORDS.footer.address_y[idx], COORDS.footer.address_w);
  });

  drawValue(company?.phone || "", COORDS.footer.phone.x, COORDS.footer.phone.y, COORDS.footer.phone.w);
  drawValue(company?.billing_email || "", COORDS.footer.email.x, COORDS.footer.email.y, COORDS.footer.email.w);
  drawValue(company?.bankgiro || "", COORDS.footer.bankgiro.x, COORDS.footer.bankgiro.y, COORDS.footer.bankgiro.w);
  drawValue(company?.org_number || "", COORDS.footer.org_number.x, COORDS.footer.org_number.y, COORDS.footer.org_number.w);
  drawValue(company?.vat_number || "", COORDS.footer.vat_number.x, COORDS.footer.vat_number.y, COORDS.footer.vat_number.w);

  const showFSkatt =
    company?.f_skatt === true ||
    company?.f_skatt === 1 ||
    company?.f_skatt === "1" ||
    company?.f_skatt === "true";
  drawValue(
    showFSkatt ? "Godkänd för F-skatt" : "",
    COORDS.footer.f_skatt.x,
    COORDS.footer.f_skatt.y,
    COORDS.footer.f_skatt.w
  );

  const pdfBytes = await pdfDoc.save();
  const defaultName = `offert_${offer.offer_number || "offert"}.pdf`;
  if (options.download !== false) {
    downloadBlob(pdfBytes, options.filename || defaultName);
  }
  return pdfBytes;
}
