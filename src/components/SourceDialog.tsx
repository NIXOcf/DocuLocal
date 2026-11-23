import { useEffect, useState } from "react"
import type { RefObject } from "react"
import { FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, request } from "@/lib/api"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { Chunk, Source } from "@/types"

interface SourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: Source | null
  /** Texto de la respuesta del asistente, para resaltar las frases más relacionadas. */
  answer: string
  /** Elemento que recibe el foco al cerrar (el botón de la fuente pulsado). */
  returnFocusRef: RefObject<HTMLElement | null>
}

type Result = { id: string; chunk: Chunk } | { id: string; error: string }

const scoreFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const words = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[a-z0-9]{4,}/g) ?? [],
  )

/** Índices de las (hasta 2) oraciones con más palabras en común con la respuesta. */
function bestSentences(sentences: string[], answer: string): Set<number> {
  const ref = words(answer)
  return new Set(
    sentences
      .map((s, i) => ({ i, n: [...words(s)].filter((w) => ref.has(w)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .slice(0, 2)
      .map((x) => x.i),
  )
}

function SourceDialog({ open, onOpenChange, source, answer, returnFocusRef }: SourceDialogProps) {
  const [result, setResult] = useState<Result | null>(null)
  const sourceId = source?.id ?? null

  useEffect(() => {
    if (!open || sourceId === null) return
    let cancelled = false
    request<Chunk>(`/chunks/${encodeURIComponent(sourceId)}`)
      .then((chunk) => !cancelled && setResult({ id: sourceId, chunk }))
      .catch((error: unknown) => {
        if (cancelled) return
        const message =
          error instanceof ApiError && error.status === 404
            ? "No tienes acceso a este fragmento o ya no existe."
            : error instanceof ApiError
              ? error.message
              : "No se pudo cargar el fragmento."
        setResult({ id: sourceId, error: message })
      })
    return () => {
      cancelled = true
    }
  }, [open, sourceId])

  // El resultado solo vale si corresponde a la fuente actual (evita parpadeos con datos viejos).
  const current = result !== null && result.id === sourceId ? result : null
  const chunk = current !== null && "chunk" in current ? current.chunk : null
  const error = current !== null && "error" in current ? current.error : null
  const sentences = chunk?.content.match(/[^.!?\n]+[.!?]*\s*/g) ?? []
  const best = bestSentences(sentences, answer)
  const page = chunk?.page ?? source?.page ?? null

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
            {chunk?.filename ?? source?.filename ?? "Documento"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Fragmento citado en la respuesta
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          {error !== null ? (
            <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : chunk === null ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Cargando fragmento...
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs font-medium text-slate-700">
                {page !== null && `Página ${page} · `}Relevancia{" "}
                {scoreFormatter.format(source?.score ?? 0)}
              </p>
              <blockquote className="max-h-72 overflow-y-auto rounded-sm border-l-4 border-slate-900 bg-slate-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-500">
                {sentences.map((s, i) =>
                  best.has(i) ? (
                    <mark key={i} className="bg-yellow-200 text-slate-900">
                      {s}
                    </mark>
                  ) : (
                    <span key={i}>{s}</span>
                  ),
                )}
              </blockquote>
              <details className="mt-3">
                <summary className={cn("cursor-pointer rounded-sm text-xs font-medium text-slate-700", FOCUS_RING_LIGHT)}>
                  Ver fragmento completo
                </summary>
                <p className="mt-2 max-h-60 overflow-y-auto text-sm whitespace-pre-wrap text-slate-800">
                  {chunk.content}
                </p>
              </details>
            </>
          )}
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
