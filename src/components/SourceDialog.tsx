import type { RefObject } from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { mockFragments } from "@/data/mockData"
import type { MockFragment } from "@/data/mockData"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface SourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filename: string | null
  /** Elemento que recibe el foco al cerrar (el botón de la fuente pulsado). */
  returnFocusRef: RefObject<HTMLElement | null>
}

const GENERIC_FRAGMENT: MockFragment = {
  page: 1,
  score: 0.75,
  text: "Fragmento de prueba: el documento contiene información relevante para la consulta realizada. En un entorno real, aquí se mostraría el pasaje exacto recuperado de la base de datos vectorial junto con su metadato de página.",
}

const scoreFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function SourceDialog({
  open,
  onOpenChange,
  filename,
  returnFocusRef,
}: SourceDialogProps) {
  const fragment =
    (filename !== null && Object.hasOwn(mockFragments, filename)
      ? mockFragments[filename]
      : undefined) ?? GENERIC_FRAGMENT

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        finalFocus={returnFocusRef}
        className="gap-0 rounded-sm bg-white p-0 text-slate-900 ring-slate-300 sm:max-w-lg"
      >
        <DialogHeader className="gap-1 border-b border-slate-200 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold break-all text-slate-900">
            <FileText className="size-4 shrink-0 text-slate-600" aria-hidden="true" />
            {filename ?? "Documento"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Fragmento recuperado de la base de datos vectorial (simulado)
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          <p className="mb-3 text-xs font-medium text-slate-700">
            Página {fragment.page} · Relevancia {scoreFormatter.format(fragment.score)}
          </p>
          <blockquote className="rounded-sm border-l-4 border-slate-900 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
            {fragment.text}
          </blockquote>
        </div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <DialogClose
            render={
              <Button
                type="button"
                className={cn(
                  "h-11 rounded-sm bg-slate-900 px-5 text-white hover:bg-slate-800",
                  FOCUS_RING_LIGHT,
                )}
              />
            }
          >
            Cerrar
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SourceDialog
