import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C } from './theme.js';
import { dateToMonthId, todayStr, sortMonthIdsDesc } from './utils/format.js';
import { listTransactions } from './api/transactions.js';
import { listCategories, listMediums } from './api/categories.js';
import { listTarjetas } from './api/tarjetas.js';
import { listSuscripciones } from './api/suscripciones.js';

import SidebarDesktop from './components/SidebarDesktop.jsx';
import Sidebar from './components/Sidebar.jsx';
import MobileTopbar from './components/MobileTopbar.jsx';

import ScreenMovimientos from './screens/ScreenMovimientos.jsx';
import ScreenGastos from './screens/ScreenGastos.jsx';
import ScreenIngresos from './screens/ScreenIngresos.jsx';
import ScreenTarjetas from './screens/ScreenTarjetas.jsx';
import ScreenSuscripciones from './screens/ScreenSuscripciones.jsx';
import ScreenAnual from './screens/ScreenAnual.jsx';
import ScreenAjustes from './screens/ScreenAjustes.jsx';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

export default function App() {
  const mobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screen, setScreen] = useState('movimientos');
  const [monthId, setMonthId] = useState(dateToMonthId(todayStr()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [txs, setTxs] = useState([]);
  const [rawCats, setRawCats] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [suscripciones, setSuscripciones] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c, m, tj, sb] = await Promise.all([
        listTransactions(), listCategories(), listMediums(), listTarjetas(), listSuscripciones(),
      ]);
      setTxs(t);
      setRawCats(c);
      setMediums(m);
      setTarjetas(tj);
      setSuscripciones(sb);
    } catch (e) {
      setError(e?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const cats = useMemo(() => ({
    gastos: rawCats.filter(c => c.kind === 'gasto'),
    ingresos: rawCats.filter(c => c.kind === 'ingreso'),
  }), [rawCats]);

  const allMonthIds = useMemo(() => {
    const ids = new Set(txs.map(t => dateToMonthId(t.date)).filter(Boolean));
    if (monthId) ids.add(monthId);
    return sortMonthIdsDesc([...ids]);
  }, [txs, monthId]);

  const reloadTxs = useCallback(() => listTransactions().then(setTxs), []);
  const reloadCats = useCallback(() => listCategories().then(setRawCats), []);
  const reloadMediums = useCallback(() => listMediums().then(setMediums), []);
  const reloadTarjetas = useCallback(() => listTarjetas().then(setTarjetas), []);
  const reloadSuscripciones = useCallback(() => listSuscripciones().then(setSuscripciones), []);

  const onNav = useCallback((s) => { setScreen(s); setDrawerOpen(false); }, []);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.text2, fontSize: 14 }}>
        Cargando…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24, textAlign: 'center' }}>
        <div style={{ color: C.red, fontWeight: 600, marginBottom: 8 }}>No se pudo conectar con el backend</div>
        <div style={{ color: C.text3, fontSize: 12, marginBottom: 20 }}>{error}</div>
        <button onClick={loadAll} style={{ padding: '9px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  const screenProps = { txs, cats, mediums, tarjetas, monthId, allMonthIds, setMonthId };

  const renderScreen = () => {
    switch (screen) {
      case 'movimientos': return (
        <ScreenMovimientos
          {...screenProps}
          onTxsChange={reloadTxs}
        />
      );
      case 'gastos': return <ScreenGastos {...screenProps} onTxsChange={reloadTxs} />;
      case 'ingresos': return <ScreenIngresos {...screenProps} onTxsChange={reloadTxs} />;
      case 'tarjetas': return (
        <ScreenTarjetas
          {...screenProps}
          onTarjetasChange={async () => { await reloadTarjetas(); await reloadMediums(); }}
        />
      );
      case 'suscripciones': return (
        <ScreenSuscripciones
          suscripciones={suscripciones}
          onSuscripcionesChange={reloadSuscripciones}
        />
      );
      case 'anual': return <ScreenAnual {...screenProps} onNavigate={setScreen} />;
      case 'ajustes': return (
        <ScreenAjustes
          cats={cats} mediums={mediums}
          onCatsChange={reloadCats}
          onMediumsChange={reloadMediums}
        />
      );
      default: return null;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', background: C.bg, overflow: 'hidden' }}>
      {!mobile && <SidebarDesktop screen={screen} onNav={onNav} />}
      {mobile && (
        <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} screen={screen} onNav={onNav} />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {mobile && <MobileTopbar screen={screen} onMenu={() => setDrawerOpen(true)} />}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}
