import React, { useState } from 'react';
import { C, s } from '../theme.js';

export default function RecurrenteForm({ onSave, onCancel, initial }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [monto, setMonto] = useState(initial?.monto?.toString() || '');
  const [moneda, setMoneda] = useState(initial?.moneda || 'ARS');
  const [frecuencia, setFrecuencia] = useState(initial?.frecuencia || 'mensual');
  const [vencimiento, setVencimiento] = useState(initial?.vencimiento || '');
  const [estado, setEstado] = useState(initial?.estado || 'activo');
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url || '');
  const [diaMes, setDiaMes] = useState(initial?.dia_mes?.toString() || '');
  const [autoCreate, setAutoCreate] = useState(initial?.auto_create || false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const m = parseFloat(monto);
    if (!nombre.trim()) { setError('Ingresá un nombre'); return; }
    if (isNaN(m) || m <= 0) { setError('Monto inválido'); return; }
    setSaving(true);
    try {
      const dm = parseInt(diaMes);
      await onSave({
        nombre: nombre.trim(),
        monto: m,
        moneda,
        frecuencia,
        vencimiento: vencimiento || null,
        estado,
        logo_url: logoUrl.trim() || null,
        dia_mes: diaMes && dm >= 1 && dm <= 31 ? dm : null,
        auto_create: autoCreate,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const row = { display: 'flex', flexDirection: 'column', gap: 6 };
  const lbl = { fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' };

  const toggleBtn = (active, color) => ({
    flex: 1, padding: '10px',
    background: active ? color + '22' : 'transparent',
    border: `1px solid ${active ? color : C.border}`,
    borderRadius: 8, color: active ? color : C.text2,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'all .15s',
  });

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={row}>
        <span style={lbl}>Nombre</span>
        <input style={s.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Netflix" required autoFocus />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...row, flex: 2 }}>
          <span style={lbl}>Monto</span>
          <input
            style={s.input} type="number" step="0.01" min="0"
            value={monto} onChange={e => setMonto(e.target.value)}
            placeholder="0" required
          />
        </div>
        <div style={{ ...row, flex: 1 }}>
          <span style={lbl}>Moneda</span>
          <select style={s.select} value={moneda} onChange={e => setMoneda(e.target.value)}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div style={row}>
        <span style={lbl}>Frecuencia</span>
        <select style={s.select} value={frecuencia} onChange={e => setFrecuencia(e.target.value)}>
          <option value="mensual">Mensual</option>
          <option value="anual">Anual</option>
        </select>
      </div>

      <div style={row}>
        <span style={lbl}>Vencimiento</span>
        <input
          style={s.input} type="date"
          value={vencimiento} onChange={e => setVencimiento(e.target.value)}
        />
      </div>

      <div style={row}>
        <span style={lbl}>Estado</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setEstado('activo')} style={toggleBtn(estado === 'activo', C.green)}>
            Activo
          </button>
          <button type="button" onClick={() => setEstado('inactivo')} style={toggleBtn(estado === 'inactivo', C.text2)}>
            Inactivo
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...row, flex: 1 }}>
          <span style={lbl}>Día de débito</span>
          <input
            style={s.input} type="number" min="1" max="31"
            value={diaMes} onChange={e => setDiaMes(e.target.value)}
            placeholder="1-31"
          />
        </div>
        <div style={{ ...row, flex: 2 }}>
          <span style={lbl}>Crear gasto automáticamente</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setAutoCreate(true)} style={toggleBtn(autoCreate, C.green)}>Sí</button>
            <button type="button" onClick={() => setAutoCreate(false)} style={toggleBtn(!autoCreate, C.text2)}>No</button>
          </div>
        </div>
      </div>

      <div style={row}>
        <span style={lbl}>URL del logo</span>
        <input
          style={s.input} type="url"
          value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      {error && (
        <div style={{ padding: 10, background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={{ ...s.btnGhost, flex: 1 }}>Cancelar</button>
        <button type="submit" disabled={saving} style={{ ...s.btnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>
          {saving ? '…' : (initial ? 'Guardar' : 'Agregar')}
        </button>
      </div>
    </form>
  );
}
