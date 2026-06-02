import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { apiArray, apiJson } from '../lib/api';
import ContextMenu from './ContextMenu';
import BarTooltip from './BarTooltip';
import ScheduleDialog from './ScheduleDialog';
import SpreadsheetGridToolbar from './SpreadsheetGridToolbar';
import SpreadsheetGridStatusBar from './SpreadsheetGridStatusBar';
import SpreadsheetGridHeaders from './SpreadsheetGridHeaders';
import SpreadsheetGridCanvas from './SpreadsheetGridCanvas';
import SpreadsheetGridBars from './SpreadsheetGridBars';
import SpreadsheetGridLeftHeader from './SpreadsheetGridLeftHeader';
import SpreadsheetGridLocationOverlayBars from './SpreadsheetGridLocationOverlayBars';
import DeviceHeaderTooltip from './DeviceHeaderTooltip';
import AlertToast from './AlertToast';
import {
  CELL_SIZE,
  HDR_H,
  TOTAL_HDR_H,
  MIN_ROWS,
  MIN_ROWS_LOCATION,
  BUFFER_ROWS,
  DEV_HDR_W,
  ASGN_HDR_W,
  SLOT_COUNT,
  HANDLE_W,
  SLOT_LABELS,
  TODAY_STR,
  dateToStr,
  addDays,
  daysBetween,
  getWeekNumber,
  colToDateStr,
  planToStartCol,
  planToEndCol,
  colToDateTime,
  layoutPlans,
  computeGaps,
} from '../lib/spreadsheet';

const SpreadsheetGrid = forwardRef(function SpreadsheetGrid({
  active = true,
  mode, serials, workers, tasks, locations, displaySettings,
  onJumpToOtherTab, onEnsureMasters, jumpTarget, onJumpHandled, onJumpError,
  onRangeChange, onDirtyChange,
}, ref) {
  const today = new Date();
  const [startDate, setStartDate] = useState(() => dateToStr(today));
  const [displayMonths, setDisplayMonths] = useState(4);
  const [deviceCount, setDeviceCount] = useState(1000);
  const [viewMode, setViewMode] = useState('day');
  const [plans, setPlans] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [serialSearchText, setSerialSearchText] = useState('');
  const [forcedSerialId, setForcedSerialId] = useState(null);
  const [serialSearchTick, setSerialSearchTick] = useState(0);

  // 保存保留中の変更（移動/リサイズ/削除/貼り付け）を蓄積する
  // pendingCreates: Map<tempId(負数), payload>  pendingUpdates: Map<planId, payload>  pendingDeletes: Set<planId(正数のみ)>
  const pendingCreatesRef = useRef(new Map());
  const pendingUpdatesRef = useRef(new Map());
  const pendingDeletesRef = useRef(new Set());
  const tempIdCounterRef  = useRef(-1); // 貼り付け時のローカル仮ID（負数）

  const [contextMenu, setContextMenu] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [scheduleDialog, setScheduleDialog] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [selectedCell, setSelectedCell] = useState(null);
  const [copied, setCopied] = useState([]);
  const [sonar, setSonar] = useState(null);
  const sonarClearTimerRef = useRef(null);
  const sonarRafRef = useRef(null);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const fetchedRangesRef    = useRef([]);
  const pendingFetchRef     = useRef(false); // 非アクティブ時の displaySettings 変更を遅延フェッチするフラグ
  const [locationOverlayPlans, setLocationOverlayPlans] = useState([]);
  const fetchedLocRangesRef = useRef([]);
  const pendingLocFetchRef  = useRef(false);
  const [calendarData, setCalendarData] = useState(new Map()); // dateStr → { dayType, memo }
  const fetchedCalendarRangesRef = useRef([]);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerH, setContainerH] = useState(600);
  const [containerW, setContainerW] = useState(1200);

  const dragRef = useRef(null);
  const [rectSelect, setRectSelect] = useState(null); // {absX1,absY1,absX2,absY2} in content coords
  const suppressNextCellClickRef = useRef(false);
  const layoutGroupsRef = useRef([]);
  const jumpAttemptsRef = useRef(0);
  const prevJumpTargetRef = useRef(null);
  const pendingScrollSerialIdRef = useRef(null);

  const showShippingDate = mode === 'device' && !!displaySettings.showShippingDateInDevice;
  const showResponsible  = mode === 'device' && !!displaySettings.showResponsibleInDevice;
  const deviceExtraW = (showShippingDate ? ASGN_HDR_W : 0) + (showResponsible ? ASGN_HDR_W : 0);
  const leftHdrW = mode === 'device' ? DEV_HDR_W + deviceExtraW
           : (mode === 'worker' || mode === 'task') ? ASGN_HDR_W * 2
           : ASGN_HDR_W;
  const planEndpoint = mode === 'location' ? '/location-plan' : '/plan';
  const planMinRows  = mode === 'location' ? MIN_ROWS_LOCATION : MIN_ROWS;
  const extraLocationRow = mode === 'device' && !!displaySettings.showLocationInDevice;

  const endDate = useMemo(() => addDays(startDate, displayMonths * 30), [startDate, displayMonths]);

  // 表示範囲を親へ通知（ジャンプ前チェックに使用）
  useEffect(() => {
    onRangeChange?.({ startDate, endDate });
  }, [startDate, endDate]);

  const totalCols = useMemo(() => {
    const days = daysBetween(startDate, endDate);
    return viewMode === 'day' ? days : days * SLOT_COUNT;
  }, [startDate, endDate, viewMode]);

  const baseDeviceGroups = useMemo(() => {
    if (mode !== 'device') return [];
    const { selectedKisyuIds = [] } = displaySettings;
    let s = serials;
    if (selectedKisyuIds.length > 0) {
      s = s.filter(ser => selectedKisyuIds.includes(String(ser.kisyuId)));
    }
    s = [...s].sort((a, b) => {
      if (a.sortNo !== b.sortNo) return a.sortNo - b.sortNo;
      return a.serialNo.localeCompare(b.serialNo, 'ja', { numeric: true });
    });
    return s.slice(0, deviceCount).map(ser => ({
      id: ser.serialId,
      label1: ser.kisyuName,
      label2: ser.serialNo,
      label3: ser.shippingDate || null,
      label4: ser.responsible || null,
      kisyuId: ser.kisyuId,
    }));
  }, [mode, serials, displaySettings, deviceCount]);

  const filteredGroups = useMemo(() => {
    const { selectedTeamIds = [] } = displaySettings;
    if (mode === 'device') {
      if (forcedSerialId != null) {
        const ser = serials.find(s => s.serialId === forcedSerialId);
        if (ser) {
          return [{
            id: ser.serialId,
            label1: ser.kisyuName,
            label2: ser.serialNo,
            label3: ser.shippingDate || null,
            label4: ser.responsible || null,
            kisyuId: ser.kisyuId,
          }];
        }
      }
      return baseDeviceGroups;
    } else if (mode === 'location') {
      return (locations || []).map(loc => ({
        id: loc.locationId,
        label1: loc.locationName,
        label2: '',
      }));
    } else if (mode === 'task') {
      const { selectedTaskTabIds = [] } = displaySettings;
      let t = tasks;
      if (selectedTaskTabIds.length > 0) {
        t = t.filter(task => selectedTaskTabIds.includes(task.taskId));
      }
      return [...t]
        .sort((a, b) => {
          const pd = (a.processSortNo || 0) - (b.processSortNo || 0);
          return pd !== 0 ? pd : (a.sortNo || 0) - (b.sortNo || 0);
        })
        .map(task => ({
          id: task.taskId,
          label1: task.processName || '(未設定)',
          label2: task.taskName,
        }));
    } else {
      let w = workers;
      if (selectedTeamIds.length > 0) {
        w = w.filter(wr => selectedTeamIds.includes(wr.teamId));
      }
      return w.map(wr => ({ id: wr.workerId, label1: wr.workerName, label2: '', teamName: wr.teamName }));
    }
  }, [mode, serials, workers, locations, displaySettings, baseDeviceGroups, forcedSerialId]);

  const { groups: layoutGroups, totalRows } = useMemo(() => {
    const groupKey = mode === 'device' ? 'device' : mode === 'worker' ? 'worker' : mode === 'task' ? 'task' : 'location';
    const locPlans = extraLocationRow ? locationOverlayPlans : null;
    const activePlans = plans.filter(p => !p.deleted);
    const result = layoutPlans(activePlans, groupKey, filteredGroups, viewMode, startDate, planMinRows, locPlans);

    if (mode !== 'worker' || !displaySettings.showUnassignedWorker) return result;

    // 担当者未定の予定（workerId === null）を製番別にグループ化して末尾に追加
    const unassignedPlans = activePlans.filter(p => p.workerId == null);
    const serialMap = new Map();
    for (const plan of unassignedPlans) {
      if (!serialMap.has(plan.serialId)) serialMap.set(plan.serialId, []);
      serialMap.get(plan.serialId).push(plan);
    }

    const sortedSerialIds = [...serialMap.keys()].sort((a, b) => {
      const sa = serials.find(s => s.serialId === a);
      const sb = serials.find(s => s.serialId === b);
      const kc = (sa?.kisyuName || '').localeCompare(sb?.kisyuName || '', 'ja');
      if (kc !== 0) return kc;
      return (sa?.serialNo || '').localeCompare(sb?.serialNo || '', 'ja', { numeric: true });
    });

    let uaStartRow = result.totalRows;
    const extraGroups = [];
    for (const serialId of sortedSerialIds) {
      const uaPlans = serialMap.get(serialId);
      const serial = serials.find(s => s.serialId === serialId);
      const sorted = [...uaPlans].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      const rows = Array.from({ length: planMinRows }, () => null);
      const laidOutPlans = [];
      for (const plan of sorted) {
        const startCol = planToStartCol(plan, startDate, viewMode);
        const endCol = planToEndCol(plan, startDate, viewMode);
        let rowIdx = -1;
        for (let r = 0; r < rows.length; r++) {
          if (rows[r] === null || rows[r] <= startCol) { rowIdx = r; break; }
        }
        if (rowIdx === -1) { rowIdx = rows.length; rows.push(null); }
        rows[rowIdx] = endCol + 1;
        laidOutPlans.push({ ...plan, rowIdx });
      }
      const numRows = Math.max(planMinRows, rows.length);
      extraGroups.push({
        id: `ua-${serialId}`,
        label1: serial?.kisyuName || '',
        label2: serial?.serialNo || '',
        isUnassigned: true,
        teamName: '',
        startRow: uaStartRow,
        numRows,
        plans: laidOutPlans,
        locationRowIdx: -1,
        locationNumRows: 0,
        locationPlans: [],
      });
      uaStartRow += numRows;
    }
    return { groups: [...result.groups, ...extraGroups], totalRows: uaStartRow };
  }, [plans, filteredGroups, mode, viewMode, startDate, planMinRows, extraLocationRow, locationOverlayPlans, serials, displaySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // 矩形選択のクロージャ内から常に最新レイアウトを参照できるようにする
  layoutGroupsRef.current = layoutGroups;

  // 場所表示行の絶対行番号セット（renderCells でセルの背景色を変えるために使用）
  const locationRowAbsSet = useMemo(() => {
    if (!extraLocationRow) return new Set();
    const s = new Set();
    for (const g of layoutGroups) {
      if (g.locationRowIdx >= 0) {
        for (let i = 0; i < (g.locationNumRows || 1); i++) {
          s.add(g.startRow + g.locationRowIdx + i);
        }
      }
    }
    return s;
  }, [layoutGroups, extraLocationRow]);

  const totalH = totalRows * CELL_SIZE;
  const colW = CELL_SIZE;

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setContainerH(e.contentRect.height);
        setContainerW(e.contentRect.width);
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // スクロール方向への先読み日数。この日数分ビューポート外を事前にフェッチしておくことで
  // ユーザーがスクロールした瞬間にデータが揃っている状態を作る。
  const PREFETCH_DAYS = 30;

  // ビューポート幅から可視日数を算出するヘルパー
  const visibleDayCount = useCallback(() => {
    return viewMode === 'day'
      ? Math.ceil(containerW / colW)
      : Math.ceil(containerW / (colW * SLOT_COUNT));
  }, [viewMode, containerW, colW]);

  // 初期フェッチ終了日：可視日数 + バッファ（表示期間内に収める）
  const initFetchEndDate = useCallback(() => {
    const days = Math.min(visibleDayCount() + PREFETCH_DAYS, daysBetween(startDate, endDate));
    return addDays(startDate, Math.max(days, 0));
  }, [visibleDayCount, startDate, endDate]);

  // 表示設定から API 検索ボディのフィルタ部分を構築する
  function buildFilterBody() {
    const { selectedKisyuIds = [], selectedTeamIds = [], selectedTaskIds = [], showUnassignedWorker = false } = displaySettings;
    const body = {};
    if (mode === 'device') {
      if (selectedKisyuIds.length > 0) body.kisyu_ids = selectedKisyuIds.map(Number);
    } else if (mode === 'worker') {
      if (selectedTeamIds.length > 0) body.team_ids = selectedTeamIds;
      if (selectedTaskIds.length > 0) body.task_ids = selectedTaskIds;
      if (showUnassignedWorker) body.show_unassigned_worker = true;
    } else if (mode === 'task') {
      const { selectedTaskTabIds = [] } = displaySettings;
      if (selectedTaskTabIds.length > 0) body.task_ids = selectedTaskTabIds;
    }
    return body;
  }

  const fetchPlans = useCallback(async (from, to) => {
    const gaps = computeGaps(fetchedRangesRef.current, from, to);
    if (gaps.length === 0) return;
    const filter = buildFilterBody();
    await Promise.all(gaps.map(async (gap) => {
      try {
        const data = await apiArray(`${planEndpoint}/search`, {
          method: 'POST',
          body: JSON.stringify({ from: gap.from, to: gap.to, ...filter }),
        });
        setPlans(prev => {
          const existingIds = new Set(prev.map(p => p.planId));
          const newPlans = data.filter(p => !existingIds.has(p.planId));
          return newPlans.length ? [...prev, ...newPlans] : prev;
        });
        fetchedRangesRef.current.push(gap);
      } catch (e) {
        console.error('fetchPlans error', e);
      }
    }));
  }, [planEndpoint, mode, displaySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // 表示期間・表示設定変更時：アクティブタブのみ即時フェッチ。非アクティブは pending フラグを立てて遅延
  useEffect(() => {
    fetchedRangesRef.current = [];
    setPlans([]);
    if (active) {
      pendingFetchRef.current = false;
      fetchPlans(startDate, initFetchEndDate());
    } else {
      pendingFetchRef.current = true;
    }
  }, [startDate, endDate, displaySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLocationOverlayPlans = useCallback(async (from, to) => {
    const gaps = computeGaps(fetchedLocRangesRef.current, from, to);
    if (gaps.length === 0) return;
    const { selectedKisyuIds = [] } = displaySettings;
    const filter = selectedKisyuIds.length > 0 ? { kisyu_ids: selectedKisyuIds.map(Number) } : {};
    await Promise.all(gaps.map(async (gap) => {
      try {
        const data = await apiArray('/location-plan/search', {
          method: 'POST',
          body: JSON.stringify({ from: gap.from, to: gap.to, ...filter }),
        });
        setLocationOverlayPlans(prev => {
          const existingIds = new Set(prev.map(p => p.planId));
          const newPlans = data.filter(p => !existingIds.has(p.planId));
          return newPlans.length ? [...prev, ...newPlans] : prev;
        });
        fetchedLocRangesRef.current.push(gap);
      } catch (e) {
        console.error('fetchLocationOverlayPlans error', e);
      }
    }));
  }, [displaySettings]);

  const fetchCalendar = useCallback(async (from, to) => {
    const gaps = computeGaps(fetchedCalendarRangesRef.current, from, to);
    if (gaps.length === 0) return;
    await Promise.all(gaps.map(async (gap) => {
      try {
        const data = await apiArray('/calendar/search', {
          method: 'POST',
          body: JSON.stringify({ from: gap.from, to: gap.to }),
        });
        setCalendarData(prev => {
          const next = new Map(prev);
          for (const c of data) next.set(c.date, { dayType: c.dayType, memo: c.memo });
          return next;
        });
        fetchedCalendarRangesRef.current.push(gap);
      } catch (e) {
        console.error('fetchCalendar error', e);
      }
    }));
  }, []);

  // 表示期間変更時に表示範囲全体のカレンダーを取得（カレンダーデータは設定に依存しない）
  useEffect(() => {
    fetchedCalendarRangesRef.current = [];
    setCalendarData(new Map());
    fetchCalendar(startDate, endDate);
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // showLocationInDevice の ON/OFF 切り替え、または表示期間・設定変更時に場所予定をフェッチ
  useEffect(() => {
    if (!extraLocationRow) {
      setLocationOverlayPlans([]);
      fetchedLocRangesRef.current = [];
      pendingLocFetchRef.current = false;
      return;
    }
    fetchedLocRangesRef.current = [];
    if (active) {
      pendingLocFetchRef.current = false;
      fetchLocationOverlayPlans(startDate, initFetchEndDate());
    } else {
      pendingLocFetchRef.current = true;
    }
  }, [extraLocationRow, startDate, endDate, displaySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // 保存・キャンセルを親から呼び出せるようにする
  useImperativeHandle(ref, () => ({
    async saveChanges() {
      const creates = pendingCreatesRef.current;
      const updates = pendingUpdatesRef.current;
      const deletes = pendingDeletesRef.current;

      // 新規作成（貼り付け）：仮IDを DB の本IDで置き換える
      for (const [tempId, payload] of creates) {
        try {
          const newPlan = await apiJson(planEndpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          setPlans(prev => prev.map(p => p.planId === tempId ? { ...p, ...newPlan } : p));
        } catch (err) { console.error('saveChanges create error', err); }
      }

      // 削除（DB 上に存在する正のIDのみ）
      if (deletes.size > 0) {
        try {
          await apiJson(planEndpoint, {
            method: 'DELETE',
            body: JSON.stringify({ ids: [...deletes].map(String) }),
          });
        } catch (err) { console.error('saveChanges delete error', err); }
      }

      // 更新（削除済みは除外）
      for (const [planId, payload] of updates) {
        if (deletes.has(planId)) continue;
        try {
          await apiJson(`${planEndpoint}/${planId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } catch (err) { console.error('saveChanges update error', err); }
      }

      pendingCreatesRef.current = new Map();
      pendingUpdatesRef.current = new Map();
      pendingDeletesRef.current = new Set();
      setIsDirty(false);
      onDirtyChange?.(false);
    },
    async cancelChanges() {
      pendingCreatesRef.current = new Map();
      pendingUpdatesRef.current = new Map();
      pendingDeletesRef.current = new Set();
      tempIdCounterRef.current = -1;
      fetchedRangesRef.current = [];
      setPlans([]);
      setIsDirty(false);
      onDirtyChange?.(false);
      await fetchPlans(startDate, initFetchEndDate());
    },
  }), [fetchPlans, initFetchEndDate, startDate, endDate, onDirtyChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = 0;
  }, []);

  const handleSerialSearch = useCallback(() => {
    if (mode !== 'device') return;
    const q = serialSearchText.trim();
    if (!q) {
      setForcedSerialId(null);
      pendingScrollSerialIdRef.current = null;
      setSerialSearchTick(t => t + 1);
      return;
    }

    const exact = serials.find(s => String(s.serialNo) === q);
    const partial = serials.find(s => String(s.serialNo).includes(q));
    const hit = exact || partial;
    if (!hit) return;

    const isInBaseTarget = baseDeviceGroups.some(g => g.id === hit.serialId);
    if (isInBaseTarget) {
      setForcedSerialId(null);
    } else {
      setForcedSerialId(hit.serialId);
    }
    pendingScrollSerialIdRef.current = hit.serialId;
    setSerialSearchTick(t => t + 1);
  }, [mode, serialSearchText, serials, baseDeviceGroups]);

  const onScroll = useCallback(e => {
    const sl = e.currentTarget.scrollLeft;
    const st = e.currentTarget.scrollTop;
    setScrollTop(st);
    setScrollLeft(sl);

    // 横方向：可視日付 ± PREFETCH_DAYS でフェッチ範囲を算出
    const visibleFrom = colToDateStr(startDate, Math.floor(sl / colW), viewMode);
    const visibleTo   = colToDateStr(startDate, Math.ceil((sl + containerW) / colW), viewMode);
    const rawFrom = addDays(visibleFrom, -PREFETCH_DAYS);
    const rawTo   = addDays(visibleTo,    PREFETCH_DAYS);
    const fetchFrom = rawFrom < startDate ? startDate : rawFrom;
    const fetchTo   = rawTo   > endDate   ? endDate   : rawTo;

    fetchPlans(fetchFrom, fetchTo);
    if (extraLocationRow) fetchLocationOverlayPlans(fetchFrom, fetchTo);
    fetchCalendar(fetchFrom, fetchTo);
  }, [startDate, endDate, colW, containerW, viewMode, extraLocationRow, fetchPlans, fetchLocationOverlayPlans, fetchCalendar]);

  const triggerSonar = useCallback((x, y) => {
    if (sonarRafRef.current) cancelAnimationFrame(sonarRafRef.current);
    if (sonarClearTimerRef.current) clearTimeout(sonarClearTimerRef.current);
    sonarRafRef.current = requestAnimationFrame(() => {
      sonarRafRef.current = requestAnimationFrame(() => {
        setSonar({ x, y, key: Date.now() });
        sonarClearTimerRef.current = setTimeout(() => setSonar(null), 2200);
      });
    });
  }, []);

  const visRowStart = Math.max(0, Math.floor(scrollTop / CELL_SIZE) - BUFFER_ROWS);
  const visRowEnd   = Math.min(totalRows - 1, Math.ceil((scrollTop + containerH) / CELL_SIZE) + BUFFER_ROWS);
  const visColStart = Math.max(0, Math.floor(scrollLeft / colW) - 2);
  const visColEnd   = Math.min(totalCols - 1, Math.ceil((scrollLeft + containerW) / colW) + 2);

  // タブ復帰時にスクロール位置/state を再同期し、可視範囲計算のズレによる白画面化を防ぐ
  useEffect(() => {
    if (!active || !scrollRef.current) return;
    const el = scrollRef.current;
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextTop = Math.min(el.scrollTop, maxTop);
    const nextLeft = Math.min(el.scrollLeft, maxLeft);
    if (el.scrollTop !== nextTop) el.scrollTop = nextTop;
    if (el.scrollLeft !== nextLeft) el.scrollLeft = nextLeft;
    setScrollTop(nextTop);
    setScrollLeft(nextLeft);
  }, [active, totalRows, totalCols, containerH, containerW]);

  // 非アクティブ時に積まれた pending フェッチをタブ切り替えで実行
  useEffect(() => {
    if (!active) return;
    if (pendingFetchRef.current) {
      pendingFetchRef.current = false;
      fetchPlans(startDate, initFetchEndDate());
    }
    if (pendingLocFetchRef.current && extraLocationRow) {
      pendingLocFetchRef.current = false;
      fetchLocationOverlayPlans(startDate, initFetchEndDate());
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  function getGroupAtRow(rowIdx) {
    for (const g of layoutGroups) {
      if (rowIdx >= g.startRow && rowIdx < g.startRow + g.numRows) return g;
    }
    return null;
  }

  function getGroupAtY(y) {
    const row = Math.floor(y / CELL_SIZE);
    return getGroupAtRow(row);
  }

  function getPlanBar(plan) {
    const startCol = planToStartCol(plan, startDate, viewMode);
    const endCol = planToEndCol(plan, startDate, viewMode);
    const g = layoutGroups.find(g => g.plans?.some(p => p.planId === plan.planId));
    if (!g) return null;
    const pp = g.plans.find(p => p.planId === plan.planId);
    if (!pp) return null;
    return { startCol, endCol, rowIdx: pp.rowIdx, groupStartRow: g.startRow };
  }

  function handleContentPointerDown(e) {
    if (e.button !== 0) return;
    const scrollEl = scrollRef.current;
    const scrollRect = scrollEl.getBoundingClientRect();

    // ヘッダー領域（sticky部分）のクリックは無視
    if (e.clientY < scrollRect.top + TOTAL_HDR_H) return;

    const startCX = e.clientX;
    const startCY = e.clientY;

    // クライアント座標 → セルコンテンツ内の絶対座標
    const toAbs = (cx, cy) => ({
      x: cx - scrollRect.left + scrollEl.scrollLeft,
      y: cy - scrollRect.top - TOTAL_HDR_H + scrollEl.scrollTop,
    });

    let dragging = false;
    let lastCX = startCX;
    let lastCY = startCY;

    const onMove = (e2) => {
      const dx = e2.clientX - startCX;
      const dy = e2.clientY - startCY;
      if (!dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragging = true;
      }
      lastCX = e2.clientX;
      lastCY = e2.clientY;
      if (dragging) {
        const s = toAbs(startCX, startCY);
        const en = toAbs(e2.clientX, e2.clientY);
        setRectSelect({ x1: s.x, y1: s.y, x2: en.x, y2: en.y });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!dragging) { setRectSelect(null); return; }

      // 次の click イベント（セルの onClick）を抑制
      suppressNextCellClickRef.current = true;
      setTimeout(() => { suppressNextCellClickRef.current = false; }, 0);

      const s = toAbs(startCX, startCY);
      const en = toAbs(lastCX, lastCY);
      const selX1 = Math.min(s.x, en.x);
      const selX2 = Math.max(s.x, en.x);
      const selY1 = Math.min(s.y, en.y);
      const selY2 = Math.max(s.y, en.y);

      const newSelected = new Set();
      for (const g of layoutGroupsRef.current) {
        if (!g.plans) continue;
        for (const p of g.plans) {
          const sc = planToStartCol(p, startDate, viewMode);
          const ec = planToEndCol(p, startDate, viewMode);
          const absRow = g.startRow + p.rowIdx;
          const bx1 = sc * colW;
          const bx2 = (ec + 1) * colW;
          const by1 = absRow * CELL_SIZE;
          const by2 = (absRow + 1) * CELL_SIZE;
          if (bx1 < selX2 && bx2 > selX1 && by1 < selY2 && by2 > selY1) {
            newSelected.add(p.planId);
          }
        }
      }

      setSelected(newSelected);
      setSelectedCell(null);
      setRectSelect(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function handleBarPointerDown(e, plan, type) {
    e.stopPropagation();
    if (e.button !== 0) return;

    // 選択処理を pointerdown で行う（preventDefault を外したので click も生きるが、こちらで完結させる）
    setSelectedCell(null);
    if (e.ctrlKey || e.metaKey) {
      setSelected(prev => {
        const s = new Set(prev);
        s.has(plan.planId) ? s.delete(plan.planId) : s.add(plan.planId);
        return s;
      });
    } else {
      // 既に複数選択に含まれている場合はそのままにしてドラッグできるようにする
      setSelected(prev => prev.has(plan.planId) ? prev : new Set([plan.planId]));
    }

    if (mode === 'task') return;

    const bar = getPlanBar(plan);
    if (!bar) return;

    const startX = e.clientX;
    const startY = e.clientY;

    // selectedRef を使ってポインターキャプチャ後も最新の選択状態を参照できるようにする
    const capturedSelected = selected.has(plan.planId) ? selected : new Set([plan.planId]);
    const dragPlans = [...capturedSelected].map(id => plans.find(p => p.planId === id)).filter(Boolean);
    if (!dragPlans.some(p => p.planId === plan.planId)) dragPlans.push(plan);

    dragRef.current = {
      type,
      plan,
      dragPlans,
      startX, startY,
      deltaCol: 0, deltaRow: 0,
      active: false,
    };

    const onMove = (e2) => {
      if (!dragRef.current) return;
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      const dc = Math.round(dx / colW);
      const dr = Math.round(dy / CELL_SIZE);
      if (!dragRef.current.active && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragRef.current.active = true;
      }
      dragRef.current.deltaCol = dc;
      dragRef.current.deltaRow = dr;
      containerRef.current && (containerRef.current._dragState = { ...dragRef.current });
      containerRef.current?.dispatchEvent(new CustomEvent('dragupdate'));
    };

    const onUp = async () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!dragRef.current || !dragRef.current.active) { dragRef.current = null; return; }
      await commitDrag(dragRef.current);
      dragRef.current = null;
      setGhostDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async function commitDrag(drag) {
    const { type, plan, dragPlans, deltaCol, deltaRow } = drag;

    // 複数選択ドラッグ時の移動先グループは、ドラッグ主対象の着地先を全プランに共通適用する
    let destGroupId = null;
    if (type === 'move' && deltaRow !== 0) {
      const mainBar = getPlanBar(plan);
      if (mainBar) {
        const destAbsRow = mainBar.groupStartRow + mainBar.rowIdx + deltaRow;
        const destGroup  = getGroupAtRow(destAbsRow);
        if (destGroup) destGroupId = destGroup.id;
      }
    }

    for (const dp of dragPlans) {
      const dpBar = getPlanBar(dp);
      if (!dpBar) continue;

      let newStartCol = dpBar.startCol;
      let newEndCol = dpBar.endCol;

      if (type === 'move') {
        newStartCol = dpBar.startCol + deltaCol;
        newEndCol = dpBar.endCol + deltaCol;
      } else if (type === 'resize-left') {
        newStartCol = Math.min(dpBar.endCol, dpBar.startCol + deltaCol);
      } else {
        newEndCol = Math.max(dpBar.startCol, dpBar.endCol + deltaCol);
      }

      newStartCol = Math.max(0, Math.min(newStartCol, totalCols - 1));
      newEndCol = Math.max(newStartCol, Math.min(newEndCol, totalCols - 1));

      const newStartDate = colToDateTime(startDate, newStartCol, 'start', viewMode);
      const newEndDate = colToDateTime(startDate, newEndCol, 'end', viewMode);

      // 移動先グループが確定している場合は全プランを同一グループへ
      let newSerialId   = dp.serialId;
      let newWorkerId   = dp.workerId;
      let newLocationId = dp.locationId;
      if (destGroupId !== null) {
        if (mode === 'device')   newSerialId   = destGroupId;
        else if (mode === 'worker') newWorkerId = destGroupId;
        else newLocationId = destGroupId;
      }

      // API は呼ばず、ローカル state を即時更新して保留リストに積む
      const payload = mode === 'location'
        ? { locationId: newLocationId, serialId: newSerialId, startDate: newStartDate, endDate: newEndDate }
        : { serialId: newSerialId, taskId: dp.taskId, workerId: newWorkerId, startDate: newStartDate, endDate: newEndDate };
      setPlans(prev => prev.map(p =>
        p.planId === dp.planId ? { ...p, ...payload } : p
      ));
      pendingUpdatesRef.current.set(dp.planId, payload);
      setIsDirty(true);
      onDirtyChange?.(true);
    }
  }

  const [ghostDrag, setGhostDrag] = useState(null);

  useEffect(() => {
    const handler = () => {
      if (containerRef.current?._dragState) {
        setGhostDrag({ ...containerRef.current._dragState });
      }
    };
    containerRef.current?.addEventListener('dragupdate', handler);
    return () => containerRef.current?.removeEventListener('dragupdate', handler);
  }, []);

  function handleCellRightClick(e, col, row) {
    e.preventDefault();
    if (mode === 'task') return;
    setSelectedCell({ col, row });
    setSelected(new Set());
    const g = getGroupAtRow(row);
    const colDate = colToDateStr(startDate, col, viewMode);
    const items = [
      {
        label: '予定を追加',
        onClick: () => {
          const dateStr = colToDateTime(startDate, col, 'start', viewMode);
          const endStr = colToDateTime(startDate, col + (viewMode === 'slot' ? 5 : 0), 'end', viewMode);
          openScheduleDialog({
            plan: null,
            initialData: {
              locationId: mode === 'location' ? g?.id : null,
              serialId:   mode === 'device'   ? g?.id : null,
              workerId:   mode === 'worker'   ? g?.id : null,
              startDate: dateStr,
              endDate: endStr,
            }
          });
        }
      },
      ...(copied.length > 0 ? [{
        label: `貼り付け（${copied.length}件）`,
        onClick: () => pastePlans(col, row),
      }] : []),
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }

  function handleBarRightClick(e, plan) {
    e.preventDefault();
    e.stopPropagation();
    // 右クリックしたバーが既存の複数選択に含まれていない場合は単一選択に切り替え
    const alreadyInMulti = selected.size > 1 && selected.has(plan.planId);
    if (!alreadyInMulti) {
      setSelected(new Set([plan.planId]));
      setSelectedCell(null);
    }
    if (mode === 'task') {
      setContextMenu({ x: e.clientX, y: e.clientY, items: [
        { label: '詳細', onClick: () => setTooltip({ plan, x: e.clientX, y: e.clientY }) },
      ]});
      return;
    }
    const isMulti = alreadyInMulti;
    const n = isMulti ? selected.size : 1;
    const jumpItem = mode === 'device'
      ? { label: '担当者予定を表示', onClick: () => onJumpToOtherTab && onJumpToOtherTab(plan, 'worker') }
      : mode === 'worker'
      ? { label: '装置予定を表示',  onClick: () => onJumpToOtherTab && onJumpToOtherTab(plan, 'device') }
      : null;

    const items = isMulti ? [
      { label: `${n}件コピー`, onClick: () => {
        const toCopy = [...selected].map(id => plans.find(p => p.planId === id)).filter(Boolean);
        setCopied(toCopy);
      }},
      'separator',
      { label: `${n}件削除`, danger: true, onClick: () => {
        deletePlans([...selected]);
      }},
    ] : [
      { label: '詳細', onClick: () => setTooltip({ plan, x: e.clientX, y: e.clientY }) },
      { label: '編集', onClick: () => openScheduleDialog({ plan }) },
      { label: 'コピー', onClick: () => setCopied([plan]) },
      'separator',
      { label: '削除', danger: true, onClick: () => deletePlans([plan.planId]) },
      ...(jumpItem ? ['separator', jumpItem] : []),
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }

  function deletePlans(ids) {
    // API は呼ばず、ローカル state を即時更新して保留リストに積む
    setPlans(prev => prev.filter(p => !ids.includes(p.planId)));
    setSelected(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    ids.forEach(id => {
      if (id < 0) {
        // 貼り付けで生成した仮ID → DB には存在しないので creates から除去するだけ
        pendingCreatesRef.current.delete(id);
      } else {
        // DB 上に存在するプラン → 削除リストへ（更新リストから除外）
        pendingDeletesRef.current.add(id);
        pendingUpdatesRef.current.delete(id);
      }
    });
    setIsDirty(true);
    onDirtyChange?.(true);
  }

  function pastePlans(targetCol, targetRow) {
    if (!copied.length) return;
    // 貼り付け先の行グループ（装置 or 担当者）を特定
    const targetGroup = getGroupAtRow(targetRow);
    if (!targetGroup) return; // グループが特定できない場合は貼り付けしない

    // 貼り付け先の serialId / workerId / locationId（全プランに共通で適用）
    const targetSerialId   = mode === 'device'   ? targetGroup.id : null;
    const targetWorkerId   = mode === 'worker'   ? targetGroup.id : null;
    const targetLocationId = mode === 'location' ? targetGroup.id : null;

    // 先頭プランの開始列を基準に列オフセットを算出
    const firstStartCol = planToStartCol(copied[0], startDate, viewMode);
    const offset = targetCol - firstStartCol;

    const newPlans = [];
    for (const p of copied) {
      const sc = planToStartCol(p, startDate, viewMode) + offset;
      const ec = planToEndCol(p, startDate, viewMode) + offset;
      const newStart = colToDateTime(startDate, Math.max(0, sc), 'start', viewMode);
      const newEnd   = colToDateTime(startDate, Math.max(0, ec), 'end', viewMode);

      // 全プランを貼り付け先の場所/装置/担当者に統一する
      const newSerialId   = mode === 'device'   ? targetSerialId   : p.serialId;
      const newWorkerId   = mode === 'worker'   ? targetWorkerId   : p.workerId;
      const newLocationId = mode === 'location' ? targetLocationId : p.locationId;

      const payload = mode === 'location'
        ? { locationId: newLocationId, serialId: newSerialId, startDate: newStart, endDate: newEnd }
        : { serialId: newSerialId, taskId: p.taskId, workerId: newWorkerId, startDate: newStart, endDate: newEnd };
      const tempId = tempIdCounterRef.current--;
      newPlans.push({ ...p, planId: tempId, ...payload });
      pendingCreatesRef.current.set(tempId, payload);
    }
    setPlans(prev => [...prev, ...newPlans]);
    setIsDirty(true);
    onDirtyChange?.(true);
  }

  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

  async function openScheduleDialog(data) {
    try {
      await onEnsureMasters?.(mode === 'location' ? ['serials', 'locations'] : ['serials', 'workers', 'tasks']);
      setScheduleDialog(data);
    } catch {
      showToast('入力に必要なマスタデータの取得に失敗しました');
    }
  }

  async function savePlan(data) {
    const dialog = scheduleDialog;
    setScheduleDialog(null);
    const payload = mode === 'location'
      ? {
        locationId: data.locationId || dialog.initialData?.locationId,
        serialId:   data.serialId,
        startDate:  data.startDate,
        endDate:    data.endDate,
      }
      : {
        serialId:  data.serialId || (mode === 'device' ? dialog.initialData?.serialId : serials[0]?.serialId),
        taskId:    data.taskId,
        workerId:  data.workerId,
        startDate: data.startDate,
        endDate:   data.endDate,
      };

    if (dialog.plan) {
      // 編集：楽観的に即時反映し、失敗時に元に戻す
      const prevPlan = { ...dialog.plan };
      setPlans(prev => prev.map(p => p.planId === dialog.plan.planId ? { ...p, ...payload } : p));
      try {
        const updated = await apiJson(`${planEndpoint}/${dialog.plan.planId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setPlans(prev => prev.map(p => p.planId === dialog.plan.planId ? { ...p, ...updated } : p));
      } catch {
        setPlans(prev => prev.map(p => p.planId === dialog.plan.planId ? prevPlan : p));
        showToast('予定の更新に失敗しました');
      }
    } else {
      // 新規：仮IDで即時追加し、失敗時に除去する
      const tempId = tempIdCounterRef.current--;
      setPlans(prev => [...prev, { planId: tempId, ...payload }]);
      try {
        const newPlan = await apiJson(planEndpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setPlans(prev => prev.map(p => p.planId === tempId ? { ...p, ...newPlan } : p));
      } catch {
        setPlans(prev => prev.filter(p => p.planId !== tempId));
        showToast('予定の登録に失敗しました');
      }
    }
  }

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const sel = [...selected].map(id => plans.find(p => p.planId === id)).filter(Boolean);
        if (sel.length) setCopied(sel);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (copied.length && mode !== 'task') {
          const col = Math.floor(scrollLeft / colW);
          pastePlans(col);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selected, plans, copied, scrollLeft, colW]);

  useEffect(() => {
    if (!jumpTarget) {
      jumpAttemptsRef.current = 0;
      prevJumpTargetRef.current = null;
      return;
    }
    const { plan, targetMode } = jumpTarget;
    if (targetMode !== mode) return;

    // jumpTarget が切り替わったら試行カウントをリセット
    if (jumpTarget !== prevJumpTargetRef.current) {
      jumpAttemptsRef.current = 0;
      prevJumpTargetRef.current = jumpTarget;
    }

    // planId で直接検索
    let targetGroup = null;
    let targetPlanRow = null;
    for (const g of layoutGroups) {
      const pp = g.plans?.find(p => p.planId === plan.planId);
      if (pp) { targetGroup = g; targetPlanRow = pp; break; }
    }

    if (!targetGroup) {
      jumpAttemptsRef.current += 1;
      // 2回目以降（初回フェッチ完了後）も見つからなければエラー
      if (jumpAttemptsRef.current >= 2) {
        onJumpError?.();
        onJumpHandled?.();
        jumpAttemptsRef.current = 0;
      }
      return;
    }

    jumpAttemptsRef.current = 0;

    const col = planToStartCol(plan, startDate, viewMode);
    const endCol = planToEndCol(plan, startDate, viewMode);
    const absRow = targetGroup.startRow + targetPlanRow.rowIdx;

    // バーを画面中央に来るようにスクロール
    const newScrollLeft = Math.max(0, col * colW - (containerW - leftHdrW) / 2);
    const newScrollTop  = Math.max(0, absRow * CELL_SIZE - (containerH - TOTAL_HDR_H) / 2);

    // 書き込み後に実際の値を読み返す（コンテンツ末尾付近でクランプされる場合がある）
    let actualScrollLeft = newScrollLeft;
    let actualScrollTop  = newScrollTop;
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = newScrollLeft;
      scrollRef.current.scrollTop  = newScrollTop;
      actualScrollLeft = scrollRef.current.scrollLeft;
      actualScrollTop  = scrollRef.current.scrollTop;
    }

    // ソナー位置はクランプ後の実際のスクロール値で算出
    const barCenterX = ((col + endCol + 1) * colW) / 2;
    const barX = barCenterX - actualScrollLeft + leftHdrW;
    const barY = absRow * CELL_SIZE - actualScrollTop + TOTAL_HDR_H + CELL_SIZE / 2;
    // 高負荷時のタブ切替直後でも、実際に描画フレームへ乗ってからソナーを開始する
    triggerSonar(barX, barY);
    onJumpHandled?.();
  }, [jumpTarget, layoutGroups, triggerSonar]);

  useEffect(() => {
    return () => {
      if (sonarRafRef.current) cancelAnimationFrame(sonarRafRef.current);
      if (sonarClearTimerRef.current) clearTimeout(sonarClearTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!active || mode !== 'device') return;
    const targetSerialId = pendingScrollSerialIdRef.current;
    if (!targetSerialId || !scrollRef.current) return;
    const g = layoutGroups.find(x => x.id === targetSerialId);
    if (!g) return;
    const newTop = Math.max(0, g.startRow * CELL_SIZE - (containerH - TOTAL_HDR_H) / 2);
    scrollRef.current.scrollTop = newTop;
    const actualTop = scrollRef.current.scrollTop;
    setScrollTop(actualTop);

    const mainRows = g.locationRowIdx >= 0 ? g.locationRowIdx : g.numRows;
    const sonarX = leftHdrW / 2;
    // 製番は装置ヘッダの2行目に表示しているため、メイン領域下寄りに合わせる
    const sonarY = (g.startRow + Math.max(0.6, mainRows * 0.65)) * CELL_SIZE - actualTop + TOTAL_HDR_H;
    triggerSonar(sonarX, sonarY);
    pendingScrollSerialIdRef.current = null;
  }, [active, mode, layoutGroups, containerH, serialSearchTick, leftHdrW, triggerSonar]);

  async function handleSeedApply() {
    fetchedRangesRef.current = [];
    setPlans([]);
    await apiJson('/seed', {
      method: 'POST',
      body: JSON.stringify({ count: deviceCount, baseDate: startDate, months: displayMonths }),
    });
    await fetchPlans(startDate, initFetchEndDate());
  }

  const handleShiftMonth = useCallback((months) => {
    const d = new Date(startDate + 'T00:00:00');
    d.setMonth(d.getMonth() + months);
    setStartDate(dateToStr(d));
  }, [startDate]);

  const dateColumns = useMemo(() => {
    const cols = [];
    const days = daysBetween(startDate, endDate);
    for (let d = 0; d < days; d++) {
      const ds = addDays(startDate, d);
      const dt = new Date(ds + 'T00:00:00');
      const dow = dt.getDay();
      const cal = calendarData.get(ds);
      let type;
      if (cal?.dayType === 1)      type = 'holiday';   // 祝日
      else if (cal?.dayType === 2) type = 'weekday';   // 特別出勤（土曜→平日扱い）
      else if (dow === 0)          type = 'sunday';
      else if (dow === 6)          type = 'saturday';
      else                         type = 'weekday';
      cols.push({ dateStr: ds, day: dt.getDate(), dow, month: dt.getMonth() + 1, year: dt.getFullYear(), week: getWeekNumber(ds), type, calMemo: cal?.memo ?? null });
    }
    return cols;
  }, [startDate, endDate, calendarData]);


  const planCount = plans.filter(p => !p.deleted).length;
  const groupCount = filteredGroups.length;

  function handleDeviceHeaderClick(group, event) {
    if (mode !== 'device') return;
    event.stopPropagation();
    const rect = event.currentTarget?.getBoundingClientRect?.();
    setDeviceDetail({
      kisyuName: group.label1,
      serialNo: group.label2,
      planCount: group.plans?.length ?? 0,
      locationPlanCount: group.locationPlans ? group.locationPlans.length : null,
      x: event.clientX,
      y: event.clientY,
      anchorRect: rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null,
    });
  }

  useEffect(() => {
    const onGlobalPointerDown = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const inHeader = target.closest('[data-device-header="1"]');
      const inTooltip = target.closest('[data-device-tooltip="1"]');
      if (!inHeader && !inTooltip) setDeviceDetail(null);
    };
    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown, true);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <SpreadsheetGridToolbar
        startDate={startDate}
        onStartDateChange={setStartDate}
        onShiftMonth={handleShiftMonth}
        displayMonths={displayMonths}
        onDisplayMonthsChange={setDisplayMonths}
        deviceCount={deviceCount}
        onDeviceCountChange={setDeviceCount}
        onSeedApply={handleSeedApply}
        mode={mode}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        serialSearchText={serialSearchText}
        onSerialSearchTextChange={setSerialSearchText}
        onSerialSearch={handleSerialSearch}
      />

      {/* グリッド本体 */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* 左固定ヘッダー上部コーナー */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: leftHdrW, height: TOTAL_HDR_H, background: '#f3f4f6', borderRight: '1px solid #d1d5db', borderBottom: '1px solid #9ca3af', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
          {mode === 'device' ? (showShippingDate || showResponsible ? (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: DEV_HDR_W, borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>装置</div>
              {showShippingDate && <div style={{ width: ASGN_HDR_W, borderRight: showResponsible ? '1px solid #d1d5db' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>出荷日</div>}
              {showResponsible  && <div style={{ width: ASGN_HDR_W, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>責任者</div>}
            </div>
          ) : '装置') : mode === 'location' ? '場所' : mode === 'task' ? (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: 80, borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>プロセス名</div>
              <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>タスク名</div>
            </div>
          ) : (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: 80, borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>チーム名</div>
              <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>担当者名</div>
            </div>
          )}
        </div>

        {/* Canvas・左固定列はアクティブ時のみ描画 */}
        {active && (
          <>
            {/* Canvas 背景：セル背景色・グリッド線・グループ区切り線を描画。
              スクロール領域の外（viewport-overlay）に固定配置するため、
              コンテンツ量が増えてもメモリ使用量が増加しない。 */}
            <div style={{
              position: 'absolute', left: leftHdrW, top: TOTAL_HDR_H,
              width: Math.max(0, containerW - leftHdrW),
              height: Math.max(0, containerH - TOTAL_HDR_H),
              overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
            }}>
              <SpreadsheetGridCanvas
                width={Math.max(0, containerW - leftHdrW)}
                height={Math.max(0, containerH - TOTAL_HDR_H)}
                scrollLeft={scrollLeft}
                scrollTop={scrollTop}
                visColStart={visColStart}
                visColEnd={visColEnd}
                visRowStart={visRowStart}
                visRowEnd={visRowEnd}
                colW={colW}
                dateColumns={dateColumns}
                viewMode={viewMode}
                layoutGroups={layoutGroups}
                locationRowAbsSet={locationRowAbsSet}
              />
            </div>

            {/* 左固定列（行）*/}
            <div style={{ position: 'absolute', left: 0, top: TOTAL_HDR_H, width: leftHdrW, height: containerH - TOTAL_HDR_H, overflow: 'hidden', zIndex: 10, background: '#f9fafb', borderRight: '1px solid #d1d5db' }}>
              <div style={{ position: 'relative', height: totalH }}>
                <SpreadsheetGridLeftHeader
                  layoutGroups={layoutGroups}
                  scrollTop={scrollTop}
                  containerH={containerH}
                  leftHdrW={leftHdrW}
                  mode={mode}
                  onGroupClick={handleDeviceHeaderClick}
                  showShippingDate={showShippingDate}
                  showResponsible={showResponsible}
                />
              </div>
            </div>
          </>
        )}

        {/* スクロール領域：常時マウントしてスクロール位置を DOM に保持する。
          タブ非アクティブ時は GridTabPane の visibility:hidden で隠れる。
          大きなコンテンツ div も常時レンダリングしてスクロール寸法を維持する。 */}
        <div
          ref={scrollRef}
          style={{ position: 'absolute', left: leftHdrW, top: 0, right: 0, bottom: 0, overflow: 'scroll', zIndex: 1 }}
          onScroll={onScroll}
          onClick={e => {
            if (e.target === scrollRef.current) {
              setSelected(new Set());
              setSelectedCell(null);
            }
          }}
        >
          <div style={{ width: totalCols * colW, height: TOTAL_HDR_H + totalH, position: 'relative' }}>
            {active && (
              <>
                {/* ヘッダー (sticky) */}
                <div style={{ position: 'sticky', top: 0, height: TOTAL_HDR_H, zIndex: 15, background: '#f3f4f6' }}>
                  <div style={{ position: 'relative', height: TOTAL_HDR_H, width: totalCols * colW }}>
                    <SpreadsheetGridHeaders
                      viewMode={viewMode}
                      colW={colW}
                      dateColumns={dateColumns}
                      scrollLeft={scrollLeft}
                      containerW={containerW}
                    />
                  </div>
                </div>
                {/* バー領域：背景は canvas が担当。React は可視範囲の予定バーと選択枠のみ描画 */}
                <div
                  style={{ position: 'relative', height: totalH, cursor: 'cell' }}
                  onPointerDown={handleContentPointerDown}
                  onClick={(e) => {
                    if (suppressNextCellClickRef.current) return;
                    const scrollEl = scrollRef.current;
                    if (!scrollEl) return;
                    const r = scrollEl.getBoundingClientRect();
                    const col = Math.floor((e.clientX - r.left + scrollEl.scrollLeft) / colW);
                    const row = Math.floor((e.clientY - r.top - TOTAL_HDR_H + scrollEl.scrollTop) / CELL_SIZE);
                    if (col >= 0 && col < totalCols && row >= 0 && row < totalRows) {
                      setSelectedCell({ col, row });
                      setSelected(new Set());
                    }
                  }}
                  onContextMenu={(e) => {
                    const scrollEl = scrollRef.current;
                    if (!scrollEl) return;
                    const r = scrollEl.getBoundingClientRect();
                    const col = Math.floor((e.clientX - r.left + scrollEl.scrollLeft) / colW);
                    const row = Math.floor((e.clientY - r.top - TOTAL_HDR_H + scrollEl.scrollTop) / CELL_SIZE);
                    if (col >= 0 && col < totalCols && row >= 0 && row < totalRows) {
                      handleCellRightClick(e, col, row);
                    }
                  }}
                >
                  {/* 選択セル枠（予定バーより前面に表示するため個別要素） */}
                  {selectedCell && (
                    <div style={{
                      position: 'absolute',
                      left: selectedCell.col * colW,
                      top: selectedCell.row * CELL_SIZE,
                      width: colW,
                      height: CELL_SIZE,
                      outline: '2px solid #2563eb',
                      outlineOffset: '-1px',
                      pointerEvents: 'none',
                      zIndex: 5,
                      boxSizing: 'border-box',
                    }} />
                  )}
                  <SpreadsheetGridBars
                    layoutGroups={layoutGroups}
                    startDate={startDate}
                    viewMode={viewMode}
                    colW={colW}
                    totalCols={totalCols}
                    scrollLeft={scrollLeft}
                    containerW={containerW}
                    visRowStart={visRowStart}
                    visRowEnd={visRowEnd}
                    selected={selected}
                    dragRef={dragRef}
                    ghostDrag={ghostDrag}
                    mode={mode}
                    planToStartCol={planToStartCol}
                    planToEndCol={planToEndCol}
                    onBarPointerDown={handleBarPointerDown}
                    onBarRightClick={handleBarRightClick}
                  />
                  <SpreadsheetGridLocationOverlayBars
                    extraLocationRow={extraLocationRow}
                    layoutGroups={layoutGroups}
                    startDate={startDate}
                    viewMode={viewMode}
                    planToStartCol={planToStartCol}
                    planToEndCol={planToEndCol}
                    visRowStart={visRowStart}
                    visRowEnd={visRowEnd}
                    colW={colW}
                    totalCols={totalCols}
                    scrollLeft={scrollLeft}
                    containerW={containerW}
                  />
                  {/* 矩形選択オーバーレイ */}
                  {rectSelect && (
                    <div
                      style={{
                        position: 'absolute',
                        left: Math.min(rectSelect.x1, rectSelect.x2),
                        top: Math.min(rectSelect.y1, rectSelect.y2),
                        width: Math.abs(rectSelect.x2 - rectSelect.x1),
                        height: Math.abs(rectSelect.y2 - rectSelect.y1),
                        background: 'rgba(37,99,235,0.08)',
                        border: '1.5px solid rgba(37,99,235,0.7)',
                        borderRadius: 2,
                        pointerEvents: 'none',
                        zIndex: 30,
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ソナーエフェクト */}
        {active && sonar && [0, 380, 760].map((delay, i) => (
          <div key={`${sonar.key}-${i}`} style={{
            position: 'absolute', left: sonar.x, top: sonar.y,
            width: 72, height: 72, marginLeft: -36, marginTop: -36,
            borderRadius: '50%', border: '4px solid #ef4444',
            animation: `sonar-ring 1100ms ${delay}ms ease-out forwards`,
            zIndex: 100, pointerEvents: 'none',
            transformOrigin: 'center',
          }} />
        ))}
      </div>

      <SpreadsheetGridStatusBar
        groupCount={groupCount}
        mode={mode}
        totalRows={totalRows}
        dayCount={daysBetween(startDate, endDate)}
        planCount={planCount}
        selectedCount={selected.size}
        copiedCount={copied.length}
      />

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
      {tooltip && <BarTooltip plan={tooltip.plan} anchorX={tooltip.x} anchorY={tooltip.y} onClose={() => setTooltip(null)} />}
      {scheduleDialog && (
        <ScheduleDialog
          plan={scheduleDialog.plan}
          initialData={scheduleDialog.initialData}
          serials={serials}
          tasks={tasks}
          workers={workers}
          locations={locations}
          gridMode={mode}
          onSave={savePlan}
          onClose={() => setScheduleDialog(null)}
        />
      )}
      <DeviceHeaderTooltip detail={deviceDetail} onClose={() => setDeviceDetail(null)} />
      <AlertToast message={toast} onClose={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setToast(null); }} />
    </div>
  );
});

export default SpreadsheetGrid;
