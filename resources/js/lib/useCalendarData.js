import { useEffect, useState } from 'react';
import { apiArray } from './api';

/**
 * 予定表示開始日のカレンダーと同じく dr_calendar（/calendar/search）から
 * 休日データを取得して dayType の Map を返す共有フック。
 * 基準日の前後1年分を取得する（DatePicker のヘッダ移動分をカバー）。
 */
export default function useCalendarData(baseDate) {
  const [calendarData, setCalendarData] = useState(new Map());

  useEffect(() => {
    const base = baseDate || new Date().toISOString().slice(0, 10);
    const baseDt = new Date(base + 'T00:00:00');
    const from = new Date(baseDt);
    from.setFullYear(from.getFullYear() - 1);
    const to = new Date(baseDt);
    to.setFullYear(to.getFullYear() + 1);

    let cancelled = false;
    apiArray('/calendar/search', {
      method: 'POST',
      body: JSON.stringify({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }),
    }).then(data => {
      if (cancelled) return;
      const map = new Map();
      for (const c of data) map.set(c.date, { dayType: c.dayType });
      setCalendarData(map);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, []); // マウント時に一度だけ取得（前後1年で十分カバーできる）

  return calendarData;
}
