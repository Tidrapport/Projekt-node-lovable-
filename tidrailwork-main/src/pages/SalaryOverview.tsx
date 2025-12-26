import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Wallet, Clock, DollarSign, TrendingUp, Coins, CalendarIcon, Download, PiggyBank } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { sv } from "date-fns/locale";
import { DEFAULT_SHIFT_WINDOWS, ShiftWindowConfig } from "@/lib/obDistribution";
import { summarizeObDistribution } from "@/lib/obSummary";
import { calculateNetSalaryWithStateTax, STATE_TAX_MONTHLY_THRESHOLD } from "@/lib/taxCalculations";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
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

const SalaryOverview = () => {
  const { effectiveUserId, isImpersonating, impersonatedUserName } = useEffectiveUser();
  
  // Period selection state
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  const { data: profile } = useQuery({
    queryKey: ["profile", effectiveUserId],
    queryFn: async () => {
      const data = await apiFetch(`/profiles/${effectiveUserId}`).catch(() => null);
      return data || { hourly_wage: 0, tax_table: 30, full_name: "" };
    },
    enabled: !!effectiveUserId,
  });

  const { data: shiftConfigs = [] } = useQuery({
    queryKey: ["shift-configs"],
    queryFn: async () => {
      try {
        const data = await apiFetch<ObConfig[]>("/admin/ob-settings");
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn("Could not load OB settings, using defaults", error);
        return [];
      }
    },
    initialData: [],
  });

  const shiftMultipliers = useMemo(() => {
    const multipliers = { ...DEFAULT_MULTIPLIERS };
    shiftConfigs.forEach((config) => {
      if (config.shift_type === "day") multipliers.day = config.multiplier ?? multipliers.day;
      if (config.shift_type === "evening") multipliers.evening = config.multiplier ?? multipliers.evening;
      if (config.shift_type === "night") multipliers.night = config.multiplier ?? multipliers.night;
      if (config.shift_type === "weekend") multipliers.weekend = config.multiplier ?? multipliers.weekend;
      if (config.shift_type === "overtime_day") multipliers.overtime_day = config.multiplier ?? multipliers.overtime_day;
      if (config.shift_type === "overtime_weekend") {
        multipliers.overtime_weekend = config.multiplier ?? multipliers.overtime_weekend;
      }
    });
    return multipliers;
  }, [shiftConfigs]);

  const shiftWindows = useMemo(() => buildShiftWindows(shiftConfigs), [shiftConfigs]);

  const { data: travelRate = DEFAULT_TRAVEL_RATE } = useQuery({
    queryKey: ["travel-rate"],
    queryFn: async () => {
      try {
        const data = await apiFetch<{ travel_rate: number }>("/admin/compensation-settings");
        return Number(data?.travel_rate) || DEFAULT_TRAVEL_RATE;
      } catch (error) {
        console.warn("Could not load travel rate, using default", error);
        return DEFAULT_TRAVEL_RATE;
      }
    },
    initialData: DEFAULT_TRAVEL_RATE,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time-entries", effectiveUserId, startDate, endDate],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      return listTimeEntries({
        user_id: effectiveUserId,
        from: format(startDate, "yyyy-MM-dd"),
        to: format(endDate, "yyyy-MM-dd"),
      }).catch(() => []);
    },
    enabled: !!effectiveUserId,
  });

  const { data: compTimeBalance } = useQuery({
    queryKey: ["comp-time-balance", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return { saved_hours: 0, taken_hours: 0, balance_hours: 0 };
      const data = await apiFetch<{ saved_hours: number; taken_hours: number; balance_hours: number }>(
        `/comp-time-balance?user_id=${effectiveUserId}`
      ).catch(() => null);
      return data || { saved_hours: 0, taken_hours: 0, balance_hours: 0 };
    },
    enabled: !!effectiveUserId,
    initialData: { saved_hours: 0, taken_hours: 0, balance_hours: 0 },
  });

  const calculateSalaryData = () => {
    if (!timeEntries || !profile || !shiftMultipliers) {
      return {
        totalHours: 0,
        grossSalary: 0,
        obCompensation: 0,
        travelCompensation: 0,
        savedTravelCompensation: 0,
        perDiemCompensation: 0,
        perDiemDays: 0,
        totalGrossSalary: 0,
        overtimeWeekdayHours: 0,
        overtimeWeekdayCompensation: 0,
        overtimeWeekendHours: 0,
        overtimeWeekendCompensation: 0,
        compTimeSavedHours: 0,
        compTimeTakenHours: 0,
        compTimeDeduction: 0,
        shiftBreakdown: {
          day: { hours: 0, compensation: 0 },
          evening: { hours: 0, compensation: 0 },
          night: { hours: 0, compensation: 0 },
          weekend: { hours: 0, compensation: 0 },
        },
      };
    }

    let travelCompensation = 0;
    let savedTravelCompensation = 0;
    let perDiemCompensation = 0;
    
    // Track per diem by date (max one per day)
    const perDiemByDate: Record<string, string> = {};

    const hourlyWage = Number(profile.hourly_wage) || 0;
    const monthlySalary = Number(profile.monthly_salary) || 0;
    const baseHourlyRate =
      monthlySalary > 0 ? monthlySalary / MONTHLY_SALARY_DIVISOR : hourlyWage;

    let compTimeSavedHours = 0;
    let compTimeSavedWeekday = 0;
    let compTimeSavedWeekend = 0;
    let compTimeTakenHours = 0;

    const adjustedEntries = timeEntries.map((entry) => {
      const overtimeWeekday = Number(entry.overtime_weekday_hours || 0);
      const overtimeWeekend = Number(entry.overtime_weekend_hours || 0);
      const totalOvertime = overtimeWeekday + overtimeWeekend;
      const savedHoursRaw = Number(entry.comp_time_saved_hours || 0);
      const savedHours = savedHoursRaw > 0 ? savedHoursRaw : entry.save_comp_time ? totalOvertime : 0;
      const takenHours = Number(entry.comp_time_taken_hours || 0);

      compTimeSavedHours += savedHours;
      compTimeTakenHours += takenHours;

      if (savedHours <= 0 || totalOvertime <= 0) return entry;

      const savedOvertime = Math.min(savedHours, totalOvertime);
      const weekdayShare = totalOvertime > 0 ? overtimeWeekday / totalOvertime : 0;
      const savedWeekday = savedOvertime * weekdayShare;
      const savedWeekend = savedOvertime - savedWeekday;

      compTimeSavedWeekday += savedWeekday;
      compTimeSavedWeekend += savedWeekend;

      return {
        ...entry,
        overtime_weekday_hours: Math.max(0, overtimeWeekday - savedWeekday),
        overtime_weekend_hours: Math.max(0, overtimeWeekend - savedWeekend),
      };
    });

    const obSummary = summarizeObDistribution(adjustedEntries, shiftWindows);
    const shiftBreakdown: Record<string, { hours: number; compensation: number }> = {
      day: {
        hours: obSummary.day,
        compensation: obSummary.day * baseHourlyRate * ((shiftMultipliers.day || 1) - 1),
      },
      evening: {
        hours: obSummary.evening,
        compensation: obSummary.evening * baseHourlyRate * ((shiftMultipliers.evening || 1) - 1),
      },
      night: {
        hours: obSummary.night,
        compensation: obSummary.night * baseHourlyRate * ((shiftMultipliers.night || 1) - 1),
      },
      weekend: {
        hours: obSummary.weekend,
        compensation: obSummary.weekend * baseHourlyRate * ((shiftMultipliers.weekend || 1) - 1),
      },
    };

    timeEntries.forEach((entry) => {

      // Calculate travel time compensation at 170 SEK/hour
      // Split between saved and paid based on save_travel_compensation flag
      if (entry.travel_time_hours) {
        const amount = entry.travel_time_hours * travelRate;
        if (entry.save_travel_compensation) {
          savedTravelCompensation += amount;
        } else {
          travelCompensation += amount;
        }
      }

      // Calculate per diem (max one per day)
      if (entry.per_diem_type && entry.per_diem_type !== 'none') {
        // Only count if no per diem registered for this date yet, or if this one has higher value
        const existingPerDiem = perDiemByDate[entry.date];
        if (!existingPerDiem || (entry.per_diem_type === 'full' && existingPerDiem === 'half')) {
          perDiemByDate[entry.date] = entry.per_diem_type;
        }
      }
    });

    // Calculate total per diem compensation
    Object.values(perDiemByDate).forEach((type) => {
      if (type === 'full') {
        perDiemCompensation += 290;
      } else if (type === 'half') {
        perDiemCompensation += 145;
      }
    });

    // Calculate overtime compensation (multiplier includes base pay)
    const overtimeWeekdayCompensation =
      obSummary.overtimeWeekday * baseHourlyRate * (shiftMultipliers.overtime_day || 1);
    const overtimeWeekendCompensation =
      obSummary.overtimeWeekend * baseHourlyRate * (shiftMultipliers.overtime_weekend || 1);
    const compTimeDeduction =
      compTimeSavedWeekday * baseHourlyRate * ((shiftMultipliers.overtime_day || 1) - 1) +
      compTimeSavedWeekend * baseHourlyRate * ((shiftMultipliers.overtime_weekend || 1) - 1);

    const perDiemDays = Object.keys(perDiemByDate).length;
    const totalHoursWorked = Object.values(shiftBreakdown).reduce((sum, s) => sum + s.hours, 0);
    const totalHours = Math.max(0, totalHoursWorked - compTimeSavedHours);
    const grossSalary = monthlySalary > 0 ? monthlySalary : totalHours * hourlyWage;
    const obCompensation = Object.values(shiftBreakdown).reduce(
      (sum, s) => sum + s.compensation,
      0
    );
    // Traktamente är skattefritt och ska inte ingå i bruttolön
    const totalGrossSalary = grossSalary + obCompensation + travelCompensation + overtimeWeekdayCompensation + overtimeWeekendCompensation;

    return {
      totalHours,
      grossSalary,
      obCompensation,
      travelCompensation,
      savedTravelCompensation,
      perDiemCompensation,
      perDiemDays,
      totalGrossSalary,
      overtimeWeekdayHours: obSummary.overtimeWeekday,
      overtimeWeekdayCompensation,
      overtimeWeekendHours: obSummary.overtimeWeekend,
      overtimeWeekendCompensation,
      compTimeSavedHours,
      compTimeTakenHours,
      compTimeDeduction,
      shiftBreakdown,
    };
  };

  const salaryData = calculateSalaryData();
  const compTimeBalanceHours = Number(compTimeBalance?.balance_hours || 0);
  const compTimeSavedTotalHours = Number(compTimeBalance?.saved_hours || 0);
  const monthlySalary = Number(profile?.monthly_salary || 0);
  const hourlyWage = Number(profile?.hourly_wage || 0);
  const showMonthlySalary = monthlySalary > 0;
  const overtimeWeekdayPercent = ((shiftMultipliers.overtime_day - 1) * 100).toFixed(0);
  const overtimeWeekendPercent = ((shiftMultipliers.overtime_weekend - 1) * 100).toFixed(0);
  // Beräkna skatt med statlig skatt på inkomst över brytpunkten
  const taxBreakdown = calculateNetSalaryWithStateTax(salaryData.totalGrossSalary, profile?.tax_table || 30);
  // Traktamente läggs till nettolönen eftersom det är skattefritt
  const netSalary = taxBreakdown.netSalary + salaryData.perDiemCompensation;
  const taxDeduction = taxBreakdown.totalTax;
  
  // Semesterersättning: 13% av bruttolön exkl. restidsersättning och traktamente
  const vacationPayBase = salaryData.grossSalary + salaryData.obCompensation;
  const vacationPay = vacationPayBase * 0.13;
  
  // Arbetsgivaravgifter: 31.42% av bruttolön (standard i Sverige)
  const employerFeeRate = 0.3142;
  const employerFees = salaryData.totalGrossSalary * employerFeeRate;

  const shiftTypeLabels: Record<string, string> = {
    day: "Dag",
    evening: "Kväll",
    night: "Natt",
    weekend: "Helg",
  };

  const generateSalaryPDF = () => {
    if (!profile || timeEntries.length === 0) {
      toast.error("Ingen data att exportera");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PRELIMINÄR LÖNESPECIFIKATION", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${format(startDate, "d MMMM", { locale: sv })} - ${format(endDate, "d MMMM yyyy", { locale: sv })}`, pageWidth / 2, 28, { align: "center" });
    
    // Employee info
    doc.setFontSize(11);
    const salaryLabel = showMonthlySalary ? "Månadslön" : "Timlön";
    const salaryValue = showMonthlySalary
      ? `${monthlySalary.toLocaleString("sv-SE")} kr`
      : `${hourlyWage} kr/h`;
    doc.text(`Anställd: ${profile.full_name}`, 14, 40);
    doc.text(`${salaryLabel}: ${salaryValue}`, 14, 47);
    doc.text(`Skattetabell: ${profile.tax_table}%`, 14, 54);
    
    // Time entries table
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Arbetade pass", 14, 68);
    
    const timeData = timeEntries.map(entry => [
      format(new Date(entry.date), "d MMM", { locale: sv }),
      entry.project?.name || "-",
      `${entry.start_time} - ${entry.end_time}`,
      `${entry.total_hours.toFixed(1)} h`,
      entry.travel_time_hours ? `${entry.travel_time_hours} h` : "-",
      entry.per_diem_type === 'full' ? 'Hel' : entry.per_diem_type === 'half' ? 'Halv' : '-'
    ]);
    
    autoTable(doc, {
      startY: 72,
      head: [["Datum", "Projekt", "Tid", "Timmar", "Restid", "Trakt."]],
      body: timeData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
      },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Salary breakdown
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Lönesammanställning", 14, finalY);
    
    const baseSalaryLabel = showMonthlySalary ? "Månadslön" : "Grundlön";
    const baseSalaryDetail = showMonthlySalary
      ? "Fast månadslön"
      : `${salaryData.totalHours.toFixed(1)} h × ${hourlyWage} kr`;
    const compTimeDeductionLabel =
      salaryData.compTimeDeduction > 0
        ? `-${salaryData.compTimeDeduction.toFixed(0)} kr`
        : "0 kr";
    const salaryRows = [
      [baseSalaryLabel, baseSalaryDetail, `${salaryData.grossSalary.toLocaleString("sv-SE")} kr`],
      ["OB-tillägg (Dag)", `${salaryData.shiftBreakdown.day.hours.toFixed(1)} h`, `${salaryData.shiftBreakdown.day.compensation.toFixed(0)} kr`],
      ["OB-tillägg (Kväll)", `${salaryData.shiftBreakdown.evening.hours.toFixed(1)} h`, `+${salaryData.shiftBreakdown.evening.compensation.toFixed(0)} kr`],
      ["OB-tillägg (Natt)", `${salaryData.shiftBreakdown.night.hours.toFixed(1)} h`, `+${salaryData.shiftBreakdown.night.compensation.toFixed(0)} kr`],
      ["OB-tillägg (Helg)", `${salaryData.shiftBreakdown.weekend.hours.toFixed(1)} h`, `+${salaryData.shiftBreakdown.weekend.compensation.toFixed(0)} kr`],
      ["Övertid vardag", `${salaryData.overtimeWeekdayHours.toFixed(1)} h (+${overtimeWeekdayPercent}%)`, `+${salaryData.overtimeWeekdayCompensation.toFixed(0)} kr`],
      ["Övertid helg", `${salaryData.overtimeWeekendHours.toFixed(1)} h (+${overtimeWeekendPercent}%)`, `+${salaryData.overtimeWeekendCompensation.toFixed(0)} kr`],
      ["Restidsersättning", `${travelRate} kr/h`, `${salaryData.travelCompensation.toLocaleString("sv-SE")} kr`],
      ...(salaryData.compTimeSavedHours > 0
        ? [["Sparad komptid", `${salaryData.compTimeSavedHours.toFixed(1)} h`, compTimeDeductionLabel]]
        : []),
      ["Totalt sparad komptid (saldo)", `${compTimeBalanceHours.toFixed(1)} h`, ""],
      ["", "", ""],
      ["BRUTTOLÖN", "", `${salaryData.totalGrossSalary.toLocaleString("sv-SE")} kr`],
      ["Kommunalskatt", `${profile.tax_table}%`, `-${taxBreakdown.municipalTax.toLocaleString("sv-SE")} kr`],
      ...(taxBreakdown.stateTax > 0 ? [["Statlig skatt", `20% (över ${STATE_TAX_MONTHLY_THRESHOLD.toLocaleString("sv-SE")} kr)`, `-${taxBreakdown.stateTax.toLocaleString("sv-SE")} kr`]] : []),
      ["Traktamente (skattefritt)", `${salaryData.perDiemDays} dagar`, `+${salaryData.perDiemCompensation.toLocaleString("sv-SE")} kr`],
      ["", "", ""],
      ["NETTOLÖN (utbetalas)", "", `${netSalary.toLocaleString("sv-SE")} kr`],
    ];
    
    autoTable(doc, {
      startY: finalY + 4,
      body: salaryRows,
      theme: "plain",
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: "bold" },
        1: { cellWidth: 50 },
        2: { cellWidth: 50, halign: "right" },
      },
      didParseCell: (data) => {
        const grossRowIndex = salaryRows.findIndex((row) => row[0] === "BRUTTOLÖN");
        const netRowIndex = salaryRows.findIndex((row) => row[0] === "NETTOLÖN (utbetalas)");
        if (data.row.index === grossRowIndex || data.row.index === netRowIndex) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });
    
    const salaryFinalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Additional info section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Övrig information", 14, salaryFinalY);
    
    const additionalRows = [
      ["Semesterersättning (13%)", `13% av ${vacationPayBase.toLocaleString("sv-SE")} kr`, `${vacationPay.toLocaleString("sv-SE")} kr`],
      ["", `(${baseSalaryLabel} + OB, ej restid/trakt.)`, ""],
      ["Totalt sparad komptid (saldo)", `${compTimeBalanceHours.toFixed(1)} h`, ""],
      ["", "", ""],
      ["Arbetsgivaravgifter", `31,42% av bruttolön`, `${employerFees.toLocaleString("sv-SE")} kr`],
      ["", "(betalas av arbetsgivaren till Skatteverket)", ""],
    ];
    
    autoTable(doc, {
      startY: salaryFinalY + 4,
      body: additionalRows,
      theme: "plain",
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: "bold" },
        1: { cellWidth: 70, textColor: [100, 100, 100], fontSize: 9 },
        2: { cellWidth: 40, halign: "right" },
      },
    });
    
    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128, 128, 128);
    doc.text(`Genererad: ${format(new Date(), "d MMMM yyyy HH:mm", { locale: sv })}`, 14, footerY);
    doc.text("Detta är en preliminär lönespecifikation", pageWidth - 14, footerY, { align: "right" });
    doc.text("Korrigeringar kan förekomma.", pageWidth - 14, footerY + 5, { align: "right" });
    
    // Save
    const fileName = `lonespec_${format(startDate, "yyyy-MM")}_${profile.full_name.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
    toast.success("Lönespecifikation nedladdad!");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold font-heading">
              Lönöversikt {isImpersonating && <span className="text-lg font-normal text-muted-foreground">- {impersonatedUserName}</span>}
            </h1>
            <p className="text-muted-foreground">
              {isImpersonating ? `Visar ${impersonatedUserName}s löndata` : "Översikt över din lön och OB-tillägg"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={generateSalaryPDF} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Ladda ner preliminär lönespec
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, "d MMM yyyy", { locale: sv })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          <span className="text-muted-foreground">till</span>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(endDate, "d MMM yyyy", { locale: sv })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {showMonthlySalary ? "Månadslön" : "Timlön"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {showMonthlySalary
                ? `${monthlySalary.toLocaleString("sv-SE")} kr`
                : hourlyWage
                ? `${hourlyWage} kr`
                : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totala timmar</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salaryData.totalHours.toFixed(1)} h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grundlön</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {salaryData.grossSalary.toLocaleString("sv-SE")} kr
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OB-tillägg</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {salaryData.obCompensation.toLocaleString("sv-SE")} kr
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restidsersättning</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {salaryData.travelCompensation.toLocaleString("sv-SE")} kr
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Traktamente</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {salaryData.perDiemCompensation.toLocaleString("sv-SE")} kr
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {salaryData.perDiemDays} dagar (skattefritt)
            </p>
          </CardContent>
        </Card>

        <Card className={salaryData.overtimeWeekdayHours > 0 ? "border-orange-500/50 bg-orange-50 dark:bg-orange-950/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Övertid vardag</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold pl-0.5">
              {salaryData.overtimeWeekdayCompensation.toLocaleString("sv-SE")} kr
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {salaryData.overtimeWeekdayHours.toFixed(1)} h (+{overtimeWeekdayPercent}%)
            </p>
          </CardContent>
        </Card>

        <Card className={salaryData.overtimeWeekendHours > 0 ? "border-purple-500/50 bg-purple-50 dark:bg-purple-950/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Övertid helg</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold pl-0.5">
              {salaryData.overtimeWeekendCompensation.toLocaleString("sv-SE")} kr
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {salaryData.overtimeWeekendHours.toFixed(1)} h (+{overtimeWeekendPercent}%)
            </p>
          </CardContent>
        </Card>

      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground">
              Total bruttolön
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary-foreground">
              {salaryData.totalGrossSalary.toLocaleString("sv-SE")} kr
            </div>
            <p className="text-xs text-primary-foreground/80 mt-1">
              Före skatt (Tabell {profile?.tax_table || 30})
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent to-accent/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-accent-foreground">
              Nettolön (efter skatt)
            </CardTitle>
            <Coins className="h-4 w-4 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-foreground">
              {netSalary.toLocaleString("sv-SE")} kr
            </div>
            <p className="text-xs text-accent-foreground/80 mt-1">
              Kommunalskatt: {taxBreakdown.municipalTax.toLocaleString("sv-SE")} kr ({profile?.tax_table || 30}%)
              {taxBreakdown.stateTax > 0 && (
                <> + Statlig skatt: {taxBreakdown.stateTax.toLocaleString("sv-SE")} kr (20%)</>
              )}
              {salaryData.perDiemCompensation > 0 && (
                <> + Traktamente {salaryData.perDiemCompensation.toLocaleString("sv-SE")} kr</>
              )}
            </p>
            {taxBreakdown.stateTax > 0 && (
              <p className="text-xs text-accent-foreground/60 mt-1">
                Statlig skatt på inkomst över {STATE_TAX_MONTHLY_THRESHOLD.toLocaleString("sv-SE")} kr/mån
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={salaryData.savedTravelCompensation > 0 ? "border-primary/50 bg-primary/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sparad restidsersättning</CardTitle>
            <PiggyBank className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {salaryData.savedTravelCompensation.toLocaleString("sv-SE")} kr
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ej utbetald (sparas)
            </p>
          </CardContent>
        </Card>

        <Card className={compTimeSavedTotalHours !== 0 ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sparad komptid</CardTitle>
            <Clock className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {compTimeSavedTotalHours.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Totalt sparat (utan uttag)
            </p>
            {salaryData.compTimeTakenHours > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Uttag denna period: {salaryData.compTimeTakenHours.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} h
              </p>
            )}
            {salaryData.compTimeSavedHours > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1">
                Denna period: {salaryData.compTimeSavedHours.toFixed(1)} h
              </p>
            )}
            {salaryData.compTimeDeduction > 0 && (
              <p className="text-xs text-muted-foreground">
                Avdrag: -{salaryData.compTimeDeduction.toLocaleString("sv-SE")} kr
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OB-fördelning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-sm font-medium">Totalt</span>
              <span className="text-lg font-bold font-heading">
                {Object.values(salaryData.shiftBreakdown).reduce((sum, s) => sum + s.hours, 0).toFixed(1)} h
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Dag ({((shiftMultipliers.day - 1) * 100).toFixed(0)}%)
                </p>
                <p className="text-2xl font-bold font-heading">
                  {(salaryData.shiftBreakdown.day?.hours || 0).toFixed(1)} h
                </p>
                <p className="text-xs text-muted-foreground">
                  {(salaryData.shiftBreakdown.day?.compensation || 0).toFixed(2)} kr
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Kväll ({shiftMultipliers?.evening ? ((shiftMultipliers.evening - 1) * 100).toFixed(0) : '29'}%)
                </p>
                <p className="text-2xl font-bold font-heading text-accent">
                  {(salaryData.shiftBreakdown.evening?.hours || 0).toFixed(1)} h
                </p>
                <p className="text-xs text-accent font-medium">
                  +{(salaryData.shiftBreakdown.evening?.compensation || 0).toFixed(2)} kr
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Natt ({shiftMultipliers?.night ? ((shiftMultipliers.night - 1) * 100).toFixed(0) : '63'}%)
                </p>
                <p className="text-2xl font-bold font-heading text-accent">
                  {(salaryData.shiftBreakdown.night?.hours || 0).toFixed(1)} h
                </p>
                <p className="text-xs text-accent font-medium">
                  +{(salaryData.shiftBreakdown.night?.compensation || 0).toFixed(2)} kr
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Helg ({shiftMultipliers?.weekend ? ((shiftMultipliers.weekend - 1) * 100).toFixed(0) : '113'}%)
                </p>
                <p className="text-2xl font-bold font-heading text-accent">
                  {(salaryData.shiftBreakdown.weekend?.hours || 0).toFixed(1)} h
                </p>
                <p className="text-xs text-accent font-medium">
                  +{(salaryData.shiftBreakdown.weekend?.compensation || 0).toFixed(2)} kr
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalaryOverview;
