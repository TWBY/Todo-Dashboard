'use client'

import { ChatPanelsProvider } from '@/contexts/ChatPanelsContext'
import { LeftPanelProvider } from '@/contexts/LeftPanelContext'
import { BuildPanelProvider } from '@/contexts/BuildPanelContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LeftPanelProvider>
      <ChatPanelsProvider>
        <BuildPanelProvider>
          {children}
        </BuildPanelProvider>
      </ChatPanelsProvider>
    </LeftPanelProvider>
  )
}
