import { BrainCircuit, MessageSquare, Plus, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { mockHistory } from "@/data/mockData"
import { cn } from "@/lib/utils"
import type { View } from "@/types"

interface SidebarProps {
  currentView: View
  onChangeView: (view: View) => void
  activeChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
}

function Sidebar({
  currentView,
  onChangeView,
  activeChatId,
  onSelectChat,
  onNewChat,
}: SidebarProps) {
  const isChat = currentView === "chat"

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col h-full border-r border-slate-800">
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-slate-700 bg-slate-800">
            <BrainCircuit className="size-5 text-slate-100" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">BaseSaber</p>
            <p className="truncate text-xs text-slate-400">
              Gestión documental inteligente
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4">
        <Button
          variant="outline"
          onClick={onNewChat}
          className="h-9 w-full justify-start gap-2 rounded-sm border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-slate-100"
        >
          <Plus className="size-4" />
          Nueva conversación
        </Button>
      </div>

      <div className="px-4 pt-5 pb-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Historial reciente
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-0.5">
          {mockHistory.map((chat) => {
            const isActive = isChat && chat.id === activeChatId
            return (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  title={chat.title}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100",
                    isActive && "bg-slate-800 text-slate-100",
                  )}
                >
                  <MessageSquare className="size-4 shrink-0 text-slate-400" />
                  <span className="truncate">{chat.title}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={() => onChangeView(isChat ? "admin" : "chat")}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-slate-700 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"
        >
          {isChat ? (
            <>
              <ShieldCheck className="size-4" />
              Vista de Administrador
            </>
          ) : (
            <>
              <MessageSquare className="size-4" />
              Volver al Chat
            </>
          )}
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          Prototipo Hito 1 · v0.1
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
