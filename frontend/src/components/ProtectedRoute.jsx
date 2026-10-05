import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// route guard: waits for the session check, then redirects to /login if there's no user
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // session check in flight; without this a refresh would bounce logged-in users to /login
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />; // replace keeps /dashboard out of history
  return <Outlet />;
}