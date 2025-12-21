import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { WeldingReport, WeldingEntry } from "@/types/weldingReport";

export const generateWeldingReportPDF = async (
  report: WeldingReport & { profiles?: { full_name: string } | null },
  companyName: string,
  logoUrl?: string | null
) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  // Yellow background for the entire page
  doc.setFillColor(255, 255, 204); // Light yellow like the original
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Header - TMALL text
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text("TMALL 0435 Banöverbyggnad Svetsrapport ver.5.0", margin, 6);

  // Trafikverket logo area (top right)
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text("TRAFIKVERKET", pageWidth - margin - 35, 10);

  // Main title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Svetsrapport", pageWidth / 2, 18, { align: "center" });

  // Header info section with borders
  const headerY = 24;
  const headerHeight = 20;
  const colWidth1 = 70;
  const colWidth2 = 50;
  const colWidth3 = 50;
  const colWidth4 = 60;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  // Row 1: Företag/enhet, Eget Ao nr, Kundens Ao nr, År/Månad
  // First box - Företag/enhet
  doc.rect(margin, headerY, colWidth1, headerHeight / 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Företag/enhet", margin + 1, headerY + 3);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, margin + 1, headerY + 8);

  // Second box - Eget Ao nr
  doc.rect(margin + colWidth1, headerY, colWidth2, headerHeight / 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Eget Ao nr", margin + colWidth1 + 1, headerY + 3);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(report.own_ao_number || "", margin + colWidth1 + 1, headerY + 8);

  // Third box - Kundens Ao nr
  doc.rect(margin + colWidth1 + colWidth2, headerY, colWidth3, headerHeight / 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Kundens Ao nr", margin + colWidth1 + colWidth2 + 1, headerY + 3);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(report.customer_ao_number || "", margin + colWidth1 + colWidth2 + 1, headerY + 8);

  // Fourth box - År/Månad
  doc.rect(margin + colWidth1 + colWidth2 + colWidth3, headerY, colWidth4, headerHeight / 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("År                    Månad", margin + colWidth1 + colWidth2 + colWidth3 + 1, headerY + 3);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`${report.report_year}                    ${report.report_month}`, margin + colWidth1 + colWidth2 + colWidth3 + 1, headerY + 8);

  // Row 2: Namn och svets-ID, Bessy anm/Ofelia
  const row2Y = headerY + headerHeight / 2;
  
  // First box - Namn och svets-ID
  doc.rect(margin, row2Y, colWidth1, headerHeight / 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Namn och svets-ID", margin + 1, row2Y + 3);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`${report.welder_name} ${report.welder_id}`, margin + 1, row2Y + 8);

  // Second box - Bessy anm/Ofelia (spans remaining width)
  const remainingWidth = colWidth2 + colWidth3 + colWidth4;
  doc.rect(margin + colWidth1, row2Y, remainingWidth, headerHeight / 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Bessy anm/Ofelia", margin + colWidth1 + 1, row2Y + 3);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(report.bessy_anm_ofelia || "", margin + colWidth1 + 1, row2Y + 8);

  // Company logo in top right if available
  if (logoUrl) {
    try {
      const img = await loadImage(logoUrl);
      doc.addImage(img, "PNG", pageWidth - 55, 12, 45, 18);
    } catch (e) {
      // Skip logo if it fails to load
    }
  }

  // Welding entries table
  const tableHeaders = [
    "Nr",
    "Dat",
    "Bandel-ort-växelnr/spår\nKm+m eller enl",
    "Vxlbild",
    "Före\nmm",
    "Efter\nmm",
    "Temp",
    "Modell",
    "Material",
    "Räl",
    "Typ av arbete",
    "Svetsmetod",
    "Tilläggs-\nmaterial",
    "Batch nr",
    "WPS nr",
  ];

  const tableData = report.welding_entries.map((entry: WeldingEntry) => [
    entry.nr.toString(),
    entry.date,
    entry.location,
    entry.switchImage,
    entry.beforeMm,
    entry.afterMm,
    entry.temp,
    entry.model,
    entry.material,
    entry.rail,
    entry.workType,
    entry.weldingMethod,
    entry.additiveMaterial,
    entry.batchNr,
    entry.wpsNr,
  ]);

  // Add empty rows to fill the table (like original template has ~13 rows)
  const minRows = 13;
  while (tableData.length < minRows) {
    tableData.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
  }

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 46,
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      fillColor: [255, 255, 204], // Yellow background
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 180], // Slightly darker yellow for header
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 6,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 40 },
      3: { cellWidth: 18 },
      4: { cellWidth: 10, halign: "center" },
      5: { cellWidth: 10, halign: "center" },
      6: { cellWidth: 10, halign: "center" },
      7: { cellWidth: 18 },
      8: { cellWidth: 15 },
      9: { cellWidth: 8, halign: "center" },
      10: { cellWidth: 22 },
      11: { cellWidth: 28 },
      12: { cellWidth: 20 },
      13: { cellWidth: 20 },
      14: { cellWidth: 22 },
    },
    alternateRowStyles: {
      fillColor: [255, 255, 204], // Keep same yellow
    },
  });

  // Get Y position after table
  const finalY = (doc as any).lastAutoTable.finalY + 5;

  // Bottom section with three columns
  const bottomY = finalY;
  const bottomColWidth = (pageWidth - margin * 2) / 3;

  // Left column - Egenkontroll
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Egenkontroll:", margin, bottomY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  const checkboxY = bottomY + 5;
  const checks = [
    { label: "ID-märkt svets", checked: report.id_marked_weld },
    { label: "Kontroll av geometri", checked: report.geometry_control },
    { label: "Städat arbetsplats", checked: report.cleaned_workplace },
    { label: "Återställt rälsmängd", checked: report.restored_rail_quantity },
    { label: "Svetsad i kallt klimat", checked: report.welded_in_cold_climate },
    { label: "Säkerställt gasflödet", checked: report.ensured_gas_flow },
    { label: "Skyddad svalning av svetsobjekt", checked: report.protected_cooling },
  ];

  checks.forEach((check, i) => {
    const y = checkboxY + i * 5;
    // Draw checkbox
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y - 3, 4, 4);
    if (check.checked) {
      // Draw checkmark
      doc.setFont("helvetica", "bold");
      doc.text("✓", margin + 0.8, y);
      doc.setFont("helvetica", "normal");
    }
    doc.text(check.label, margin + 6, y);
  });

  // Middle column - Svetsansvarig and Avvikelser
  const middleX = margin + bottomColWidth;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Svetsansvarig:", middleX, bottomY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(report.welding_supervisor || "", middleX, bottomY + 6);
  doc.text(`Telefon nr: ${report.supervisor_phone || ""}`, middleX, bottomY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Avvikelser:", middleX, bottomY + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  if (report.deviations) {
    const splitDeviations = doc.splitTextToSize(report.deviations, bottomColWidth - 5);
    doc.text(splitDeviations, middleX, bottomY + 28);
  }

  // Right column - Kommentarer
  const rightX = margin + bottomColWidth * 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Kommentarer:", rightX, bottomY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  if (report.comments) {
    const splitComments = doc.splitTextToSize(report.comments, bottomColWidth - 5);
    doc.text(splitComments, rightX, bottomY + 6);
  }

  // Draw border around bottom section
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, bottomY - 4, pageWidth - margin * 2, 45);

  // Vertical dividers
  doc.line(middleX - 2, bottomY - 4, middleX - 2, bottomY + 41);
  doc.line(rightX - 2, bottomY - 4, rightX - 2, bottomY + 41);

  // Save
  const fileName = `Svetsrapport_${report.welder_name.replace(/\s+/g, "_")}_${report.report_year}-${String(report.report_month).padStart(2, "0")}.pdf`;
  doc.save(fileName);
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};
