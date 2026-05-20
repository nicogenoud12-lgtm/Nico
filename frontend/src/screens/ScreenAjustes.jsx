import React, { useState, useEffect } from 'react';
import { C, s } from '../theme.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { authApi } from '../api/auth.js';
import DraggableList from '../components/DraggableList.jsx';
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

function SectionUsuarios() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await authApi.listUsers();
      setUsers(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar la cuenta de "${u.username}"?\n\nEsto borrará TODOS sus datos (transacciones, categorías, medios, tarjetas, suscripciones). Esta acción no se puede deshacer.`)) return;
    if (!window.confirm(`Confirmación final: ¿estás seguro de eliminar a "${u.username}" y todos sus datos?`)) return;
    try {
      await authApi.deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error al eliminar usuario');
    }
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {loading ? (
        <div style={{ padding: 16, fontSize: 13, color: C.text2 }}>Cargando…</div>
      ) : users.map((u, i) => (
        <div
          key={u.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : 'none',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: u.id === me?.id ? 600 : 400, color: C.text }}>
              {u.username}
              {u.id === me?.id && <span style={{ fontSize: 11, color: C.text3, marginLeft: 6 }}>(vos)</span>}
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 1, display: 'flex', gap: 6 }}>
              {u.is_admin && <span style={{ color: C.accent, fontWeight: 600 }}>Admin</span>}
              {!u.is_active && <span style={{ color: C.red }}>Inactivo</span>}
            </div>
          </div>
          {u.id !== me?.id && (
            <button
              onClick={() => handleDelete(u)}
              style={{ ...s.btnIcon, color: C.red, fontSize: 14 }}
              title="Eliminar cuenta y todos sus datos"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [note, setNote] = useState('');

  const load = async () => {
    try {
      const res = await authApi.listInvitations();
      setInvitations(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await authApi.createInvitation(note.trim() || null);
      setNote('');
      await load();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error al crear invitación');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (code, id) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta invitación?')) return;
    try {
      await authApi.deleteInvitation(id);
      setInvitations(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error al eliminar');
    }
  };

  const statusColor = (st) => st === 'disponible' ? C.green : st === 'usada' ? C.text2 : C.red;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      {/* Crear nueva invitación */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...s.input, flex: 1 }}
          placeholder="Nota (ej: para Nico)"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{ ...s.btnPrimary, opacity: creating ? 0.6 : 1, whiteSpace: 'nowrap' }}
        >
          + Generar
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ fontSize: 13, color: C.text2 }}>Cargando…</div>
      ) : invitations.length === 0 ? (
        <div style={{ fontSize: 13, color: C.text3, textAlign: 'center', padding: '12px 0' }}>
          No hay invitaciones todavía
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {invitations.map(inv => (
            <div
              key={inv.id}
              style={{
                background: C.surface2, borderRadius: 8, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.text, wordBreak: 'break-all' }}>
                    {inv.code}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: statusColor(inv.status),
                    textTransform: 'uppercase', letterSpacing: '.04em', flexShrink: 0,
                  }}>
                    {inv.status}
                  </span>
                </div>
                {inv.note && (
                  <div style={{ fontSize: 11, color: C.text2 }}>{inv.note}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {inv.status === 'disponible' && (
                  <button
                    onClick={() => handleCopy(inv.code, inv.id)}
                    style={{ ...s.btnGhost, fontSize: 11, padding: '5px 10px' }}
                  >
                    {copiedId === inv.id ? 'Copiado ✓' : 'Copiar'}
                  </button>
                )}
                {inv.status !== 'usada' && (
                  <button
                    onClick={() => handleDelete(inv.id)}
                    style={{ ...s.btnIcon, color: C.red, fontSize: 14 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScreenAjustes({ cats, mediums, onCatsChange, onMediumsChange, onLogout }) {
  const { user } = useAuth();
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
      if (!window.confirm('Esto reemplazará todos tus datos. ¿Continuar?')) return;
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

      {/* Cuenta */}
      <Section title="Cuenta">
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{user?.username}</div>
            {user?.is_admin && (
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginTop: 2 }}>Admin</div>
            )}
          </div>
          <button onClick={onLogout} style={{ ...s.btnGhost, fontSize: 13 }}>
            Cerrar sesión
          </button>
        </div>
      </Section>

      {/* Usuarios + Invitaciones — solo admin */}
      {user?.is_admin && (
        <>
          <Section title="Usuarios">
            <SectionUsuarios />
          </Section>
          <Section title="Invitaciones">
            <SectionInvitations />
          </Section>
        </>
      )}

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
