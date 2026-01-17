# QMS Frontend + UI kit

Detta repository innehåller två nya projekt:

- `ui-kit` — delat komponentpaket (lokal) för att säkerställa pixel‑paritet.
- `qms-frontend` — separat frontend för QMS (exempel med ISO 3834-2 och ISO 9001 kortvy).

Snabba instruktioner för lokal utveckling:

1. Bygg `ui-kit` och installera i `qms-frontend`:

```bash
cd ui-kit
npm install
npm run build

cd ../qms-frontend
npm install
npm run dev
```

2. Kör `tidrailwork-main` devserver (sätt port 5174) om du vill att den körs samtidigt:

```bash
cd tidrailwork-main
# installera om du inte redan gjort
npm install
# starta på port 5174 (sätt PORT enligt ditt env eller i package.json)
# På macOS/zsh:
PORT=5174 npm run dev
```

Notera: `qms-frontend` körs som standard på port 5175.