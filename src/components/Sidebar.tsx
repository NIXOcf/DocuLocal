import {
  BrainCircuit,
  Loader2,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import type { FormEvent, Ref } from "react"
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom"
import ConfirmDialog from "@/components/ConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { useChat } from "@/hooks/useChat"
import type { Conversation } from "@/types"
import { FOCUS_RING_DARK } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface SidebarProps {
  id?: string
  className?: string
  ref?: Ref<HTMLElement>
  /** Se invoca al activar un enlace (cierra el panel en pantallas pequeñas). */
  onNavigate?: () => void
  /** Reabre el aviso de privacidad. */
  onOpenPrivacy?: () => void
}

const ROW_ACTION_CLASS =
  "flex size-8 shrink-0 items-center justify-center rounded-sm text-slate-300 opacity-0 transition-opacity hover:bg-slate-700 hover:text-white focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"

const FOOTER_LINK_CLASS =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-slate-600 px-3 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"

function Sidebar({ id, className, ref, onNavigate, onOpenPrivacy }: SidebarProps) {
  const { session, isAdmin, logout } = useAuth()
  const { conversations, listStatus, reloadConversations, renameConversation, deleteConversation } =
    useChat()
  const [renaming, setRenaming] = useState<Conversation | null>(null)
  const [title, setTitle] = useState("")
  const [deleting, setDeleting] = useState<Conversation | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const chatMatch = useMatch("/chat/:chatId")
  const activeChatId = chatMatch?.params.chatId ?? null
  const isAdminSection = location.pathname.startsWith("/admin")

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const startRename = (conversation: Conversation) => {
    setTitle(conversation.title)
    setRenaming(conversation)
  }

  const submitRename = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = title.trim()
    if (renaming === null || next === "" || busy) return
    setBusy(true)
    if (await renameConversation(renaming.id, next)) setRenaming(null)
    setBusy(false)
  }

  const confirmDelete = async () => {
    if (deleting === null) return
    setBusy(true)
    const ok = await deleteConversation(deleting.id)
    setBusy(false)
    if (!ok) return
    if (deleting.id === activeChatId) navigate("/chat", { replace: true })
    setDeleting(null)
  }

  return (
    <aside
      id={id}
      ref={ref}
      className={cn(
        "w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col h-full border-r border-slate-800",
        className,
      )}
    >
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-slate-700 bg-slate-800">
            <BrainCircuit className="size-5 text-slate-100" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">DocuLocal</p>
            <p className="truncate text-xs text-slate-300">
              Gestión documental inteligente
            </p>
          </div>
        </div>
      </div>

      <nav
        aria-label="Navegación principal"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="px-3 pt-4">
          <Link
            to="/chat"
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 w-full items-center gap-2 rounded-sm border border-slate-600 bg-transparent px-3 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800",
              FOCUS_RING_DARK,
            )}
          >
            <Plus className="size-4" aria-hidden="true" />
            Nueva conversación
          </Link>
        </div>

        <h2
          id="history-heading"
          className="px-4 pt-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-300"
        >
          Historial reciente
        </h2>

        <div className="relative flex-1 overflow-y-auto px-3 pb-3 pt-1">
          {listStatus === "loading" ? (
            <p role="status" className="flex items-center gap-2 px-2.5 py-2 text-sm text-slate-300">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Cargando conversaciones...
            </p>
          ) : listStatus === "error" ? (
            <div role="alert" className="px-2.5 py-2 text-sm text-slate-300">
              <p>No se pudo cargar el historial.</p>
              <button
                type="button"
                onClick={reloadConversations}
                className={cn("mt-2 rounded-sm underline hover:text-white", FOCUS_RING_DARK)}
              >
                Reintentar
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-slate-300">
              Aún no hay conversaciones.
            </p>
          ) : (
            <ul aria-labelledby="history-heading" className="space-y-0.5">
              {conversations.map((conversation) => {
                const isActive = conversation.id === activeChatId
                return (
                  <li key={conversation.id} className="group flex items-center gap-0.5">
                    <Link
                      to={`/chat/${encodeURIComponent(conversation.id)}`}
                      onClick={onNavigate}
                      title={conversation.title}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100",
                        FOCUS_RING_DARK,
                        isActive && "bg-slate-800 font-medium text-white",
                      )}
                    >
                      <MessageSquare
                        className="size-4 shrink-0 text-slate-300"
                        aria-hidden="true"
                      />
                      <span className="truncate">{conversation.title}</span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Renombrar conversación ${conversation.title}`}
                      title="Renombrar"
                      onClick={() => startRename(conversation)}
                      className={cn(ROW_ACTION_CLASS, FOCUS_RING_DARK)}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar conversación ${conversation.title}`}
                      title="Eliminar"
                      onClick={() => setDeleting(conversation)}
                      className={cn(ROW_ACTION_CLASS, FOCUS_RING_DARK)}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </nav>

      <div className="border-t border-slate-800 p-3">
        <p className="mb-3 truncate px-1 text-xs text-slate-300">
          Sesión:{" "}
          <span className="font-medium text-slate-100">
            {session?.displayName}
          </span>
        </p>
        <div className="flex flex-col gap-2">
          {/* Para el rol Empleado el enlace no se renderiza en absoluto. */}
          {isAdmin &&
            (isAdminSection ? (
              <Link
                to="/chat"
                onClick={onNavigate}
                className={cn(FOOTER_LINK_CLASS, FOCUS_RING_DARK)}
              >
                <MessageSquare className="size-4" aria-hidden="true" />
                Volver al Chat
              </Link>
            ) : (
              <Link
                to="/admin"
                onClick={onNavigate}
                className={cn(FOOTER_LINK_CLASS, FOCUS_RING_DARK)}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Vista de Administrador
              </Link>
            ))}
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex min-h-11 w-full items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800",
              FOCUS_RING_DARK,
            )}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
          <button
            type="button"
            onClick={onOpenPrivacy}
            className={cn("rounded-sm text-xs text-slate-300 underline hover:text-white", FOCUS_RING_DARK)}
          >
            Privacidad
          </button>
        </div>
      </div>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && !busy && setRenaming(null)}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 rounded-sm bg-white p-0 text-slate-900 ring-slate-300 sm:max-w-md"
        >
          <form onSubmit={submitRename}>
            <DialogHeader className="gap-1 px-6 pt-6 pb-4">
              <DialogTitle className="text-base font-semibold text-slate-900">
                Renombrar conversación
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                El título puede tener hasta 120 caracteres.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 px-6 pb-5">
              <Label htmlFor="rename-title" className="text-slate-900">
                Título
              </Label>
              <Input
                id="rename-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-sm border-slate-500 bg-white text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setRenaming(null)}
                className="h-11 rounded-sm border-slate-500 px-5"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={busy || title.trim() === ""}
                className="h-11 rounded-sm bg-slate-900 px-5 text-white hover:bg-slate-800"
              >
                {busy ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="¿Eliminar conversación?"
        description={`Se eliminará "${deleting?.title ?? ""}" con todos sus mensajes. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </aside>
  )
}

export default Sidebar
