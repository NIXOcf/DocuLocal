import type { ReactNode } from "react"
import AccessDenied from "@/components/AccessDenied"
import { useAuth } from "@/hooks/useAuth"
import type { Role } from "@/types"

interface RoleRouteProps {
  requiredRole: Role
  children: ReactNode
}

/**
 * Restricción de interfaz por rol. NO es un control de seguridad: el rol se
 * guarda en el cliente y puede manipularse. El backend debe validar los
 * permisos en cada petición (OWASP A01).
 */
function RoleRoute({ requiredRole, children }: RoleRouteProps) {
  const { session } = useAuth()
  if (session?.role !== requiredRole) {
    return <AccessDenied />
  }
  return <>{children}</>
}

export default RoleRoute
