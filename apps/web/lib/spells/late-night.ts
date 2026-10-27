/** Hour (0–23) on the Istanbul clock. */
export function istanbulHour(date: Date) {
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(date);
  return Number(hour) % 24;
}

/** From 00:00 up to (not including) 05:00 in Istanbul: time for a tea break. */
export function isLateNight(date: Date) {
  return istanbulHour(date) < 5;
}
