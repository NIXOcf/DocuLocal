import { createContext } from "react"
import type { Conversation, Feedback, Message } from "@/types"

export type ListStatus = "loading" | "ready" | "error"

/** Pregunta en vuelo: se muestra mientras llega la respuesta completa. */
export interface PendingQuestion {
  /** null mientras se crea la conversación implícita. */
  conversationId: string | null
  text: string
}

export interface ChatContextValue {
  conversations: Conversation[]
  listStatus: ListStatus
  reloadConversations: () => void
  /** Mensajes cargados por conversación (undefined = aún no cargada). */
  messagesByConversation: Record<string, Message[]>
  loadMessages: (conversationId: string) => Promise<void>
  /** Pregunta esperando respuesta (null si no hay ninguna). */
  pending: PendingQuestion | null
  /**
   * Envía la pregunta. Si `conversationId` es null crea la conversación y avisa con
   * `onCreated`. Devuelve false si falló o no se envió (el llamador restaura el borrador).
   */
  sendMessage: (
    conversationId: string | null,
    rawText: string,
    onCreated?: (id: string) => void,
  ) => Promise<boolean>
  setFeedback: (conversationId: string, messageId: string, value: Feedback) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<boolean>
  deleteConversation: (id: string) => Promise<boolean>
}

export const ChatContext = createContext<ChatContextValue | null>(null)
