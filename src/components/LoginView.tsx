import { BrainCircuit, ShieldCheck, User } from "lucide-react"
import { Navigate, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { Role } from "@/types"

function LoginView() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()

  useDocumentTitle("Iniciar sesión · DocuLocal")

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />
  }

  const handleLogin = (role: Role) => {
    login(role)
    navigate("/chat", { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md gap-0 rounded-sm py-0 ring-slate-200">
        <CardHeader className="border-b border-slate-200 px-8 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-slate-900">
              <BrainCircuit className="size-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">DocuLocal</h1>
              <p className="text-sm text-slate-600">
                Gestión documental inteligente
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 py-6">
          <h2 className="text-base font-semibold text-slate-900">
            Iniciar sesión
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Selecciona el perfil con el que quieres acceder al prototipo.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              type="button"
              onClick={() => handleLogin("employee")}
              className={cn(
                "h-auto min-h-11 w-full justify-start gap-3 rounded-sm bg-slate-900 px-4 py-3 text-sm text-white hover:bg-slate-800",
                FOCUS_RING_LIGHT,
              )}
            >
              <User className="size-5" aria-hidden="true" />
              Entrar como Empleado
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleLogin("admin")}
              className={cn(
                "h-auto min-h-11 w-full justify-start gap-3 rounded-sm border-slate-500 bg-white px-4 py-3 text-sm text-slate-900 hover:bg-slate-100",
                FOCUS_RING_LIGHT,
              )}
            >
              <ShieldCheck className="size-5" aria-hidden="true" />
              Entrar como Administrador
            </Button>
          </div>
          <p className="mt-6 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            Autenticación simulada: no se solicitan credenciales reales.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

export default LoginView
