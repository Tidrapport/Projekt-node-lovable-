import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Clock, AlertTriangle, Briefcase, Calendar } from "lucide-react";
import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { format, startOfMonth, startOfWeek, endOfWeek, endOfMonth } from "date-fns";
import { DEFAULT_SHIFT_WINDOWS, ShiftWindowConfig } from "@/lib/obDistribution";
import { summarizeObDistribution } from "@/lib/obSummary";
import { apiFetch } from "@/api/client";
import { listTimeEntries } from "@/api/timeEntries";

type ObConfig = {
  shift_type: string;
  multiplier: number;
  start_hour?: number | null;
  end_hour?: number | null;
};

const DEFAULT_MULTIPLIERS = {
  day: 1.0,
  evening: 1.25,
  night: 1.5,
  weekend: 1.75,
  overtime_day: 1.5,
  overtime_weekend: 2.0,
};

const DEFAULT_TRAVEL_RATE = 170;
const MONTHLY_SALARY_DIVISOR = 174;

const normalizeHour = (value: number | null | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildShiftWindows = (configs: ObConfig[] | null): ShiftWindowConfig => {
  const windows: ShiftWindowConfig = {
    day: { ...DEFAULT_SHIFT_WINDOWS.day },
    evening: { ...DEFAULT_SHIFT_WINDOWS.evening },
    night: { ...DEFAULT_SHIFT_WINDOWS.night },
    weekend: { ...DEFAULT_SHIFT_WINDOWS.weekend },
  };

  (configs || []).forEach((cfg) => {
    if (cfg.shift_type === "day") {
      windows.day = {
        start: normalizeHour(cfg.start_hour, windows.day.start),
        end: normalizeHour(cfg.end_hour, windows.day.end),
      };
    }
    if (cfg.shift_type === "evening") {
      windows.evening = {
        start: normalizeHour(cfg.start_hour, windows.evening.start),
        end: normalizeHour(cfg.end_hour, windows.evening.end),
      };
    }
    if (cfg.shift_type === "night") {
      windows.night = {
        start: normalizeHour(cfg.start_hour, windows.night.start),
        end: normalizeHour(cfg.end_hour, windows.night.end),
      };
    }
    if (cfg.shift_type === "weekend") {
      windows.weekend = {
        start: normalizeHour(cfg.start_hour, windows.weekend.start),
        end: normalizeHour(cfg.end_hour, windows.weekend.end),
      };
    }
  });

  return windows;
};

const Dashboard = () => {
  const { effectiveUserId } = useEffectiveUser();
  const [stats, setStats] = useState({
    todayHours: 0,
    weekHours: 0,
    monthHours: 0,
    openDeviations: 0,
  });

  const [hourlyWage, setHourlyWage] = useState<number>(0);
  const [obMultipliers, setObMultipliers] = useState(DEFAULT_MULTIPLIERS);
  const [travelRate, setTravelRate] = useState(DEFAULT_TRAVEL_RATE);

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

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<
    { role: "user" | "assistant"; content: string; sources?: string[] }[]
  >([]);
  const aiEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!effectiveUserId) return;

    const fetchStats = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      // Fetch user profile with hourly wage
      const profileData = await apiFetch(`/profiles/${effectiveUserId}`).catch(() => null);
      if (profileData) {
        const monthlySalary = Number(profileData.monthly_salary) || 0;
        const fallbackHourly = Number(profileData.hourly_wage) || 0;
        const baseHourlyRate = monthlySalary > 0 ? monthlySalary / MONTHLY_SALARY_DIVISOR : fallbackHourly;
        setHourlyWage(baseHourlyRate);
      }

      // Fetch OB multipliers (fallback to defaults if endpoint is unavailable)
      const obData = await apiFetch<ObConfig[]>("/admin/ob-settings").catch(() => null);
      const shiftWindows = buildShiftWindows(obData);
      if (obData && Array.isArray(obData)) {
        const multipliers = {
          day: obData.find((o) => o.shift_type === "day")?.multiplier ?? DEFAULT_MULTIPLIERS.day,
          evening: obData.find((o) => o.shift_type === "evening")?.multiplier ?? DEFAULT_MULTIPLIERS.evening,
          night: obData.find((o) => o.shift_type === "night")?.multiplier ?? DEFAULT_MULTIPLIERS.night,
          weekend: obData.find((o) => o.shift_type === "weekend")?.multiplier ?? DEFAULT_MULTIPLIERS.weekend,
          overtime_day: obData.find((o) => o.shift_type === "overtime_day")?.multiplier ?? DEFAULT_MULTIPLIERS.overtime_day,
          overtime_weekend:
            obData.find((o) => o.shift_type === "overtime_weekend")?.multiplier ?? DEFAULT_MULTIPLIERS.overtime_weekend,
        };
        setObMultipliers(multipliers);
      }

      const travelData = await apiFetch<{ travel_rate: number }>("/admin/compensation-settings").catch(() => null);
      setTravelRate(Number(travelData?.travel_rate) || DEFAULT_TRAVEL_RATE);

      const todayData = await listTimeEntries({ user_id: effectiveUserId, from: today, to: today }).catch(() => []);
      const weekData = await listTimeEntries({ user_id: effectiveUserId, from: weekStart, to: weekEnd }).catch(() => []);
      const monthData = await listTimeEntries({ user_id: effectiveUserId, from: monthStart, to: monthEnd }).catch(() => []);

      const deviationsData = await apiFetch(`/deviation-reports?user_id=${effectiveUserId}&status=open`).catch(
        () => []
      );
      const count = Array.isArray(deviationsData) ? deviationsData.length : 0;

      const allTimeEntries = (monthData || []).filter(
        (entry: any) => String(entry.user_id) === String(effectiveUserId)
      );

      // Calculate shift type distribution, travel compensation, and per diem
      const shiftTotals = summarizeObDistribution(allTimeEntries || [], shiftWindows);

      let totalTravelCompensation = 0;
      let savedTravelCompensation = 0;
      let totalPerDiemCompensation = 0;
      
      // Track per diem by date (max one per day)
      const perDiemByDate: Record<string, string> = {};

      (allTimeEntries || []).forEach((entry: any) => {
        // Calculate travel compensation (split saved vs paid)
        if (entry.travel_time_hours) {
          const amount = entry.travel_time_hours * travelRate;
          if ((entry as any).save_travel_compensation) {
            savedTravelCompensation += amount;
          } else {
            totalTravelCompensation += amount;
          }
        }

        // Track per diem (max one per day)
        if (entry.per_diem_type && entry.per_diem_type !== "none") {
          const existingPerDiem = perDiemByDate[entry.date];
          if (!existingPerDiem || (entry.per_diem_type === "full" && existingPerDiem === "half")) {
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

      const safeReduce = (arr: { total_hours?: number; user_id?: string | number }[] | undefined) =>
        (arr || [])
          .filter((entry) => String(entry.user_id) === String(effectiveUserId))
          .reduce((sum, entry) => sum + (Number(entry.total_hours) || 0), 0);

      setStats({
        todayHours: safeReduce(todayData),
        weekHours: safeReduce(weekData),
        monthHours: safeReduce(monthData),
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

  useEffect(() => {
    if (!aiMessages.length) return;
    aiEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiMessages]);

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

  const sendAi = async () => {
    const content = aiInput.trim();
    if (!content || aiLoading) return;

    const nextMessages = [...aiMessages, { role: "user", content }];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiLoading(true);

    try {
      const res = await apiFetch<{ reply?: string; sources?: string[] }>("/help/ai", {
        method: "POST",
        json: { question: content },
      });
      const reply = String(res?.reply || "").trim() || "Inget svar från AI.";
      const sources = Array.isArray(res?.sources) ? res.sources : [];
      setAiMessages([...nextMessages, { role: "assistant", content: reply, sources }]);
    } catch (err: any) {
      setAiMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "Kunde inte nå AI-tjänsten. Försök igen senare.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-heading">
          Översikt
        </h2>
        <p className="text-muted-foreground">
          Sammanfattning av dina timmar och avvikelser
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
                <p className="text-sm text-muted-foreground">
                  Dag ({((obMultipliers.day - 1) * 100).toFixed(0)}%)
                </p>
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
                    <p className="text-sm text-muted-foreground">
                      Övertid vardag ({((obMultipliers.overtime_day - 1) * 100).toFixed(0)}%)
                    </p>
                    <p className="text-2xl font-bold font-heading text-orange-500">
                      {shiftStats.overtimeWeekday.toFixed(1)} h
                    </p>
                    <p className="text-xs text-orange-500 font-medium">
                      {(shiftStats.overtimeWeekday * hourlyWage * obMultipliers.overtime_day).toFixed(2)} kr
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Övertid helg ({((obMultipliers.overtime_weekend - 1) * 100).toFixed(0)}%)
                    </p>
                    <p className="text-2xl font-bold font-heading text-purple-500">
                      {shiftStats.overtimeWeekend.toFixed(1)} h
                    </p>
                    <p className="text-xs text-purple-500 font-medium">
                      {(shiftStats.overtimeWeekend * hourlyWage * obMultipliers.overtime_weekend).toFixed(2)} kr
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
          <CardTitle>Arbetshjälp (AI)</CardTitle>
          <CardDescription>
            Fråga om TDOK/TRVinfra. AI:n svarar bara utifrån lokala dokument.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-56 rounded-md border bg-muted/30">
            <div className="space-y-3 p-3">
              {aiMessages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ingen historik ännu. Ställ en fråga så hjälper vi till.
                </p>
              )}
              {aiMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="rounded-md bg-background p-3 shadow-sm">
                  <p className="text-xs uppercase text-muted-foreground">
                    {message.role === "user" ? "Du" : "AI"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Källor: {message.sources.join(", ")}
                    </p>
                  )}
                </div>
              ))}
              <div ref={aiEndRef} />
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <Label>Fråga</Label>
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ex: Hur beräknar jag ett A-skydd?"
              rows={4}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Dela inte känsliga uppgifter. AI:n kan sakna svar om dokument saknas.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAiMessages([])}
                disabled={aiLoading || aiMessages.length === 0}
              >
                Rensa
              </Button>
              <Button onClick={sendAi} disabled={aiLoading || !aiInput.trim()}>
                {aiLoading ? "Analyserar..." : "Skicka"}
              </Button>
            </div>
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
