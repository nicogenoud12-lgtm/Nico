import React, { useState } from 'react';
import { C, s } from '../theme.js';
import TarjetaCard from '../components/TarjetaCard.jsx';
import TarjetaDetail from '../components/TarjetaDetail.jsx';
import TarjetaForm from '../components/TarjetaForm.jsx';
import Modal from '../components/Modal.jsx';
import { createTarjeta, updateTarjeta, deleteTarjeta } from '../api/tarjetas.js';

export default function ScreenTarjetas({ tarjetas, txs, allMonthIds, onTarjetasChange }) {
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      {tarjetas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.text3, fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
          <div>No hay tarjetas registradas</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          {tarjetas.map(t => (
            <TarjetaCard key={t.id} tarjeta={t} onClick={() => setSelected(t)} />
          ))}
        </div>
      )}

      <button
        onClick={() => setAddOpen(true)}
        style={{
          ...s.btnGhost, width: '100%', padding: '12px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <span style={{ fontSize: 18, color: C.accent }}>+</span> Agregar tarjeta
      </button>

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
