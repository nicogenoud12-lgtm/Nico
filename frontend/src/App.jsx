import { useState, useEffect, useMemo, useCallback } from 'react';
import Dashboard from './screens/Dashboard.jsx';
import Movimientos from './screens/Movimientos.jsx';
import Categorias from './screens/Categorias.jsx';
import Anual from './screens/Anual.jsx';
import Ajustes from './screens/Ajustes.jsx';
import {
  listTransactions, createTransaction, updateTransaction, deleteTransaction
} from './api/transactions.js';
import {
  listCategories, createCategory, updateCategory, deleteCategory, reorderCategories,
  listMediums, createMedium, updateMedium, deleteMedium, reorderMediums,
  listMonths
} from './api/categories.js';
import { monthIdToLabelFull, monthIdToShort, todayStr, dateToMonthId } from './utils/format.js';

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const [monthId, setMonthId] = useState(dateToMonthId(todayStr()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [months, setMonths] = useState([]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txs, cats, meds, mts] = await Promise.all([
        listTransactions(), listCategories(), listMediums(), listMonths()
      ]);
      setTransactions(txs);
      setCategories(cats);
      setMediums(meds);
      setMonths(mts);
    } catch (e) {
      setError(e?.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const addTx = useCallback(async (tx) => {
    const created = await createTransaction(tx);
    setTransactions(prev => [created, ...prev]);
    setMonthId(created.month);
  }, []);

  const editTx = useCallback(async (id, tx) => {
    const updated = await updateTransaction(id, tx);
    setTransactions(prev => prev.map(t => (t.id === id ? updated : t)));
    setMonthId(updated.month);
  }, []);

  const deleteTx = useCallback(async (id) => {
    await deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const createCat = useCallback(async (cat) => {
    const created = await createCategory(cat);
    setCategories(prev => [...prev, created]);
  }, []);

  const editCat = useCallback(async (id, cat) => {
    const updated = await updateCategory(id, cat);
    setCategories(prev => prev.map(c => (c.id === id ? updated : c)));
  }, []);

  const removeCat = useCallback(async (id) => {
    await deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  const reorderCats = useCallback(async (orderedItems, kind) => {
    setCategories(prev => {
      const others = prev.filter(c => c.kind !== kind);
      return [...others, ...orderedItems];
    });
    await reorderCategories(orderedItems.map(c => c.id));
  }, []);

  const createMed = useCallback(async (m) => {
    const created = await createMedium(m);
    setMediums(prev => [...prev, created]);
  }, []);

  const editMed = useCallback(async (id, m) => {
    const updated = await updateMedium(id, m);
    setMediums(prev => prev.map(x => (x.id === id ? updated : x)));
  }, []);

  const removeMed = useCallback(async (id) => {
    await deleteMedium(id);
    setMediums(prev => prev.filter(x => x.id !== id));
  }, []);

  const reorderMeds = useCallback(async (orderedItems) => {
    setMediums(orderedItems);
    await reorderMediums(orderedItems.map(m => m.id));
  }, []);

  const allMonths = useMemo(() => {
    const known = new Map(months.map(m => [m.id, m]));
    transactions.forEach(t => {
      if (!known.has(t.month)) {
        known.set(t.month, { id: t.month, label: monthIdToLabelFull(t.month), short: monthIdToShort(t.month), saldoInicial: 0, cuotas: 0 });
      }
    });
    if (!known.has(monthId)) {
      known.set(monthId, { id: monthId, label: monthIdToLabelFull(monthId), short: monthIdToShort(monthId), saldoInicial: 0, cuotas: 0 });
    }
    return [...known.values()].sort((a, b) => {
      const toSort = id => id.slice(2) + id.slice(0, 2);
      return toSort(b.id).localeCompare(toSort(a.id));
    });
  }, [months, transactions, monthId]);

  const txs = useMemo(
    () => transactions.filter(t => t.month === monthId).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, monthId]
  );
  const month = allMonths.find(m => m.id === monthId) || allMonths[0];

  const changeMonth = useCallback(dir => {
    const idx = allMonths.findIndex(m => m.id === monthId);
    const next = allMonths[idx + dir];
    if (next) setMonthId(next.id);
  }, [monthId, allMonths]);

  const catGastoList = useMemo(() => categories.filter(c => c.kind === 'gasto'), [categories]);
  const catIngresoList = useMemo(() => categories.filter(c => c.kind === 'ingreso'), [categories]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Cargando…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#c04030' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>No se pudo conectar con el backend</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>{error}</div>
        <button onClick={refreshAll} style={{ padding: '8px 16px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Reintentar</button>
      </div>
    );
  }

  const screens = {
    dashboard: (
      <Dashboard
        month={month} txs={txs} allMonths={allMonths}
        onNav={setScreen} onMonthChange={changeMonth}
        onAddTx={addTx} onEditTx={editTx} onDeleteTx={deleteTx}
        catList={categories} medioList={mediums}
      />
    ),
    movimientos: (
      <Movimientos
        month={month} txs={txs} allMonths={allMonths}
        onNav={setScreen} onMonthChange={changeMonth}
        onAddTx={addTx} onEditTx={editTx} onDeleteTx={deleteTx}
        catList={categories} medioList={mediums}
      />
    ),
    categorias: (
      <Categorias
        month={month} txs={txs} onNav={setScreen}
        catList={categories}
        onCreateCat={({ name, color }) => createCat({ name, color, kind: 'gasto' })}
        onUpdateCat={editCat}
      />
    ),
    anual: (
      <Anual
        currentMonthId={monthId} allMonths={allMonths} allTx={transactions}
        onNav={setScreen} onSelectMonth={setMonthId}
      />
    ),
    ajustes: (
      <Ajustes
        catGastoList={catGastoList} catIngresoList={catIngresoList} medioList={mediums}
        onCreateCat={createCat} onUpdateCat={editCat} onDeleteCat={removeCat} onReorderCats={reorderCats}
        onCreateMedium={createMed} onUpdateMedium={editMed} onDeleteMedium={removeMed} onReorderMediums={reorderMeds}
        onNav={setScreen}
      />
    )
  };

  return screens[screen] || screens.dashboard;
}
