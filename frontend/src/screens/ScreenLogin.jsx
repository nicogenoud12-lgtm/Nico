import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { C, s } from '../theme';

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
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 32,
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💸</div>
          <h1 style={{ ...s.h1, margin: 0 }}>Gastos</h1>
          <p style={{ ...s.small, marginTop: 4 }}>Tu app de finanzas personales</p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', background: C.surface2, borderRadius: 8,
          padding: 3, marginBottom: 24, gap: 3,
        }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: 6,
                fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
                background: tab === t ? C.accent : 'transparent',
                color: tab === t ? '#fff' : C.text2,
              }}
            >
              {t === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={s.label}>Usuario</label>
            <input
              style={{ ...s.input, marginTop: 4 }}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="tunombre"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label style={s.label}>Contraseña</label>
            <input
              style={{ ...s.input, marginTop: 4 }}
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
              <label style={s.label}>Código de invitación</label>
              <input
                style={{ ...s.input, marginTop: 4 }}
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
