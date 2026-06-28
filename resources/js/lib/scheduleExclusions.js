import { addDays, TIME_SLOTS } from './spreadsheet';

const COOKIE_NAME = 'sz_schedule_excluded_days';
const DEFAULT_EXCLUDED_DAYS = { saturday: false, sunday: false, holiday: false };

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

export function loadExcludedDays() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (!raw) return DEFAULT_EXCLUDED_DAYS;
    return { ...DEFAULT_EXCLUDED_DAYS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_EXCLUDED_DAYS;
  }
}

export function saveExcludedDays(value) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=31536000; SameSite=Lax`;
}

export function parseScheduleDateTime(dateTime) {
  const date = dateTime.slice(0, 10);
  const hm = dateTime.includes('T') ? dateTime.slice(11, 16) : TIME_SLOTS[0].start;
  return { date, hm };
}

function toDateTime(date, hm) {
  return `${date}T${hm}:00`;
}

export function isExcludedDate(dateStr, excludedDays, calendarData) {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  const dayType = calendarData?.get(dateStr)?.dayType;
  if (excludedDays.saturday && day === 6) return true;
  if (excludedDays.sunday && day === 0) return true;
  if (excludedDays.holiday && (dayType === 3 || dayType === 4)) return true;
  return false;
}

export function splitScheduleByExcludedDays(startDateTime, endDateTime, excludedDays, calendarData) {
  if (!excludedDays?.saturday && !excludedDays?.sunday && !excludedDays?.holiday) {
    return [{ startDate: startDateTime, endDate: endDateTime }];
  }

  const start = parseScheduleDateTime(startDateTime);
  const end = parseScheduleDateTime(endDateTime);
  if (start.date > end.date) return [];

  const firstHm = start.hm;
  const lastHm = end.hm;
  const dayStartHm = TIME_SLOTS[0].start;
  const dayEndHm = TIME_SLOTS[TIME_SLOTS.length - 1].end;
  const segments = [];
  let currentStart = null;
  let date = start.date;

  while (date <= end.date) {
    const excluded = isExcludedDate(date, excludedDays, calendarData);
    if (excluded) {
      if (currentStart) {
        const prev = addDays(date, -1);
        segments.push({
          startDate: toDateTime(currentStart.date, currentStart.hm),
          endDate: toDateTime(prev, dayEndHm),
        });
        currentStart = null;
      }
    } else if (!currentStart) {
      currentStart = {
        date,
        hm: date === start.date ? firstHm : dayStartHm,
      };
    }
    date = addDays(date, 1);
  }

  if (currentStart) {
    segments.push({
      startDate: toDateTime(currentStart.date, currentStart.hm),
      endDate: toDateTime(end.date, lastHm),
    });
  }

  return segments.filter(segment => segment.startDate <= segment.endDate);
}

export function splitPastedSchedulePreservingLength(sourceStartDateTime, sourceEndDateTime, targetStartDateTime, excludedDays, calendarData) {
  if (!excludedDays?.saturday && !excludedDays?.sunday && !excludedDays?.holiday) return null;

  const sourceStart = parseScheduleDateTime(sourceStartDateTime);
  const sourceEnd = parseScheduleDateTime(sourceEndDateTime);
  const targetStart = parseScheduleDateTime(targetStartDateTime);
  if (sourceStart.date > sourceEnd.date) return [];

  const includedSourceDates = [];
  let sourceDate = sourceStart.date;
  while (sourceDate <= sourceEnd.date) {
    if (!isExcludedDate(sourceDate, excludedDays, calendarData)) includedSourceDates.push(sourceDate);
    sourceDate = addDays(sourceDate, 1);
  }
  if (includedSourceDates.length === 0) return [];

  const dayStartHm = TIME_SLOTS[0].start;
  const dayEndHm = TIME_SLOTS[TIME_SLOTS.length - 1].end;
  const startHm = sourceStart.hm;
  const endHm = sourceEnd.hm;
  const neededDays = includedSourceDates.length;
  const segments = [];
  let currentStart = null;
  let currentEnd = null;
  let placedDays = 0;
  let targetDate = targetStart.date;

  while (placedDays < neededDays) {
    if (isExcludedDate(targetDate, excludedDays, calendarData)) {
      if (currentStart) {
        segments.push({ startDate: currentStart, endDate: currentEnd });
        currentStart = null;
        currentEnd = null;
      }
      targetDate = addDays(targetDate, 1);
      continue;
    }

    const isFirst = placedDays === 0;
    const isLast = placedDays === neededDays - 1;
    const segmentStartHm = isFirst ? startHm : dayStartHm;
    const segmentEndHm = isLast ? endHm : dayEndHm;
    if (!currentStart) currentStart = toDateTime(targetDate, segmentStartHm);
    currentEnd = toDateTime(targetDate, segmentEndHm);

    placedDays += 1;
    targetDate = addDays(targetDate, 1);
  }

  if (currentStart) segments.push({ startDate: currentStart, endDate: currentEnd });
  return segments.filter(segment => segment.startDate <= segment.endDate);
}
