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

function hmToMinutes(hm) {
  const [hours, minutes] = String(hm).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
}

/** 開始時刻を TIME_SLOTS のコマ開始に丸める（一致しない場合はその時刻を含むコマの開始） */
export function snapToSlotStart(hm) {
  if (TIME_SLOTS.some(slot => slot.start === hm)) return hm;
  const minutes = hmToMinutes(hm);
  let snapped = TIME_SLOTS[0].start;
  for (const slot of TIME_SLOTS) {
    if (hmToMinutes(slot.start) > minutes) break;
    snapped = slot.start;
  }
  return snapped;
}

/** 終了時刻を TIME_SLOTS のコマ終了に丸める（一致しない場合はその時刻を含むコマの終了） */
export function snapToSlotEnd(hm) {
  if (TIME_SLOTS.some(slot => slot.end === hm)) return hm;
  const minutes = hmToMinutes(hm);
  const slot = TIME_SLOTS.find(s => hmToMinutes(s.end) >= minutes);
  return (slot ?? TIME_SLOTS[TIME_SLOTS.length - 1]).end;
}

/**
 * 予定日時文字列を日付と時刻に分解する。
 * 時刻は type に応じて必ず TIME_SLOTS 上の妥当な値へ丸める。
 * これにより、旧仕様で保存された不正な時刻（終了に 08:00 / 08:30 等）を
 * コピー元に持つ予定を貼り付けても、不正値が新規データへ伝播しない。
 */
export function parseScheduleDateTime(dateTime, type = 'start') {
  const date = dateTime.slice(0, 10);
  const fallback = type === 'end' ? TIME_SLOTS[TIME_SLOTS.length - 1].end : TIME_SLOTS[0].start;
  const raw = dateTime.includes('T') ? dateTime.slice(11, 16) : fallback;
  const hm = type === 'end' ? snapToSlotEnd(raw) : snapToSlotStart(raw);
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

  const start = parseScheduleDateTime(startDateTime, 'start');
  const end = parseScheduleDateTime(endDateTime, 'end');
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

  const sourceStart = parseScheduleDateTime(sourceStartDateTime, 'start');
  const sourceEnd = parseScheduleDateTime(sourceEndDateTime, 'end');
  const targetStart = parseScheduleDateTime(targetStartDateTime, 'start');
  if (sourceStart.date > sourceEnd.date) return [];

  // 元予定の暦日数をそのまま維持する。
  // 元予定に土日祝（除外日）が含まれていても日数は削らず、
  // 貼り付け先で除外日に当たった分は除外しない日までスキップして配置する。
  let neededDays = 0;
  let sourceDate = sourceStart.date;
  while (sourceDate <= sourceEnd.date) {
    neededDays += 1;
    sourceDate = addDays(sourceDate, 1);
  }

  const dayStartHm = TIME_SLOTS[0].start;
  const dayEndHm = TIME_SLOTS[TIME_SLOTS.length - 1].end;
  const startHm = sourceStart.hm;
  const endHm = sourceEnd.hm;
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
