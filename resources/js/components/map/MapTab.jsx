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
  const [locationTypes, setLocationTypes] = useState([]);
  const [locationTypeId, setLocationTypeId] = useState('');
  const [locationTypeName, setLocationTypeName] = useState('');
  const [serialSearchText, setSerialSearchText] = useState('');
  const [resources, setResources] = useState([]);
  const [appliedSerialSearch, setAppliedSerialSearch] = useState('');
  const [searchVersion, setSearchVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadData = useCallback(async (overrides = {}) => {
    const selectedLocationTypeId = Number(overrides.locationTypeId ?? locationTypeId);
    if (!selectedLocationTypeId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const result = await apiJson('/map/data', {
        method: 'POST',
        body: JSON.stringify({
          display_date: overrides.startDate ?? startDate,
          location_type_id: selectedLocationTypeId,
          serial_no: overrides.serialSearchText ?? serialSearchText,
        }),
      });
      if (requestId !== requestIdRef.current) return;
      setResources(result.resources || []);
      setLocationTypeName(result.locationTypeName || '');
      setAppliedSerialSearch((overrides.serialSearchText ?? serialSearchText).trim());
      setSearchVersion(version => version + 1);
    } catch {
      if (requestId === requestIdRef.current) onError?.('マップデータの取得に失敗しました');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [locationTypeId, onError, serialSearchText, startDate]);

  useEffect(() => {
    if (!active || initializedRef.current) return;
    initializedRef.current = true;
    setLoading(true);
    apiJson('/map/location-types')
      .then(async types => {
        const nextTypes = Array.isArray(types) ? types : [];
        setLocationTypes(nextTypes);
        const first = nextTypes[0];
        if (!first) {
          setResources([]);
          setLoading(false);
          return;
        }
        setLocationTypeId(first.locationTypeId);
        setLocationTypeName(first.locationTypeName);
        await loadData({ locationTypeId: first.locationTypeId });
      })
      .catch(() => {
        initializedRef.current = false;
        setLoading(false);
        onError?.('フロアリストの取得に失敗しました');
      });
  }, [active, loadData]);

  function changeStartDate(value) {
    if (!value) return;
    setStartDate(value);
    loadData({ startDate: value });
  }

  function changeLocationType(value) {
    const nextId = Number(value);
    const nextType = locationTypes.find(type => Number(type.locationTypeId) === nextId);
    setLocationTypeId(nextId);
    setLocationTypeName(nextType?.locationTypeName || '');
    loadData({ locationTypeId: nextId });
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
        locationTypes={locationTypes}
        locationTypeId={locationTypeId}
        onLocationTypeChange={changeLocationType}
        serialSearchText={serialSearchText}
        onSerialSearchTextChange={setSerialSearchText}
        onSearch={() => loadData()}
        onSearchClear={clearSerialSearch}
        onRefresh={() => loadData()}
        loading={loading}
      />
      <MapCanvas
        resources={resources}
        locationTypeName={locationTypeName}
        highlightSearch={appliedSerialSearch}
        searchVersion={searchVersion}
      />
    </div>
  );
}
