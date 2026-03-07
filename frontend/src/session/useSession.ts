import { useContext } from "react";
import { SessionContext } from "./SessionContext";

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de un SessionProvider");
  }

  const { session, setSession, logout } = ctx;
  return { session, setSession, logout };
}
