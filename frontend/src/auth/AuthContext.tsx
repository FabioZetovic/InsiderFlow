import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { TOKEN_KEY, USER_KEY } from '../api/client';
import type { AuthResponse, UserInfo } from '../types';

interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  applyAuth: (response: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): UserInfo | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) {
    return null;
  }
  try {
    const { exp } = jwtDecode<{ exp: number }>(token);
    if (exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return JSON.parse(rawUser) as UserInfo;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(readStoredUser);

  const applyAuth = useCallback((response: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, applyAuth, logout }),
    [user, applyAuth, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
