export type ShiftDistribution = {
  day: number;
  evening: number;
  night: number;
  weekend: number;
};

export const calculateOBDistribution = (
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string,
  breakMinutes: number | null | undefined
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

  /**
   * Check if a minute falls within the weekend OB period for employee salary
   * Weekend OB: Friday 18:00 - Monday 06:00
   */
  const isWeekendMinute = (d: Date): boolean => {
    const dow = d.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
    const minutesSinceMidnight = d.getHours() * 60 + d.getMinutes();

    // Friday from 18:00 onwards
    if (dow === 5 && minutesSinceMidnight >= 18 * 60) return true;

    // All of Saturday
    if (dow === 6) return true;

    // All of Sunday
    if (dow === 0) return true;

    // Monday before 06:00
    if (dow === 1 && minutesSinceMidnight < 6 * 60) return true;

    return false;
  };
  let remainingMinutes = totalWorkMinutes;
  let current = new Date(start);

  while (current < end && remainingMinutes > 0) {
    const currentHour = current.getHours();
    const currentMinute = current.getMinutes();
    const minutesSinceMidnight = currentHour * 60 + currentMinute;
    const minutesToNextHour = 60 - (minutesSinceMidnight % 60);
    const minutesToEnd = Math.round((end.getTime() - current.getTime()) / (1000 * 60));
    const minutesInThisChunk = Math.min(minutesToNextHour, minutesToEnd, remainingMinutes);

    // Get day of week directly from current Date object
    const dow = current.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday

    // Check weekend first: Friday 18:00 - Monday 06:00
    const isWeekend = 
      (dow === 5 && minutesSinceMidnight >= 18 * 60) || // Friday 18:00+
      (dow === 6) || // Saturday (all day)
      (dow === 0) || // Sunday (all day)
      (dow === 1 && minutesSinceMidnight < 6 * 60); // Monday before 06:00

    if (isWeekend) {
      distribution.weekend += minutesInThisChunk / 60;
    } else if (currentHour >= 21 || currentHour < 7) {
      // Night: 21:00-07:00 (Mon-Thu only, weekend already handled)
      distribution.night += minutesInThisChunk / 60;
    } else if (currentHour >= 18 && currentHour < 21 && dow >= 1 && dow <= 4) {
      // Evening: 18:00-21:00 (Mon-Thu ONLY - dow 1-4)
      distribution.evening += minutesInThisChunk / 60;
    } else {
      // Day: 07:00-18:00 (Mon-Fri)
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
