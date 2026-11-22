import { useCallback, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { CheckCircle2, X, XCircle } from "lucide-react"
import { ToastContext } from "@/context/ToastContext"
import type { ToastContextValue, ToastKind } from "@/context/ToastContext"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const DISMISS_MS = 7000
const MAX_TOASTS = 4

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, kind, message }].slice(-MAX_TOASTS))
      window.setTimeout(() => dismiss(id), DISMISS_MS)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-100 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-sm border bg-white px-3 py-2.5 text-sm shadow-md",
              toast.kind === "error"
                ? "border-red-300 text-red-800"
                : "border-emerald-300 text-emerald-800",
            )}
          >
            {toast.kind === "error" ? (
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <p className="min-w-0 flex-1 break-words">{toast.message}</p>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => dismiss(toast.id)}
              className={cn("rounded-sm p-0.5 text-slate-700 hover:bg-slate-100", FOCUS_RING_LIGHT)}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
