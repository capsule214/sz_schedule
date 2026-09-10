export default function GridTabPane({ active, children }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      visibility: active ? 'visible' : 'hidden',
      pointerEvents: active ? 'auto' : 'none',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}
