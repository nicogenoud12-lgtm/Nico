import { useState } from 'react';
import BottomNav from '../components/BottomNav.jsx';
import { fmt, fmtFull } from '../utils/format.js';

export default function Anual({ currentMonthId, allMonths, allTx, onNav, onSelectMonth }) {
  const [hovered, setHovered] = useState(null);
  const [viewMode, setViewMode] = useState('monto');

  const monthStats = allMonths.map(m => {
    const txs = allTx.filter(t => t.month === m.id);
    const ingresos = txs.filter(t => t.type === 'i').reduce((s, t) => s + t.amt, 0);
    const gastos = Math.abs(txs.filter(t => t.type === 'g').reduce((s, t) => s + t.amt, 0));
    return { ...m, ingresos, gastos, neto: ingresos - gastos };
  });

  const maxAbs = Math.max(...monthStats.map(m => Math.abs(m.neto)), 1);
  const totalNeto = monthStats.reduce((s, m) => s + m.neto, 0);
  const activeMths = monthStats.filter(m => m.ingresos > 0 || m.gastos > 0).length;
  const promedioNeto = activeMths ? totalNeto / activeMths : 0;

  const byYear = {};
  monthStats.forEach(m => {
    const yr = '20' + m.id.slice(2);
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].unshift(m);
  });

  const netoLabel = m => {
    if (viewMode === 'pct') {
      if (!m.ingresos) return '—';
      return Math.round(m.neto / m.ingresos * 100) + '%';
    }
    return (m.neto >= 0 ? '+' : '') + fmt(m.neto);
  };

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#fafaf8', borderBottom: '1px solid #e8e4de' }}>
        <div style={{ padding: '14px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Vista Anual</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Neto: {fmtFull(totalNeto)} · Prom: {fmt(promedioNeto)}/mes
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {['monto', 'pct'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: viewMode === mode ? '#1a1a1a' : '#e8e4de',
                color: viewMode === mode ? '#fff' : '#888', transition: 'all .15s'
              }}>{mode === 'monto' ? '$' : '%'}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="scroll">
        {Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([year, months]) => (
          <div key={year} style={{ padding: '16px 16px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{year}</div>
            <div style={{ position: 'relative', height: 90, marginBottom: 4, padding: '0 4px' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#e0dcd8' }} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'stretch', height: '100%' }}>
                {months.map(m => {
                  const barH = Math.max(3, Math.abs(m.neto) / maxAbs * 42);
                  const isPos = m.neto >= 0;
                  const isActive = m.id === currentMonthId;
                  const isHov = hovered === m.id;
                  const barColor = isActive ? '#1a1a1a' : isPos ? '#4a9a6a' : '#c04030';
                  const barColorHov = isActive ? '#333' : isPos ? '#2d7a52' : '#a03020';
                  return (
                    <div
                      key={m.id}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
                      onClick={() => { onSelectMonth(m.id); onNav('dashboard'); }}
                      onMouseEnter={() => setHovered(m.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {isHov && (
                        <div style={{ position: 'absolute', top: isPos ? (45 - barH - 20) : (45 + barH - 4), left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 5 }}>
                          {netoLabel(m)}
                        </div>
                      )}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', paddingBottom: 0.5 }}>
                        {isPos && <div style={{ width: '100%', height: barH, borderRadius: '3px 3px 0 0', background: isHov ? barColorHov : barColor, transition: 'all .15s' }} />}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', width: '100%', paddingTop: 0.5 }}>
                        {!isPos && <div style={{ width: '100%', height: barH, borderRadius: '0 0 3px 3px', background: isHov ? barColorHov : barColor, transition: 'all .15s' }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, padding: '0 4px', marginBottom: 12 }}>
              {months.map(m => {
                const isActive = m.id === currentMonthId;
                return (
                  <div key={m.id} style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }} onClick={() => { onSelectMonth(m.id); onNav('dashboard'); }}>
                    <span style={{ fontSize: 9, color: isActive ? '#1a1a1a' : '#aaa', fontWeight: isActive ? 700 : 400 }}>{m.short}</span>
                  </div>
                );
              })}
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              {months.map((m, i) => {
                const isActive = m.id === currentMonthId;
                return (
                  <div key={m.id}>
                    {i > 0 && <div style={{ height: 1, background: '#f0ede8', margin: '0 16px' }} />}
                    <div className="tx-row" style={{ background: isActive ? '#f5f2ec' : 'transparent' }} onClick={() => { onSelectMonth(m.id); onNav('dashboard'); }}>
                      <div style={{ width: 4, height: 32, borderRadius: 2, background: isActive ? '#1a1a1a' : 'transparent', flexShrink: 0 }} />
                      <div className="tx-info">
                        <div className="tx-desc">{m.label}</div>
                        <div className="tx-meta">+{fmt(m.ingresos)} / −{fmt(m.gastos)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: m.neto >= 0 ? '#2d7a52' : '#c04030' }}>{netoLabel(m)}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>{viewMode === 'pct' ? 'ahorro' : 'neto'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ height: 16 }} />
      </div>
      <BottomNav screen="anual" onNav={onNav} />
    </div>
  );
}
