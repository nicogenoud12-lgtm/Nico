import React, { useState } from 'react';
import { C, s, CARD_COLORS } from '../theme.js';

export default function TarjetaForm({ onSave, onCancel, initial }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [banco, setBanco] = useState(initial?.banco || '');
  const [ultimos4, setUltimos4] = useState(initial?.ultimos4 || '');
  const [cierre, setCierre] = useState(initial?.cierre || '');
  const [vence, setVence] = useState(initial?.vence || '');
  const [colorIdx, setColorIdx] = useState(initial?.color_idx ?? 0);
  const [colorHex, setColorHex] = useState(initial?.color_hex || '');
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        nombre, banco, ultimos4, cierre, vence,
        color_idx: colorIdx,
        color_hex: colorHex || null,
        logo_url: logoUrl.trim() || null,
      });
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {CARD_COLORS.map(([c1], i) => (
            <div
              key={i}
              onClick={() => { setColorIdx(i); setColorHex(''); }}
              style={{
                width: 28, height: 28, borderRadius: 8, background: c1, cursor: 'pointer',
                outline: !colorHex && colorIdx === i ? `2px solid ${C.text}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
          {/* Color personalizado */}
          <div
            title="Color personalizado"
            style={{
              position: 'relative', width: 28, height: 28, borderRadius: 8,
              overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
              background: colorHex || 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
              outline: colorHex ? `2px solid ${C.text}` : 'none',
              outlineOffset: 2,
            }}
          >
            <input
              type="color"
              value={colorHex || '#6366f1'}
              onChange={e => setColorHex(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', padding: 0, border: 'none' }}
            />
          </div>
        </div>
      </div>
      <div style={row}>
        <span style={lbl}>URL del logo (opcional)</span>
        <input
          style={s.input} type="url"
          value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
          placeholder="https://… (.png, .svg, etc)"
        />
        <span style={{ fontSize: 11, color: C.text3 }}>
          Si lo dejás vacío se muestran las iniciales del banco.
        </span>
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
