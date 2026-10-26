import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { Bot, FileText, Loader2, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { mockResponses } from "@/data/mockData"
import type { Message } from "@/types"

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola, soy el asistente de BaseSaber. Puedo responder preguntas sobre las políticas, procedimientos y contratos de la organización a partir de los documentos indexados. ¿En qué puedo ayudarte?",
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function ChatView() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const timeoutRef = useRef<number | null>(null)
  const responseIndexRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isTyping])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const text = input.trim()
    if (text === "" || isTyping) return

    const userMessage: Message = {
      id: createId("user"),
      role: "user",
      content: text,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    timeoutRef.current = window.setTimeout(() => {
      const response =
        mockResponses[responseIndexRef.current % mockResponses.length]
      responseIndexRef.current += 1
      const assistantMessage: Message = {
        id: createId("assistant"),
        role: "assistant",
        content: response.content,
        sources: response.sources,
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsTyping(false)
      timeoutRef.current = null
    }, 1500)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-6">
        <h1 className="text-sm font-semibold text-slate-900">
          Asistente BaseSaber
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[70%] whitespace-pre-wrap rounded-sm bg-slate-900 px-4 py-2.5 text-sm leading-relaxed text-white">
                  {message.content}
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-slate-900">
                  <Bot className="size-4 text-white" />
                </div>
                <div className="max-w-[70%] rounded-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        Fuentes citadas:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {message.sources.map((source) => (
                          <Badge
                            key={source.id}
                            variant="outline"
                            className="rounded-sm border-slate-200 bg-slate-100 text-slate-700"
                          >
                            <FileText />
                            {source.filename}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-slate-900">
                <Bot className="size-4 text-white" />
              </div>
              <div className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Buscando en la base documental...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta sobre la documentación corporativa..."
            disabled={isTyping}
            aria-label="Mensaje"
            className="h-10 flex-1 rounded-sm border-slate-300 bg-white"
          />
          <Button
            type="submit"
            disabled={isTyping || input.trim() === ""}
            className="h-10 gap-2 rounded-sm bg-slate-900 px-4 text-white hover:bg-slate-800"
          >
            <Send className="size-4" />
            Enviar
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-4xl text-xs text-slate-400">
          Las respuestas se generan a partir de los documentos indexados.
        </p>
      </div>
    </div>
  )
}

export default ChatView
