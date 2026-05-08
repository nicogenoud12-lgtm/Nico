import React, { useMemo, useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { C } from '../theme.js';
import { dateToMonthId, monthIdLabel, fmtARS, pctChange } from '../utils/format.js';
import DonutChart from '../components/DonutChart.jsx';

const MONTH_IDS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function buildYearMonths(year) {
  return MONTH_IDS.map(m => m + year.slice(2));
}

function uniqueYears(txs) {
  const years = new Set();
  txs.forEach(tx => {
    const year = tx.date.slice(0, 4);
    years.add(year);
  });
  return Array.from(years).sort().reverse();
}

function runningSum(data) {
  let cumIng = 0, cumGas = 0;
  return data.map(d => {
    cumIng += d.ing;
    cumGas += d.gas;
    return {
      ...d,
      ing: cumIng,
      gas: cumGas,
      net: cumIng - cumGas,
    };
  });
}

async function exportYearPDF(dashboardRef, year) {
  try {
    const canvas = await html2canvas(dashboardRef.current, {
      backgroundColor: '#0a0a0a',
      scale: 2,
      logging: false,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 280;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 15, 15, imgWidth, imgHeight);
    pdf.save(`gastos-anual-${year}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error al generar PDF');
  }
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

function KpiCard({ label, value, color, deltaPct, deltaLabel, progress, maxProgress, isPercentage }) {
  const progressPct = maxProgress > 0 ? (progress / maxProgress) * 100 : 0;
  const displayValue = isPercentage ? value : fmtARS(value);
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '16px',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 8 }}>
        {displayValue}
      </div>
      {deltaLabel && (
        <div style={{ fontSize: 11, color: deltaPct > 0 ? C.green : deltaPct < 0 ? C.red : C.text3, fontWeight: 600, marginBottom: 8 }}>
          {deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '—'} {Math.abs(deltaPct)}% {deltaLabel}
        </div>
      )}
      <div style={{ height: 3, background: C.surface2, borderRadius: '1.5px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: `${progressPct}%`, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

function MiniBar({ pct, label }) {
  let color = C.green;
  if (pct < 25) color = C.red;
  else if (pct < 50) color = '#eab308';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
      <span style={{ fontSize: 12, color: C.text2, minWidth: 50, textAlign: 'right' }}>{label}</span>
      <div style={{
        flex: 1,
        height: 6,
        background: C.surface2,
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{ height: '100%', background: color, width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span style={{ fontSize: 11, color: C.text3, minWidth: 30, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function VariationChip({ pct }) {
  if (pct === null || pct === undefined) {
    return <span style={{ fontSize: 11, color: C.text3 }}>—</span>;
  }
  const color = pct > 0 ? C.green : pct < 0 ? C.red : C.text3;
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '—';
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600 }}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function ComboChart({ data, mode, onClickMonth }) {
  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 20, bottom: 30, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const rawMax = Math.max(...data.flatMap(d => [d.ing, d.gas]), 1);
  const maxVal = Math.ceil(rawMax / 100000) * 100000;
  const barWidth = chartWidth / (data.length * 2.5);
  const barGap = barWidth * 0.3;

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '16px',
      marginBottom: 16,
      overflowX: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Evolución mensual</span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ minWidth: '100%' }}>
        <defs>
          <clipPath id="chartClip">
            <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} />
          </clipPath>
        </defs>

        {/* Y-axis */}
        <line x1={padding.left - 6} y1={padding.top} x2={padding.left - 6} y2={height - padding.bottom} stroke={C.border} strokeWidth="1" />

        {/* Grid + Y-axis labels */}
        {yTicks.map((val, i) => {
          const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
          const label = val === 0 ? '$0' : '$' + (val / 1000000).toFixed(val % 1000000 === 0 ? 0 : 1) + 'M';
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={C.border} strokeWidth="1" opacity="0.3" />
              <text x={padding.left - 10} y={y + 4} fontSize="10" fill={C.text3} textAnchor="end">
                {label}
              </text>
            </g>
          );
        })}

        {/* X-axis */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke={C.border} strokeWidth="1" />

        {/* Bars and line */}
        <g clipPath="url(#chartClip)">
          {data.map((d, i) => {
            const x = padding.left + (chartWidth / data.length) * i + chartWidth / (data.length * 2);
            const ingH = (d.ing / maxVal) * chartHeight;
            const gasH = (d.gas / maxVal) * chartHeight;

            return (
              <g key={d.id}>
                <rect
                  x={x - barWidth - barGap / 2}
                  y={height - padding.bottom - ingH}
                  width={barWidth}
                  height={ingH}
                  fill={C.green}
                  opacity="0.7"
                  onClick={() => onClickMonth(d.id)}
                  style={{ cursor: 'pointer' }}
                />
                <rect
                  x={x - barGap / 2}
                  y={height - padding.bottom - gasH}
                  width={barWidth}
                  height={gasH}
                  fill={C.red}
                  opacity="0.7"
                  onClick={() => onClickMonth(d.id)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            );
          })}

          {/* Net line */}
          <polyline
            points={data.map((d, i) => {
              const x = padding.left + (chartWidth / data.length) * i + chartWidth / (data.length * 2);
              const netH = (d.net / maxVal) * chartHeight;
              const y = height - padding.bottom - netH;
              return `${x},${y}`;
            }).join(' ')}
            stroke="#60a5fa"
            strokeWidth="2"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />

          {/* Net points */}
          {data.map((d, i) => {
            const x = padding.left + (chartWidth / data.length) * i + chartWidth / (data.length * 2);
            const netH = (d.net / maxVal) * chartHeight;
            const y = height - padding.bottom - netH;
            return (
              <circle key={`net-${d.id}`} cx={x} cy={y} r="4" fill="#60a5fa" />
            );
          })}
        </g>

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = padding.left + (chartWidth / data.length) * i + chartWidth / (data.length * 2);
          const label = MONTH_NAMES[parseInt(d.id.slice(0, 2)) - 1] + " '" + d.id.slice(2);
          return (
            <text key={`label-${d.id}`} x={x} y={height - padding.bottom + 18} fontSize="10" fill={C.text3} textAnchor="middle">
              {label}
            </text>
          );
        })}

        {/* Legend below X-axis */}
        <circle cx={padding.left + 80} cy={height - padding.bottom + 20} r="2" fill={C.green} />
        <text x={padding.left + 90} y={height - padding.bottom + 24} fontSize="10" fill={C.text2}>
          Ingresos
        </text>
        <circle cx={padding.left + 180} cy={height - padding.bottom + 20} r="2" fill={C.red} />
        <text x={padding.left + 190} y={height - padding.bottom + 24} fontSize="10" fill={C.text2}>
          Gastos
        </text>
        <line x1={padding.left + 260} y1={height - padding.bottom + 20} x2={padding.left + 270} y2={height - padding.bottom + 20} stroke="#60a5fa" strokeWidth="2" />
        <text x={padding.left + 280} y={height - padding.bottom + 24} fontSize="10" fill={C.text2}>
          Neto
        </text>
      </svg>
    </div>
  );
}

function SavingsDonut({ ing, gas, net, pctAhorro }) {
  const data = [
    { name: 'Ahorro', value: net, color: C.green },
    { name: 'Gasto', value: gas, color: C.red },
  ];

  const renderCenter = () => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
        {pctAhorro.toFixed(0)}%
      </div>
      <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
        Ahorro
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DonutChart
        data={data}
        size={140}
        thickness={20}
        renderCenter={renderCenter}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map(item => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
            <span style={{ flex: 1, fontSize: 11, color: C.text2 }}>{item.name}</span>
            <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{fmtARS(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color + '22',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 2 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function ScreenAnual({ txs, monthId, setMonthId, onNavigate }) {
  const dashboardRef = useRef(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [selectedYear, setSelectedYear] = useState(() => {
    const current = new Date().getFullYear().toString();
    return current;
  });
  const [mode, setMode] = useState('mensual');
  const mobile = useIsMobile();

  const years = useMemo(() => uniqueYears(txs), [txs]);
  const months12 = useMemo(() => buildYearMonths(selectedYear), [selectedYear]);

  const data = useMemo(() => {
    const result = months12.map(id => {
      const monthTxs = txs.filter(t => dateToMonthId(t.date) === id);
      const ing = monthTxs.filter(t => t.type === 'i').reduce((s, t) => s + t.amount, 0);
      const gas = monthTxs.filter(t => t.type === 'g' && t.cat_kind !== 'inversion').reduce((s, t) => s + t.amount, 0);
      const inv = monthTxs.filter(t => t.cat_kind === 'inversion').reduce((s, t) => s + t.amount, 0);
      const net = ing - gas;
      const pctAhorro = ing > 0 ? (net / ing) * 100 : 0;
      return { id, ing, gas, inv, net, pctAhorro };
    }).filter(d => d.ing > 0 || d.gas > 0 || d.inv > 0);

    result.forEach((d, i) => {
      const prev = result[i - 1];
      if (prev && prev.net !== 0) {
        d.variation = ((d.net - prev.net) / Math.abs(prev.net)) * 100;
      } else {
        d.variation = null;
      }
    });

    return result;
  }, [txs, months12]);

  const kpiMonth = useMemo(() => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].ing > 0 || data[i].gas > 0) {
        return { ...data[i], index: i };
      }
    }
    return null;
  }, [data]);

  const prevKpiMonth = useMemo(() => {
    if (!kpiMonth || kpiMonth.index === 0) return null;
    return data[kpiMonth.index - 1];
  }, [kpiMonth, data]);

  const kpis = useMemo(() => {
    if (!kpiMonth) {
      return {
        ing: 0, gas: 0, inv: 0, net: 0, pctAhorro: 0,
        varIng: null, varGas: null, varNet: null,
        label: '',
      };
    }
    const varIng = prevKpiMonth ? pctChange(kpiMonth.ing, prevKpiMonth.ing) : null;
    const varGas = prevKpiMonth ? pctChange(kpiMonth.gas, prevKpiMonth.gas) : null;
    const varNet = prevKpiMonth ? pctChange(kpiMonth.net, prevKpiMonth.net) : null;
    const label = monthIdLabel(kpiMonth.id);
    return {
      ing: kpiMonth.ing,
      gas: kpiMonth.gas,
      inv: kpiMonth.inv,
      net: kpiMonth.net,
      pctAhorro: kpiMonth.pctAhorro,
      varIng, varGas, varNet,
      label,
    };
  }, [kpiMonth, prevKpiMonth]);

  const maxKpi = Math.max(kpis.ing, kpis.gas, kpis.net || 0, 1);

  const summary = useMemo(() => {
    const nonZero = data.filter(d => d.ing > 0 || d.gas > 0);
    if (nonZero.length === 0) {
      return { bestMonth: null, worstGasto: null, tendencia: 'estable', avgIng: 0 };
    }

    const bestMonth = nonZero.reduce((a, b) => b.net > a.net ? b : a);
    const worstGasto = nonZero.reduce((a, b) => b.gas > a.gas ? b : a);

    const last3 = nonZero.slice(-3);
    let tendencia = 'estable';
    if (last3.length >= 3) {
      const slope = (last3[2].net - last3[0].net) / 2;
      tendencia = slope > 0 ? 'positiva' : slope < 0 ? 'negativa' : 'estable';
    }

    const avgIng = nonZero.reduce((s, d) => s + d.ing, 0) / nonZero.length;

    return { bestMonth, worstGasto, tendencia, avgIng };
  }, [data]);

  const ytd = useMemo(() => {
    const totalIng = data.reduce((s, d) => s + d.ing, 0);
    const totalGas = data.reduce((s, d) => s + d.gas, 0);
    const totalInv = data.reduce((s, d) => s + d.inv, 0);
    const netAcum = totalIng - totalGas;
    const nonZeroIng = data.filter(d => d.ing > 0);
    const pctAhorroProm = nonZeroIng.length > 0 ? nonZeroIng.reduce((s, d) => s + d.pctAhorro, 0) / nonZeroIng.length : 0;

    return { totalIng, totalGas, totalInv, netAcum, pctAhorroProm };
  }, [data]);

  const chartData = mode === 'mensual' ? data : runningSum(data);

  const handleClickMonth = (id) => {
    setMonthId(id);
    onNavigate?.('movimientos');
  };

  return (
    <div ref={dashboardRef} style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      <div style={{ display: 'flex', gap: 20, flexDirection: mobile ? 'column' : 'row', alignItems: 'flex-start' }}>
        {/* Columna principal */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Anual</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                style={{
                  background: C.surface,
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                onClick={() => exportYearPDF(dashboardRef, selectedYear)}
                style={{
                  background: 'transparent',
                  color: C.accent,
                  border: `1px solid ${C.accent}`,
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Exportar
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(4, 1fr)', gap: 12 }}>
            <KpiCard
              label={`Ingresos · ${kpis.label}`}
              value={kpis.ing}
              color={C.green}
              deltaPct={kpis.varIng}
              deltaLabel="vs mes ant."
              progress={kpis.ing}
              maxProgress={maxKpi}
            />
            <KpiCard
              label={`Gastos · ${kpis.label}`}
              value={kpis.gas}
              color={C.red}
              deltaPct={kpis.varGas}
              deltaLabel="vs mes ant."
              progress={kpis.gas}
              maxProgress={maxKpi}
            />
            <KpiCard
              label={`Neto · ${kpis.label}`}
              value={kpis.net}
              color={kpis.net >= 0 ? C.green : C.red}
              deltaPct={kpis.varNet}
              deltaLabel="vs mes ant."
              progress={Math.abs(kpis.net)}
              maxProgress={maxKpi}
            />
            <KpiCard
              label={`Ahorro · ${kpis.label}`}
              value={kpis.inv}
              color="#5a9cd4"
              progress={kpis.inv}
              maxProgress={Math.max(maxKpi, kpis.inv || 1)}
            />
          </div>

          {/* Chart Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Evolución mensual</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setMode('mensual')}
                  style={{
                    background: mode === 'mensual' ? C.accent : 'transparent',
                    color: mode === 'mensual' ? '#fff' : C.text2,
                    border: mode === 'mensual' ? 'none' : `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setMode('acumulado')}
                  style={{
                    background: mode === 'acumulado' ? C.accent : 'transparent',
                    color: mode === 'acumulado' ? '#fff' : C.text2,
                    border: mode === 'acumulado' ? 'none' : `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Acumulado
                </button>
              </div>
            </div>
            <ComboChart data={chartData} mode={mode} onClickMonth={handleClickMonth} />
          </div>

          {/* Data Table */}
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
              Detalle por mes
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: mobile ? '1fr' : 'repeat(6, 1fr)',
              gap: 0,
              borderBottom: `1px solid ${C.border}`,
            }}>
              {['Mes', 'Ingresos', 'Gastos', 'Neto', '% Ahorro', 'Variación'].map(h => (
                !mobile || h === 'Mes' ? (
                  <div key={h} style={{ padding: '10px 16px', borderRight: h !== 'Variación' ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.text3 }}>{h}</span>
                  </div>
                ) : null
              ))}
            </div>
            {[...data].reverse().map((d, i) => (
              <div
                key={d.id}
                onClick={() => handleClickMonth(d.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: mobile ? '1fr' : 'repeat(6, 1fr)',
                  gap: 0,
                  padding: '11px 16px',
                  borderBottom: i < data.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: d.id === monthId ? C.surface2 : hoveredIdx === data.length - 1 - i ? C.surface2 + 'aa' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={() => setHoveredIdx(data.length - 1 - i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <span style={{ fontSize: 13, color: C.text, fontWeight: d.id === monthId ? 600 : 400, borderRight: `1px solid ${C.border}`, paddingRight: 12 }}>
                  {monthIdLabel(d.id)}
                </span>
                <span style={{ fontSize: 13, color: C.green, borderRight: `1px solid ${C.border}`, paddingRight: 12 }}>
                  {fmtARS(d.ing)}
                </span>
                <span style={{ fontSize: 13, color: C.red, borderRight: `1px solid ${C.border}`, paddingRight: 12 }}>
                  {fmtARS(d.gas)}
                </span>
                <span style={{ fontSize: 13, color: d.net >= 0 ? C.green : C.red, fontWeight: 600, borderRight: `1px solid ${C.border}`, paddingRight: 12 }}>
                  {fmtARS(d.net)}
                </span>
                <span style={{ fontSize: 13, color: C.text, borderRight: `1px solid ${C.border}`, paddingRight: 12 }}>
                  {d.ing > 0 ? d.pctAhorro.toFixed(1) + '%' : '—'}
                </span>
                <span style={{ fontSize: 13, color: C.text }}>
                  <VariationChip pct={d.variation} />
                </span>
              </div>
            ))}
          </div>

          <div style={{ height: 40 }} />
        </div>

        {/* Sidebar derecho */}
        {!mobile && (
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Savings Donut */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                Ahorro del período
              </div>
              {kpis.ing > 0 ? (
                <SavingsDonut ing={kpis.ing} gas={kpis.gas} net={kpis.net} pctAhorro={kpis.pctAhorro} />
              ) : (
                <div style={{ textAlign: 'center', color: C.text3, fontSize: 12, padding: '20px' }}>
                  Sin datos en el período
                </div>
              )}
            </div>

            {/* Resumen del período */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                Resumen del período
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {summary.bestMonth ? (
                  <SummaryRow
                    icon="★"
                    label="Mejor mes"
                    value={monthIdLabel(summary.bestMonth.id)}
                    color={C.green}
                  />
                ) : null}
                {summary.worstGasto ? (
                  <SummaryRow
                    icon="▲"
                    label="Mayor gasto"
                    value={monthIdLabel(summary.worstGasto.id)}
                    color={C.red}
                  />
                ) : null}
                <div>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                    Ingreso promedio
                  </div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 12 }}>
                    {fmtARS(summary.avgIng)}
                  </div>
                </div>
              </div>
            </div>

            {/* YTD Card */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                YTD {selectedYear}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Total ingresos
                  </div>
                  <div style={{ fontSize: 16, color: C.green, fontWeight: 700, marginTop: 4 }}>
                    {fmtARS(ytd.totalIng)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Total gastos
                  </div>
                  <div style={{ fontSize: 16, color: C.red, fontWeight: 700, marginTop: 4 }}>
                    {fmtARS(ytd.totalGas)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Total invertido
                  </div>
                  <div style={{ fontSize: 16, color: '#5a9cd4', fontWeight: 700, marginTop: 4 }}>
                    {fmtARS(ytd.totalInv)}
                  </div>
                </div>
                <div style={{ paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Neto acumulado
                  </div>
                  <div style={{ fontSize: 16, color: ytd.netAcum >= 0 ? C.green : C.red, fontWeight: 700, marginTop: 4 }}>
                    {fmtARS(ytd.netAcum)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    % Ahorro promedio
                  </div>
                  <div style={{ fontSize: 16, color: C.accent, fontWeight: 700, marginTop: 4 }}>
                    {ytd.pctAhorroProm.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Ahorro Bars */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                % Ahorro por mes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.slice(-5).reverse().map(d => (
                  <MiniBar key={d.id} pct={d.ing > 0 ? d.pctAhorro : 0} label={monthIdLabel(d.id)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile sidebar at bottom */}
        {mobile && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Savings Donut */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                Ahorro del período
              </div>
              {kpis.ing > 0 ? (
                <SavingsDonut ing={kpis.ing} gas={kpis.gas} net={kpis.net} pctAhorro={kpis.pctAhorro} />
              ) : (
                <div style={{ textAlign: 'center', color: C.text3, fontSize: 12, padding: '20px' }}>
                  Sin datos en el período
                </div>
              )}
            </div>

            {/* Monthly Ahorro Bars */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                % Ahorro por mes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.slice(-5).reverse().map(d => (
                  <MiniBar key={d.id} pct={d.ing > 0 ? d.pctAhorro : 0} label={monthIdLabel(d.id)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
