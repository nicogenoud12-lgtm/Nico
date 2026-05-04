import { useState } from 'react';
import BottomNav from '../components/BottomNav.jsx';
import DonutChart from '../components/DonutChart.jsx';
import MonthSelector from '../components/MonthSelector.jsx';
import NewExpenseModal from '../components/modals/NewExpenseModal.jsx';
import { fmt, fmtFull, catColor } from '../utils/format.js';

export default function Dashboard({ month, txs, allMonths, onNav, onMonthChange, onAddTx, onEditTx, onDeleteTx, catList = [], medioList = [] }) {
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  const ingresos = txs.filter(t => t.type === 'i').reduce((s, t) => s + t.amt, 0);
  const gastos = Math.abs(txs.filter(t => t.type === 'g').reduce((s, t) => s + t.amt, 0));
  const neto = ingresos - gastos;
  const saldoFinal = (month?.saldoInicial || 0) + neto;
  const recent = [...txs].slice(0, 5);

  const resolvedCatColor = cat => {
    const found = catList.find(c => c.name === cat);
    return found ? found.color : catColor(cat);
  };

  const catMap = {};
  txs.filter(t => t.type === 'g').forEach(t => { catMap[t.cat] = (catMap[t.cat] || 0) + Math.abs(t.amt); });
  const donutData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat, value]) => ({ cat, value, color: resolvedCatColor(cat) }));

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#e8f2ec', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0' }}>
          <MonthSelector month={month} allMonths={allMonths} onMonthChange={onMonthChange} light />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#6bbf8e', opacity: .6 }} />
        </div>

        <div style={{ padding: '10px 20px 16px' }}>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1.5px', color: '#1a1a1a', lineHeight: 1.1 }}>
            {fmtFull(saldoFinal)}
          </div>
          <div style={{ fontSize: 11, color: '#6a9a72', marginTop: 2, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase' }}>saldo final</div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ background: '#c8e8d0', color: '#2a6a3a', fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>+ {fmt(ingresos)}</span>
            <span style={{ background: '#f0d8d4', color: '#8a3028', fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>− {fmt(gastos)}</span>
            <span style={{ background: '#e8f0ec', color: '#3a6a48', fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>≈ {fmt(neto, true)}</span>
          </div>
        </div>
      </div>

      <div className="scroll">
        <div style={{ padding: '20px 20px 0', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => onNav('categorias')}>
            <DonutChart data={donutData.length ? donutData : [{ cat: 'Sin datos', value: 1, color: '#e8e4de' }]} size={140} onSliceClick={() => onNav('categorias')} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 11, color: '#888' }}>Gastos</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{fmt(gastos)}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {donutData.slice(0, 5).map(d => (
              <div key={d.cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#1a1a1a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.cat}</span>
                <span style={{ fontSize: 12, color: '#888' }}>{fmt(d.value)}</span>
              </div>
            ))}
            {donutData.length > 5 && <div style={{ fontSize: 11, color: '#aaa' }}>+ {donutData.length - 5} más</div>}
          </div>
        </div>

        {month?.cuotas > 0 && (
          <div style={{ margin: '16px 16px 0' }}>
            <div className="card" style={{ padding: '12px 16px', background: '#fffbee', borderColor: '#e8d898', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8a6a00' }}>Cuotas mes que viene</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>próximo mes</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8a6a00' }}>− {fmtFull(month.cuotas)}</div>
            </div>
          </div>
        )}

        <div style={{ padding: '20px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Últimos movimientos</span>
          <span style={{ fontSize: 12, color: '#888', cursor: 'pointer' }} onClick={() => onNav('movimientos')}>ver todos →</span>
        </div>
        <div className="card" style={{ margin: '0 16px 24px' }}>
          {recent.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>Sin movimientos</div>}
          {recent.map((tx, i) => (
            <div key={tx.id}>
              {i > 0 && <div style={{ height: 1, background: '#f0ede8', margin: '0 16px' }} />}
              <div className="tx-row" onClick={() => setEditingTx(tx)}>
                <div className="tx-dot" style={{ background: resolvedCatColor(tx.cat) + '33' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: resolvedCatColor(tx.cat) }} />
                </div>
                <div className="tx-info">
                  <div className="tx-desc">{tx.desc}</div>
                  <div className="tx-meta">{tx.cat} · {tx.medio}</div>
                </div>
                <div className={`tx-amt ${tx.type === 'i' ? 'pos' : 'neg'}`}>
                  {tx.type === 'i' ? '+' : '-'}{fmtFull(tx.amt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div onClick={() => setShowModal(true)} style={{ position: 'absolute', bottom: 80, right: 20, width: 52, height: 52, borderRadius: 26, background: '#3a7a50', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(58,122,80,0.35)', fontSize: 28, color: '#fff', userSelect: 'none', zIndex: 10 }}>+</div>

      {showModal && <NewExpenseModal onClose={() => setShowModal(false)} onSave={onAddTx} catList={catList} medioList={medioList} />}
      {editingTx && (
        <NewExpenseModal
          initialValues={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={tx => { onEditTx(editingTx.id, tx); setEditingTx(null); }}
          onDelete={onDeleteTx}
          catList={catList}
          medioList={medioList}
        />
      )}
      <BottomNav screen="dashboard" onNav={onNav} />
    </div>
  );
}
