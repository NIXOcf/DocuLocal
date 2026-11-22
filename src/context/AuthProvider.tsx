import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { AuthContext } from "@/context/AuthContext"
import type { AuthContextValue } from "@/context/AuthContext"
import { request, setUnauthorizedHandler } from "@/lib/api"
import { clearAuth, loadAuth, purgeLegacyStorage, saveAuth } from "@/lib/storage"
import type { UserSession } from "@/types"

/**
 * Sesión real contra el backend (JWT de 8 h en sessionStorage).
 * Las restricciones de la interfaz por rol son solo de experiencia de usuario:
 * el RBAC lo aplica el backend en cada petición.
 */

interface LoginResponse {
  access_token: string
  expires_in: number
  user: UserSession
}

function toSession(user: UserSession): UserSession {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    accessLevel: user.accessLevel,
    department: user.department ?? null,
  }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(() => loadAuth()?.expiresAt ?? null)
  const [restoring, setRestoring] = useState(() => loadAuth() !== null)

  const logout = useCallback(() => {
    clearAuth()
    setSession(null)
    setExpiresAt(null)
  }, [])

  useEffect(() => {
    purgeLegacyStorage()
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // Restaura la sesión guardada validando el token con el backend.
  useEffect(() => {
    if (loadAuth() === null) return
    let cancelled = false
    request<UserSession>("/auth/me")
      .then((user) => !cancelled && setSession(toSession(user)))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setRestoring(false))
    return () => {
      cancelled = true
    }
  }, [logout])

  // Cierra la sesión automáticamente cuando caduca el token.
  useEffect(() => {
    if (expiresAt === null) return
    const timeout = window.setTimeout(logout, Math.max(0, expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [expiresAt, logout])

  const login = useCallback(async (email: string, password: string) => {
    const data = await request<LoginResponse>("/auth/login", {
      method: "POST",
      json: { email, password },
      auth: false,
    })
    const expires = Date.now() + data.expires_in * 1000
    saveAuth({ token: data.access_token, expiresAt: expires })
    setExpiresAt(expires)
    setSession(toSession(data.user))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      restoring,
      isAuthenticated: session !== null,
      isAdmin: session?.role === "admin",
      login,
      logout,
    }),
    [session, restoring, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
