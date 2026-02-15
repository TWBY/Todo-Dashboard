'use client'

import { ChatPanelsProvider } from '@/contexts/ChatPanelsContext'
import { LeftPanelProvider } from '@/contexts/LeftPanelContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LeftPanelProvider>
      <ChatPanelsProvider>
        {children}
      </ChatPanelsProvider>
    </LeftPanelProvider>
  )
}
