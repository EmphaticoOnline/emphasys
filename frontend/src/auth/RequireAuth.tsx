import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../session/useSession";

export default function RequireAuth() {
  const { session } = useSession();
  const location = useLocation();

  if (!session.token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
