import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C } from './theme.js';
import { useAuth } from './auth/AuthContext.jsx';
import { HideAmountsProvider } from './HideAmountsContext.jsx';
import { usePullToRefresh } from './hooks/usePullToRefresh.js';
import { dateToMonthId, todayStr, sortMonthIdsDesc } from './utils/format.js';
import { listTransactions } from './api/transactions.js';
import { listCategories, listMediums } from './api/categories.js';
import { listTarjetas } from './api/tarjetas.js';
import { listRecurrentes } from './api/recurrentes.js';

import SidebarDesktop from './components/SidebarDesktop.jsx';
import Sidebar from './components/Sidebar.jsx';
import MobileTopbar from './components/MobileTopbar.jsx';

import ScreenLogin from './screens/ScreenLogin.jsx';
import ScreenMovimientos from './screens/ScreenMovimientos.jsx';
import ScreenGastos from './screens/ScreenGastos.jsx';
import ScreenIngresos from './screens/ScreenIngresos.jsx';
import ScreenTarjetas from './screens/ScreenTarjetas.jsx';
import ScreenRecurrentes from './screens/ScreenRecurrentes.jsx';
import ScreenAnual from './screens/ScreenAnual.jsx';
import ScreenInversiones from './screens/ScreenInversiones.jsx';
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

// AppInner se monta solo cuando el usuario está autenticado.
// Al hacer logout se desmonta, reseteando todo el estado local.
function AppInner() {
  const { user, logout } = useAuth();
  const userId = user?.id;
  const mobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const VALID_SCREENS = ['movimientos', 'gastos', 'ingresos', 'tarjetas', 'recurrentes', 'anual', 'inversiones', 'ajustes'];
  const [screen, setScreen] = useState(() => {
    const s = localStorage.getItem(`nav_screen:${userId}`);
    return VALID_SCREENS.includes(s) ? s : 'movimientos';
  });
  const [monthId, setMonthId] = useState(() => {
    const m = localStorage.getItem(`nav_month:${userId}`);
    return m && /^\d{4}$/.test(m) ? m : dateToMonthId(todayStr());
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [txs, setTxs] = useState([]);
  const [rawCats, setRawCats] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [recurrentes, setRecurrentes] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c, m, tj, r] = await Promise.all([
        listTransactions(), listCategories(), listMediums(), listTarjetas(), listRecurrentes(),
      ]);
      setTxs(t);
      setRawCats(c);
      setMediums(m);
      setTarjetas(tj);
      setRecurrentes(r);
    } catch (e) {
      setError(e?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { localStorage.setItem(`nav_screen:${userId}`, screen); }, [screen, userId]);
  useEffect(() => { localStorage.setItem(`nav_month:${userId}`, monthId); }, [monthId, userId]);

  const cats = useMemo(() => ({
    gastos: rawCats.filter(c => c.kind === 'gasto'),
    ingresos: rawCats.filter(c => c.kind === 'ingreso'),
    inversiones: rawCats.filter(c => c.kind === 'inversion'),
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
  const reloadRecurrentes = useCallback(() => listRecurrentes().then(setRecurrentes), []);

  const onNav = useCallback((s) => { setScreen(s); setDrawerOpen(false); }, []);

  const { pullY, refreshing: pullRefreshing, threshold } = usePullToRefresh(loadAll);

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
        <ScreenMovimientos {...screenProps} onTxsChange={reloadTxs} />
      );
      case 'gastos': return <ScreenGastos {...screenProps} onTxsChange={reloadTxs} />;
      case 'ingresos': return <ScreenIngresos {...screenProps} onTxsChange={reloadTxs} />;
      case 'tarjetas': return (
        <ScreenTarjetas
          {...screenProps}
          onTarjetasChange={async () => { await reloadTarjetas(); await reloadMediums(); }}
          onTxsChange={reloadTxs}
        />
      );
      case 'recurrentes': return (
        <ScreenRecurrentes recurrentes={recurrentes} onRecurrentesChange={reloadRecurrentes} />
      );
      case 'anual': return <ScreenAnual {...screenProps} onNavigate={setScreen} />;
      case 'inversiones': return <ScreenInversiones {...screenProps} onTxsChange={reloadTxs} />;
      case 'ajustes': return (
        <ScreenAjustes
          cats={cats} mediums={mediums}
          onCatsChange={reloadCats}
          onMediumsChange={reloadMediums}
          onLogout={logout}
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
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {mobile && (pullY > 0 || pullRefreshing) && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              height: pullRefreshing ? 44 : Math.min(pullY, 44),
              overflow: 'hidden', transition: pullRefreshing ? 'none' : undefined,
            }}>
              <svg
                width="22" height="22" viewBox="0 0 22 22"
                style={{
                  opacity: pullRefreshing ? 1 : pullY / threshold,
                  animation: pullRefreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
                  transformOrigin: '50% 50%',
                  transform: pullRefreshing ? undefined : `rotate(${(pullY / threshold) * 270}deg)`,
                }}
              >
                <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
                <circle cx="11" cy="11" r="9" stroke={C.accent} strokeWidth="2.5" fill="none" strokeDasharray="40 20" />
              </svg>
            </div>
          )}
          <div style={{ height: '100%', transform: mobile && pullY > 0 ? `translateY(${Math.min(pullY, 44)}px)` : 'none', transition: pullY === 0 ? 'transform 0.2s' : 'none' }}>
            {renderScreen()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.text2, fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
        Cargando…
      </div>
    );
  }

  if (!user) return <ScreenLogin />;
  return (
    <HideAmountsProvider>
      <AppInner />
    </HideAmountsProvider>
  );
}
