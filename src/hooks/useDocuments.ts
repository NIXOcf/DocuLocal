import { useContext } from "react"
import { DocumentsContext } from "@/context/DocumentsContext"
import type { DocumentsContextValue } from "@/context/DocumentsContext"

export function useDocuments(): DocumentsContextValue {
  const context = useContext(DocumentsContext)
  if (context === null) {
    throw new Error("useDocuments debe usarse dentro de DocumentsProvider")
  }
  return context
}
