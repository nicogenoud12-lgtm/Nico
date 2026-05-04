export const C = {
  bg:       '#0a0a0a',
  surface:  '#111111',
  surface2: '#1a1a1a',
  border:   '#2a2a2a',
  border2:  '#333333',
  text:     '#ffffff',
  text2:    '#888888',
  text3:    '#555555',
  green:    '#22c55e',
  red:      '#ef4444',
  accent:   '#6366f1',
  greenBg:  '#052e16',
  redBg:    '#2d0a0a',
  accentBg: '#1e1b4b',
};

export const s = {
  card: (extra = {}) => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    ...extra,
  }),
  h1: { fontSize: 24, fontWeight: 700, color: C.text },
  h2: { fontSize: 18, fontWeight: 600, color: C.text },
  h3: { fontSize: 14, fontWeight: 600, color: C.text },
  body: { fontSize: 14, color: C.text },
  small: { fontSize: 12, color: C.text2 },
  label: {
    fontSize: 11, fontWeight: 600, color: C.text3,
    textTransform: 'uppercase', letterSpacing: '.06em',
  },
  input: {
    width: '100%', padding: '10px 12px',
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.text, fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
  },
  select: {
    width: '100%', padding: '10px 12px',
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.text, fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
  },
  btnPrimary: {
    padding: '10px 20px', background: C.accent, color: '#fff',
    border: 'none', borderRadius: 8,
    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnGhost: {
    padding: '8px 14px', background: 'transparent', color: C.text2,
    border: `1px solid ${C.border}`, borderRadius: 8,
    fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer',
  },
  btnIcon: {
    background: 'transparent', border: 'none', color: C.text3,
    cursor: 'pointer', padding: '4px', borderRadius: 6, fontSize: 16,
  },
};

export const COLOR_PALETTE = [
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1',
  '#3b82f6', '#06b6d4', '#10b981', '#22c55e', '#84cc16', '#eab308',
  '#94a3b8', '#6b7280',
];

export const CARD_COLORS = [
  ['#6366f1', '#818cf8'],
  ['#ec4899', '#f472b6'],
  ['#f59e0b', '#fbbf24'],
  ['#10b981', '#34d399'],
  ['#3b82f6', '#60a5fa'],
  ['#ef4444', '#f87171'],
];
