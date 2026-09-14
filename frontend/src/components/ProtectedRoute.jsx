import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ allowedRoles, children }) {
  const { token, user } = useAuth();
  const location = useLocation();

  if (!token || !user) return <Navigate to="/auth" replace state={{ from: location }} />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}