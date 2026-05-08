import React, { useState } from 'react';
import { C, s } from '../theme.js';
import DraggableList from '../components/DraggableList.jsx';
import Divider from '../components/Divider.jsx';
import {
  createCategory, updateCategory, deleteCategory, reorderCategories,
  createMedium, updateMedium, deleteMedium, reorderMediums,
} from '../api/categories.js';
import { exportBackup, importBackup } from '../api/backup.js';

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, padding: '0 2px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function ScreenAjustes({ cats, mediums, onCatsChange, onMediumsChange }) {
  const [backupStatus, setBackupStatus] = useState('');
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    try {
      setBackupStatus('Exportando…');
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gastos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus('');
    } catch {
      setBackupStatus('Error al exportar');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!window.confirm('Esto reemplazará todos los datos. ¿Continuar?')) return;
      setImporting(true);
      setBackupStatus('Importando…');
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        await importBackup(payload);
        setBackupStatus('Importación exitosa. Recargando…');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        setBackupStatus('Error al importar: ' + (err?.response?.data?.detail || err.message));
        setImporting(false);
      }
    };
    input.click();
  };

  const handleReorderCats = async (kind, newItems) => {
    await reorderCategories(newItems.map(i => i.id));
    await onCatsChange();
  };

  const handleEditCat = async (kind, i, val) => {
    const items = kind === 'gasto' ? cats.gastos : cats.ingresos;
    await updateCategory(items[i].id, { name: val.name, color: val.color });
    await onCatsChange();
  };

  const handleDeleteCat = async (kind, i) => {
    const items = kind === 'gasto' ? cats.gastos : cats.ingresos;
    if (!window.confirm(`¿Eliminar "${items[i].name}"?`)) return;
    await deleteCategory(items[i].id);
    await onCatsChange();
  };

  const handleAddCat = async (kind) => {
    const name = window.prompt('Nombre de la categoría:');
    if (!name?.trim()) return;
    await createCategory({ name: name.trim(), kind, color: '#888888' });
    await onCatsChange();
  };

  const handleReorderMediums = async (newItems) => {
    await reorderMediums(newItems.map(i => i.id));
    await onMediumsChange();
  };

  const handleEditMedium = async (i, val) => {
    await updateMedium(mediums[i].id, { name: val.name });
    await onMediumsChange();
  };

  const handleDeleteMedium = async (i) => {
    if (!window.confirm(`¿Eliminar "${mediums[i].name}"?`)) return;
    await deleteMedium(mediums[i].id);
    await onMediumsChange();
  };

  const handleAddMedium = async () => {
    const name = window.prompt('Nombre del medio:');
    if (!name?.trim()) return;
    await createMedium({ name: name.trim() });
    await onMediumsChange();
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>

      <Section title="Backup">
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: backupStatus ? 10 : 0 }}>
            <button onClick={handleExport} style={{ ...s.btnGhost, flex: 1 }}>
              Exportar JSON
            </button>
            <button onClick={handleImport} disabled={importing} style={{ ...s.btnGhost, flex: 1, opacity: importing ? 0.6 : 1 }}>
              Importar JSON
            </button>
          </div>
          {backupStatus && (
            <div style={{ fontSize: 12, color: C.text2, marginTop: 8 }}>{backupStatus}</div>
          )}
        </div>
      </Section>

      <Section title="Categorías de gastos">
        <DraggableList
          items={cats.gastos}
          onReorder={items => handleReorderCats('gasto', items)}
          onEdit={(i, val) => handleEditCat('gasto', i, val)}
          onDelete={i => handleDeleteCat('gasto', i)}
          onAdd={() => handleAddCat('gasto')}
          hasColor
          addLabel="Agregar categoría"
        />
      </Section>

      <Section title="Categorías de ingresos">
        <DraggableList
          items={cats.ingresos}
          onReorder={items => handleReorderCats('ingreso', items)}
          onEdit={(i, val) => handleEditCat('ingreso', i, val)}
          onDelete={i => handleDeleteCat('ingreso', i)}
          onAdd={() => handleAddCat('ingreso')}
          hasColor
          addLabel="Agregar categoría"
        />
      </Section>

      <Section title="Medios de pago">
        <DraggableList
          items={mediums}
          onReorder={handleReorderMediums}
          onEdit={handleEditMedium}
          onDelete={handleDeleteMedium}
          onAdd={handleAddMedium}
          hasColor={false}
          addLabel="Agregar medio"
        />
      </Section>

      <div style={{ height: 40 }} />
    </div>
  );
}
