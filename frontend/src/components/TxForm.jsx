import React, { useState, useMemo } from 'react';
import { C, s } from '../theme.js';
import { todayStr } from '../utils/format.js';
import Segmented from './Segmented.jsx';

function toRawAmount(n) {
  if (n == null) return '';
  return String(Math.abs(n)).replace('.', ',');
}

function formatDisplayAmount(raw) {
  if (!raw) return '';
  const [intPart, decPart] = raw.split(',');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? formatted + ',' + decPart : formatted;
}

export default function TxForm({ cats, mediums, onSave, onCancel, onDelete, initial }) {
  const [type, setType] = useState(initial?.type || 'g');
  const [amount, setAmount] = useState(() => toRawAmount(initial?.amount));
  const [currency, setCurrency] = useState(initial?.currency || 'ARS');
  const [cat, setCat] = useState(initial?.cat || '');
  const [medio, setMedio] = useState(initial?.medio || '');
  const [desc, setDesc] = useState(initial?.desc || '');
  const [date, setDate] = useState(initial?.date || todayStr());
  const [cuotas, setCuotas] = useState(initial?.cuota_total || 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availCats = useMemo(() => type === 'i' ? cats.ingresos : cats.gastos, [type, cats]);

  const handleTypeChange = (newType) => {
    setType(newType);
    // solo limpiar cat si no existe en la nueva lista
    const newList = newType === 'i' ? cats.ingresos : cats.gastos;
    if (cat && !newList.find(c => c.name === cat)) setCat('');
  };

  const handleAmountChange = (e) => {
    let raw = e.target.value;
    raw = raw.replace(/\./g, '');
    raw = raw.replace(/[^0-9,]/g, '');
    const parts = raw.split(',');
    if (parts.length > 2) raw = parts[0] + ',' + parts.slice(1).join('');
    setAmount(raw);
  };

  const handleAmountBeforeInput = (e) => {
    if (e.data === '.') {
      e.preventDefault();
      if (!amount.includes(',')) setAmount(amount + ',');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = Math.abs(parseFloat(amount.replace(',', '.')));
    if (!n) { setError('El importe debe ser mayor a 0'); return; }
    if (!cat) { setError('Seleccioná una categoría'); return; }
    if (!date) { setError('Seleccioná una fecha'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ type, amount: n, currency, cat, medio, desc, date }, cuotas);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Error al guardar';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const row = { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 };
  const label = { fontSize: 12.5, fontWeight: 500, color: C.text2 };
  const typeColor = type === 'g' ? C.red : C.green;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* type toggle */}
      <Segmented
        full value={type} onChange={handleTypeChange}
        options={[['g', 'Gasto', C.red], ['i', 'Ingreso', C.green]]}
      />

      {/* amount + currency: monto grande, protagonista del formulario */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '18px 12px 16px', borderRadius: 14,
        background: C.bg, border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, width: '100%' }}>
          <span style={{ fontSize: 28, fontWeight: 500, color: amount ? typeColor : C.text3 }}>
            {currency === 'USD' ? 'US$' : '$'}
          </span>
          <input
            className="input-hero"
            autoFocus={!initial}
            style={{
              width: `${Math.max(1, formatDisplayAmount(amount).length || 1) + 0.5}ch`, maxWidth: '80%',
              background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', padding: 0,
              color: amount ? C.text : C.text3, fontSize: 40, fontWeight: 650, letterSpacing: '-0.03em',
              textAlign: 'left',
            }}
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={formatDisplayAmount(amount)}
            onChange={handleAmountChange}
            onBeforeInput={handleAmountBeforeInput}
          />
        </div>
        <Segmented
          size="sm" value={currency} onChange={setCurrency}
          options={[['ARS', 'ARS'], ['USD', 'USD']]}
        />
      </div>

      {/* category */}
      <div style={row}>
        <span style={label}>Categoría</span>
        <select style={s.select} value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Seleccionar…</option>
          {availCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* medium + date */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={row}>
          <span style={label}>Medio</span>
          <select style={s.select} value={medio} onChange={e => setMedio(e.target.value)}>
            <option value="">Sin medio</option>
            {mediums.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <div style={row}>
          <span style={label}>Fecha</span>
          <input style={s.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {/* desc */}
      <div style={row}>
        <span style={label}>Descripción <span style={{ color: C.text3, fontWeight: 400 }}>· opcional</span></span>
        <input style={s.input} type="text" placeholder="Ej: supermercado, nafta…" value={desc} onChange={e => setDesc(e.target.value)} />
      </div>

      {/* cuotas (only for gastos, not editing) */}
      {type === 'g' && !initial && (
        <div style={row}>
          <span style={label}>Cuotas</span>
          <select style={s.select} value={cuotas} onChange={e => setCuotas(Number(e.target.value))}>
            {[1,2,3,4,5,6,9,12,18,24].map(n => <option key={n} value={n}>{n === 1 ? 'Sin cuotas' : `${n} cuotas`}</option>)}
          </select>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: C.red, background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 10, padding: '9px 12px' }}>
          {error}
        </div>
      )}

      {/* actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={{ ...s.btnGhost, flex: 1 }}>Cancelar</button>
        <button type="submit" disabled={saving} style={{ ...s.btnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>
          {saving ? '…' : (initial ? 'Guardar' : 'Agregar')}
        </button>
      </div>

      {initial && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          style={{
            background: 'transparent', border: 'none',
            color: C.red, padding: '6px', borderRadius: 10,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Eliminar
        </button>
      )}
    </form>
  );
}
