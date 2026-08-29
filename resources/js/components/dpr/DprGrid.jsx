import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiArray, apiJson } from '../../lib/api';
import {
  CELL_SIZE, SLOT_COUNT, TOTAL_HDR_H, addDays, dateToStr, daysBetween,
  getMonthWeekInfo, layoutPlans,
} from '../../lib/spreadsheet';
import SpreadsheetGridCanvas from '../SpreadsheetGridCanvas';
import SpreadsheetGridHeaders from '../SpreadsheetGridHeaders';
import SpreadsheetGridStatusBar from '../SpreadsheetGridStatusBar';
import DprBars from './DprBars';
import DprLeftHeader, { DPR_LEFT_COLUMN_KEYS, DprLeftHeaderCorner } from './DprLeftHeader';
import DprToolbar from './DprToolbar';
import { clampLeftColW, loadLeftColWidths, saveLeftColWidth } from '../../lib/leftHeaderColumns';

const DATE_WIDTH_STORAGE_KEY = 'sz_schedule_date_width_dpr';
const PAGE_SIZE = 200;

function normalizeDateWidth(value) {
  const width = Number(value);
  if (!Number.isFinite(width)) return 20;
  return Math.max(20, Math.min(120, Math.round(width / 20) * 20));
}

function loadDateWidth() {
  try { return normalizeDateWidth(sessionStorage.getItem(DATE_WIDTH_STORAGE_KEY)); }
  catch { return 20; }
}

function shiftMonth(dateString, amount) {
  const [year, month, day] = dateString.split('-').map(Number);
  const shifted = new Date(year, month - 1 + amount, 1);
  shifted.setDate(Math.min(day, new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()));
  return dateToStr(shifted);
}

function buildDateColumns(startDate, endDate, calendarData) {
  const columns = [];
  for (let offset = 0; offset < daysBetween(startDate, endDate); offset++) {
    const dateStr = addDays(startDate, offset);
    const date = new Date(`${dateStr}T00:00:00`);
    const dow = date.getDay();
    const dayType = calendarData.get(dateStr)?.dayType;
    const week = getMonthWeekInfo(dateStr);
    columns.push({
      dateStr, day: date.getDate(), dow, month: date.getMonth() + 1, year: date.getFullYear(),
      week: week.week, weekKey: week.key, weekYear: week.year, weekMonth: week.month,
      type: dayType === 3 || dayType === 4 ? 'holiday' : dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : 'weekday',
    });
  }
  return columns;
}

export default function DprGrid({ active = false, displaySettings, displaySettingsApplyVersion = 0, onGenerated, onError }) {
  const [startDate, setStartDate] = useState(() => dateToStr(new Date()));
  const [dateWidth, setDateWidth] = useState(loadDateWidth);
  const [generating, setGenerating] = useState(false);
  const [groups, setGroups] = useState([]);
  const [plans, setPlans] = useState([]);
  const [calendarData, setCalendarData] = useState(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [colWidths, setColWidths] = useState(() => loadLeftColWidths('dpr'));
  const viewportRef = useRef(null);
  const cursorRef = useRef(null);
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const errorRef = useRef(onError);
  const colWidthsRef = useRef(colWidths);
  const colResizeRef = useRef(null);
  errorRef.current = onError;
  colWidthsRef.current = colWidths;

  const machines = displaySettings?.dprmodellist || [];
  const machineKey = JSON.stringify([...machines].sort());
  const categoryFilterKey = JSON.stringify({
    formtype: displaySettings?.dprformtypelist || [],
    deliverytype: displaySettings?.dprdeliverytypelist || [],
    classification: displaySettings?.dprclassificationlist || [],
    status: displaySettings?.dprstatuslist || [],
    sales_locations: displaySettings?.dprsaleslocationlist || [],
    publication_years: displaySettings?.dprpublicationyearlist || [],
  });
  const displayMonths = Math.max(1, Number(displaySettings?.dprduration ?? 4));
  const endDate = useMemo(() => addDays(startDate, displayMonths * 30), [startDate, displayMonths]);
  const viewMode = dateWidth === 120 ? 'slot' : 'day';
  const colW = viewMode === 'slot' ? 20 : dateWidth;
  const leftWidth = DPR_LEFT_COLUMN_KEYS.reduce((sum, key) => sum + colWidths[key], 0);

  const handleColResizeMove = useCallback((event) => {
    const resize = colResizeRef.current;
    if (!resize) return;
    const width = clampLeftColW(resize.startWidth + event.clientX - resize.startX);
    resize.lastWidth = width;
    setColWidths(previous => previous[resize.key] === width ? previous : { ...previous, [resize.key]: width });
  }, []);

  const handleColResizeUp = useCallback(() => {
    const resize = colResizeRef.current;
    if (resize) saveLeftColWidth('dpr', resize.key, resize.lastWidth ?? resize.startWidth);
    colResizeRef.current = null;
    window.removeEventListener('pointermove', handleColResizeMove);
    window.removeEventListener('pointerup', handleColResizeUp);
    document.body.style.cursor = '';
  }, [handleColResizeMove]);

  const startColResize = useCallback((key, event) => {
    event.preventDefault();
    event.stopPropagation();
    const startWidth = colWidthsRef.current[key];
    colResizeRef.current = { key, startX: event.clientX, startWidth, lastWidth: startWidth };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', handleColResizeMove);
    window.addEventListener('pointerup', handleColResizeUp);
  }, [handleColResizeMove, handleColResizeUp]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handleColResizeMove);
    window.removeEventListener('pointerup', handleColResizeUp);
    if (colResizeRef.current) document.body.style.cursor = '';
  }, [handleColResizeMove, handleColResizeUp]);

  const changeDateWidth = useCallback((width) => {
    const normalized = normalizeDateWidth(width);
    setDateWidth(normalized);
    try { sessionStorage.setItem(DATE_WIDTH_STORAGE_KEY, String(normalized)); } catch { /* stateで保持 */ }
  }, []);

  const loadPage = useCallback(async (reset = false) => {
    const selectedMachines = JSON.parse(machineKey);
    const categoryFilters = JSON.parse(categoryFilterKey);
    if (!active || selectedMachines.length === 0 || (!reset && (loadingRef.current || !hasMore))) return;
    const requestId = reset ? ++requestIdRef.current : requestIdRef.current;
    loadingRef.current = true;
    setLoading(true);
    try {
      const response = await apiJson('/dpr/groups', {
        method: 'POST',
        body: JSON.stringify({
          machines: selectedMachines, from: startDate, to: endDate, limit: PAGE_SIZE,
          ...categoryFilters,
          ...(reset || !cursorRef.current ? {} : { after_dpr_no: cursorRef.current }),
        }),
      });
      if (requestId !== requestIdRef.current) return;
      setGroups(previous => reset ? response.groups : [...previous, ...response.groups]);
      setPlans(previous => reset ? response.plans : [...previous, ...response.plans]);
      cursorRef.current = response.nextCursor;
      setHasMore(!!response.hasMore);
    } catch {
      if (requestId === requestIdRef.current) errorRef.current?.('DPR予定データの取得に失敗しました');
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [active, machineKey, categoryFilterKey, startDate, endDate, hasMore]);

  useEffect(() => {
    if (!active) return;
    requestIdRef.current += 1;
    cursorRef.current = null;
    setGroups([]);
    setPlans([]);
    setHasMore(false);
    loadingRef.current = false;
    if (machines.length === 0) {
      errorRef.current?.('機種を1つ以上選択してください');
      return;
    }
    loadPage(true);
  }, [active, machineKey, categoryFilterKey, startDate, endDate, displaySettingsApplyVersion, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    apiArray('/calendar/search', { method: 'POST', body: JSON.stringify({ from: startDate, to: endDate }) })
      .then(rows => {
        if (!cancelled) setCalendarData(new Map(rows.map(row => [row.date, { dayType: row.dayType }])));
      })
      .catch(() => { if (!cancelled) errorRef.current?.('カレンダーの取得に失敗しました'); });
    return () => { cancelled = true; };
  }, [active, startDate, endDate]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const update = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, []);

  const dateColumns = useMemo(() => buildDateColumns(startDate, endDate, calendarData), [startDate, endDate, calendarData]);
  const totalCols = Math.max(1, dateColumns.length * (viewMode === 'slot' ? SLOT_COUNT : 1));
  const { groups: layoutGroups, totalRows } = useMemo(
    () => layoutPlans(plans, 'dpr', groups, viewMode, startDate, 4),
    [plans, groups, viewMode, startDate],
  );
  const contentWidth = Math.max(totalCols * colW, viewport.width);
  const contentHeight = Math.max(totalRows * CELL_SIZE, viewport.height);
  const visRowStart = Math.max(0, Math.floor(scroll.top / CELL_SIZE));
  const visRowEnd = Math.ceil((scroll.top + viewport.height) / CELL_SIZE);
  const visColStart = Math.max(0, Math.floor(scroll.left / colW));
  const visColEnd = Math.min(totalCols - 1, Math.ceil((scroll.left + viewport.width) / colW));

  const handleGenerated = useCallback((count) => {
    setReloadTick(value => value + 1);
    onGenerated?.(count);
  }, [onGenerated]);

  const generateDpr = useCallback(async () => {
    if (!window.confirm('既存のm_dprデータを削除してサンプルデータを生成します。実行しますか？')) return;
    setGenerating(true);
    try {
      const result = await apiJson('/seed/dpr', { method: 'POST', body: JSON.stringify({}) });
      handleGenerated(Number(result?.inserted ?? 0));
    } catch {
      errorRef.current?.('m_dprサンプルデータの生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  }, [handleGenerated]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#fff' }}>
      <DprToolbar
        startDate={startDate} onStartDateChange={setStartDate}
        onShiftMonth={months => setStartDate(current => shiftMonth(current, months))}
        dateWidth={dateWidth} onDateWidthChange={changeDateWidth}
        onGenerate={generateDpr} generating={generating}
      />
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <DprLeftHeaderCorner colWidths={colWidths} onStartResize={startColResize} />
        <div style={{ position: 'absolute', left: leftWidth, right: 0, top: 0, height: TOTAL_HDR_H, overflow: 'hidden', borderBottom: '1px solid #9ca3af' }}>
          <div style={{ position: 'relative', width: contentWidth, height: TOTAL_HDR_H, transform: `translateX(${-scroll.left}px)` }}>
            <SpreadsheetGridHeaders viewMode={viewMode} colW={colW} dateColumns={dateColumns} scrollLeft={scroll.left} containerW={viewport.width} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, top: TOTAL_HDR_H, bottom: 0, width: leftWidth, overflow: 'hidden', borderRight: '1px solid #9ca3af' }}>
          <DprLeftHeader layoutGroups={layoutGroups} scrollTop={scroll.top} viewportHeight={viewport.height} colWidths={colWidths} leftWidth={leftWidth} />
        </div>
        <div
          ref={viewportRef}
          onScroll={(event) => {
            const element = event.currentTarget;
            // Safariは末端のバウンス中に最大値を超えたscrollTop/scrollLeftを返すため、
            // 固定ヘッダの追従値を実スクロール範囲内へ制限する。
            const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
            const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
            const left = Math.max(0, Math.min(maxLeft, element.scrollLeft));
            const top = Math.max(0, Math.min(maxTop, element.scrollTop));
            if (element.scrollLeft !== left) element.scrollLeft = left;
            if (element.scrollTop !== top) element.scrollTop = top;
            setScroll({ left, top });
            if (hasMore && !loadingRef.current && top + element.clientHeight >= element.scrollHeight - 400) loadPage(false);
          }}
          style={{ position: 'absolute', left: leftWidth, right: 0, top: TOTAL_HDR_H, bottom: 0, overflow: 'auto', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ position: 'relative', width: contentWidth, height: contentHeight }}>
            <div style={{ position: 'absolute', left: scroll.left, top: scroll.top, width: viewport.width, height: viewport.height }}>
              <SpreadsheetGridCanvas
                width={viewport.width} height={viewport.height} scrollLeft={scroll.left} scrollTop={scroll.top}
                visColStart={visColStart} visColEnd={visColEnd} visRowStart={visRowStart} visRowEnd={visRowEnd}
                colW={colW} dateColumns={dateColumns} viewMode={viewMode} mode="dpr"
                layoutGroups={layoutGroups} locationRowAbsSet={new Set()}
              />
            </div>
            <DprBars
              layoutGroups={layoutGroups} startDate={startDate} viewMode={viewMode} colW={colW}
              totalCols={totalCols} scrollLeft={scroll.left} viewportWidth={viewport.width}
              visRowStart={visRowStart} visRowEnd={visRowEnd}
            />
          </div>
        </div>
        {loading && <div style={{ position: 'absolute', right: 18, bottom: 18, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.92)', boxShadow: '0 1px 5px rgba(0,0,0,0.2)', fontSize: 12, color: '#6b7280' }}>読み込み中...</div>}
      </div>
      <SpreadsheetGridStatusBar
        groupCount={groups.length}
        mode="dpr"
        totalRows={totalRows}
        dayCount={daysBetween(startDate, endDate)}
        planCount={plans.length}
        selectedCount={0}
        copiedCount={0}
        loading={loading}
      />
    </div>
  );
}
