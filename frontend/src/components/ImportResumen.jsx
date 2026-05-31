import React, { useState, useMemo, useRef } from 'react';
import { C, s } from '../theme.js';
import { fmtMoney, fmtDate } from '../utils/format.js';
import { extractStatement, confirmStatement } from '../api/importStatements.js';

// REQUIREMENT: pantalla de revisión — subir PDF, elegir tarjeta, revisar
// movimientos, editar categoría/cotización y recién al aprobar crear las txs.
export default function ImportResumen({ tarjetas, cats, onClose, onTxsChange }) {
  const [tarjetaId, setTarjetaId] = useState(tarjetas[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [rows, setRows] = useState(null);   // null = todavía no se extrajo
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const catNames = useMemo(() => (cats?.gastos || []).map(c => c.name), [cats]);

  const handlePick = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';            // permite re-elegir el mismo archivo
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const data = await extractStatement(file, tarjetaId);
      // UX: las filas ya importadas vienen desmarcadas; el resto marcadas.
      const prepared = (data.rows || []).map(r => ({
        ...r,
        include: !r.duplicate,
        rate: '',
      }));
      setPeriodo(data.periodo || null);
      setRows(prepared);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Error al leer el PDF');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (i, patch) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const arsOf = (r) => {
    if (r.currency !== 'USD') return r.amount;
    const rate = parseFloat(r.rate);
    return rate > 0 ? r.amount * rate : null;
  };

  const selected = useMemo(() => (rows || []).filter(r => r.include), [rows]);
  const missingRate = selected.some(r => r.currency === 'USD' && !(arsOf(r) > 0));

  const handleApprove = async () => {
    if (selected.length === 0 || missingRate) return;
    setError(null);
    setLoading(true);
    try {
      const payload = selected.map(r => {
        const ars = arsOf(r);
        const desc = r.currency === 'USD' ? `${r.desc} (US$ ${r.amount})` : r.desc;
        return {
          date: r.date,
          desc,
          amount: ars,
          cat: r.cat || 'Otros',
          cuota_num: r.cuota_num ?? null,
          cuota_total: r.cuota_total ?? null,
          origin_ref: r.origin_ref,
        };
      });
      const res = await confirmStatement(tarjetaId, payload);
      setResult(res);
      await onTxsChange?.();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Error al crear las transacciones');
    } finally {
      setLoading(false);
    }
  };

  const headerBtn = (
    <button onClick={onClose} style={s.btnGhost}>← Volver</button>
  );

  // ── Resultado final ───────────────────────────────────────
  if (result) {
    return (
      <Shell title="Importar resumen" right={headerBtn}>
        <div style={{ ...s.card({ padding: 24, textAlign: 'center' }) }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>
            {result.created} transacc{result.created === 1 ? 'ión creada' : 'iones creadas'}
          </div>
          {result.skipped > 0 && (
            <div style={{ fontSize: 13, color: C.text3, marginTop: 4 }}>
              {result.skipped} omitida{result.skipped === 1 ? '' : 's'} (ya estaban importadas)
            </div>
          )}
          <button onClick={onClose} style={{ ...s.btnPrimary, marginTop: 20 }}>Listo</button>
        </div>
      </Shell>
    );
  }

  // ── Paso 1: elegir tarjeta + PDF ──────────────────────────
  if (!rows) {
    return (
      <Shell title="Importar resumen" right={headerBtn}>
        <div style={{ ...s.card({ padding: 16 }) }}>
          <label style={{ ...s.label, display: 'block', marginBottom: 6 }}>Tarjeta</label>
          <select
            value={tarjetaId}
            onChange={e => setTarjetaId(Number(e.target.value))}
            style={{ ...s.select, marginBottom: 16 }}
          >
            {tarjetas.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre}{t.banco ? ` · ${t.banco}` : ''}
              </option>
            ))}
          </select>

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <button onClick={handlePick} disabled={loading || !tarjetaId} style={{ ...s.btnPrimary, width: '100%' }}>
            {loading ? 'Leyendo el resumen…' : 'Elegir PDF'}
          </button>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 10 }}>
            Subí el resumen de Mercado Pago o Ualá. Vas a poder revisar todo antes de crear nada.
          </div>
          {error && <ErrorBox msg={error} />}
        </div>
      </Shell>
    );
  }

  // ── Paso 2: revisión ──────────────────────────────────────
  return (
    <Shell
      title={`Revisar movimientos${periodo ? ` · ${periodo}` : ''}`}
      right={headerBtn}
    >
      {rows.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.text3, fontSize: 14 }}>
          No se encontraron movimientos en el PDF
        </div>
      )}

      {rows.map((r, i) => {
        const ars = arsOf(r);
        const isUSD = r.currency === 'USD';
        const opts = catNames.includes(r.cat) ? catNames : [r.cat, ...catNames];
        return (
          <div
            key={r.origin_ref + i}
            style={{
              ...s.card({ padding: 12, marginBottom: 8 }),
              opacity: r.include ? 1 : 0.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={r.include}
                onChange={e => updateRow(i, { include: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: C.accent, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.desc || r.cat}
                </div>
                <div style={{ fontSize: 11, color: C.text3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{fmtDate(r.date)}</span>
                  {r.cuota_num && r.cuota_total && (
                    <span style={{ color: C.accent, background: C.accentBg, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      {r.cuota_num}/{r.cuota_total}
                    </span>
                  )}
                  {r.duplicate && (
                    <span style={{ color: C.text2, background: C.surface2, padding: '1px 5px', borderRadius: 4 }}>
                      ya importado
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                  {isUSD ? `US$ ${r.amount}` : fmtMoney(r.amount)}
                </div>
                {isUSD && (
                  <div style={{ fontSize: 11, color: ars > 0 ? C.green : C.text3 }}>
                    {ars > 0 ? `= ${fmtMoney(ars)}` : 'falta cotización'}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <select
                value={r.cat}
                onChange={e => updateRow(i, { cat: e.target.value })}
                style={{ ...s.select, flex: 1, padding: '6px 8px', fontSize: 13 }}
              >
                {opts.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              {isUSD && (
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Cotización $"
                  value={r.rate}
                  onChange={e => updateRow(i, { rate: e.target.value })}
                  style={{ ...s.input, width: 120, padding: '6px 8px', fontSize: 13 }}
                />
              )}
            </div>
          </div>
        );
      })}

      {error && <ErrorBox msg={error} />}

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, paddingBottom: 24 }}>
          <button onClick={onClose} style={s.btnGhost}>Cancelar</button>
          <div style={{ flex: 1 }} />
          {missingRate && (
            <span style={{ fontSize: 12, color: C.red }}>Falta cotización en alguna fila USD</span>
          )}
          <button
            onClick={handleApprove}
            disabled={loading || selected.length === 0 || missingRate}
            style={{ ...s.btnPrimary, opacity: (loading || selected.length === 0 || missingRate) ? 0.5 : 1 }}
          >
            {loading ? 'Creando…' : `Aprobar y crear (${selected.length})`}
          </button>
        </div>
      )}
    </Shell>
  );
}

// ── helpers de layout ────────────────────────────────────────
function Shell({ title, right, children }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h1 style={{ ...s.h1, margin: 0, fontSize: 20 }}>{title}</h1>
          {right}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>{children}</div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ marginTop: 12, padding: '10px 12px', background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, color: C.red, fontSize: 13 }}>
      {msg}
    </div>
  );
}
