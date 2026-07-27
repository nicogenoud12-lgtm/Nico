import React, { useEffect, useMemo, useState } from 'react';
import { C, s } from '../theme.js';
import { fmtARS, todayStr } from '../utils/format.js';
import { useHideAmounts } from '../HideAmountsContext.jsx';
import FAB from '../components/FAB.jsx';
import Modal from '../components/Modal.jsx';
import Divider from '../components/Divider.jsx';
import {
  createVenta, updateVenta, deleteVenta,
  createVentaPago, deleteVentaPago,
} from '../api/ventas.js';

// Amarillo pastel para los pendientes (por cobrar / por pagar).
const PENDIENTE = '#fde68a';

// Tipos de pago dentro de una venta.
const TIPOS = [
  { id: 'cobro',  label: 'Cobro',  color: C.green, hint: 'Crea un ingreso en Movimientos' },
  { id: 'pago',   label: 'Pago',   color: C.red,   hint: 'Crea un egreso en Movimientos' },
  { id: 'ajuste', label: 'Ajuste', color: C.text2, hint: 'No genera movimiento (descuentos, casos especiales)' },
];
const TIPO_MAP = Object.fromEntries(TIPOS.map(t => [t.id, t]));

// El teclado en español usa coma como separador decimal; la normalizamos a punto.
const onlyDecimal = (v) => v.replace(/[^0-9.,]/g, '');
const parseDec = (v) => parseFloat(String(v ?? '').replace(',', '.'));

function money(n, hidden) {
  return hidden ? '••••' : fmtARS(n);
}

function Stat({ label, children, color }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ ...s.label, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || C.text }}>{children}</div>
    </div>
  );
}

export default function ScreenVentas({ mediums, ventas, onVentasChange, onTxsChange }) {
  const { hidden } = useHideAmounts();
  const [createOpen, setCreateOpen] = useState(false);
  const [editVenta, setEditVenta] = useState(null);
  const [detailVenta, setDetailVenta] = useState(null);
  const [pagoOpen, setPagoOpen] = useState(false);

  // Mantener el detalle sincronizado cuando se recarga la lista de ventas.
  useEffect(() => {
    if (!detailVenta) return;
    const fresh = (ventas || []).find(v => v.id === detailVenta.id);
    setDetailVenta(fresh || null);
  }, [ventas]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const list = ventas || [];
    return {
      vendido: list.reduce((s, v) => s + (v.total_venta || 0), 0),
      cobrado: list.reduce((s, v) => s + (v.cobrado || 0), 0),
      pagado: list.reduce((s, v) => s + (v.pagado || 0), 0),
      ganancia: list.reduce((s, v) => s + (v.ganancia || 0), 0),
      porCobrar: list.reduce((s, v) => s + Math.max(0, v.saldo_cliente || 0), 0),
      // Sólo cuenta las ventas con costo de fábrica cargado (sin costo no se sabe cuánto falta).
      porPagar: list.reduce((s, v) => (
        v.costo_fabrica != null ? s + Math.max(0, v.costo_fabrica - (v.pagado || 0)) : s
      ), 0),
    };
  }, [ventas]);

  const reload = async () => {
    await onVentasChange();
    await onTxsChange();
  };

  const handleSaveVenta = async (payload, id) => {
    if (id) await updateVenta(id, payload);
    else await createVenta(payload);
    setCreateOpen(false);
    setEditVenta(null);
    await reload();
  };

  const handleDeleteVenta = async (v) => {
    if (!window.confirm('¿Eliminar esta venta? Se borrarán también sus movimientos (ingresos/egresos) asociados.')) return;
    await deleteVenta(v.id);
    setDetailVenta(null);
    await reload();
  };

  const handleAddPago = async (pago) => {
    await createVentaPago(detailVenta.id, pago);
    setPagoOpen(false);
    await reload();
  };

  const handleDeletePago = async (pago) => {
    const extra = pago.tipo === 'ajuste' ? '' : ' Se borrará también el movimiento asociado.';
    if (!window.confirm(`¿Eliminar este ${TIPO_MAP[pago.tipo]?.label.toLowerCase() || 'pago'}?${extra}`)) return;
    await deleteVentaPago(detailVenta.id, pago.id);
    await reload();
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      {/* Resumen general */}
      <div style={{ ...s.card({ padding: '16px 18px', marginBottom: 16 }) }}>
        <div style={{ ...s.label, marginBottom: 6 }}>Ganancia total</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: totals.ganancia >= 0 ? C.green : C.red, marginBottom: 14 }}>
          {money(totals.ganancia, hidden)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <Stat label="Vendido">{money(totals.vendido, hidden)}</Stat>
          <Stat label="Cobrado" color={C.green}>{money(totals.cobrado, hidden)}</Stat>
          <Stat label="Pagado" color={C.red}>{money(totals.pagado, hidden)}</Stat>
          <Stat label="Por cobrar" color={PENDIENTE}>{money(totals.porCobrar, hidden)}</Stat>
          <Stat label="Por pagar" color={PENDIENTE}>{money(totals.porPagar, hidden)}</Stat>
        </div>
      </div>

      {/* Lista de ventas */}
      {(ventas || []).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ventas.map(v => (
            <VentaCard key={v.id} venta={v} hidden={hidden} onClick={() => setDetailVenta(v)} />
          ))}
        </div>
      ) : (
        <div style={{ ...s.card({ padding: '32px', textAlign: 'center' }), color: C.text3, fontSize: 14 }}>
          Sin ventas todavía
        </div>
      )}

      <div style={{ height: 80 }} />

      <FAB onClick={() => { setEditVenta(null); setCreateOpen(true); }} />

      {/* Crear / editar venta */}
      <Modal
        open={createOpen || !!editVenta}
        onClose={() => { setCreateOpen(false); setEditVenta(null); }}
        title={editVenta ? 'Editar venta' : 'Nueva venta'}
      >
        <VentaForm
          venta={editVenta}
          onSave={handleSaveVenta}
          onCancel={() => { setCreateOpen(false); setEditVenta(null); }}
        />
      </Modal>

      {/* Detalle de una venta */}
      <Modal open={!!detailVenta} onClose={() => setDetailVenta(null)} title={detailVenta?.cliente || 'Venta'}>
        {detailVenta && (
          <VentaDetail
            venta={detailVenta}
            hidden={hidden}
            onAddPago={() => setPagoOpen(true)}
            onDeletePago={handleDeletePago}
            onEdit={() => { const v = detailVenta; setDetailVenta(null); setEditVenta(v); }}
            onDelete={() => handleDeleteVenta(detailVenta)}
          />
        )}
      </Modal>

      {/* Agregar pago */}
      <Modal open={pagoOpen} onClose={() => setPagoOpen(false)} title="Agregar pago">
        <PagoForm
          mediums={mediums}
          onSave={handleAddPago}
          onCancel={() => setPagoOpen(false)}
        />
      </Modal>
    </div>
  );
}

function VentaCard({ venta, hidden, onClick }) {
  const total = venta.total_venta || 0;
  const cobrado = venta.cobrado || 0;
  const pct = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;
  const saldado = total > 0 && cobrado >= total - 1e-6;
  return (
    <div onClick={onClick} style={{ ...s.card({ padding: '14px 16px' }), cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
          {venta.cliente || 'Venta'}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{money(total, hidden)}</span>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 10 }}>
        {new Date(venta.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      {/* Barra cobrado / total */}
      <div style={{ height: 6, background: C.surface2, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: saldado ? C.green : C.accent }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: C.text2 }}>
          Cobrado <span style={{ color: C.green, fontWeight: 600 }}>{money(cobrado, hidden)}</span>
          {total > 0 && <span style={{ color: C.text3 }}> · {pct}%</span>}
        </span>
        <span style={{ color: C.text2 }}>
          Ganancia <span style={{ color: (venta.ganancia || 0) >= 0 ? C.green : C.red, fontWeight: 600 }}>{money(venta.ganancia, hidden)}</span>
        </span>
      </div>
    </div>
  );
}

function DetailRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: C.text2 }}>{label}</span>
      <span style={{ fontSize: 13, color: color || C.text, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function VentaDetail({ venta, hidden, onAddPago, onDeletePago, onEdit, onDelete }) {
  const items = venta.items || [];
  const costo = venta.costo_fabrica;
  const faltaPagar = costo != null ? costo - (venta.pagado || 0) : null;
  const gananciaProy = costo != null ? (venta.total_venta || 0) - costo : null;

  return (
    <div>
      {/* Ítems */}
      {items.length > 0 && (
        <div style={{ ...s.card({ padding: '10px 14px', marginBottom: 14 }) }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 13 }}>
              <span style={{ color: C.text }}>
                {it.nombre || '—'}
                {(it.cantidad || 1) !== 1 && <span style={{ color: C.text3 }}> ×{it.cantidad}</span>}
              </span>
              <span style={{ color: C.text2 }}>{money((it.cantidad || 0) * (it.precio || 0), hidden)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Resumen de la venta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <DetailRow label="Total venta" value={money(venta.total_venta, hidden)} />
        <DetailRow label="Cobrado" value={money(venta.cobrado, hidden)} color={C.green} />
        <DetailRow label="Pagado a fábrica" value={money(venta.pagado, hidden)} color={C.red} />
        <DetailRow label="Por cobrar" value={money(Math.max(0, venta.saldo_cliente || 0), hidden)} color={PENDIENTE} />
        {faltaPagar != null && (
          <DetailRow label="Por pagar" value={money(Math.max(0, faltaPagar), hidden)} color={PENDIENTE} />
        )}
        <Divider />
        <DetailRow
          label="Ganancia realizada"
          value={money(venta.ganancia, hidden)}
          color={(venta.ganancia || 0) >= 0 ? C.green : C.red}
        />
        {gananciaProy != null && (
          <DetailRow
            label="Ganancia proyectada"
            value={money(gananciaProy, hidden)}
            color={gananciaProy >= 0 ? C.green : C.red}
          />
        )}
      </div>

      {/* Libro de pagos */}
      <div style={{ ...s.label, marginBottom: 8 }}>Pagos</div>
      {(venta.pagos || []).length > 0 ? (
        <div style={{ ...s.card({ padding: '4px 14px', marginBottom: 14 }) }}>
          {venta.pagos.map((p, i) => {
            const tipo = TIPO_MAP[p.tipo] || TIPOS[0];
            return (
              <React.Fragment key={p.id}>
                {i > 0 && <Divider />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                    color: tipo.color, border: `1px solid ${tipo.color}`, borderRadius: 5,
                    padding: '2px 6px', flexShrink: 0,
                  }}>
                    {tipo.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text }}>
                      {new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      {p.desc ? <span style={{ color: C.text2 }}> · {p.desc}</span> : null}
                      {p.medio ? <span style={{ color: C.text3 }}> · {p.medio}</span> : null}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tipo.color, flexShrink: 0 }}>
                    {money(p.monto, hidden)}
                  </span>
                  <button
                    onClick={() => onDeletePago(p)}
                    style={{ ...s.btnIcon, color: C.text3, flexShrink: 0 }}
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: C.text3, marginBottom: 14 }}>Sin pagos todavía</div>
      )}

      <button style={{ ...s.btnPrimary, width: '100%', marginBottom: 14 }} onClick={onAddPago}>
        + Agregar pago
      </button>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...s.btnGhost, flex: 1 }} onClick={onEdit}>Editar venta</button>
        <button style={{ ...s.btnPrimary, flex: 1, background: C.red }} onClick={onDelete}>Eliminar</button>
      </div>
    </div>
  );
}

function VentaForm({ venta, onSave, onCancel }) {
  const [cliente, setCliente] = useState(venta?.cliente || '');
  const [fecha, setFecha] = useState(venta?.fecha || todayStr());
  const [items, setItems] = useState(
    venta?.items?.length
      ? venta.items.map(it => ({ nombre: it.nombre || '', cantidad: String(it.cantidad ?? 1), precio: String(it.precio ?? '') }))
      : [{ nombre: '', cantidad: '1', precio: '' }]
  );
  const [costo, setCosto] = useState(venta?.costo_fabrica != null ? String(venta.costo_fabrica) : '');
  const [notas, setNotas] = useState(venta?.notas || '');
  const [err, setErr] = useState('');

  const setItem = (i, key, val) => {
    setItems(items.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  };
  const addItem = () => setItems([...items, { nombre: '', cantidad: '1', precio: '' }]);
  const removeItem = (i) => setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : items);

  const total = items.reduce((s, it) => s + (parseDec(it.cantidad) || 0) * (parseDec(it.precio) || 0), 0);

  const submit = () => {
    setErr('');
    const cleanItems = items
      .map(it => ({
        nombre: it.nombre.trim(),
        cantidad: parseDec(it.cantidad) || 0,
        precio: parseDec(it.precio) || 0,
      }))
      .filter(it => it.nombre || it.precio);
    if (!cliente.trim()) { setErr('Poné un nombre de cliente'); return; }
    if (cleanItems.length === 0) { setErr('Agregá al menos un mueble'); return; }
    onSave({
      cliente: cliente.trim(),
      fecha,
      items: cleanItems,
      costo_fabrica: costo.trim() ? (parseDec(costo) || 0) : null,
      notas: notas.trim(),
    }, venta?.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Cliente</div>
        <input value={cliente} onChange={e => setCliente(e.target.value)} style={s.input} placeholder="Ej. Mendi" autoFocus />
      </div>

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Fecha</div>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={s.input} />
      </div>

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Muebles</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={it.nombre} onChange={e => setItem(i, 'nombre', e.target.value)}
                style={{ ...s.input, flex: 1 }} placeholder="Mueble"
              />
              <input
                type="text" inputMode="decimal" value={it.cantidad}
                onChange={e => setItem(i, 'cantidad', onlyDecimal(e.target.value))}
                style={{ ...s.input, width: 48, textAlign: 'center', padding: '10px 4px' }} placeholder="1" title="Cantidad"
              />
              <input
                type="text" inputMode="decimal" value={it.precio}
                onChange={e => setItem(i, 'precio', onlyDecimal(e.target.value))}
                style={{ ...s.input, width: 96 }} placeholder="Precio"
              />
              <button onClick={() => removeItem(i)} style={{ ...s.btnIcon, fontSize: 18 }} title="Quitar">×</button>
            </div>
          ))}
        </div>
        <button onClick={addItem} style={{ ...s.btnGhost, marginTop: 8 }}>+ Agregar mueble</button>
        <div style={{ fontSize: 13, color: C.text2, marginTop: 8, textAlign: 'right' }}>
          Total: <span style={{ color: C.text, fontWeight: 700 }}>{fmtARS(total)}</span>
        </div>
      </div>

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Costo de fábrica (opcional)</div>
        <input
          type="text" inputMode="decimal" value={costo}
          onChange={e => setCosto(onlyDecimal(e.target.value))} style={s.input} placeholder="Lo que pensás pagar a fábrica"
        />
      </div>

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Notas (opcional)</div>
        <input value={notas} onChange={e => setNotas(e.target.value)} style={s.input} placeholder="Opcional" />
      </div>

      {err && <div style={{ fontSize: 12, color: C.red }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button style={{ ...s.btnGhost, flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button style={{ ...s.btnPrimary, flex: 1 }} onClick={submit}>Guardar</button>
      </div>
    </div>
  );
}

function PagoForm({ mediums, onSave, onCancel }) {
  const [tipo, setTipo] = useState('cobro');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(todayStr());
  const [medio, setMedio] = useState(mediums[0]?.name || '');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');

  const tipoInfo = TIPO_MAP[tipo];
  const needsMedio = tipo !== 'ajuste';

  const submit = () => {
    setErr('');
    const montoNum = parseDec(monto);
    if (!montoNum || montoNum <= 0) { setErr('Ingresá un monto válido'); return; }
    onSave({
      tipo,
      monto: montoNum,
      fecha,
      medio: needsMedio ? medio : '',
      desc: desc.trim(),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Selector de tipo */}
      <div style={{ display: 'flex', gap: 6 }}>
        {TIPOS.map(t => (
          <button
            key={t.id}
            onClick={() => setTipo(t.id)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              border: `1px solid ${tipo === t.id ? t.color : C.border}`,
              background: tipo === t.id ? t.color : 'transparent',
              color: tipo === t.id ? '#fff' : C.text2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.text3, marginTop: -8 }}>{tipoInfo.hint}</div>

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Monto</div>
        <input
          type="text" inputMode="decimal" value={monto}
          onChange={e => setMonto(onlyDecimal(e.target.value))} style={s.input} placeholder="0,00" autoFocus
        />
      </div>

      {needsMedio && (
        <div>
          <div style={{ ...s.label, marginBottom: 6 }}>Medio</div>
          <select value={medio} onChange={e => setMedio(e.target.value)} style={s.select}>
            <option value="">—</option>
            {mediums.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <div style={{ ...s.label, marginBottom: 6 }}>Fecha</div>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={s.input} />
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
