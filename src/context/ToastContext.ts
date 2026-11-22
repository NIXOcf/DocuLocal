import { createContext } from "react"

export type ToastKind = "success" | "error"

export interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
