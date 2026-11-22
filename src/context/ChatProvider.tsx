import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { ChatContext } from "@/context/ChatContext"
import type { ChatContextValue, ListStatus, PendingQuestion } from "@/context/ChatContext"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { errorMessage, request } from "@/lib/api"
import type { Page } from "@/lib/api"
import type { Conversation, Feedback, Message } from "@/types"

const MAX_INPUT_LENGTH = 2000
const TITLE_LENGTH = 60
const LIST_PAGE_SIZE = 50

type ConversationWithMessages = Conversation & { messages: Message[] }
type AssistantResponse = Message & { question: Message }

/** Se monta con `key` = id de usuario (ver App): al cambiar de usuario se reinicia todo. */
function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { notify } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [listStatus, setListStatus] = useState<ListStatus>(isAuthenticated ? "loading" : "ready")
  const [messagesByConversation, setMessages] = useState<Record<string, Message[]>>({})
  const [pending, setPending] = useState<PendingQuestion | null>(null)
  const [listVersion, setListVersion] = useState(0)
  const pendingRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    request<Page<Conversation>>(`/conversations?pagina=1&tamano=${LIST_PAGE_SIZE}`)
      .then((page) => {
        if (cancelled) return
        setConversations(page.datos)
        setListStatus("ready")
      })
      .catch(() => !cancelled && setListStatus("error"))
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, listVersion])

  const reloadConversations = useCallback(() => {
    setListStatus("loading")
    setListVersion((v) => v + 1)
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    const data = await request<ConversationWithMessages>(
      `/conversations/${encodeURIComponent(conversationId)}`,
    )
    // Si mientras tanto ya hay mensajes (p. ej. una pregunta recién enviada), se conservan.
    setMessages((prev) =>
      prev[conversationId] ? prev : { ...prev, [conversationId]: data.messages },
    )
  }, [])

  const touchConversation = useCallback((id: string, updatedAt: number) => {
    setConversations((prev) => {
      const current = prev.find((c) => c.id === id)
      return current ? [{ ...current, updatedAt }, ...prev.filter((c) => c.id !== id)] : prev
    })
  }, [])

  const sendMessage = useCallback<ChatContextValue["sendMessage"]>(
    async (conversationId, rawText, onCreated) => {
      const text = rawText.trim()
      if (text === "" || text.length > MAX_INPUT_LENGTH || pendingRef.current) return false
      pendingRef.current = true
      setPending({ conversationId, text })
      try {
        let id = conversationId
        if (id === null) {
          const created = await request<Conversation>("/conversations", {
            method: "POST",
            json: { title: text.slice(0, TITLE_LENGTH) },
          })
          id = created.id
          setConversations((prev) => [created, ...prev])
          setMessages((prev) => ({ ...prev, [created.id]: [] }))
          setPending({ conversationId: id, text })
          onCreated?.(id)
        }
        const { question, ...answer } = await request<AssistantResponse>(
          `/conversations/${encodeURIComponent(id)}/messages`,
          { method: "POST", json: { content: text } },
        )
        const convId = id
        setMessages((prev) => ({
          ...prev,
          [convId]: [...(prev[convId] ?? []), question, answer],
        }))
        touchConversation(convId, answer.createdAt)
        return true
      } catch (error) {
        notify("error", errorMessage(error, "No se pudo enviar la pregunta."))
        return false
      } finally {
        pendingRef.current = false
        setPending(null)
      }
    },
    [notify, touchConversation],
  )

  const setFeedback = useCallback(
    async (conversationId: string, messageId: string, value: Feedback) => {
      const apply = (feedback: Feedback) =>
        setMessages((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) =>
            m.id === messageId ? { ...m, feedback } : m,
          ),
        }))
      const previous =
        messagesByConversation[conversationId]?.find((m) => m.id === messageId)?.feedback ?? null
      const next = previous === value ? null : value
      apply(next)
      try {
        await request(
          `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
          { method: "PATCH", json: { feedback: next } },
        )
      } catch (error) {
        apply(previous)
        notify("error", errorMessage(error, "No se pudo guardar la valoración."))
      }
    },
    [messagesByConversation, notify],
  )

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        const updated = await request<Conversation>(`/conversations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          json: { title },
        })
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)))
        return true
      } catch (error) {
        notify("error", errorMessage(error, "No se pudo renombrar la conversación."))
        return false
      }
    },
    [notify],
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await request(`/conversations/${encodeURIComponent(id)}`, { method: "DELETE" })
        setConversations((prev) => prev.filter((c) => c.id !== id))
        setMessages(({ [id]: _removed, ...rest }) => rest)
        return true
      } catch (error) {
        notify("error", errorMessage(error, "No se pudo eliminar la conversación."))
        return false
      }
    },
    [notify],
  )

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      listStatus,
      reloadConversations,
      messagesByConversation,
      loadMessages,
      pending,
      sendMessage,
      setFeedback,
      renameConversation,
      deleteConversation,
    }),
    [
      conversations,
      listStatus,
      reloadConversations,
      messagesByConversation,
      loadMessages,
      pending,
      sendMessage,
      setFeedback,
      renameConversation,
      deleteConversation,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export default ChatProvider
