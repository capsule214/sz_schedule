export default function DisplaySettingsSlotPicker({ settingsList, settingNo, settingName, onSettingNoChange, onSettingNameChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, padding: '12px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>設定番号</label>
        <select
          value={settingNo}
          onChange={e => onSettingNoChange(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff' }}
        >
          {settingsList.map(item => (
            <option key={item.settingNo} value={item.settingNo}>
              {item.settingNo}: {item.settingName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>設定名</label>
        <input
          value={settingName}
          onChange={e => onSettingNameChange(e.target.value)}
          maxLength={80}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        />
      </div>
    </div>
  );
}
