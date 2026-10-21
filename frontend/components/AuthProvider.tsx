'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, SessionUser } from '@/lib/api';

type AuthState = {
  session: Session | null;
  user: SessionUser | null;
  token: string | null;
  ready: boolean;
  signIn: (s: Session) => void;
  signOut: () => void;
  updateUser: (patch: Partial<SessionUser>) => void;
};

const AuthContext = createContext<AuthState>({
  session: null, user: null, token: null, ready: false, signIn: () => {}, signOut: () => {}, updateUser: () => {},
});
const KEY = 'gallery-session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      // Les sessions créées avant l'ajout des rôles sont ignorées : il faut se reconnecter.
      if (parsed?.accessToken && parsed?.user?.role) setSession(parsed);
      else localStorage.removeItem(KEY);
    } catch {
      localStorage.removeItem(KEY);
    }
    setReady(true);
  }, []);

  const signIn = useCallback((s: Session) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY);
    setSession(null);
  }, []);

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    setSession((cur) => {
      if (!cur) return cur;
      const next = { ...cur, user: { ...cur.user, ...patch } };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Jeton expiré ou compte suspendu (réponse 401 de l'API)
  useEffect(() => {
    window.addEventListener('auth:expired', signOut);
    return () => window.removeEventListener('auth:expired', signOut);
  }, [signOut]);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, token: session?.accessToken ?? null, ready, signIn, signOut, updateUser }),
    [session, ready, signIn, signOut, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
