import { useContext } from "react"
import { ToastContext } from "@/context/ToastContext"
import type { ToastContextValue } from "@/context/ToastContext"

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) {
    throw new Error("useToast debe usarse dentro de ToastProvider")
  }
  return context
}
