import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GuideButton } from "@/components/GuideButton";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Download, FileText, Pencil, Plus, Trash2, Upload } from "lucide-react";

type DocRow = {
  name: string;
  size: number;
  updated_at?: string | null;
};

type UserOption = {
  id: string | number;
  full_name?: string | null;
  email?: string | null;
  employee_number?: string | null;
};

type CertificateRow = {
  id: string | number;
  user_id: string | number;
  title: string;
  issuer?: string | null;
  certificate_number?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  notes?: string | null;
  file_url?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  employee_number?: string | null;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toISODate = (value?: string | null) => {
  if (!value) return "";
  return value.slice(0, 10);
};

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

const AdminDocuments = () => {
  const { companyId } = useAuth();
  const apiBase = import.meta.env.VITE_API_BASE_URL?.trim() || "";
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docEditing, setDocEditing] = useState<string | null>(null);
  const [docFileName, setDocFileName] = useState("");
  const [docFileData, setDocFileData] = useState("");
  const [docIsBinary, setDocIsBinary] = useState(false);
  const [docDownloadUrl, setDocDownloadUrl] = useState<string | null>(null);
  const [docExtractedText, setDocExtractedText] = useState("");

  const [users, setUsers] = useState<UserOption[]>([]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certEditing, setCertEditing] = useState<CertificateRow | null>(null);
  const [certUserId, setCertUserId] = useState("");
  const [certTitle, setCertTitle] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [certValidFrom, setCertValidFrom] = useState("");
  const [certValidTo, setCertValidTo] = useState("");
  const [certNotes, setCertNotes] = useState("");
  const [certFileName, setCertFileName] = useState("");
  const [certFileData, setCertFileData] = useState("");
  const [certFilterUser, setCertFilterUser] = useState("all");

  const loadDocs = async () => {
    setDocsLoading(true);
    try {
      const data = await apiFetch<DocRow[]>("/admin/tdok-docs");
      setDocs(data || []);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta TDOK-dokument");
    } finally {
      setDocsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiFetch<UserOption[]>("/admin/users?include_inactive=1");
      setUsers(data || []);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta användare");
    }
  };

  const loadCertificates = async () => {
    setCertLoading(true);
    try {
      const params = new URLSearchParams();
      if (certFilterUser !== "all") params.set("user_id", certFilterUser);
      const data = await apiFetch<CertificateRow[]>(`/admin/certificates${params.toString() ? `?${params.toString()}` : ""}`);
      setCertificates(data || []);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte hämta intyg");
    } finally {
      setCertLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
    loadUsers();
    loadCertificates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    loadCertificates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certFilterUser]);

  const resetDocDialog = () => {
    setDocName("");
    setDocContent("");
    setDocEditing(null);
    setDocFileName("");
    setDocFileData("");
    setDocIsBinary(false);
    setDocDownloadUrl(null);
    setDocExtractedText("");
  };

  const openCreateDoc = () => {
    resetDocDialog();
    setDocDialogOpen(true);
  };

  const openEditDoc = async (name: string) => {
    try {
      const data = await apiFetch<{ name: string; content: string; file_url?: string; is_binary?: boolean; extracted_text?: string | null }>(
        `/admin/tdok-docs/${encodeURIComponent(name)}`
      );
      const docNameValue = data?.name || name;
      const isBinary = data?.is_binary || docNameValue.toLowerCase().endsWith(".pdf");
      const downloadUrl = data?.file_url
        ? apiBase
          ? `${apiBase}${data.file_url}`
          : data.file_url
        : apiBase
        ? `${apiBase}/admin/tdok-docs/${encodeURIComponent(docNameValue)}/download`
        : `/admin/tdok-docs/${encodeURIComponent(docNameValue)}/download`;
      setDocName(docNameValue);
      setDocContent(isBinary ? "" : data?.content || "");
      setDocIsBinary(Boolean(isBinary));
      setDocDownloadUrl(isBinary ? downloadUrl : null);
      setDocExtractedText(isBinary ? String(data?.extracted_text || "") : "");
      setDocEditing(name);
      setDocDialogOpen(true);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte läsa dokumentet");
    }
  };

  const handleDocFile = (file?: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf");
    const isText = lower.endsWith(".txt") || lower.endsWith(".md");
    if (!isPdf && !isText) {
      toast.error("Endast .txt, .md eller .pdf tillåts");
      return;
    }
    if (isPdf) {
      const reader = new FileReader();
      reader.onload = () => {
        setDocName(file.name);
        setDocContent("");
        setDocFileName(file.name);
        setDocFileData(String(reader.result || ""));
        setDocIsBinary(true);
        setDocDownloadUrl(null);
        setDocExtractedText("");
      };
      reader.readAsDataURL(file);

      const extractText = async (buffer: ArrayBuffer) => {
        const loadPdfJs = async () => {
          const w = window as any;
          if (w.pdfjsLib) return w.pdfjsLib;
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = PDFJS_CDN;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Kunde inte ladda pdf.js"));
            document.head.appendChild(script);
          });
          if (!w.pdfjsLib) throw new Error("pdfjsLib saknas efter laddning");
          w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
          return w.pdfjsLib;
        };

        const pdfjs = await loadPdfJs();
        const data = new Uint8Array(buffer);
        const loadDoc = async (options: Record<string, any>) => {
          const pdf = await pdfjs.getDocument(options).promise;
          let text = "";
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item: any) => ("str" in item ? item.str : ""))
              .filter(Boolean)
              .join(" ");
            if (pageText) text += `${pageText}\n\n`;
          }
          return text.trim();
        };
        return await loadDoc({ data, disableWorker: true });
      };

      file
        .arrayBuffer()
        .then(async (buffer) => {
          try {
            const cleaned = await extractText(buffer);
            setDocExtractedText(cleaned);
            if (!cleaned) {
              toast.message("PDF sparas, men ingen text kunde extraheras.");
            }
          } catch (err) {
            console.warn("PDF-extrahering misslyckades:", err);
            toast.message("PDF sparas, men text kunde inte extraheras.");
            setDocExtractedText("");
          }
        })
        .catch(() => {
          toast.message("PDF sparas, men text kunde inte extraheras.");
          setDocExtractedText("");
        });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocName(file.name);
      setDocContent(String(reader.result || ""));
      setDocFileName("");
      setDocFileData("");
      setDocIsBinary(false);
      setDocDownloadUrl(null);
      setDocExtractedText("");
    };
    reader.readAsText(file);
  };

  const saveDoc = async () => {
    if (!docName.trim()) {
      toast.error("Ange filnamn");
      return;
    }
    try {
      const isPdf = docName.trim().toLowerCase().endsWith(".pdf");
      if (!docEditing && isPdf && !docFileData) {
        toast.error("Ladda upp en PDF-fil.");
        return;
      }
      if (!docEditing && !isPdf && !docContent.trim()) {
        toast.error("Ange innehåll");
        return;
      }
      const payload: any = {
        new_name: docName.trim(),
      };
      if (isPdf) {
        if (docFileData) {
          payload.content_base64 = docFileData;
          payload.name = docName.trim();
        }
        if (docExtractedText) {
          payload.extracted_text = docExtractedText;
        }
      } else {
        payload.content = docContent;
        payload.name = docName.trim();
      }
      if (docEditing) {
        await apiFetch(`/admin/tdok-docs/${encodeURIComponent(docEditing)}`, { method: "PUT", json: payload });
        toast.success("Dokument uppdaterat");
      } else {
        await apiFetch("/admin/tdok-docs", { method: "POST", json: { ...payload, overwrite: false } });
        toast.success("Dokument tillagt");
      }
      setDocDialogOpen(false);
      resetDocDialog();
      loadDocs();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte spara dokument");
    }
  };

  const deleteDoc = async (name: string) => {
    if (!confirm(`Ta bort ${name}?`)) return;
    try {
      await apiFetch(`/admin/tdok-docs/${encodeURIComponent(name)}`, { method: "DELETE" });
      toast.success("Dokument borttaget");
      loadDocs();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte ta bort dokument");
    }
  };

  const resetCertDialog = () => {
    setCertEditing(null);
    setCertUserId("");
    setCertTitle("");
    setCertIssuer("");
    setCertNumber("");
    setCertValidFrom("");
    setCertValidTo("");
    setCertNotes("");
    setCertFileName("");
    setCertFileData("");
  };

  const openCreateCert = () => {
    resetCertDialog();
    setCertDialogOpen(true);
  };

  const openEditCert = (row: CertificateRow) => {
    setCertEditing(row);
    setCertUserId(String(row.user_id));
    setCertTitle(row.title || "");
    setCertIssuer(row.issuer || "");
    setCertNumber(row.certificate_number || "");
    setCertValidFrom(toISODate(row.valid_from));
    setCertValidTo(toISODate(row.valid_to));
    setCertNotes(row.notes || "");
    setCertFileName("");
    setCertFileData("");
    setCertDialogOpen(true);
  };

  const handleCertFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCertFileName(file.name);
      setCertFileData(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const saveCert = async () => {
    if (!certUserId || !certTitle.trim()) {
      toast.error("Välj anställd och ange titel");
      return;
    }
    const payload: any = {
      user_id: Number(certUserId),
      title: certTitle.trim(),
      issuer: certIssuer.trim() || null,
      certificate_number: certNumber.trim() || null,
      valid_from: certValidFrom || null,
      valid_to: certValidTo || null,
      notes: certNotes.trim() || null,
    };
    if (certFileName && certFileData) {
      payload.filename = certFileName;
      payload.content_base64 = certFileData;
    }
    try {
      if (certEditing) {
        await apiFetch(`/admin/certificates/${certEditing.id}`, { method: "PUT", json: payload });
        toast.success("Intyg uppdaterat");
      } else {
        await apiFetch("/admin/certificates", { method: "POST", json: payload });
        toast.success("Intyg skapat");
      }
      setCertDialogOpen(false);
      resetCertDialog();
      loadCertificates();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte spara intyg");
    }
  };

  const deleteCert = async (row: CertificateRow) => {
    if (!confirm(`Ta bort intyg "${row.title}"?`)) return;
    try {
      await apiFetch(`/admin/certificates/${row.id}`, { method: "DELETE" });
      toast.success("Intyg borttaget");
      loadCertificates();
    } catch (error: any) {
      toast.error(error.message || "Kunde inte ta bort intyg");
    }
  };

  const exportCertificates = async () => {
    try {
      const url = apiBase ? `${apiBase}/admin/certificates/export` : "/admin/certificates/export";
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("opero_token") || localStorage.getItem("access_token") || ""}` },
      });
      if (!response.ok) throw new Error("Export misslyckades");
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `kompetensmatris-${companyId || "company"}.csv`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      toast.error(error.message || "Kunde inte exportera");
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const resolveFileUrl = (fileUrl?: string | null) => {
    if (!fileUrl) return null;
    if (!apiBase || !fileUrl.startsWith("/")) return fileUrl;
    return `${apiBase}${fileUrl}`;
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Dokument</h1>
          <p className="text-muted-foreground">Hantera TDOK-dokument och intyg för kompetensmatris</p>
        </div>
        <GuideButton
          title="Guide: Dokumentation"
          steps={[
            "Lägg upp aktuella TDOK- och styrande dokument.",
            "Använd tydliga filnamn och versioner.",
            "Uppdatera eller ersätt gamla dokument vid förändringar.",
            "Ta bort föråldrade filer för att undvika fel underlag.",
            "Kontrollera att dokumenten går att ladda ner vid behov.",
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                TDOK-dokument
              </CardTitle>
              <CardDescription>Dokument som TDOK AI använder</CardDescription>
            </div>
            <Button onClick={openCreateDoc} className="gap-2">
              <Plus className="h-4 w-4" />
              Lägg till dokument
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="text-muted-foreground">Laddar dokument...</div>
          ) : docs.length === 0 ? (
            <div className="text-muted-foreground">Inga dokument ännu.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>Storlek</TableHead>
                  <TableHead>Uppdaterad</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.name}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>{formatBytes(doc.size)}</TableCell>
                    <TableCell>{doc.updated_at ? doc.updated_at.slice(0, 19).replace("T", " ") : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDoc(doc.name)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Redigera
                        </Button>
                        {doc.name.toLowerCase().endsWith(".pdf") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = apiBase
                                ? `${apiBase}/admin/tdok-docs/${encodeURIComponent(doc.name)}/download`
                                : `/admin/tdok-docs/${encodeURIComponent(doc.name)}/download`;
                              window.open(url, "_blank", "noreferrer");
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Ladda ner
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteDoc(doc.name)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Ta bort
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Intyg och kompetens</CardTitle>
              <CardDescription>Registrera intyg med giltighet för export</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportCertificates} className="gap-2">
                <Download className="h-4 w-4" />
                Exportera Excel (CSV)
              </Button>
              <Button onClick={openCreateCert} className="gap-2">
                <Plus className="h-4 w-4" />
                Lägg till intyg
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Label>Filtrera anställd</Label>
            <Select value={certFilterUser} onValueChange={setCertFilterUser}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.full_name || user.email || `User ${user.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {certLoading ? (
            <div className="text-muted-foreground">Laddar intyg...</div>
          ) : certificates.length === 0 ? (
            <div className="text-muted-foreground">Inga intyg ännu.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anställd</TableHead>
                  <TableHead>Intyg</TableHead>
                  <TableHead>Giltig från</TableHead>
                  <TableHead>Giltig till</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fil</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((row) => {
                  const validTo = toISODate(row.valid_to);
                  const expired = validTo ? validTo < today : false;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.user_name || row.user_email || row.user_id}</div>
                        {row.employee_number && (
                          <div className="text-xs text-muted-foreground">#{row.employee_number}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.title}</div>
                        {row.issuer && <div className="text-xs text-muted-foreground">{row.issuer}</div>}
                      </TableCell>
                      <TableCell>{toISODate(row.valid_from) || "-"}</TableCell>
                      <TableCell>{validTo || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={expired ? "destructive" : "default"}>
                          {expired ? "Utgånget" : "Giltigt"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.file_url ? (
                          <a
                            className="text-sm text-primary underline"
                            href={resolveFileUrl(row.file_url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ladda ner
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditCert(row)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Redigera
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteCert(row)}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Ta bort
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{docEditing ? "Redigera dokument" : "Nytt dokument"}</DialogTitle>
            <DialogDescription>TDOK AI läser .txt/.md. PDF extraheras till text för AI.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Filnamn</Label>
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="tdok.txt" />
            </div>
            <div className="space-y-2">
              <Label>Ladda upp fil (.txt, .md eller .pdf)</Label>
              <Input type="file" accept=".txt,.md,.pdf" onChange={(e) => handleDocFile(e.target.files?.[0])} />
              {docIsBinary && docDownloadUrl && (
                <a className="text-sm text-primary underline" href={docDownloadUrl} target="_blank" rel="noreferrer">
                  Ladda ner aktuell PDF
                </a>
              )}
              {docIsBinary && (
                <p className="text-xs text-muted-foreground">PDF text tolkas automatiskt och sparas som .md för AI.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Innehåll</Label>
              <Textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                rows={12}
                disabled={docIsBinary}
                placeholder={docIsBinary ? "PDF kan inte redigeras här." : ""}
              />
            </div>
            {docIsBinary && (
              <div className="space-y-2">
                <Label>Extraherad text (för AI)</Label>
                <Textarea
                  value={docExtractedText}
                  onChange={(e) => setDocExtractedText(e.target.value)}
                  rows={8}
                  placeholder="Text som AI läser. Du kan justera vid behov."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Ladda upp fil</Label>
              <Input type="file" accept=".txt,.md" onChange={(e) => handleDocFile(e.target.files?.[0])} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={saveDoc} className="gap-2">
              <Upload className="h-4 w-4" />
              {docEditing ? "Spara" : "Lägg till"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{certEditing ? "Redigera intyg" : "Nytt intyg"}</DialogTitle>
            <DialogDescription>Lägg in intyg för kompetensmatrisen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Anställd</Label>
              <Select value={certUserId} onValueChange={setCertUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj anställd" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.full_name || user.email || `User ${user.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input value={certTitle} onChange={(e) => setCertTitle(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Utfärdare</Label>
                <Input value={certIssuer} onChange={(e) => setCertIssuer(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Intygsnummer</Label>
                <Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Giltig från</Label>
                <Input type="date" value={certValidFrom} onChange={(e) => setCertValidFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Giltig till</Label>
                <Input type="date" value={certValidTo} onChange={(e) => setCertValidTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notering</Label>
              <Textarea value={certNotes} onChange={(e) => setCertNotes(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Intygsfil (valfritt)</Label>
              <Input type="file" onChange={(e) => handleCertFile(e.target.files?.[0])} />
              {certEditing?.file_url && !certFileName && (
                <div className="text-xs text-muted-foreground">Nuvarande fil finns sparad.</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={saveCert}>
              {certEditing ? "Spara" : "Lägg till"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDocuments;
