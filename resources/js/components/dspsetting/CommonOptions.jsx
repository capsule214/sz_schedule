/** 全タブ共通の「表示オプション2」チェックボックスリスト */
const FLAGS = [
  { key: 'sboption',      label: '完了製品も表示' },
  { key: 'synobody',      label: '社員未定も表示' },
  { key: 'sbdspplplan',   label: '場所予定も表示' },
  { key: 'sbdspdate',     label: '出荷日を表示' },
  { key: 'sbdspincharge', label: '責任者を表示' },
  { key: 'flgsyoyo',      label: '所要日連動を表示' },
  { key: 'flgukeoi',      label: '請負発注状態を表示' },
  { key: 'flgkeppin',     label: '部品欠品状態を表示' },
  { key: 'flggoso',       label: '後送有無を表示' },
  { key: 'flgdiff',       label: '当日変更状態を表示' },
];

export default function CommonOptions({ form, setField }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示オプション2</div>
      {FLAGS.map(({ key, label }) => (
        <label
          key={key}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        >
          <input
            type="checkbox"
            checked={!!form[key]}
            onChange={e => setField(key, e.target.checked)}
          />
          <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
        </label>
      ))}
    </div>
  );
}
