export type BillingShiftDistribution = {
  day: number;    // Dag: 06:00-18:00 Mån-Fre
  night: number;  // Natt: 18:00-06:00 Mån-Tor
  weekend: number; // Helg: Fre 18:00 - Mån 06:00
};

/**
 * Calculates billing-specific OB distribution (different from employee OB)
 * - Dag: 06:00-18:00 Mon-Fri
 * - Natt: 18:00-06:00 Mon-Thu
 * - Helg: Friday 18:00 - Monday 06:00
 */
export const calculateBillingOBDistribution = (
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string,
  breakMinutes: number | null | undefined
): BillingShiftDistribution => {
  const distribution: BillingShiftDistribution = { day: 0, night: 0, weekend: 0 };

  const [startHour, startMin] = startTimeStr.split(":").map(Number);
  const [endHour, endMin] = endTimeStr.split(":").map(Number);

  const start = new Date(dateStr);
  start.setHours(startHour, startMin, 0, 0);

  const end = new Date(dateStr);
  end.setHours(endHour, endMin, 0, 0);

  // If end is before/equal to start, it's the next day
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  const totalMinutesRaw = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  const effectiveBreak = breakMinutes || 0;
  const totalWorkMinutes = totalMinutesRaw - effectiveBreak;

  if (totalWorkMinutes <= 0) return distribution;

  /**
   * Check if a minute falls within the weekend billing period
   * Weekend: Friday 18:00 - Monday 06:00
   */
  const isWeekendBillingMinute = (d: Date): boolean => {
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
    const minutesSinceMidnight = currentHour * 60 + current.getMinutes();
    const minutesToNextHour = 60 - (minutesSinceMidnight % 60);
    const minutesToEnd = Math.round((end.getTime() - current.getTime()) / (1000 * 60));
    const minutesInThisChunk = Math.min(minutesToNextHour, minutesToEnd, remainingMinutes);

    if (isWeekendBillingMinute(current)) {
      // Weekend billing
      distribution.weekend += minutesInThisChunk / 60;
    } else {
      // Weekday (Mon-Thu, or Friday before 18:00)
      if (currentHour >= 6 && currentHour < 18) {
        // Day: 06:00-18:00
        distribution.day += minutesInThisChunk / 60;
      } else {
        // Night: 18:00-06:00 (Mon-Thu only, since weekend is handled above)
        distribution.night += minutesInThisChunk / 60;
      }
    }

    current = new Date(current.getTime() + minutesInThisChunk * 60 * 1000);
    remainingMinutes -= minutesInThisChunk;
  }

  // Apply break proportionally
  const totalCalculated = distribution.day + distribution.night + distribution.weekend;

  if (totalCalculated > 0 && effectiveBreak > 0) {
    const breakRatio = effectiveBreak / (totalWorkMinutes + effectiveBreak);
    distribution.day *= 1 - breakRatio;
    distribution.night *= 1 - breakRatio;
    distribution.weekend *= 1 - breakRatio;
  }

  return distribution;
};
