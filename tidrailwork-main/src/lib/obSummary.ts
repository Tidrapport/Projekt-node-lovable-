import { calculateOBDistributionWithOvertime, ShiftWindowConfig } from "@/lib/obDistribution";

type ObEntry = {
  date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number | null;
  overtime_weekday_hours?: number | null;
  overtime_weekend_hours?: number | null;
};

export type ObSummary = {
  day: number;
  evening: number;
  night: number;
  weekend: number;
  total: number;
  overtimeWeekday: number;
  overtimeWeekend: number;
};

export const summarizeObDistribution = (
  entries: ObEntry[],
  shiftWindows: ShiftWindowConfig
): ObSummary => {
  const summary: ObSummary = {
    day: 0,
    evening: 0,
    night: 0,
    weekend: 0,
    total: 0,
    overtimeWeekday: 0,
    overtimeWeekend: 0,
  };

  entries.forEach((entry) => {
    const distribution = calculateOBDistributionWithOvertime(
      entry.date,
      entry.start_time || "00:00",
      entry.end_time || "00:00",
      entry.break_minutes || 0,
      entry.overtime_weekday_hours,
      entry.overtime_weekend_hours,
      shiftWindows
    );

    const overtimeWeekend = Number(entry.overtime_weekend_hours || 0);
    const overtimeWeekday = Number(entry.overtime_weekday_hours || 0);

    summary.day += distribution.day;
    summary.evening += distribution.evening;
    summary.night += distribution.night;
    summary.weekend += distribution.weekend;
    summary.total += distribution.day + distribution.evening + distribution.night + distribution.weekend;
    summary.overtimeWeekday += overtimeWeekday;
    summary.overtimeWeekend += overtimeWeekend;
  });

  return summary;
};
