'use client'

import ClaudeChatPanel from '@/components/ClaudeChatPanel'

export default function ChatCenterConsultant() {
  return (
    <div className="flex flex-col h-full">
      <ClaudeChatPanel
        projectId="dashboard"
        projectName="Chat 顧問"
        isFixed
      />
    </div>
  )
}
