import { useState, useEffect } from 'react';

/**
 * Date and time formatting helpers for personal trainer booking,
 * synchronized to Greece (Europe/Athens, EET/EEST, UTC+2 / UTC+3).
 */

export const GREECE_TIMEZONE = 'Europe/Athens';

/**
 * Format a time slot according to Greek standard 24-hour time conventions.
 * In Greece, times are displayed in 24-hour format (e.g. 09:00 – 10:00, 18:00 – 19:00).
 */
export function formatTimeSlot(time: string, options?: { includeZone?: boolean }): string {
  if (!time) return '';
  const [hourStr, minuteStr = '00'] = time.split(':');
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return time;
  const nextHour = (hour + 1) % 24;

  const startFormatted = `${String(hour).padStart(2, '0')}:${minuteStr.padStart(2, '0')}`;
  const endFormatted = `${String(nextHour).padStart(2, '0')}:${minuteStr.padStart(2, '0')}`;

  const base = `${startFormatted} – ${endFormatted}`;
  if (options?.includeZone) {
    return `${base} (Athens Time)`;
  }
  return base;
}

/**
 * Returns the current date and time details in Greece (Europe/Athens).
 */
export function getCurrentGreeceTime(): {
  dateStr: string;
  timeStr: string;
  timeWithSeconds: string;
  hours: number;
  minutes: number;
  seconds: number;
  tzAbbr: string;
  formattedClock: string;
  fullDisplay: string;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: GREECE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = parseInt(getPart('hour') || '0', 10);
  const minute = parseInt(getPart('minute') || '0', 10);
  const second = parseInt(getPart('second') || '0', 10);
  const tzAbbr = getPart('timeZoneName') || 'EEST';

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const timeWithSeconds = `${timeStr}:${String(second).padStart(2, '0')}`;

  return {
    dateStr,
    timeStr,
    timeWithSeconds,
    hours: hour,
    minutes: minute,
    seconds: second,
    tzAbbr,
    formattedClock: timeStr,
    fullDisplay: `${timeStr} ${tzAbbr} (Athens, Greece)`,
  };
}

/**
 * Returns today's date formatted as YYYY-MM-DD in Greece (Europe/Athens).
 */
export function getTodayString(): string {
  return getCurrentGreeceTime().dateStr;
}

/**
 * Returns a date string (YYYY-MM-DD) offset from Greece's current date.
 */
export function getRelativeDayString(offsetDays: number): string {
  const { dateStr } = getCurrentGreeceTime();
  const [y, m, d] = dateStr.split('-').map(Number);
  const baseUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offsetDate = new Date(baseUtc.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const resY = offsetDate.getUTCFullYear();
  const resM = String(offsetDate.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(offsetDate.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

/**
 * Returns upcoming days list starting from today in Greece.
 * Formats sublabels in standard European/Greek Day-Month format (e.g. 21 Sep).
 */
export function getUpcomingDays(count = 14): Array<{ dateStr: string; label: string; subLabel: string }> {
  const { dateStr } = getCurrentGreeceTime();
  const [y, m, d] = dateStr.split('-').map(Number);
  const baseUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const days = [];

  for (let i = 0; i < count; i++) {
    const cur = new Date(baseUtc.getTime() + i * 24 * 60 * 60 * 1000);
    const curY = cur.getUTCFullYear();
    const curM = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const curD = String(cur.getUTCDate()).padStart(2, '0');
    const curDateStr = `${curY}-${curM}-${curD}`;

    let label = cur.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';

    // Day Month format (e.g. "21 Sep") standard in Greece & Europe
    const subLabel = cur.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    days.push({ dateStr: curDateStr, label, subLabel });
  }

  return days;
}

/**
 * Formats a short date string in European/Greek format (e.g. "Mon, 21 Sep").
 */
export function formatShortDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Use midday UTC to prevent any local browser timezone shifts
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formats a full date string in European/Greek order (e.g. "Monday, 21 September 2026").
 */
export function formatFullDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Checks if a specific date and time slot has already passed in Greece.
 */
export function isSlotInPastInGreece(dateStr: string, timeSlot: string): boolean {
  const greece = getCurrentGreeceTime();
  if (dateStr < greece.dateStr) return true;
  if (dateStr > greece.dateStr) return false;

  // Same day: compare slot start time (e.g. "09:00") with current Greece time
  const [slotHStr = '0', slotMStr = '0'] = timeSlot.split(':');
  const slotMinutes = Number(slotHStr) * 60 + Number(slotMStr);
  const currentMinutes = greece.hours * 60 + greece.minutes;

  return currentMinutes >= slotMinutes;
}

/**
 * Custom React hook that returns the current time in Greece, updated on an interval.
 */
export function useGreeceTime(refreshIntervalMs = 1000) {
  const [time, setTime] = useState(getCurrentGreeceTime);

  useEffect(() => {
    // Initial sync
    setTime(getCurrentGreeceTime());
    const interval = setInterval(() => {
      setTime(getCurrentGreeceTime());
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refreshIntervalMs]);

  return time;
}


