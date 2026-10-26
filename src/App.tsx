import { useState } from "react"
import AdminView from "@/components/AdminView"
import ChatView from "@/components/ChatView"
import Sidebar from "@/components/Sidebar"
import type { View } from "@/types"

function App() {
  const [currentView, setCurrentView] = useState<View>("chat")
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const handleSelectChat = (id: string) => {
    setActiveChatId(id)
    setCurrentView("chat")
  }

  const handleNewChat = () => {
    setActiveChatId(null)
    setCurrentView("chat")
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        currentView={currentView}
        onChangeView={setCurrentView}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />
      <main className="flex-1 min-w-0 bg-slate-50">
        {currentView === "chat" ? (
          <ChatView key={activeChatId ?? "new"} />
        ) : (
          <AdminView />
        )}
      </main>
    </div>
  )
}

export default App
