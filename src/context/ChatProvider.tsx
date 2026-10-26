import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { ChatContext } from "@/context/ChatContext"
import type {
  ChatContextValue,
  ChatPhase,
  StreamingState,
} from "@/context/ChatContext"
import { mockResponses, seedConversations } from "@/data/mockData"
import { createId } from "@/lib/id"
import { prefersReducedMotion } from "@/lib/motion"
import { sanitizeText } from "@/lib/sanitize"
import { STORAGE_KEYS, safeGet, safeSet } from "@/lib/storage"
import { LIMITS, isConversationList } from "@/lib/validators"
import type { Conversation, Feedback, Message, Source } from "@/types"

const MAX_INPUT_LENGTH = 2000
const TITLE_LENGTH = 40
const SEARCH_DELAY_MS = 1200
const STREAM_INTERVAL_MS = 35
const STOPPED_SUFFIX = " [Generación detenida]"

interface Generation {
  conversationId: string
  tokens: string[]
  index: number
  text: string
  fullText: string
  sources: Source[]
}

/** Ordena por actividad reciente y aplica los límites de almacenamiento. */
function enforceLimits(list: Conversation[]): Conversation[] {
  return [...list]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, LIMITS.conversations)
    .map((conversation) =>
      conversation.messages.length > LIMITS.messagesPerConversation
        ? {
            ...conversation,
            messages: conversation.messages.slice(-LIMITS.messagesPerConversation),
          }
        : conversation,
    )
}

function loadConversations(): Conversation[] {
  return enforceLimits(
    safeGet(STORAGE_KEYS.conversations, isConversationList, seedConversations),
  )
}

function countAssistantMessages(list: Conversation[]): number {
  return list.reduce(
    (total, conversation) =>
      total + conversation.messages.filter((m) => m.role === "assistant").length,
    0,
  )
}

function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] =
    useState<Conversation[]>(loadConversations)
  const [streaming, setStreaming] = useState<StreamingState | null>(null)
  const [phase, setPhaseState] = useState<ChatPhase>("idle")
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null)

  const conversationsRef = useRef(conversations)
  const phaseRef = useRef<ChatPhase>("idle")
  // Id de la conversación en generación; se lee en stopGeneration durante "searching".
  const activeIdRef = useRef<string | null>(null)
  const generationRef = useRef<Generation | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const streamIntervalRef = useRef<number | null>(null)

  // Solo se persisten mensajes completos: el texto en streaming vive en otro estado.
  useEffect(() => {
    conversationsRef.current = conversations
    safeSet(STORAGE_KEYS.conversations, conversations)
  }, [conversations])

  const clearTimers = useCallback(() => {
    if (searchTimeoutRef.current !== null) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    if (streamIntervalRef.current !== null) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
    }
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const setPhase = useCallback((next: ChatPhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const updateConversations = useCallback(
    (updater: (prev: Conversation[]) => Conversation[]) => {
      const next = enforceLimits(updater(conversationsRef.current))
      conversationsRef.current = next
      setConversations(next)
    },
    [],
  )

  const appendMessage = useCallback(
    (conversationId: string, message: Message) => {
      updateConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [...conversation.messages, message],
                updatedAt: message.createdAt,
              }
            : conversation,
        ),
      )
    },
    [updateConversations],
  )

  const finishGeneration = useCallback(() => {
    clearTimers()
    generationRef.current = null
    activeIdRef.current = null
    setStreaming(null)
    setActiveConversationId(null)
    setPhase("idle")
  }, [clearTimers, setPhase])

  const commitAssistant = useCallback(
    (conversationId: string, content: string, sources?: Source[]) => {
      const message: Message = {
        id: createId("assistant"),
        role: "assistant",
        content,
        feedback: null,
        createdAt: Date.now(),
      }
      if (sources && sources.length > 0) {
        message.sources = sources
      }
      appendMessage(conversationId, message)
    },
    [appendMessage],
  )

  const startGeneration = useCallback(
    (conversationId: string) => {
      activeIdRef.current = conversationId
      setActiveConversationId(conversationId)
      setPhase("searching")

      searchTimeoutRef.current = window.setTimeout(() => {
        searchTimeoutRef.current = null
        const index =
          countAssistantMessages(conversationsRef.current) % mockResponses.length
        const response = mockResponses[index]

        if (prefersReducedMotion()) {
          commitAssistant(conversationId, response.content, response.sources)
          finishGeneration()
          return
        }

        const generation: Generation = {
          conversationId,
          tokens: response.content.split(/(\s+)/),
          index: 0,
          text: "",
          fullText: response.content,
          sources: response.sources,
        }
        generationRef.current = generation
        setStreaming({ conversationId, text: "" })
        setPhase("streaming")

        streamIntervalRef.current = window.setInterval(() => {
          const current = generationRef.current
          if (current === null) return
          // Avanza una palabra junto con el espacio que la sigue.
          current.index = Math.min(current.index + 2, current.tokens.length)
          current.text = current.tokens.slice(0, current.index).join("")
          if (current.index >= current.tokens.length) {
            commitAssistant(current.conversationId, current.fullText, current.sources)
            finishGeneration()
            return
          }
          setStreaming({ conversationId: current.conversationId, text: current.text })
        }, STREAM_INTERVAL_MS)
      }, SEARCH_DELAY_MS)
    },
    [commitAssistant, finishGeneration, setPhase],
  )

  const sendMessage = useCallback(
    (conversationId: string | null, rawText: string): string | null => {
      const text = sanitizeText(rawText, MAX_INPUT_LENGTH)
      if (text === "" || phaseRef.current !== "idle") return null

      const now = Date.now()
      const userMessage: Message = {
        id: createId("user"),
        role: "user",
        content: text,
        createdAt: now,
      }

      const exists =
        conversationId !== null &&
        conversationsRef.current.some((c) => c.id === conversationId)

      let targetId: string
      if (exists && conversationId !== null) {
        targetId = conversationId
        appendMessage(targetId, userMessage)
      } else {
        targetId = createId("chat")
        const title =
          text.replace(/\s+/g, " ").slice(0, TITLE_LENGTH).trim() ||
          "Nueva conversación"
        const conversation: Conversation = {
          id: targetId,
          title,
          messages: [userMessage],
          createdAt: now,
          updatedAt: now,
        }
        updateConversations((prev) => [conversation, ...prev])
      }

      startGeneration(targetId)
      return targetId
    },
    [appendMessage, startGeneration, updateConversations],
  )

  const stopGeneration = useCallback(() => {
    if (phaseRef.current === "idle") return
    const generation = generationRef.current
    const conversationId = generation?.conversationId ?? activeIdRef.current
    const partial = generation?.text.trimEnd() ?? ""
    clearTimers()
    if (conversationId !== null) {
      commitAssistant(conversationId, `${partial}${STOPPED_SUFFIX}`.trim())
    }
    finishGeneration()
  }, [clearTimers, commitAssistant, finishGeneration])

  const setFeedback = useCallback(
    (conversationId: string, messageId: string, value: Feedback) => {
      updateConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: conversation.messages.map((message) =>
                  message.id === messageId && message.role === "assistant"
                    ? {
                        ...message,
                        feedback: message.feedback === value ? null : value,
                      }
                    : message,
                ),
              }
            : conversation,
        ),
      )
    },
    [updateConversations],
  )

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      streaming,
      phase,
      activeConversationId,
      sendMessage,
      stopGeneration,
      setFeedback,
    }),
    [
      conversations,
      streaming,
      phase,
      activeConversationId,
      sendMessage,
      stopGeneration,
      setFeedback,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export default ChatProvider
