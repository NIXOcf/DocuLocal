import { createContext } from "react"
import type { UserSession } from "@/types"

export interface AuthContextValue {
  session: UserSession | null
  /** true mientras se restaura la sesión guardada con `/auth/me`. */
  restoring: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
