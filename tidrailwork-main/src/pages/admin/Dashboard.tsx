import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { toast } from "sonner";
import { 
  FileText, 
  Download, 
  UserPlus, 
  Users, 
  FolderKanban, 
  Briefcase,
  Edit,
  Trash2,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface TimeEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  total_hours: number;
  shift_type: string;
  work_description: string;
  profiles: { full_name: string };
  projects: { name: string };
  subprojects?: { name: string };
  job_roles: { name: string };
}

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalTimeEntries: number;
  totalDeviations: number;
}

const AdminDashboard = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalProjects: 0,
    totalTimeEntries: 0,
    totalDeviations: 0,
  });
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    fetchStats();
    fetchTimeEntries();
  }, [selectedMonth]);

  const fetchStats = async () => {
    const [usersRes, projectsRes, entriesRes, deviationsRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("time_entries").select("id", { count: "exact", head: true }),
      supabase.from("deviation_reports").select("id", { count: "exact", head: true }),
    ]);

    setStats({
      totalUsers: usersRes.count || 0,
      totalProjects: projectsRes.count || 0,
      totalTimeEntries: entriesRes.count || 0,
      totalDeviations: deviationsRes.count || 0,
    });
  };

  const fetchTimeEntries = async () => {
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const { data } = await supabase
      .from("time_entries")
      .select(`
        *,
        profiles!time_entries_user_id_fkey(full_name),
        projects(name),
        subprojects(name),
        job_roles(name)
      `)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });

    if (data) setTimeEntries(data);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserName,
          },
        },
      });

      if (error) throw error;

      toast.success("Användare skapad!");
      setShowNewUserDialog(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      fetchStats();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Tidrapport borttagen");
      fetchTimeEntries();
      fetchStats();
    }
  };

  const exportToPDF = async () => {
    try {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.text("Tidrapporter", 14, 22);
      
      // Add month info
      doc.setFontSize(11);
      doc.text(`Period: ${format(new Date(selectedMonth), "MMMM yyyy", { locale: sv })}`, 14, 30);
      
      // Prepare table data
      const tableData = timeEntries.map((entry) => [
        entry.profiles?.full_name || "-",
        format(new Date(entry.date), "yyyy-MM-dd"),
        entry.start_time,
        entry.end_time,
        entry.total_hours.toFixed(2),
        entry.shift_type,
        entry.projects?.name || "-",
        entry.subprojects?.name || "-",
        entry.job_roles?.name || "-",
        entry.work_description || "-"
      ]);
      
      // Add table
      autoTable(doc, {
        head: [[
          "Namn",
          "Datum",
          "Start",
          "Slut",
          "Timmar",
          "Skift",
          "Projekt",
          "Underprojekt",
          "Roll",
          "Beskrivning"
        ]],
        body: tableData,
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 22 },
          2: { cellWidth: 15 },
          3: { cellWidth: 15 },
          4: { cellWidth: 15 },
          5: { cellWidth: 18 },
          6: { cellWidth: 25 },
          7: { cellWidth: 25 },
          8: { cellWidth: 20 },
          9: { cellWidth: "auto" }
        },
        margin: { left: 14, right: 14 }
      });
      
      // Calculate totals
      const totalHours = timeEntries.reduce((sum, entry) => sum + entry.total_hours, 0);
      
      // Add summary
      const finalY = (doc as any).lastAutoTable.finalY || 35;
      doc.setFontSize(11);
      doc.text(`Totalt antal tidrapporter: ${timeEntries.length}`, 14, finalY + 10);
      doc.text(`Totalt antal timmar: ${totalHours.toFixed(2)}h`, 14, finalY + 17);
      
      // Add footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(
          `Sida ${i} av ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }
      
      // Save PDF
      const fileName = `tidrapporter_${selectedMonth}.pdf`;
      doc.save(fileName);
      toast.success("PDF skapad!");
    } catch (error: any) {
      toast.error("Kunde inte skapa PDF: " + error.message);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-heading">Admin Panel</h2>
        <p className="text-muted-foreground">Hantera system och användare</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Användare</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projekt</p>
                <p className="text-2xl font-bold">{stats.totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tidrapporter</p>
                <p className="text-2xl font-bold">{stats.totalTimeEntries}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avvikelser</p>
                <p className="text-2xl font-bold">{stats.totalDeviations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reports">Tidrapporter</TabsTrigger>
          <TabsTrigger value="manage">Hantera</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Alla Tidrapporter</CardTitle>
                <div className="flex gap-2">
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-48"
                  />
                  <Button onClick={exportToPDF} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Exportera PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {timeEntries.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Inga tidrapporter för vald månad
                  </p>
                ) : (
                  timeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-start p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {entry.profiles?.full_name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(entry.date), "d MMMM yyyy", { locale: sv })}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Tid:</span>{" "}
                            {entry.start_time} - {entry.end_time}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Timmar:</span>{" "}
                            {entry.total_hours.toFixed(2)}h
                          </div>
                          <div>
                            <span className="text-muted-foreground">Projekt:</span>{" "}
                            {entry.projects?.name}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Skift:</span>{" "}
                            {entry.shift_type}
                          </div>
                        </div>
                        {entry.work_description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {entry.work_description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <Button
                  onClick={() => setShowNewUserDialog(true)}
                  className="w-full h-24 bg-gradient-primary"
                  size="lg"
                >
                  <UserPlus className="mr-2 h-5 w-5" />
                  Skapa Ny Användare
                </Button>
              </CardContent>
            </Card>

            <Link to="/admin/users">
              <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <Button
                    variant="outline"
                    className="w-full h-24"
                    size="lg"
                  >
                    <Users className="mr-2 h-5 w-5" />
                    Hantera Användare
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/projects">
              <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <Button
                    variant="outline"
                    className="w-full h-24"
                    size="lg"
                  >
                    <FolderKanban className="mr-2 h-5 w-5" />
                    Hantera Projekt
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/job-roles">
              <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <Button
                    variant="outline"
                    className="w-full h-24"
                    size="lg"
                  >
                    <Briefcase className="mr-2 h-5 w-5" />
                    Hantera Yrkesroller
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </TabsContent>
      </Tabs>

      {/* New User Dialog */}
      <Dialog open={showNewUserDialog} onOpenChange={setShowNewUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa Ny Användare</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Fullständigt namn</Label>
              <Input
                id="name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Minst 6 tecken"
                required
                minLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewUserDialog(false)}
              >
                Avbryt
              </Button>
              <Button type="submit" className="bg-gradient-primary" disabled={loading}>
                {loading ? "Skapar..." : "Skapa användare"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
