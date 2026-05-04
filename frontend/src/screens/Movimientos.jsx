import { useState } from 'react';
import BottomNav from '../components/BottomNav.jsx';
import MonthSelector from '../components/MonthSelector.jsx';
import NewExpenseModal from '../components/modals/NewExpenseModal.jsx';
import { fmtFull, fmtDate, groupByDate, catColor } from '../utils/format.js';

export default function Movimientos({ month, txs, allMonths, onNav, onMonthChange, onAddTx, onEditTx, onDeleteTx, catList = [], medioList = [] }) {
  const [filter, setFilter] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const cats = [...new Set(txs.map(t => t.cat))];

  const resolvedCatColor = cat => {
    const found = catList.find(c => c.name === cat);
    return found ? found.color : catColor(cat);
  };

  const filtered = filter === 'todos' ? txs
    : filter === 'ingresos' ? txs.filter(t => t.type === 'i')
    : filter === 'gastos' ? txs.filter(t => t.type === 'g')
    : txs.filter(t => t.cat === filter);

  const groups = groupByDate(filtered);

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#fafaf8', borderBottom: '1px solid #e8e4de' }}>
        <div style={{ padding: '14px 20px 0' }}>
          <MonthSelector month={month} allMonths={allMonths} onMonthChange={onMonthChange} />
        </div>
        <div className="filter-scroll" style={{ display: 'flex', gap: 6, padding: '10px 16px 12px', overflowX: 'auto' }}>
          {['todos', 'ingresos', 'gastos', ...cats].map(f => (
            <button key={f} className={`btn-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)} style={{ flexShrink: 0 }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll">
        {groups.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>Sin movimientos</div>}
        {groups.map(([date, items]) => (
          <div key={date}>
            <div className="date-header">{fmtDate(date)}</div>
            <div className="card" style={{ margin: '4px 16px 12px' }}>
              {items.map((tx, i) => (
                <div key={tx.id}>
                  {i > 0 && <div style={{ height: 1, background: '#f0ede8', margin: '0 16px' }} />}
                  <div className="tx-row">
                    <div className="tx-dot" style={{ background: resolvedCatColor(tx.cat) + '33' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 5, background: resolvedCatColor(tx.cat) }} />
                    </div>
                    <div className="tx-info">
                      <div className="tx-desc">{tx.desc}</div>
                      <div className="tx-meta">{tx.cat} · {tx.medio}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className={`tx-amt ${tx.type === 'i' ? 'pos' : 'neg'}`}>
                        {tx.type === 'i' ? '+' : '-'}{fmtFull(tx.amt)}
                      </div>
                      <div style={{ fontSize: 15, color: '#ccc', cursor: 'pointer', padding: '4px 2px', flexShrink: 0 }} onClick={e => { e.stopPropagation(); setEditingTx(tx); }}>✎</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ height: 16 }} />
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
      <BottomNav screen="movimientos" onNav={onNav} />
    </div>
  );
}
