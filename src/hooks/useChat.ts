import { useContext } from "react"
import { ChatContext } from "@/context/ChatContext"
import type { ChatContextValue } from "@/context/ChatContext"

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext)
  if (context === null) {
    throw new Error("useChat debe usarse dentro de ChatProvider")
  }
  return context
}
