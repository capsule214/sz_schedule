import { isIPadOS } from '../../lib/platform';

export default function AdaptiveMultiSelect({
  options,
  values,
  onChange,
  style,
  size,
  ariaLabel,
}) {
  const selected = new Set((values || []).map(value => String(value)));

  if (!isIPadOS()) {
    return (
      <select
        multiple
        value={(values || []).map(String)}
        onChange={(event) => {
          const selectedKeys = new Set([...event.target.selectedOptions].map(option => option.value));
          onChange(options.filter(option => selectedKeys.has(String(option.value))).map(option => option.value));
        }}
        style={style}
        size={size}
        aria-label={ariaLabel}
      >
        {options.map(option => (
          <option key={String(option.value)} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        ...style,
        flex: style?.flex ? 'none' : style?.flex,
        height: style?.flex ? 'min(320px, 42vh)' : style?.height,
        minHeight: style?.flex ? 132 : style?.minHeight,
        overflowY: 'auto',
        padding: 0,
        background: '#fff',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {options.map((option, index) => {
        const key = String(option.value);
        return (
          <label
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 4,
              padding: '2px 5px',
              borderBottom: index < options.length - 1 ? '1px solid #e5e7eb' : 'none',
              color: '#374151',
              fontSize: 14,
              cursor: 'pointer',
              userSelect: 'none',
              boxSizing: 'border-box',
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(key)}
              onChange={() => {
                const nextSelected = new Set(selected);
                if (nextSelected.has(key)) nextSelected.delete(key);
                else nextSelected.add(key);
                onChange(options
                  .filter(item => nextSelected.has(String(item.value)))
                  .map(item => item.value));
              }}
              style={{ width: 18, height: 18, margin: 0, flexShrink: 0 }}
            />
            <span style={{ lineHeight: 1.35 }}>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
