import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { apiArray, apiJson } from '../../lib/api';
import {
  CELL_SIZE, SLOT_COUNT, TOTAL_HDR_H, addDays, dateToStr, daysBetween,
  getMonthWeekInfo, layoutPlans,
} from '../../lib/spreadsheet';
import SpreadsheetGridCanvas from '../SpreadsheetGridCanvas';
import SpreadsheetGridHeaders from '../SpreadsheetGridHeaders';
import SpreadsheetGridStatusBar from '../SpreadsheetGridStatusBar';
import ContextMenu from '../ContextMenu';
import UpdateConflictDialog from '../UpdateConflictDialog';
import DprBars from './DprBars';
import DprHeaderTooltip from './DprHeaderTooltip';
import DprScheduleDialog from './DprScheduleDialog';
import DprLeftHeader, { DPR_LEFT_COLUMN_KEYS, DprLeftHeaderCorner } from './DprLeftHeader';
import DprToolbar from './DprToolbar';
import { clampLeftColW, loadLeftColWidths, saveLeftColWidth } from '../../lib/leftHeaderColumns';

const DATE_WIDTH_STORAGE_KEY = 'sz_schedule_date_width_dpr';
const PAGE_SIZE = 200;
const DPR_TASKS = {
  20001: { taskName: 'DPRメカ設計', taskBackColor: 1, taskFontColor: 6 },
  20002: { taskName: 'DPRエレキ設計', taskBackColor: 2, taskFontColor: 6 },
  20003: { taskName: 'DPRソフト設計', taskBackColor: 3, taskFontColor: 6 },
  20004: { taskName: 'DPR他', taskBackColor: 4, taskFontColor: 6 },
};

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

const DprGrid = forwardRef(function DprGrid({ active = false, displaySettings, displaySettingsApplyVersion = 0, onGenerated, onError, onDirtyChange, onHistoryChange }, ref) {
  const [startDate, setStartDate] = useState(() => dateToStr(new Date()));
  const [dateWidth, setDateWidth] = useState(loadDateWidth);
  const [generating, setGenerating] = useState(false);
  const [groups, setGroups] = useState([]);
  const [plans, setPlans] = useState([]);
  const [calendarData, setCalendarData] = useState(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [dprSearchText, setDprSearchText] = useState('');
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [colWidths, setColWidths] = useState(() => loadLeftColWidths('dpr'));
  const [headerDetail, setHeaderDetail] = useState(null);
  const [sonar, setSonar] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [scheduleDialog, setScheduleDialog] = useState(null);
  const [updateConflictDialogOpen, setUpdateConflictDialogOpen] = useState(false);
  const viewportRef = useRef(null);
  const cursorRef = useRef(null);
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const errorRef = useRef(onError);
  const colWidthsRef = useRef(colWidths);
  const colResizeRef = useRef(null);
  const pendingSonarDprNoRef = useRef(null);
  const sonarClearTimerRef = useRef(null);
  const sonarRafRef = useRef(null);
  const pendingCreatesRef = useRef(new Map());
  const pendingUpdatesRef = useRef(new Map());
  const tempIdCounterRef = useRef(-1);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const plansRef = useRef(plans);
  const conflictDecisionRef = useRef(null);
  errorRef.current = onError;
  colWidthsRef.current = colWidths;
  plansRef.current = plans;

  const notifyHistoryChange = useCallback(() => {
    onHistoryChange?.('dpr', {
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }, [onHistoryChange]);

  const syncDirty = useCallback(() => {
    onDirtyChange?.(pendingCreatesRef.current.size > 0 || pendingUpdatesRef.current.size > 0);
  }, [onDirtyChange]);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    notifyHistoryChange();
  }, [notifyHistoryChange]);

  const pushHistory = useCallback((action) => {
    undoStackRef.current.push(action);
    redoStackRef.current = [];
    notifyHistoryChange();
  }, [notifyHistoryChange]);

  const mergePendingPlans = useCallback((fetchedPlans) => {
    const byId = new Map(fetchedPlans.map(plan => {
      const update = pendingUpdatesRef.current.get(Number(plan.planId));
      return [Number(plan.planId), update ? { ...plan, ...update, ...DPR_TASKS[update.taskId] } : plan];
    }));
    for (const [tempId, pending] of pendingCreatesRef.current) {
      byId.set(tempId, { ...pending.visual });
    }
    return [...byId.values()];
  }, []);

  const machines = displaySettings?.dprmodellist || [];
  const machineKey = JSON.stringify([...machines].sort());
  const categoryFilterKey = JSON.stringify({
    formtype: displaySettings?.dprformtypelist || [],
    deliverytype: displaySettings?.dprdeliverytypelist || [],
    classification: displaySettings?.dprclassificationlist || [],
    status: displaySettings?.dprstatuslist || [],
    leader_user_nos: displaySettings?.dprinchargelist || [],
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

  useEffect(() => () => {
    if (sonarRafRef.current) cancelAnimationFrame(sonarRafRef.current);
    if (sonarClearTimerRef.current) clearTimeout(sonarClearTimerRef.current);
  }, []);

  const changeDateWidth = useCallback((width) => {
    const normalized = normalizeDateWidth(width);
    setDateWidth(normalized);
    try { sessionStorage.setItem(DATE_WIDTH_STORAGE_KEY, String(normalized)); } catch { /* stateで保持 */ }
  }, []);

  const openHeaderTooltip = useCallback((group, event) => {
    const anchorRect = event.currentTarget.getBoundingClientRect();
    setHeaderDetail({ group, anchorRect, x: event.clientX, y: event.clientY });
  }, []);

  useEffect(() => {
    if (!headerDetail) return undefined;
    const closeOnOutsidePointer = event => {
      if (event.target.closest?.('[data-header-tooltip="1"]') || event.target.closest?.('[data-row-header="1"]')) return;
      setHeaderDetail(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [headerDetail]);

  const loadPage = useCallback(async (reset = false, atOrAfterDprNo = null) => {
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
          ...(atOrAfterDprNo
            ? { at_or_after_dpr_no: atOrAfterDprNo }
            : reset || !cursorRef.current ? {} : { after_dpr_no: cursorRef.current }),
        }),
      });
      if (requestId !== requestIdRef.current) return;
      setGroups(previous => reset ? response.groups : [...previous, ...response.groups]);
      setPlans(previous => {
        const base = reset
          ? response.plans
          : [...previous.filter(plan => Number(plan.planId) > 0), ...response.plans];
        return mergePendingPlans([...new Map(base.map(plan => [Number(plan.planId), plan])).values()]);
      });
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
  }, [active, machineKey, categoryFilterKey, startDate, endDate, hasMore, mergePendingPlans]);

  useEffect(() => {
    if (!active) return;
    requestIdRef.current += 1;
    cursorRef.current = null;
    // 表示条件変更前のscrollTopが残ると、件数が少ない結果では全グループが
    // 仮想表示範囲外と判定される。DOMと描画用stateを同時に先頭へ戻す。
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
    setScroll(previous => previous.top === 0 ? previous : { ...previous, top: 0 });
    setHeaderDetail(null);
    setSelectedCell(null);
    setContextMenu(null);
    setScheduleDialog(null);
    pendingSonarDprNoRef.current = null;
    if (sonarRafRef.current) cancelAnimationFrame(sonarRafRef.current);
    if (sonarClearTimerRef.current) clearTimeout(sonarClearTimerRef.current);
    setSonar(null);
    setDprSearchText('');
    setGroups([]);
    setPlans(mergePendingPlans([]));
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

  const pointerCell = useCallback((event) => {
    const element = viewportRef.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left + element.scrollLeft) / colW);
    const row = Math.floor((event.clientY - rect.top + element.scrollTop) / CELL_SIZE);
    if (col < 0 || col >= totalCols || row < 0 || row >= totalRows) return null;
    const group = layoutGroups.find(item => row >= item.startRow && row < item.startRow + item.numRows);
    return group ? { col, row, group } : null;
  }, [colW, totalCols, totalRows, layoutGroups]);

  const selectCell = useCallback((event) => {
    const cell = pointerCell(event);
    if (!cell) return;
    setSelectedCell({ col: cell.col, row: cell.row });
    setContextMenu(null);
  }, [pointerCell]);

  const openCellContextMenu = useCallback((event) => {
    event.preventDefault();
    const cell = pointerCell(event);
    if (!cell) return;
    setSelectedCell({ col: cell.col, row: cell.row });
    if (event.target.closest?.('[data-dpr-plan-bar="1"]')) {
      setContextMenu(null);
      return;
    }
    const date = addDays(startDate, viewMode === 'day' ? cell.col : Math.floor(cell.col / SLOT_COUNT));
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [{
        label: '予定の追加',
        onClick: () => setScheduleDialog({
          dprNo: cell.group.dprNo,
          machine: cell.group.machine,
          startDate: date,
          endDate: date,
        }),
      }],
    });
  }, [pointerCell, startDate, viewMode]);

  const handleBarRightClick = useCallback((event, plan, group) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [{
        label: '編集',
        onClick: () => setScheduleDialog({
          plan,
          initialData: {
            dprNo: plan.dprNo,
            machine: group.machine,
            startDate: String(plan.startDate).slice(0, 10),
            endDate: String(plan.endDate).slice(0, 10),
          },
        }),
      }],
    });
  }, []);

  const saveDialogPlan = useCallback((data) => {
    const dialog = scheduleDialog;
    if (!dialog) return;
    const payload = {
      serialId: -1,
      morderId: -1,
      dprNo: data.dprNo,
      userNo: data.userNo || null,
      taskId: Number(data.taskId),
      workerId: null,
      teacherId: null,
      startDate: data.startDate,
      endDate: data.endDate,
      plannedMinutes: 0,
      price: 0,
      remark: data.remark ?? '',
    };
    const visual = { ...payload, ...DPR_TASKS[payload.taskId] };

    if (dialog.plan) {
      const planId = Number(dialog.plan.planId);
      const before = { ...dialog.plan };
      const previousPending = planId < 0
        ? { ...pendingCreatesRef.current.get(planId)?.payload }
        : pendingUpdatesRef.current.has(planId)
          ? { ...pendingUpdatesRef.current.get(planId) }
          : null;
      if (planId < 0 && pendingCreatesRef.current.has(planId)) {
        pendingCreatesRef.current.set(planId, { payload, visual: { ...before, ...visual, planId } });
      } else {
        pendingUpdatesRef.current.set(planId, payload);
      }
      setPlans(previous => previous.map(plan => plan.planId === planId ? { ...plan, ...visual } : plan));
      pushHistory({ type: 'edit', planId, before, after: { ...before, ...visual }, beforePayload: previousPending, afterPayload: payload });
    } else {
      const planId = tempIdCounterRef.current--;
      const plan = { planId, ...visual, updatedAtVersion: null };
      pendingCreatesRef.current.set(planId, { payload, visual: plan });
      setPlans(previous => [...previous, plan]);
      pushHistory({ type: 'create', plan, payload });
    }
    setScheduleDialog(null);
    onDirtyChange?.(true);
  }, [scheduleDialog, pushHistory, onDirtyChange]);

  const applyHistory = useCallback((action, direction) => {
    const redo = direction === 'redo';
    if (action.type === 'create') {
      if (redo) {
        pendingCreatesRef.current.set(action.plan.planId, { payload: action.payload, visual: action.plan });
        setPlans(previous => previous.some(plan => plan.planId === action.plan.planId) ? previous : [...previous, action.plan]);
      } else {
        pendingCreatesRef.current.delete(action.plan.planId);
        setPlans(previous => previous.filter(plan => plan.planId !== action.plan.planId));
      }
      return;
    }

    const state = redo ? action.after : action.before;
    setPlans(previous => previous.map(plan => plan.planId === action.planId ? { ...state } : plan));
    if (action.planId < 0) {
      const payload = redo ? action.afterPayload : (action.beforePayload ?? {
        ...pendingCreatesRef.current.get(action.planId)?.payload,
        taskId: action.before.taskId,
        userNo: action.before.userNo,
        startDate: action.before.startDate,
        endDate: action.before.endDate,
        remark: action.before.remark,
      });
      pendingCreatesRef.current.set(action.planId, { payload, visual: state });
    } else {
      const payload = redo ? action.afterPayload : action.beforePayload;
      if (payload) pendingUpdatesRef.current.set(action.planId, payload);
      else pendingUpdatesRef.current.delete(action.planId);
    }
  }, []);

  const undoLastEdit = useCallback(() => {
    const action = undoStackRef.current.pop();
    if (!action) return;
    applyHistory(action, 'undo');
    redoStackRef.current.push(action);
    notifyHistoryChange();
    setTimeout(syncDirty, 0);
  }, [applyHistory, notifyHistoryChange, syncDirty]);

  const redoLastEdit = useCallback(() => {
    const action = redoStackRef.current.pop();
    if (!action) return;
    applyHistory(action, 'redo');
    undoStackRef.current.push(action);
    notifyHistoryChange();
    setTimeout(syncDirty, 0);
  }, [applyHistory, notifyHistoryChange, syncDirty]);

  const requestConflictDecision = useCallback(() => new Promise(resolve => {
    conflictDecisionRef.current = resolve;
    setUpdateConflictDialogOpen(true);
  }), []);

  const resolveConflictDecision = useCallback((decision) => {
    const resolve = conflictDecisionRef.current;
    conflictDecisionRef.current = null;
    setUpdateConflictDialogOpen(false);
    resolve?.(decision);
  }, []);

  useImperativeHandle(ref, () => ({
    undoLastEdit,
    redoLastEdit,
    async saveChanges() {
      const updateVersions = [...pendingUpdatesRef.current.keys()].map(planId => ({
        id: planId,
        updatedAt: plansRef.current.find(plan => Number(plan.planId) === Number(planId))?.updatedAtVersion ?? null,
      }));
      if (updateVersions.length > 0) {
        let conflictIds;
        try {
          const result = await apiJson('/plan/check-updates', {
            method: 'POST',
            body: JSON.stringify({ updates: updateVersions }),
          });
          conflictIds = new Set((result.conflictIds || []).map(Number));
        } catch {
          errorRef.current?.('予定の更新状況を確認できませんでした');
          return false;
        }
        if (conflictIds.size > 0) {
          const decision = await requestConflictDecision();
          if (decision === 'cancel') return false;
          if (decision === 'skip') {
            conflictIds.forEach(planId => pendingUpdatesRef.current.delete(planId));
          }
        }
      }

      let failed = false;
      for (const [tempId, pending] of [...pendingCreatesRef.current]) {
        try {
          const saved = await apiJson('/plan', { method: 'POST', body: JSON.stringify(pending.payload) });
          setPlans(previous => previous.map(plan => plan.planId === tempId ? { ...plan, ...saved } : plan));
          pendingCreatesRef.current.delete(tempId);
        } catch {
          failed = true;
        }
      }
      for (const [planId, payload] of [...pendingUpdatesRef.current]) {
        try {
          const saved = await apiJson(`/plan/${planId}`, { method: 'PUT', body: JSON.stringify(payload) });
          setPlans(previous => previous.map(plan => Number(plan.planId) === Number(planId) ? { ...plan, ...saved } : plan));
          pendingUpdatesRef.current.delete(planId);
        } catch {
          failed = true;
        }
      }

      const dirty = pendingCreatesRef.current.size > 0 || pendingUpdatesRef.current.size > 0;
      if (!dirty) {
        clearHistory();
        onDirtyChange?.(false);
        setReloadTick(value => value + 1);
      } else {
        onDirtyChange?.(true);
      }
      if (failed) errorRef.current?.('一部のDPR予定を保存できませんでした');
      return !dirty;
    },
    async cancelChanges() {
      pendingCreatesRef.current = new Map();
      pendingUpdatesRef.current = new Map();
      tempIdCounterRef.current = -1;
      clearHistory();
      onDirtyChange?.(false);
      setReloadTick(value => value + 1);
    },
  }));

  useEffect(() => () => {
    conflictDecisionRef.current?.('cancel');
    conflictDecisionRef.current = null;
  }, []);

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

  const scrollToDpr = useCallback((dprNo) => {
    const target = layoutGroups.find(group => String(group.dprNo) === String(dprNo));
    if (!target || !viewportRef.current) return false;
    const top = Math.max(0, target.startRow * CELL_SIZE);
    viewportRef.current.scrollTop = top;
    const actualTop = viewportRef.current.scrollTop;
    setScroll(previous => ({ ...previous, top: actualTop }));
    triggerSonar(
      leftWidth / 2,
      TOTAL_HDR_H + (target.startRow + target.numRows / 2) * CELL_SIZE - actualTop,
    );
    return true;
  }, [layoutGroups, leftWidth, triggerSonar]);

  useEffect(() => {
    const dprNo = pendingSonarDprNoRef.current;
    if (!dprNo || !viewportRef.current) return;
    const target = layoutGroups.find(group => String(group.dprNo) === String(dprNo));
    if (!target) return;
    const top = Math.max(0, target.startRow * CELL_SIZE);
    viewportRef.current.scrollTop = top;
    const actualTop = viewportRef.current.scrollTop;
    setScroll(previous => ({ ...previous, top: actualTop }));
    triggerSonar(
      leftWidth / 2,
      TOTAL_HDR_H + (target.startRow + target.numRows / 2) * CELL_SIZE - actualTop,
    );
    pendingSonarDprNoRef.current = null;
  }, [layoutGroups, leftWidth, triggerSonar]);

  const handleDprSearch = useCallback(async () => {
    const dprNo = dprSearchText.trim().toUpperCase();
    if (!dprNo) {
      setReloadTick(value => value + 1);
      return;
    }
    setDprSearchText(dprNo);
    if (scrollToDpr(dprNo)) return;

    setLoading(true);
    try {
      const categoryFilters = JSON.parse(categoryFilterKey);
      const result = await apiJson('/dpr/search', {
        method: 'POST',
        body: JSON.stringify({
          dprNo, machines: JSON.parse(machineKey), from: startDate, to: endDate,
          ...categoryFilters,
        }),
      });
      if (!result?.group) {
        errorRef.current?.('該当するDPR Noがありません');
        return;
      }

      if (result.inDisplaySettings) {
        pendingSonarDprNoRef.current = result.dprNo;
        await loadPage(true, result.dprNo);
        return;
      }

      // 表示設定外のDPR Noは、検索APIが返した1グループだけを表示する。
      requestIdRef.current += 1;
      pendingSonarDprNoRef.current = result.dprNo;
      loadingRef.current = false;
      cursorRef.current = null;
      setGroups([result.group]);
      setPlans(result.plans || []);
      setHasMore(false);
      setHeaderDetail(null);
      if (viewportRef.current) {
        viewportRef.current.scrollTop = 0;
        viewportRef.current.scrollLeft = 0;
      }
      setScroll({ left: 0, top: 0 });
    } catch {
      errorRef.current?.('DPR Noの検索に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [dprSearchText, scrollToDpr, categoryFilterKey, machineKey, startDate, endDate, loadPage]);

  const handleDprSearchClear = useCallback(() => {
    if (!dprSearchText) return;
    setDprSearchText('');
    pendingSonarDprNoRef.current = null;
    if (sonarRafRef.current) cancelAnimationFrame(sonarRafRef.current);
    if (sonarClearTimerRef.current) clearTimeout(sonarClearTimerRef.current);
    setSonar(null);
    setReloadTick(value => value + 1);
  }, [dprSearchText]);

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
        dprSearchText={dprSearchText} onDprSearchTextChange={setDprSearchText}
        onDprSearch={handleDprSearch} onDprSearchClear={handleDprSearchClear}
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
          <DprLeftHeader layoutGroups={layoutGroups} scrollTop={scroll.top} viewportHeight={viewport.height} colWidths={colWidths} leftWidth={leftWidth} onGroupClick={openHeaderTooltip} />
        </div>
        <div
          ref={viewportRef}
          onClick={selectCell}
          onContextMenu={openCellContextMenu}
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
          style={{ position: 'absolute', left: leftWidth, right: 0, top: TOTAL_HDR_H, bottom: 0, overflow: 'auto', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch', cursor: 'cell' }}
        >
          <div style={{ position: 'relative', width: contentWidth, height: contentHeight }}>
            {selectedCell && (
              <div style={{
                position: 'absolute', left: selectedCell.col * colW, top: selectedCell.row * CELL_SIZE,
                width: colW, height: CELL_SIZE, outline: '2px solid #2563eb', outlineOffset: '-1px',
                boxSizing: 'border-box', pointerEvents: 'none', zIndex: 3,
              }} />
            )}
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
              onBarRightClick={handleBarRightClick}
            />
          </div>
        </div>
        {loading && <div style={{ position: 'absolute', right: 18, bottom: 18, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.92)', boxShadow: '0 1px 5px rgba(0,0,0,0.2)', fontSize: 12, color: '#6b7280' }}>読み込み中...</div>}
        <DprHeaderTooltip detail={headerDetail} onClose={() => setHeaderDetail(null)} />
        {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
        {active && sonar && [0, 380, 760].map((delay, index) => (
          <div
            key={`${sonar.key}-${index}`}
            style={{
              position: 'absolute', left: sonar.x, top: sonar.y,
              width: 72, height: 72, marginLeft: -36, marginTop: -36,
              borderRadius: '50%', border: '4px solid #ef4444',
              animation: `sonar-ring 1100ms ${delay}ms ease-out forwards`,
              zIndex: 100, pointerEvents: 'none', transformOrigin: 'center',
            }}
          />
        ))}
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
      {scheduleDialog && (
        <DprScheduleDialog
          plan={scheduleDialog.plan}
          initialData={scheduleDialog.initialData ?? scheduleDialog}
          onSave={saveDialogPlan}
          onClose={() => setScheduleDialog(null)}
        />
      )}
      {updateConflictDialogOpen && (
        <UpdateConflictDialog
          onOverwrite={() => resolveConflictDecision('overwrite')}
          onSkip={() => resolveConflictDecision('skip')}
          onCancel={() => resolveConflictDecision('cancel')}
        />
      )}
    </div>
  );
});

export default DprGrid;
