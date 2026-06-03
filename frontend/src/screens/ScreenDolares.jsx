import React, { useEffect, useMemo, useState } from 'react';
import { C, s } from '../theme.js';
import { fmtARS, fmtUSD, todayStr } from '../utils/format.js';
import { useHideAmounts } from '../HideAmountsContext.jsx';
import FAB from '../components/FAB.jsx';
import Modal from '../components/Modal.jsx';
import Divider from '../components/Divider.jsx';
import { createDollarOp, deleteDollarOp, getQuotes } from '../api/dollar.js';

const USD_COLOR = '#10b981';

const KINDS = [
  { id: 'ingreso', label: 'Ingreso' },
  { id: 'compra',  label: 'Compra' },
  { id: 'venta',   label: 'Venta' },
  { id: 'retiro',  label: 'Retiro' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map(k => [k.id, k.label]));
// ingreso/compra suman dólares al baúl; venta/retiro restan.
const ADDS_USD = { ingreso: true, compra: true, venta: false, retiro: false };

// Costo promedio móvil con dos pools: comprado (con costo) y libre (ingresos, costo 0).
// Las ventas/retiros consumen primero del pool comprado, luego del libre.
function computeStats(ops) {
  const sorted = [...ops].sort((a, b) =>
    a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date)
  );
  let purchasedUsd = 0, purchasedCostArs = 0, freeUsd = 0, realizedPnl = 0;
  for (const op of sorted) {
    if (op.kind === 'compra') {
      purchasedUsd += op.usd;
      purchasedCostArs += op.usd * (op.rate || 0);
    } else if (op.kind === 'ingreso') {
      freeUsd += op.usd;
    } else { // venta | retiro
      const avg = purchasedUsd > 0 ? purchasedCostArs / purchasedUsd : 0;
      const fromP = Math.min(op.usd, purchasedUsd);
      const fromF = op.usd - fromP;
      purchasedUsd -= fromP;
      purchasedCostArs -= fromP * avg;
      freeUsd = Math.max(0, freeUsd - fromF);
      if (op.kind === 'venta') {
        realizedPnl += fromP * ((op.rate || 0) - avg) + fromF * (op.rate || 0);
      }
    }
  }
  const holdingUsd = purchasedUsd + freeUsd;
  const avgCompra = purchasedUsd > 0 ? purchasedCostArs / purchasedUsd : null;
  return { holdingUsd, purchasedUsd, freeUsd, avgCompra, realizedPnl };
}

function PnlValue({ value, hidden }) {
  if (value === null || value === undefined || isNaN(value)) {
    return <span style={{ color: C.text3 }}>—</span>;
  }
  const color = value >= 0 ? C.green : C.red;
  return (
    <span style={{ color, fontWeight: 700 }}>
      {hidden ? '••••' : fmtARS(value, true)}
    </span>
  );
}

function Stat({ label, children }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ ...s.label, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: C.text }}>{children}</div>
    </div>
  );
}

export default function ScreenDolares({ cats, mediums, tarjetas, dollarOps, onOpsChange, onTxsChange }) {
  const { hidden } = useHideAmounts();
  const [quotes, setQuotes] = useState(null);
  const [quotesErr, setQuotesErr] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOp, setDetailOp] = useState(null);

  useEffect(() => {
    let alive = true;
    getQuotes()
      .then(q => { if (alive) { setQuotes(q); setQuotesErr(false); } })
      .catch(() => { if (alive) setQuotesErr(true); });
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => computeStats(dollarOps || []), [dollarOps]);
  const { holdingUsd, avgCompra, realizedPnl } = stats;

  const oficialRate = quotes?.oficial?.venta ?? null;
  const criptoRate = quotes?.cripto?.venta ?? null;

  const valorOficial = oficialRate != null ? holdingUsd * oficialRate : null;
  const valorCripto = criptoRate != null ? holdingUsd * criptoRate : null;

  const unrealizedPnl = useMemo(() => {
    if (oficialRate == null) return null;
    const term1 = stats.purchasedUsd > 0 && avgCompra != null
      ? stats.purchasedUsd * (oficialRate - avgCompra) : 0;
    const term2 = stats.freeUsd * oficialRate;
    return term1 + term2;
  }, [oficialRate, avgCompra, stats]);

  const grouped = useMemo(() => {
    const sorted = [...(dollarOps || [])].sort((a, b) =>
      a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)
    );
    const byDate = {};
    sorted.forEach(op => { (byDate[op.date] = byDate[op.date] || []).push(op); });
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  }, [dollarOps]);

  const handleCreate = async (payload) => {
    await createDollarOp(payload);
    setModalOpen(false);
    await onOpsChange();
    await onTxsChange();
  };

  const handleDelete = async (op) => {
    if (!window.confirm('¿Eliminar esta operación? También se borrará el movimiento en pesos asociado.')) return;
    await deleteDollarOp(op.id);
    setDetailOp(null);
    await onOpsChange();
    await onTxsChange();
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      {/* Header de valuación */}
      <div style={{ ...s.card({ padding: '20px 18px', marginBottom: 16 }) }}>
        <div style={{ ...s.label, marginBottom: 6 }}>Tenencia</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: USD_COLOR, marginBottom: 10 }}>
          {hidden ? '••••' : fmtUSD(holdingUsd)}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
          {valorOficial != null ? (hidden ? '••••' : fmtARS(valorOficial)) : '—'}
          <span style={{ fontSize: 12, color: C.text2, fontWeight: 500, marginLeft: 8 }}>oficial</span>
        </div>
        <div style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>
          {valorCripto != null ? (hidden ? '••••' : fmtARS(valorCripto)) : '—'}
          <span style={{ fontSize: 11, color: C.text3, marginLeft: 6 }}>cripto</span>
        </div>
        {quotesErr && (
          <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>Cotización no disponible</div>
        )}
        {quotes?.stale && (
          <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>Cotización (cacheada)</div>
        )}
      </div>

      {/* Stats: promedio + G/P */}
      <div style={{ ...s.card({ padding: '16px 18px', marginBottom: 16 }), display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Stat label="Precio prom. compra">
          {avgCompra != null ? (hidden ? '••••' : fmtARS(avgCompra)) : <span style={{ color: C.text3 }}>—</span>}
        </Stat>
        <Stat label="G/P realizada"><PnlValue value={realizedPnl} hidden={hidden} /></Stat>
        <Stat label="G/P no realizada"><PnlValue value={unrealizedPnl} hidden={hidden} /></Stat>
      </div>

      {/* Lista de operaciones */}
      {grouped.length > 0 ? (
        <div style={{ ...s.card({ padding: '4px 14px' }) }}>
          {grouped.map(([date, dayOps], gi) => (
            <React.Fragment key={date}>
              {gi > 0 && <Divider />}
              <div style={{ ...s.label, padding: '10px 0 4px' }}>
                {new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
              </div>
              {dayOps.map(op => {
                const adds = ADDS_USD[op.kind];
                return (
                  <div
                    key={op.id}
                    onClick={() => setDetailOp(op)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 4px', cursor: 'pointer',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>
                        {KIND_LABEL[op.kind]}
                        {op.desc ? <span style={{ color: C.text2, fontWeight: 400 }}> · {op.desc}</span> : null}
                      </div>
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
                        {op.rate != null && `@ ${fmtARS(op.rate)}`}
                        {op.tx_amount != null && (
                          <span>{op.rate != null ? ' · ' : ''}{op.tx_currency === 'USD' ? fmtUSD(op.tx_amount) : fmtARS(op.tx_amount)}{op.tx_cat ? ` · ${op.tx_cat}` : ''}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: adds ? C.green : C.red, flexShrink: 0 }}>
                      {adds ? '+' : '−'}{hidden ? '••••' : fmtUSD(op.usd)}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div style={{ ...s.card({ padding: '32px', textAlign: 'center' }), color: C.text3, fontSize: 14 }}>
          Sin operaciones todavía
        </div>
      )}

      <div style={{ height: 80 }} />

      <FAB onClick={() => setModalOpen(true)} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva operación">
        <DollarOpForm
          cats={cats}
          mediums={mediums}
          holdingUsd={holdingUsd}
          oficialRate={oficialRate}
          onSave={handleCreate}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <Modal open={!!detailOp} onClose={() => setDetailOp(null)} title="Operación">
        {detailOp && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <DetailRow label="Tipo" value={KIND_LABEL[detailOp.kind]} />
              <DetailRow label="Dólares" value={fmtUSD(detailOp.usd)} />
              {detailOp.rate != null && <DetailRow label="Cotización" value={fmtARS(detailOp.rate)} />}
              {detailOp.tx_amount != null && (
                <DetailRow label="Movimiento" value={`${detailOp.tx_currency === 'USD' ? fmtUSD(detailOp.tx_amount) : fmtARS(detailOp.tx_amount)}${detailOp.tx_cat ? ` · ${detailOp.tx_cat}` : ''}`} />
              )}
              {detailOp.desc && <DetailRow label="Descripción" value={detailOp.desc} />}
              <DetailRow label="Fecha" value={new Date(detailOp.date + 'T12:00:00').toLocaleDateString('es-AR')} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnGhost, flex: 1 }} onClick={() => setDetailOp(null)}>Cerrar</button>
              <button
                style={{ ...s.btnPrimary, flex: 1, background: C.red }}
                onClick={() => handleDelete(detailOp)}
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: C.text2 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function DollarOpForm({ cats, mediums, holdingUsd, oficialRate, onSave, onCancel }) {
  const [kind, setKind] = useState('compra');
  const [usd, setUsd] = useState('');
  const [rate, setRate] = useState('');
  const [total, setTotal] = useState('');
  const [rateMode, setRateMode] = useState('rate'); // 'rate' = cotización | 'total' = monto en pesos
  const [date, setDate] = useState(todayStr());
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');
  const [medio, setMedio] = useState(mediums[0]?.name || '');
  const [err, setErr] = useState('');

  const needsRate = kind === 'compra' || kind === 'venta';
  const needsLeg = kind !== 'ingreso'; // compra/venta/retiro tienen pata + categoría
  const reducesUsd = kind === 'venta' || kind === 'retiro';

  // El teclado de iOS en español usa coma como separador decimal; la aceptamos
  // y la normalizamos a punto para parseFloat (sino se pierden los centavos).
  const onlyDecimal = (v) => v.replace(/[^0-9.,]/g, '');
  const parseDec = (v) => parseFloat(String(v ?? '').replace(',', '.'));

  // Categorías según el tipo: venta = ingreso en pesos; compra/retiro = gasto.
  const catOptions = kind === 'venta' ? cats.ingresos : cats.gastos;

  // Autocompletar la cotización oficial al elegir compra/venta (editable).
  useEffect(() => {
    if (needsRate && rateMode === 'rate' && !rate && oficialRate != null) {
      setRate(String(Math.round(oficialRate)));
    }
  }, [kind, rateMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    setErr('');
    const usdNum = parseDec(usd);
    if (!usdNum || usdNum <= 0) { setErr('Ingresá una cantidad de dólares válida'); return; }
    if (reducesUsd && usdNum > holdingUsd + 1e-9) {
      setErr(`No tenés tantos dólares (tenencia: ${fmtUSD(holdingUsd)})`); return;
    }
    let rateNum = null;
    if (needsRate) {
      if (rateMode === 'total') {
        const totalNum = parseDec(total);
        if (!totalNum || totalNum <= 0) { setErr('Ingresá el monto total'); return; }
        rateNum = totalNum / usdNum; // calculamos la cotización sola
      } else {
        rateNum = parseDec(rate);
        if (!rateNum || rateNum <= 0) { setErr('Ingresá la cotización'); return; }
      }
    }
    if (needsLeg && !cat) { setErr('Elegí una categoría'); return; }

    onSave({
      kind,
      usd: usdNum,
      rate: rateNum,
      date,
      desc,
      cat: needsLeg ? cat : null,
      medio: needsLeg ? medio : '',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Selector de operación */}
      <div style={{ display: 'flex', gap: 6 }}>
        {KINDS.map(k => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              border: `1px solid ${kind === k.id ? USD_COLOR : C.border}`,
              background: kind === k.id ? USD_COLOR : 'transparent',
              color: kind === k.id ? '#fff' : C.text2,
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Dólares (USD)</div>
        <input
          type="text" inputMode="decimal" value={usd}
          onChange={e => setUsd(onlyDecimal(e.target.value))} style={s.input} placeholder="0,00" autoFocus
        />
        {reducesUsd && (
          <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
            Disponible: {fmtUSD(holdingUsd)}
          </div>
        )}
      </div>

      {needsRate && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {[['rate', 'Cotización'], ['total', 'Monto total']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setRateMode(m)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  border: `1px solid ${rateMode === m ? USD_COLOR : C.border}`,
                  background: rateMode === m ? C.surface2 : 'transparent',
                  color: rateMode === m ? C.text : C.text2,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {rateMode === 'rate' ? (
            <>
              <div style={{ ...s.label, marginBottom: 6 }}>Cotización (ARS por USD)</div>
              <input
                type="text" inputMode="decimal" value={rate}
                onChange={e => setRate(onlyDecimal(e.target.value))} style={s.input} placeholder="0"
              />
              {usd && rate && (
                <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                  {kind === 'compra' ? 'Pagás' : 'Recibís'} {fmtARS(parseDec(usd) * parseDec(rate))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ ...s.label, marginBottom: 6 }}>
                {kind === 'compra' ? 'Monto que pagaste (ARS)' : 'Monto que recibiste (ARS)'}
              </div>
              <input
                type="text" inputMode="decimal" value={total}
                onChange={e => setTotal(onlyDecimal(e.target.value))} style={s.input} placeholder="0"
              />
              {usd && total && parseDec(usd) > 0 && (
                <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                  Cotización: {fmtARS(parseDec(total) / parseDec(usd))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {needsLeg && (
        <>
          <div>
            <div style={{ ...s.label, marginBottom: 6 }}>
              Categoría {kind === 'venta' ? '(ingreso en pesos)' : kind === 'retiro' ? '(gasto en dólares)' : '(gasto en pesos)'}
            </div>
            <select value={cat} onChange={e => setCat(e.target.value)} style={s.select}>
              <option value="">Elegir…</option>
              {(catOptions || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ ...s.label, marginBottom: 6 }}>Medio</div>
            <select value={medio} onChange={e => setMedio(e.target.value)} style={s.select}>
              <option value="">—</option>
              {mediums.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
        </>
      )}

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Fecha</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={s.input} />
      </div>

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Descripción</div>
        <input value={desc} onChange={e => setDesc(e.target.value)} style={s.input} placeholder="Opcional" />
      </div>

      {err && <div style={{ fontSize: 12, color: C.red }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button style={{ ...s.btnGhost, flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button style={{ ...s.btnPrimary, flex: 1 }} onClick={submit}>Guardar</button>
      </div>
    </div>
  );
}
