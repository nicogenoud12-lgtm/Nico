import React, { useState, useEffect, useMemo } from 'react';
import { C, s } from '../theme.js';
import Modal from '../components/Modal.jsx';
import SuscripcionForm from '../components/SuscripcionForm.jsx';
import { fmtARS, fmtUSD } from '../utils/format.js';
import { createSuscripcion, updateSuscripcion, deleteSuscripcion } from '../api/suscripciones.js';

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

export default function ScreenSuscripciones({ suscripciones, onSuscripcionesChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editSub, setEditSub] = useState(null);
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
    const active = suscripciones.filter(s => s.estado === 'activo');
    const arsM = active.filter(s => s.moneda === 'ARS').reduce((acc, s) =>
      acc + (s.frecuencia === 'mensual' ? s.monto : s.monto / 12), 0);
    const usdM = active.filter(s => s.moneda === 'USD').reduce((acc, s) =>
      acc + (s.frecuencia === 'mensual' ? s.monto : s.monto / 12), 0);
    return { arsM, arsA: arsM * 12, usdM, usdA: usdM * 12 };
  }, [suscripciones]);

  const handleSave = async (data) => {
    if (editSub) {
      await updateSuscripcion(editSub.id, data);
    } else {
      await createSuscripcion(data);
    }
    setModalOpen(false);
    setEditSub(null);
    await onSuscripcionesChange();
  };

  const handleDelete = async (sub) => {
    if (!window.confirm(`¿Eliminar "${sub.nombre}"?`)) return;
    await deleteSuscripcion(sub.id);
    await onSuscripcionesChange();
  };

  const handleEdit = (sub) => {
    setEditSub(sub);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditSub(null);
    setModalOpen(true);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap', marginBottom: 16,
      }}>
        <div style={s.h1}>Suscripciones</div>
        <button onClick={handleAdd} style={s.btnPrimary}>+ Nueva Suscripción</button>
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
          No se pudo obtener cotización del dólar. Las suscripciones en USD se mostrarán sin equivalente en pesos.
        </div>
      )}

      {suscripciones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.text3, fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔁</div>
          <div>No hay suscripciones</div>
        </div>
      ) : (
        <div style={s.card({ overflow: 'hidden' })}>
          {suscripciones.map((sub, i) => (
            <SubRow
              key={sub.id}
              sub={sub}
              dolar={dolar}
              dolarLoading={dolarLoading}
              dolarError={dolarError}
              last={i === suscripciones.length - 1}
              onEdit={() => handleEdit(sub)}
              onDelete={() => handleDelete(sub)}
            />
          ))}
        </div>
      )}

      <div style={{ height: 40 }} />

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditSub(null); }}
        title={editSub ? 'Editar suscripción' : 'Nueva suscripción'}
      >
        <SuscripcionForm
          initial={editSub}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditSub(null); }}
        />
      </Modal>
    </div>
  );
}

function SubRow({ sub, dolar, dolarLoading, dolarError, last, onEdit, onDelete }) {
  const isUsd = sub.moneda === 'USD';
  const isActive = sub.estado === 'activo';

  return (
    <div
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        borderBottom: last ? 'none' : `1px solid ${C.border}`,
        opacity: isActive ? 1 : 0.55,
        cursor: 'pointer',
      }}
    >
      <LogoCircle url={sub.logo_url} nombre={sub.nombre} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sub.nombre}
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
          {sub.frecuencia === 'mensual' ? 'Mensual' : 'Anual'}
          {sub.vencimiento ? ` · vence ${sub.vencimiento}` : ''}
        </div>
      </div>

      <div style={{ textAlign: 'right', minWidth: 140 }}>
        {isUsd ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {fmtUSD(sub.monto)}
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 2, lineHeight: 1.4 }}>
              {dolarLoading ? 'Cargando…' :
               dolarError || !dolar ? '-' :
               <>
                 <div>Of: {fmtARS(sub.monto * dolar.oficial)}</div>
                 <div>Tj: {fmtARS(sub.monto * dolar.tarjeta)}</div>
               </>}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            {fmtARS(sub.monto)}
          </div>
        )}
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={s.btnIcon}
        title="Eliminar"
      >✕</button>
    </div>
  );
}
