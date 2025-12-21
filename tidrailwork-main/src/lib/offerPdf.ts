import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface Customer {
  id: string;
  name: string;
  org_number: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

interface Company {
  name: string;
  org_number: string | null;
  logo_url: string | null;
  billing_email: string | null;
}

interface Offer {
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
}

export const generateOfferPDF = async (
  offer: Offer,
  customer: Customer | null,
  company: Company
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Company logo (top left)
  if (company.logo_url) {
    try {
      const img = await loadImage(company.logo_url);
      doc.addImage(img, "PNG", margin, yPos, 40, 20);
    } catch (e) {
      // Skip logo if it fails to load
    }
  }

  // Company info (top right)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(company.name, pageWidth - margin, yPos, { align: "right" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  let companyInfoY = yPos + 5;
  
  if (company.org_number) {
    doc.text(`Org.nr: ${company.org_number}`, pageWidth - margin, companyInfoY, { align: "right" });
    companyInfoY += 4;
  }
  if (company.billing_email) {
    doc.text(company.billing_email, pageWidth - margin, companyInfoY, { align: "right" });
  }

  yPos = 50;

  // "OFFERT" title
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("OFFERT", margin, yPos);

  // Offer number
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Offertnummer: ${offer.offer_number}`, margin, yPos + 10);
  doc.text(
    `Datum: ${format(new Date(offer.created_at), "d MMMM yyyy", { locale: sv })}`,
    margin,
    yPos + 16
  );
  if (offer.valid_until) {
    doc.text(
      `Giltig t.o.m.: ${format(new Date(offer.valid_until), "d MMMM yyyy", { locale: sv })}`,
      margin,
      yPos + 22
    );
    yPos += 28;
  } else {
    yPos += 22;
  }

  yPos += 10;

  // Customer info box
  if (customer) {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 35, 2, 2, "F");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("KUND", margin + 5, yPos + 6);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(customer.name, margin + 5, yPos + 13);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let customerY = yPos + 19;
    
    if (customer.org_number) {
      doc.text(`Org.nr: ${customer.org_number}`, margin + 5, customerY);
      customerY += 5;
    }
    if (customer.address) {
      doc.text(customer.address, margin + 5, customerY);
      customerY += 5;
    }
    if (customer.postal_code || customer.city) {
      doc.text(`${customer.postal_code || ""} ${customer.city || ""}`.trim(), margin + 5, customerY);
    }
    
    // Contact info on right side
    if (customer.contact_person || customer.contact_email || customer.contact_phone) {
      let contactY = yPos + 13;
      if (customer.contact_person) {
        doc.text(`Kontakt: ${customer.contact_person}`, pageWidth - margin - 5, contactY, { align: "right" });
        contactY += 5;
      }
      if (customer.contact_email) {
        doc.text(customer.contact_email, pageWidth - margin - 5, contactY, { align: "right" });
        contactY += 5;
      }
      if (customer.contact_phone) {
        doc.text(customer.contact_phone, pageWidth - margin - 5, contactY, { align: "right" });
      }
    }
    
    yPos += 42;
  }

  // Offer title and description
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(offer.title, margin, yPos);
  yPos += 8;

  if (offer.description) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const splitDesc = doc.splitTextToSize(offer.description, pageWidth - margin * 2);
    doc.text(splitDesc, margin, yPos);
    yPos += splitDesc.length * 5 + 5;
  }

  yPos += 5;

  // Pricing section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Prissättning", margin, yPos);
  yPos += 8;

  const priceData: string[][] = [];
  let subtotal = 0;

  // Fixed price
  if ((offer.pricing_type === "fixed" || offer.pricing_type === "both") && offer.fixed_price) {
    priceData.push(["Fast pris", `${offer.fixed_price.toLocaleString("sv-SE")} SEK`]);
    subtotal += offer.fixed_price;
  }

  // Hourly rates
  if (offer.pricing_type === "hourly" || offer.pricing_type === "both") {
    if (offer.hourly_rate_day) {
      priceData.push(["Timpris dag", `${offer.hourly_rate_day} SEK/tim`]);
    }
    if (offer.hourly_rate_evening) {
      priceData.push(["Timpris kväll", `${offer.hourly_rate_evening} SEK/tim`]);
    }
    if (offer.hourly_rate_night) {
      priceData.push(["Timpris natt", `${offer.hourly_rate_night} SEK/tim`]);
    }
    if (offer.hourly_rate_weekend) {
      priceData.push(["Timpris helg", `${offer.hourly_rate_weekend} SEK/tim`]);
    }
  }

  if (offer.estimated_hours) {
    priceData.push(["Uppskattat antal timmar", `${offer.estimated_hours} tim`]);
  }

  // Additional costs
  if (offer.travel_rate_per_km) {
    priceData.push(["Reseersättning", `${offer.travel_rate_per_km} SEK/km`]);
  }
  if (offer.per_diem_full) {
    priceData.push(["Hel traktamente", `${offer.per_diem_full} SEK/dag`]);
  }
  if (offer.per_diem_half) {
    priceData.push(["Halv traktamente", `${offer.per_diem_half} SEK/dag`]);
  }

  if (priceData.length > 0) {
    autoTable(doc, {
      body: priceData,
      startY: yPos,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      columnStyles: {
        0: { fontStyle: "normal", cellWidth: 80 },
        1: { fontStyle: "bold", halign: "right" },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  // VAT section (if applicable and fixed price is set)
  if (offer.include_vat && subtotal > 0) {
    const vatAmount = subtotal * 0.25;
    const totalWithVat = subtotal + vatAmount;

    const vatData: string[][] = [
      ["", ""],
      ["Summa exkl. moms", `${subtotal.toLocaleString("sv-SE")} SEK`],
      ["Moms (25%)", `${vatAmount.toLocaleString("sv-SE")} SEK`],
      ["Totalt inkl. moms", `${totalWithVat.toLocaleString("sv-SE")} SEK`],
    ];

    autoTable(doc, {
      body: vatData,
      startY: yPos,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 2,
      },
      columnStyles: {
        0: { fontStyle: "normal", cellWidth: 80 },
        1: { fontStyle: "bold", halign: "right" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.row.index === 3) {
          data.cell.styles.fontSize = 12;
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  } else if (!offer.include_vat && subtotal > 0) {
    // Show note that prices are excluding VAT
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text("Alla priser exklusive moms", margin, yPos);
    doc.setTextColor(0);
    yPos += 10;
  } else {
    yPos += 5;
  }

  // Terms section
  if (offer.terms) {
    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Villkor", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const splitTerms = doc.splitTextToSize(offer.terms, pageWidth - margin * 2);
    doc.text(splitTerms, margin, yPos);
    yPos += splitTerms.length * 5 + 10;
  }

  // Footer with company info
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(company.name, margin, footerY);
  if (company.org_number) {
    doc.text(`Org.nr: ${company.org_number}`, pageWidth / 2, footerY, { align: "center" });
  }
  doc.text(`Offert ${offer.offer_number}`, pageWidth - margin, footerY, { align: "right" });

  // Save
  const fileName = `Offert_${offer.offer_number.replace(/\//g, "-")}_${customer?.name?.replace(/\s+/g, "_") || "kund"}.pdf`;
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
