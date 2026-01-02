const DEFAULT_SHIFT_WINDOWS = {
  day: { start: 7, end: 18 },
  evening: { start: 18, end: 21 },
  night: { start: 21, end: 7 },
  weekend: { start: 18, end: 6 },
};

const inWindow = (minutesSinceMidnight, window) => {
  const start = window.start * 60;
  const end = window.end * 60;
  if (start === end) return false;
  if (start < end) return minutesSinceMidnight >= start && minutesSinceMidnight < end;
  return minutesSinceMidnight >= start || minutesSinceMidnight < end;
};

export function calculateObDistributionWithOvertime(
  dateStr,
  startTimeStr,
  endTimeStr,
  breakMinutes,
  overtimeWeekdayHours,
  overtimeWeekendHours,
  shiftWindows = DEFAULT_SHIFT_WINDOWS
) {
  if (!dateStr || !startTimeStr || !endTimeStr) {
    return { day: 0, evening: 0, night: 0, weekend: 0 };
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const startParts = startTimeStr.split(":");
  const endParts = endTimeStr.split(":");
  const startHour = Number(startParts[0]);
  const startMin = Number(startParts[1]);
  const endHour = Number(endParts[0]);
  const endMin = Number(endParts[1]);

  if ([year, month, day, startHour, startMin, endHour, endMin].some((v) => Number.isNaN(v))) {
    return { day: 0, evening: 0, night: 0, weekend: 0 };
  }

  const start = new Date(year, month - 1, day, startHour, startMin, 0, 0);
  const end = new Date(year, month - 1, day, endHour, endMin, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);

  const totalMinutesRaw = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  const effectiveBreak = Number(breakMinutes || 0);
  const totalWorkMinutes = totalMinutesRaw - effectiveBreak;
  if (totalWorkMinutes <= 0) return { day: 0, evening: 0, night: 0, weekend: 0 };

  const segments = [];
  let remainingMinutes = totalWorkMinutes;
  let current = new Date(start);

  while (current < end && remainingMinutes > 0) {
    const minutesSinceMidnight = current.getHours() * 60 + current.getMinutes();
    const minutesToNextHour = 60 - (minutesSinceMidnight % 60);
    const minutesToEnd = Math.round((end.getTime() - current.getTime()) / (1000 * 60));
    const minutesInThisChunk = Math.min(minutesToNextHour, minutesToEnd, remainingMinutes);

    const dow = current.getDay(); // 0=Sun
    const weekendStart = shiftWindows.weekend.start * 60;
    const weekendEnd = shiftWindows.weekend.end * 60;
    const isWeekend =
      (dow === 5 && minutesSinceMidnight >= weekendStart) ||
      dow === 6 ||
      dow === 0 ||
      (dow === 1 && minutesSinceMidnight < weekendEnd);

    let category = "day";
    if (isWeekend) category = "weekend";
    else if (inWindow(minutesSinceMidnight, shiftWindows.night)) category = "night";
    else if (dow >= 1 && dow <= 4 && inWindow(minutesSinceMidnight, shiftWindows.evening)) category = "evening";

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

  let overtimeMinutes = Math.max(0, Number(overtimeWeekdayHours || 0) + Number(overtimeWeekendHours || 0)) * 60;
  for (let i = segments.length - 1; i >= 0 && overtimeMinutes > 0; i -= 1) {
    const remove = Math.min(segments[i].minutes, overtimeMinutes);
    segments[i].minutes -= remove;
    overtimeMinutes -= remove;
  }

  return segments.reduce(
    (acc, segment) => {
      acc[segment.category] += segment.minutes / 60;
      return acc;
    },
    { day: 0, evening: 0, night: 0, weekend: 0 }
  );
}
