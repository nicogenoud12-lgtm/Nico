export default function DonutChart({ data, size = 160, onSliceClick }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2, r = size * 0.38, inner = size * 0.24;

  if (data.length === 1) {
    return (
      <svg width={size} height={size} style={{ cursor: 'pointer' }} onClick={() => onSliceClick && onSliceClick()}>
        <circle cx={cx} cy={cy} r={(r + inner) / 2} fill="none" stroke={data[0].color} strokeWidth={r - inner} />
      </svg>
    );
  }

  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = d.value / total * Math.PI * 2;
    const a1 = angle, a2 = angle + sweep;
    angle = a2;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const xi1 = cx + inner * Math.cos(a1), yi1 = cy + inner * Math.sin(a1);
    const xi2 = cx + inner * Math.cos(a2), yi2 = cy + inner * Math.sin(a2);
    const lg = sweep > Math.PI ? 1 : 0;
    const path = `M${xi1},${yi1} L${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} L${xi2},${yi2} A${inner},${inner} 0 ${lg},0 ${xi1},${yi1} Z`;
    return { ...d, path };
  });

  return (
    <svg width={size} height={size} style={{ cursor: 'pointer' }} onClick={() => onSliceClick && onSliceClick()}>
      {slices.map((s, i) => (
        <path
          key={i}
          d={s.path}
          fill={s.color}
          stroke="#fafaf8"
          strokeWidth="2"
          style={{ transition: 'opacity .15s' }}
          onMouseEnter={e => (e.target.style.opacity = '.75')}
          onMouseLeave={e => (e.target.style.opacity = '1')}
        />
      ))}
    </svg>
  );
}
