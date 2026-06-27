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
import { loadLeftColWidths, saveLeftColWidth, visibleLeftColumns, clampLeftColW } from '../lib/leftHeaderColumns';
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
  getWeekNumber,
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

function isShippingTask(plan) {
  return Number(plan?.taskId) === SHIPPING_TASK_ID;
}

function isWorkerUnassignedPlan(plan, mode) {
  return mode === 'worker' && !!plan && (plan.workerId == null || Number(plan.workerId) <= 0);
}

function isReadOnlyPlan(plan, mode) {
  return isShippingTask(plan) || isWorkerUnassignedPlan(plan, mode);
}

const SpreadsheetGrid = forwardRef(function SpreadsheetGrid({
  active = true,
  mode, serials, workers, tasks, resources, displaySettings, settingsReady = true,
  onJumpToOtherTab, onEnsureMasters, jumpTarget, onJumpHandled, onJumpError,
  onRangeChange, onDirtyChange, onHistoryChange,
}, ref) {
  const DEVICE_GROUP_PAGE_SIZE = 240;
  const DEVICE_GROUP_PREFETCH_ROWS = 80;
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
  const [viewMode, setViewMode] = useState('day');
  const [plans, setPlans] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [serialSearchText, setSerialSearchText] = useState('');
  const [forcedSerialId, setForcedSerialId] = useState(null);
  const [serialSearchTick, setSerialSearchTick] = useState(0);
  const [devicePagedGroups, setDevicePagedGroups] = useState([]);
  const [deviceGroupTotal, setDeviceGroupTotal] = useState(0);
  const [deviceGroupOffset, setDeviceGroupOffset] = useState(0);
  const deviceGroupFetchKeyRef = useRef('');

  // 保存保留中の変更（移動/リサイズ/削除/貼り付け）を蓄積する
  // pendingCreates: Map<tempId(負数), payload>  pendingUpdates: Map<planId, payload>  pendingDeletes: Set<planId(正数のみ)>
  const pendingCreatesRef = useRef(new Map());
  const pendingUpdatesRef = useRef(new Map());
  const pendingDeletesRef = useRef(new Set());
  const tempIdCounterRef  = useRef(-1); // 貼り付け時のローカル仮ID（負数）
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  const [contextMenu, setContextMenu] = useState(null);
  const [serialOverlay, setSerialOverlay] = useState(null); // { triggerPlan, serialPlans } | null
  const [tooltip, setTooltip] = useState(null);
  const [scheduleDialog, setScheduleDialog] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [groupMoveHighlightIds, setGroupMoveHighlightIds] = useState(new Set());
  const [selectedCell, setSelectedCell] = useState(null);
  const [copied, setCopied] = useState([]);
  const [sonar, setSonar] = useState(null);
  const sonarClearTimerRef = useRef(null);
  const sonarRafRef = useRef(null);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const groupMoveHighlightTimerRef = useRef(null);

  const fetchedPlanKeysRef  = useRef(new Set());
  const [locationOverlayPlans, setLocationOverlayPlans] = useState([]);
  const fetchedLocKeysRef   = useRef(new Set());
  const [calendarData, setCalendarData] = useState(new Map()); // dateStr → { dayType } (0=平日 1=土日 3=祝日 4=会社休日)
  const fetchedCalendarRangesRef = useRef([]);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerH, setContainerH] = useState(600);
  const [containerW, setContainerW] = useState(1200);
  const [fetchVersion, setFetchVersion] = useState(0);

  const dragRef = useRef(null);
  const [rectSelect, setRectSelect] = useState(null); // {absX1,absY1,absX2,absY2} in content coords
  const suppressNextCellClickRef = useRef(false);
  const layoutGroupsRef = useRef([]);
  const prevJumpTargetRef = useRef(null);
  const jumpTimerRef = useRef(null);
  const pendingScrollSerialIdRef = useRef(null);

  const showShippingDate = mode === 'device' && !!displaySettings.sbdspdate;
  const showResponsible  = mode === 'device' && !!displaySettings.sbdspincharge;
  // 製品表示: 0=製番, 1=M番(加工オーダー order_type_id=21), 2=直送DPR(order_type_id=11)
  const sbsbmb = Number(displaySettings.sbsbmb ?? 0);
  const isMorderDevice = mode === 'device' && (sbsbmb === 1 || sbsbmb === 2);
  const morderOrderTypeId = sbsbmb === 2 ? 11 : sbsbmb === 1 ? 21 : null;
  const isMorderTask = mode === 'task' && Number(displaySettings.tksbmb ?? 0) === 1;

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
      return [...t]
        .sort((a, b) => {
          const pd = (a.processSortNo || 0) - (b.processSortNo || 0);
          return pd !== 0 ? pd : (a.sortNo || 0) - (b.sortNo || 0);
        })
        .map(task => ({
          id: task.taskId,
          processName: task.processName || '(未設定)',
          taskName: task.taskName,
        }));
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
      return w.map(wr => ({ id: wr.workerId, workerName: wr.workerName, teamName: wr.teamName }));
    }
  }, [settingsReady, mode, serials, workers, tasks, resources, displaySettings, baseDeviceGroups, baseMorderGroups, forcedSerialId, pllocation, isMorderDevice]);

  const { groups: layoutGroups, totalRows } = useMemo(() => {
    const groupKey = mode === 'device' ? (isMorderDevice ? 'morder' : 'device') : mode === 'worker' ? 'worker' : mode === 'task' ? 'task' : 'place';
    const locPlans = extraLocationRow ? locationOverlayPlans : null;
    const activePlans = plans.filter(p => !p.deleted);
    const result = layoutPlans(activePlans, groupKey, filteredGroups, viewMode, startDate, planMinRows, locPlans);

    if (mode === 'device' && deviceGroupTotal > 0) {
      const baseRow = deviceGroupOffset * planMinRows;
      const shiftedGroups = result.groups.map(g => ({
        ...g,
        startRow: g.startRow + baseRow,
      }));
      const visibleEndRow = shiftedGroups.reduce((max, g) => Math.max(max, g.startRow + g.numRows), 0);
      return {
        groups: shiftedGroups,
        totalRows: Math.max(deviceGroupTotal * planMinRows, visibleEndRow),
      };
    }

    if (mode !== 'worker' || !displaySettings.synobody) return result;

    // 担当者未定の予定（workerId が NULL/0以下）を製番別にグループ化して末尾に追加
    const unassignedPlans = activePlans.filter(p => p.workerId == null || Number(p.workerId) <= 0);
    const serialMap = new Map();
    for (const plan of unassignedPlans) {
      if (!serialMap.has(plan.serialId)) serialMap.set(plan.serialId, []);
      serialMap.get(plan.serialId).push(plan);
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
    for (const serialId of sortedSerialIds) {
      const uaPlans = serialMap.get(serialId);
      const serial = serials.find(s => s.serialId === serialId);
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
        id: `ua-${serialId}`,
        kisyuName: serial?.kisyuName || uaPlans[0]?.kisyuName || '',
        serialNo: serial?.serialNo || uaPlans[0]?.serialNo || '',
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
  }, [plans, filteredGroups, mode, viewMode, startDate, planMinRows, extraLocationRow, locationOverlayPlans, serials, displaySettings, isMorderDevice, deviceGroupOffset, deviceGroupTotal]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 表示設定から API 検索ボディのフィルタ部分を構築する
  function buildFilterBody() {
    const useModelFilters = !isMorderDevice;
    const sbmodellist   = displaySettings.sbmodellist   || [];
    const sbequiptype   = displaySettings.sbequiptype;
    const sbszgrouplist = displaySettings.sbszgrouplist || [];
    const sbstatuslist  = displaySettings.sbstatuslist  || [];
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

  const fetchDeviceGroups = useCallback(async (offset, q = '') => {
    if (!settingsReady) return null;
    if (mode !== 'device') return null;
    const body = {
      ...buildFilterBody(),
      offset,
      limit: Math.max(1, Math.min(DEVICE_GROUP_PAGE_SIZE, deviceCount - offset)),
    };
    delete body.product_display;
    if (q) body.q = q;

    const key = JSON.stringify({ morder: isMorderDevice, ...body });
    if (!q && deviceGroupFetchKeyRef.current === key) return null;
    if (!q) deviceGroupFetchKeyRef.current = key;

    const endpoint = isMorderDevice ? '/morder/groups' : '/serial/device-groups';
    const mapper = isMorderDevice ? mapMorderToGroup : mapSerialToDeviceGroup;
    const data = await apiJson(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const groups = (data.groups || []).map(mapper);
    if (!q) {
      setDevicePagedGroups(groups);
      setDeviceGroupTotal(Math.min(Number(data.total || 0), deviceCount));
      setDeviceGroupOffset(Number(data.offset || 0));
    }
    return { ...data, groups };
  }, [settingsReady, mode, isMorderDevice, displaySettings, DEVICE_GROUP_PAGE_SIZE, mapSerialToDeviceGroup, mapMorderToGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildVisibleFilterBody = useCallback((groupIds) => {
    const ids = [...new Set(groupIds.map(Number).filter(Number.isFinite))];
    if (ids.length === 0) return null;
    if (mode === 'device') return isMorderDevice ? { morder_ids: ids } : { serial_ids: ids };
    if (mode === 'worker') return { worker_ids: ids };
    if (mode === 'task') return { task_ids: ids };
    return { resource_ids: ids };
  }, [mode, isMorderDevice]);

  const makeFetchKey = useCallback((from, to, body) => {
    return JSON.stringify({ mode, from, to, body });
  }, [mode]);

  const fetchPlans = useCallback(async (from, to, groupIds = []) => {
    if (!settingsReady) return;
    const filter = buildFilterBody();
    let body;
    if (mode === 'device') {
      const visibleFilter = buildVisibleFilterBody(groupIds);
      if (!visibleFilter) return;
      body = { ...filter, ...visibleFilter };
    } else if (mode === 'worker') {
      const visibleFilter = buildVisibleFilterBody(groupIds);
      const fallbackWorkerIds = filteredGroups.map(g => Number(g.id)).filter(Number.isFinite);
      body = {
        ...filter,
        ...(visibleFilter || (fallbackWorkerIds.length > 0 ? { worker_ids: fallbackWorkerIds } : {})),
      };
    } else {
      const visibleFilter = buildVisibleFilterBody(groupIds);
      if (!visibleFilter) return;
      body = { ...filter, ...visibleFilter };
    }
    const key = makeFetchKey(from, to, body);
    if (fetchedPlanKeysRef.current.has(key)) return;
    fetchedPlanKeysRef.current.add(key);
    try {
      const data = await apiArray(planSearchEndpoint, {
        method: 'POST',
        body: JSON.stringify({ from, to, ...body }),
      });
      setPlans(prev => {
        const existingIds = new Set(prev.map(p => p.planId));
        const newPlans = data.filter(p => !existingIds.has(p.planId));
        return newPlans.length ? [...prev, ...newPlans] : prev;
      });
    } catch (e) {
      fetchedPlanKeysRef.current.delete(key);
      console.error('fetchPlans error', e);
    }
  }, [settingsReady, buildVisibleFilterBody, makeFetchKey, planSearchEndpoint, mode, isMorderDevice, displaySettings, filteredGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // 表示期間・表示設定変更時：アクティブタブのみ即時フェッチ。非アクティブは pending フラグを立てて遅延
  useEffect(() => {
    if (!settingsReady) return;
    fetchedPlanKeysRef.current = new Set();
    setPlans([]);
  }, [settingsReady, startDate, endDate, displaySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLocationOverlayPlans = useCallback(async (from, to, groupIds = []) => {
    const ids = [...new Set(groupIds.map(Number).filter(Number.isFinite))];
    if (ids.length === 0 || isMorderDevice) return;
    const filter = buildFilterBody();
    const body = { show_finished: filter.show_finished, serial_ids: ids };
    if (filter.kisyu_ids) body.kisyu_ids = filter.kisyu_ids;
    const key = JSON.stringify({ mode: 'place-overlay', from, to, body });
    if (fetchedLocKeysRef.current.has(key)) return;
    fetchedLocKeysRef.current.add(key);
    try {
      const data = await apiArray('/reserve/search', {
        method: 'POST',
        body: JSON.stringify({ from, to, ...body }),
      });
      setLocationOverlayPlans(prev => {
        const existingIds = new Set(prev.map(p => p.planId));
        const newPlans = data.filter(p => !existingIds.has(p.planId));
        return newPlans.length ? [...prev, ...newPlans] : prev;
      });
    } catch (e) {
      fetchedLocKeysRef.current.delete(key);
      console.error('fetchLocationOverlayPlans error', e);
    }
  }, [displaySettings]); // eslint-disable-line react-hooks/exhaustive-deps

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
          for (const c of data) next.set(c.date, { dayType: c.dayType });
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
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // showLocationInDevice の ON/OFF 切り替え、または表示期間・設定変更時に場所予定をフェッチ
  useEffect(() => {
    // 表示期間・表示設定の変更で機種フィルタが変わるため、古いオーバーレイ予定を破棄して取り直す
    setLocationOverlayPlans([]);
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
    undoStackRef.current = [...undoStackRef.current, action].slice(-10);
    redoStackRef.current = [];
    notifyHistoryChange();
  }

  function applyHistoryChanges(changes, direction) {
    const useAfter = direction === 'redo';
    setPlans(prev => prev.map(plan => {
      const change = changes.find(c => c.planId === plan.planId);
      return change ? { ...plan, ...(useAfter ? change.after : change.before) } : plan;
    }));

    for (const change of changes) {
      if (useAfter) {
        pendingUpdatesRef.current.set(change.planId, change.after);
      } else if (change.previousPendingHad) {
        pendingUpdatesRef.current.set(change.planId, change.previousPending);
      } else {
        pendingUpdatesRef.current.delete(change.planId);
      }
    }
    setIsDirty(true);
    onDirtyChange?.(true);
  }

  function undoLastEdit() {
    const action = undoStackRef.current.pop();
    if (!action) return;
    applyHistoryChanges(action.changes, 'undo');
    redoStackRef.current.push(action);
    notifyHistoryChange();
  }

  function redoLastEdit() {
    const action = redoStackRef.current.pop();
    if (!action) return;
    applyHistoryChanges(action.changes, 'redo');
    undoStackRef.current.push(action);
    notifyHistoryChange();
  }

  // 保存・キャンセルを親から呼び出せるようにする
  useImperativeHandle(ref, () => ({
    undoLastEdit,
    redoLastEdit,
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
      clearEditHistory();
      setIsDirty(false);
      onDirtyChange?.(false);
    },
    async cancelChanges() {
      pendingCreatesRef.current = new Map();
      pendingUpdatesRef.current = new Map();
      pendingDeletesRef.current = new Set();
      tempIdCounterRef.current = -1;
      clearEditHistory();
      fetchedPlanKeysRef.current = new Set();
      setPlans([]);
      setIsDirty(false);
      onDirtyChange?.(false);
      setFetchVersion(v => v + 1);
    },
  }), [onDirtyChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = 0;
  }, []);

  const handleSerialSearch = useCallback(async () => {
    if (mode !== 'device') return;
    const q = serialSearchText.trim();
    if (!q) {
      setForcedSerialId(null);
      pendingScrollSerialIdRef.current = null;
      setSerialSearchTick(t => t + 1);
      return;
    }

    if (isMorderDevice) {
      // 読み込み済みページ内を優先検索
      const loaded = baseMorderGroups.find(g => String(g.morderNo) === q || String(g.partsNo) === q);
      if (loaded) {
        setForcedSerialId(null);
        pendingScrollSerialIdRef.current = loaded.id;
        setSerialSearchTick(t => t + 1);
        return;
      }
      // サーバ検索（該当ページを取得）
      const serverHit = await fetchDeviceGroups(0, q);
      const group = serverHit?.groups?.[0];
      if (!group) return;
      setDevicePagedGroups(serverHit.groups);
      setDeviceGroupTotal(Math.min(Number(serverHit.total || 0), deviceCount));
      setDeviceGroupOffset(Number(serverHit.offset || 0));
      setForcedSerialId(null);
      pendingScrollSerialIdRef.current = group.id;
      setSerialSearchTick(t => t + 1);
      return;
    }

    const loadedGroupHit = baseDeviceGroups.find(g => String(g.serialNo) === q)
      || baseDeviceGroups.find(g => String(g.serialNo).includes(q));
    if (loadedGroupHit) {
      setForcedSerialId(null);
      pendingScrollSerialIdRef.current = loadedGroupHit.id;
      setSerialSearchTick(t => t + 1);
      return;
    }

    const exact = serials.find(s => String(s.serialNo) === q);
    const partial = serials.find(s => String(s.serialNo).includes(q));
    const hit = exact || partial;
    if (!hit) {
      const serverHit = await fetchDeviceGroups(0, q);
      const group = serverHit?.groups?.[0];
      if (!group) return;
      setDevicePagedGroups(serverHit.groups);
      setDeviceGroupTotal(Math.min(Number(serverHit.total || 0), deviceCount));
      setDeviceGroupOffset(Number(serverHit.offset || 0));
      setForcedSerialId(null);
      pendingScrollSerialIdRef.current = group.id;
      setSerialSearchTick(t => t + 1);
      return;
    }

    const isInBaseTarget = baseDeviceGroups.some(g => g.id === hit.serialId);
    if (isInBaseTarget) {
      setForcedSerialId(null);
    } else {
      setForcedSerialId(hit.serialId);
    }
    pendingScrollSerialIdRef.current = hit.serialId;
    setSerialSearchTick(t => t + 1);
  }, [mode, serialSearchText, serials, baseDeviceGroups, baseMorderGroups, isMorderDevice, fetchDeviceGroups, deviceCount]);

  const onScroll = useCallback(e => {
    const sl = e.currentTarget.scrollLeft;
    const st = e.currentTarget.scrollTop;
    setScrollTop(st);
    setScrollLeft(sl);
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

  const visRowStart = Math.max(0, Math.floor(scrollTop / CELL_SIZE) - BUFFER_ROWS);
  const visRowEnd   = Math.min(totalRows - 1, Math.ceil((scrollTop + containerH) / CELL_SIZE) + BUFFER_ROWS);
  const visColStart = Math.max(0, Math.floor(scrollLeft / colW) - 2);
  const visColEnd   = Math.min(totalCols - 1, Math.ceil((scrollLeft + containerW) / colW) + 2);

  const visibleGroupIds = useMemo(() => {
    const ids = [];
    for (const g of layoutGroups) {
      const groupEndRow = g.startRow + g.numRows - 1;
      if (g.startRow <= visRowEnd && groupEndRow >= visRowStart && !g.isUnassigned) {
        ids.push(g.id);
      }
    }
    return ids;
  }, [layoutGroups, visRowStart, visRowEnd]);

  const visibleFetchRange = useMemo(() => {
    const from = colToDateStr(startDate, Math.max(0, Math.floor(scrollLeft / colW)), viewMode);
    const to = colToDateStr(startDate, Math.min(totalCols - 1, Math.ceil((scrollLeft + containerW) / colW)), viewMode);
    return {
      from: from < startDate ? startDate : from,
      to: to > endDate ? endDate : to,
    };
  }, [startDate, endDate, scrollLeft, colW, containerW, totalCols, viewMode]);

  useEffect(() => {
    if (!settingsReady || mode !== 'device') return;
    setDevicePagedGroups([]);
    setDeviceGroupTotal(0);
    setDeviceGroupOffset(0);
    deviceGroupFetchKeyRef.current = '';
    fetchedPlanKeysRef.current = new Set();
    setPlans([]);
  }, [settingsReady, mode, isMorderDevice, displaySettings, deviceCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settingsReady || !active || mode !== 'device') return;
    const estimatedGroupIndex = Math.max(0, Math.floor(scrollTop / (planMinRows * CELL_SIZE)) - DEVICE_GROUP_PREFETCH_ROWS);
    const offset = Math.floor(estimatedGroupIndex / DEVICE_GROUP_PAGE_SIZE) * DEVICE_GROUP_PAGE_SIZE;
    if (deviceGroupTotal > 0 && offset >= deviceGroupTotal) return;
    const currentStart = deviceGroupOffset;
    const currentEnd = deviceGroupOffset + devicePagedGroups.length;
    if (devicePagedGroups.length > 0 && estimatedGroupIndex >= currentStart && estimatedGroupIndex < Math.max(currentStart + 1, currentEnd - DEVICE_GROUP_PREFETCH_ROWS)) return;
    fetchDeviceGroups(Math.min(offset, Math.max(0, deviceCount - 1))).catch(e => console.error('fetchDeviceGroups error', e));
  }, [settingsReady, active, mode, isMorderDevice, scrollTop, planMinRows, deviceGroupOffset, devicePagedGroups.length, deviceGroupTotal, deviceCount, fetchDeviceGroups]);

  // スクロール停止後だけ、現在描画している日付・行の予定を取得する。
  useEffect(() => {
    if (!settingsReady || !active) return;
    const timer = setTimeout(() => {
      fetchPlans(visibleFetchRange.from, visibleFetchRange.to, visibleGroupIds);
      if (extraLocationRow) {
        fetchLocationOverlayPlans(visibleFetchRange.from, visibleFetchRange.to, visibleGroupIds);
      }
      fetchCalendar(visibleFetchRange.from, visibleFetchRange.to);
    }, 250);
    return () => clearTimeout(timer);
  }, [settingsReady, active, visibleFetchRange, visibleGroupIds, devicePagedGroups.length, deviceGroupOffset, extraLocationRow, fetchPlans, fetchLocationOverlayPlans, fetchCalendar, fetchVersion]);

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
          if (!isReadOnlyPlan(p, mode) && bx1 < selX2 && bx2 > selX1 && by1 < selY2 && by2 > selY1) {
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

    if (isReadOnlyPlan(plan, mode)) return;
    if (mode === 'task') return;

    const bar = getPlanBar(plan);
    if (!bar) return;

    const startX = e.clientX;
    const startY = e.clientY;

    // selectedRef を使ってポインターキャプチャ後も最新の選択状態を参照できるようにする
    const capturedSelected = selected.has(plan.planId) ? selected : new Set([plan.planId]);
    const dragPlans = [...capturedSelected].map(id => plans.find(p => p.planId === id)).filter(p => p && !isReadOnlyPlan(p, mode));
    if (!dragPlans.some(p => p.planId === plan.planId)) dragPlans.push(plan);
    if (dragPlans.length === 0) return;

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
    const movedGroupPlanIds = [];
    const historyChanges = [];

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
      let newLocationId = dp.resourceId;
      if (destGroupId !== null) {
        if (mode === 'device' && isMorderDevice) newMorderId = destGroupId;
        else if (mode === 'device') newSerialId = destGroupId;
        else if (mode === 'worker') newWorkerId = destGroupId;
        else newLocationId = destGroupId;
      }
      const groupChanged =
        type === 'move'
        && destGroupId !== null
        && (
          (mode === 'device' && isMorderDevice && Number(dp.morderId) !== Number(newMorderId))
          || (mode === 'device' && !isMorderDevice && Number(dp.serialId) !== Number(newSerialId))
          || (mode === 'worker' && Number(dp.workerId) !== Number(newWorkerId))
          || (mode === 'place' && Number(dp.resourceId) !== Number(newLocationId))
        );
      if (groupChanged) movedGroupPlanIds.push(dp.planId);

      // API は呼ばず、ローカル state を即時更新して保留リストに積む
      const beforePayload = mode === 'place'
        ? { resourceId: dp.resourceId, serialId: dp.serialId, startDate: dp.startDate, endDate: dp.endDate }
        : { serialId: dp.serialId, morderId: dp.morderId, taskId: dp.taskId, workerId: dp.workerId, startDate: dp.startDate, endDate: dp.endDate };
      const payload = mode === 'place'
        ? { resourceId: newLocationId, serialId: newSerialId, startDate: newStartDate, endDate: newEndDate }
        : { serialId: newSerialId, morderId: newMorderId, taskId: dp.taskId, workerId: newWorkerId, startDate: newStartDate, endDate: newEndDate };
      const changed = Object.keys(payload).some(key => String(payload[key] ?? '') !== String(beforePayload[key] ?? ''));
      if (!changed) continue;
      const previousPendingHad = pendingUpdatesRef.current.has(dp.planId);
      const previousPending = previousPendingHad ? { ...pendingUpdatesRef.current.get(dp.planId) } : null;
      historyChanges.push({
        planId: dp.planId,
        before: beforePayload,
        after: payload,
        previousPendingHad,
        previousPending,
      });
      setPlans(prev => prev.map(p =>
        p.planId === dp.planId ? { ...p, ...payload } : p
      ));
      pendingUpdatesRef.current.set(dp.planId, payload);
      setIsDirty(true);
      onDirtyChange?.(true);
    }
    if (historyChanges.length > 0) {
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
    if (mode === 'task') return;
    setSelectedCell({ col, row });
    setSelected(new Set());
    const g = getGroupAtRow(row);
    const colDate = colToDateStr(startDate, col, viewMode);
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
              workerId:   mode === 'worker'   ? g?.id : null,
              startDate: dateStr,
              endDate: endStr,
            }
          });
        }
      }]),
      ...(copied.length > 0 ? [{
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

    // タスクタブは閲覧専用（編集・コピー・削除なし）。詳細とジャンプのみ表示する。
    if (mode === 'task') {
      setContextMenu({ x: e.clientX, y: e.clientY, items: [
        { label: '詳細', onClick: () => setTooltip({ plan, x: e.clientX, y: e.clientY }) },
        ...(jumpItems.length > 0 ? ['separator', ...jumpItems] : []),
      ]});
      return;
    }

    const serialPlanItem = mode === 'worker' && plan.serialId
      ? { label: '前後予定を表示', onClick: () => {
          apiArray(`/plan/by-serial/${plan.serialId}`)
            .then(data => setSerialOverlay({ triggerPlan: plan, serialPlans: data || [] }))
            .catch(() => {});
        }}
      : null;

    const items = isMulti ? [
      { label: `${n}件コピー`, onClick: () => {
        const toCopy = [...selected].map(id => plans.find(p => p.planId === id)).filter(p => p && !isReadOnlyPlan(p, mode));
        setCopied(toCopy);
      }},
      'separator',
      { label: `${n}件削除`, danger: true, onClick: () => {
        deletePlans([...selected].filter(id => !isReadOnlyPlan(plans.find(p => p.planId === id), mode)));
      }},
    ] : [
      { label: '詳細', onClick: () => setTooltip({ plan, x: e.clientX, y: e.clientY }) },
      ...(!isReadOnlyPlan(plan, mode) ? [
        { label: '編集', onClick: () => openScheduleDialog({ plan }) },
        { label: 'コピー', onClick: () => setCopied([plan]) },
        'separator',
        { label: '削除', danger: true, onClick: () => deletePlans([plan.planId]) },
      ] : []),
      ...(jumpItems.length > 0 ? ['separator', ...jumpItems] : []),
      ...(serialPlanItem ? ['separator', serialPlanItem] : []),
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }

  function deletePlans(ids) {
    const deletableIds = ids.filter(id => !isReadOnlyPlan(plans.find(p => p.planId === id), mode));
    if (deletableIds.length === 0) return;
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
  }

  function pastePlans(targetCol, targetRow) {
    if (!copied.length) return;
    // 貼り付け先の行グループ（装置 or 担当者）を特定
    const targetGroup = getGroupAtRow(targetRow);
    if (!targetGroup) return; // グループが特定できない場合は貼り付けしない

    // 貼り付け先の serialId / workerId / locationId（全プランに共通で適用）
    const targetSerialId   = mode === 'device' && !isMorderDevice ? targetGroup.id : null;
    const targetMorderId   = mode === 'device' && isMorderDevice ? targetGroup.id : null;
    const targetWorkerId   = mode === 'worker'   ? targetGroup.id : null;
    const targetLocationId = mode === 'place' ? targetGroup.id : null;

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
      const newLocationId = mode === 'place' ? targetLocationId : p.resourceId;

      const payload = mode === 'place'
        ? { resourceId: newLocationId, serialId: newSerialId, startDate: newStart, endDate: newEnd }
        : { serialId: newSerialId, morderId: newMorderId, taskId: p.taskId, workerId: newWorkerId, startDate: newStart, endDate: newEnd };
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
    if (isReadOnlyPlan(data?.plan, mode)) return;
    setScheduleDialog(data);
  }

  async function savePlan(data) {
    const dialog = scheduleDialog;
    if (isReadOnlyPlan(dialog?.plan, mode)) {
      setScheduleDialog(null);
      return;
    }
    setScheduleDialog(null);
    const payload = mode === 'place'
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
        educatorWorkerId: data.educatorWorkerId,
        startDate: data.startDate,
        endDate:   data.endDate,
        plannedMinutes: data.plannedMinutes ?? 0,
        price: data.price ?? 0,
        remark: data.remark ?? '',
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
      prevJumpTargetRef.current = null;
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
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
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
    fetchedPlanKeysRef.current = new Set();
    setPlans([]);
    await apiJson('/seed', {
      method: 'POST',
      body: JSON.stringify({ count: deviceCount, baseDate: startDate, months: displayMonths }),
    });
    setFetchVersion(v => v + 1);
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
      if (cal?.dayType === 3 || cal?.dayType === 4) type = 'holiday';   // 祝日 / 会社休日
      else if (dow === 0)          type = 'sunday';
      else if (dow === 6)          type = 'saturday';
      else                         type = 'weekday';
      cols.push({ dateStr: ds, day: dt.getDate(), dow, month: dt.getMonth() + 1, year: dt.getFullYear(), week: getWeekNumber(ds), type });
    }
    return cols;
  }, [startDate, endDate, calendarData]);


  const planCount = plans.filter(p => !p.deleted).length;
  const groupCount = mode === 'device' && deviceGroupTotal > 0 ? deviceGroupTotal : filteredGroups.length;

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
      rows = group.isUnassigned
        ? [['区分', '担当者未定'], ['機種', group.kisyuName], ['製番', group.serialNo], ['表示予定件数', planCount]]
        : [['チーム', group.teamName], ['担当者', group.workerName], ['表示予定件数', planCount]];
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
        serialSearchPlaceholder={isMorderDevice ? 'M番/品番検索' : '製番検索'}
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
      {serialOverlay && (() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return null;
        const scrollRect = scrollEl.getBoundingClientRect();

        // バー描画領域の画面矩形（左ヘッダ・日付ヘッダを除く）
        const areaLeft   = scrollRect.left;
        const areaTop    = scrollRect.top + TOTAL_HDR_H;
        const areaRight  = scrollRect.right;
        const areaBottom = scrollRect.bottom;
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

        // オーバーレイを対象行の上下に分割（対象行はオーバーレイなし→バーが鮮明に見える）
        const overlayColor = 'rgba(0,0,0,0.55)';
        const topH   = Math.max(0, Math.min(rowScreenY, areaBottom) - areaTop);
        const botTop = Math.max(areaTop, rowScreenYBot);
        const botH   = Math.max(0, areaBottom - botTop);

        // 対象行が可視範囲内かどうか
        const rowVisible = rowScreenY < areaBottom && rowScreenYBot > areaTop;

        // 表示範囲に重なる予定だけに絞る
        const contentRight = totalCols * colW;
        const visPlans = serialPlans.filter(p => p.endDate >= startDate && p.startDate <= endDate);

        // ラベルクリッピング用にX座標ソート
        const xArr = visPlans
          .map(p => ({ planId: p.planId, x: planToStartCol(p, startDate, viewMode) * colW }))
          .sort((a, b) => a.x - b.x);

        const overlayBars = [];
        if (rowVisible) {
          for (const p of visPlans) {
            const sc = planToStartCol(p, startDate, viewMode);
            const ec = planToEndCol(p, startDate, viewMode);
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
            const myIdx    = xArr.findIndex(r => r.planId === p.planId);
            const nextX    = myIdx >= 0 && myIdx + 1 < xArr.length ? xArr[myIdx + 1].x : null;
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
                  position: 'fixed', left: clampLeft, top: rowScreenY,
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
                  position: 'fixed', left: lblClampL, top: rowScreenY,
                  width: labelW, height: CELL_SIZE,
                  display: 'flex', alignItems: 'center',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                  fontSize: 13, color: fg,
                  pointerEvents: 'none', zIndex: 202,
                  paddingLeft: lblClampL > labelScreenX ? 0 : 2,
                  userSelect: 'none',
                }}>
                  {p.taskName}
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
            {/* 製番の全予定バーを対象行に重ねて描画 */}
            {overlayBars}
          </>
        );
      })()}
      {scheduleDialog && (
        <ScheduleDialog
          plan={scheduleDialog.plan}
          initialData={scheduleDialog.initialData}
          resources={resources}
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
