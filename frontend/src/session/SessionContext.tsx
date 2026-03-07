import React, { createContext, useState, useMemo, useCallback } from "react";
import type { SessionState } from "./sessionTypes";
import { loadSession, saveSession, clearSession } from "./sessionStorage";

const initialState: SessionState = loadSession();

export const SessionContext = createContext<{
  session: SessionState;
  setSession: (session: SessionState) => void;
  logout: () => void;
} | null>(null);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<SessionState>(initialState);

  const setSession = useCallback((next: SessionState) => {
    setSessionState(next);
    saveSession(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState({ token: null, user: null, empresas: [], empresaActivaId: null });
  }, []);

  const value = useMemo(() => ({ session, setSession, logout }), [session, setSession, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
