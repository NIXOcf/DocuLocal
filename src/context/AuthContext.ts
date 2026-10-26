import { createContext } from "react"
import type { Role, UserSession } from "@/types"

export interface AuthContextValue {
  session: UserSession | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (role: Role) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
