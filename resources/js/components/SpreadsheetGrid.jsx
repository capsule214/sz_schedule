import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { apiArray, apiJson } from '../lib/api';
import ContextMenu from './ContextMenu';
import BarTooltip from './BarTooltip';
import { getColor } from '../lib/colors';
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
import UpdateConflictDialog from './UpdateConflictDialog';
import { loadTaskMaster } from '../lib/taskMaster';
import { loadLeftColWidths, saveLeftColWidth, visibleLeftColumns, clampLeftColW } from '../lib/leftHeaderColumns';
import { loadExcludedDays, splitPastedSchedulePreservingLength } from '../lib/scheduleExclusions';
import {
  CELL_SIZE,
  HDR_H,
  TOTAL_HDR_H,
  MIN_ROWS,
  MIN_ROWS_LOCATION,
  BUFFER_ROWS,
  SLOT_COUNT,
  HANDLE_W,
  SLOT_LABELS,
  TODAY_STR,
  dateToStr,
  addDays,
  daysBetween,
  getMonthWeekInfo,
  colToDateStr,
  planToStartCol,
  planToEndCol,
  colToDateTime,
  layoutPlans,
  computeGaps,
} from '../lib/spreadsheet';

// 表示設定の状態フラグに対応する行バッジ（装置タブ・製番表示）
const ROW_FLAG_BADGES = [
  { key: 'flgsyoyo',  label: '所要日連動', color: '#0ea5e9' },
  { key: 'flgukeoi',  label: '請負発注',   color: '#8b5cf6' },
  { key: 'flgkeppin', label: '部品欠品',   color: '#ef4444' },
  { key: 'flggoso',   label: '後送',       color: '#f59e0b' },
];
const SHIPPING_TASK_ID = 1;
const DATE_WIDTH_STORAGE_PREFIX = 'sz_schedule_date_width_';

function normalizeDateWidth(value, fallback = CELL_SIZE) {
  const width = Number(value);
  if (!Number.isFinite(width)) return fallback;
  return Math.max(20, Math.min(120, Math.round(width / 20) * 20));
}

function loadTabDateWidth(mode, suffix = '') {
  try {
    return normalizeDateWidth(sessionStorage.getItem(`${DATE_WIDTH_STORAGE_PREFIX}${mode}${suffix}`));
  } catch {
    return CELL_SIZE;
  }
}

function saveTabDateWidth(mode, width, suffix = '') {
  try {
    sessionStorage.setItem(`${DATE_WIDTH_STORAGE_PREFIX}${mode}${suffix}`, String(width));
  } catch {
    // sessionStorageを利用できない環境では、現在のコンポーネントstateだけで保持する。
  }
}

function isShippingTask(plan) {
  return Number(plan?.taskId) === SHIPPING_TASK_ID;
}

function isEditableMorderShippingTask(plan) {
  const orderTypeId = Number(plan?.morderOrderTypeId);
  return isShippingTask(plan)
    && Number(plan?.morderId) > 0
    && (orderTypeId === 21 || orderTypeId === 11);
}

function isReadOnlyShippingTask(plan) {
  return isShippingTask(plan) && !isEditableMorderShippingTask(plan);
}

function isReadOnlyPlan(plan, mode) {
  if (Number(plan?.planId) < 0) return false;
  // 担当者タブの社員未定予定は、特殊予定を含めてマウス移動・伸縮を許可する。
  if (mode === 'worker' && (plan?.workerId == null || Number(plan.workerId) <= 0)) return false;
  if (isEditableMorderShippingTask(plan)) return false;
  return isReadOnlyShippingTask(plan);
}

function isDialogReadOnlyPlan(plan) {
  if (Number(plan?.planId) < 0) return false;
  return isReadOnlyShippingTask(plan);
}

function isPersonalPlan(plan) {
  return Number(plan?.taskTypeId) === 3;
}

const SpreadsheetGrid = forwardRef(function SpreadsheetGrid({
  active = true,
  mode, serials, workers, tasks, resources, displaySettings, displaySettingsApplyVersion = 0, settingsReady = true,
  onJumpToOtherTab, onEnsureMasters, jumpTarget, onJumpHandled, onJumpError,
  onRangeChange, onDirtyChange, onHistoryChange, onBeforeRedraw,
}, ref) {
  const DEVICE_GROUP_OVERSCAN = 40;
  const today = new Date();
  const [startDate, setStartDate] = useState(() => dateToStr(today));
  const [displayMonths, setDisplayMonths] = useState(() => {
    const d = displaySettings?.duration;
    return (d && d >= 1) ? d : 4;
  });

  // 表示設定の duration（ヶ月）が変わったら displayMonths を同期
  useEffect(() => {
    const d = displaySettings?.duration;
    if (d && d >= 1) setDisplayMonths(d);
  }, [displaySettings?.duration]);
  const [deviceCount, setDeviceCount] = useState(1000);
  const [dateWidth, setDateWidth] = useState(() => loadTabDateWidth(mode));
  const lastDayWidthRef = useRef(loadTabDateWidth(mode, '_day'));
  const viewMode = dateWidth === 120 ? 'slot' : 'day';
  const [plans, setPlans] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [serialSearchText, setSerialSearchText] = useState('');
  const [workerSearchText, setWorkerSearchText] = useState('');
  const [forcedSerialId, setForcedSerialId] = useState(null);
  const [forcedSerialGroup, setForcedSerialGroup] = useState(null);
  const [serialSearchTick, setSerialSearchTick] = useState(0);
  const [workerSearchTick, setWorkerSearchTick] = useState(0);
  const [devicePagedGroups, setDevicePagedGroups] = useState([]);
  const [deviceGroupTotal, setDeviceGroupTotal] = useState(0);
  const [deviceGroupOffset, setDeviceGroupOffset] = useState(0);
  const [deviceSearchStartOffset, setDeviceSearchStartOffset] = useState(null);
  const [workerSearchStartId, setWorkerSearchStartId] = useState(null);
  const deviceGroupFetchKeyRef = useRef('');
  const deviceGroupFetchSequenceRef = useRef(0);

  // 保存保留中の変更（移動/リサイズ/削除/貼り付け）を蓄積する
  // pendingCreates: Map<tempId(負数), payload>  pendingUpdates: Map<planId, payload>  pendingDeletes: Set<planId(正数のみ)>
  const pendingCreatesRef = useRef(new Map());
  const pendingUpdatesRef = useRef(new Map());
  const pendingDeletesRef = useRef(new Set());
  // 装置タブに重ねて表示する場所予定は /reserve API で保存するため、通常予定と分けて保持する。
  const pendingLocationCreatesRef = useRef(new Map());
  const pendingLocationUpdatesRef = useRef(new Map());
  const pendingLocationDeletesRef = useRef(new Set());
  const tempIdCounterRef  = useRef(-1); // 貼り付け時のローカル仮ID（負数）
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  const [contextMenu, setContextMenu] = useState(null);
  const [serialOverlay, setSerialOverlay] = useState(null); // { triggerPlan, serialPlans } | null
  const [tooltip, setTooltip] = useState(null);
  const [scheduleDialog, setScheduleDialog] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [selectedLocation, setSelectedLocation] = useState(new Set());
  const [groupMoveHighlightIds, setGroupMoveHighlightIds] = useState(new Set());
  const [selectedCell, setSelectedCell] = useState(null);
  const [copied, setCopied] = useState([]);
  const [copiedKind, setCopiedKind] = useState('plan');
  const [clipboardAction, setClipboardAction] = useState('copy');
  const [cutApplied, setCutApplied] = useState(false);
  const cutAppliedRef = useRef(false);
  const clipboardVersionRef = useRef(0);
  const [sonar, setSonar] = useState(null);
  const sonarClearTimerRef = useRef(null);
  const sonarRafRef = useRef(null);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [updateConflictDialogOpen, setUpdateConflictDialogOpen] = useState(false);
  const conflictDecisionPromiseRef = useRef(null);
  const toastTimerRef = useRef(null);
  const groupMoveHighlightTimerRef = useRef(null);

  const fetchedPlanKeysRef  = useRef(new Set());
  const [locationOverlayPlans, setLocationOverlayPlans] = useState([]);
  const plansRef = useRef(plans);
  const locationOverlayPlansRef = useRef(locationOverlayPlans);
  plansRef.current = plans;
  locationOverlayPlansRef.current = locationOverlayPlans;
  const fetchedLocKeysRef   = useRef(new Set());
  const [calendarData, setCalendarData] = useState(new Map()); // dateStr → { dayType } (0=平日 1=土日 3=祝日 4=会社休日)
  const fetchedCalendarRangesRef = useRef([]);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const dateHeaderRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerH, setContainerH] = useState(600);
  const [containerW, setContainerW] = useState(1200);
  const [fetchVersion, setFetchVersion] = useState(0);
  const [gridFetchCount, setGridFetchCount] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const gridFetchCountRef = useRef(0);
  const scheduleFetchCountRef = useRef(0);
  const planFetchSequenceRef = useRef(0);

  const retainPendingPlans = useCallback((current) => current.filter(plan => {
    if (pendingDeletesRef.current.has(plan.planId)) return false;
    return plan.planId < 0
      ? pendingCreatesRef.current.has(plan.planId)
      : pendingUpdatesRef.current.has(plan.planId);
  }), []);
  const retainPendingLocationPlans = useCallback((current) => current.filter(plan => {
    if (pendingLocationDeletesRef.current.has(plan.planId)) return false;
    return plan.planId < 0
      ? pendingLocationCreatesRef.current.has(plan.planId)
      : pendingLocationUpdatesRef.current.has(plan.planId);
  }), []);

  const dragRef = useRef(null);
  const locationDragRef = useRef(null);
  const [locationGhostDrag, setLocationGhostDrag] = useState(null);
  const [rectSelect, setRectSelect] = useState(null); // {absX1,absY1,absX2,absY2} in content coords
  const suppressNextCellClickRef = useRef(false);
  const layoutGroupsRef = useRef([]);
  const prevJumpTargetRef = useRef(null);
  const jumpGroupFetchKeyRef = useRef(null);
  const jumpTimerRef = useRef(null);
  const pendingScrollSerialIdRef = useRef(null);
  const pendingScrollWorkerIdRef = useRef(null);
  const searchAnchorSerialIdRef = useRef(null);
  const searchAnchorWorkerIdRef = useRef(null);
  const releaseDeviceAnchorAfterLayoutRef = useRef(false);
  const releaseWorkerAnchorAfterLayoutRef = useRef(false);
  const revealingPreviousDeviceRef = useRef(false);
  const revealingPreviousWorkerRef = useRef(false);
  const jumpAnchorPlanIdRef = useRef(null);
  const pendingJumpSonarPlanIdRef = useRef(null);

  const showShippingDate = mode === 'device' && !!displaySettings.sbdspdate;
  const showResponsible  = mode === 'device' && !!displaySettings.sbdspincharge;
  // 製品表示: 0=製番, 1=M番(加工オーダー order_type_id=21), 2=直送DPR(order_type_id=11)
  const sbsbmb = Number(displaySettings.sbsbmb ?? 0);
  const isMorderDevice = mode === 'device' && (sbsbmb === 1 || sbsbmb === 2);
  const morderOrderTypeId = sbsbmb === 2 ? 11 : sbsbmb === 1 ? 21 : null;
  const isMorderTask = mode === 'task' && Number(displaySettings.tksbmb ?? 0) === 1;
  const useKisyuColor = mode === 'device'
    ? Number(displaySettings.sbcolor ?? 0) === 1
    : (mode === 'worker' || mode === 'task') && Number(displaySettings.sycolor ?? 0) === 1;

  // 左ヘッダ各列の幅（cookie 永続化・最低80px/最大160px、マウスでリサイズ可能）
  const [colWidths, setColWidths] = useState(() => loadLeftColWidths(mode));
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;
  const leftColumns = useMemo(
    () => visibleLeftColumns(mode, { isMorderDevice, showShippingDate, showResponsible }),
    [mode, isMorderDevice, showShippingDate, showResponsible],
  );
  const lcw = (key) => colWidths[key] ?? 80;
  const leftHdrW = leftColumns.reduce((sum, key) => sum + lcw(key), 0);

  // 列境界をドラッグして幅を変更する
  const colResizeRef = useRef(null);
  const handleColResizeMove = useCallback((e) => {
    const r = colResizeRef.current;
    if (!r) return;
    const w = clampLeftColW(r.startW + (e.clientX - r.startX));
    r.lastW = w;
    setColWidths(prev => (prev[r.key] === w ? prev : { ...prev, [r.key]: w }));
  }, []);
  const handleColResizeUp = useCallback(() => {
    const r = colResizeRef.current;
    if (r) saveLeftColWidth(mode, r.key, r.lastW ?? r.startW);
    colResizeRef.current = null;
    window.removeEventListener('pointermove', handleColResizeMove);
    window.removeEventListener('pointerup', handleColResizeUp);
    document.body.style.cursor = '';
  }, [mode, handleColResizeMove]);
  const startColResize = useCallback((key, e) => {
    e.preventDefault();
    e.stopPropagation();
    colResizeRef.current = { key, startX: e.clientX, startW: colWidthsRef.current[key] ?? 80, lastW: colWidthsRef.current[key] ?? 80 };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', handleColResizeMove);
    window.addEventListener('pointerup', handleColResizeUp);
  }, [handleColResizeMove, handleColResizeUp]);

  // 左固定ヘッダ（列見出し・行見出し）上のホイール操作を本体スクロールへ転送する
  const forwardHeaderWheel = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop += e.deltaY;
    el.scrollLeft += e.deltaX;
  }, []);

  // 日付・曜日ヘッダーでは縦ホイール操作を横スクロールとして扱う
  useEffect(() => {
    const header = dateHeaderRef.current;
    if (!header) return undefined;

    const handleWheel = (e) => {
      const el = scrollRef.current;
      if (!el) return;
      e.preventDefault();
      el.scrollLeft += e.deltaX + e.deltaY;
    };

    header.addEventListener('wheel', handleWheel, { passive: false });
    return () => header.removeEventListener('wheel', handleWheel);
  }, [active]);

  // 場所タブのフロアフィルタ（ローカル状態、displaySettings.pllocation で初期化）
  const [pllocation, setPllocation] = useState(() => displaySettings?.pllocation ?? null);
  useEffect(() => {
    if (displaySettings?.pllocation != null) setPllocation(displaySettings.pllocation);
  }, [displaySettings?.pllocation]); // eslint-disable-line react-hooks/exhaustive-deps
  const planEndpoint = mode === 'place' ? '/reserve' : '/plan';
  const planSearchEndpoint = mode === 'device'
    ? '/plan/search/device'
    : mode === 'worker'
      ? '/plan/search/worker'
      : mode === 'task'
        ? '/plan/search/task'
        : '/reserve/search';
  // 装置タブ(製番/M番/直送DPR)で所要日連動/請負発注/部品欠品/後送有無のいずれかON時の行バッジ
  const rowBadges = useMemo(() => {
    if (mode !== 'device') return [];
    return ROW_FLAG_BADGES.filter(b => !!displaySettings[b.key]);
  }, [mode, displaySettings]);
  const hasRowFlags = rowBadges.length > 0;

  // 予定バーの最低行数: 製番/M番/直送DPR で基準を統一（デフォルト3行、バッジ表示時4行）
  const planMinRows  = mode === 'place' ? MIN_ROWS_LOCATION
    : mode === 'worker' ? 2
    : mode === 'device' ? (hasRowFlags ? 4 : MIN_ROWS)
    : MIN_ROWS;
  const extraLocationRow = mode === 'device' && !!displaySettings.sbdspplplan;
  const visibleDeviceGroupCount = Math.max(1, Math.ceil(Math.max(0, containerH - TOTAL_HDR_H) / (planMinRows * CELL_SIZE)));
  const deviceGroupWindowSize = visibleDeviceGroupCount + DEVICE_GROUP_OVERSCAN;

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
    if (!settingsReady) return [];
    if (mode !== 'device') return [];
    if (isMorderDevice) return [];
    return devicePagedGroups;
  }, [settingsReady, mode, isMorderDevice, devicePagedGroups]);

  const MORDER_ORDER_TYPE_NAMES = { 11: '直送DPR', 21: '加工オーダー' };

  // M番の行は予定の有無に依存せず、公開フラグ=1 の M番マスタから構築する。
  // M番/直送DPR も製番と同じくページング取得（スクロールで都度取得した devicePagedGroups を使用）
  const baseMorderGroups = useMemo(() => {
    if (!settingsReady) return [];
    if (!isMorderDevice) return [];
    return devicePagedGroups;
  }, [settingsReady, isMorderDevice, devicePagedGroups]);

  const filteredGroups = useMemo(() => {
    if (!settingsReady) return [];
    const syteamlist = displaySettings.syteamlist || [];
    if (mode === 'device') {
      if (isMorderDevice) return baseMorderGroups;
      if (forcedSerialId != null) {
        if (Number(forcedSerialGroup?.id) === Number(forcedSerialId)) {
          return [forcedSerialGroup];
        }
        const ser = serials.find(s => s.serialId === forcedSerialId);
        if (ser) {
          return [{
            id: ser.serialId,
            kisyuName: ser.kisyuName,
            serialNo: ser.serialNo,
            receiptNo: ser.orderNo ?? null,
            shippingDate: ser.shippingDate || null,
            responsible: ser.responsible || null,
            kisyuId: ser.kisyuId,
            flgSyoyo: ser.flgSyoyo,
            flgGoso: ser.flgGoso,
          }];
        }
      }
      return baseDeviceGroups;
    } else if (mode === 'place') {
      let locs = resources || [];
      if (pllocation) locs = locs.filter(loc => loc.locationTypeId === pllocation);
      return locs.map(loc => ({
        id: loc.resourceId,
        resourceName: loc.resourceName,
        locationTypeName: loc.locationTypeName ?? '',
        backColor: loc.backColor,
        fontColor: loc.fontColor,
      }));
    } else if (mode === 'task') {
      const tktasklist = displaySettings.tktasklist || [];
      // 未選択時は何も表示しない
      if (tktasklist.length === 0) return [];
      let t = tasks.filter(task => tktasklist.includes(task.taskId));
      const taskGroups = [...t]
        .sort((a, b) => {
          const pd = (a.processSortNo || 0) - (b.processSortNo || 0);
          return pd !== 0 ? pd : (a.sortNo || 0) - (b.sortNo || 0);
        })
        .map(task => ({
          id: task.taskId,
          taskId: task.taskId,
          processName: task.processName || '(未設定)',
          taskName: task.taskName,
        }));
      if (!displaySettings.synobody) return taskGroups;
      return taskGroups.flatMap(task => [
        {
          ...task,
          id: `task:${task.taskId}:assigned`,
          isUnassigned: false,
        },
        {
          ...task,
          id: `task:${task.taskId}:unassigned`,
          taskName: `${task.taskName}(社員未定)`,
          isUnassigned: true,
        },
      ]);
    } else {
      const sygroup = displaySettings.sygroup || 0;
      let w = workers;
      if (sygroup > 0) {
        w = w.filter(wr => wr.szgroupId === sygroup);
      }
      if (syteamlist.length > 0) {
        w = w.filter(wr => syteamlist.includes(wr.teamId));
      }
      // 担当者タブは teamId → workerId 昇順固定
      w = [...w].sort((a, b) => (a.teamId - b.teamId) || (a.workerId - b.workerId));
      if (workerSearchStartId != null) {
        const startIndex = w.findIndex(wr => Number(wr.workerId) === Number(workerSearchStartId));
        if (startIndex >= 0) w = w.slice(startIndex);
      }
      return w.map(wr => ({ id: wr.workerId, workerName: wr.workerName, teamName: wr.teamName, teamId: wr.teamId, userNo: wr.userNo }));
    }
  }, [settingsReady, mode, serials, workers, tasks, resources, displaySettings, baseDeviceGroups, baseMorderGroups, forcedSerialId, forcedSerialGroup, pllocation, isMorderDevice, workerSearchStartId]);

  const { groups: layoutGroups, totalRows } = useMemo(() => {
    const groupKey = mode === 'device' ? (isMorderDevice ? 'morder' : 'device')
      : mode === 'worker' ? 'worker'
      : mode === 'task' && displaySettings.synobody ? 'task-assignment'
      : mode === 'task' ? 'task'
      : 'place';
    const locPlans = extraLocationRow ? locationOverlayPlans : null;
    const activePlans = plans.filter(p => !p.deleted);
    const result = layoutPlans(activePlans, groupKey, filteredGroups, viewMode, startDate, planMinRows, locPlans);

    if (mode === 'device' && deviceGroupTotal > 0) {
      const searchStartOffset = deviceSearchStartOffset ?? 0;
      const baseRow = Math.max(0, deviceGroupOffset - searchStartOffset) * planMinRows;
      const shiftedGroups = result.groups.map(g => ({
        ...g,
        startRow: g.startRow + baseRow,
      }));
      const visibleEndRow = shiftedGroups.reduce((max, g) => Math.max(max, g.startRow + g.numRows), 0);
      return {
        groups: shiftedGroups,
        totalRows: Math.max(Math.max(0, deviceGroupTotal - searchStartOffset) * planMinRows, visibleEndRow),
      };
    }

    if (mode !== 'worker' || !displaySettings.synobody) return result;

    // 担当者未定の予定（workerId が NULL/0以下）を製番/M番/直送DPR別にグループ化して末尾に追加
    const unassignedPlans = activePlans.filter(p => p.workerId == null || Number(p.workerId) <= 0);
    const serialMap = new Map();
    const morderMap = new Map();
    for (const plan of unassignedPlans) {
      if (Number(plan.morderId) > 0) {
        if (!morderMap.has(plan.morderId)) morderMap.set(plan.morderId, []);
        morderMap.get(plan.morderId).push(plan);
      } else if (Number(plan.serialId) > 0) {
        if (!serialMap.has(plan.serialId)) serialMap.set(plan.serialId, []);
        serialMap.get(plan.serialId).push(plan);
      }
    }

    const sortedSerialIds = [...serialMap.keys()].sort((a, b) => {
      const sa = serials.find(s => s.serialId === a);
      const sb = serials.find(s => s.serialId === b);
      const pa = serialMap.get(a)?.[0];
      const pb = serialMap.get(b)?.[0];
      const kc = (sa?.kisyuName || pa?.kisyuName || '').localeCompare(sb?.kisyuName || pb?.kisyuName || '', 'ja');
      if (kc !== 0) return kc;
      return (sa?.serialNo || pa?.serialNo || '').localeCompare(sb?.serialNo || pb?.serialNo || '', 'ja', { numeric: true });
    });

    let uaStartRow = result.totalRows;
    const extraGroups = [];
    const pushUnassignedGroup = (group) => {
      const { plans: uaPlans } = group;
      const sorted = [...uaPlans].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      const unassignedMinRows = 1;
      const rows = Array.from({ length: unassignedMinRows }, () => null);
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
      const numRows = Math.max(unassignedMinRows, rows.length);
      extraGroups.push({
        ...group,
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
    };

    for (const serialId of sortedSerialIds) {
      const uaPlans = serialMap.get(serialId);
      const serial = serials.find(s => s.serialId === serialId);
      pushUnassignedGroup({
        id: `ua-serial-${serialId}`,
        unassignedKind: 'serial',
        serialId,
        kisyuId: serial?.kisyuId ?? uaPlans[0]?.kisyuId ?? null,
        kisyuName: serial?.kisyuName || uaPlans[0]?.kisyuName || '',
        kisyuBackColor: serial?.kisyuBackColor ?? uaPlans[0]?.kisyuBackColor ?? null,
        kisyuFontColor: serial?.kisyuFontColor ?? uaPlans[0]?.kisyuFontColor ?? null,
        serialNo: serial?.serialNo || uaPlans[0]?.serialNo || '',
        plans: uaPlans,
      });
    }

    const sortedMorderIds = [...morderMap.keys()].sort((a, b) => {
      const pa = morderMap.get(a)?.[0] || {};
      const pb = morderMap.get(b)?.[0] || {};
      const oa = Number(pa.morderOrderTypeId || 0);
      const ob = Number(pb.morderOrderTypeId || 0);
      const rank = (orderTypeId) => orderTypeId === 21 ? 0 : orderTypeId === 11 ? 1 : 2;
      const rc = rank(oa) - rank(ob);
      if (rc !== 0) return rc;
      return String(pa.morderNo || '').localeCompare(String(pb.morderNo || ''), 'ja', { numeric: true });
    });
    for (const morderId of sortedMorderIds) {
      const uaPlans = morderMap.get(morderId);
      const sample = uaPlans[0] || {};
      const orderTypeId = Number(sample.morderOrderTypeId || 0);
      pushUnassignedGroup({
        id: `ua-morder-${morderId}`,
        unassignedKind: orderTypeId === 11 ? 'dpr' : 'morder',
        morderId,
        morderOrderTypeId: orderTypeId || null,
        morderOrderTypeName: sample.morderOrderTypeName || '',
        morderNo: sample.morderNo || '',
        kisyuName: orderTypeId === 11 ? '直送DPR' : 'M番',
        serialNo: sample.morderNo || '',
        plans: uaPlans,
      });
    }
    return { groups: [...result.groups, ...extraGroups], totalRows: uaStartRow };
  }, [plans, filteredGroups, mode, viewMode, startDate, planMinRows, extraLocationRow, locationOverlayPlans, serials, displaySettings, isMorderDevice, deviceGroupOffset, deviceGroupTotal, deviceSearchStartOffset]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // 120px は従来の時間割（20px × 6枠）、それ未満は1日1セルで指定幅を使用する。
  const colW = viewMode === 'slot' ? CELL_SIZE : dateWidth;

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

  // 表示設定から API 検索ボディのフィルタ部分を構築する
  function buildFilterBody() {
    const useModelFilters = !isMorderDevice;
    const sbmodellist   = displaySettings.sbmodellist   || [];
    const sbequiptype   = displaySettings.sbequiptype;
    const sbszgrouplist = displaySettings.sbszgrouplist || [];
    const sbstatuslist  = displaySettings.sbstatuslist  || [];
    const sbinchargelist = (displaySettings.sbinchargelist || [])
      .flatMap(v => String(v).split(','))
      .map(v => v.trim())
      .filter(Boolean);
    const sygroup       = displaySettings.sygroup       || 0;
    const syteamlist    = displaySettings.syteamlist    || [];
    const sytasklist    = displaySettings.sytasklist    || [];
    const tktasklist    = displaySettings.tktasklist    || [];
    const synobody      = displaySettings.synobody      || false;
    const body = {};
    // 「完了製品も表示」(sboption) OFF のときは flg_finish=0 の製番のみ取得する
    body.show_finished = displaySettings.sboption ? 1 : 0;
    if (mode === 'device') {
      if (isMorderDevice) {
        body.product_display = 'morder';
        if (morderOrderTypeId != null) body.morder_order_type_id = morderOrderTypeId;
      } else {
        body.display_order = Number(displaySettings.sborder ?? 0);
      }
      if (useModelFilters && sbmodellist.length > 0) body.kisyu_ids = sbmodellist.map(Number);
      if (useModelFilters && sbequiptype != null && sbequiptype !== -1) body.equip_type_id = sbequiptype;
      if (sbszgrouplist.length > 0) body.szgroup_ids = sbszgrouplist;
      if (sbinchargelist.length > 0) body.koutei_pic_nos = [...new Set(sbinchargelist)];
      if (useModelFilters && sbstatuslist.length > 0) body.seizo_statuses = sbstatuslist;
    } else if (mode === 'worker') {
      if (sygroup > 0) body.team_szgroup_id = sygroup;
      if (syteamlist.length > 0) body.team_ids = syteamlist;
      if (sytasklist.length > 0) body.task_ids = sytasklist;
      if (synobody) body.show_unassigned_worker = true;
    } else if (mode === 'task') {
      if (isMorderTask) body.product_display = 'morder';
      if (tktasklist.length > 0) body.task_ids = tktasklist;
    }
    return body;
  }

  const mapSerialToDeviceGroup = useCallback((ser) => ({
    id: ser.serialId,
    kisyuName: ser.kisyuName,
    kisyuBackColor: ser.kisyuBackColor,
    kisyuFontColor: ser.kisyuFontColor,
    serialNo: ser.serialNo,
    receiptNo: ser.receiptNo ?? null,
    shippingDate: ser.shippingDate || null,
    responsible: ser.responsible || null,
    kisyuId: ser.kisyuId,
    flgSyoyo: ser.flgSyoyo,
    flgGoso: ser.flgGoso,
  }), []);

  const mapMorderToGroup = useCallback((m) => ({
    id: m.morderId,
    isMorder: true,
    morderOrderTypeId: m.orderTypeId,
    morderOrderTypeName: MORDER_ORDER_TYPE_NAMES[m.orderTypeId] || '',
    morderNo: m.morderNo || '',
    partsNo: m.partsNo || '',
    requiredDate: m.shippingDate || null,
    inspectionDate: null,
    shippingDate: m.shippingDate || null,
    kouteiPicNo: m.kouteiPicNo || '',
    publicRemark: m.publicRemark || '',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const beginGridFetch = useCallback((countsForUpdatedAt = true) => {
    gridFetchCountRef.current += 1;
    if (countsForUpdatedAt) scheduleFetchCountRef.current += 1;
    setGridFetchCount(gridFetchCountRef.current);
    return () => {
      gridFetchCountRef.current = Math.max(0, gridFetchCountRef.current - 1);
      if (countsForUpdatedAt) scheduleFetchCountRef.current = Math.max(0, scheduleFetchCountRef.current - 1);
      setGridFetchCount(gridFetchCountRef.current);
      if (countsForUpdatedAt && scheduleFetchCountRef.current === 0) setLastUpdatedAt(new Date());
    };
  }, []);

  const fetchDeviceGroups = useCallback(async (offset, q = '') => {
    if (!settingsReady) return null;
    if (mode !== 'device') return null;
    const body = {
      ...buildFilterBody(),
      offset,
      limit: q ? 1 : deviceGroupWindowSize,
    };
    if (!isMorderDevice && body.show_finished) {
      body.display_from = startDate;
      body.display_to = endDate;
    }
    delete body.product_display;
    if (q) body.q = q;

    const key = JSON.stringify({ morder: isMorderDevice, ...body });
    if (!q && deviceGroupFetchKeyRef.current === key) return null;
    if (!q) deviceGroupFetchKeyRef.current = key;
    const fetchSequence = !q ? ++deviceGroupFetchSequenceRef.current : 0;

    const endpoint = isMorderDevice ? '/morder/groups' : '/serial/device-groups';
    const mapper = isMorderDevice ? mapMorderToGroup : mapSerialToDeviceGroup;
    const endGridFetch = beginGridFetch(false);
    try {
      const data = await apiJson(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!q && fetchSequence !== deviceGroupFetchSequenceRef.current) return null;
      const groups = (data.groups || []).map(mapper);
      if (!q) {
        setDevicePagedGroups(groups);
        setDeviceGroupTotal(Number(data.total || groups.length));
        setDeviceGroupOffset(Number(data.offset || 0));
      }
      return { ...data, groups };
    } finally {
      endGridFetch();
    }
  }, [settingsReady, mode, isMorderDevice, displaySettings, deviceGroupWindowSize, startDate, endDate, mapSerialToDeviceGroup, mapMorderToGroup, beginGridFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildVisibleFilterBody = useCallback((groups) => {
    if (Array.isArray(groups) && groups.length === 1 && groups[0] && typeof groups[0] === 'object') {
      const body = groups[0];
      if (body.serial_ids || body.kisyu_ids || body.morder_ids || body.worker_ids || body.team_ids || body.task_ids || body.resource_ids) {
        return body;
      }
    }
    const groupList = (groups || []).map(g => (g && typeof g === 'object') ? g : { id: g });
    if (mode === 'task') {
      const taskIds = [...new Set(groupList.map(g => Number(g.taskId ?? g.id)).filter(Number.isFinite))];
      return taskIds.length > 0 ? { task_ids: taskIds } : null;
    }
    const ids = [...new Set(groupList.map(g => Number(g.id)).filter(Number.isFinite))];
    if (ids.length === 0) return null;
    if (mode === 'device') {
      if (isMorderDevice) return { morder_ids: ids };
      const kisyuIds = [...new Set(groupList.map(g => Number(g.kisyuId)).filter(Number.isFinite))];
      return kisyuIds.length > 0 ? { kisyu_ids: kisyuIds } : { serial_ids: ids };
    }
    if (mode === 'worker') {
      const teamIds = [...new Set(groupList.map(g => Number(g.teamId)).filter(Number.isFinite))];
      return teamIds.length > 0 ? { team_ids: teamIds } : { worker_ids: ids };
    }
    return { resource_ids: ids };
  }, [mode, isMorderDevice]);

  const makeFetchKey = useCallback((from, to, body) => {
    return JSON.stringify({ mode, from, to, body });
  }, [mode]);

  const fetchPlans = useCallback(async (from, to, groupIds = []) => {
    if (!settingsReady) return;
    const filter = buildFilterBody();
    let body;
    if (mode === 'device' && forcedSerialId != null && !isMorderDevice) {
      // 表示設定外の製番を単独表示している間は、表示設定の絞り込みを再適用しない。
      body = { serial_ids: [Number(forcedSerialId)], show_finished: 1 };
    } else if (mode === 'device') {
      const visibleFilter = buildVisibleFilterBody(groupIds);
      if (!visibleFilter) return;
      body = { ...filter, ...visibleFilter };
    } else if (mode === 'worker') {
      const visibleFilter = buildVisibleFilterBody(groupIds);
      if (!visibleFilter) return;
      body = { ...filter, ...visibleFilter };
    } else {
      const visibleFilter = buildVisibleFilterBody(groupIds);
      if (!visibleFilter) return;
      body = { ...filter, ...visibleFilter };
    }
    const key = makeFetchKey(from, to, body);
    if (fetchedPlanKeysRef.current.has(key)) return;
    if (mode === 'device') fetchedPlanKeysRef.current = new Set([key]);
    else fetchedPlanKeysRef.current.add(key);
    const fetchSequence = mode === 'device' ? ++planFetchSequenceRef.current : 0;
    const endGridFetch = beginGridFetch();
    try {
      const countResult = await apiJson(planSearchEndpoint, {
        method: 'POST',
        body: JSON.stringify({ from, to, ...body, count_only: true }),
      });
      if (mode === 'device' && fetchSequence !== planFetchSequenceRef.current) return;
      if (Number(countResult?.count || 0) === 0) {
        if (mode === 'device') {
          setPlans(prev => prev.filter(p => p.planId < 0 || pendingUpdatesRef.current.has(p.planId)));
        }
        return;
      }

      const data = await apiArray(planSearchEndpoint, {
        method: 'POST',
        body: JSON.stringify({ from, to, ...body }),
      });
      if (mode === 'device' && fetchSequence !== planFetchSequenceRef.current) return;
      setPlans(prev => {
        const deletes = pendingDeletesRef.current;
        const updates = pendingUpdatesRef.current;
        const retained = mode === 'device'
          ? prev.filter(p => p.planId < 0 || updates.has(p.planId))
          : prev;
        const existingIds = new Set(retained.map(p => p.planId));
        const newPlans = data
          .filter(p => !deletes.has(p.planId) && !existingIds.has(p.planId))
          .map(p => updates.has(p.planId) ? { ...p, ...updates.get(p.planId) } : p);
        return mode === 'device' || newPlans.length ? [...retained, ...newPlans] : prev;
      });
    } catch (e) {
      fetchedPlanKeysRef.current.delete(key);
      console.error('fetchPlans error', e);
    } finally {
      endGridFetch();
    }
  }, [settingsReady, buildVisibleFilterBody, makeFetchKey, planSearchEndpoint, mode, isMorderDevice, forcedSerialId, displaySettings, beginGridFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // 表示期間・表示設定変更時：アクティブタブのみ即時フェッチ。非アクティブは pending フラグを立てて遅延
  useEffect(() => {
    if (!settingsReady) return;
    fetchedPlanKeysRef.current = new Set();
    setPlans(retainPendingPlans);
  }, [settingsReady, startDate, endDate, displaySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLocationOverlayPlans = useCallback(async (from, to, groups = []) => {
    const groupList = (groups || []).map(g => (g && typeof g === 'object') ? g : { id: g });
    const ids = [...new Set(groupList.map(g => Number(g.id)).filter(Number.isFinite))];
    const visibleKisyuIds = [...new Set(groupList.map(g => Number(g.kisyuId)).filter(Number.isFinite))];
    if ((ids.length === 0 && visibleKisyuIds.length === 0) || isMorderDevice) return;
    const filter = buildFilterBody();
    const body = { show_finished: filter.show_finished };
    if (visibleKisyuIds.length > 0) body.kisyu_ids = visibleKisyuIds;
    else body.serial_ids = ids;
    if (filter.kisyu_ids) body.kisyu_ids = body.kisyu_ids
      ? body.kisyu_ids.filter(id => filter.kisyu_ids.includes(id))
      : filter.kisyu_ids;
    if (body.kisyu_ids && body.kisyu_ids.length === 0) return;
    const key = JSON.stringify({ mode: 'place-overlay', from, to, body });
    if (fetchedLocKeysRef.current.has(key)) return;
    fetchedLocKeysRef.current.add(key);
    const endGridFetch = beginGridFetch();
    try {
      const data = await apiArray('/reserve/search', {
        method: 'POST',
        body: JSON.stringify({ from, to, ...body }),
      });
      setLocationOverlayPlans(prev => {
        const deletes = pendingLocationDeletesRef.current;
        const updates = pendingLocationUpdatesRef.current;
        const byId = new Map(prev.filter(p => !deletes.has(p.planId)).map(p => [p.planId, p]));
        for (const plan of data) {
          if (deletes.has(plan.planId)) continue;
          byId.set(plan.planId, updates.has(plan.planId) ? { ...plan, ...updates.get(plan.planId) } : plan);
        }
        return [...byId.values()];
      });
    } catch (e) {
      fetchedLocKeysRef.current.delete(key);
      console.error('fetchLocationOverlayPlans error', e);
    } finally {
      endGridFetch();
    }
  }, [displaySettings, beginGridFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCalendar = useCallback(async (from, to) => {
    const gaps = computeGaps(fetchedCalendarRangesRef.current, from, to);
    if (gaps.length === 0) return;
    const endGridFetch = beginGridFetch();
    try {
      await Promise.all(gaps.map(async (gap) => {
        try {
          const data = await apiArray('/calendar/search', {
            method: 'POST',
            body: JSON.stringify({ from: gap.from, to: gap.to }),
          });
          setCalendarData(prev => {
            const next = new Map(prev);
            for (const c of data) next.set(c.date, { dayType: c.dayType });
            return next;
          });
          fetchedCalendarRangesRef.current.push(gap);
        } catch (e) {
          console.error('fetchCalendar error', e);
        }
      }));
    } finally {
      endGridFetch();
    }
  }, [beginGridFetch]);

  // 表示期間変更時に表示範囲全体のカレンダーを取得（カレンダーデータは設定に依存しない）
  useEffect(() => {
    fetchedCalendarRangesRef.current = [];
    setCalendarData(new Map());
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // showLocationInDevice の ON/OFF 切り替え、または表示期間・設定変更時に場所予定をフェッチ
  useEffect(() => {
    // 表示期間・表示設定の変更で機種フィルタが変わるため、古いオーバーレイ予定を破棄して取り直す
    setLocationOverlayPlans(retainPendingLocationPlans);
    fetchedLocKeysRef.current = new Set();
  }, [extraLocationRow, startDate, endDate, displaySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  function notifyHistoryChange() {
    onHistoryChange?.(mode, {
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }

  function clearEditHistory() {
    undoStackRef.current = [];
    redoStackRef.current = [];
    notifyHistoryChange();
  }

  function pushEditHistory(action) {
    undoStackRef.current = [...undoStackRef.current, action];
    redoStackRef.current = [];
    notifyHistoryChange();
  }

  function setScheduleClipboard(items, kind, action = 'copy') {
    clipboardVersionRef.current += 1;
    setCopied(items.map(item => ({ ...item })));
    setCopiedKind(kind);
    setClipboardAction(action);
    cutAppliedRef.current = false;
    setCutApplied(false);
  }

  function markCutApplied(applied) {
    cutAppliedRef.current = applied;
    setCutApplied(applied);
  }

  function refsForKind(kind) {
    return kind === 'location'
      ? {
        setState: setLocationOverlayPlans,
        creates: pendingLocationCreatesRef,
        updates: pendingLocationUpdatesRef,
        deletes: pendingLocationDeletesRef,
      }
      : {
        setState: setPlans,
        creates: pendingCreatesRef,
        updates: pendingUpdatesRef,
        deletes: pendingDeletesRef,
      };
  }

  function hasPendingChanges() {
    return pendingCreatesRef.current.size > 0
      || pendingUpdatesRef.current.size > 0
      || pendingDeletesRef.current.size > 0
      || pendingLocationCreatesRef.current.size > 0
      || pendingLocationUpdatesRef.current.size > 0
      || pendingLocationDeletesRef.current.size > 0;
  }

  function syncDirtyState() {
    const dirty = hasPendingChanges();
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }

  function applyHistoryChanges(changes, direction, kind = 'plan') {
    const useAfter = direction === 'redo';
    const refs = refsForKind(kind);
    refs.setState(prev => prev.map(plan => {
      const change = changes.find(c => c.planId === plan.planId);
      if (!change) return plan;
      const stateValue = useAfter
        ? (change.afterState ?? change.after)
        : (change.beforeState ?? change.before);
      return { ...plan, ...stateValue };
    }));

    for (const change of changes) {
      if (change.planId < 0 && refs.creates.current.has(change.planId)) {
        refs.creates.current.set(change.planId, useAfter ? change.after : change.before);
        continue;
      }
      if (useAfter) {
        refs.updates.current.set(change.planId, change.after);
      } else if (change.previousPendingHad) {
        refs.updates.current.set(change.planId, change.previousPending);
      } else {
        refs.updates.current.delete(change.planId);
      }
    }
  }

  function applyCreateHistory(action, direction) {
    const refs = refsForKind(action.kind);
    const ids = new Set(action.plans.map(plan => plan.planId));
    if (direction === 'undo') {
      refs.setState(prev => prev.filter(plan => !ids.has(plan.planId)));
      ids.forEach(id => refs.creates.current.delete(id));
      return;
    }
    refs.setState(prev => {
      const existing = new Set(prev.map(plan => plan.planId));
      return [...prev, ...action.plans.filter(plan => !existing.has(plan.planId))];
    });
    for (const plan of action.plans) refs.creates.current.set(plan.planId, action.payloads.get(plan.planId));
  }

  function applyDeleteHistory(action, direction) {
    const refs = refsForKind(action.kind);
    const ids = new Set(action.records.map(record => record.plan.planId));
    if (direction === 'undo') {
      refs.setState(prev => {
        const existing = new Set(prev.map(plan => plan.planId));
        return [...prev, ...action.records.map(record => record.plan).filter(plan => !existing.has(plan.planId))];
      });
      for (const record of action.records) {
        const id = record.plan.planId;
        refs.deletes.current.delete(id);
        if (record.hadCreate) refs.creates.current.set(id, record.createPayload);
        if (record.hadUpdate) refs.updates.current.set(id, record.updatePayload);
      }
      return;
    }
    refs.setState(prev => prev.filter(plan => !ids.has(plan.planId)));
    for (const record of action.records) {
      const id = record.plan.planId;
      if (id < 0) refs.creates.current.delete(id);
      else refs.deletes.current.add(id);
      refs.updates.current.delete(id);
    }
  }

  function applyHistoryAction(action, direction) {
    if (action.type === 'create') applyCreateHistory(action, direction);
    else if (action.type === 'delete') applyDeleteHistory(action, direction);
    else if (action.type === 'batch') {
      const actions = direction === 'undo' ? [...action.actions].reverse() : action.actions;
      for (const child of actions) applyHistoryAction(child, direction);
      if (action.clipboardVersion === clipboardVersionRef.current) {
        markCutApplied(direction === 'redo');
      }
    }
    else if (action.type === 'mixed') {
      for (const part of action.parts) applyHistoryChanges(part.changes, direction, part.kind);
    }
    else applyHistoryChanges(action.changes, direction, action.kind);
  }

  function undoLastEdit() {
    const action = undoStackRef.current.pop();
    if (!action) return;
    applyHistoryAction(action, 'undo');
    redoStackRef.current.push(action);
    notifyHistoryChange();
    syncDirtyState();
  }

  function redoLastEdit() {
    const action = redoStackRef.current.pop();
    if (!action) return;
    applyHistoryAction(action, 'redo');
    undoStackRef.current.push(action);
    notifyHistoryChange();
    syncDirtyState();
  }

  function requestConflictDecision() {
    if (conflictDecisionPromiseRef.current) {
      return conflictDecisionPromiseRef.current.promise;
    }
    let resolveDecision;
    const promise = new Promise(resolve => {
      resolveDecision = resolve;
    });
    conflictDecisionPromiseRef.current = { promise, resolve: resolveDecision };
    setUpdateConflictDialogOpen(true);
    return promise;
  }

  function resolveConflictDecision(decision) {
    const pending = conflictDecisionPromiseRef.current;
    conflictDecisionPromiseRef.current = null;
    setUpdateConflictDialogOpen(false);
    pending?.resolve(decision);
  }

  useEffect(() => () => {
    conflictDecisionPromiseRef.current?.resolve('cancel');
    conflictDecisionPromiseRef.current = null;
  }, []);

  // 保存・キャンセルを親から呼び出せるようにする
  useImperativeHandle(ref, () => ({
    undoLastEdit,
    redoLastEdit,
    async saveChanges() {
      const creates = pendingCreatesRef.current;
      const updates = pendingUpdatesRef.current;
      const deletes = pendingDeletesRef.current;
      const deletedPlanIds = new Set(deletes);
      const deletedLocationPlanIds = new Set(pendingLocationDeletesRef.current);
      let saveFailed = false;
      let skippedUpdates = false;

      // 画面取得時の更新日時とDBの現在値を、実際の保存処理に入る前に一括照合する。
      const primaryUpdateVersions = [...updates.keys()]
        .filter(planId => planId > 0 && !deletedPlanIds.has(planId))
        .map(planId => ({
          id: planId,
          updatedAt: plansRef.current.find(plan => plan.planId === planId)?.updatedAtVersion ?? null,
        }));
      const locationUpdateVersions = [...pendingLocationUpdatesRef.current.keys()]
        .filter(planId => planId > 0 && !deletedLocationPlanIds.has(planId))
        .map(planId => ({
          id: planId,
          updatedAt: locationOverlayPlansRef.current.find(plan => plan.planId === planId)?.updatedAtVersion ?? null,
        }));

      let primaryConflictIds = new Set();
      let locationConflictIds = new Set();
      try {
        const [primaryResult, locationResult] = await Promise.all([
          primaryUpdateVersions.length > 0
            ? apiJson(`${planEndpoint}/check-updates`, {
              method: 'POST',
              body: JSON.stringify({ updates: primaryUpdateVersions }),
            })
            : Promise.resolve({ conflictIds: [] }),
          locationUpdateVersions.length > 0
            ? apiJson('/reserve/check-updates', {
              method: 'POST',
              body: JSON.stringify({ updates: locationUpdateVersions }),
            })
            : Promise.resolve({ conflictIds: [] }),
        ]);
        primaryConflictIds = new Set((primaryResult.conflictIds || []).map(Number));
        locationConflictIds = new Set((locationResult.conflictIds || []).map(Number));
      } catch (err) {
        console.error('saveChanges conflict check error', err);
        showToast('予定の更新状況を確認できませんでした');
        return false;
      }

      if (primaryConflictIds.size > 0 || locationConflictIds.size > 0) {
        const decision = await requestConflictDecision();
        if (decision === 'cancel') return false;
        if (decision === 'skip') {
          skippedUpdates = true;
          primaryConflictIds.forEach(planId => updates.delete(planId));
          locationConflictIds.forEach(planId => pendingLocationUpdatesRef.current.delete(planId));
          if (primaryConflictIds.size > 0) {
            setPlans(prev => prev.filter(plan => !primaryConflictIds.has(Number(plan.planId))));
          }
          if (locationConflictIds.size > 0) {
            setLocationOverlayPlans(prev => prev.filter(plan => !locationConflictIds.has(Number(plan.planId))));
          }
        }
      }

      // 新規作成（貼り付け）：仮IDを DB の本IDで置き換える
      for (const [tempId, payload] of creates) {
        try {
          const newPlan = await apiJson(planEndpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          setPlans(prev => prev.map(p => p.planId === tempId ? { ...p, ...newPlan } : p));
          creates.delete(tempId);
        } catch (err) { saveFailed = true; console.error('saveChanges create error', err); }
      }

      // 削除（DB 上に存在する正のIDのみ）
      if (deletes.size > 0) {
        try {
          await apiJson(planEndpoint, {
            method: 'DELETE',
            body: JSON.stringify({ ids: [...deletes].map(String) }),
          });
          deletes.clear();
        } catch (err) { saveFailed = true; console.error('saveChanges delete error', err); }
      }

      // 更新（削除済みは除外）
      for (const [planId, payload] of updates) {
        if (deletedPlanIds.has(planId)) continue;
        try {
          const updatedPlan = await apiJson(`${planEndpoint}/${planId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          setPlans(prev => prev.map(plan => plan.planId === planId ? { ...plan, ...updatedPlan } : plan));
          updates.delete(planId);
        } catch (err) { saveFailed = true; console.error('saveChanges update error', err); }
      }

      // 装置タブ内で編集した場所予定を /reserve に保存する。
      for (const [tempId, payload] of pendingLocationCreatesRef.current) {
        try {
          const newPlan = await apiJson('/reserve', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          setLocationOverlayPlans(prev => prev.map(p => p.planId === tempId ? { ...p, ...newPlan } : p));
          pendingLocationCreatesRef.current.delete(tempId);
        } catch (err) { saveFailed = true; console.error('saveChanges location create error', err); }
      }
      if (pendingLocationDeletesRef.current.size > 0) {
        try {
          await apiJson('/reserve', {
            method: 'DELETE',
            body: JSON.stringify({ ids: [...pendingLocationDeletesRef.current].map(String) }),
          });
          pendingLocationDeletesRef.current.clear();
        } catch (err) { saveFailed = true; console.error('saveChanges location delete error', err); }
      }
      for (const [planId, payload] of pendingLocationUpdatesRef.current) {
        if (deletedLocationPlanIds.has(planId)) continue;
        try {
          const updatedPlan = await apiJson(`/reserve/${planId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          setLocationOverlayPlans(prev => prev.map(plan => plan.planId === planId ? { ...plan, ...updatedPlan } : plan));
          pendingLocationUpdatesRef.current.delete(planId);
        } catch (err) { saveFailed = true; console.error('saveChanges location update error', err); }
      }

      if (skippedUpdates) {
        fetchedPlanKeysRef.current = new Set();
        fetchedLocKeysRef.current = new Set();
        setFetchVersion(version => version + 1);
      }

      if (!hasPendingChanges()) {
        clearEditHistory();
        setIsDirty(false);
        onDirtyChange?.(false);
      } else {
        syncDirtyState();
        if (saveFailed) showToast('一部の予定を保存できませんでした');
      }
      return !hasPendingChanges();
    },
    async cancelChanges() {
      pendingCreatesRef.current = new Map();
      pendingUpdatesRef.current = new Map();
      pendingDeletesRef.current = new Set();
      pendingLocationCreatesRef.current = new Map();
      pendingLocationUpdatesRef.current = new Map();
      pendingLocationDeletesRef.current = new Set();
      tempIdCounterRef.current = -1;
      clearEditHistory();
      fetchedPlanKeysRef.current = new Set();
      fetchedLocKeysRef.current = new Set();
      setPlans([]);
      setLocationOverlayPlans([]);
      setIsDirty(false);
      onDirtyChange?.(false);
      setFetchVersion(v => v + 1);
    },
  }), [onDirtyChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = 0;
  }, []);

  const resetSerialSearch = useCallback(() => {
    if (mode !== 'device') return;
    deviceGroupFetchSequenceRef.current += 1;
    planFetchSequenceRef.current += 1;
    deviceGroupFetchKeyRef.current = '';
    fetchedPlanKeysRef.current = new Set();
    fetchedLocKeysRef.current = new Set();
    setSerialSearchText('');
    setForcedSerialId(null);
    setForcedSerialGroup(null);
    setDevicePagedGroups([]);
    setDeviceGroupTotal(0);
    setDeviceGroupOffset(0);
    setDeviceSearchStartOffset(null);
    setPlans(retainPendingPlans);
    setLocationOverlayPlans(retainPendingLocationPlans);
    pendingScrollSerialIdRef.current = null;
    searchAnchorSerialIdRef.current = null;
    releaseDeviceAnchorAfterLayoutRef.current = false;
    revealingPreviousDeviceRef.current = false;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      scrollRef.current.scrollLeft = 0;
    }
    setScrollTop(0);
    setScrollLeft(0);
    setSerialSearchTick(tick => tick + 1);
    setFetchVersion(version => version + 1);
  }, [mode, retainPendingPlans, retainPendingLocationPlans]);

  const handleSerialSearchClear = useCallback(() => {
    if (isDirty && onBeforeRedraw) onBeforeRedraw(resetSerialSearch);
    else resetSerialSearch();
  }, [isDirty, onBeforeRedraw, resetSerialSearch]);

  const previousDisplaySettingsApplyVersionRef = useRef(displaySettingsApplyVersion);
  useEffect(() => {
    if (previousDisplaySettingsApplyVersionRef.current === displaySettingsApplyVersion) return;
    previousDisplaySettingsApplyVersionRef.current = displaySettingsApplyVersion;
    if (mode === 'device') resetSerialSearch();
  }, [displaySettingsApplyVersion, mode, resetSerialSearch]);

  const handleSerialSearch = useCallback(async () => {
    if (mode !== 'device') return;
    const q = serialSearchText.trim();
    if (!q) {
      handleSerialSearchClear();
      return;
    }
    releaseDeviceAnchorAfterLayoutRef.current = false;

    if (isMorderDevice) {
      // 読み込み済みページ内を優先検索
      const loadedIndex = baseMorderGroups.findIndex(g => String(g.morderNo) === q || String(g.partsNo) === q);
      const loaded = loadedIndex >= 0 ? baseMorderGroups[loadedIndex] : null;
      if (loaded) {
        const targetOffset = deviceGroupOffset + loadedIndex;
        setDeviceSearchStartOffset(targetOffset);
        setForcedSerialId(null);
        setForcedSerialGroup(null);
        searchAnchorSerialIdRef.current = loaded.id;
        pendingScrollSerialIdRef.current = loaded.id;
        deviceGroupFetchKeyRef.current = '';
        await fetchDeviceGroups(targetOffset);
        setSerialSearchTick(t => t + 1);
        return;
      }
      // サーバ検索（該当ページを取得）
      const serverHit = await fetchDeviceGroups(0, q);
      const group = serverHit?.groups?.[0];
      if (!group) return;
      const targetOffset = Math.max(0, Number(serverHit.offset || 0));
      setDeviceSearchStartOffset(targetOffset);
      setForcedSerialId(null);
      setForcedSerialGroup(null);
      searchAnchorSerialIdRef.current = group.id;
      pendingScrollSerialIdRef.current = group.id;
      deviceGroupFetchKeyRef.current = '';
      await fetchDeviceGroups(targetOffset);
      setSerialSearchTick(t => t + 1);
      return;
    }

    let loadedGroupIndex = baseDeviceGroups.findIndex(g => String(g.serialNo) === q);
    if (loadedGroupIndex < 0) loadedGroupIndex = baseDeviceGroups.findIndex(g => String(g.serialNo).includes(q));
    const loadedGroupHit = loadedGroupIndex >= 0 ? baseDeviceGroups[loadedGroupIndex] : null;
    if (loadedGroupHit) {
      const targetOffset = deviceGroupOffset + loadedGroupIndex;
      setDeviceSearchStartOffset(targetOffset);
      setForcedSerialId(null);
      setForcedSerialGroup(null);
      searchAnchorSerialIdRef.current = loadedGroupHit.id;
      pendingScrollSerialIdRef.current = loadedGroupHit.id;
      deviceGroupFetchKeyRef.current = '';
      await fetchDeviceGroups(targetOffset);
      setSerialSearchTick(t => t + 1);
      return;
    }

    const serverHit = await fetchDeviceGroups(0, q);
    const group = serverHit?.groups?.[0];
    if (group) {
      const targetOffset = Math.max(0, Number(serverHit.offset || 0));
      setDeviceSearchStartOffset(targetOffset);
      setForcedSerialId(null);
      setForcedSerialGroup(null);
      searchAnchorSerialIdRef.current = group.id;
      pendingScrollSerialIdRef.current = group.id;
      deviceGroupFetchKeyRef.current = '';
      await fetchDeviceGroups(targetOffset);
      setSerialSearchTick(t => t + 1);
      return;
    }

    // 表示設定の対象外なら、設定を適用しない製番検索へフォールバックする。
    const rawSerial = await apiJson(`/serial/search?q=${encodeURIComponent(q)}`);
    if (!rawSerial?.serialId) {
      showToast('表示対象データがありませんでした');
      return;
    }
    const targetSerialId = Number(rawSerial.serialId);
    const targetGroup = { ...rawSerial, id: targetSerialId };
    const targetPlans = await apiArray(`/plan/by-serial/${targetSerialId}`);
    const earliestStartDate = targetPlans.length > 0
      ? String(targetPlans[0].startDate || '').slice(0, 10)
      : null;

    const showOnlyTargetSerial = () => {
      deviceGroupFetchSequenceRef.current += 1;
      planFetchSequenceRef.current += 1;
      deviceGroupFetchKeyRef.current = '';
      fetchedPlanKeysRef.current = new Set();
      setDevicePagedGroups([]);
      setDeviceGroupTotal(0);
      setDeviceGroupOffset(0);
      setDeviceSearchStartOffset(null);
      setForcedSerialGroup(targetGroup);
      setForcedSerialId(targetSerialId);
      setPlans(prev => {
        const retained = retainPendingPlans(prev);
        const byId = new Map(retained.map(plan => [plan.planId, plan]));
        for (const plan of targetPlans) {
          if (pendingDeletesRef.current.has(plan.planId)) continue;
          const current = pendingUpdatesRef.current.get(plan.planId);
          byId.set(plan.planId, current ? { ...plan, ...current } : plan);
        }
        return [...byId.values()];
      });
      if (earliestStartDate) setStartDate(earliestStartDate);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
        scrollRef.current.scrollLeft = 0;
      }
      setScrollTop(0);
      setScrollLeft(0);
      searchAnchorSerialIdRef.current = targetSerialId;
      pendingScrollSerialIdRef.current = targetSerialId;
      setSerialSearchTick(t => t + 1);
    };

    if (isDirty && onBeforeRedraw) onBeforeRedraw(showOnlyTargetSerial);
    else showOnlyTargetSerial();
  }, [mode, serialSearchText, baseDeviceGroups, baseMorderGroups, isMorderDevice, deviceGroupOffset, fetchDeviceGroups, isDirty, onBeforeRedraw, retainPendingPlans, handleSerialSearchClear]);

  const handleWorkerSearch = useCallback(() => {
    if (mode !== 'worker') return;
    const q = workerSearchText.trim();
    if (!q) {
      pendingScrollWorkerIdRef.current = null;
      searchAnchorWorkerIdRef.current = null;
      releaseWorkerAnchorAfterLayoutRef.current = false;
      revealingPreviousWorkerRef.current = false;
      setWorkerSearchStartId(null);
      setWorkerSearchTick(t => t + 1);
      return;
    }

    const sygroup = displaySettings.sygroup || 0;
    const syteamlist = displaySettings.syteamlist || [];
    let candidates = workers || [];
    if (sygroup > 0) candidates = candidates.filter(w => w.szgroupId === sygroup);
    if (syteamlist.length > 0) candidates = candidates.filter(w => syteamlist.includes(w.teamId));

    const isUserNoSearch = /^\d{4,}$/.test(q);
    const lower = q.toLowerCase();
    const hits = candidates.filter(w => {
      if (isUserNoSearch) return String(w.userNo || '').includes(q);
      return String(w.workerName || '').toLowerCase().includes(lower);
    });

    if (hits.length === 0) {
      showToast('表示対象データがありませんでした');
      return;
    }

    setWorkerSearchStartId(hits[0].workerId);
    releaseWorkerAnchorAfterLayoutRef.current = false;
    searchAnchorWorkerIdRef.current = hits[0].workerId;
    pendingScrollWorkerIdRef.current = hits[0].workerId;
    setWorkerSearchTick(t => t + 1);
  }, [mode, workerSearchText, workers, displaySettings]);

  const onScroll = useCallback(e => {
    const sl = e.currentTarget.scrollLeft;
    const st = e.currentTarget.scrollTop;
    setScrollTop(st);
    setScrollLeft(sl);
  }, []);

  const releaseSearchScrollRestriction = useCallback((direction = 0, revealPrevious = false) => {
    jumpAnchorPlanIdRef.current = null;
    pendingJumpSonarPlanIdRef.current = null;
    const nearTop = (scrollRef.current?.scrollTop ?? 0) <= CELL_SIZE * 2;
    const shouldRevealPrevious = revealPrevious || (direction < 0 && nearTop);

    if (mode === 'device') {
      if (shouldRevealPrevious && deviceSearchStartOffset != null && deviceSearchStartOffset > 0 && !revealingPreviousDeviceRef.current) {
        // 上方向だけ直前のグループを段階的に追加し、現在の先頭製番は同じ画面位置に維持する。
        const newStartOffset = Math.max(0, deviceSearchStartOffset - DEVICE_GROUP_OVERSCAN / 2);
        revealingPreviousDeviceRef.current = true;
        searchAnchorSerialIdRef.current = devicePagedGroups[0]?.id ?? searchAnchorSerialIdRef.current;
        releaseDeviceAnchorAfterLayoutRef.current = true;
        setDeviceSearchStartOffset(newStartOffset);
        deviceGroupFetchKeyRef.current = '';
        fetchDeviceGroups(newStartOffset)
          .catch(e => console.error('fetch previous device groups error', e))
          .finally(() => { revealingPreviousDeviceRef.current = false; });
      } else {
        searchAnchorSerialIdRef.current = null;
      }
    }
    if (mode === 'worker') {
      if (shouldRevealPrevious && workerSearchStartId != null && !revealingPreviousWorkerRef.current) {
        const sygroup = displaySettings.sygroup || 0;
        const syteamlist = displaySettings.syteamlist || [];
        let orderedWorkers = workers || [];
        if (sygroup > 0) orderedWorkers = orderedWorkers.filter(worker => worker.szgroupId === sygroup);
        if (syteamlist.length > 0) orderedWorkers = orderedWorkers.filter(worker => syteamlist.includes(worker.teamId));
        orderedWorkers = [...orderedWorkers].sort((a, b) => (a.teamId - b.teamId) || (a.workerId - b.workerId));
        const currentIndex = orderedWorkers.findIndex(worker => Number(worker.workerId) === Number(workerSearchStartId));
        const newStartIndex = Math.max(0, currentIndex - DEVICE_GROUP_OVERSCAN / 2);
        if (currentIndex > 0 && orderedWorkers[newStartIndex]) {
          revealingPreviousWorkerRef.current = true;
          searchAnchorWorkerIdRef.current = workerSearchStartId;
          releaseWorkerAnchorAfterLayoutRef.current = true;
          setWorkerSearchStartId(orderedWorkers[newStartIndex].workerId);
        } else {
          searchAnchorWorkerIdRef.current = null;
        }
      } else {
        searchAnchorWorkerIdRef.current = null;
      }
    }
  }, [mode, deviceSearchStartOffset, devicePagedGroups, workerSearchStartId, displaySettings, workers, fetchDeviceGroups]);

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

  const triggerPlanSonar = useCallback((planId) => {
    if (sonarRafRef.current) cancelAnimationFrame(sonarRafRef.current);
    if (sonarClearTimerRef.current) clearTimeout(sonarClearTimerRef.current);
    sonarRafRef.current = requestAnimationFrame(() => {
      sonarRafRef.current = requestAnimationFrame(() => {
        // 座標ではなく予定IDを保持し、装置グループ差し替え後も最新バー位置へ追従させる。
        setSonar({ planId, key: Date.now() });
        sonarClearTimerRef.current = setTimeout(() => setSonar(null), 2200);
      });
    });
  }, []);

  const visRowStart = Math.max(0, Math.floor(scrollTop / CELL_SIZE) - BUFFER_ROWS);
  const visRowEnd   = Math.min(totalRows - 1, Math.ceil((scrollTop + containerH) / CELL_SIZE) + BUFFER_ROWS);
  const visColStart = Math.max(0, Math.floor(scrollLeft / colW) - 2);
  const visColEnd   = Math.min(totalCols - 1, Math.ceil((scrollLeft + containerW) / colW) + 2);

  const visibleGroups = useMemo(() => {
    const groups = [];
    for (const g of layoutGroups) {
      const groupEndRow = g.startRow + g.numRows - 1;
      if (g.startRow <= visRowEnd && groupEndRow >= visRowStart && !g.isUnassigned) {
        groups.push(g);
      }
    }
    return groups;
  }, [layoutGroups, visRowStart, visRowEnd]);

  const planFetchGroups = useMemo(() => {
    if (mode !== 'device') return visibleGroups;
    return filteredGroups;
  }, [mode, visibleGroups, filteredGroups]);

  const visibleFilterBody = useMemo(
    () => buildVisibleFilterBody(planFetchGroups),
    [buildVisibleFilterBody, planFetchGroups],
  );
  const visibleFilterKey = useMemo(
    () => JSON.stringify(visibleFilterBody || {}),
    [visibleFilterBody],
  );

  const visibleFetchRange = useMemo(() => {
    const from = colToDateStr(startDate, Math.max(0, Math.floor(scrollLeft / colW)), viewMode);
    const to = colToDateStr(startDate, Math.min(totalCols - 1, Math.ceil((scrollLeft + containerW) / colW)), viewMode);
    return {
      from: from < startDate ? startDate : from,
      to: addDays(to, 30) > endDate ? endDate : addDays(to, 30),
    };
  }, [startDate, endDate, scrollLeft, colW, containerW, totalCols, viewMode]);

  useEffect(() => {
    if (!settingsReady || mode !== 'device') return;
    setDevicePagedGroups([]);
    setDeviceGroupTotal(0);
    setDeviceGroupOffset(0);
    deviceGroupFetchKeyRef.current = '';
    fetchedPlanKeysRef.current = new Set();
    setPlans(retainPendingPlans);
  }, [settingsReady, mode, isMorderDevice, displaySettings, deviceCount, startDate, endDate, forcedSerialId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settingsReady || !active || mode !== 'device') return;
    if (forcedSerialId != null) return;
    const searchStartOffset = deviceSearchStartOffset ?? 0;
    const visibleStart = searchStartOffset + Math.max(0, Math.floor(scrollTop / (planMinRows * CELL_SIZE)));
    const visibleEnd = visibleStart + visibleDeviceGroupCount;
    const loadedStart = deviceGroupOffset;
    const loadedEnd = loadedStart + devicePagedGroups.length;
    const buffer = DEVICE_GROUP_OVERSCAN / 4;
    const hasLeadingBuffer = loadedStart === 0 || visibleStart >= loadedStart + buffer;
    const hasTrailingBuffer = loadedEnd >= deviceGroupTotal || visibleEnd <= loadedEnd - buffer;
    if (devicePagedGroups.length > 0
      && hasLeadingBuffer
      && hasTrailingBuffer) return;

    const offset = Math.max(searchStartOffset, visibleStart - DEVICE_GROUP_OVERSCAN / 2);
    const timer = setTimeout(() => {
      fetchDeviceGroups(offset).catch(e => console.error('fetchDeviceGroups error', e));
    }, 150);
    return () => clearTimeout(timer);
  }, [settingsReady, active, mode, isMorderDevice, displaySettings, scrollTop, planMinRows, visibleDeviceGroupCount, devicePagedGroups.length, deviceGroupOffset, deviceSearchStartOffset, forcedSerialId, fetchDeviceGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // スクロール停止後だけ、現在描画している日付・行の予定を取得する。
  useEffect(() => {
    if (!settingsReady || !active) return;
    const timer = setTimeout(() => {
      fetchPlans(visibleFetchRange.from, visibleFetchRange.to, visibleFilterBody ? [visibleFilterBody] : []);
      if (extraLocationRow) {
        fetchLocationOverlayPlans(visibleFetchRange.from, visibleFetchRange.to, visibleGroups);
      }
      fetchCalendar(visibleFetchRange.from, visibleFetchRange.to);
    }, 250);
    return () => clearTimeout(timer);
  }, [settingsReady, active, visibleFetchRange, visibleFilterKey, devicePagedGroups.length, deviceGroupOffset, extraLocationRow, fetchPlans, fetchLocationOverlayPlans, fetchCalendar, fetchVersion]);

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

  function isLocationRow(group, rowIdx) {
    if (!group || group.locationRowIdx < 0) return false;
    const relativeRow = rowIdx - group.startRow;
    return relativeRow >= group.locationRowIdx
      && relativeRow < group.locationRowIdx + (group.locationNumRows || 1);
  }

  function getLocationPlanBar(plan) {
    const startCol = planToStartCol(plan, startDate, viewMode);
    const endCol = planToEndCol(plan, startDate, viewMode);
    const g = layoutGroups.find(group => group.locationPlans?.some(p => p.planId === plan.planId));
    if (!g) return null;
    const pp = g.locationPlans.find(p => p.planId === plan.planId);
    if (!pp) return null;
    return {
      startCol,
      endCol,
      rowIdx: pp.rowIdx,
      groupStartRow: g.startRow,
      locationRowIdx: g.locationRowIdx,
    };
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
      const newSelectedLocation = new Set();
      for (const g of layoutGroupsRef.current) {
        for (const p of (g.plans || [])) {
          const sc = planToStartCol(p, startDate, viewMode);
          const ec = planToEndCol(p, startDate, viewMode);
          const absRow = g.startRow + p.rowIdx;
          const bx1 = sc * colW;
          const bx2 = (ec + 1) * colW;
          const by1 = absRow * CELL_SIZE;
          const by2 = (absRow + 1) * CELL_SIZE;
          if (!isReadOnlyPlan(p, mode) && bx1 < selX2 && bx2 > selX1 && by1 < selY2 && by2 > selY1) {
            newSelected.add(p.planId);
          }
        }
        for (const p of (g.locationPlans || [])) {
          const sc = planToStartCol(p, startDate, viewMode);
          const ec = planToEndCol(p, startDate, viewMode);
          const absRow = g.startRow + g.locationRowIdx + p.rowIdx;
          const bx1 = sc * colW;
          const bx2 = (ec + 1) * colW;
          const by1 = absRow * CELL_SIZE;
          const by2 = (absRow + 1) * CELL_SIZE;
          if (bx1 < selX2 && bx2 > selX1 && by1 < selY2 && by2 > selY1) {
            newSelectedLocation.add(p.planId);
          }
        }
      }

      setSelected(newSelected);
      setSelectedLocation(newSelectedLocation);
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
    const additiveSelection = e.ctrlKey || e.metaKey;
    const isPartOfMultiSelection = selected.has(plan.planId)
      && selected.size + selectedLocation.size > 1;
    let capturedSelected;
    let capturedLocationSelected;
    if (additiveSelection) {
      capturedSelected = new Set(selected);
      capturedSelected.has(plan.planId)
        ? capturedSelected.delete(plan.planId)
        : capturedSelected.add(plan.planId);
      capturedLocationSelected = selectedLocation;
      setSelected(prev => {
        const s = new Set(prev);
        s.has(plan.planId) ? s.delete(plan.planId) : s.add(plan.planId);
        return s;
      });
    } else if (isPartOfMultiSelection) {
      // 明示的な複数選択内のバーをドラッグした場合だけ、装置・場所の混在選択を維持する。
      capturedSelected = selected;
      capturedLocationSelected = selectedLocation;
    } else {
      capturedSelected = new Set([plan.planId]);
      capturedLocationSelected = new Set();
      setSelected(capturedSelected);
      setSelectedLocation(capturedLocationSelected);
    }

    if (isReadOnlyPlan(plan, mode)) return;

    const bar = getPlanBar(plan);
    if (!bar) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const dragPlans = [...capturedSelected].map(id => plans.find(p => p.planId === id)).filter(p => p && !isReadOnlyPlan(p, mode));
    if (!dragPlans.some(p => p.planId === plan.planId)) dragPlans.push(plan);
    if (dragPlans.length === 0) return;
    const locationDragPlans = [...capturedLocationSelected]
      .map(id => locationOverlayPlans.find(p => p.planId === id))
      .filter(Boolean);

    dragRef.current = {
      type,
      plan,
      dragPlans,
      startX, startY,
      deltaCol: 0, deltaRow: 0,
      active: false,
      locationDragPlans,
    };
    if (locationDragPlans.length > 0) {
      locationDragRef.current = {
        ...dragRef.current,
        plan: locationDragPlans[0],
        dragPlans: locationDragPlans,
      };
    }

    const onMove = (e2) => {
      if (!dragRef.current) return;
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      const dc = Math.round(dx / colW);
      // タスクタブと担当者タブの個人予定は、所属行を変えず横方向だけ移動する。
      const verticalMoveDisabled = mode === 'task' || (mode === 'worker' && isPersonalPlan(plan));
      const dr = verticalMoveDisabled ? 0 : Math.round(dy / CELL_SIZE);
      if (!dragRef.current.active && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragRef.current.active = true;
      }
      dragRef.current.deltaCol = dc;
      dragRef.current.deltaRow = dr;
      if (locationDragRef.current) {
        locationDragRef.current.deltaCol = dc;
        locationDragRef.current.deltaRow = dr;
        locationDragRef.current.active = dragRef.current.active;
        setLocationGhostDrag({ ...locationDragRef.current });
      }
      containerRef.current && (containerRef.current._dragState = { ...dragRef.current });
      containerRef.current?.dispatchEvent(new CustomEvent('dragupdate'));
    };

    const onUp = async () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!dragRef.current || !dragRef.current.active) {
        dragRef.current = null;
        locationDragRef.current = null;
        setGhostDrag(null);
        setLocationGhostDrag(null);
        return;
      }
      const drag = dragRef.current;
      const destinationGroupId = resolveDragDestinationGroupId(drag.plan, drag.type, drag.deltaRow, 'plan');
      const mixed = drag.locationDragPlans.length > 0;
      const planChanges = await commitDrag({ ...drag, destinationGroupId, recordHistory: !mixed });
      if (drag.locationDragPlans.length > 0) {
        const locationChanges = await commitLocationDrag({
          ...drag,
          plan: drag.locationDragPlans[0],
          dragPlans: drag.locationDragPlans,
          destinationGroupId,
          recordHistory: false,
        });
        const parts = [
          { kind: 'plan', changes: planChanges },
          { kind: 'location', changes: locationChanges },
        ].filter(part => part.changes.length > 0);
        if (parts.length > 0) pushEditHistory({ type: 'mixed', parts });
      }
      dragRef.current = null;
      locationDragRef.current = null;
      setGhostDrag(null);
      setLocationGhostDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function resolveDragDestinationGroupId(plan, type, deltaRow, kind) {
    if (type !== 'move' || deltaRow === 0) return null;
    const bar = kind === 'location' ? getLocationPlanBar(plan) : getPlanBar(plan);
    if (!bar) return null;
    const sourceRow = kind === 'location'
      ? bar.groupStartRow + bar.locationRowIdx + bar.rowIdx
      : bar.groupStartRow + bar.rowIdx;
    const destinationGroup = getGroupAtRow(sourceRow + deltaRow);
    return destinationGroup?.id ?? null;
  }

  async function commitDrag(drag) {
    const { type, plan, dragPlans, deltaCol, deltaRow, destinationGroupId, recordHistory = true } = drag;
    const movedGroupPlanIds = [];
    const historyChanges = [];

    // 複数選択ドラッグ時の移動先グループは、ドラッグ主対象の着地先を全プランに共通適用する
    let destGroupId = destinationGroupId === undefined ? null : destinationGroupId;
    if (destinationGroupId === undefined && type === 'move' && deltaRow !== 0) {
      const mainBar = getPlanBar(plan);
      if (mainBar) {
        const destAbsRow = mainBar.groupStartRow + mainBar.rowIdx + deltaRow;
        const destGroup  = getGroupAtRow(destAbsRow);
        if (destGroup) destGroupId = destGroup.id;
      }
    }
    const destinationGroup = destGroupId !== null
      ? layoutGroups.find(group => String(group.id) === String(destGroupId)) ?? null
      : null;

    for (const dp of dragPlans) {
      if (isReadOnlyPlan(dp, mode)) continue;
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
      let newMorderId   = dp.morderId;
      let newWorkerId   = dp.workerId;
      let newResourceId = dp.resourceId;
      let destinationVisualFields = {};
      if (destGroupId !== null) {
        if (mode === 'device' && isMorderDevice) newMorderId = destGroupId;
        else if (mode === 'device') newSerialId = destGroupId;
        else if (mode === 'worker' && destinationGroup?.isUnassigned) {
          // 社員未定予定を別製番/M番行へ移動する場合は、担当者未定のまま製品だけを変更する。
          const isUnassignedPlan = dp.workerId == null || Number(dp.workerId) <= 0;
          if (isUnassignedPlan && !isPersonalPlan(dp)) {
            if (destinationGroup.unassignedKind === 'serial') {
              newSerialId = Number(destinationGroup.serialId);
              newMorderId = -1;
              destinationVisualFields = {
                serialNo: destinationGroup.serialNo ?? '',
                kisyuId: destinationGroup.kisyuId ?? null,
                kisyuName: destinationGroup.kisyuName ?? '',
                kisyuBackColor: destinationGroup.kisyuBackColor ?? null,
                kisyuFontColor: destinationGroup.kisyuFontColor ?? null,
                morderNo: '',
                morderOrderTypeId: null,
                morderOrderTypeName: '',
              };
            } else {
              newSerialId = -1;
              newMorderId = Number(destinationGroup.morderId);
              destinationVisualFields = {
                serialNo: '',
                kisyuId: null,
                kisyuName: destinationGroup.kisyuName ?? '',
                morderNo: destinationGroup.morderNo ?? '',
                morderOrderTypeId: destinationGroup.morderOrderTypeId ?? null,
                morderOrderTypeName: destinationGroup.morderOrderTypeName ?? '',
              };
            }
          }
        }
        else if (mode === 'worker' && !isPersonalPlan(dp)) newWorkerId = destGroupId;
        else newResourceId = destGroupId;
      }
      const groupChanged =
        type === 'move'
        && destGroupId !== null
        && (
          (mode === 'device' && isMorderDevice && Number(dp.morderId) !== Number(newMorderId))
          || (mode === 'device' && !isMorderDevice && Number(dp.serialId) !== Number(newSerialId))
          || (mode === 'worker' && (
            Number(dp.workerId) !== Number(newWorkerId)
            || Number(dp.serialId) !== Number(newSerialId)
            || Number(dp.morderId) !== Number(newMorderId)
          ))
          || (mode === 'place' && Number(dp.resourceId) !== Number(newResourceId))
        );
      if (groupChanged) movedGroupPlanIds.push(dp.planId);

      // API は呼ばず、ローカル state を即時更新して保留リストに積む
      const beforePayload = mode === 'place'
        ? { resourceId: dp.resourceId, serialId: dp.serialId, startDate: dp.startDate, endDate: dp.endDate, remark: dp.remark ?? '' }
        : {
          serialId: dp.serialId, morderId: dp.morderId, taskId: dp.taskId, workerId: dp.workerId,
          teacherId: dp.teacherId, startDate: dp.startDate, endDate: dp.endDate,
          plannedMinutes: dp.plannedMinutes ?? 0, price: dp.price ?? 0, remark: dp.remark ?? '',
        };
      const payload = mode === 'place'
        ? { resourceId: newResourceId, serialId: newSerialId, startDate: newStartDate, endDate: newEndDate, remark: dp.remark ?? '' }
        : {
          serialId: newSerialId, morderId: newMorderId, taskId: dp.taskId, workerId: newWorkerId,
          teacherId: dp.teacherId, startDate: newStartDate, endDate: newEndDate,
          plannedMinutes: dp.plannedMinutes ?? 0, price: dp.price ?? 0, remark: dp.remark ?? '',
        };
      const changed = Object.keys(payload).some(key => String(payload[key] ?? '') !== String(beforePayload[key] ?? ''));
      if (!changed) continue;
      const previousPendingHad = pendingUpdatesRef.current.has(dp.planId);
      const previousPending = previousPendingHad ? { ...pendingUpdatesRef.current.get(dp.planId) } : null;
      historyChanges.push({
        planId: dp.planId,
        before: beforePayload,
        after: payload,
        beforeState: {
          ...beforePayload,
          serialNo: dp.serialNo,
          kisyuId: dp.kisyuId,
          kisyuName: dp.kisyuName,
          kisyuBackColor: dp.kisyuBackColor,
          kisyuFontColor: dp.kisyuFontColor,
          morderNo: dp.morderNo,
          morderOrderTypeId: dp.morderOrderTypeId,
          morderOrderTypeName: dp.morderOrderTypeName,
        },
        afterState: { ...payload, ...destinationVisualFields },
        previousPendingHad,
        previousPending,
      });
      setPlans(prev => prev.map(p =>
        p.planId === dp.planId ? { ...p, ...payload, ...destinationVisualFields } : p
      ));
      if (dp.planId < 0 && pendingCreatesRef.current.has(dp.planId)) {
        pendingCreatesRef.current.set(dp.planId, payload);
      } else {
        pendingUpdatesRef.current.set(dp.planId, payload);
      }
      setIsDirty(true);
      onDirtyChange?.(true);
    }
    if (recordHistory && historyChanges.length > 0) {
      pushEditHistory({ type: 'drag', changes: historyChanges });
    }
    if (movedGroupPlanIds.length > 0) {
      if (groupMoveHighlightTimerRef.current) clearTimeout(groupMoveHighlightTimerRef.current);
      setGroupMoveHighlightIds(new Set(movedGroupPlanIds));
      groupMoveHighlightTimerRef.current = setTimeout(() => {
        setGroupMoveHighlightIds(new Set());
        groupMoveHighlightTimerRef.current = null;
      }, 3500);
    }
    return historyChanges;
  }

  function handleLocationBarPointerDown(e, plan, type) {
    e.stopPropagation();
    if (e.button !== 0) return;

    setSelectedCell(null);
    const additiveSelection = e.ctrlKey || e.metaKey;
    const isPartOfMultiSelection = selectedLocation.has(plan.planId)
      && selected.size + selectedLocation.size > 1;
    let capturedSelectedLocation;
    let capturedRegularSelected;
    if (additiveSelection) {
      capturedSelectedLocation = new Set(selectedLocation);
      capturedSelectedLocation.has(plan.planId)
        ? capturedSelectedLocation.delete(plan.planId)
        : capturedSelectedLocation.add(plan.planId);
      capturedRegularSelected = selected;
      setSelectedLocation(prev => {
        const next = new Set(prev);
        next.has(plan.planId) ? next.delete(plan.planId) : next.add(plan.planId);
        return next;
      });
    } else if (isPartOfMultiSelection) {
      capturedSelectedLocation = selectedLocation;
      capturedRegularSelected = selected;
    } else {
      capturedSelectedLocation = new Set([plan.planId]);
      capturedRegularSelected = new Set();
      setSelectedLocation(capturedSelectedLocation);
      setSelected(capturedRegularSelected);
    }

    const bar = getLocationPlanBar(plan);
    if (!bar) return;
    const dragPlans = [...capturedSelectedLocation]
      .map(id => locationOverlayPlans.find(p => p.planId === id))
      .filter(Boolean);
    if (!dragPlans.some(p => p.planId === plan.planId)) dragPlans.push(plan);
    const regularDragPlans = [...capturedRegularSelected]
      .map(id => plans.find(p => p.planId === id))
      .filter(p => p && !isReadOnlyPlan(p, mode));

    const startX = e.clientX;
    const startY = e.clientY;
    locationDragRef.current = {
      type,
      plan,
      dragPlans,
      startX,
      startY,
      deltaCol: 0,
      deltaRow: 0,
      active: false,
      regularDragPlans,
    };
    if (regularDragPlans.length > 0) {
      dragRef.current = {
        ...locationDragRef.current,
        plan: regularDragPlans[0],
        dragPlans: regularDragPlans,
      };
    }

    const onMove = (e2) => {
      if (!locationDragRef.current) return;
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      locationDragRef.current.deltaCol = Math.round(dx / colW);
      locationDragRef.current.deltaRow = Math.round(dy / CELL_SIZE);
      if (!locationDragRef.current.active && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        locationDragRef.current.active = true;
      }
      if (dragRef.current) {
        dragRef.current.deltaCol = locationDragRef.current.deltaCol;
        dragRef.current.deltaRow = locationDragRef.current.deltaRow;
        dragRef.current.active = locationDragRef.current.active;
        containerRef.current && (containerRef.current._dragState = { ...dragRef.current });
        containerRef.current?.dispatchEvent(new CustomEvent('dragupdate'));
      }
      setLocationGhostDrag({ ...locationDragRef.current });
    };

    const onUp = async () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const drag = locationDragRef.current;
      locationDragRef.current = null;
      dragRef.current = null;
      setLocationGhostDrag(null);
      setGhostDrag(null);
      if (!drag?.active) return;
      const destinationGroupId = resolveDragDestinationGroupId(drag.plan, drag.type, drag.deltaRow, 'location');
      const mixed = drag.regularDragPlans.length > 0;
      const locationChanges = await commitLocationDrag({ ...drag, destinationGroupId, recordHistory: !mixed });
      if (drag.regularDragPlans.length > 0) {
        const planChanges = await commitDrag({
          ...drag,
          plan: drag.regularDragPlans[0],
          dragPlans: drag.regularDragPlans,
          destinationGroupId,
          recordHistory: false,
        });
        const parts = [
          { kind: 'location', changes: locationChanges },
          { kind: 'plan', changes: planChanges },
        ].filter(part => part.changes.length > 0);
        if (parts.length > 0) pushEditHistory({ type: 'mixed', parts });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async function commitLocationDrag(drag) {
    const { type, plan, dragPlans, deltaCol, deltaRow, destinationGroupId, recordHistory = true } = drag;
    let destinationSerialId = destinationGroupId === undefined ? null : destinationGroupId;
    if (destinationGroupId === undefined && type === 'move' && deltaRow !== 0) {
      const mainBar = getLocationPlanBar(plan);
      if (mainBar) {
        const sourceRow = mainBar.groupStartRow + mainBar.locationRowIdx + mainBar.rowIdx;
        const destinationGroup = getGroupAtRow(sourceRow + deltaRow);
        if (destinationGroup && Number(destinationGroup.id) > 0) {
          destinationSerialId = Number(destinationGroup.id);
        }
      }
    }

    const historyChanges = [];
    for (const locationPlan of dragPlans) {
      const bar = getLocationPlanBar(locationPlan);
      if (!bar) continue;
      let newStartCol = bar.startCol;
      let newEndCol = bar.endCol;
      if (type === 'move') {
        newStartCol += deltaCol;
        newEndCol += deltaCol;
      } else if (type === 'resize-left') {
        newStartCol = Math.min(bar.endCol, bar.startCol + deltaCol);
      } else {
        newEndCol = Math.max(bar.startCol, bar.endCol + deltaCol);
      }
      newStartCol = Math.max(0, Math.min(newStartCol, totalCols - 1));
      newEndCol = Math.max(newStartCol, Math.min(newEndCol, totalCols - 1));

      const before = {
        resourceId: locationPlan.resourceId,
        serialId: locationPlan.serialId,
        startDate: locationPlan.startDate,
        endDate: locationPlan.endDate,
        remark: locationPlan.remark ?? '',
      };
      const after = {
        ...before,
        serialId: destinationSerialId ?? locationPlan.serialId,
        startDate: colToDateTime(startDate, newStartCol, 'start', viewMode),
        endDate: colToDateTime(startDate, newEndCol, 'end', viewMode),
      };
      if (!Object.keys(after).some(key => String(after[key] ?? '') !== String(before[key] ?? ''))) continue;
      const previousPendingHad = pendingLocationUpdatesRef.current.has(locationPlan.planId);
      const previousPending = previousPendingHad
        ? { ...pendingLocationUpdatesRef.current.get(locationPlan.planId) }
        : null;
      historyChanges.push({
        planId: locationPlan.planId,
        before,
        after,
        previousPendingHad,
        previousPending,
      });
      setLocationOverlayPlans(prev => prev.map(p => p.planId === locationPlan.planId ? { ...p, ...after } : p));
      if (locationPlan.planId < 0 && pendingLocationCreatesRef.current.has(locationPlan.planId)) {
        pendingLocationCreatesRef.current.set(locationPlan.planId, after);
      } else {
        pendingLocationUpdatesRef.current.set(locationPlan.planId, after);
      }
    }
    if (historyChanges.length === 0) return [];
    if (recordHistory) pushEditHistory({ type: 'drag', kind: 'location', changes: historyChanges });
    setIsDirty(true);
    onDirtyChange?.(true);
    return historyChanges;
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

  useEffect(() => () => {
    if (groupMoveHighlightTimerRef.current) clearTimeout(groupMoveHighlightTimerRef.current);
  }, []);

  function handleCellRightClick(e, col, row) {
    e.preventDefault();
    const g = getGroupAtRow(row);
    if (mode === 'task') {
      return;
    }
    const locationCell = mode === 'device' && extraLocationRow && isLocationRow(g, row);
    setSelectedCell({ col, row });
    setSelected(new Set());
    setSelectedLocation(new Set());
    if (locationCell) {
      const startDateTime = colToDateTime(startDate, col, 'start', viewMode);
      const endDateTime = colToDateTime(startDate, col + (viewMode === 'slot' ? 5 : 0), 'end', viewMode);
      const items = [{
        label: '場所予定を追加',
        onClick: () => openScheduleDialog({
          plan: null,
          kind: 'location',
          initialData: {
            serialId: g?.id,
            serialNo: g?.serialNo,
            kisyuId: g?.kisyuId,
            kisyuName: g?.kisyuName,
            kisyuBackColor: g?.kisyuBackColor,
            kisyuFontColor: g?.kisyuFontColor,
            startDate: startDateTime,
            endDate: endDateTime,
          },
        }),
      }];
      if (copiedKind === 'location' && copied.length > 0) {
        items.push({
          label: `場所予定を貼り付け（${copied.length}件）`,
          onClick: () => pasteLocationPlans(col, row),
        });
      }
      setContextMenu({ x: e.clientX, y: e.clientY, items });
      return;
    }
    const items = [
      // 社員未定の行は予定の新規登録不可（担当者が定まらないため）
      ...(g?.isUnassigned ? [] : [{
        label: '予定を追加',
        onClick: () => {
          const dateStr = colToDateTime(startDate, col, 'start', viewMode);
          const endStr = colToDateTime(startDate, col + (viewMode === 'slot' ? 5 : 0), 'end', viewMode);
          openScheduleDialog({
            plan: null,
            initialData: {
              resourceId: mode === 'place' ? g?.id : null,
              serialId:   mode === 'device' && !isMorderDevice ? g?.id : null,
              serialNo:   mode === 'device' && !isMorderDevice ? g?.serialNo : null,
              morderId:   mode === 'device' && isMorderDevice ? g?.id : null,
              morderOrderTypeId: mode === 'device' && isMorderDevice ? g?.morderOrderTypeId : null,
              morderOrderTypeName: mode === 'device' && isMorderDevice ? g?.morderOrderTypeName : null,
              kisyuId:    mode === 'device' && !isMorderDevice ? g?.kisyuId : null,
              kisyuName:  mode === 'device' && !isMorderDevice ? g?.kisyuName : null,
              kisyuBackColor: mode === 'device' && !isMorderDevice ? g?.kisyuBackColor : null,
              kisyuFontColor: mode === 'device' && !isMorderDevice ? g?.kisyuFontColor : null,
              workerId:   mode === 'worker'   ? g?.id : null,
              startDate: dateStr,
              endDate: endStr,
            }
          });
        }
      }]),
      ...(copiedKind === 'plan' && copied.length > 0 && !g?.isUnassigned ? [{
        label: `貼り付け（${copied.length}件）`,
        onClick: () => pastePlans(col, row),
      }] : []),
    ];
    if (items.length === 0) return;
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }

  function handleBarRightClick(e, plan) {
    e.preventDefault();
    e.stopPropagation();
    // 右クリックしたバーが既存の複数選択に含まれていない場合は単一選択に切り替え
    const alreadyInMulti = selected.size > 1 && selected.has(plan.planId);
    if (!alreadyInMulti) {
      setSelected(new Set([plan.planId]));
      setSelectedLocation(new Set());
      setSelectedCell(null);
    }
    const isMulti = alreadyInMulti;
    const n = isMulti ? selected.size : 1;

    // 装置・担当者・タスクの各タブから他の2タブへ相互にジャンプできるようにする
    const jumpLabels = { device: '装置予定を表示', worker: '担当者予定を表示', task: 'タスク予定を表示' };
    const jumpTargets = mode === 'device' ? ['worker', 'task']
      : mode === 'worker' ? ['device', 'task']
      : mode === 'task'   ? ['device', 'worker']
      : [];
    const jumpItems = jumpTargets.map(t => ({
      label: jumpLabels[t],
      onClick: () => onJumpToOtherTab && onJumpToOtherTab(plan, t),
    }));
    const serialPlanItem = (mode === 'worker' || mode === 'task') && plan.serialId
      ? { label: '前後予定を表示', onClick: () => {
          apiArray(`/plan/by-serial/${plan.serialId}`)
            .then(data => setSerialOverlay({ triggerPlan: plan, serialPlans: data || [] }))
            .catch(() => {});
        }}
      : null;

    // タスクタブではコピー・切り取り・貼り付けを行わない。
    // 日付変更は予定バーのドラッグ・伸縮で行う。
    if (mode === 'task') {
      setContextMenu({ x: e.clientX, y: e.clientY, items: [
        { label: '詳細', onClick: () => setTooltip({ plan, x: e.clientX, y: e.clientY }) },
        ...(serialPlanItem ? ['separator', serialPlanItem] : []),
        'separator',
        ...(jumpItems.length > 0 ? ['separator', ...jumpItems] : []),
      ]});
      return;
    }

    const items = isMulti ? [
      { label: `${n}件コピー`, onClick: () => {
        const toCopy = [...selected].map(id => plans.find(p => p.planId === id)).filter(p => p && !isReadOnlyPlan(p, mode));
        setScheduleClipboard(toCopy, 'plan', 'copy');
      }},
      { label: `${n}件切り取り`, onClick: () => {
        const toCut = [...selected].map(id => plans.find(p => p.planId === id)).filter(p => p && !isReadOnlyPlan(p, mode));
        setScheduleClipboard(toCut, 'plan', 'cut');
      }},
      'separator',
      { label: `${n}件削除`, danger: true, onClick: () => {
        deletePlans([...selected].filter(id => !isReadOnlyPlan(plans.find(p => p.planId === id), mode)));
      }},
    ] : [
      { label: '詳細', onClick: () => setTooltip({ plan, x: e.clientX, y: e.clientY }) },
      ...(serialPlanItem ? ['separator', serialPlanItem] : []),
        'separator',
      ...(!isDialogReadOnlyPlan(plan) ? [
        { label: '編集', onClick: () => openScheduleDialog({ plan }) },
      ] : []),
      ...(!isReadOnlyPlan(plan, mode) ? [
        { label: 'コピー', onClick: () => setScheduleClipboard([plan], 'plan', 'copy') },
        { label: '切り取り', onClick: () => setScheduleClipboard([plan], 'plan', 'cut') },
        'separator',
        { label: '削除', danger: true, onClick: () => deletePlans([plan.planId]) },
      ] : []),
      ...(jumpItems.length > 0 ? ['separator', ...jumpItems] : []),
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }

  function handleLocationBarRightClick(e, plan) {
    e.preventDefault();
    e.stopPropagation();
    const alreadyInMulti = selectedLocation.size > 1 && selectedLocation.has(plan.planId);
    if (!alreadyInMulti) {
      setSelectedLocation(new Set([plan.planId]));
      setSelected(new Set());
      setSelectedCell(null);
    }
    const ids = alreadyInMulti ? [...selectedLocation] : [plan.planId];
    const locationPlans = ids
      .map(id => locationOverlayPlans.find(p => p.planId === id))
      .filter(Boolean);
    const items = locationPlans.length > 1 ? [
      { label: `${locationPlans.length}件コピー`, onClick: () => setScheduleClipboard(locationPlans, 'location', 'copy') },
      { label: `${locationPlans.length}件切り取り`, onClick: () => setScheduleClipboard(locationPlans, 'location', 'cut') },
      'separator',
      { label: `${locationPlans.length}件削除`, danger: true, onClick: () => deleteLocationPlans(ids) },
    ] : [
      { label: '詳細', onClick: () => setTooltip({ plan, x: e.clientX, y: e.clientY }) },
      { label: '編集', onClick: () => openScheduleDialog({ plan, kind: 'location' }) },
      { label: 'コピー', onClick: () => setScheduleClipboard([plan], 'location', 'copy') },
      { label: '切り取り', onClick: () => setScheduleClipboard([plan], 'location', 'cut') },
      'separator',
      { label: '削除', danger: true, onClick: () => deleteLocationPlans([plan.planId]) },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }

  function makeDeleteHistoryAction(kind, ids) {
    const refs = refsForKind(kind);
    const sourcePlans = kind === 'location' ? locationOverlayPlans : plans;
    const records = ids.map(id => ({
      plan: sourcePlans.find(p => p.planId === id),
      hadCreate: refs.creates.current.has(id),
      createPayload: refs.creates.current.has(id) ? { ...refs.creates.current.get(id) } : null,
      hadUpdate: refs.updates.current.has(id),
      updatePayload: refs.updates.current.has(id) ? { ...refs.updates.current.get(id) } : null,
    })).filter(record => record.plan);
    return { type: 'delete', kind, records };
  }

  function deletePlans(ids) {
    const deletableIds = ids.filter(id => !isReadOnlyPlan(plans.find(p => p.planId === id), mode));
    if (deletableIds.length === 0) return;
    const action = makeDeleteHistoryAction('plan', deletableIds);
    // API は呼ばず、ローカル state を即時更新して保留リストに積む
    setPlans(prev => prev.filter(p => !deletableIds.includes(p.planId)));
    setSelected(prev => { const s = new Set(prev); deletableIds.forEach(id => s.delete(id)); return s; });
    deletableIds.forEach(id => {
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
    pushEditHistory(action);
  }

  function deleteLocationPlans(ids) {
    if (ids.length === 0) return;
    const action = makeDeleteHistoryAction('location', ids);
    if (action.records.length === 0) return;
    setLocationOverlayPlans(prev => prev.filter(p => !ids.includes(p.planId)));
    setSelectedLocation(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
    ids.forEach(id => {
      if (id < 0) {
        pendingLocationCreatesRef.current.delete(id);
      } else {
        pendingLocationDeletesRef.current.add(id);
        pendingLocationUpdatesRef.current.delete(id);
      }
    });
    setIsDirty(true);
    onDirtyChange?.(true);
    pushEditHistory(action);
  }

  function pastePlans(targetCol, targetRow) {
    if (mode === 'task' || !copied.length || copiedKind !== 'plan') return;
    // 貼り付け先の行グループ（装置 or 担当者）を特定
    const targetGroup = getGroupAtRow(targetRow);
    if (!targetGroup) return; // グループが特定できない場合は貼り付けしない
    if (mode === 'worker' && targetGroup.isUnassigned) return;

    // 貼り付け先の serialId / workerId / resourceId（全プランに共通で適用）
    const targetSerialId   = mode === 'device' && !isMorderDevice ? targetGroup.id : null;
    const targetMorderId   = mode === 'device' && isMorderDevice ? targetGroup.id : null;
    const targetWorkerId   = mode === 'worker'   ? targetGroup.id : null;
    const targetResourceId = mode === 'place' ? targetGroup.id : null;

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
      const newSerialId   = mode === 'device' && !isMorderDevice ? targetSerialId : p.serialId;
      const newMorderId   = mode === 'device' && isMorderDevice ? targetMorderId : p.morderId;
      const newWorkerId   = mode === 'worker'   ? targetWorkerId   : p.workerId;
      const newResourceId = mode === 'place' ? targetResourceId : p.resourceId;

      const basePayload = mode === 'place'
        ? { resourceId: newResourceId, serialId: newSerialId, startDate: newStart, endDate: newEnd, remark: p.remark ?? '' }
        : {
          serialId: newSerialId,
          morderId: newMorderId,
          taskId: p.taskId,
          workerId: newWorkerId,
          teacherId: p.teacherId,
          startDate: newStart,
          endDate: newEnd,
          plannedMinutes: p.plannedMinutes ?? 0,
          price: p.price ?? 0,
          remark: p.remark ?? '',
        };
      const excludedDays = loadExcludedDays();
      // 除外曜日オプションは装置・担当者タブで有効（登録ダイアログと同じ適用範囲）
      const pasteSegments = mode === 'device' || mode === 'worker'
        ? splitPastedSchedulePreservingLength(p.startDate, p.endDate, newStart, excludedDays, calendarData)
        : null;
      const payloads = pasteSegments
        ? pasteSegments.map(segment => ({ ...basePayload, startDate: segment.startDate, endDate: segment.endDate }))
        : [basePayload];
      for (const payload of payloads) {
        const tempId = tempIdCounterRef.current--;
        newPlans.push({ ...p, planId: tempId, ...payload });
        pendingCreatesRef.current.set(tempId, payload);
      }
    }
    if (newPlans.length === 0) {
      showToast('貼り付け対象の日付がありません');
      return;
    }
    setPlans(prev => [...prev, ...newPlans]);
    const createAction = {
      type: 'create',
      kind: 'plan',
      plans: newPlans.map(plan => ({ ...plan })),
      payloads: new Map(newPlans.map(plan => [plan.planId, { ...pendingCreatesRef.current.get(plan.planId) }])),
    };
    if (clipboardAction === 'cut' && !cutAppliedRef.current) {
      const deleteAction = makeDeleteHistoryAction('plan', copied.map(plan => plan.planId));
      if (deleteAction.records.length > 0) {
        applyDeleteHistory(deleteAction, 'redo');
        markCutApplied(true);
        pushEditHistory({
          type: 'batch',
          actions: [deleteAction, createAction],
          clipboardVersion: clipboardVersionRef.current,
        });
      } else {
        pushEditHistory(createAction);
      }
    } else {
      pushEditHistory(createAction);
    }
    setSelected(new Set(newPlans.map(plan => plan.planId)));
    setSelectedLocation(new Set());
    setIsDirty(true);
    onDirtyChange?.(true);
  }

  function pasteLocationPlans(targetCol, targetRow) {
    if (!copied.length || copiedKind !== 'location') return;
    const targetGroup = getGroupAtRow(targetRow);
    if (!targetGroup || !isLocationRow(targetGroup, targetRow) || Number(targetGroup.id) <= 0) return;

    const firstStartCol = planToStartCol(copied[0], startDate, viewMode);
    const offset = targetCol - firstStartCol;
    const newPlans = copied.map(plan => {
      const startCol = Math.max(0, planToStartCol(plan, startDate, viewMode) + offset);
      const endCol = Math.max(startCol, planToEndCol(plan, startDate, viewMode) + offset);
      const payload = {
        resourceId: plan.resourceId,
        serialId: Number(targetGroup.id),
        startDate: colToDateTime(startDate, startCol, 'start', viewMode),
        endDate: colToDateTime(startDate, endCol, 'end', viewMode),
        remark: plan.remark ?? '',
      };
      const tempId = tempIdCounterRef.current--;
      pendingLocationCreatesRef.current.set(tempId, payload);
      return { ...plan, ...payload, planId: tempId, reserveId: tempId };
    });
    setLocationOverlayPlans(prev => [...prev, ...newPlans]);
    const createAction = {
      type: 'create',
      kind: 'location',
      plans: newPlans.map(plan => ({ ...plan })),
      payloads: new Map(newPlans.map(plan => [plan.planId, { ...pendingLocationCreatesRef.current.get(plan.planId) }])),
    };
    if (clipboardAction === 'cut' && !cutAppliedRef.current) {
      const deleteAction = makeDeleteHistoryAction('location', copied.map(plan => plan.planId));
      if (deleteAction.records.length > 0) {
        applyDeleteHistory(deleteAction, 'redo');
        markCutApplied(true);
        pushEditHistory({
          type: 'batch',
          actions: [deleteAction, createAction],
          clipboardVersion: clipboardVersionRef.current,
        });
      } else {
        pushEditHistory(createAction);
      }
    } else {
      pushEditHistory(createAction);
    }
    setSelectedLocation(new Set(newPlans.map(plan => plan.planId)));
    setSelected(new Set());
    setIsDirty(true);
    onDirtyChange?.(true);
  }

  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

  async function openScheduleDialog(data) {
    if (isDialogReadOnlyPlan(data?.plan)) return;
    setScheduleDialog(data);
  }

  async function savePlan(data) {
    const dialog = scheduleDialog;
    if (isDialogReadOnlyPlan(dialog?.plan)) {
      setScheduleDialog(null);
      return;
    }
    setScheduleDialog(null);
    const isLocationPlan = mode === 'place' || dialog?.kind === 'location';
    const payload = isLocationPlan
      ? {
        resourceId: data.resourceId || dialog.initialData?.resourceId,
        serialId:   data.serialId,
        startDate:  data.startDate,
        endDate:    data.endDate,
        remark:     data.remark ?? '',
      }
      : {
        serialId:  data.serialId || dialog.initialData?.serialId,
        morderId:  data.morderId || dialog.initialData?.morderId || dialog.plan?.morderId || null,
        taskId:    data.taskId,
        workerId:  data.workerId ?? dialog.initialData?.workerId ?? null,
        teacherId: data.teacherId,
        startDate: data.startDate,
        endDate:   data.endDate,
        plannedMinutes: data.plannedMinutes ?? 0,
        price: data.price ?? 0,
        remark: data.remark ?? '',
      };

    const historyKind = dialog?.kind === 'location' ? 'location' : 'plan';
    const refs = refsForKind(historyKind);
    let selectedTask = null;
    if (!isLocationPlan) {
      selectedTask = tasks.find(item => Number(item.taskId) === Number(payload.taskId)) ?? null;
      if (!selectedTask) {
        try {
          const cachedTasks = await loadTaskMaster();
          selectedTask = cachedTasks.find(item => Number(item.taskId) === Number(payload.taskId)) ?? null;
        } catch {
          // 親から渡されたマスタにもキャッシュにもない場合は、既存表示値または既定色を使う。
        }
      }
    }
    const selectedWorker = workers.find(item => Number(item.workerId) === Number(payload.workerId));
    const selectedSerial = serials.find(item => Number(item.serialId) === Number(payload.serialId));
    const selectedResource = resources?.find(item => Number(item.resourceId) === Number(payload.resourceId));
    const visualFields = isLocationPlan
      ? {
        resourceName: selectedResource?.resourceName ?? dialog.plan?.resourceName ?? '',
        serialNo: selectedSerial?.serialNo ?? dialog.plan?.serialNo ?? dialog.initialData?.serialNo ?? '',
        kisyuId: selectedSerial?.kisyuId ?? dialog.plan?.kisyuId ?? dialog.initialData?.kisyuId,
        kisyuName: selectedSerial?.kisyuName ?? dialog.plan?.kisyuName ?? dialog.initialData?.kisyuName ?? '',
        kisyuBackColor: data.kisyuBackColor ?? selectedSerial?.kisyuBackColor ?? dialog.plan?.kisyuBackColor ?? dialog.initialData?.kisyuBackColor ?? null,
        kisyuFontColor: data.kisyuFontColor ?? selectedSerial?.kisyuFontColor ?? dialog.plan?.kisyuFontColor ?? dialog.initialData?.kisyuFontColor ?? null,
      }
      : {
        taskName: selectedTask?.taskName ?? dialog.plan?.taskName ?? '',
        taskTypeId: selectedTask?.taskTypeId ?? dialog.plan?.taskTypeId ?? null,
        taskBackColor: selectedTask?.backColor ?? dialog.plan?.taskBackColor ?? 1,
        taskFontColor: selectedTask?.fontColor ?? dialog.plan?.taskFontColor ?? 6,
        workerName: selectedWorker?.workerName ?? dialog.plan?.workerName ?? '',
        serialNo: selectedSerial?.serialNo ?? dialog.plan?.serialNo ?? dialog.initialData?.serialNo ?? '',
        kisyuId: selectedSerial?.kisyuId ?? dialog.plan?.kisyuId ?? dialog.initialData?.kisyuId,
        kisyuName: selectedSerial?.kisyuName ?? dialog.plan?.kisyuName ?? dialog.initialData?.kisyuName ?? '',
        kisyuBackColor: data.kisyuBackColor ?? selectedSerial?.kisyuBackColor ?? dialog.plan?.kisyuBackColor ?? dialog.initialData?.kisyuBackColor ?? null,
        kisyuFontColor: data.kisyuFontColor ?? selectedSerial?.kisyuFontColor ?? dialog.plan?.kisyuFontColor ?? dialog.initialData?.kisyuFontColor ?? null,
        morderOrderTypeId: dialog.plan?.morderOrderTypeId ?? dialog.initialData?.morderOrderTypeId ?? null,
        morderOrderTypeName: dialog.plan?.morderOrderTypeName ?? dialog.initialData?.morderOrderTypeName ?? '',
        morderNo: dialog.plan?.morderNo ?? dialog.initialData?.morderNo ?? '',
      };
    if (dialog.plan) {
      // 編集内容は保存ボタンが押されるまでローカルに保留する。
      const planId = dialog.plan.planId;
      const before = isLocationPlan
        ? {
          resourceId: dialog.plan.resourceId,
          serialId: dialog.plan.serialId,
          startDate: dialog.plan.startDate,
          endDate: dialog.plan.endDate,
          remark: dialog.plan.remark ?? '',
        }
        : {
          serialId: dialog.plan.serialId,
          morderId: dialog.plan.morderId,
          taskId: dialog.plan.taskId,
          workerId: dialog.plan.workerId,
          teacherId: dialog.plan.teacherId,
          startDate: dialog.plan.startDate,
          endDate: dialog.plan.endDate,
          plannedMinutes: dialog.plan.plannedMinutes ?? 0,
          price: dialog.plan.price ?? 0,
          remark: dialog.plan.remark ?? '',
        };
      const previousPendingHad = refs.updates.current.has(planId);
      const previousPending = previousPendingHad ? { ...refs.updates.current.get(planId) } : null;
      refs.setState(prev => prev.map(p => p.planId === planId ? { ...p, ...payload, ...visualFields } : p));
      if (planId < 0 && refs.creates.current.has(planId)) refs.creates.current.set(planId, payload);
      else refs.updates.current.set(planId, payload);
      pushEditHistory({
        type: 'edit',
        kind: historyKind,
        changes: [{
          planId,
          before,
          after: payload,
          beforeState: {
            ...before,
            taskName: dialog.plan.taskName,
            taskTypeId: dialog.plan.taskTypeId,
            taskBackColor: dialog.plan.taskBackColor,
            taskFontColor: dialog.plan.taskFontColor,
            workerName: dialog.plan.workerName,
            resourceName: dialog.plan.resourceName,
            serialNo: dialog.plan.serialNo,
            kisyuId: dialog.plan.kisyuId,
            kisyuName: dialog.plan.kisyuName,
            kisyuBackColor: dialog.plan.kisyuBackColor,
            kisyuFontColor: dialog.plan.kisyuFontColor,
          },
          afterState: { ...payload, ...visualFields },
          previousPendingHad,
          previousPending,
        }],
      });
    } else {
      // 新規予定も仮IDで表示し、保存ボタンが押されるまでAPIには送信しない。
      const createPayloads = (Array.isArray(data.segments) && data.segments.length > 0)
        ? data.segments.map(segment => ({ ...payload, startDate: segment.startDate, endDate: segment.endDate }))
        : [payload];
      const tempPlans = createPayloads.map(createPayload => {
        const planId = tempIdCounterRef.current--;
        const worker = workers.find(item => Number(item.workerId) === Number(createPayload.workerId));
        const serial = serials.find(item => Number(item.serialId) === Number(createPayload.serialId));
        const resource = resources?.find(item => Number(item.resourceId) === Number(createPayload.resourceId));
        refs.creates.current.set(planId, createPayload);
        return {
          planId,
          ...createPayload,
          taskName: selectedTask?.taskName ?? '',
          taskTypeId: selectedTask?.taskTypeId ?? null,
          taskBackColor: selectedTask?.backColor ?? 1,
          taskFontColor: selectedTask?.fontColor ?? 6,
          workerName: worker?.workerName ?? '',
          serialNo: serial?.serialNo ?? dialog.initialData?.serialNo ?? '',
          kisyuId: serial?.kisyuId ?? dialog.initialData?.kisyuId,
          kisyuName: serial?.kisyuName ?? dialog.initialData?.kisyuName ?? '',
          kisyuBackColor: data.kisyuBackColor ?? serial?.kisyuBackColor ?? dialog.initialData?.kisyuBackColor ?? null,
          kisyuFontColor: data.kisyuFontColor ?? serial?.kisyuFontColor ?? dialog.initialData?.kisyuFontColor ?? null,
          resourceName: resource?.resourceName ?? '',
          morderOrderTypeId: visualFields.morderOrderTypeId,
          morderOrderTypeName: visualFields.morderOrderTypeName,
          morderNo: visualFields.morderNo,
        };
      });
      refs.setState(prev => [...prev, ...tempPlans]);
      pushEditHistory({
        type: 'create',
        kind: historyKind,
        plans: tempPlans.map(plan => ({ ...plan })),
        payloads: new Map(tempPlans.map(plan => [plan.planId, { ...refs.creates.current.get(plan.planId) }])),
      });
    }
    setIsDirty(true);
    onDirtyChange?.(true);
  }

  useEffect(() => {
    if (!jumpTarget || jumpTarget.targetMode !== mode || mode !== 'device') return;
    const plan = jumpTarget.plan;
    const targetId = isMorderDevice ? Number(plan.morderId) : Number(plan.serialId);
    const q = isMorderDevice ? plan.morderNo : plan.serialNo;
    if (!q) return;
    const key = `${isMorderDevice ? 'm' : 's'}:${targetId}`;
    if (jumpGroupFetchKeyRef.current === key) return;
    jumpGroupFetchKeyRef.current = key;
    (async () => {
      const loadedIndex = devicePagedGroups.findIndex(group => Number(group.id) === targetId);
      let targetOffset;
      if (loadedIndex >= 0) {
        targetOffset = deviceGroupOffset + loadedIndex;
      } else {
        const hit = await fetchDeviceGroups(0, String(q));
        if (!hit?.groups?.length) return;
        targetOffset = Math.max(0, Number(hit.offset || 0));
      }
      setDeviceSearchStartOffset(targetOffset);
      deviceGroupFetchKeyRef.current = '';
      await fetchDeviceGroups(targetOffset);
    })().catch(e => console.error('jump device group fetch error', e));
  }, [jumpTarget, mode, isMorderDevice, devicePagedGroups, deviceGroupOffset, fetchDeviceGroups]);

  useEffect(() => {
    if (!jumpTarget) {
      prevJumpTargetRef.current = null;
      jumpGroupFetchKeyRef.current = null;
      if (jumpTimerRef.current) { clearTimeout(jumpTimerRef.current); jumpTimerRef.current = null; }
      return;
    }
    const { plan, targetMode } = jumpTarget;
    if (targetMode !== mode) return;

    // jumpTarget が切り替わったら、対象予定のフェッチ完了を待つためのタイムアウトを開始する。
    // 予定は表示範囲・グループ単位で遅延フェッチされるため、タブ切替直後は layoutGroups に
    // 対象が含まれていないことがある。フェッチ完了で layoutGroups が更新されると本 effect が
    // 再実行されて対象が見つかる。期限内に見つからなければエラー扱いとする。
    if (jumpTarget !== prevJumpTargetRef.current) {
      prevJumpTargetRef.current = jumpTarget;
      // 過去の検索アンカーが残っていると、ジャンプ座標確定後に別の位置へ再スクロールされるため解除する。
      searchAnchorSerialIdRef.current = null;
      searchAnchorWorkerIdRef.current = null;
      pendingScrollSerialIdRef.current = null;
      pendingScrollWorkerIdRef.current = null;
      releaseDeviceAnchorAfterLayoutRef.current = false;
      releaseWorkerAnchorAfterLayoutRef.current = false;
      if (sonarRafRef.current) cancelAnimationFrame(sonarRafRef.current);
      if (sonarClearTimerRef.current) clearTimeout(sonarClearTimerRef.current);
      setSonar(null);
      if (mode === 'worker' && Number(plan.workerId) > 0) {
        setWorkerSearchStartId(Number(plan.workerId));
      }
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = setTimeout(() => {
        jumpTimerRef.current = null;
        onJumpError?.();
        onJumpHandled?.();
      }, 5000);
    }

    // planId で直接検索
    let targetGroup = null;
    let targetPlanRow = null;
    for (const g of layoutGroups) {
      const pp = g.plans?.find(p => p.planId === plan.planId);
      if (pp) { targetGroup = g; targetPlanRow = pp; break; }
    }

    if (!targetGroup) {
      if (mode === 'device' && isMorderDevice && Number(plan.morderId) > 0) {
        const morderGroup = {
          id: plan.morderId,
          isMorder: true,
          morderOrderTypeId: plan.morderOrderTypeId,
          morderOrderTypeName: plan.morderOrderTypeName || MORDER_ORDER_TYPE_NAMES[Number(plan.morderOrderTypeId)] || '',
          morderNo: plan.morderNo || '',
          partsNo: plan.partsNo || '',
          requiredDate: plan.morderShippingDate || null,
          inspectionDate: null,
          shippingDate: plan.morderShippingDate || null,
          kouteiPicNo: plan.morderKouteiPicNo || '',
          publicRemark: plan.publicRemark || '',
        };
        setDevicePagedGroups(prev => prev.some(g => Number(g.id) === Number(plan.morderId)) ? prev : [morderGroup, ...prev]);
        setDeviceGroupTotal(prev => Math.max(prev, 1));
        setDeviceGroupOffset(0);
      }
      // 予定は可視範囲（日付×グループ）単位で遅延フェッチされるため、ジャンプ先タブの
      // スクロール位置や境界条件によっては対象がまだ読み込まれていないことがある。
      // ジャンプ元から受け取った予定オブジェクトを直接 plans に注入して確実に存在させ、
      // layoutGroups 更新で本 effect が再実行されたときに planId で見つかるようにする。
      // （対象タスクが tktasklist に含まれる＝グループが存在することは呼び出し側で検証済み）
      setPlans(prev => prev.some(p => p.planId === plan.planId) ? prev : [...prev, plan]);
      // エラーにはせず次の更新を待つ
      return;
    }

    // 対象が見つかったのでタイムアウトを解除
    if (jumpTimerRef.current) { clearTimeout(jumpTimerRef.current); jumpTimerRef.current = null; }

    // 遷移先タブで対象の予定バーを選択状態にする
    setSelected(new Set([plan.planId]));
    setSelectedCell(null);
    jumpAnchorPlanIdRef.current = plan.planId;
    pendingJumpSonarPlanIdRef.current = plan.planId;

    const col = planToStartCol(plan, startDate, viewMode);
    const absRow = targetGroup.startRow + targetPlanRow.rowIdx;

    // バーを画面中央に来るようにスクロール
    const newScrollLeft = Math.max(0, col * colW - (containerW - leftHdrW) / 2);
    const newScrollTop  = Math.max(0, absRow * CELL_SIZE - (containerH - TOTAL_HDR_H) / 2);

    // 書き込み後に実際の値を読み返す（コンテンツ末尾付近でクランプされる場合がある）
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = newScrollLeft;
      scrollRef.current.scrollTop  = newScrollTop;
    }
    onJumpHandled?.();
  }, [jumpTarget, layoutGroups, triggerSonar]);

  useEffect(() => {
    return () => {
      if (sonarRafRef.current) cancelAnimationFrame(sonarRafRef.current);
      if (sonarClearTimerRef.current) clearTimeout(sonarClearTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    };
  }, []);

  // タブ間ジャンプ後に予定取得で行高が変わっても、対象予定バーを表示領域中央に維持する。
  // ユーザーが縦スクロールまたは別の操作を始めた時点で jumpAnchorPlanIdRef を解除する。
  useEffect(() => {
    if (!active) {
      jumpAnchorPlanIdRef.current = null;
      pendingJumpSonarPlanIdRef.current = null;
      return;
    }
    const targetPlanId = jumpAnchorPlanIdRef.current;
    if (targetPlanId == null || !scrollRef.current) return;
    let targetGroup = null;
    let targetPlan = null;
    for (const group of layoutGroups) {
      const found = group.plans?.find(plan => String(plan.planId) === String(targetPlanId));
      if (found) {
        targetGroup = group;
        targetPlan = found;
        break;
      }
    }
    if (!targetGroup || !targetPlan) return;
    const absoluteRow = targetGroup.startRow + targetPlan.rowIdx;
    const newTop = Math.max(0, absoluteRow * CELL_SIZE - (containerH - TOTAL_HDR_H) / 2);
    scrollRef.current.scrollTop = newTop;
    const actualTop = scrollRef.current.scrollTop;
    setScrollTop(actualTop);

    if (String(pendingJumpSonarPlanIdRef.current) === String(targetPlanId)) {
      pendingJumpSonarPlanIdRef.current = null;
      triggerPlanSonar(targetPlanId);
    }
  }, [active, layoutGroups, containerH, triggerPlanSonar]);

  useEffect(() => {
    if (!active || mode !== 'device') return;
    const targetSerialId = searchAnchorSerialIdRef.current ?? pendingScrollSerialIdRef.current;
    if (!targetSerialId || !scrollRef.current) return;
    const g = layoutGroups.find(x => String(x.id) === String(targetSerialId));
    if (!g) return;
    const revealPrevious = releaseDeviceAnchorAfterLayoutRef.current;
    const newTop = Math.max(0, g.startRow * CELL_SIZE - (revealPrevious ? CELL_SIZE : 0));
    scrollRef.current.scrollTop = newTop;
    const actualTop = scrollRef.current.scrollTop;
    setScrollTop(actualTop);

    if (pendingScrollSerialIdRef.current != null) {
      const mainRows = g.locationRowIdx >= 0 ? g.locationRowIdx : g.numRows;
      const sonarX = leftHdrW / 2;
      // 製番は装置ヘッダの2行目に表示しているため、メイン領域下寄りに合わせる
      const sonarY = (g.startRow + Math.max(0.6, mainRows * 0.65)) * CELL_SIZE - actualTop + TOTAL_HDR_H;
      triggerSonar(sonarX, sonarY);
      pendingScrollSerialIdRef.current = null;
    }
    if (releaseDeviceAnchorAfterLayoutRef.current) {
      releaseDeviceAnchorAfterLayoutRef.current = false;
      searchAnchorSerialIdRef.current = null;
    }
  }, [active, mode, layoutGroups, containerH, serialSearchTick, leftHdrW, triggerSonar]);

  useEffect(() => {
    if (!active || mode !== 'worker') return;
    const targetWorkerId = searchAnchorWorkerIdRef.current ?? pendingScrollWorkerIdRef.current;
    if (!targetWorkerId || !scrollRef.current) return;
    const g = layoutGroups.find(x => Number(x.id) === Number(targetWorkerId));
    if (!g) return;
    const revealPrevious = releaseWorkerAnchorAfterLayoutRef.current;
    const newTop = Math.max(0, g.startRow * CELL_SIZE - (revealPrevious ? CELL_SIZE : 0));
    scrollRef.current.scrollTop = newTop;
    const actualTop = scrollRef.current.scrollTop;
    setScrollTop(actualTop);

    if (pendingScrollWorkerIdRef.current != null) {
      const sonarX = leftHdrW / 2;
      const sonarY = (g.startRow + Math.max(0.5, g.numRows * 0.5)) * CELL_SIZE - actualTop + TOTAL_HDR_H;
      triggerSonar(sonarX, sonarY);
      pendingScrollWorkerIdRef.current = null;
    }
    if (releaseWorkerAnchorAfterLayoutRef.current) {
      releaseWorkerAnchorAfterLayoutRef.current = false;
      revealingPreviousWorkerRef.current = false;
      searchAnchorWorkerIdRef.current = null;
    }
  }, [active, mode, layoutGroups, containerH, workerSearchTick, leftHdrW, triggerSonar]);

  async function handleSeedApply() {
    fetchedPlanKeysRef.current = new Set();
    setPlans([]);
    await apiJson('/seed', {
      method: 'POST',
      body: JSON.stringify({ count: deviceCount, baseDate: startDate, months: displayMonths }),
    });
    setFetchVersion(v => v + 1);
  }

  // 再描画は未保存変更を破棄せず、サーバー再取得結果へローカル変更を重ね直す。
  const handleRefresh = useCallback(() => {
    handleRefreshAfterConfirm();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRefreshAfterConfirm() {
    fetchedPlanKeysRef.current = new Set();
    fetchedLocKeysRef.current = new Set();
    setPlans(retainPendingPlans);
    setLocationOverlayPlans(retainPendingLocationPlans);
    setFetchVersion(v => v + 1);
  }

  const handleShiftMonth = useCallback((months) => {
    const shift = () => {
      const d = new Date(startDate + 'T00:00:00');
      d.setMonth(d.getMonth() + months);
      setStartDate(dateToStr(d));
    };
    if (isDirty) onBeforeRedraw?.(shift);
    else shift();
  }, [startDate, isDirty, onBeforeRedraw]);

  const handleDateWidthChange = useCallback((width) => {
    const normalizedWidth = normalizeDateWidth(width);
    if (normalizedWidth < 120) {
      lastDayWidthRef.current = normalizedWidth;
      saveTabDateWidth(mode, normalizedWidth, '_day');
    }
    saveTabDateWidth(mode, normalizedWidth);

    // 幅変更の前後で、画面左端にある日付が大きくずれないよう日単位の位置を維持する。
    const scrollElement = scrollRef.current;
    const leftDayOffset = scrollElement ? scrollElement.scrollLeft / dateWidth : 0;
    setDateWidth(normalizedWidth);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = leftDayOffset * normalizedWidth;
      setScrollLeft(scrollRef.current.scrollLeft);
    });
  }, [dateWidth, mode]);

  const handleViewModeChange = useCallback((nextMode) => {
    handleDateWidthChange(nextMode === 'slot' ? 120 : lastDayWidthRef.current);
  }, [handleDateWidthChange]);

  const dateColumns = useMemo(() => {
    const cols = [];
    const days = daysBetween(startDate, endDate);
    for (let d = 0; d < days; d++) {
      const ds = addDays(startDate, d);
      const dt = new Date(ds + 'T00:00:00');
      const dow = dt.getDay();
      const cal = calendarData.get(ds);
      let type;
      if (cal?.dayType === 3 || cal?.dayType === 4) type = 'holiday';   // 祝日 / 会社休日
      else if (dow === 0)          type = 'sunday';
      else if (dow === 6)          type = 'saturday';
      else                         type = 'weekday';
      const monthWeek = getMonthWeekInfo(ds);
      cols.push({
        dateStr: ds,
        day: dt.getDate(),
        dow,
        month: dt.getMonth() + 1,
        year: dt.getFullYear(),
        week: monthWeek.week,
        weekKey: monthWeek.key,
        weekYear: monthWeek.year,
        weekMonth: monthWeek.month,
        type,
      });
    }
    return cols;
  }, [startDate, endDate, calendarData]);


  const planCount = plans.filter(p => !p.deleted).length;
  const groupCount = mode === 'device' && deviceGroupTotal > 0 ? deviceGroupTotal : filteredGroups.length;
  const isScheduleAreaFetching = active && gridFetchCount > 0;
  const hasVisibleScheduleBars = useMemo(() => {
    const contentRight = totalCols * colW;
    const viewportRight = scrollLeft + containerW;
    for (const g of layoutGroups) {
      if (g.plans?.length) {
        for (const plan of g.plans) {
          const absRow = g.startRow + plan.rowIdx;
          if (absRow < visRowStart || absRow > visRowEnd) continue;
          const startCol = planToStartCol(plan, startDate, viewMode);
          const endCol = planToEndCol(plan, startDate, viewMode);
          const x = startCol * colW;
          if (x >= contentRight) continue;
          const w = Math.min(Math.max(colW, (endCol - startCol + 1) * colW), contentRight - x);
          if (x + w >= scrollLeft && x <= viewportRight) return true;
        }
      }
      if (extraLocationRow && g.locationRowIdx >= 0 && g.locationPlans?.length) {
        for (const plan of g.locationPlans) {
          const absRow = g.startRow + g.locationRowIdx + plan.rowIdx;
          if (absRow < visRowStart || absRow > visRowEnd) continue;
          const startCol = planToStartCol(plan, startDate, viewMode);
          const endCol = planToEndCol(plan, startDate, viewMode);
          const x = startCol * colW;
          if (x >= contentRight) continue;
          const w = Math.min(Math.max(colW, (endCol - startCol + 1) * colW), contentRight - x);
          if (x + w >= scrollLeft && x <= viewportRight) return true;
        }
      }
    }
    return false;
  }, [layoutGroups, totalCols, colW, scrollLeft, containerW, visRowStart, visRowEnd, startDate, viewMode, extraLocationRow]);
  const shouldShowScheduleAreaOverlay = isScheduleAreaFetching && !hasVisibleScheduleBars;
  const sonarPosition = useMemo(() => {
    if (!sonar) return null;
    if (sonar.planId == null) return sonar;
    for (const group of layoutGroups) {
      const plan = group.plans?.find(item => String(item.planId) === String(sonar.planId));
      if (!plan) continue;
      const startCol = planToStartCol(plan, startDate, viewMode);
      const endCol = planToEndCol(plan, startDate, viewMode);
      const absoluteRow = group.startRow + plan.rowIdx;
      return {
        ...sonar,
        x: ((startCol + endCol + 1) * colW) / 2 - scrollLeft + leftHdrW,
        y: absoluteRow * CELL_SIZE - scrollTop + TOTAL_HDR_H + CELL_SIZE / 2,
      };
    }
    return null;
  }, [sonar, layoutGroups, startDate, viewMode, colW, scrollLeft, scrollTop, leftHdrW]);

  function handleHeaderClick(group, event) {
    event.stopPropagation();
    const rect = event.currentTarget?.getBoundingClientRect?.();
    const planCount = group.plans?.length ?? 0;
    let title = '';
    let rows = [];
    let badges = [];
    if (mode === 'device' && group.isMorder) {
      title = 'M番詳細';
      rows = [
        ['手配区分', group.morderOrderTypeName],
        ['M番', group.morderNo],
        ['品番', group.partsNo],
        ['要求納期', group.requiredDate],
        ['出荷日', group.shippingDate],
        ['工程担当', group.kouteiPicNo],
        ['備考', group.publicRemark],
        ['表示予定件数', planCount],
      ];
      badges = rowBadges;
    } else if (mode === 'device') {
      title = '装置詳細';
      rows = [
        ['機種', group.kisyuName],
        ['製番', group.serialNo],
        ['受付No', group.receiptNo],
        ['出荷日', group.shippingDate],
        ['責任者', group.responsible],
        ['表示予定件数', planCount],
      ];
      if (extraLocationRow) rows.push(['場所予定件数', group.locationPlans ? group.locationPlans.length : 0]);
      badges = rowBadges;
    } else if (mode === 'worker') {
      title = '担当者詳細';
      if (group.isUnassigned && (group.unassignedKind === 'morder' || group.unassignedKind === 'dpr')) {
        rows = [
          ['区分', '担当者未定'],
          ['製品区分', group.unassignedKind === 'dpr' ? '直送DPR' : 'M番'],
          ['M番', group.morderNo],
          ['表示予定件数', planCount],
        ];
      } else {
        rows = group.isUnassigned
          ? [['区分', '担当者未定'], ['機種', group.kisyuName], ['製番', group.serialNo], ['表示予定件数', planCount]]
          : [['チーム', group.teamName], ['担当者', group.workerName], ['表示予定件数', planCount]];
      }
    } else if (mode === 'task') {
      title = 'タスク詳細';
      rows = [['プロセス', group.processName], ['タスク', group.taskName], ['表示予定件数', planCount]];
    } else if (mode === 'place') {
      title = '場所詳細';
      rows = [['フロア', group.locationTypeName], ['場所', group.resourceName], ['表示予定件数', planCount]];
    }
    setDeviceDetail({
      title,
      rows,
      badges,
      x: event.clientX,
      y: event.clientY,
      anchorRect: rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null,
    });
  }

  useEffect(() => {
    const onGlobalPointerDown = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const inHeader = target.closest('[data-row-header="1"]');
      const inTooltip = target.closest('[data-header-tooltip="1"]');
      if (!inHeader && !inTooltip) setDeviceDetail(null);
    };
    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown, true);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <SpreadsheetGridToolbar
        startDate={startDate}
        onStartDateChange={(date) => {
          if (isDirty) onBeforeRedraw?.(() => setStartDate(date));
          else setStartDate(date);
        }}
        onShiftMonth={handleShiftMonth}
        displayMonths={displayMonths}
        onDisplayMonthsChange={(months) => {
          if (isDirty) onBeforeRedraw?.(() => setDisplayMonths(months));
          else setDisplayMonths(months);
        }}
        deviceCount={deviceCount}
        onDeviceCountChange={setDeviceCount}
        onSeedApply={handleSeedApply}
        mode={mode}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        dateWidth={dateWidth}
        onDateWidthChange={handleDateWidthChange}
        serialSearchText={serialSearchText}
        onSerialSearchTextChange={setSerialSearchText}
        onSerialSearch={handleSerialSearch}
        onSerialSearchClear={handleSerialSearchClear}
        serialSearchPlaceholder={isMorderDevice ? 'M番/品番検索' : '製番検索'}
        workerSearchText={workerSearchText}
        onWorkerSearchTextChange={setWorkerSearchText}
        onWorkerSearch={handleWorkerSearch}
        onRefresh={handleRefresh}
        lastUpdatedAt={lastUpdatedAt}
        pllocation={pllocation}
        onPlLocationChange={setPllocation}
        resources={resources}
      />

      {/* グリッド本体 */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* 左固定ヘッダー上部コーナー */}
        <div onWheel={forwardHeaderWheel} style={{ position: 'absolute', left: 0, top: 0, width: leftHdrW, height: TOTAL_HDR_H, background: '#f3f4f6', borderRight: '1px solid #d1d5db', borderBottom: '1px solid #9ca3af', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
          {mode === 'device' ? (isMorderDevice ? (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: lcw('main'), borderRight: '1px solid #d1d5db', boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'repeat(3, 1fr)' }}>
                {['品番', 'オーダーNo', '備考'].map((label, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: i < 2 ? '1px solid #d1d5db' : 'none', boxSizing: 'border-box' }}>{label}</div>
                ))}
              </div>
              <div style={{ width: lcw('sub'), boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'repeat(3, 1fr)' }}>
                {['', '要求納期', ''].map((label, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: i < 2 ? '1px solid #d1d5db' : 'none', boxSizing: 'border-box' }}>{label}</div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: lcw('device'), borderRight: '1px solid #d1d5db', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>装置</div>
              <div style={{ width: lcw('receipt'), borderRight: (showShippingDate || showResponsible) ? '1px solid #d1d5db' : 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>受付No</div>
              {showShippingDate && <div style={{ width: lcw('shipping'), borderRight: showResponsible ? '1px solid #d1d5db' : 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>出荷日</div>}
              {showResponsible  && <div style={{ width: lcw('responsible'), boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>責任者</div>}
            </div>
          )) : mode === 'place' ? (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: lcw('floor'), borderRight: '1px solid #d1d5db', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>フロア名</div>
              <div style={{ width: lcw('place'), boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>場所名</div>
            </div>
          ) : mode === 'task' ? (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: lcw('process'), borderRight: '1px solid #d1d5db', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>プロセス名</div>
              <div style={{ width: lcw('task'), boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>タスク名</div>
            </div>
          ) : (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: lcw('team'), borderRight: '1px solid #d1d5db', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>チーム名</div>
              <div style={{ width: lcw('name'), boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>担当者名</div>
            </div>
          )}

          {/* 列幅リサイズハンドル（各列の右端をドラッグ） */}
          {leftColumns.map((key, i) => {
            const right = leftColumns.slice(0, i + 1).reduce((s, k) => s + lcw(k), 0);
            return (
              <div
                key={`rsz-${key}`}
                onPointerDown={(e) => startColResize(key, e)}
                title="ドラッグで列幅を変更"
                style={{ position: 'absolute', top: 0, left: right - 3, width: 6, height: '100%', cursor: 'col-resize', zIndex: 25 }}
              />
            );
          })}
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
                mode={mode}
                layoutGroups={layoutGroups}
                locationRowAbsSet={locationRowAbsSet}
              />
            </div>

            {/* 左固定列（行）*/}
            <div onWheel={forwardHeaderWheel} style={{ position: 'absolute', left: 0, top: TOTAL_HDR_H, width: leftHdrW, height: containerH - TOTAL_HDR_H, overflow: 'hidden', zIndex: 10, background: '#f9fafb', borderRight: '1px solid #d1d5db' }}>
              <div style={{ position: 'relative', height: totalH }}>
                <SpreadsheetGridLeftHeader
                  layoutGroups={layoutGroups}
                  scrollTop={scrollTop}
                  containerH={containerH}
                  leftHdrW={leftHdrW}
                  mode={mode}
                  colWidths={colWidths}
                  rowBadges={rowBadges}
                  onGroupClick={handleHeaderClick}
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
          onWheelCapture={(e) => {
            if (e.deltaY !== 0) releaseSearchScrollRestriction(e.deltaY);
          }}
          onPointerDownCapture={(e) => {
            jumpAnchorPlanIdRef.current = null;
            pendingJumpSonarPlanIdRef.current = null;
            searchAnchorSerialIdRef.current = null;
            searchAnchorWorkerIdRef.current = null;
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            // macOS のオーバーレイスクロールバーは clientWidth に幅が現れないため、右端も判定対象にする。
            const scrollbarWidth = Math.max(12, rect.width - el.clientWidth);
            const onVerticalScrollbar = e.clientX >= rect.right - scrollbarWidth;
            if (onVerticalScrollbar || e.pointerType === 'touch') releaseSearchScrollRestriction(-1, true);
          }}
          onClick={e => {
            if (e.target === scrollRef.current) {
              setSelected(new Set());
              setSelectedLocation(new Set());
              setSelectedCell(null);
            }
          }}
        >
          <div style={{ width: totalCols * colW, height: TOTAL_HDR_H + totalH, position: 'relative' }}>
            {active && (
              <>
                {/* ヘッダー (sticky) */}
                <div
                  ref={dateHeaderRef}
                  style={{ position: 'sticky', top: 0, height: TOTAL_HDR_H, zIndex: 15, background: '#f3f4f6' }}
                >
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
                      setSelectedLocation(new Set());
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
                    editedPlanIds={new Set(pendingUpdatesRef.current.keys())}
                    readOnlyPlanIds={new Set(plans.filter(p => isReadOnlyPlan(p, mode)).map(p => p.planId))}
                    groupMoveHighlightIds={groupMoveHighlightIds}
                    dragRef={dragRef}
                    ghostDrag={ghostDrag}
                    mode={mode}
                    planToStartCol={planToStartCol}
                    planToEndCol={planToEndCol}
                    onBarPointerDown={handleBarPointerDown}
                    onBarRightClick={handleBarRightClick}
                    flgdiff={!!displaySettings.flgdiff}
                    flgsyoyo={!!displaySettings.flgsyoyo}
                    useKisyuColor={useKisyuColor}
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
                    selected={selectedLocation}
                    editedPlanIds={new Set(pendingLocationUpdatesRef.current.keys())}
                    dragRef={locationDragRef}
                    ghostDrag={locationGhostDrag}
                    onBarPointerDown={handleLocationBarPointerDown}
                    onBarRightClick={handleLocationBarRightClick}
                    flgdiff={!!displaySettings.flgdiff}
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

        {shouldShowScheduleAreaOverlay && (
          <div
            aria-live="polite"
            aria-busy="true"
            style={{
              position: 'absolute',
              left: leftHdrW,
              top: TOTAL_HDR_H,
              right: 0,
              bottom: 0,
              zIndex: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.62)',
              backdropFilter: 'blur(1px)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.94)',
              border: '1px solid #d1d5db',
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
              color: '#374151',
              fontSize: 13,
              fontWeight: 600,
            }}>
              <span className="ui-spinner" style={{ width: 18, height: 18 }} />
              <span>データ取得中...</span>
            </div>
          </div>
        )}

        {/* ソナーエフェクト */}
        {active && sonarPosition && [0, 380, 760].map((delay, i) => (
          <div key={`${sonarPosition.key}-${i}`} style={{
            position: 'absolute', left: sonarPosition.x, top: sonarPosition.y,
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
        selectedCount={selected.size + selectedLocation.size}
        copiedCount={copied.length}
        clipboardAction={clipboardAction}
        cutApplied={cutApplied}
        loading={isScheduleAreaFetching}
      />

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
      {tooltip && <BarTooltip plan={tooltip.plan} anchorX={tooltip.x} anchorY={tooltip.y} onClose={() => setTooltip(null)} />}
      {serialOverlay && (() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return null;
        const scrollRect = scrollEl.getBoundingClientRect();

        // バー描画領域の画面矩形（左ヘッダ・日付ヘッダを除く）
        const areaLeft   = scrollRect.left;
        const areaTop    = scrollRect.top + TOTAL_HDR_H;
        // clientWidth/clientHeight はスクロールバーを含まないため、マスクが操作部へ被らない。
        const areaRight  = Math.min(scrollRect.right, scrollRect.left + scrollEl.clientWidth);
        const areaBottom = Math.min(scrollRect.bottom, scrollRect.top + scrollEl.clientHeight);
        const areaW      = areaRight - areaLeft;

        // 対象行の絶対行番号を layoutGroups から特定
        const { triggerPlan, serialPlans } = serialOverlay;
        let rowAbs = -1;
        for (const g of layoutGroups) {
          if (!g.plans) continue;
          const found = g.plans.find(p => p.planId === triggerPlan.planId);
          if (found) { rowAbs = g.startRow + found.rowIdx; break; }
        }
        if (rowAbs < 0) return null;

        // 対象行の画面Y座標
        const rowScreenY    = areaTop + rowAbs * CELL_SIZE - scrollTop;
        const rowScreenYBot = rowScreenY + CELL_SIZE;

        // ホイールイベントをスクロール領域に転送（オーバーレイ上でもスクロール可能）
        const fwdWheel = e => {
          const el = scrollRef.current;
          if (el) { el.scrollTop += e.deltaY; el.scrollLeft += e.deltaX; }
        };

        // 表示範囲に重なる予定だけに絞る
        const contentRight = totalCols * colW;
        const visPlans = serialPlans.filter(p => p.endDate >= startDate && p.startDate <= endDate);

        // 期間が重なる予定を別レーンへ配置する。終了列より後に始まる予定は同じレーンを再利用する。
        const laneEnds = [];
        const laidOutPlans = [...visPlans]
          .map(plan => ({
            plan,
            startCol: planToStartCol(plan, startDate, viewMode),
            endCol: planToEndCol(plan, startDate, viewMode),
          }))
          .sort((a, b) => (a.startCol - b.startCol) || (a.endCol - b.endCol) || (a.plan.planId - b.plan.planId))
          .map(item => {
            let lane = laneEnds.findIndex(endCol => endCol < item.startCol);
            if (lane < 0) lane = laneEnds.length;
            laneEnds[lane] = item.endCol;
            return { ...item, lane };
          });
        const laneCount = Math.max(1, laneEnds.length);
        const triggerLane = laidOutPlans.find(item => item.plan.planId === triggerPlan.planId)?.lane ?? 0;
        const bandHeight = laneCount * CELL_SIZE;
        const rawBandTop = rowScreenY - triggerLane * CELL_SIZE;
        const viewportHeight = Math.max(0, areaBottom - areaTop);
        const triggerRowVisible = rowScreenY < areaBottom && rowScreenYBot > areaTop;
        const bandTop = triggerRowVisible && bandHeight <= viewportHeight
          ? Math.max(areaTop, Math.min(rawBandTop, areaBottom - bandHeight))
          : rawBandTop;
        const bandBottom = bandTop + bandHeight;

        // 複数レーン分をマスクから除外し、重なった予定をすべて鮮明に表示する。
        const overlayColor = 'rgba(0,0,0,0.55)';
        const topH   = Math.max(0, Math.min(bandTop, areaBottom) - areaTop);
        const botTop = Math.max(areaTop, Math.min(areaBottom, bandBottom));
        const botH   = Math.max(0, areaBottom - botTop);

        // ラベルは同じレーンにある次のバーまででクリップする。
        const xByLane = new Map();
        for (const item of laidOutPlans) {
          if (!xByLane.has(item.lane)) xByLane.set(item.lane, []);
          xByLane.get(item.lane).push({ planId: item.plan.planId, x: item.startCol * colW });
        }

        const overlayBars = [];
        if (triggerRowVisible) {
          for (const item of laidOutPlans) {
            const { plan: p, startCol: sc, endCol: ec, lane } = item;
            const laneTop = bandTop + lane * CELL_SIZE;
            if (laneTop < areaTop || laneTop + CELL_SIZE > areaBottom) continue;
            const barX = sc * colW;
            if (barX >= contentRight) continue;
            const barW = Math.min(Math.max(colW, (ec - sc + 1) * colW), contentRight - barX);

            // 水平方向をバー描画領域でクリップ
            const barScreenX = areaLeft + barX - scrollLeft;
            const clampLeft  = Math.max(barScreenX, areaLeft);
            const clampRight = Math.min(barScreenX + barW, areaRight);
            if (clampRight <= clampLeft) continue;

            const isCurrent = p.planId === triggerPlan.planId;
            const bg = getColor(p.taskBackColor);
            const fg = getColor(p.taskFontColor);

            // ラベル幅（次バー・コンテンツ右端・エリア右端でクリップ）
            const laneXArr = xByLane.get(lane) || [];
            const myIdx    = laneXArr.findIndex(r => r.planId === p.planId);
            const nextX    = myIdx >= 0 && myIdx + 1 < laneXArr.length ? laneXArr[myIdx + 1].x : null;
            const labelLeft    = barX + HANDLE_W;
            const rawLabelW    = nextX != null ? Math.max(0, nextX - labelLeft) : Math.max(0, contentRight - labelLeft);
            const labelScreenX = areaLeft + labelLeft - scrollLeft;
            const lblClampL    = Math.max(labelScreenX, areaLeft);
            const lblClampR    = Math.min(labelScreenX + rawLabelW, areaRight);
            const labelW       = Math.max(0, lblClampR - lblClampL);

            // クロージャ用にキャプチャ
            const planSnap = p;

            overlayBars.push(
              <div key={p.planId}
                onWheel={fwdWheel}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const cx = e.clientX, cy = e.clientY;
                  setContextMenu({ x: cx, y: cy, items: [
                    { label: '詳細', onClick: () => setTooltip({ plan: planSnap, x: cx, y: cy }) },
                  ]});
                }}
                style={{
                  position: 'fixed', left: clampLeft, top: laneTop,
                  width: clampRight - clampLeft, height: CELL_SIZE,
                  background: bg,
                  border: isCurrent ? '2px solid #1d4ed8' : '1px solid rgba(0,0,0,0.20)',
                  boxSizing: 'border-box', zIndex: 201,
                  overflow: 'hidden', userSelect: 'none', cursor: 'default',
                }}
              />
            );
            if (labelW > 0) {
              overlayBars.push(
                <div key={`lbl-${p.planId}`} style={{
                  position: 'fixed', left: lblClampL, top: laneTop,
                  width: labelW, height: CELL_SIZE,
                  display: 'flex', alignItems: 'center',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                  fontSize: 13, color: fg,
                  pointerEvents: 'none', zIndex: 202,
                  paddingLeft: lblClampL > labelScreenX ? 0 : 2,
                  userSelect: 'none',
                }}>
                  {`${p.taskName}${p.remark ? `＜${p.remark}＞` : ''}`}
                </div>
              );
            }
          }
        }

        return (
          <>
            {/* 上部オーバーレイ（対象行より上・クリックで解除・ホイールでスクロール） */}
            {topH > 0 && (
              <div
                onClick={() => setSerialOverlay(null)}
                onWheel={fwdWheel}
                style={{
                  position: 'fixed', left: areaLeft, top: areaTop,
                  width: areaW, height: topH,
                  background: overlayColor, zIndex: 200,
                }}
              />
            )}
            {/* 下部オーバーレイ（対象行より下・クリックで解除・ホイールでスクロール） */}
            {botH > 0 && (
              <div
                onClick={() => setSerialOverlay(null)}
                onWheel={fwdWheel}
                style={{
                  position: 'fixed', left: areaLeft, top: botTop,
                  width: areaW, height: botH,
                  background: overlayColor, zIndex: 200,
                }}
              />
            )}
            {/* 製番の全予定バーを、重複期間ごとに複数レーンで描画 */}
            {overlayBars}
          </>
        );
      })()}
      {scheduleDialog && (
        <ScheduleDialog
          plan={scheduleDialog.plan}
          initialData={scheduleDialog.initialData}
          resources={resources}
          gridMode={scheduleDialog.kind === 'location' ? 'place' : mode}
          onSave={savePlan}
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
      <DeviceHeaderTooltip detail={deviceDetail} onClose={() => setDeviceDetail(null)} />
      <AlertToast message={toast} onClose={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setToast(null); }} />
    </div>
  );
});

export default SpreadsheetGrid;
