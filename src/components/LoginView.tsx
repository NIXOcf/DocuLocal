import { useState } from "react"
import type { FormEvent } from "react"
import { BrainCircuit, Loader2 } from "lucide-react"
import { Navigate, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { errorMessage } from "@/lib/api"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"

const INPUT_CLASS =
  "h-11 rounded-sm border-slate-500 bg-white text-slate-900 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"

function LoginView() {
  const { isAuthenticated, restoring, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useDocumentTitle("Iniciar sesión · DocuLocal")

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting || restoring) return
    setSubmitting(true)
    setError("")
    try {
      await login(email.trim(), password)
      navigate("/chat", { replace: true })
    } catch (err) {
      setError(errorMessage(err, "No se pudo iniciar sesión."))
      setSubmitting(false)
    }
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
              <p className="text-sm text-slate-600">Gestión documental inteligente</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 py-6">
          <h2 className="text-base font-semibold text-slate-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ingresa con tu correo corporativo y tu contraseña.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email" className="text-slate-900">
                Correo electrónico
              </Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error !== ""}
                aria-describedby={error !== "" ? "login-error" : undefined}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password" className="text-slate-900">
                Contraseña
              </Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error !== ""}
                aria-describedby={error !== "" ? "login-error" : undefined}
                className={INPUT_CLASS}
              />
            </div>
            <p
              id="login-error"
              role="alert"
              className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 empty:hidden"
            >
              {error}
            </p>
            <Button
              type="submit"
              disabled={submitting || restoring || email.trim() === "" || password === ""}
              className={cn(
                "h-11 w-full gap-2 rounded-sm bg-slate-900 text-sm text-white hover:bg-slate-800",
                FOCUS_RING_LIGHT,
              )}
            >
              {submitting && (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              )}
              {submitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default LoginView
