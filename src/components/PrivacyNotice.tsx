import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { request } from "@/lib/api"
import { markPrivacyNoticeSeen } from "@/lib/storage"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface PrivacyNoticeProps {
  open: boolean
  onClose: () => void
}

function PrivacyNotice({ open, onClose }: PrivacyNoticeProps) {
  // Variante conservadora (nube) hasta saber que el modo es local; si health falla se queda así.
  const [isLocal, setIsLocal] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    request<{ modo?: string }>("/health", { auth: false, signal: controller.signal })
      .then((health) => setIsLocal(health.modo === "local"))
      .catch(() => setIsLocal(false))
    return () => controller.abort()
  }, [open])

  const close = () => {
    markPrivacyNoticeSeen()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-sm bg-white p-0 text-slate-900 ring-slate-300 sm:max-w-lg"
      >
        <DialogHeader className="gap-3 px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold text-slate-900">
            Aviso de privacidad de DocuLocal en AguaNube
          </DialogTitle>
          <DialogDescription className="space-y-2 text-sm text-slate-700">
            <span className="block">
              Para que el asistente funcione, AguaNube guarda tu correo, tu contraseña (cifrada,
              nunca en claro) y el historial de tus preguntas y respuestas. Se usan solo para el
              funcionamiento del programa y para dar contexto a las respuestas.
            </span>
            <span className="block">
              Además se registran acciones de seguridad (inicio de sesión, consultas, gestión de
              documentos) sin IP ni contenido, y se eliminan a los 30 días.
            </span>
            <span className="block">
              {isLocal
                ? "Nada de lo que escribas sale de la red de la empresa."
                : "Tu pregunta y los fragmentos de documentos recuperados se envían a un proveedor de inteligencia artificial en EE. UU. para generar la respuesta."}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <Button
            type="button"
            onClick={close}
            className={cn("h-11 rounded-sm bg-slate-900 px-5 text-white hover:bg-slate-800", FOCUS_RING_LIGHT)}
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PrivacyNotice
