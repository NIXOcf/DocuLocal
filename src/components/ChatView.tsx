import { useEffect, useRef, useState } from "react"
import type { FormEvent, MouseEvent } from "react"
import { Bot, Check, Copy, FileText, Info, Loader2, Send } from "lucide-react"
import Markdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Link, useNavigate, useParams } from "react-router-dom"
import SourceDialog from "@/components/SourceDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChat } from "@/hooks/useChat"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { ApiError } from "@/lib/api"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { Message, Source } from "@/types"

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

// Quita `node` (prop interno de react-markdown) para no pasarlo al DOM.
function clean<T extends object>(props: T): Omit<T, "node"> {
  const { node: _node, ...rest } = props as T & { node?: unknown }
  return rest
}

const mdBase: Components = {
  p: (p) => <p className="mb-2 break-words last:mb-0" {...clean(p)} />,
  ul: (p) => <ul className="mb-2 list-disc pl-5 last:mb-0" {...clean(p)} />,
  ol: (p) => <ol className="mb-2 list-decimal pl-5 last:mb-0" {...clean(p)} />,
  li: (p) => <li className="mb-0.5" {...clean(p)} />,
  strong: (p) => <strong className="font-semibold" {...clean(p)} />,
  h1: ({ children }) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 text-sm font-semibold">{children}</h4>,
  code: (p) => <code className="rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-xs" {...clean(p)} />,
  table: (p) => (
    <div className="mb-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...clean(p)} />
    </div>
  ),
  th: (p) => <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left" {...clean(p)} />,
  td: (p) => <td className="border border-slate-300 px-2 py-1" {...clean(p)} />,
  img: () => null,
}

function AssistantMarkdown({
  content,
  sources,
  onCite,
}: {
  content: string
  sources: Source[]
  onCite: (e: MouseEvent<HTMLButtonElement>, source: Source) => void
}) {
  // Las citas [n] con fuente existente pasan a enlaces internos #cite-n.
  // El primer grupo captura código (``` o `) para dejarlo intacto.
  const text = content.replace(
    /(```[\s\S]*?```|`[^`\n]*`)|\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g,
    (m, code: string | undefined, nums: string | undefined) => {
      if (code !== undefined || nums === undefined) return m
      const list = nums.split(",").map((n) => n.trim())
      if (!list.every((n) => sources.some((s) => s.ref === Number(n)))) return m
      return list.map((n) => `[${n}](#cite-${n})`).join("")
    },
  )
  const components: Components = {
    ...mdBase,
    a: ({ href, children }) => {
      const ref = href?.startsWith("#cite-") ? Number(href.slice(6)) : null
      const source = ref === null ? undefined : sources.find((s) => s.ref === ref)
      if (source !== undefined) {
        return (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Ver fuente [${source.ref}]`}
            disabled={source.id === null}
            onClick={(e) => onCite(e, source)}
            className={cn(
              "mx-0.5 inline-flex min-w-5 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 px-1 align-baseline text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60",
              FOCUS_RING_LIGHT,
            )}
          >
            {children}
          </button>
        )
      }
      if (href === undefined || !/^https?:\/\//i.test(href)) return <>{children}</>
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
          {children}
        </a>
      )
    },
  }
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </Markdown>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button
      type="button"
      aria-label={copied ? "Respuesta copiada" : "Copiar respuesta"}
      title="Copiar respuesta"
      onClick={() => void copy()}
      className={cn(
        "ml-auto inline-flex size-8 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-700 transition-colors hover:border-slate-500 hover:bg-slate-100",
        FOCUS_RING_LIGHT,
      )}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
    </button>
  )
}

function ChatView() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { messagesByConversation, loadMessages, pending, sendMessage } = useChat()
  const reducedMotion = useReducedMotion()

  const [input, setInput] = useState("")
  const [dialogAnswer, setDialogAnswer] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogSource, setDialogSource] = useState<Source | null>(null)
  const [loadError, setLoadError] = useState<{ id: string; notFound: boolean } | null>(null)
  const [retry, setRetry] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sourceTriggerRef = useRef<HTMLElement | null>(null)

  const cached = chatId !== undefined ? messagesByConversation[chatId] : undefined
  const hasCache = cached !== undefined
  const messages = cached ?? []
  const isGenerating = pending !== null
  const isGeneratingHere = pending !== null && pending.conversationId === (chatId ?? null)
  const loadStatus: "loading" | "error" | "notFound" | "ready" =
    chatId === undefined || hasCache
      ? "ready"
      : loadError?.id === chatId
        ? loadError.notFound
          ? "notFound"
          : "error"
        : "loading"

  // Carga los mensajes de la conversación abierta si aún no están en memoria.
  useEffect(() => {
    if (chatId === undefined || hasCache) return
    let cancelled = false
    loadMessages(chatId).catch((error: unknown) => {
      if (!cancelled) {
        setLoadError({ id: chatId, notFound: error instanceof ApiError && error.status === 404 })
      }
    })
    return () => {
      cancelled = true
    }
  }, [chatId, hasCache, loadMessages, retry])

  // Auto-scroll al final sin mover el foco.
  useEffect(() => {
    const container = scrollRef.current
    if (container === null) return
    container.scrollTo({
      top: container.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    })
  }, [messages.length, isGeneratingHere, reducedMotion])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isGenerating || loadStatus !== "ready") return
    const text = input
    setInput("")
    const ok = await sendMessage(chatId ?? null, text, (id) =>
      navigate(`/chat/${encodeURIComponent(id)}`, { replace: true }),
    )
    // Si falló, se restaura el borrador (salvo que el usuario ya haya escrito otra cosa).
    if (!ok) setInput((current) => (current === "" ? text : current))
    inputRef.current?.focus()
  }

  const openSource = (e: MouseEvent<HTMLButtonElement>, source: Source, answer: string) => {
    sourceTriggerRef.current = e.currentTarget
    setDialogAnswer(answer)
    setDialogSource(source)
    setDialogOpen(true)
  }

  const visibleMessages = messages.length === 0 ? [WELCOME_MESSAGE] : messages

  const statusText = isGeneratingHere ? "Buscando en la base documental" : ""

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-6">
        <h1 className="text-sm font-semibold text-slate-900">
          Asistente DocuLocal
        </h1>
      </header>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {loadStatus === "loading" && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Cargando conversación...
            </p>
          )}
          {(loadStatus === "error" || loadStatus === "notFound") && (
            <div role="alert" className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {loadStatus === "notFound" ? (
                <>
                  <p>La conversación no existe o no tienes acceso a ella.</p>
                  <Link to="/chat" className="mt-2 inline-block font-medium underline">
                    Iniciar una conversación nueva
                  </Link>
                </>
              ) : (
                <>
                  <p>No se pudo cargar la conversación.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setLoadError(null)
                      setRetry((n) => n + 1)
                    }}
                    className={cn("mt-2 rounded-sm border-red-400 bg-white text-red-800", FOCUS_RING_LIGHT)}
                  >
                    Reintentar
                  </Button>
                </>
              )}
            </div>
          )}
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversación"
            className="flex flex-col gap-4"
          >
            {loadStatus === "ready" && visibleMessages.map((message) =>
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
                  <div
                    className={cn(
                      "max-w-[70%] rounded-sm border px-4 py-3 text-sm leading-relaxed text-slate-800",
                      message.grounded === false
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-white",
                    )}
                  >
                    {message.grounded === false && (
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                        <Info className="size-3.5" aria-hidden="true" />
                        Sin información en los documentos
                      </p>
                    )}
                    <div>
                      <span className="sr-only">Asistente: </span>
                      <AssistantMarkdown
                        content={message.content}
                        sources={message.sources ?? []}
                        onCite={(e, source) => openSource(e, source, message.content)}
                      />
                    </div>
                    {message.id !== WELCOME_MESSAGE.id && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        {message.sources && message.sources.length > 0 && (
                          <p className="mb-2 text-xs font-medium text-slate-600">
                            Fuentes citadas:
                          </p>
                        )}
                        {message.sources !== undefined &&
                          message.sources.length > 0 &&
                          message.sources.every((source) => source.id === null) && (
                            <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-600">
                              <Info className="size-3.5" aria-hidden="true" />
                              Basada en documentos que ya no están disponibles.
                            </p>
                          )}
                        <div className="flex flex-wrap items-center gap-2">
                          {message.sources?.map((source) => (
                            <button
                              key={source.ref}
                              type="button"
                              aria-haspopup="dialog"
                              aria-label={`Ver fragmento citado [${source.ref}] de ${source.filename}`}
                              disabled={source.id === null}
                              title={source.id === null ? "El documento fue eliminado" : undefined}
                              onClick={(e) => openSource(e, source, message.content)}
                              className={cn(
                                "inline-flex min-h-7 items-center gap-1.5 rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-500 hover:bg-slate-200 disabled:opacity-60",
                                FOCUS_RING_LIGHT,
                              )}
                            >
                              <FileText className="size-3.5" aria-hidden="true" />
                              <span>[{source.ref}]</span>
                              <span className="max-w-48 truncate">{source.filename}</span>
                              {source.page !== null && <span>· p. {source.page}</span>}
                            </button>
                          ))}
                          <CopyButton text={message.content} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          {isGeneratingHere && pending !== null && (
            <>
              <div className="flex justify-end">
                <div className="max-w-[70%] whitespace-pre-wrap break-words rounded-sm bg-slate-900 px-4 py-2.5 text-sm leading-relaxed text-white">
                  {pending.text}
                </div>
              </div>
              <div className="flex items-start gap-3" aria-hidden="true">
                <AssistantAvatar />
                <div className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Buscando en la base documental...
                </div>
              </div>
            </>
          )}

          <p role="status" className="sr-only">
            {statusText}
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
          <Button
            type="submit"
            aria-label="Enviar mensaje"
            disabled={isGenerating || loadStatus !== "ready" || input.trim() === ""}
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
          Las respuestas se generan a partir de los documentos indexados. No escribas datos personales de otras personas.
        </p>
      </div>

      <SourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        source={dialogSource}
        answer={dialogAnswer}
        returnFocusRef={sourceTriggerRef}
      />
    </div>
  )
}

export default ChatView
