import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";
import { getMe } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Save, FileText } from "lucide-react";
import { WeldingEntry, WeldingReport, WORK_TYPES, WELDING_METHODS, RAIL_TYPES, MATERIAL_TYPES } from "@/types/weldingReport";
import { format } from "date-fns";

const WPS_OPTIONS = ["2014:0664"];
const ADDITIVE_MATERIAL_OPTIONS = [
  "SKV Z90",
  "SKV Z120",
  "SKV Z140",
  "Oerlikon citorail",
  "Castoline 3205",
  "OK 83.27",
  "OK 83.28",
  "OK 83.29",
  "OK 74.78",
  "OK 68.82",
  "OK 55.00",
  "OK 48.00",
  "OK 48.30",
  "OK 38.65",
  "OK 15.43",
  "OK 15.65",
  "PLA std D",
  "PLA HT",
];
const MODEL_OPTIONS = [
  "60 E1",
  "50 E3",
  "54 E3",
  "49 E1",
  "SJ 43",
  "SJ 41",
  "SJ 32",
  "Gatu 56",
  "Kranräl",
];
const BEFORE_MM_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i));
const AFTER_MM_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 20));
const TEMP_OPTIONS = Array.from({ length: 56 }, (_, i) => String(i - 10));

const WeldingReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; company_id: string | null } | null>(null);
  const [reports, setReports] = useState<WeldingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WeldingReport | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [appendEntries, setAppendEntries] = useState<WeldingEntry[]>([]);

  // Form state
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ownAoNumber, setOwnAoNumber] = useState("");
  const [customerAoNumber, setCustomerAoNumber] = useState("");
  const [welderName, setWelderName] = useState("");
  const [welderId, setWelderId] = useState("");
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [bessyAnmOfelia, setBessyAnmOfelia] = useState("");

  // Welding entries
  const [entries, setEntries] = useState<WeldingEntry[]>([]);

  // Self-control checklist
  const [idMarkedWeld, setIdMarkedWeld] = useState(false);
  const [geometryControl, setGeometryControl] = useState(false);
  const [cleanedWorkplace, setCleanedWorkplace] = useState(false);
  const [restoredRailQuantity, setRestoredRailQuantity] = useState(false);
  const [weldedInColdClimate, setWeldedInColdClimate] = useState(false);
  const [ensuredGasFlow, setEnsuredGasFlow] = useState(false);
  const [protectedCooling, setProtectedCooling] = useState(false);

  // Responsible and notes
  const [weldingSupervisor, setWeldingSupervisor] = useState("");
  const [supervisorPhone, setSupervisorPhone] = useState("");
  const [deviations, setDeviations] = useState("");
  const [comments, setComments] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const me = await getMe();
        const profileData = { full_name: me.user?.full_name, company_id: me.user?.company_id };
        setProfile(profileData as any);
        setWelderName(profileData.full_name || "");
      } catch (err) {
        // ignore
      }
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchReports = async () => {
      setReportsLoading(true);
      try {
        const data = await apiFetch<WeldingReport[]>("/welding_reports");
        setReports(data || []);
      } catch (err: any) {
        toast.error(err.message || "Kunde inte hämta svetsrapporter");
      } finally {
        setReportsLoading(false);
      }
    };
    fetchReports();
  }, [user]);

  const createEmptyEntry = (nr: number): WeldingEntry => ({
    nr,
    date: format(new Date(), "dd"),
    location: "",
    switchImage: "",
    beforeMm: "",
    afterMm: "",
    temp: "",
    model: "",
    material: "",
    rail: "",
    workType: "",
    weldingMethod: "",
    additiveMaterial: "",
    batchNr: "",
    wpsNr: "",
  });

  const addEntry = () => {
    setEntries((prev) => [...prev, createEmptyEntry(prev.length + 1)]);
  };

  const updateEntry = (index: number, field: keyof WeldingEntry, value: string | number) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const removeEntry = (index: number) => {
    const updated = entries.filter((_, i) => i !== index);
    // Renumber entries
    updated.forEach((entry, i) => {
      entry.nr = i + 1;
    });
    setEntries(updated);
  };

  const addAppendEntry = () => {
    setAppendEntries((prev) => [...prev, createEmptyEntry(prev.length + 1)]);
  };

  const updateAppendEntry = (index: number, field: keyof WeldingEntry, value: string | number) => {
    const updated = [...appendEntries];
    updated[index] = { ...updated[index], [field]: value };
    setAppendEntries(updated);
  };

  const removeAppendEntry = (index: number) => {
    const updated = appendEntries.filter((_, i) => i !== index);
    updated.forEach((entry, i) => {
      entry.nr = i + 1;
    });
    setAppendEntries(updated);
  };

  const openAddEntriesDialog = (report: WeldingReport) => {
    setSelectedReport(report);
    setAppendEntries([createEmptyEntry(1)]);
    setShowAddDialog(true);
  };

  const handleAppendEntries = async () => {
    if (!selectedReport) return;
    if (appendEntries.length === 0) {
      toast.error("Lägg till minst en svetsrad");
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/welding_reports/${selectedReport.id}/entries`, {
        method: "POST",
        json: { welding_entries: appendEntries },
      });
      toast.success("Svetsrader tillagda");
      setShowAddDialog(false);
      setAppendEntries([]);
      setSelectedReport(null);
      const data = await apiFetch<WeldingReport[]>("/welding_reports");
      setReports(data || []);
    } catch (error: any) {
      toast.error("Kunde inte uppdatera: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatReportDate = (report: WeldingReport) => {
    if (report.report_date) return report.report_date;
    if (report.report_year && report.report_month) {
      return `${report.report_year}-${String(report.report_month).padStart(2, "0")}`;
    }
    return "Okänt datum";
  };

  const renderEntriesTable = (
    tableEntries: WeldingEntry[],
    onUpdate: (index: number, field: keyof WeldingEntry, value: string | number) => void,
    onRemove: (index: number) => void,
    emptyText: string
  ) => (
    <div className="overflow-x-auto">
      <datalist id="wps-options">
        {WPS_OPTIONS.map((wps) => (
          <option key={wps} value={wps} />
        ))}
      </datalist>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Nr</TableHead>
            <TableHead className="w-16">Dat</TableHead>
            <TableHead>Bandel-ort-växelnr/spår</TableHead>
            <TableHead>Vxlbild</TableHead>
            <TableHead className="w-16">Före mm</TableHead>
            <TableHead className="w-16">Efter mm</TableHead>
            <TableHead className="w-16">Temp</TableHead>
            <TableHead>Modell</TableHead>
            <TableHead>Material</TableHead>
            <TableHead className="w-12">Räl</TableHead>
            <TableHead>Typ av arbete</TableHead>
            <TableHead>Svetsmetod</TableHead>
            <TableHead>Tilläggsmaterial</TableHead>
            <TableHead>Batch nr</TableHead>
            <TableHead>WPS nr</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableEntries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={16} className="text-center text-muted-foreground py-8">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            tableEntries.map((entry, index) => (
              <TableRow key={index}>
                <TableCell>{entry.nr}</TableCell>
                <TableCell>
                  <Input
                    value={entry.date}
                    onChange={(e) => onUpdate(index, "date", e.target.value)}
                    className="w-16"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={entry.location}
                    onChange={(e) => onUpdate(index, "location", e.target.value)}
                    className="min-w-[150px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={entry.switchImage}
                    onChange={(e) => onUpdate(index, "switchImage", e.target.value)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Select value={entry.beforeMm} onValueChange={(v) => onUpdate(index, "beforeMm", v)}>
                    <SelectTrigger className="w-16">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {BEFORE_MM_OPTIONS.map((mm) => (
                        <SelectItem key={mm} value={mm}>
                          {mm}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={entry.afterMm} onValueChange={(v) => onUpdate(index, "afterMm", v)}>
                    <SelectTrigger className="w-16">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {AFTER_MM_OPTIONS.map((mm) => (
                        <SelectItem key={mm} value={mm}>
                          {mm}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={entry.temp} onValueChange={(v) => onUpdate(index, "temp", v)}>
                    <SelectTrigger className="w-16">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMP_OPTIONS.map((temp) => (
                        <SelectItem key={temp} value={temp}>
                          {temp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={entry.model} onValueChange={(v) => onUpdate(index, "model", v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={entry.material} onValueChange={(v) => onUpdate(index, "material", v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_TYPES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={entry.rail} onValueChange={(v) => onUpdate(index, "rail", v)}>
                    <SelectTrigger className="w-14">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {RAIL_TYPES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={entry.workType} onValueChange={(v) => onUpdate(index, "workType", v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_TYPES.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={entry.weldingMethod} onValueChange={(v) => onUpdate(index, "weldingMethod", v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {WELDING_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={entry.additiveMaterial}
                    onValueChange={(v) => onUpdate(index, "additiveMaterial", v)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADDITIVE_MATERIAL_OPTIONS.map((material) => (
                        <SelectItem key={material} value={material}>
                          {material}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={entry.batchNr}
                    onChange={(e) => onUpdate(index, "batchNr", e.target.value)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={entry.wpsNr}
                    onChange={(e) => onUpdate(index, "wpsNr", e.target.value)}
                    list="wps-options"
                    className="w-28"
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => onRemove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  const handleSubmit = async () => {
    if (!user || !profile) {
      toast.error("Du måste vara inloggad");
      return;
    }

    if (!welderName || !welderId) {
      toast.error("Fyll i svetsarens namn och ID");
      return;
    }

    if (entries.length === 0) {
      toast.error("Lägg till minst en svetsrad");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/welding-reports", {
        method: "POST",
        json: {
          user_id: user.id,
          company_id: profile.company_id,
          report_date: reportDate,
          own_ao_number: ownAoNumber || null,
          customer_ao_number: customerAoNumber || null,
          welder_name: welderName,
          welder_id: welderId,
          report_year: reportYear,
          report_month: reportMonth,
          bessy_anm_ofelia: bessyAnmOfelia || null,
          welding_entries: entries,
          id_marked_weld: idMarkedWeld,
          geometry_control: geometryControl,
          cleaned_workplace: cleanedWorkplace,
          restored_rail_quantity: restoredRailQuantity,
          welded_in_cold_climate: weldedInColdClimate,
          ensured_gas_flow: ensuredGasFlow,
          protected_cooling: protectedCooling,
          welding_supervisor: weldingSupervisor || null,
          supervisor_phone: supervisorPhone || null,
          deviations: deviations || null,
          comments: comments || null,
        },
      });

      toast.success("Svetsrapport sparad");
      // Reset form
      setEntries([]);
      setDeviations("");
      setComments("");
      const data = await apiFetch<WeldingReport[]>("/welding_reports");
      setReports(data || []);
    } catch (error: any) {
      toast.error("Kunde inte spara: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Svetsrapport</h1>
          <p className="text-muted-foreground">Trafikverket TMALL 0435</p>
        </div>
        <Button onClick={handleSubmit} disabled={loading} className="self-start sm:self-auto">
          <Save className="h-4 w-4 mr-2" />
          Spara rapport
        </Button>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Mina svetsrapporter
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <p className="text-sm text-muted-foreground">Laddar...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga svetsrapporter ännu.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{formatReportDate(report)}</div>
                    <div className="text-xs text-muted-foreground">
                      AO: {report.own_ao_number || "-"} | Kund AO: {report.customer_ao_number || "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Svetsrader: {report.welding_entries?.length || 0}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openAddEntriesDialog(report)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Lägg till svetsrader
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header info */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Grunduppgifter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Rapportdatum</Label>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Eget Ao nr</Label>
            <Input
              value={ownAoNumber}
              onChange={(e) => setOwnAoNumber(e.target.value)}
              placeholder="Eget arbetsordernummer"
            />
          </div>
          <div className="space-y-2">
            <Label>Kundens Ao nr</Label>
            <Input
              value={customerAoNumber}
              onChange={(e) => setCustomerAoNumber(e.target.value)}
              placeholder="Kundens arbetsordernummer"
            />
          </div>
          <div className="space-y-2">
            <Label>Bessy anm/Ofelia</Label>
            <Input
              value={bessyAnmOfelia}
              onChange={(e) => setBessyAnmOfelia(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Svetsarens namn</Label>
            <Input
              value={welderName}
              onChange={(e) => setWelderName(e.target.value)}
              placeholder="Namn"
            />
          </div>
          <div className="space-y-2">
            <Label>Svets-ID</Label>
            <Input
              value={welderId}
              onChange={(e) => setWelderId(e.target.value)}
              placeholder="T.ex. E47"
            />
          </div>
          <div className="space-y-2">
            <Label>År</Label>
            <Input
              type="number"
              value={reportYear}
              onChange={(e) => setReportYear(parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Månad</Label>
            <Select value={reportMonth.toString()} onValueChange={(v) => setReportMonth(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Welding entries table */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Svetsrader</CardTitle>
          <Button onClick={addEntry} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Lägg till rad
          </Button>
        </CardHeader>
        <CardContent>
          {renderEntriesTable(
            entries,
            updateEntry,
            removeEntry,
            'Inga svetsrader tillagda. Klicka "Lägg till rad" för att börja.'
          )}
        </CardContent>
      </Card>

      {/* Self-control checklist */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Egenkontroll</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="idMarked"
              checked={idMarkedWeld}
              onCheckedChange={(c) => setIdMarkedWeld(c === true)}
            />
            <Label htmlFor="idMarked">ID-märkt svets</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="geometry"
              checked={geometryControl}
              onCheckedChange={(c) => setGeometryControl(c === true)}
            />
            <Label htmlFor="geometry">Kontroll av geometri</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="cleaned"
              checked={cleanedWorkplace}
              onCheckedChange={(c) => setCleanedWorkplace(c === true)}
            />
            <Label htmlFor="cleaned">Städat arbetsplats</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="restored"
              checked={restoredRailQuantity}
              onCheckedChange={(c) => setRestoredRailQuantity(c === true)}
            />
            <Label htmlFor="restored">Återställt rälsmängd</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="cold"
              checked={weldedInColdClimate}
              onCheckedChange={(c) => setWeldedInColdClimate(c === true)}
            />
            <Label htmlFor="cold">Svetsad i kallt klimat</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="gas"
              checked={ensuredGasFlow}
              onCheckedChange={(c) => setEnsuredGasFlow(c === true)}
            />
            <Label htmlFor="gas">Säkerställt gasflödet</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="cooling"
              checked={protectedCooling}
              onCheckedChange={(c) => setProtectedCooling(c === true)}
            />
            <Label htmlFor="cooling">Skyddad svalning av svetsobjekt</Label>
          </div>
        </CardContent>
      </Card>

      {/* Responsible and notes */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Svetsansvarig & Anteckningar</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Svetsansvarig</Label>
            <Input
              value={weldingSupervisor}
              onChange={(e) => setWeldingSupervisor(e.target.value)}
              placeholder="Namn på svetsansvarig"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefon nr</Label>
            <Input
              value={supervisorPhone}
              onChange={(e) => setSupervisorPhone(e.target.value)}
              placeholder="Telefonnummer"
            />
          </div>
          <div className="space-y-2">
            <Label>Avvikelser</Label>
            <Select
              value={deviations}
              onValueChange={(v) => setDeviations(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj avvikelse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Solkurva">Solkurva</SelectItem>
                <SelectItem value="Räl höjdsliten">Räl höjdsliten</SelectItem>
                <SelectItem value="Räl sidosliten">Räl sidosliten</SelectItem>
                <SelectItem value="Isolerskarv sliten">Isolerskarv sliten</SelectItem>
                <SelectItem value="Sliprar dåliga">Sliprar dåliga</SelectItem>
                <SelectItem value="Befästningar, dåliga">Befästningar, dåliga</SelectItem>
                <SelectItem value="Befästningar, mellanlägg slitna (gummi)">Befästningar, mellanlägg slitna (gummi)</SelectItem>
                <SelectItem value="Befästningar, isolatorer slitna (plast)">Befästningar, isolatorer slitna (plast)</SelectItem>
                <SelectItem value="Spår ostoppad">Spår ostoppad</SelectItem>
                <SelectItem value="Korsning ostoppad">Korsning ostoppad</SelectItem>
                <SelectItem value="Växel ostoppad">Växel ostoppad</SelectItem>
                <SelectItem value="Ballast saknas">Ballast saknas</SelectItem>
                <SelectItem value="Ballast dålig">Ballast dålig</SelectItem>
                <SelectItem value="Spårvidd stor">Spårvidd stor</SelectItem>
                <SelectItem value="Spårvidd liten">Spårvidd liten</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kommentarer</Label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Övriga kommentarer"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            setSelectedReport(null);
            setAppendEntries([]);
          }
        }}
      >
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              Lägg till svetsrader {selectedReport ? `(${formatReportDate(selectedReport)})` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button onClick={addAppendEntry} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Lägg till rad
              </Button>
              <Button onClick={handleAppendEntries} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Spara rader
              </Button>
            </div>
            {renderEntriesTable(
              appendEntries,
              updateAppendEntry,
              removeAppendEntry,
              "Inga nya svetsrader. Klicka 'Lägg till rad' för att börja."
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeldingReport;
