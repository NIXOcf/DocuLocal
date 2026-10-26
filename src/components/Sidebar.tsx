import {
  BrainCircuit,
  LogOut,
  MessageSquare,
  Plus,
  ShieldCheck,
} from "lucide-react"
import type { Ref } from "react"
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useChat } from "@/hooks/useChat"
import { FOCUS_RING_DARK } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface SidebarProps {
  id?: string
  className?: string
  ref?: Ref<HTMLElement>
  /** Se invoca al activar un enlace (cierra el panel en pantallas pequeñas). */
  onNavigate?: () => void
}

const FOOTER_LINK_CLASS =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-slate-600 px-3 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"

function Sidebar({ id, className, ref, onNavigate }: SidebarProps) {
  const { session, isAdmin, logout } = useAuth()
  const { conversations, phase, stopGeneration } = useChat()
  const navigate = useNavigate()
  const location = useLocation()
  const chatMatch = useMatch("/chat/:chatId")
  const activeChatId = chatMatch?.params.chatId ?? null
  const isAdminSection = location.pathname.startsWith("/admin")

  const handleLogout = () => {
    if (phase !== "idle") stopGeneration()
    logout()
    navigate("/login", { replace: true })
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
            <p className="font-semibold leading-tight">BaseSaber</p>
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

        <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
          {conversations.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-slate-300">
              Aún no hay conversaciones.
            </p>
          ) : (
            <ul aria-labelledby="history-heading" className="space-y-0.5">
              {conversations.map((conversation) => {
                const isActive = conversation.id === activeChatId
                return (
                  <li key={conversation.id}>
                    <Link
                      to={`/chat/${encodeURIComponent(conversation.id)}`}
                      onClick={onNavigate}
                      title={conversation.title}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-9 w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100",
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
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-300">
          Prototipo Hito 1 · v0.2
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
