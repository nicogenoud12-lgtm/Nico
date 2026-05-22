import React, { useMemo, useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { C } from '../theme.js';
import { dateToMonthId, monthIdLabel, fmtARS, pctChange } from '../utils/format.js';
import DonutChart from '../components/DonutChart.jsx';
import { useHideAmounts } from '../HideAmountsContext.jsx';

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
  const { hidden } = useHideAmounts();
  const displayValue = isPercentage ? value : (hidden ? '••••' : fmtARS(value));
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

function MobileMetric({ label, value, color, bold = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color }}>{value}</span>
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

function ComboChart({ data, mode, onClickMonth, hidden }) {
  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 20, bottom: 28, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const rawMax = Math.max(...data.flatMap(d => [d.ing, d.gas]), 1);
  const maxVal = Math.ceil(rawMax / 100000) * 100000;
  const barWidth = chartWidth / (data.length * 2.5);
  const barGap = barWidth * 0.3;

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  const getX = i => padding.left + (chartWidth / data.length) * i + chartWidth / (data.length * 2);

  const handleHover = (e, i) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, d: data[i] });
    setHoveredIdx(i);
  };

  const touchActiveRef = useRef(false);

  const handleLeave = () => {
    if (touchActiveRef.current) return;
    setHoveredIdx(null);
    setTooltip(null);
  };

  const handleTouchStart = (e, i) => {
    e.preventDefault();    // evita click sintético y mouse events
    e.stopPropagation();   // evita que handleContainerTouch se dispare
    touchActiveRef.current = true;
    const touch = e.touches[0];
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({ x: touch.clientX - rect.left, y: touch.clientY - rect.top, d: data[i] });
    setHoveredIdx(i);
  };

  const handleContainerTouch = () => {
    touchActiveRef.current = false;
    setTooltip(null);
    setHoveredIdx(null);
  };

  return (
    <div ref={containerRef} onTouchStart={handleContainerTouch} style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '16px',
      marginBottom: 16,
      overflowX: 'auto',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Evolución mensual</span>
      </div>

      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x < (containerRef.current?.offsetWidth || 600) / 2 ? tooltip.x + 12 : tooltip.x - 168,
          top: Math.max(tooltip.y - 55, 8),
          background: C.surface2,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,.5)',
          minWidth: 158,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>
            {MONTH_NAMES[parseInt(tooltip.d.id.slice(0, 2)) - 1] + " '" + tooltip.d.id.slice(2)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: C.text3 }}>Ingresos</span>
            <span style={{ color: C.green, fontWeight: 600 }}>{hidden ? '••••' : fmtARS(tooltip.d.ing)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
            <span style={{ color: C.text3 }}>Gastos</span>
            <span style={{ color: C.red, fontWeight: 600 }}>{hidden ? '••••' : fmtARS(tooltip.d.gas)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
            <span style={{ color: C.text3 }}>Neto</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>{hidden ? '••••' : fmtARS(tooltip.d.net)}</span>
          </div>
        </div>
      )}

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

        <g clipPath="url(#chartClip)">
          {/* Bars */}
          {data.map((d, i) => {
            const x = getX(i);
            const ingH = (d.ing / maxVal) * chartHeight;
            const gasH = (d.gas / maxVal) * chartHeight;
            const isHovered = hoveredIdx === i;

            return (
              <g
                key={d.id}
                onMouseMove={e => handleHover(e, i)}
                onMouseLeave={handleLeave}
                onTouchStart={e => handleTouchStart(e, i)}
                style={{ cursor: 'default' }}
              >
                {/* invisible hit area */}
                <rect
                  x={x - barWidth - barGap / 2 - 4}
                  y={padding.top}
                  width={barWidth * 2 + barGap + 8}
                  height={chartHeight}
                  fill="transparent"
                />
                <rect
                  x={x - barWidth - barGap / 2}
                  y={height - padding.bottom - ingH}
                  width={barWidth}
                  height={ingH}
                  fill={C.green}
                  opacity={isHovered ? 1 : 0.7}
                />
                <rect
                  x={x - barGap / 2}
                  y={height - padding.bottom - gasH}
                  width={barWidth}
                  height={gasH}
                  fill={C.red}
                  opacity={isHovered ? 1 : 0.7}
                />
              </g>
            );
          })}

          {/* Net line */}
          <polyline
            points={data.map((d, i) => {
              const x = getX(i);
              const netH = (d.net / maxVal) * chartHeight;
              return `${x},${height - padding.bottom - netH}`;
            }).join(' ')}
            stroke="#60a5fa"
            strokeWidth="2"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />

          {/* Net points */}
          {data.map((d, i) => {
            const x = getX(i);
            const netH = (d.net / maxVal) * chartHeight;
            const y = height - padding.bottom - netH;
            const isHovered = hoveredIdx === i;
            return (
              <circle
                key={`net-${d.id}`}
                cx={x} cy={y}
                r={isHovered ? 6 : 4}
                fill="#60a5fa"
                onMouseMove={e => handleHover(e, i)}
                onMouseLeave={handleLeave}
                onTouchStart={e => handleTouchStart(e, i)}
                style={{ cursor: 'default' }}
              />
            );
          })}
        </g>

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = getX(i);
          const label = MONTH_NAMES[parseInt(d.id.slice(0, 2)) - 1] + " '" + d.id.slice(2);
          return (
            <text key={`label-${d.id}`} x={x} y={height - padding.bottom + 16} fontSize="10" fill={C.text3} textAnchor="middle">
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: C.text2 }}>Ingresos</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: C.text2 }}>Gastos</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 18, height: 2, background: '#60a5fa', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: C.text2 }}>Neto</span>
        </div>
      </div>
    </div>
  );
}

function SavingsDonut({ ing, gas, net, pctAhorro }) {
  const { hidden } = useHideAmounts();
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
            <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{hidden ? '••••' : fmtARS(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
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
  const { hidden } = useHideAmounts();
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
              label={`Inversión · ${kpis.label}`}
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
            <ComboChart data={chartData} mode={mode} onClickMonth={handleClickMonth} hidden={hidden} />
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
            {!mobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 0,
                borderBottom: `1px solid ${C.border}`,
              }}>
                {['Mes', 'Ingresos', 'Gastos', 'Neto', '% Ahorro', 'Variación'].map(h => (
                  <div key={h} style={{ padding: '10px 16px', borderRight: h !== 'Variación' ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.text3 }}>{h}</span>
                  </div>
                ))}
              </div>
            )}
            {[...data].reverse().map((d, i) => mobile ? (
              <div
                key={d.id}
                onClick={() => handleClickMonth(d.id)}
                style={{
                  padding: '12px 14px',
                  borderBottom: i < data.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: d.id === monthId ? C.surface2 : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                  {monthIdLabel(d.id)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                  <MobileMetric label="Ingreso" value={hidden ? '••••' : fmtARS(d.ing)} color={C.green} />
                  <MobileMetric label="Gasto" value={hidden ? '••••' : fmtARS(d.gas)} color={C.red} />
                  <MobileMetric label="Neto" value={hidden ? '••••' : fmtARS(d.net)} color={d.net >= 0 ? C.green : C.red} bold />
                  <MobileMetric label="Ahorro" value={d.ing > 0 ? d.pctAhorro.toFixed(1) + '%' : '—'} color={C.text} />
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>Variación</span>
                    <VariationChip pct={d.variation} />
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={d.id}
                onClick={() => handleClickMonth(d.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
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
                  {hidden ? '••••' : fmtARS(d.ing)}
                </span>
                <span style={{ fontSize: 13, color: C.red, borderRight: `1px solid ${C.border}`, paddingRight: 12 }}>
                  {hidden ? '••••' : fmtARS(d.gas)}
                </span>
                <span style={{ fontSize: 13, color: d.net >= 0 ? C.green : C.red, fontWeight: 600, borderRight: `1px solid ${C.border}`, paddingRight: 12 }}>
                  {hidden ? '••••' : fmtARS(d.net)}
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
                    {hidden ? '••••' : fmtARS(ytd.totalIng)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Total gastos
                  </div>
                  <div style={{ fontSize: 16, color: C.red, fontWeight: 700, marginTop: 4 }}>
                    {hidden ? '••••' : fmtARS(ytd.totalGas)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Total inversiones
                  </div>
                  <div style={{ fontSize: 16, color: '#5a9cd4', fontWeight: 700, marginTop: 4 }}>
                    {hidden ? '••••' : fmtARS(ytd.totalInv)}
                  </div>
                </div>
                <div style={{ paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Neto acumulado
                  </div>
                  <div style={{ fontSize: 16, color: ytd.netAcum >= 0 ? C.green : C.red, fontWeight: 700, marginTop: 4 }}>
                    {hidden ? '••••' : fmtARS(ytd.netAcum)}
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
