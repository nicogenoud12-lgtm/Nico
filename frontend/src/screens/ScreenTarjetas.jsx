import React, { useState, useMemo, useEffect } from 'react';
import { C, s, CARD_COLORS } from '../theme.js';
import TarjetaCard from '../components/TarjetaCard.jsx';
import TarjetaDetail from '../components/TarjetaDetail.jsx';
import TarjetaForm from '../components/TarjetaForm.jsx';
import Modal from '../components/Modal.jsx';
import { fmtMoney, fmtDate, todayStr, dateToMonthId } from '../utils/format.js';
import { createTarjeta, updateTarjeta, deleteTarjeta } from '../api/tarjetas.js';
import { deleteTransaction } from '../api/transactions.js';

const BANK_INITIALS = {
  galicia: 'G', santander: 'S', macro: 'M', bbva: 'B', icbc: 'I',
  brubank: 'BR', naranja: 'N', personal: 'P', uala: 'U', mercadopago: 'MP',
};

function MiniCardBadge({ tarjeta }) {
  const [c1, c2] = CARD_COLORS[tarjeta.color_idx % CARD_COLORS.length];
  const key = tarjeta.banco?.toLowerCase() || '';
  const initials = BANK_INITIALS[key] || (tarjeta.banco ? tarjeta.banco.slice(0, 2).toUpperCase() : '?');
  return (
    <div style={{
      width: 38, height: 26, borderRadius: 5, flexShrink: 0,
      background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px',
    }}>
      {initials}
    </div>
  );
}

function PanelHeader({ title }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: C.text3,
      textTransform: 'uppercase', letterSpacing: '.06em',
      padding: '12px 14px 8px',
    }}>
      {title}
    </div>
  );
}

function HoverRow({ children, last }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '10px 14px',
        borderBottom: last ? 'none' : `1px solid ${C.border}`,
        background: hov ? C.surface2 : 'transparent',
        transition: 'background .15s',
      }}
    >
      {children}
    </div>
  );
}

function tarjetaForTx(tx, tarjetas) {
  if (tx.tarjeta_id) return tarjetas.find(t => t.id === tx.tarjeta_id);
  return tarjetas.find(t => t.nombre === tx.medio);
}

// Clave que agrupa cuotas de una misma compra
function cuotaGroupKey(tx) {
  return `${tx.desc}|${tx.tarjeta_id ?? tx.medio}|${tx.cuota_total}`;
}

function TxRow({ tx, tarjetas, last, subtitle }) {
  const tj = tarjetaForTx(tx, tarjetas);
  return (
    <HoverRow last={last}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {tj && <MiniCardBadge tarjeta={tj} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tx.desc || tx.cat}
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: tx.type === 'i' ? C.green : C.text }}>
          {fmtMoney(tx.amount, tx.currency || 'ARS')}
        </div>
      </div>
    </HoverRow>
  );
}

function UnifiedMovementsList({ tarjetas, txs }) {
  const currentMonth = dateToMonthId(todayStr());

  const movements = useMemo(() => {
    const tarjetaIds = new Set(tarjetas.map(t => t.id));
    const tarjetaNames = new Set(tarjetas.map(t => t.nombre));
    const cardTxs = txs.filter(t =>
      (t.tarjeta_id && tarjetaIds.has(t.tarjeta_id)) ||
      (t.medio && tarjetaNames.has(t.medio))
    );

    // Para compras en cuotas mostrar solo la cuota del mes actual (o la más reciente pasada)
    const cuotaGroups = {};
    const singles = [];
    for (const tx of cardTxs) {
      if (tx.cuota_total > 1) {
        const key = cuotaGroupKey(tx);
        if (!cuotaGroups[key]) cuotaGroups[key] = [];
        cuotaGroups[key].push(tx);
      } else {
        singles.push(tx);
      }
    }

    const representatives = Object.values(cuotaGroups).map(group => {
      const current = group.find(tx => dateToMonthId(tx.date) === currentMonth);
      if (current) return current;
      return group.filter(tx => tx.date <= todayStr())
        .sort((a, b) => b.date.localeCompare(a.date))[0] || group[0];
    });

    return [...singles, ...representatives]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }, [tarjetas, txs, currentMonth]);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <PanelHeader title="Últimos movimientos" />
      {movements.length === 0 ? (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: C.text3, fontSize: 12 }}>Sin movimientos</div>
      ) : movements.map((tx, i) => {
        const tj = tarjetaForTx(tx, tarjetas);
        const cuotaInfo = tx.cuota_total > 1 ? ` · cuota ${tx.cuota_num}/${tx.cuota_total}` : '';
        return (
          <TxRow
            key={tx.id} tx={tx} tarjetas={tarjetas} last={i === movements.length - 1}
            subtitle={`${tj ? `vía ${tj.nombre} · ` : ''}${fmtDate(tx.date)}${cuotaInfo}`}
          />
        );
      })}
    </div>
  );
}

function UnifiedCuotasList({ tarjetas, txs, onTxsChange }) {
  const today = todayStr();
  const [expandedKey, setExpandedKey] = useState(null);

  const groups = useMemo(() => {
    const tarjetaIds = new Set(tarjetas.map(t => t.id));
    const tarjetaNames = new Set(tarjetas.map(t => t.nombre));
    const pending = txs.filter(t =>
      ((t.tarjeta_id && tarjetaIds.has(t.tarjeta_id)) || (t.medio && tarjetaNames.has(t.medio)))
      && t.cuota_total > 1
      && t.date >= today
    );

    const map = {};
    for (const tx of pending) {
      const key = cuotaGroupKey(tx);
      if (!map[key]) map[key] = [];
      map[key].push(tx);
    }

    return Object.entries(map).map(([key, cuotas]) => ({
      key,
      cuotas: cuotas.sort((a, b) => a.cuota_num - b.cuota_num),
      total: cuotas.reduce((s, t) => s + Math.abs(t.amount), 0),
    })).sort((a, b) => a.cuotas[0].date.localeCompare(b.cuotas[0].date));
  }, [tarjetas, txs, today]);

  const totalRest = groups.reduce((s, g) => s + g.total, 0);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <PanelHeader title={`Cuotas pendientes${groups.length ? ` · ${fmtMoney(totalRest)}` : ''}`} />
      {groups.length === 0 ? (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: C.text3, fontSize: 12 }}>Sin cuotas pendientes</div>
      ) : groups.map((group, gi) => {
        const first = group.cuotas[0];
        const tj = tarjetaForTx(first, tarjetas);
        const isExpanded = expandedKey === group.key;
        const isLast = gi === groups.length - 1;

        return (
          <div key={group.key}>
            {/* Fila principal — click expande */}
            <div
              onClick={() => setExpandedKey(isExpanded ? null : group.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: isLast && !isExpanded ? 'none' : `1px solid ${C.border}`,
                cursor: 'pointer',
                background: isExpanded ? C.surface2 : 'transparent',
                transition: 'background .15s',
              }}
            >
              {tj && <MiniCardBadge tarjeta={tj} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {first.desc || first.cat}
                </div>
                <div style={{ fontSize: 11, color: C.text3 }}>
                  {tj ? `vía ${tj.nombre} · ` : ''}cuota {first.cuota_num}/{first.cuota_total} · {group.cuotas.length} pendiente{group.cuotas.length > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmtMoney(first.amount, first.currency || 'ARS')}</div>
                  <div style={{ fontSize: 10, color: C.text3 }}>total {fmtMoney(group.total)}</div>
                </div>
                <div style={{ fontSize: 12, color: C.text3, transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</div>
              </div>
            </div>

            {/* Cuotas expandidas */}
            {isExpanded && (
              <>
                {group.cuotas.map((tx, ci) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px 8px 36px',
                      borderBottom: `1px solid ${C.border}`,
                      background: C.surface2,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: C.text2 }}>
                        Cuota {tx.cuota_num}/{tx.cuota_total} · {fmtDate(tx.date)}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                      {fmtMoney(tx.amount, tx.currency || 'ARS')}
                    </div>
                  </div>
                ))}
                <div style={{
                  padding: '8px 14px',
                  borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
                  background: C.surface2,
                }}>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`¿Eliminar las ${group.cuotas.length} cuotas pendientes?`)) return;
                      for (const tx of group.cuotas) await deleteTransaction(tx.id);
                      setExpandedKey(null);
                      await onTxsChange();
                    }}
                    style={{
                      width: '100%', padding: '7px 0',
                      background: C.redBg, border: `1px solid ${C.red}40`,
                      borderRadius: 6, color: C.red,
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Eliminar {group.cuotas.length} cuotas
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

export default function ScreenTarjetas({ tarjetas, txs, allMonthIds, onTarjetasChange, onTxsChange }) {
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const mobile = useIsMobile();

  const handleAdd = async (data) => {
    await createTarjeta(data);
    setAddOpen(false);
    await onTarjetasChange();
  };

  const handleEdit = async (data) => {
    await updateTarjeta(selected.id, data);
    setEditOpen(false);
    setSelected(null);
    await onTarjetasChange();
  };

  const handleDelete = async () => {
    await deleteTarjeta(selected.id);
    setSelected(null);
    await onTarjetasChange();
  };

  const addBtn = (
    <button
      onClick={() => setAddOpen(true)}
      style={{
        ...s.btnGhost, width: '100%', padding: '12px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <span style={{ fontSize: 18, color: C.accent }}>+</span> Agregar tarjeta
    </button>
  );

  const cardsColumn = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      alignItems: mobile ? 'center' : 'stretch',
      flexShrink: 0,
      width: mobile ? '100%' : 340,
    }}>
      {tarjetas.map(t => (
        <TarjetaCard key={t.id} tarjeta={t} onClick={() => setSelected(t)} />
      ))}
      {addBtn}
    </div>
  );

  const listsColumn = (
    <div style={{
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <UnifiedMovementsList tarjetas={tarjetas} txs={txs} />
      <UnifiedCuotasList tarjetas={tarjetas} txs={txs} onTxsChange={onTxsChange} />
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      {tarjetas.length === 0 ? (
        <>
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.text3, fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
            <div>No hay tarjetas registradas</div>
          </div>
          <div style={{ maxWidth: 400, margin: '0 auto' }}>{addBtn}</div>
        </>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: mobile ? 'column' : 'row',
          gap: 20,
          alignItems: 'flex-start',
        }}>
          {cardsColumn}
          {listsColumn}
        </div>
      )}

      <div style={{ height: 40 }} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nueva tarjeta">
        <TarjetaForm onSave={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>

      <Modal open={!!selected && !editOpen} onClose={() => setSelected(null)} title={selected?.nombre}>
        {selected && (
          <TarjetaDetail
            tarjeta={selected}
            txs={txs}
            allMonthIds={allMonthIds}
            onEdit={() => setEditOpen(true)}
            onDelete={handleDelete}
            onClose={() => setSelected(null)}
          />
        )}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar tarjeta">
        {selected && (
          <TarjetaForm
            initial={selected}
            onSave={handleEdit}
            onCancel={() => setEditOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
