#!/usr/bin/env python3
"""
Auto-offert: extrahera data från `offertny.pdf` och fyll en Word-mall `offertmall.docx`.
Krav: pdfplumber, docxtpl
Installera: pip install pdfplumber docxtpl
Kör: python main.py --pdf ../tidrailwork-main/offertny.pdf --template offertmall.docx
"""
import re
import os
import argparse
from pathlib import Path

try:
    import pdfplumber
    from docxtpl import DocxTemplate
except Exception as e:
    print("Saknade beroenden. Kör: pip install pdfplumber docxtpl")
    raise


def extract_text_from_pdf(path: str) -> str:
    text_parts = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            t = p.extract_text()
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def find_first(regex, text, flags=0):
    if not text:
        return ""
    m = re.search(regex, text, flags)
    return m.group(1).strip() if m else ""


def parse_offer_text(text: str) -> dict:
    # Dessa regex: justera vid behov beroende på din offert-layout
    data = {}
    data["kundnamn"] = find_first(r"(?m)^Kund[:\s]*([^\n]+)", text) or find_first(r"(?m)^Offert\s*\n([A-Za-z0-9\s,\.\&:\-]+)", text)
    data["offertnr"] = find_first(r"Offert(?:nr|nummer)?\s*[:\s]*([A-Za-z0-9_-]+)", text) or find_first(r"Offertnr\s*([0-9-]+)", text)
    data["offertdatum"] = find_first(r"(\d{4}-\d{2}-\d{2})", text)
    data["orgnr"] = find_first(r"Organisationsnr\.?\s*[:\s]*([0-9\- ]{10,15})", text)
    # Totalt / summa - försök hitta närliggande "Totalt" eller "Offertvärde" följt av ett nummer
    data["summa"] = find_first(r"(?:Totalt|Offertv[aä]rde|Summa)[:\s\n]*([0-9\s\.,]+)\s*SEK?", text, re.IGNORECASE)
    if not data["summa"]:
        data["summa"] = find_first(r"(?:Totalt|Summa|Offertv[aä]rde)[:\s]*([0-9\.,]+)", text, re.IGNORECASE)
    # Sanitize summa (decimal comma -> dot)
    if data["summa"]:
        data["summa"] = data["summa"].replace(" ", "").replace("\u00A0", "")
        data["summa"] = data["summa"].replace(",", ".")
    return data


def fill_docx(template_path: str, out_path: str, context: dict):
    doc = DocxTemplate(template_path)
    doc.render(context)
    doc.save(out_path)


def main():
    p = argparse.ArgumentParser(description="Fyll offertmall från offertny.pdf")
    p.add_argument("--pdf", default="offertny.pdf", help="Sökväg till offert PDF")
    p.add_argument("--template", default="offertmall.docx", help="Sökväg till DOCX-mall (docxtpl)")
    p.add_argument("--outdir", default="output", help="Output-mapp")
    args = p.parse_args()

    pdf_path = Path(args.pdf)
    template = Path(args.template)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    if not pdf_path.exists():
        print(f"PDF hittas inte: {pdf_path.resolve()}")
        return
    if not template.exists():
        print(f"Mallfil hittas inte: {template.resolve()}. Skapa `offertmall.docx` enligt README.")
        return

    print("Läser PDF...")
    text = extract_text_from_pdf(str(pdf_path))
    data = parse_offer_text(text)

    # Fyll in tomma fält med fallback
    data.setdefault("kundnamn", "")
    data.setdefault("offertnr", "")
    data.setdefault("offertdatum", "")
    data.setdefault("orgnr", "")
    data.setdefault("summa", "")

    out_name = f"fardig_offert_{data.get('offertnr') or 'unnamed'}.docx"
    out_path = outdir / out_name

    print("Fyller mall...")
    try:
        fill_docx(str(template), str(out_path), data)
        print(f"✅ Färdig offert skapad: {out_path.resolve()}")
    except Exception as e:
        print("Kunde inte fylla mallen:", e)


if __name__ == '__main__':
    main()
