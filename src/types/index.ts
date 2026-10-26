export type View = "chat" | "admin"

export interface Source {
  id: string
  filename: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
}

export interface ChatHistoryItem {
  id: string
  title: string
}

export type DocStatus = "Indexado" | "Procesando"

export interface DocumentItem {
  id: string
  name: string
  size: string
  uploadedAt: string
  status: DocStatus
}
