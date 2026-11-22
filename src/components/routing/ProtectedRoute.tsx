import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"

function ProtectedRoute() {
  const { isAuthenticated, restoring } = useAuth()
  if (restoring) {
    return (
      <p role="status" className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Restaurando sesión...
      </p>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export default ProtectedRoute
