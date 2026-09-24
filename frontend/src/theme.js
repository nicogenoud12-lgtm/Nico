// Paleta neutra (zinc) con un único acento. Superficies separadas por
// luminancia sutil + bordes de bajo contraste, al estilo de apps pro en dark mode.
export const C = {
  bg:       '#09090b',
  surface:  '#111113',
  surface2: '#19191c',
  border:   '#232327',
  border2:  '#2e2e33',
  text:     '#fafafa',
  text2:    '#a1a1aa',
  text3:    '#6b6b74',
  green:    '#3ecf8e',
  red:      '#f26d6d',
  accent:   '#7170ff',
  greenBg:  '#0f261d',
  redBg:    '#2a1315',
  accentBg: '#1d1c3d',
};

export const s = {
  card: (extra = {}) => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    ...extra,
  }),
  h1: { fontSize: 24, fontWeight: 650, color: C.text, letterSpacing: '-0.02em' },
  h2: { fontSize: 18, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' },
  h3: { fontSize: 14, fontWeight: 600, color: C.text },
  body: { fontSize: 14, color: C.text },
  small: { fontSize: 12, color: C.text2 },
  label: {
    fontSize: 11, fontWeight: 500, color: C.text3,
    textTransform: 'uppercase', letterSpacing: '.08em',
  },
  input: {
    width: '100%', padding: '10px 12px', minHeight: 42,
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10,
    color: C.text, fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
  },
  select: {
    width: '100%', padding: '10px 12px', minHeight: 42,
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10,
    color: C.text, fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
  },
  btnPrimary: {
    padding: '10px 20px', minHeight: 42, background: C.accent, color: '#fff',
    border: 'none', borderRadius: 10,
    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnGhost: {
    padding: '8px 14px', background: 'transparent', color: C.text2,
    border: `1px solid ${C.border2}`, borderRadius: 10,
    fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  btnIcon: {
    background: 'transparent', border: 'none', color: C.text3,
    cursor: 'pointer', padding: '4px', borderRadius: 8, fontSize: 16,
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
