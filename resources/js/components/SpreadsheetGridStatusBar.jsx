export default function SpreadsheetGridStatusBar({
  groupCount,
  mode,
  totalRows,
  dayCount,
  planCount,
  selectedCount,
  copiedCount,
  clipboardAction = 'copy',
  cutApplied = false,
  loading = false,
}) {
  return (
    <div style={{ padding: '3px 10px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontSize: 13, color: '#6b7280', display: 'flex', gap: 12, flexShrink: 0 }}>
      <span>{groupCount} {mode === 'device' ? '装置' : mode === 'place' ? '場所' : mode === 'task' ? 'タスク' : '担当者'} / {totalRows} 行 × {dayCount} 日</span>
      <span>予定 {planCount} 件</span>
      {loading && <span style={{ color: '#2563eb', fontWeight: 600 }}>データ取得中...</span>}
      {selectedCount > 0 && <span style={{ color: '#2563eb' }}>{selectedCount}件選択中</span>}
      {copiedCount > 0 && (
        <span style={{ color: clipboardAction === 'cut' ? '#d97706' : '#059669' }}>
          {clipboardAction === 'cut'
            ? `${copiedCount}件切り取り済み${cutApplied ? '（再貼り付け可）' : ''}`
            : `${copiedCount}件コピー済み`}
        </span>
      )}
    </div>
  );
}
