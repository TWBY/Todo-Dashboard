'use client'

import { ChatPanelsProvider } from '@/contexts/ChatPanelsContext'
import { LeftPanelProvider } from '@/contexts/LeftPanelContext'
import { BuildPanelProvider } from '@/contexts/BuildPanelContext'
import { TodoPanelProvider } from '@/contexts/TodoPanelContext'
import { DocsPanelProvider } from '@/contexts/DocsPanelContext'
import { PortsPanelProvider } from '@/contexts/PortsPanelContext'
import { DevServerProvider } from '@/contexts/DevServerContext'
import { ToastProvider } from '@/contexts/ToastContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <LeftPanelProvider>
        <DevServerProvider>
          <ChatPanelsProvider>
            <BuildPanelProvider>
              <TodoPanelProvider>
                <DocsPanelProvider>
                  <PortsPanelProvider>
                    {children}
                  </PortsPanelProvider>
                </DocsPanelProvider>
              </TodoPanelProvider>
            </BuildPanelProvider>
          </ChatPanelsProvider>
        </DevServerProvider>
      </LeftPanelProvider>
    </ToastProvider>
  )
}
