export type ShiftDistribution = {
  day: number;
  evening: number;
  night: number;
  weekend: number;
};

export type ShiftWindow = {
  start: number;
  end: number;
};

export type ShiftWindowConfig = {
  day: ShiftWindow;
  evening: ShiftWindow;
  night: ShiftWindow;
  weekend: ShiftWindow;
};

export type ObDistribution = {
  day: number;
  evening: number;
  night: number;
  weekend: number;
};

export const DEFAULT_SHIFT_WINDOWS: ShiftWindowConfig = {
  day: { start: 7, end: 18 },
  evening: { start: 18, end: 21 },
  night: { start: 21, end: 7 },
  weekend: { start: 18, end: 6 },
};

export const calculateOBDistribution = (
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string,
  breakMinutes: number | null | undefined,
  shiftWindows: ShiftWindowConfig = DEFAULT_SHIFT_WINDOWS
): ShiftDistribution => {
  const distribution: ShiftDistribution = { day: 0, evening: 0, night: 0, weekend: 0 };

  // Bygg riktiga datum för start och slut så vi kan hantera pass över midnatt och helg
  // Handle both HH:MM and HH:MM:SS formats from database
  const startParts = startTimeStr.split(":");
  const endParts = endTimeStr.split(":");
  const startHour = Number(startParts[0]);
  const startMin = Number(startParts[1]);
  const endHour = Number(endParts[0]);
  const endMin = Number(endParts[1]);

  // Parse date parts explicitly to avoid timezone issues with new Date(dateStr)
  const [year, month, day] = dateStr.split("-").map(Number);
  
  const start = new Date(year, month - 1, day, startHour, startMin, 0, 0);
  const end = new Date(year, month - 1, day, endHour, endMin, 0, 0);

  // Om slut är före/likamed start tolkar vi det som nästa dag (t.ex. 21:00–06:00)
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  const totalMinutesRaw = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  const effectiveBreak = breakMinutes || 0;
  const totalWorkMinutes = totalMinutesRaw - effectiveBreak;

  if (totalWorkMinutes <= 0) return distribution;

  const inWindow = (minutesSinceMidnight: number, window: ShiftWindow) => {
    const start = window.start * 60;
    const end = window.end * 60;
    if (start === end) return false;
    if (start < end) return minutesSinceMidnight >= start && minutesSinceMidnight < end;
    return minutesSinceMidnight >= start || minutesSinceMidnight < end;
  };
  let remainingMinutes = totalWorkMinutes;
  let current = new Date(start);

  while (current < end && remainingMinutes > 0) {
    const minutesSinceMidnight = current.getHours() * 60 + current.getMinutes();
    const minutesToNextHour = 60 - (minutesSinceMidnight % 60);
    const minutesToEnd = Math.round((end.getTime() - current.getTime()) / (1000 * 60));
    const minutesInThisChunk = Math.min(minutesToNextHour, minutesToEnd, remainingMinutes);

    // Get day of week directly from current Date object
    const dow = current.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday

    // Check weekend first: Friday start_hour -> Monday end_hour
    const weekendStart = shiftWindows.weekend.start * 60;
    const weekendEnd = shiftWindows.weekend.end * 60;
    const isWeekend =
      (dow === 5 && minutesSinceMidnight >= weekendStart) || // Friday start_hour+
      dow === 6 || // Saturday (all day)
      dow === 0 || // Sunday (all day)
      (dow === 1 && minutesSinceMidnight < weekendEnd); // Monday before end_hour

    if (isWeekend) {
      distribution.weekend += minutesInThisChunk / 60;
    } else if (inWindow(minutesSinceMidnight, shiftWindows.night)) {
      // Night (Mon-Thu only, weekend already handled)
      distribution.night += minutesInThisChunk / 60;
    } else if (dow >= 1 && dow <= 4 && inWindow(minutesSinceMidnight, shiftWindows.evening)) {
      // Evening (Mon-Thu only)
      distribution.evening += minutesInThisChunk / 60;
    } else {
      // Day (fallback)
      distribution.day += minutesInThisChunk / 60;
    }

    current = new Date(current.getTime() + minutesInThisChunk * 60 * 1000);
    remainingMinutes -= minutesInThisChunk;
  }

  const totalCalculated =
    distribution.day + distribution.evening + distribution.night + distribution.weekend;

  if (totalCalculated > 0 && effectiveBreak > 0) {
    const breakRatio = effectiveBreak / (totalWorkMinutes + effectiveBreak);
    distribution.day *= 1 - breakRatio;
    distribution.evening *= 1 - breakRatio;
    distribution.night *= 1 - breakRatio;
    distribution.weekend *= 1 - breakRatio;
  }

  return distribution;
};

type ObSegment = {
  category: keyof ObDistribution;
  minutes: number;
};

const buildObSegments = (
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string,
  breakMinutes: number | null | undefined,
  shiftWindows: ShiftWindowConfig
): ObSegment[] => {
  const segments: ObSegment[] = [];
  const startParts = startTimeStr.split(":");
  const endParts = endTimeStr.split(":");
  const startHour = Number(startParts[0]);
  const startMin = Number(startParts[1]);
  const endHour = Number(endParts[0]);
  const endMin = Number(endParts[1]);

  if ([startHour, startMin, endHour, endMin].some((value) => Number.isNaN(value))) {
    return segments;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return segments;
  }

  const start = new Date(year, month - 1, day, startHour, startMin, 0, 0);
  const end = new Date(year, month - 1, day, endHour, endMin, 0, 0);

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  const totalMinutesRaw = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  const effectiveBreak = breakMinutes || 0;
  const totalWorkMinutes = totalMinutesRaw - effectiveBreak;

  if (totalWorkMinutes <= 0) return segments;

  const inWindow = (minutesSinceMidnight: number, window: ShiftWindow) => {
    const start = window.start * 60;
    const end = window.end * 60;
    if (start === end) return false;
    if (start < end) return minutesSinceMidnight >= start && minutesSinceMidnight < end;
    return minutesSinceMidnight >= start || minutesSinceMidnight < end;
  };

  let remainingMinutes = totalWorkMinutes;
  let current = new Date(start);

  while (current < end && remainingMinutes > 0) {
    const minutesSinceMidnight = current.getHours() * 60 + current.getMinutes();
    const minutesToNextHour = 60 - (minutesSinceMidnight % 60);
    const minutesToEnd = Math.round((end.getTime() - current.getTime()) / (1000 * 60));
    const minutesInThisChunk = Math.min(minutesToNextHour, minutesToEnd, remainingMinutes);

    const dow = current.getDay();
    const weekendStart = shiftWindows.weekend.start * 60;
    const weekendEnd = shiftWindows.weekend.end * 60;
    const isWeekend =
      (dow === 5 && minutesSinceMidnight >= weekendStart) ||
      dow === 6 ||
      dow === 0 ||
      (dow === 1 && minutesSinceMidnight < weekendEnd);

    let category: keyof ObDistribution = "day";
    if (isWeekend) {
      category = "weekend";
    } else if (inWindow(minutesSinceMidnight, shiftWindows.night)) {
      category = "night";
    } else if (dow >= 1 && dow <= 4 && inWindow(minutesSinceMidnight, shiftWindows.evening)) {
      category = "evening";
    }

    segments.push({ category, minutes: minutesInThisChunk });
    current = new Date(current.getTime() + minutesInThisChunk * 60 * 1000);
    remainingMinutes -= minutesInThisChunk;
  }

  if (effectiveBreak > 0) {
    const breakRatio = effectiveBreak / (totalWorkMinutes + effectiveBreak);
    const factor = 1 - breakRatio;
    segments.forEach((segment) => {
      segment.minutes *= factor;
    });
  }

  return segments;
};

export const calculateOBDistributionWithOvertime = (
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string,
  breakMinutes: number | null | undefined,
  overtimeWeekdayHours: number | null | undefined,
  overtimeWeekendHours: number | null | undefined,
  shiftWindows: ShiftWindowConfig = DEFAULT_SHIFT_WINDOWS
): ObDistribution => {
  const segments = buildObSegments(dateStr, startTimeStr, endTimeStr, breakMinutes, shiftWindows);
  if (!segments.length) {
    return { day: 0, evening: 0, night: 0, weekend: 0 };
  }

  let overtimeMinutes =
    Math.max(0, Number(overtimeWeekdayHours || 0) + Number(overtimeWeekendHours || 0)) * 60;

  for (let i = segments.length - 1; i >= 0 && overtimeMinutes > 0; i -= 1) {
    const remove = Math.min(segments[i].minutes, overtimeMinutes);
    segments[i].minutes -= remove;
    overtimeMinutes -= remove;
  }

  return segments.reduce<ObDistribution>(
    (acc, segment) => {
      acc[segment.category] += segment.minutes / 60;
      return acc;
    },
    { day: 0, evening: 0, night: 0, weekend: 0 }
  );
};
