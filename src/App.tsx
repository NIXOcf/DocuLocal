import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import AdminView from "@/components/AdminView"
import AppLayout from "@/components/AppLayout"
import ChatView from "@/components/ChatView"
import LoginView from "@/components/LoginView"
import ProtectedRoute from "@/components/routing/ProtectedRoute"
import RoleRoute from "@/components/routing/RoleRoute"
import AuthProvider from "@/context/AuthProvider"
import ChatProvider from "@/context/ChatProvider"
import DocumentsProvider from "@/context/DocumentsProvider"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DocumentsProvider>
          <ChatProvider>
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
          </ChatProvider>
        </DocumentsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
