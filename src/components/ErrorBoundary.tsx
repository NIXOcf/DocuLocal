import { Component } from "react"
import type { ErrorInfo, ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface State {
  failed: boolean
}

/** Evita la pantalla en blanco ante un error de renderizado. */
class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Sin registro del contenido: podría incluir texto de documentos o preguntas.
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div role="alert" className="max-w-md rounded-sm border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Algo salió mal</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ocurrió un error inesperado en la aplicación. Recarga la página para continuar.
          </p>
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 h-11 rounded-sm bg-slate-900 px-5 text-white hover:bg-slate-800"
          >
            Recargar
          </Button>
        </div>
      </main>
    )
  }
}

export default ErrorBoundary
