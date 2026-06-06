/**
 * DisplaySettingsSlotPicker
 *
 * スロット切り替え（0〜4）と設定名編集を1つのコンボボックスに統合。
 *
 * - テキスト入力欄に現在の設定名を表示。直接編集で設定名を変更できる。
 * - 右端の ▼ ボタンでドロップダウンを開き、スロットを切り替えられる。
 * - ドロップダウン内では現在アクティブなスロットをハイライト表示。
 *
 * Props:
 *   settingsList        [{settingNo:0, settingName:'...', isActive:bool}, ...]
 *   settingNo           現在選択中のスロット番号（0〜4）
 *   settingName         現在の設定名（編集中の値）
 *   onSettingNoChange   (no: number) => void
 *   onSettingNameChange (name: string) => void
 */
import { useState, useRef, useEffect } from 'react';

export default function DisplaySettingsSlotPicker({
  settingsList = [],
  settingNo,
  settingName,
  onSettingNoChange,
  onSettingNameChange,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // フォーカスが外れたらドロップダウンを閉じる
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const slots = settingsList.length > 0
    ? settingsList
    : Array.from({ length: 5 }, (_, i) => ({
        settingNo: i,
        settingName: `表示設定${i + 1}`,
        isActive: i === settingNo,
      }));

  function handleSelect(no) {
    setOpen(false);
    if (no !== settingNo) onSettingNoChange(no);
  }

  return (
    <div
      ref={rootRef}
      style={{ position: 'relative' }}
    >
      {/* ── コンボボックス本体 ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${open ? '#2563eb' : '#d1d5db'}`,
        borderRadius: 6,
        background: '#fff',
        boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        overflow: 'hidden',
      }}>
        {/* 設定名テキスト入力 */}
        <input
          value={settingName}
          onChange={e => onSettingNameChange(e.target.value)}
          onFocus={() => setOpen(true)}
          maxLength={80}
          placeholder={`表示設定${settingNo + 1}`}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '6px 8px',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            background: 'transparent',
          }}
        />

        {/* ▼ ボタン */}
        <button
          type="button"
          onPointerDown={e => {
            e.preventDefault();
            setOpen(prev => !prev);
          }}
          style={{
            flexShrink: 0,
            padding: '0 8px',
            border: 'none',
            borderLeft: '1px solid #e5e7eb',
            background: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            fontSize: 11,
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="設定一覧を開く"
        >
          {open ? '▲' : '▼'}
        </button>
      </div>

      {/* ── ドロップダウンリスト ── */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 2px)',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 100,
          overflow: 'hidden',
        }}>
          {slots.map(item => {
            const isActive = item.settingNo === settingNo;
            return (
              <button
                key={item.settingNo}
                type="button"
                onPointerDown={e => {
                  e.preventDefault();
                  handleSelect(item.settingNo);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  background: isActive ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* スロット番号 */}
                <span style={{
                  flexShrink: 0,
                  width: 36,
                  fontSize: 11,
                  fontWeight: 700,
                  color: isActive ? '#2563eb' : '#9ca3af',
                  textAlign: 'center',
                  background: isActive ? '#dbeafe' : '#f3f4f6',
                  borderRadius: 4,
                  padding: '1px 0',
                }}>
                  設定{item.settingNo + 1}
                </span>

                {/* 設定名 */}
                <span style={{
                  flex: 1,
                  fontSize: 13,
                  color: isActive ? '#1d4ed8' : '#374151',
                  fontWeight: isActive ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.settingName}
                </span>

                {/* アクティブマーク */}
                {isActive && (
                  <span style={{ flexShrink: 0, fontSize: 12, color: '#2563eb' }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
