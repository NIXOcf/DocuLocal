import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { AuthContext } from "@/context/AuthContext"
import type { AuthContextValue } from "@/context/AuthContext"
import { STORAGE_KEYS, safeGet, safeRemove, safeSet } from "@/lib/storage"
import { isUserSession } from "@/lib/validators"
import type { Role, UserSession } from "@/types"

/**
 * AUTENTICACIÓN SIMULADA.
 *
 * ADVERTENCIA (OWASP A01 / A07): el rol vive en el cliente (estado de React y
 * almacenamiento del navegador) y cualquier usuario puede manipularlo desde DevTools. Las
 * restricciones de esta interfaz son solo de experiencia de usuario. El
 * control de acceso basado en roles (RBAC) real DEBE aplicarse en el backend,
 * validando la identidad y los permisos en cada petición.
 */

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

const DISPLAY_NAMES: Record<Role, string> = {
  employee: "Empleado",
  admin: "Administrador",
}

function loadSession(): UserSession | null {
  const stored = safeGet<UserSession | null>(
    STORAGE_KEYS.session,
    (value): value is UserSession | null => isUserSession(value),
    null,
  )
  if (stored === null) return null
  const now = Date.now()
  if (stored.expiresAt <= now || stored.loggedAt > now) {
    safeRemove(STORAGE_KEYS.session)
    return null
  }
  // El displayName se deriva del rol: no se confía en el valor almacenado.
  return { ...stored, displayName: DISPLAY_NAMES[stored.role] }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(loadSession)
  const expiryTimeoutRef = useRef<number | null>(null)

  const logout = useCallback(() => {
    safeRemove(STORAGE_KEYS.session)
    setSession(null)
  }, [])

  const login = useCallback((role: Role) => {
    const now = Date.now()
    const next: UserSession = {
      role,
      displayName: DISPLAY_NAMES[role],
      loggedAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    }
    safeSet(STORAGE_KEYS.session, next)
    setSession(next)
  }, [])

  // Cierra la sesión automáticamente cuando caduca.
  useEffect(() => {
    if (session === null) return
    const remaining = Math.max(0, session.expiresAt - Date.now())
    expiryTimeoutRef.current = window.setTimeout(logout, remaining)
    return () => {
      if (expiryTimeoutRef.current !== null) {
        clearTimeout(expiryTimeoutRef.current)
        expiryTimeoutRef.current = null
      }
    }
  }, [session, logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      isAdmin: session?.role === "admin",
      login,
      logout,
    }),
    [session, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
