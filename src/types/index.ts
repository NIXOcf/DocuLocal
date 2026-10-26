export type Role = "employee" | "admin"

export interface UserSession {
  role: Role
  displayName: string
  loggedAt: number
  expiresAt: number
}

export type AccessLevel = "General" | "Jefatura" | "Gerencia"

export interface Source {
  id: string
  filename: string
}

export type Feedback = "up" | "down" | null

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  feedback?: Feedback
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export type DocStatus = "Indexado" | "Procesando"

export interface DocumentItem {
  id: string
  name: string
  size: string
  /** Fecha de carga en formato ISO 8601. */
  uploadedAt: string
  status: DocStatus
  accessLevel: AccessLevel
}
