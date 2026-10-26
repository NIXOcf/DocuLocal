import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { DocumentsContext } from "@/context/DocumentsContext"
import type {
  AddFilesResult,
  DocumentsContextValue,
  RejectedFile,
} from "@/context/DocumentsContext"
import { mockDocuments } from "@/data/mockData"
import { createId } from "@/lib/id"
import { formatFileSize, sanitizeFilename, validateUpload } from "@/lib/sanitize"
import { STORAGE_KEYS, safeGet, safeSet } from "@/lib/storage"
import { LIMITS, isDocumentList } from "@/lib/validators"
import type { AccessLevel, DocumentItem } from "@/types"

const MAX_FILES_PER_OPERATION = 10
const INDEXING_DELAY_MS = 2500

function loadDocuments(): DocumentItem[] {
  const stored = safeGet(STORAGE_KEYS.documents, isDocumentList, mockDocuments)
  // Los temporizadores de indexación se pierden al recargar: se dan por terminados.
  return stored.map((doc) =>
    doc.status === "Procesando" ? { ...doc, status: "Indexado" } : doc,
  )
}

function DocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocumentItem[]>(loadDocuments)
  const documentsRef = useRef(documents)
  const timeoutsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    documentsRef.current = documents
    safeSet(STORAGE_KEYS.documents, documents)
  }, [documents])

  useEffect(() => {
    const timeouts = timeoutsRef.current
    return () => {
      timeouts.forEach((id) => clearTimeout(id))
      timeouts.clear()
    }
  }, [])

  const addFiles = useCallback(
    (files: File[], accessLevel: AccessLevel): AddFilesResult => {
      const rejected: RejectedFile[] = []
      const newDocs: DocumentItem[] = []
      let available = LIMITS.documents - documentsRef.current.length

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
        if (available <= 0) {
          rejected.push({
            name,
            reason: `Se alcanzó el límite de ${LIMITS.documents} documentos.`,
          })
          return
        }
        available -= 1
        // Solo se leen metadatos (nombre y tamaño): el contenido no se lee ni se sube.
        newDocs.push({
          id: createId("doc"),
          name,
          size: formatFileSize(file.size),
          uploadedAt: new Date().toISOString(),
          status: "Procesando",
          accessLevel,
        })
      })

      if (newDocs.length > 0) {
        const next = [...newDocs, ...documentsRef.current]
        documentsRef.current = next
        setDocuments(next)

        newDocs.forEach((doc) => {
          const timeoutId = window.setTimeout(() => {
            timeoutsRef.current.delete(timeoutId)
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === doc.id ? { ...d, status: "Indexado" } : d,
              ),
            )
          }, INDEXING_DELAY_MS)
          timeoutsRef.current.add(timeoutId)
        })
      }

      return { added: newDocs.length, rejected }
    },
    [],
  )

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const value = useMemo<DocumentsContextValue>(
    () => ({ documents, addFiles, removeDocument }),
    [documents, addFiles, removeDocument],
  )

  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  )
}

export default DocumentsProvider
