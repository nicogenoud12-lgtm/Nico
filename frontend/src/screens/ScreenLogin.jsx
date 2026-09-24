import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { C, s } from '../theme';
import { LogoMark } from '../components/Icons.jsx';
import Segmented from '../components/Segmented.jsx';

const fieldLabel = { fontSize: 12.5, fontWeight: 500, color: C.text2 };

export default function ScreenLogin() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, code.trim());
      }
    } catch (err) {
      const msg = err?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'Algo salió mal, intentá de nuevo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(113,112,255,.14), transparent 70%), ${C.bg}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 20, padding: 'clamp(24px, 6vw, 36px)',
        boxShadow: '0 24px 64px -24px rgba(0,0,0,.8)',
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', marginBottom: 16, filter: 'drop-shadow(0 8px 24px rgba(113,112,255,.35))' }}>
            <LogoMark size={44} />
          </div>
          <h1 style={{ ...s.h1, margin: 0 }}>{tab === 'login' ? 'Bienvenido' : 'Crear cuenta'}</h1>
          <p style={{ fontSize: 14, color: C.text3, marginTop: 6 }}>
            {tab === 'login' ? 'Entrá para ver tus finanzas' : 'Necesitás un código de invitación'}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ marginBottom: 24 }}>
          <Segmented
            full value={tab} onChange={(t) => { setTab(t); setError(''); }}
            options={[['login', 'Entrar'], ['register', 'Crear cuenta']]}
          />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Usuario</label>
            <input
              style={{ ...s.input, marginTop: 6 }}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="tunombre"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label style={fieldLabel}>Contraseña</label>
            <input
              style={{ ...s.input, marginTop: 6 }}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {tab === 'register' && (
            <div>
              <label style={fieldLabel}>Código de invitación</label>
              <input
                style={{ ...s.input, marginTop: 6 }}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Pegá el código que te pasaron"
                required
              />
            </div>
          )}

          {error && (
            <div style={{
              background: C.redBg, border: `1px solid ${C.red}`,
              borderRadius: 8, padding: '10px 12px',
              color: C.red, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...s.btnPrimary, width: '100%', marginTop: 4,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Cargando...' : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
