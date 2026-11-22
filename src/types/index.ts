export type Role = "employee" | "admin"

export type AccessLevel = "General" | "Jefatura" | "Gerencia"

/** Usuario autenticado, tal como lo devuelve `/auth/me`. */
export interface UserSession {
  id: string
  email: string
  displayName: string
  role: Role
  accessLevel: AccessLevel
  department: string | null
}

export interface Source {
  /** Id del fragmento; null si el documento se eliminó después. */
  id: string | null
  ref: number
  filename: string
  documentId: string | null
  page: number | null
  score: number
  snippet: string
}

export type Feedback = "up" | "down" | null

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  feedback?: Feedback
  /** false = el asistente no encontró información en los documentos autorizados. */
  grounded?: boolean | null
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export type DocStatus = "Indexado" | "Procesando" | "Error"

export interface DocumentItem {
  id: string
  name: string
  size: string
  /** Fecha de carga en formato ISO 8601. */
  uploadedAt: string
  status: DocStatus
  accessLevel: AccessLevel
  department: string | null
  errorMessage: string | null
}

export interface Chunk {
  id: string
  documentId: string
  filename: string
  page: number | null
  content: string
}
