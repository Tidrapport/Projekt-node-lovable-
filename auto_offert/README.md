Auto_offert - snabbstart

Syfte
- Läs en offert-PDF (`offertny.pdf`), extrahera nyckeldata och fyll en Word-mall (`offertmall.docx`).

Förutsättningar
1) Python 3.8+
2) Installera beroenden i terminalen (VS Code):

```bash
pip install pdfplumber pandas fpdf2 python-docx docxtpl
```

Filstruktur (i repo)
```
auto_offert/
├── offertny.pdf        # placera din PDF här (eller ange sökväg via --pdf)
├── offertmall.docx     # din Word-mall (måste skapas med placeholders)
├── main.py             # scriptet som kör allt
└── output/             # genererade filer hamnar här
```

Hur mall (`offertmall.docx`) ska se ut
- Skapa ett vanligt Word-dokument och skriv variabler inom dubbla måsvingar, t.ex:

```
Offertnummer: {{ offertnr }}
Datum: {{ offertdatum }}
Kund: {{ kundnamn }}
Organisationsnummer: {{ orgnr }}
Summa: {{ summa }} SEK
```

Kör scriptet
```bash
cd auto_offert
python main.py --pdf ../tidrailwork-main/offertny.pdf --template offertmall.docx
```

Output
- En ifylld Word-fil sparas i `auto_offert/output/`.

Notera
- Om du vill generera PDF direkt från Word krävs ett extra steg/verktyg (t.ex. LibreOffice headless eller en betald konverterings-API). Detta script skapar en DOCX som du enkelt kan spara som PDF manuellt eller konvertera automatiskt med ytterligare verktyg.

Behöver du att jag automatiskt skapar `offertmall.docx` åt dig (fyller med exempel-platshållare) eller vill du skapa mallen i Word själv?"}