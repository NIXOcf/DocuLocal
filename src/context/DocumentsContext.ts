import { createContext } from "react"
import type { ListStatus } from "@/context/ChatContext"
import type { AccessLevel, DocumentItem } from "@/types"

export interface RejectedFile {
  name: string
  reason: string
}

export interface AddFilesResult {
  added: number
  rejected: RejectedFile[]
}

export interface DocumentsContextValue {
  documents: DocumentItem[]
  status: ListStatus
  page: number
  pages: number
  total: number
  setPage: (page: number) => void
  reload: () => void
  /** Archivos pendientes de subir (en cola o subiéndose ahora). */
  queued: number
  /** Porcentaje de subida del archivo en curso (null si no hay subida). */
  progress: number | null
  /** Cancela el archivo que se está subiendo. */
  cancelUpload: () => void
  /** Valida y encola los archivos; se suben de a uno. */
  addFiles: (files: File[], accessLevel: AccessLevel) => AddFilesResult
  removeDocument: (id: string) => Promise<boolean>
}

export const DocumentsContext = createContext<DocumentsContextValue | null>(null)
