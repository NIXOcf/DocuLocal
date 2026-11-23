import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { ListStatus } from "@/context/ChatContext"
import { DocumentsContext } from "@/context/DocumentsContext"
import type {
  AddFilesResult,
  DocumentsContextValue,
  RejectedFile,
} from "@/context/DocumentsContext"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { ApiError, errorMessage, isAbort, request, uploadWithProgress } from "@/lib/api"
import type { Page } from "@/lib/api"
import { sanitizeFilename, validateUpload } from "@/lib/sanitize"
import type { AccessLevel, DocumentItem } from "@/types"

const MAX_FILES_PER_OPERATION = 10
const PAGE_SIZE = 20
const POLL_INTERVAL_MS = 2000

interface QueueItem {
  file: File
  accessLevel: AccessLevel
}

/** Se monta con `key` = id de usuario (ver App). Solo el admin carga la lista. */
function DocumentsProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  const { notify } = useToast()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [status, setStatus] = useState<ListStatus>(isAdmin ? "loading" : "ready")
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [version, setVersion] = useState(0)
  const [queued, setQueued] = useState(0)

  const documentsRef = useRef(documents)
  const queueRef = useRef<QueueItem[]>([])
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  // Al desmontar (cambio de usuario) se descarta la cola y se cancela la subida en curso.
  useEffect(() => {
    const queue = queueRef
    const abort = abortRef
    return () => {
      queue.current = []
      abort.current?.abort()
    }
  }, [])

  const cancelUpload = useCallback(() => abortRef.current?.abort(), [])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    request<Page<DocumentItem>>(`/documents?pagina=${page}&tamano=${PAGE_SIZE}`)
      .then((result) => {
        if (cancelled) return
        setDocuments(result.datos)
        setPages(Math.max(1, result.paginacion.paginas))
        setTotal(result.paginacion.total)
        setStatus("ready")
      })
      .catch(() => !cancelled && setStatus("error"))
    return () => {
      cancelled = true
    }
  }, [isAdmin, page, version])

  const reload = useCallback(() => {
    setStatus("loading")
    setVersion((v) => v + 1)
  }, [])

  // Sondeo: consulta cada documento en "Procesando" hasta que quede Indexado o Error.
  const hasProcessing = documents.some((d) => d.status === "Procesando")
  useEffect(() => {
    if (!hasProcessing) return
    const timer = window.setInterval(() => {
      documentsRef.current
        .filter((d) => d.status === "Procesando")
        .forEach(async ({ id, name }) => {
          try {
            const doc = await request<DocumentItem>(`/documents/${encodeURIComponent(id)}`)
            if (doc.status === "Procesando") return
            setDocuments((prev) => prev.map((d) => (d.id === id ? doc : d)))
            if (doc.status === "Error") {
              notify("error", `${name}: ${doc.errorMessage ?? "No se pudo indexar el documento."}`)
            } else {
              notify("success", `${name} quedó indexado.`)
            }
          } catch (error) {
            // 404: ya no existe (borrado en otra sesión); otros errores se reintentan.
            if (error instanceof ApiError && error.status === 404) {
              setDocuments((prev) => prev.filter((d) => d.id !== id))
            }
          }
        })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasProcessing, notify])

  // Cola secuencial: un archivo por POST.
  const processQueue = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    while (queueRef.current.length > 0) {
      const { file, accessLevel } = queueRef.current[0]
      try {
        const form = new FormData()
        form.append("file", file)
        form.append("accessLevel", accessLevel)
        const controller = new AbortController()
        abortRef.current = controller
        setProgress(0)
        await uploadWithProgress<DocumentItem>("/documents", form, setProgress, controller.signal)
        setPage(1)
        setVersion((v) => v + 1)
      } catch (error) {
        if (!isAbort(error)) notify("error", `${sanitizeFilename(file.name)}: ${errorMessage(error)}`)
      }
      abortRef.current = null
      setProgress(null)
      queueRef.current.shift()
      setQueued(queueRef.current.length)
    }
    runningRef.current = false
  }, [notify])

  const addFiles = useCallback(
    (files: File[], accessLevel: AccessLevel): AddFilesResult => {
      const rejected: RejectedFile[] = []
      let added = 0
      files.forEach((file, index) => {
        const name = sanitizeFilename(file.name)
        if (index >= MAX_FILES_PER_OPERATION) {
          rejected.push({
            name,
            reason: `Se superó el máximo de ${MAX_FILES_PER_OPERATION} archivos por operación.`,
          })
          return
        }
        const validation = validateUpload(file)
        if (!validation.ok) {
          rejected.push({ name, reason: validation.reason })
          return
        }
        queueRef.current.push({ file, accessLevel })
        added += 1
      })
      if (added > 0) {
        setQueued(queueRef.current.length)
        void processQueue()
      }
      return { added, rejected }
    },
    [processQueue],
  )

  const removeDocument = useCallback(
    async (id: string) => {
      try {
        await request(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" })
      } catch (error) {
        notify("error", errorMessage(error, "No se pudo eliminar el documento."))
        return false
      }
      if (documentsRef.current.length === 1 && page > 1) setPage(page - 1)
      else setVersion((v) => v + 1)
      return true
    },
    [notify, page],
  )

  const value = useMemo<DocumentsContextValue>(
    () => ({
      documents,
      status,
      page,
      pages,
      total,
      setPage,
      reload,
      queued,
      progress,
      cancelUpload,
      addFiles,
      removeDocument,
    }),
    [documents, status, page, pages, total, reload, queued, progress, cancelUpload, addFiles, removeDocument],
  )

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>
}

export default DocumentsProvider
