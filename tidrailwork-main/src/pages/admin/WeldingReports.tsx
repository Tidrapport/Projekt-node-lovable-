import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Download, FileText, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { WeldingReport, WeldingEntry } from "@/types/weldingReport";
import { generateWeldingReportPDF } from "@/lib/weldingReportPdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WeldingReportWithProfile extends WeldingReport {
  profiles: {
    full_name: string;
  } | null;
}

const AdminWeldingReports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<WeldingReportWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WeldingReportWithProfile | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [deleteReport, setDeleteReport] = useState<WeldingReportWithProfile | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState("all");
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [filterUser, setFilterUser] = useState("all");

  useEffect(() => {
    fetchReports();
    fetchUsers();
  }, [filterYear, filterMonth, filterUser]);

  const fetchUsers = async () => {
    const data = await apiFetch('/profiles?select=id,full_name&order=full_name');
    if (data) setUsers(ensureArray(data));
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Build query params
      const params: Record<string, string> = { report_year: String(parseInt(filterYear)) };
      if (filterMonth !== 'all') params.report_month = String(parseInt(filterMonth));
      if (filterUser !== 'all') params.user_id = filterUser;

      const qs = new URLSearchParams(params).toString();
      // Request reports with related profile data
      const data = await apiFetch(`/welding_reports?${qs}&include=profiles`);

      const typedData = ensureArray(data).map((report: any) => ({
        ...report,
        welding_entries: report.welding_entries as unknown as WeldingEntry[]
      })) as WeldingReportWithProfile[];

      setReports(typedData);
    } catch (error: any) {
      toast.error("Kunde inte hämta rapporter: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteReport) return;

    try {
      await apiFetch(`/welding_reports/${deleteReport.id}`, { method: 'DELETE' });

      toast.success("Rapport raderad");
      setDeleteReport(null);
      fetchReports();
    } catch (error: any) {
      toast.error("Kunde inte radera: " + error.message);
    }
  };

  const handleDownloadPDF = async (report: WeldingReportWithProfile) => {
    try {
      // Fetch company info
      const company = await apiFetch('/companies');
      const companyObj = ensureArray(company)[0];

      await generateWeldingReportPDF(report, companyObj?.name || "Företag", companyObj?.logo_url);
      toast.success("PDF nedladdad");
    } catch (error: any) {
      toast.error("Kunde inte skapa PDF: " + error.message);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = [
    { value: "all", label: "Alla månader" },
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Mars" },
    { value: "4", label: "April" },
    { value: "5", label: "Maj" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Augusti" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Svetsrapporter</h1>
        <p className="text-muted-foreground">Hantera och ladda ner svetsrapporter</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">År</label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Månad</label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Användare</label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Alla användare" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla användare</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapporter ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Laddar...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga svetsrapporter hittades för vald period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Användare</TableHead>
                  <TableHead>Svetsare</TableHead>
                  <TableHead>Svets-ID</TableHead>
                  <TableHead>Antal rader</TableHead>
                  <TableHead>Kundens Ao nr</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      {format(new Date(report.report_date), "d MMMM yyyy", { locale: sv })}
                    </TableCell>
                    <TableCell>{report.profiles?.full_name || "-"}</TableCell>
                    <TableCell>{report.welder_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{report.welder_id}</Badge>
                    </TableCell>
                    <TableCell>{report.welding_entries.length}</TableCell>
                    <TableCell>{report.customer_ao_number || "-"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedReport(report);
                          setShowDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadPDF(report)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteReport(report)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Svetsrapport - {selectedReport?.welder_name}</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Datum:</span>
                  <p className="font-medium">
                    {format(new Date(selectedReport.report_date), "d MMMM yyyy", { locale: sv })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Svets-ID:</span>
                  <p className="font-medium">{selectedReport.welder_id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Eget Ao nr:</span>
                  <p className="font-medium">{selectedReport.own_ao_number || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Kundens Ao nr:</span>
                  <p className="font-medium">{selectedReport.customer_ao_number || "-"}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Svetsrader ({selectedReport.welding_entries.length})</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nr</TableHead>
                        <TableHead>Plats</TableHead>
                        <TableHead>Arbete</TableHead>
                        <TableHead>Metod</TableHead>
                        <TableHead>Material</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReport.welding_entries.map((entry, i) => (
                        <TableRow key={i}>
                          <TableCell>{entry.nr}</TableCell>
                          <TableCell>{entry.location}</TableCell>
                          <TableCell>{entry.workType}</TableCell>
                          <TableCell>{entry.weldingMethod}</TableCell>
                          <TableCell>{entry.material}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Egenkontroll</h4>
                  <ul className="text-sm space-y-1">
                    <li>{selectedReport.id_marked_weld ? "✓" : "✗"} ID-märkt svets</li>
                    <li>{selectedReport.geometry_control ? "✓" : "✗"} Kontroll av geometri</li>
                    <li>{selectedReport.cleaned_workplace ? "✓" : "✗"} Städat arbetsplats</li>
                    <li>{selectedReport.restored_rail_quantity ? "✓" : "✗"} Återställt rälsmängd</li>
                    <li>{selectedReport.welded_in_cold_climate ? "✓" : "✗"} Svetsad i kallt klimat</li>
                    <li>{selectedReport.ensured_gas_flow ? "✓" : "✗"} Säkerställt gasflödet</li>
                    <li>{selectedReport.protected_cooling ? "✓" : "✗"} Skyddad svalning</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Svetsansvarig</h4>
                  <p className="text-sm">{selectedReport.welding_supervisor || "-"}</p>
                  <p className="text-sm text-muted-foreground">{selectedReport.supervisor_phone || "-"}</p>
                  
                  {selectedReport.deviations && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-1">Avvikelser</h4>
                      <p className="text-sm">{selectedReport.deviations}</p>
                    </div>
                  )}
                  
                  {selectedReport.comments && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-1">Kommentarer</h4>
                      <p className="text-sm">{selectedReport.comments}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleDownloadPDF(selectedReport)}>
                  <Download className="h-4 w-4 mr-2" />
                  Ladda ner PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteReport} onOpenChange={() => setDeleteReport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera svetsrapport?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill radera denna svetsrapport? Detta kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminWeldingReports;
