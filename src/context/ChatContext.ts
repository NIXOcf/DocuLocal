import { createContext } from "react"
import type { Conversation, Feedback } from "@/types"

export type ChatPhase = "idle" | "searching" | "streaming"

export interface StreamingState {
  conversationId: string
  text: string
}

export interface ChatContextValue {
  conversations: Conversation[]
  streaming: StreamingState | null
  phase: ChatPhase
  /** Conversación cuya respuesta se está generando (null si phase es "idle"). */
  activeConversationId: string | null
  sendMessage: (conversationId: string | null, rawText: string) => string | null
  stopGeneration: () => void
  setFeedback: (conversationId: string, messageId: string, value: Feedback) => void
}

export const ChatContext = createContext<ChatContextValue | null>(null)
