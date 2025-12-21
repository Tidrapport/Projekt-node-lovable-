import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, Briefcase, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { format, startOfMonth, startOfWeek, endOfWeek, endOfMonth } from "date-fns";
import { calculateOBDistribution } from "@/lib/obDistribution";

const Dashboard = () => {
  const { effectiveUserId, isImpersonating, impersonatedUserName } = useEffectiveUser();
  const [stats, setStats] = useState({
    todayHours: 0,
    weekHours: 0,
    monthHours: 0,
    openDeviations: 0,
  });

  const [hourlyWage, setHourlyWage] = useState<number>(0);
  const [obMultipliers, setObMultipliers] = useState({
    day: 1.0,
    evening: 1.29,
    night: 1.63,
    weekend: 2.13,
  });

  const [shiftStats, setShiftStats] = useState({
    day: 0,
    evening: 0,
    night: 0,
    weekend: 0,
    total: 0,
    overtimeWeekday: 0,
    overtimeWeekend: 0,
    travelCompensation: 0,
    savedTravelCompensation: 0,
    perDiemCompensation: 0,
    perDiemDays: 0,
  });

  useEffect(() => {
    if (!effectiveUserId) return;

    const fetchStats = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      // Fetch user profile with hourly wage
      const profileData = await apiFetch(`/profiles/${effectiveUserId}`);
      if (profileData) setHourlyWage(profileData.hourly_wage || 0);

      // Fetch OB multipliers
      const obData = await apiFetch(`/shift_types_config`);
      if (obData) {
        const multipliers = {
          day: obData.find((o: any) => o.shift_type === "day")?.multiplier || 1.0,
          evening: obData.find((o: any) => o.shift_type === "evening")?.multiplier || 1.29,
          night: obData.find((o: any) => o.shift_type === "night")?.multiplier || 1.63,
          weekend: obData.find((o: any) => o.shift_type === "weekend")?.multiplier || 2.13,
        };
        setObMultipliers(multipliers);
      }

      // Get today's hours
      const todayData = await apiFetch(`/time-entries?user_id=${effectiveUserId}&date=${today}`);

      // Get week hours
      const weekData = await apiFetch(`/time-entries?user_id=${effectiveUserId}&gte=${weekStart}&lte=${weekEnd}`);

      // Get month hours
      const monthData = await apiFetch(`/time-entries?user_id=${effectiveUserId}&gte=${monthStart}&lte=${monthEnd}`);

      // Get open deviations
      const deviationsData = await apiFetch(`/deviation-reports?user_id=${effectiveUserId}&status=open`);
      const count = deviationsData?.length || 0;

      // Get current month time entries with detailed time information (to match monthHours and SalaryOverview)
      const allTimeEntries = await apiFetch(`/time-entries?user_id=${effectiveUserId}&gte=${monthStart}&lte=${monthEnd}`);

      // Calculate shift type distribution, travel compensation, and per diem
      const shiftTotals = {
        day: 0,
        evening: 0,
        night: 0,
        weekend: 0,
        total: 0,
        overtimeWeekday: 0,
        overtimeWeekend: 0,
      };

      let totalTravelCompensation = 0;
      let savedTravelCompensation = 0;
      let totalPerDiemCompensation = 0;
      
      // Track per diem by date (max one per day)
      const perDiemByDate: Record<string, string> = {};

      allTimeEntries?.forEach((entry) => {
        const distribution = calculateOBDistribution(
          entry.date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes || 0
        );

        const overtimeWeekend = (entry as any).overtime_weekend_hours || 0;
        const overtimeWeekday = (entry as any).overtime_weekday_hours || 0;

        // Subtract overtime weekend hours from weekend OB
        const adjustedWeekend = Math.max(0, distribution.weekend - overtimeWeekend);
        
        // Subtract overtime weekday hours from day/evening/night proportionally
        const weekdayTotal = distribution.day + distribution.evening + distribution.night;
        let adjustedDay = distribution.day;
        let adjustedEvening = distribution.evening;
        let adjustedNight = distribution.night;
        
        if (weekdayTotal > 0 && overtimeWeekday > 0) {
          const ratio = Math.max(0, (weekdayTotal - overtimeWeekday)) / weekdayTotal;
          adjustedDay = distribution.day * ratio;
          adjustedEvening = distribution.evening * ratio;
          adjustedNight = distribution.night * ratio;
        }

        shiftTotals.day += adjustedDay;
        shiftTotals.evening += adjustedEvening;
        shiftTotals.night += adjustedNight;
        shiftTotals.weekend += adjustedWeekend;
        shiftTotals.total += adjustedDay + adjustedEvening + adjustedNight + adjustedWeekend;

        // Calculate travel compensation at 170 SEK/hour (split saved vs paid)
        if (entry.travel_time_hours) {
          const amount = entry.travel_time_hours * 170;
          if ((entry as any).save_travel_compensation) {
            savedTravelCompensation += amount;
          } else {
            totalTravelCompensation += amount;
          }
        }

        // Calculate overtime
        shiftTotals.overtimeWeekday += overtimeWeekday;
        shiftTotals.overtimeWeekend += overtimeWeekend;
        
        // Track per diem (max one per day)
        if (entry.per_diem_type && entry.per_diem_type !== 'none') {
          const existingPerDiem = perDiemByDate[entry.date];
          if (!existingPerDiem || (entry.per_diem_type === 'full' && existingPerDiem === 'half')) {
            perDiemByDate[entry.date] = entry.per_diem_type;
          }
        }
      });
      
      // Calculate total per diem compensation
      Object.values(perDiemByDate).forEach((type) => {
        if (type === 'full') {
          totalPerDiemCompensation += 290;
        } else if (type === 'half') {
          totalPerDiemCompensation += 145;
        }
      });

      setStats({
        todayHours:
          todayData?.reduce((sum, entry) => sum + Number(entry.total_hours), 0) || 0,
        weekHours: weekData?.reduce((sum, entry) => sum + Number(entry.total_hours), 0) || 0,
        monthHours:
          monthData?.reduce((sum, entry) => sum + Number(entry.total_hours), 0) || 0,
        openDeviations: count || 0,
      });

      setShiftStats({
        ...shiftTotals,
        travelCompensation: totalTravelCompensation,
        savedTravelCompensation: savedTravelCompensation,
        perDiemCompensation: totalPerDiemCompensation,
        perDiemDays: Object.keys(perDiemByDate).length,
      });
    };

    fetchStats();
  }, [effectiveUserId]);

  const statCards = [
    {
      title: "Idag",
      value: `${stats.todayHours.toFixed(1)} h`,
      icon: Clock,
      color: "text-accent",
    },
    {
      title: "Denna vecka",
      value: `${stats.weekHours.toFixed(1)} h`,
      icon: Calendar,
      color: "text-primary",
    },
    {
      title: "Denna månad",
      value: `${stats.monthHours.toFixed(1)} h`,
      icon: Briefcase,
      color: "text-primary",
    },
    {
      title: "Öppna avvikelser",
      value: stats.openDeviations,
      icon: AlertTriangle,
      color: "text-destructive",
    },
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-heading">
          Översikt {isImpersonating && <span className="text-lg font-normal text-muted-foreground">- {impersonatedUserName}</span>}
        </h2>
        <p className="text-muted-foreground">
          {isImpersonating ? `Visar ${impersonatedUserName}s data` : "Sammanfattning av dina timmar och avvikelser"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                {stat.title}
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader>
          <CardTitle>OB-fördelning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-sm font-medium">Totalt</span>
              <span className="text-lg font-bold font-heading">{shiftStats.total.toFixed(1)} h</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Dag (0%)</p>
                <p className="text-2xl font-bold font-heading">{shiftStats.day.toFixed(1)} h</p>
                <p className="text-xs text-muted-foreground">
                  {(shiftStats.day * hourlyWage * (obMultipliers.day - 1)).toFixed(2)} kr
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Kväll ({((obMultipliers.evening - 1) * 100).toFixed(0)}%)
                </p>
                <p className="text-2xl font-bold font-heading text-accent">
                  {shiftStats.evening.toFixed(1)} h
                </p>
                <p className="text-xs text-accent font-medium">
                  +{(shiftStats.evening * hourlyWage * (obMultipliers.evening - 1)).toFixed(2)} kr
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Natt ({((obMultipliers.night - 1) * 100).toFixed(0)}%)
                </p>
                <p className="text-2xl font-bold font-heading text-accent">
                  {shiftStats.night.toFixed(1)} h
                </p>
                <p className="text-xs text-accent font-medium">
                  +{(shiftStats.night * hourlyWage * (obMultipliers.night - 1)).toFixed(2)} kr
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Helg ({((obMultipliers.weekend - 1) * 100).toFixed(0)}%)
                </p>
                <p className="text-2xl font-bold font-heading text-accent">
                  {shiftStats.weekend.toFixed(1)} h
                </p>
                <p className="text-xs text-accent font-medium">
                  +{(shiftStats.weekend * hourlyWage * (obMultipliers.weekend - 1)).toFixed(2)} kr
                </p>
              </div>
              </div>
              {(shiftStats.overtimeWeekday > 0 || shiftStats.overtimeWeekend > 0) && (
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Övertid vardag (164%)</p>
                    <p className="text-2xl font-bold font-heading text-orange-500">
                      {shiftStats.overtimeWeekday.toFixed(1)} h
                    </p>
                    <p className="text-xs text-orange-500 font-medium">
                      {(shiftStats.overtimeWeekday * hourlyWage * 1.64).toFixed(2)} kr
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Övertid helg (224%)</p>
                    <p className="text-2xl font-bold font-heading text-purple-500">
                      {shiftStats.overtimeWeekend.toFixed(1)} h
                    </p>
                    <p className="text-xs text-purple-500 font-medium">
                      {(shiftStats.overtimeWeekend * hourlyWage * 2.24).toFixed(2)} kr
                    </p>
                  </div>
                </div>
              )}
              {(shiftStats.travelCompensation > 0 || shiftStats.savedTravelCompensation > 0 || shiftStats.perDiemDays > 0) && (
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                  {shiftStats.travelCompensation > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Restidsersättning</p>
                      <p className="text-xl font-bold font-heading text-blue-500">
                        {shiftStats.travelCompensation.toFixed(0)} kr
                      </p>
                    </div>
                  )}
                  {shiftStats.savedTravelCompensation > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Sparad restid</p>
                      <p className="text-xl font-bold font-heading text-emerald-500">
                        {shiftStats.savedTravelCompensation.toFixed(0)} kr
                      </p>
                    </div>
                  )}
                  {shiftStats.perDiemDays > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Traktamente</p>
                      <p className="text-xl font-bold font-heading text-amber-500">
                        {shiftStats.perDiemCompensation.toFixed(0)} kr
                      </p>
                      <p className="text-xs text-muted-foreground">{shiftStats.perDiemDays} dagar</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      <Card className="mt-6 shadow-card">
        <CardHeader>
          <CardTitle>Snabbstart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            • Gå till <strong>Tidrapporter</strong> för att registrera dina arbetstimmar
          </p>
          <p className="text-muted-foreground">
            • Gå till <strong>Avvikelser</strong> för att rapportera avvikelser med bilder
          </p>
          <p className="text-muted-foreground">
            • Gå till <strong>Lönöversikt</strong> för att se din beräknade bruttolön och OB-tillägg
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
