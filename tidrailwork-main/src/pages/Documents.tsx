import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { toast } from "sonner";
import { FileText, ExternalLink } from "lucide-react";

type CertificateRow = {
  id: string | number;
  title: string;
  issuer?: string | null;
  certificate_number?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  notes?: string | null;
  view_url?: string | null;
  updated_at?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return value.slice(0, 10);
};

const Documents = () => {
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CertificateRow[]>("/certificates");
      setCertificates(ensureArray<CertificateRow>(data));
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta intyg");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const openCertificate = (row: CertificateRow) => {
    if (!row.view_url) {
      toast.error("Ingen fil kopplad till intyget.");
      return;
    }
    window.open(row.view_url, "_blank", "noreferrer");
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Dokument & intyg
        </h1>
        <p className="text-muted-foreground">
          Här ser du dina intyg och certifikat. Öppning sker i nytt fönster utan nedladdningsknapp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intyg & kompetenser</CardTitle>
          <CardDescription>Kontakta admin om något saknas eller behöver uppdateras.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Laddar intyg...</div>
          ) : certificates.length === 0 ? (
            <div className="text-muted-foreground">Inga intyg registrerade ännu.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intyg</TableHead>
                  <TableHead>Utfärdare</TableHead>
                  <TableHead>Intygsnummer</TableHead>
                  <TableHead>Giltig från</TableHead>
                  <TableHead>Giltig till</TableHead>
                  <TableHead className="text-right">Öppna</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.issuer || "-"}</TableCell>
                    <TableCell>{row.certificate_number || "-"}</TableCell>
                    <TableCell>{formatDate(row.valid_from)}</TableCell>
                    <TableCell>{formatDate(row.valid_to)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCertificate(row)}
                        disabled={!row.view_url}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Öppna
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Documents;
