'use client'

import ClaudeChatPanel from '@/components/ClaudeChatPanel'

export default function BlogChatPanel() {
  return (
    <div className="flex flex-col h-full">
      <ClaudeChatPanel
        projectId="blogbackend"
        projectName="Blog Pipeline"
        isFixed
        theme="green"
      />
    </div>
  )
}
