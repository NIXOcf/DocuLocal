import { MessageSquare, ShieldAlert } from "lucide-react"
import { Link } from "react-router-dom"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"

function AccessDenied() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <div
        role="alert"
        className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-8 text-center"
      >
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-sm bg-slate-900">
          <ShieldAlert className="size-6 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Acceso denegado</h1>
        <p className="mt-2 text-sm text-slate-600">
          No tienes permisos para acceder al panel de administración.
        </p>
        <Link
          to="/chat"
          className={cn(
            "mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800",
            FOCUS_RING_LIGHT,
          )}
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          Volver al chat
        </Link>
      </div>
    </div>
  )
}

export default AccessDenied
