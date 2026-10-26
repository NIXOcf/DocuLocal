import { useContext } from "react"
import { AuthContext } from "@/context/AuthContext"
import type { AuthContextValue } from "@/context/AuthContext"

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error("useAuth debe usarse dentro de AuthProvider")
  }
  return context
}
