import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson } from '../../lib/api';
import MapCanvas from './MapCanvas';
import MapToolbar from './MapToolbar';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shiftMonth(dateText, amount) {
  const [year, month, day] = dateText.split('-').map(Number);
  const lastDay = new Date(year, month + amount, 0).getDate();
  const shifted = new Date(year, month - 1 + amount, Math.min(day, lastDay));
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}

export default function MapTab({ active, onError }) {
  const [startDate, setStartDate] = useState(todayIso);
  const [floor, setFloor] = useState('A棟3F');
  const [serialSearchText, setSerialSearchText] = useState('');
  const [resources, setResources] = useState([]);
  const [appliedSerialSearch, setAppliedSerialSearch] = useState('');
  const [searchVersion, setSearchVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadData = useCallback(async (overrides = {}) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const result = await apiJson('/map/data', {
        method: 'POST',
        body: JSON.stringify({
          display_date: overrides.startDate ?? startDate,
          floor: overrides.floor ?? floor,
          serial_no: overrides.serialSearchText ?? serialSearchText,
        }),
      });
      if (requestId !== requestIdRef.current) return;
      setResources(result.resources || []);
      setAppliedSerialSearch((overrides.serialSearchText ?? serialSearchText).trim());
      setSearchVersion(version => version + 1);
      loadedRef.current = true;
    } catch {
      if (requestId === requestIdRef.current) onError?.('マップデータの取得に失敗しました');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [floor, onError, serialSearchText, startDate]);

  useEffect(() => {
    if (active && !loadedRef.current) loadData();
  }, [active, loadData]);

  function changeStartDate(value) {
    if (!value) return;
    setStartDate(value);
    loadData({ startDate: value });
  }

  function changeFloor(value) {
    setFloor(value);
    loadData({ floor: value });
  }

  function clearSerialSearch() {
    setSerialSearchText('');
    setAppliedSerialSearch('');
    loadData({ serialSearchText: '' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <MapToolbar
        startDate={startDate}
        onStartDateChange={changeStartDate}
        onShiftMonth={amount => changeStartDate(shiftMonth(startDate, amount))}
        floor={floor}
        onFloorChange={changeFloor}
        serialSearchText={serialSearchText}
        onSerialSearchTextChange={setSerialSearchText}
        onSearch={() => loadData()}
        onSearchClear={clearSerialSearch}
        onRefresh={() => loadData()}
        loading={loading}
      />
      <MapCanvas
        resources={resources}
        floor={floor}
        highlightSearch={appliedSerialSearch}
        searchVersion={searchVersion}
      />
    </div>
  );
}
