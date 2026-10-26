import { useEffect, useRef, useState } from "react"
import type { FormEvent, MouseEvent } from "react"
import {
  Bot,
  FileText,
  Loader2,
  Send,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import SourceDialog from "@/components/SourceDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChat } from "@/hooks/useChat"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { Feedback, Message } from "@/types"

const MAX_INPUT_LENGTH = 2000

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola, soy el asistente de DocuLocal. Puedo responder preguntas sobre las políticas, procedimientos y contratos de la organización a partir de los documentos indexados. ¿En qué puedo ayudarte?",
  createdAt: 0,
}

function AssistantAvatar() {
  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-slate-900"
      aria-hidden="true"
    >
      <Bot className="size-4 text-white" />
    </div>
  )
}

function ChatView() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const {
    conversations,
    streaming,
    phase,
    activeConversationId,
    sendMessage,
    stopGeneration,
    setFeedback,
  } = useChat()
  const reducedMotion = useReducedMotion()

  const [input, setInput] = useState("")
  const [feedbackAnnouncement, setFeedbackAnnouncement] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogFilename, setDialogFilename] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sourceTriggerRef = useRef<HTMLElement | null>(null)
  const stopHadFocusRef = useRef(false)

  const conversation =
    chatId !== undefined ? conversations.find((c) => c.id === chatId) : undefined
  const messages = conversation?.messages ?? []
  const isGenerating = phase !== "idle"
  const isGeneratingHere =
    isGenerating && conversation !== undefined && activeConversationId === conversation.id
  const streamingText =
    streaming !== null && conversation !== undefined && streaming.conversationId === conversation.id
      ? streaming.text
      : null

  // Auto-scroll al final sin mover el foco.
  useEffect(() => {
    const container = scrollRef.current
    if (container === null) return
    container.scrollTo({
      top: container.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    })
  }, [messages.length, streamingText, isGeneratingHere, reducedMotion])

  // Si el botón "Detener" tenía el foco y desaparece, el foco vuelve al input.
  useEffect(() => {
    if (isGenerating || !stopHadFocusRef.current) return
    stopHadFocusRef.current = false
    const active = document.activeElement
    if (active === null || active === document.body) {
      inputRef.current?.focus()
    }
  }, [isGenerating])

  if (chatId !== undefined && conversation === undefined) {
    return <Navigate to="/chat" replace />
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isGenerating) return
    const id = sendMessage(conversation?.id ?? null, input)
    if (id === null) return
    setInput("")
    if (conversation === undefined) {
      navigate(`/chat/${encodeURIComponent(id)}`, { replace: true })
    }
    inputRef.current?.focus()
  }

  const handleStop = () => {
    stopHadFocusRef.current = false
    stopGeneration()
    inputRef.current?.focus()
  }

  const openSource = (e: MouseEvent<HTMLButtonElement>, filename: string) => {
    sourceTriggerRef.current = e.currentTarget
    setDialogFilename(filename)
    setDialogOpen(true)
  }

  const handleFeedback = (messageId: string, current: Feedback | undefined, value: Feedback) => {
    if (conversation === undefined) return
    const willRemove = current === value
    setFeedback(conversation.id, messageId, value)
    setFeedbackAnnouncement(willRemove ? "Valoración eliminada" : "Valoración registrada")
  }

  const visibleMessages = messages.length === 0 ? [WELCOME_MESSAGE] : messages

  const statusText =
    isGeneratingHere && phase === "searching"
      ? "Buscando en la base documental"
      : isGeneratingHere && phase === "streaming"
        ? "El asistente está escribiendo la respuesta"
        : ""

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-6">
        <h1 className="text-sm font-semibold text-slate-900">
          Asistente DocuLocal
        </h1>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversación"
            className="flex flex-col gap-4"
          >
            {visibleMessages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[70%] whitespace-pre-wrap break-words rounded-sm bg-slate-900 px-4 py-2.5 text-sm leading-relaxed text-white">
                    <span className="sr-only">Tú: </span>
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex items-start gap-3">
                  <AssistantAvatar />
                  <div className="max-w-[70%] rounded-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800">
                    <p className="whitespace-pre-wrap break-words">
                      <span className="sr-only">Asistente: </span>
                      {message.content}
                    </p>
                    {message.id !== WELCOME_MESSAGE.id && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        {message.sources && message.sources.length > 0 && (
                          <p className="mb-2 text-xs font-medium text-slate-600">
                            Fuentes citadas:
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {message.sources?.map((source) => (
                            <button
                              key={source.id}
                              type="button"
                              aria-haspopup="dialog"
                              aria-label={`Ver fragmento citado de ${source.filename}`}
                              onClick={(e) => openSource(e, source.filename)}
                              className={cn(
                                "inline-flex min-h-7 items-center gap-1.5 rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-500 hover:bg-slate-200",
                                FOCUS_RING_LIGHT,
                              )}
                            >
                              <FileText className="size-3.5" aria-hidden="true" />
                              {source.filename}
                            </button>
                          ))}
                          <div
                            role="group"
                            aria-label="Valorar esta respuesta"
                            className="ml-auto flex items-center gap-1.5"
                          >
                            {(
                              [
                                {
                                  value: "up",
                                  label: "Marcar respuesta como útil",
                                  Icon: ThumbsUp,
                                },
                                {
                                  value: "down",
                                  label: "Marcar respuesta como no útil",
                                  Icon: ThumbsDown,
                                },
                              ] as const
                            ).map(({ value, label, Icon }) => {
                              const pressed = message.feedback === value
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  aria-pressed={pressed}
                                  aria-label={label}
                                  title={label}
                                  onClick={() =>
                                    handleFeedback(message.id, message.feedback, value)
                                  }
                                  className={cn(
                                    "inline-flex size-8 items-center justify-center rounded-sm border transition-colors",
                                    FOCUS_RING_LIGHT,
                                    pressed
                                      ? "border-2 border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:bg-slate-100",
                                  )}
                                >
                                  <Icon
                                    className="size-4"
                                    fill={pressed ? "currentColor" : "none"}
                                    aria-hidden="true"
                                  />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          {isGeneratingHere && phase === "searching" && (
            <div className="flex items-start gap-3" aria-hidden="true">
              <AssistantAvatar />
              <div className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                Buscando en la base documental...
              </div>
            </div>
          )}

          {isGeneratingHere && phase === "streaming" && streamingText !== null && (
            <div className="flex items-start gap-3" aria-hidden="true">
              <AssistantAvatar />
              <div className="max-w-[70%] rounded-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800">
                <p className="whitespace-pre-wrap break-words">
                  {streamingText}
                  <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-slate-900 motion-safe:animate-pulse" />
                </p>
              </div>
            </div>
          )}

          <p role="status" className="sr-only">
            {statusText}
          </p>
          <p role="status" className="sr-only">
            {feedbackAnnouncement}
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
        {isGenerating && !isGeneratingHere && (
          <p className="mx-auto mb-2 max-w-4xl text-xs text-slate-600">
            Hay una respuesta generándose en otra conversación. Podrás enviar tu
            mensaje cuando termine.
          </p>
        )}
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl items-center gap-2"
        >
          <label htmlFor="chat-input" className="sr-only">
            Escribe tu pregunta
          </label>
          <Input
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_INPUT_LENGTH}
            autoComplete="off"
            aria-describedby="chat-input-help"
            placeholder="Escribe tu pregunta sobre la documentación corporativa..."
            className="h-11 flex-1 rounded-sm border-slate-500 bg-white text-slate-900 placeholder:text-slate-600 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          />
          <span id="chat-input-help" className="sr-only">
            Pulsa Enter para enviar
          </span>
          {isGenerating && (
            <Button
              type="button"
              variant="outline"
              onClick={handleStop}
              onFocus={() => {
                stopHadFocusRef.current = true
              }}
              className={cn(
                "h-11 gap-2 rounded-sm border-slate-500 bg-white px-4 text-slate-900 hover:bg-slate-100",
                FOCUS_RING_LIGHT,
              )}
            >
              <Square className="size-4" fill="currentColor" aria-hidden="true" />
              Detener generación
            </Button>
          )}
          <Button
            type="submit"
            aria-label="Enviar mensaje"
            disabled={isGenerating || input.trim() === ""}
            className={cn(
              "h-11 gap-2 rounded-sm bg-slate-900 px-4 text-white hover:bg-slate-800",
              FOCUS_RING_LIGHT,
            )}
          >
            <Send className="size-4" aria-hidden="true" />
            Enviar
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-4xl text-xs text-slate-600">
          Las respuestas se generan a partir de los documentos indexados.
        </p>
      </div>

      <SourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        filename={dialogFilename}
        returnFocusRef={sourceTriggerRef}
      />
    </div>
  )
}

export default ChatView
