import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Save, FileText } from "lucide-react";
import { WeldingEntry, WORK_TYPES, WELDING_METHODS, RAIL_TYPES, MATERIAL_TYPES } from "@/types/weldingReport";
import { format } from "date-fns";

const WeldingReport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; company_id: string | null } | null>(null);

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

  const addEntry = () => {
    const newEntry: WeldingEntry = {
      nr: entries.length + 1,
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
    };
    setEntries([...entries, newEntry]);
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
          <div className="overflow-x-auto">
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
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center text-muted-foreground py-8">
                      Inga svetsrader tillagda. Klicka "Lägg till rad" för att börja.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{entry.nr}</TableCell>
                      <TableCell>
                        <Input
                          value={entry.date}
                          onChange={(e) => updateEntry(index, "date", e.target.value)}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.location}
                          onChange={(e) => updateEntry(index, "location", e.target.value)}
                          className="min-w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.switchImage}
                          onChange={(e) => updateEntry(index, "switchImage", e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.beforeMm}
                          onChange={(e) => updateEntry(index, "beforeMm", e.target.value)}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.afterMm}
                          onChange={(e) => updateEntry(index, "afterMm", e.target.value)}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.temp}
                          onChange={(e) => updateEntry(index, "temp", e.target.value)}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.model}
                          onChange={(e) => updateEntry(index, "model", e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={entry.material}
                          onValueChange={(v) => updateEntry(index, "material", v)}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue placeholder="Välj" />
                          </SelectTrigger>
                          <SelectContent>
                            {MATERIAL_TYPES.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={entry.rail}
                          onValueChange={(v) => updateEntry(index, "rail", v)}
                        >
                          <SelectTrigger className="w-14">
                            <SelectValue placeholder="Välj" />
                          </SelectTrigger>
                          <SelectContent>
                            {RAIL_TYPES.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={entry.workType}
                          onValueChange={(v) => updateEntry(index, "workType", v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Välj" />
                          </SelectTrigger>
                          <SelectContent>
                            {WORK_TYPES.map((w) => (
                              <SelectItem key={w} value={w}>{w}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={entry.weldingMethod}
                          onValueChange={(v) => updateEntry(index, "weldingMethod", v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Välj" />
                          </SelectTrigger>
                          <SelectContent>
                            {WELDING_METHODS.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.additiveMaterial}
                          onChange={(e) => updateEntry(index, "additiveMaterial", e.target.value)}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.batchNr}
                          onChange={(e) => updateEntry(index, "batchNr", e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.wpsNr}
                          onChange={(e) => updateEntry(index, "wpsNr", e.target.value)}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEntry(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
            <Textarea
              value={deviations}
              onChange={(e) => setDeviations(e.target.value)}
              placeholder="Beskriv eventuella avvikelser"
              rows={3}
            />
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
    </div>
  );
};

export default WeldingReport;
