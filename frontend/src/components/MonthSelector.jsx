export default function MonthSelector({ month, allMonths, onMonthChange, light = false }) {
  const monthIdx = allMonths.findIndex(m => m.id === month.id);
  const canPrev = monthIdx < allMonths.length - 1;
  const canNext = monthIdx > 0;

  const btnStyle = (active, lighter) => ({
    background: 'none', border: 'none', cursor: active ? 'pointer' : 'default',
    color: active ? (lighter ? '#4a8a5a' : '#1a1a1a') : (lighter ? '#b8d4be' : '#ccc'),
    fontSize: 20, lineHeight: 1, padding: '0 6px', fontFamily: 'inherit'
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button onClick={() => canPrev && onMonthChange(1)} style={btnStyle(canPrev, light)}>‹</button>
      <span style={{ fontSize: 13, fontWeight: 600, color: light ? '#4a8a5a' : '#555', letterSpacing: '.01em', minWidth: 100, textAlign: 'center' }}>
        {month.label}
      </span>
      <button onClick={() => canNext && onMonthChange(-1)} style={btnStyle(canNext, light)}>›</button>
    </div>
  );
}
