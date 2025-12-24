import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/api/client";
import { BarChart3, Users, Clock, TrendingUp, Briefcase } from "lucide-react";

interface JobRoleStats {
  job_role_id: string;
  job_role_name: string;
  total_hours: number;
  entry_count: number;
  avg_hours_per_entry: number;
}

interface ProjectStats {
  project_id: string;
  project_name: string;
  total_hours: number;
  entry_count: number;
}

interface UserStats {
  user_id: string;
  user_name: string;
  total_hours: number;
  entry_count: number;
}

interface OverallStats {
  totalHours: number;
  totalEntries: number;
  totalUsers: number;
  avgHoursPerEntry: number;
}

const AdminStatistics = () => {
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalHours: 0,
    totalEntries: 0,
    totalUsers: 0,
    avgHoursPerEntry: 0,
  });
  const [jobRoleStats, setJobRoleStats] = useState<JobRoleStats[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // Hämta tidrapporter via backend-API
      const timeEntries: any[] = await apiFetch("/time-entries").catch(() => []);

      // Calculate overall stats
      const totalHours = timeEntries.reduce((sum, entry) => sum + Number(entry.total_hours || 0), 0);
      const totalEntries = timeEntries.length;
      const uniqueUsers = new Set(timeEntries.map(e => e.user_id)).size;
      const avgHoursPerEntry = totalEntries > 0 ? totalHours / totalEntries : 0;

      setOverallStats({
        totalHours,
        totalEntries,
        totalUsers: uniqueUsers,
        avgHoursPerEntry,
      });

      // Calculate job role stats
      const jobRoleMap = new Map<string, JobRoleStats>();
      timeEntries.forEach(entry => {
        const roleId = entry.job_role_id;
        const roleName = entry.job_role_name || entry.job_role?.name || "Okänd";
        const hours = Number(entry.total_hours || 0);

        if (!jobRoleMap.has(roleId)) {
          jobRoleMap.set(roleId, {
            job_role_id: roleId,
            job_role_name: roleName,
            total_hours: 0,
            entry_count: 0,
            avg_hours_per_entry: 0,
          });
        }

        const stat = jobRoleMap.get(roleId)!;
        stat.total_hours += hours;
        stat.entry_count += 1;
      });

      const jobRoleStatsArray = Array.from(jobRoleMap.values()).map(stat => ({
        ...stat,
        avg_hours_per_entry: stat.entry_count > 0 ? stat.total_hours / stat.entry_count : 0,
      }));
      jobRoleStatsArray.sort((a, b) => b.total_hours - a.total_hours);
      setJobRoleStats(jobRoleStatsArray);

      // Calculate project stats
      const projectMap = new Map<string, ProjectStats>();
      timeEntries.forEach(entry => {
        const projectId = entry.project_id;
        const projectName = entry.project_name || entry.project?.name || "Okänt";
        const hours = Number(entry.total_hours || 0);

        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            project_id: projectId,
            project_name: projectName,
            total_hours: 0,
            entry_count: 0,
          });
        }

        const stat = projectMap.get(projectId)!;
        stat.total_hours += hours;
        stat.entry_count += 1;
      });

      const projectStatsArray = Array.from(projectMap.values());
      projectStatsArray.sort((a, b) => b.total_hours - a.total_hours);
      setProjectStats(projectStatsArray);

      // Calculate user stats
      const userMap = new Map<string, UserStats>();
      timeEntries.forEach(entry => {
        const userId = entry.user_id;
        const userName = entry.user_full_name || entry.profiles?.full_name || "Okänd";
        const hours = Number(entry.total_hours || 0);

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            user_id: userId,
            user_name: userName,
            total_hours: 0,
            entry_count: 0,
          });
        }

        const stat = userMap.get(userId)!;
        stat.total_hours += hours;
        stat.entry_count += 1;
      });

      const userStatsArray = Array.from(userMap.values());
      userStatsArray.sort((a, b) => b.total_hours - a.total_hours);
      setUserStats(userStatsArray);

    } catch (error: any) {
      console.error("Error fetching statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Laddar statistik...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-heading">Statistik</h2>
        <p className="text-muted-foreground">Översikt över rapporterade timmar och aktivitet</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totala timmar</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalHours.toFixed(1)} h</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Antal rapporter</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalEntries}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva användare</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Snitt tim/rapport</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgHoursPerEntry.toFixed(1)} h</div>
          </CardContent>
        </Card>
      </div>

      {/* Job Role Statistics Table */}
      <Card className="mb-6 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Timmar per yrkesroll
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Yrkesroll</TableHead>
                <TableHead className="text-right">Totala timmar</TableHead>
                <TableHead className="text-right">Antal rapporter</TableHead>
                <TableHead className="text-right">Snitt tim/rapport</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobRoleStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Ingen data tillgänglig
                  </TableCell>
                </TableRow>
              ) : (
                jobRoleStats.map((stat) => (
                  <TableRow key={stat.job_role_id}>
                    <TableCell className="font-medium">{stat.job_role_name}</TableCell>
                    <TableCell className="text-right">{stat.total_hours.toFixed(1)} h</TableCell>
                    <TableCell className="text-right">{stat.entry_count}</TableCell>
                    <TableCell className="text-right">{stat.avg_hours_per_entry.toFixed(1)} h</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Statistics Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Timmar per projekt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekt</TableHead>
                  <TableHead className="text-right">Timmar</TableHead>
                  <TableHead className="text-right">Rapporter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Ingen data tillgänglig
                    </TableCell>
                  </TableRow>
                ) : (
                  projectStats.map((stat) => (
                    <TableRow key={stat.project_id}>
                      <TableCell className="font-medium">{stat.project_name}</TableCell>
                      <TableCell className="text-right">{stat.total_hours.toFixed(1)} h</TableCell>
                      <TableCell className="text-right">{stat.entry_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* User Statistics Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Timmar per användare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Användare</TableHead>
                  <TableHead className="text-right">Timmar</TableHead>
                  <TableHead className="text-right">Rapporter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Ingen data tillgänglig
                    </TableCell>
                  </TableRow>
                ) : (
                  userStats.map((stat) => (
                    <TableRow key={stat.user_id}>
                      <TableCell className="font-medium">{stat.user_name}</TableCell>
                      <TableCell className="text-right">{stat.total_hours.toFixed(1)} h</TableCell>
                      <TableCell className="text-right">{stat.entry_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminStatistics;
