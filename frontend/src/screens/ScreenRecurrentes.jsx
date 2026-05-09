import React, { useState, useEffect, useMemo } from 'react';
import { C, s } from '../theme.js';
import Modal from '../components/Modal.jsx';
import RecurrenteForm from '../components/RecurrenteForm.jsx';
import { fmtARS, fmtUSD } from '../utils/format.js';
import { createRecurrente, updateRecurrente, deleteRecurrente } from '../api/recurrentes.js';

function LogoCircle({ url, nombre }) {
  const [errored, setErrored] = useState(false);
  const initial = (nombre || '?').trim().charAt(0).toUpperCase();
  const showImg = url && !errored;
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
      background: C.surface2, border: `1px solid ${C.border}`,
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.text, fontSize: 18, fontWeight: 700,
    }}>
      {showImg ? (
        <img
          src={url}
          alt={nombre}
          onError={() => setErrored(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : initial}
    </div>
  );
}

function TotalCard({ label, monthly, annual, isUsd }) {
  const fmt = isUsd ? fmtUSD : fmtARS;
  return (
    <div style={s.card({ padding: 16, flex: 1, minWidth: 220 })}>
      <div style={s.label}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>Mensual</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{fmt(monthly)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>Anual</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text2 }}>{fmt(annual)}</div>
        </div>
      </div>
    </div>
  );
}

export default function ScreenRecurrentes({ recurrentes, onRecurrentesChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [dolar, setDolar] = useState(null);
  const [dolarLoading, setDolarLoading] = useState(true);
  const [dolarError, setDolarError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDolarLoading(true);
    fetch('https://criptoya.com/api/dolar')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(data => {
        if (cancelled) return;
        const oficial = data?.oficial?.price;
        const tarjeta = data?.tarjeta?.price;
        if (typeof oficial !== 'number' || typeof tarjeta !== 'number') {
          setDolarError(true);
        } else {
          setDolar({ oficial, tarjeta });
        }
      })
      .catch(() => { if (!cancelled) setDolarError(true); })
      .finally(() => { if (!cancelled) setDolarLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => {
    const active = recurrentes.filter(r => r.estado === 'activo');
    const arsM = active.filter(r => r.moneda === 'ARS').reduce((acc, r) =>
      acc + (r.frecuencia === 'mensual' ? r.monto : r.monto / 12), 0);
    const usdM = active.filter(r => r.moneda === 'USD').reduce((acc, r) =>
      acc + (r.frecuencia === 'mensual' ? r.monto : r.monto / 12), 0);
    return { arsM, arsA: arsM * 12, usdM, usdA: usdM * 12 };
  }, [recurrentes]);

  const handleSave = async (data) => {
    if (editRec) {
      await updateRecurrente(editRec.id, data);
    } else {
      await createRecurrente(data);
    }
    setModalOpen(false);
    setEditRec(null);
    await onRecurrentesChange();
  };

  const handleDelete = async (rec) => {
    if (!window.confirm(`¿Eliminar "${rec.nombre}"?`)) return;
    await deleteRecurrente(rec.id);
    await onRecurrentesChange();
  };

  const handleEdit = (rec) => {
    setEditRec(rec);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditRec(null);
    setModalOpen(true);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap', marginBottom: 16,
      }}>
        <div style={s.h1}>Gastos Recurrentes</div>
        <button onClick={handleAdd} style={s.btnPrimary}>+ Nueva Recurrente</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <TotalCard label="Total ARS" monthly={totals.arsM} annual={totals.arsA} />
        <TotalCard label="Total USD" monthly={totals.usdM} annual={totals.usdA} isUsd />
      </div>

      {dolarError && (
        <div style={{
          ...s.card({ padding: 10 }),
          background: C.redBg, borderColor: C.red,
          color: C.red, fontSize: 12, marginBottom: 16,
        }}>
          No se pudo obtener cotización del dólar. Los gastos en USD se mostrarán sin equivalente en pesos.
        </div>
      )}

      {recurrentes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.text3, fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔁</div>
          <div>No hay gastos recurrentes</div>
        </div>
      ) : (
        <div style={s.card({ overflow: 'hidden' })}>
          {recurrentes.map((rec, i) => (
            <RecRow
              key={rec.id}
              rec={rec}
              dolar={dolar}
              dolarLoading={dolarLoading}
              dolarError={dolarError}
              last={i === recurrentes.length - 1}
              onEdit={() => handleEdit(rec)}
              onDelete={() => handleDelete(rec)}
            />
          ))}
        </div>
      )}

      <div style={{ height: 40 }} />

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditRec(null); }}
        title={editRec ? 'Editar recurrente' : 'Nuevo gasto recurrente'}
      >
        <RecurrenteForm
          initial={editRec}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditRec(null); }}
        />
      </Modal>
    </div>
  );
}

function RecRow({ rec, dolar, dolarLoading, dolarError, last, onEdit, onDelete }) {
  const isUsd = rec.moneda === 'USD';
  const isActive = rec.estado === 'activo';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px',
      borderBottom: last ? 'none' : `1px solid ${C.border}`,
      opacity: isActive ? 1 : 0.55,
    }}>
      <LogoCircle url={rec.logo_url} nombre={rec.nombre} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {rec.nombre}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: isActive ? C.green : C.text2,
            background: isActive ? C.greenBg : 'transparent',
            border: isActive ? 'none' : `1px solid ${C.border}`,
            padding: '2px 6px', borderRadius: 4,
            textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            {isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
          {rec.frecuencia === 'mensual' ? 'Mensual' : 'Anual'}
          {rec.vencimiento ? ` · vence ${rec.vencimiento}` : ''}
        </div>
      </div>

      <div style={{ textAlign: 'right', minWidth: 140 }}>
        {isUsd ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {fmtUSD(rec.monto)}
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 2, lineHeight: 1.4 }}>
              {dolarLoading ? 'Cargando…' :
               dolarError || !dolar ? '-' :
               <>
                 <div>Of: {fmtARS(rec.monto * dolar.oficial)}</div>
                 <div>Tj: {fmtARS(rec.monto * dolar.tarjeta)}</div>
               </>}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            {fmtARS(rec.monto)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onEdit} style={s.btnIcon} title="Editar">✎</button>
        <button onClick={onDelete} style={s.btnIcon} title="Eliminar">✕</button>
      </div>
    </div>
  );
}
