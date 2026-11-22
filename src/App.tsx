import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import AdminView from "@/components/AdminView"
import AppLayout from "@/components/AppLayout"
import ChatView from "@/components/ChatView"
import ErrorBoundary from "@/components/ErrorBoundary"
import LoginView from "@/components/LoginView"
import ProtectedRoute from "@/components/routing/ProtectedRoute"
import RoleRoute from "@/components/routing/RoleRoute"
import AuthProvider from "@/context/AuthProvider"
import ChatProvider from "@/context/ChatProvider"
import DocumentsProvider from "@/context/DocumentsProvider"
import ToastProvider from "@/context/ToastProvider"
import { useAuth } from "@/hooks/useAuth"

/** El `key` reinicia los datos al iniciar/cerrar sesión o cambiar de usuario. */
function DataProviders({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const key = session?.id ?? "anonimo"
  return (
    <DocumentsProvider key={key}>
      <ChatProvider key={key}>{children}</ChatProvider>
    </DocumentsProvider>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <DataProviders>
              <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/login" element={<LoginView />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    {/* Una sola ruta con segmento opcional: ChatView no se remonta al
                        pasar de /chat a /chat/:chatId y el input conserva el foco. */}
                    <Route path="/chat/:chatId?" element={<ChatView />} />
                    <Route
                      path="/admin"
                      element={
                        <RoleRoute requiredRole="admin">
                          <AdminView />
                        </RoleRoute>
                      }
                    />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </DataProviders>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
