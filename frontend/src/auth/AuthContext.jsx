import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Validar token existente al montar
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(r => setUser(r.data))
      .catch(() => {
        setToken(null);
        localStorage.removeItem('auth_token');
      })
      .finally(() => setLoading(false));
  }, []); // solo al montar

  // Escuchar evento de logout forzado (desde interceptor 401 de axios)
  useEffect(() => {
    const handler = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('auth_token');
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    const { access_token, user_id, username: uname, is_admin } = res.data;
    localStorage.setItem('auth_token', access_token);
    setToken(access_token);
    setUser({ id: user_id, username: uname, is_admin });
    return res.data;
  };

  const register = async (username, password, invitation_code) => {
    const res = await authApi.register(username, password, invitation_code);
    const { access_token, user_id, username: uname, is_admin } = res.data;
    localStorage.setItem('auth_token', access_token);
    setToken(access_token);
    setUser({ id: user_id, username: uname, is_admin });
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    // Limpiar estado de navegación del usuario
    if (user?.id) {
      localStorage.removeItem(`nav_screen:${user.id}`);
      localStorage.removeItem(`nav_month:${user.id}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
