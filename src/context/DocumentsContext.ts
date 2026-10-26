import { createContext } from "react"
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
  addFiles: (files: File[], accessLevel: AccessLevel) => AddFilesResult
  removeDocument: (id: string) => void
}

export const DocumentsContext = createContext<DocumentsContextValue | null>(null)
