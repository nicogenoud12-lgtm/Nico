import { CAT_COLORS, MONTH_NAMES } from '../constants/data.js';

export function fmt(n, showSign = false) {
  const abs = Math.abs(n);
  const s = abs >= 1000000
    ? `$ ${(abs / 1000000).toFixed(2).replace('.', ',')}M`
    : abs >= 1000
    ? `$ ${Math.round(abs / 1000).toLocaleString('es-AR')}k`
    : `$ ${abs.toLocaleString('es-AR')}`;
  if (!showSign) return s;
  return (n >= 0 ? '+' : '−') + ' ' + s;
}

export function fmtFull(n) {
  return `$ ${Math.abs(n).toLocaleString('es-AR')}`;
}

export function catColor(cat) {
  return CAT_COLORS[cat] || '#b0aaaa';
}

export function groupByDate(txs) {
  const groups = {};
  txs.forEach(tx => {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function monthIdToLabelFull(id) {
  const mm = parseInt(id.slice(0, 2), 10) - 1;
  const yy = id.slice(2);
  return `${MONTH_NAMES[mm]} 20${yy}`;
}

export function monthIdToShort(id) {
  const mm = parseInt(id.slice(0, 2), 10) - 1;
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][mm];
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function dateToMonthId(dateStr) {
  const [y, m] = dateStr.split('-');
  return m + y.slice(2);
}
