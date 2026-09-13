// Calendar arithmetic uses local civil days, including daylight-saving changes.
export function addDays(timestamp, count) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + count);
  return date.getTime();
}

export function hourStart(timestamp) {
  const date = new Date(timestamp);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

export function calendarHour(day, hour) {
  const date = new Date(day);
  date.setHours(hour, 0, 0, 0);
  // A skipped springtime hour must not create a second button for the next hour.
  return date.getHours() === hour ? date.getTime() : null;
}

export function canReserve(date, now) {
  return Number.isFinite(date) && date === hourStart(date)
    && date >= hourStart(now) && date <= addDays(hourStart(now), 28)
    && ![4, 5].includes(new Date(date).getHours());
}
