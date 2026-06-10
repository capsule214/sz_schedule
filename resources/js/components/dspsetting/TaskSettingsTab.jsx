import CommonOptions from './CommonOptions';

export default function TaskSettingsTab({ form, setField, tasks }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 製品表示 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#374151', flexShrink: 0 }}>製品表示</span>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
          {[['製番', 0], ['M番', 1], ['すべて', 2]].map(([label, val], idx, arr) => (
            <button
              key={val}
              type="button"
              onClick={() => setField('tksbmb', val)}
              style={{
                padding: '4px 14px', border: 'none',
                borderRight: idx < arr.length - 1 ? '1px solid #d1d5db' : 'none',
                background: form.tksbmb === val ? '#2563eb' : '#fff',
                color: form.tksbmb === val ? '#fff' : '#374151',
                fontSize: 13, cursor: 'pointer', fontWeight: form.tksbmb === val ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>
        {/* タスクリスト */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minHeight: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>表示タスクリスト</div>
          <select
            multiple
            value={form.tktasklist.map(String)}
            onChange={e => setField('tktasklist', [...e.target.selectedOptions].map(o => Number(o.value)))}
            style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
          >
            {tasks.map(t => (
              <option key={t.taskId} value={t.taskId}>
                {t.taskTypeName || '(未設定)'} | {t.processName || '(未設定)'} | {t.taskName}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0, flexShrink: 0 }}>未選択の場合は何も表示しません</p>
        </div>

        {/* 表示オプション */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 120 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示オプション1</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>表示期間</span>
              <input
                type="number" min={1} max={24}
                value={form.duration}
                onChange={e => setField('duration', Math.max(1, Number(e.target.value)))}
                style={{ width: 52, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
              />
              <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>ヶ月</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>タスク表示色</span>
              <select
                value={form.sycolor}
                onChange={e => setField('sycolor', Number(e.target.value))}
                style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              >
                <option value={0}>タスクカラー</option>
                <option value={1}>機種カラー</option>
              </select>
            </div>
          </div>

          <CommonOptions form={form} setField={setField} />
        </div>
      </div>
    </div>
  );
}
