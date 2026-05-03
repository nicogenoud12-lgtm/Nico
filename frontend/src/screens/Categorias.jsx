import { useState } from 'react';
import BottomNav from '../components/BottomNav.jsx';
import NewCategoryModal from '../components/modals/NewCategoryModal.jsx';
import { fmtFull, catColor } from '../utils/format.js';

export default function Categorias({ month, txs, onNav, catList = [], onCreateCat, onUpdateCat }) {
  const [activeCat, setActiveCat] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [showCatModal, setShowCatModal] = useState(false);

  const findCat = name => catList.find(c => c.name === name);
  const resolvedCatColor = name => findCat(name)?.color || catColor(name);

  const gastos = txs.filter(t => t.type === 'g');
  const totalGastos = gastos.reduce((s, t) => s + Math.abs(t.amt), 0);
  const catMap = {};
  gastos.forEach(t => { catMap[t.cat] = (catMap[t.cat] || 0) + Math.abs(t.amt); });
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] || 1;

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#e8f2ec' }}>
        <div style={{ padding: '14px 20px 14px' }}>
          <div style={{ fontSize: 11, color: '#6a9a72', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{month?.label}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Categorías</div>
            <div style={{ fontSize: 13, color: '#5a9a6a' }}>{fmtFull(totalGastos)}</div>
          </div>
        </div>
      </div>

      <div className="scroll">
        <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cats.map(([cat, val]) => {
            const catTxs = txs.filter(t => t.cat === cat);
            const isOpen = activeCat === cat;
            const color = resolvedCatColor(cat);
            return (
              <div key={cat}>
                <div className="card" style={{ cursor: 'pointer', outline: isOpen ? `2px solid ${color}` : 'none', overflow: 'hidden' }} onClick={() => setActiveCat(isOpen ? null : cat)}>
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 4, background: color }} />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{cat}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtFull(val)}</span>
                          <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6 }}>{Math.round(val / totalGastos * 100)}%</span>
                        </div>
                        <div
                          style={{ fontSize: 15, color: '#bbb', cursor: 'pointer', padding: '4px' }}
                          onClick={e => {
                            e.stopPropagation();
                            const c = findCat(cat);
                            setEditingCat({ id: c?.id, name: cat, color });
                          }}
                        >✎</div>
                        <span style={{ fontSize: 12, color: '#aaa', transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#f0ede8', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: color, width: `${val / maxCat * 100}%`, transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                      {catTxs.length} movimiento{catTxs.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${color}33` }}>
                      {catTxs.map((tx, i) => (
                        <div key={tx.id}>
                          {i > 0 && <div style={{ height: 1, background: '#f0ede8', margin: '0 16px' }} />}
                          <div className="tx-row" style={{ background: '#fafaf8' }}>
                            <div className="tx-info">
                              <div className="tx-desc">{tx.desc}</div>
                              <div className="tx-meta">{new Date(tx.date + 'T12:00:00').toLocaleDateString('es-AR')} · {tx.medio}</div>
                            </div>
                            <div className={`tx-amt ${tx.type === 'i' ? 'pos' : 'neg'}`}>
                              {tx.type === 'i' ? '+' : '-'}{fmtFull(tx.amt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div onClick={() => setShowCatModal(true)} style={{ position: 'absolute', bottom: 80, right: 20, width: 52, height: 52, borderRadius: 26, background: '#3a7a50', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(58,122,80,0.35)', fontSize: 28, color: '#fff', userSelect: 'none', zIndex: 10 }}>+</div>

      {showCatModal && <NewCategoryModal onClose={() => setShowCatModal(false)} onSave={onCreateCat} />}
      {editingCat && (
        <NewCategoryModal
          initialValues={editingCat}
          onClose={() => setEditingCat(null)}
          onSave={({ id, name, color }) => { onUpdateCat(id, { name, color }); setEditingCat(null); }}
        />
      )}
      <BottomNav screen="categorias" onNav={onNav} />
    </div>
  );
}
