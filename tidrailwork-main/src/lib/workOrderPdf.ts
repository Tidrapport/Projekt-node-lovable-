import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";

type WorkOrderPdfOptions = {
  download?: boolean;
  filename?: string;
};

export const generateWorkOrderPDF = async (order: any, company?: any, options: WorkOrderPdfOptions = {}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  doc.setFontSize(20);
  doc.text("Arbetsorder", margin, y);
  doc.setFontSize(11);
  y += 8;

  // Header block similar to kundunderlag
  doc.setFontSize(11);
  doc.text(`Ordernr: AO ${order.order_year}-${String(order.order_number).padStart(4, "0")}`, margin, y);
  doc.text(`Kund: ${order.company_name || "-"}`, margin, y + 6);
  doc.text(`Projekt: ${order.project_name || "-"}`, margin, y + 12);
  const translateStatus = (raw?: string) => {
    const s = String(raw || "not_started").toLowerCase();
    if (s === "attested" || s === "closed") return "Avslutad";
    if (s === "paused") return "Pausad";
    if (s === "in_progress") return "Pågående";
    return "Ej påbörjad";
  };

  const translatePriority = (p?: string) => {
    const v = String(p || "").toLowerCase();
    if (v === "high") return "Hög";
    if (v === "low") return "Låg";
    if (v === "medium" || v === "med" || v === "m") return "Medel";
    return p || "-";
  };

  doc.text(`Status: ${translateStatus(order.status)}`, pageWidth - margin - 60, y);

  doc.text(`Prioritet: ${translatePriority(order.priority)}`, pageWidth - margin - 60, y + 6);
  doc.text(`Deadline: ${order.deadline || "-"}`, pageWidth - margin - 60, y + 12);

  y += 22;

  // Assignees
  const assignees = (order.assignees || []).map((a: any) => a.full_name || a.email || a.id).join(", ");
  doc.setFontSize(10);
  doc.text(`Tilldelade: ${assignees || "-"}`, margin, y);
  y += 8;

  // Sections
  const addSection = (title: string, content?: string) => {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const text = content || "-";
    const split = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(split, margin, y);
    y += split.length * 5 + 6;
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }
  };

  addSection("Beskrivning", order.description);
  addSection("Instruktioner", order.instructions);
  addSection("Utfört arbete", order.report_text);

  // Contact
  addSection(
    "Kontaktuppgifter",
    `Adress: ${order.address || "-"}\nKontakt: ${order.contact_name || "-"}\nTelefon: ${order.contact_phone || "-"}`
  );

  // Summary table with meta
  const fmt = (d?: string) => {
    if (!d) return "-";
    try {
      const parsed = parseISO(d);
      if (isNaN(parsed.getTime())) return d;
      return format(parsed, "d MMMM yyyy", { locale: sv });
    } catch {
      return d;
    }
  };

  const metaRows: string[][] = [
    ["Skapad", fmt(order.created_at)],
    ["Startad", `${fmt(order.started_at)} — ${order.started_by_name || "-"}`],
    ["Avslutad", `${fmt(order.closed_at)} — ${order.closed_by_name || "-"}`],
    ["Attesterad", `${fmt(order.attested_at)} — ${order.attested_by_name || "-"}`],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Fält", "Värde"]],
    body: metaRows,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 120 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Sida ${i} av ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, {
      align: "center",
    });
  }

  const safe = (order.project_name || "order").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const defaultName = `arbetsorder_${safe}_${format(new Date(), "yyyy-MM-dd", { locale: sv })}.pdf`;
  const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
  if (options.download !== false) {
    doc.save(options.filename || defaultName);
  }
  return pdfBytes;
};

export default generateWorkOrderPDF;
