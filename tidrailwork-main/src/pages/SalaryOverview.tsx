import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Wallet, Clock, DollarSign, TrendingUp, Coins, CalendarIcon, Download, PiggyBank } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { sv } from "date-fns/locale";
import { calculateOBDistribution } from "@/lib/obDistribution";
import { calculateNetSalaryWithStateTax, STATE_TAX_MONTHLY_THRESHOLD } from "@/lib/taxCalculations";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";

const SalaryOverview = () => {
  const { effectiveUserId, isImpersonating, impersonatedUserName } = useEffectiveUser();
  
  // Period selection state
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  const { data: profile } = useQuery({
    queryKey: ["profile", effectiveUserId],
    queryFn: async () => {
      const data = await apiFetch(`/admin/users/${effectiveUserId}`).catch(() => null);
      return data || { hourly_wage: 0, tax_table: 30, full_name: "" };
    },
    enabled: !!effectiveUserId,
  });

  const { data: shiftMultipliers } = useQuery({
    queryKey: ["shift-multipliers"],
    queryFn: async () => {
      // Node-backend har inte detta än: använd 1x för alla skift
      return { day: 1, evening: 1, night: 1, weekend: 1 } as Record<string, number>;
    },
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time-entries", effectiveUserId, startDate, endDate],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("user_id", String(effectiveUserId));
      qs.set("from", format(startDate, "yyyy-MM-dd"));
      qs.set("to", format(endDate, "yyyy-MM-dd"));
      const data = await apiFetch(`/time-entries?${qs.toString()}`).catch(() => []);
      return data;
    },
    enabled: !!effectiveUserId,
  });

  const calculateSalaryData = () => {
    if (!timeEntries || !profile?.hourly_wage || !shiftMultipliers) {
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
        shiftBreakdown: {
          day: { hours: 0, compensation: 0 },
          evening: { hours: 0, compensation: 0 },
          night: { hours: 0, compensation: 0 },
          weekend: { hours: 0, compensation: 0 },
        },
      };
    }

    const shiftBreakdown: Record<string, { hours: number; compensation: number }> = {
      day: { hours: 0, compensation: 0 },
      evening: { hours: 0, compensation: 0 },
      night: { hours: 0, compensation: 0 },
      weekend: { hours: 0, compensation: 0 },
    };

    let travelCompensation = 0;
    let savedTravelCompensation = 0;
    let perDiemCompensation = 0;
    let overtimeWeekdayHours = 0;
    let overtimeWeekendHours = 0;
    
    // Track per diem by date (max one per day)
    const perDiemByDate: Record<string, string> = {};

    timeEntries.forEach((entry) => {
      const distribution = calculateOBDistribution(
        entry.date,
        entry.start_time,
        entry.end_time,
        entry.break_minutes
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

      // Use adjusted values for OB calculation
      const adjustedDistribution = {
        day: adjustedDay,
        evening: adjustedEvening,
        night: adjustedNight,
        weekend: adjustedWeekend,
      };

      (Object.keys(shiftBreakdown) as Array<keyof typeof shiftBreakdown>).forEach((shift) => {
        const hours = adjustedDistribution[shift] || 0;
        const obRate = (shiftMultipliers[shift] || 1) - 1;
        const compensation = hours * profile.hourly_wage * obRate;

        shiftBreakdown[shift].hours += hours;
        shiftBreakdown[shift].compensation += compensation;
      });

      // Calculate travel time compensation at 170 SEK/hour
      // Split between saved and paid based on save_travel_compensation flag
      if (entry.travel_time_hours) {
        const amount = entry.travel_time_hours * 170;
        if ((entry as any).save_travel_compensation) {
          savedTravelCompensation += amount;
        } else {
          travelCompensation += amount;
        }
      }

      // Calculate overtime hours
      overtimeWeekdayHours += overtimeWeekday;
      overtimeWeekendHours += overtimeWeekend;

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

    // Calculate overtime compensation
    // Övertid vardag: timlön + 64% = 164% av timlön
    // Övertid helg: timlön + 124% = 224% av timlön
    const overtimeWeekdayCompensation = overtimeWeekdayHours * profile.hourly_wage * 1.64;
    const overtimeWeekendCompensation = overtimeWeekendHours * profile.hourly_wage * 2.24;

    const perDiemDays = Object.keys(perDiemByDate).length;
    const totalHours = Object.values(shiftBreakdown).reduce((sum, s) => sum + s.hours, 0);
    const grossSalary = totalHours * profile.hourly_wage;
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
      overtimeWeekdayHours,
      overtimeWeekdayCompensation,
      overtimeWeekendHours,
      overtimeWeekendCompensation,
      shiftBreakdown,
    };
  };

  const salaryData = calculateSalaryData();
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
    doc.text("LÖNESPECIFIKATION", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${format(startDate, "d MMMM", { locale: sv })} - ${format(endDate, "d MMMM yyyy", { locale: sv })}`, pageWidth / 2, 28, { align: "center" });
    
    // Employee info
    doc.setFontSize(11);
    doc.text(`Anställd: ${profile.full_name}`, 14, 40);
    doc.text(`Timlön: ${profile.hourly_wage} kr/h`, 14, 47);
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
    
    const salaryRows = [
      ["Grundlön", `${salaryData.totalHours.toFixed(1)} h × ${profile.hourly_wage} kr`, `${salaryData.grossSalary.toLocaleString("sv-SE")} kr`],
      ["OB-tillägg (Dag)", `${salaryData.shiftBreakdown.day.hours.toFixed(1)} h`, `${salaryData.shiftBreakdown.day.compensation.toFixed(0)} kr`],
      ["OB-tillägg (Kväll)", `${salaryData.shiftBreakdown.evening.hours.toFixed(1)} h`, `+${salaryData.shiftBreakdown.evening.compensation.toFixed(0)} kr`],
      ["OB-tillägg (Natt)", `${salaryData.shiftBreakdown.night.hours.toFixed(1)} h`, `+${salaryData.shiftBreakdown.night.compensation.toFixed(0)} kr`],
      ["OB-tillägg (Helg)", `${salaryData.shiftBreakdown.weekend.hours.toFixed(1)} h`, `+${salaryData.shiftBreakdown.weekend.compensation.toFixed(0)} kr`],
      ["Övertid vardag", `${salaryData.overtimeWeekdayHours.toFixed(1)} h (+64%)`, `+${salaryData.overtimeWeekdayCompensation.toFixed(0)} kr`],
      ["Övertid helg", `${salaryData.overtimeWeekendHours.toFixed(1)} h (+124%)`, `+${salaryData.overtimeWeekendCompensation.toFixed(0)} kr`],
      ["Restidsersättning", `170 kr/h`, `${salaryData.travelCompensation.toLocaleString("sv-SE")} kr`],
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
        // BRUTTOLÖN is at index 9 (after adding 2 overtime rows), NETTOLÖN is at the last row
        const nettoRowIndex = taxBreakdown.stateTax > 0 ? 14 : 13;
        if (data.row.index === 9 || data.row.index === nettoRowIndex) {
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
      ["", "(Grundlön + OB, ej restid/trakt.)", ""],
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
            Ladda ner lönespec
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
            <CardTitle className="text-sm font-medium">Timlön</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profile?.hourly_wage ? `${profile.hourly_wage} kr` : "—"}
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
            <div className="text-2xl font-bold">
              {salaryData.overtimeWeekdayCompensation.toLocaleString("sv-SE")} kr
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {salaryData.overtimeWeekdayHours.toFixed(1)} h (+64%)
            </p>
          </CardContent>
        </Card>

        <Card className={salaryData.overtimeWeekendHours > 0 ? "border-purple-500/50 bg-purple-50 dark:bg-purple-950/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Övertid helg</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {salaryData.overtimeWeekendCompensation.toLocaleString("sv-SE")} kr
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {salaryData.overtimeWeekendHours.toFixed(1)} h (+124%)
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
                <p className="text-sm text-muted-foreground">Dag (0%)</p>
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
