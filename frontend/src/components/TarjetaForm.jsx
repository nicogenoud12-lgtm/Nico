import React, { useState } from 'react';
import { C, s, CARD_COLORS } from '../theme.js';

export default function TarjetaForm({ onSave, onCancel, initial }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [banco, setBanco] = useState(initial?.banco || '');
  const [ultimos4, setUltimos4] = useState(initial?.ultimos4 || '');
  const [cierre, setCierre] = useState(initial?.cierre || '');
  const [vence, setVence] = useState(initial?.vence || '');
  const [colorIdx, setColorIdx] = useState(initial?.color_idx ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ nombre, banco, ultimos4, cierre, vence, color_idx: colorIdx });
    } finally {
      setSaving(false);
    }
  };

  const row = { display: 'flex', flexDirection: 'column', gap: 6 };
  const lbl = { fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={row}>
        <span style={lbl}>Nombre / apodo</span>
        <input style={s.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Visa Galicia" required autoFocus />
      </div>
      <div style={row}>
        <span style={lbl}>Banco</span>
        <input style={s.input} value={banco} onChange={e => setBanco(e.target.value)} placeholder="Ej: Galicia" />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...row, flex: 1 }}>
          <span style={lbl}>Últimos 4</span>
          <input style={s.input} value={ultimos4} onChange={e => setUltimos4(e.target.value)} placeholder="1234" maxLength={4} />
        </div>
        <div style={{ ...row, flex: 1 }}>
          <span style={lbl}>Día cierre</span>
          <input style={s.input} value={cierre} onChange={e => setCierre(e.target.value)} placeholder="15" />
        </div>
        <div style={{ ...row, flex: 1 }}>
          <span style={lbl}>Día vence</span>
          <input style={s.input} value={vence} onChange={e => setVence(e.target.value)} placeholder="22" />
        </div>
      </div>
      <div style={row}>
        <span style={lbl}>Color</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CARD_COLORS.map(([c1], i) => (
            <div
              key={i}
              onClick={() => setColorIdx(i)}
              style={{
                width: 28, height: 28, borderRadius: 8, background: c1, cursor: 'pointer',
                outline: colorIdx === i ? `2px solid ${C.text}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={{ ...s.btnGhost, flex: 1 }}>Cancelar</button>
        <button type="submit" disabled={saving} style={{ ...s.btnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>
          {saving ? '…' : (initial ? 'Guardar' : 'Agregar')}
        </button>
      </div>
    </form>
  );
}
