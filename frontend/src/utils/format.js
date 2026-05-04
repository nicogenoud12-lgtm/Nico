export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateToMonthId(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  return m + y.slice(2);
}

export function monthIdLabel(id) {
  if (!id || id.length !== 4) return '';
  const mm = parseInt(id.slice(0, 2), 10) - 1;
  const yy = id.slice(2);
  return `${MONTH_NAMES[mm]} 20${yy}`;
}

export function monthIdShort(id) {
  if (!id || id.length !== 4) return '';
  const mm = parseInt(id.slice(0, 2), 10) - 1;
  return MONTH_SHORT[mm];
}

export function fmtARS(n, showSign = false) {
  if (n === null || n === undefined || isNaN(n)) return '$ 0';
  const abs = Math.abs(n);
  let s;
  if (abs >= 1_000_000) {
    s = `$${(abs / 1_000_000).toFixed(2).replace('.', ',')}M`;
  } else if (abs >= 1_000) {
    s = `$${Math.round(abs / 1_000).toLocaleString('es-AR')}k`;
  } else {
    s = `$${Math.round(abs).toLocaleString('es-AR')}`;
  }
  if (!showSign) return s;
  return (n >= 0 ? '+' : '-') + s;
}

export function fmtUSD(n) {
  return `U$D ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtMoney(n, currency = 'ARS', showSign = false) {
  return currency === 'USD' ? fmtUSD(n) : fmtARS(n, showSign);
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

export function fmtDateLong(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function pctChange(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function sortMonthIdsDesc(ids) {
  return [...ids].sort((a, b) => {
    const k = (id) => id.slice(2) + id.slice(0, 2);
    return k(b).localeCompare(k(a));
  });
}
