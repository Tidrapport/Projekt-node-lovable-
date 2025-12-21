/**
 * PAXml Generator for Fortnox Lön Import
 * 
 * This module generates PAXml (Payroll Application XML) format version 2.0
 * for importing salary data into Fortnox Lön.
 * 
 * PAXml is a Swedish standard for payroll data exchange.
 * See: https://www.paxml.se/2.0/paxml.xsd
 */

export interface PAXmlEmployee {
  employeeNumber: string;
  fullName: string;
  entries: PAXmlEntry[];
}

export interface PAXmlEntry {
  date: string;
  fortnoxCode: string;
  hours?: number;
  amount?: number;
  quantity?: number;
  description?: string;
}

export interface PAXmlGeneratorOptions {
  companyName: string;
  organizationNumber?: string;
  periodStart: string;
  periodEnd: string;
  employees: PAXmlEmployee[];
}

/**
 * Generates a PAXml 2.0 document for Fortnox Lön import
 *
 * IMPORTANT:
 * Fortnox-calendar import typically expects either:
 * - tidtransaktioner with <tidkod> (which is an enumerated code set in the spec)
 * - lonetransaktioner with <lonart> (free text, typically numeric löneart)
 *
 * Since our UI asks for Fortnox "lönearter" (e.g. 11, 310, 530), we export everything
 * as lonetransaktioner to stay valid against the PAXml XSD.
 */
export function generatePAXml(options: PAXmlGeneratorOptions): string {
  const { companyName, organizationNumber, periodStart, periodEnd, employees } = options;

  const now = new Date();
  // PAXml XSD defines header/datum as xs:dateTime. Fortnox is often strict here.
  // Use ISO without milliseconds to keep it simple and widely accepted.
  const headerDateTime = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const normalizedOrgNumber = normalizeOrgNumber(organizationNumber);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<paxml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://www.paxml.se/2.0/paxml.xsd">
  <header>
    <format>paxml</format>
    <version>2.0</version>
    <datum>${headerDateTime}</datum>
    ${normalizedOrgNumber ? `<foretagorgnr>${escapeXml(normalizedOrgNumber)}</foretagorgnr>` : ''}
    <foretagnamn>${escapeXml(companyName)}</foretagnamn>
    <programnamn>Tidrapportering</programnamn>
    <info>Period: ${periodStart} - ${periodEnd}</info>
  </header>
  <lonetransaktioner>`;

  // Fortnox is known to be stricter than the XSD in practice and often expects a unique postid.
  let postId = 1;

  for (const employee of employees) {
    if (employee.entries.length === 0) continue;

    for (const entry of employee.entries) {
      const hasHours = entry.hours !== undefined && entry.hours > 0;
      const hasQuantity = entry.quantity !== undefined && entry.quantity > 0;
      const hasAmount = entry.amount !== undefined && entry.amount > 0;

      // We emit one lonetrans per row, prioritizing hours/quantity/amount.
      // (Fortnox-löneart determines how the value is interpreted.)
      if (!hasHours && !hasQuantity && !hasAmount) continue;

      const antal = hasHours ? entry.hours! : hasQuantity ? entry.quantity! : undefined;
      const belopp = hasAmount ? entry.amount! : undefined;

      xml += `
    <lonetrans postid="${postId++}" anstid="${escapeXml(employee.employeeNumber)}">`;

      xml += `
      <lonart>${escapeXml(entry.fortnoxCode)}</lonart>`;

      // datum is xs:date in XSD
      xml += `
      <datum>${entry.date}</datum>`;

      if (antal !== undefined) {
        xml += `
      <antal>${typeof antal === 'number' ? antal.toFixed(2) : antal}</antal>`;
      }

      if (belopp !== undefined) {
        xml += `
      <belopp>${belopp.toFixed(2)}</belopp>`;
      }

      if (entry.description) {
        xml += `
      <kommentar>${escapeXml(entry.description)}</kommentar>`;
      }

      xml += `
    </lonetrans>`;
    }
  }

  xml += `
  </lonetransaktioner>
</paxml>`;

  return xml;
}

/**
 * Normalize Swedish organization numbers to digits-only.
 * PAXml XSD uses a fixed-length string type for this field; Fortnox is fine with digits.
 */
function normalizeOrgNumber(org?: string): string | undefined {
  if (!org) return undefined;
  const digits = org.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Download PAXml file
 */
export function downloadPAXml(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
