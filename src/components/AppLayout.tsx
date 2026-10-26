import { useEffect, useRef, useState } from "react"
import type { MouseEvent } from "react"
import { flushSync } from "react-dom"
import { Menu, X } from "lucide-react"
import { Outlet, useLocation } from "react-router-dom"
import Sidebar from "@/components/Sidebar"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { FOCUS_RING_DARK } from "@/lib/styles"
import { cn } from "@/lib/utils"

type Section = "chat" | "admin"

const SECTION_TITLES: Record<Section, string> = {
  chat: "Chat · BaseSaber",
  admin: "Administración · BaseSaber",
}

const DESKTOP_QUERY = "(min-width: 768px)"
const SIDEBAR_ID = "app-sidebar"

function getSection(pathname: string): Section {
  return pathname.startsWith("/admin") ? "admin" : "chat"
}

function AppLayout() {
  const location = useLocation()
  const section = getSection(location.pathname)
  const [menuOpen, setMenuOpen] = useState(false)

  const mainRef = useRef<HTMLElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const previousSectionRef = useRef<Section | null>(null)

  useDocumentTitle(SECTION_TITLES[section])

  // Mueve el foco al <main> solo al cambiar de SECCIÓN (no al cambiar de :chatId)
  // y no en la carga inicial de la página (location.key === "default").
  useEffect(() => {
    const previous = previousSectionRef.current
    previousSectionRef.current = section
    const isInitialLoad = previous === null && location.key === "default"
    if (previous !== section && !isInitialLoad) {
      mainRef.current?.focus()
    }
  }, [section, location.key])

  // Panel lateral en pantallas pequeñas (WCAG 1.4.10 Reflow):
  // Escape lo cierra y devuelve el foco al botón de menú.
  useEffect(() => {
    if (!menuOpen) return
    sidebarRef.current?.querySelector<HTMLElement>("a[href], button")?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [menuOpen])

  // Al pasar a escritorio el panel siempre está visible: se cierra el modo superpuesto.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const query = window.matchMedia(DESKTOP_QUERY)
    const handleChange = () => {
      if (query.matches) setMenuOpen(false)
    }
    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
  }, [])

  // <main> es inert mientras el panel está abierto: se cierra de forma síncrona
  // antes de mover el foco para que este no se pierda.
  const closeMenuAndFocusMain = () => {
    flushSync(() => setMenuOpen(false))
    mainRef.current?.focus()
  }

  const handleSkip = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    closeMenuAndFocusMain()
  }

  const handleNavigate = () => {
    if (menuOpen) closeMenuAndFocusMain()
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden md:flex-row">
      <a
        href="#main-content"
        onClick={handleSkip}
        className="sr-only rounded-sm bg-white px-4 py-2 text-sm font-medium text-slate-900 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
      >
        Saltar al contenido principal
      </a>

      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-3 text-slate-100 md:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={SIDEBAR_ID}
          aria-label={menuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            "relative z-50 inline-flex size-11 items-center justify-center rounded-sm text-slate-100 hover:bg-slate-800",
            FOCUS_RING_DARK,
          )}
        >
          {menuOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
        <span className="font-semibold">BaseSaber</span>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 top-14 z-30 bg-slate-900/60 md:hidden" aria-hidden="true" />
      )}

      <Sidebar
        id={SIDEBAR_ID}
        ref={sidebarRef}
        onNavigate={handleNavigate}
        className={cn(
          "fixed top-14 bottom-0 left-0 z-40 h-auto md:static md:z-auto md:flex md:h-full",
          menuOpen ? "flex" : "hidden",
        )}
      />

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        inert={menuOpen}
        className="flex-1 min-h-0 min-w-0 bg-slate-50 outline-none"
      >
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
