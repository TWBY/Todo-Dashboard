'use client'
import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import type { InteractiveScenario } from './scenarios'

const ChatContent = dynamic(() => import('@/components/ChatContent'), { ssr: false })

interface Props {
  scenario: InteractiveScenario
}

const ACTION_MESSAGES: Record<string, { message: string; mode?: 'plan' | 'edit' }> = {
  'trigger-stream': {
    message: '請用繁體中文撰寫一篇關於「微服務架構」的技術文章，包含標題、各段落、程式碼範例、優缺點比較表格，至少 600 字。',
    mode: 'edit',
  },
  'trigger-tool-stream': {
    message: '請執行 `echo "Hello from Chat Test Lab"` 並告訴我輸出結果。',
    mode: 'edit',
  },
  'trigger-autoscroll': {
    message: '請逐行輸出數字 1 到 50，每行格式為「第 N 行: ...」，在每行之間加上一句有趣的程式設計格言，確保輸出足夠長需要捲動。',
    mode: 'edit',
  },
  'trigger-plan': {
    message: '請設計一個 TODO 應用的前後端架構，包含資料庫 schema、API 設計、元件結構。',
    mode: 'plan',
  },
  'load-long': {
    message: '請逐行輸出數字 1 到 30，每行格式為「Line N」。',
    mode: 'edit',
  },
}

export default function InteractiveViewer({ scenario }: Props) {
  const [instanceKey, setInstanceKey] = useState(0)
  const [triggerMessage, setTriggerMessage] = useState<string | undefined>(undefined)
  const [triggerMode, setTriggerMode] = useState<'plan' | 'edit'>('edit')

  const handleAction = (action: string) => {
    if (action === 'reset') {
      setTriggerMessage(undefined)
      setInstanceKey(k => k + 1)
      return
    }
    const cfg = ACTION_MESSAGES[action]
    if (cfg) {
      setTriggerMessage(cfg.message)
      setTriggerMode(cfg.mode ?? 'edit')
      setInstanceKey(k => k + 1)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Controls bar */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#060d19',
        borderBottom: '1px solid #1a2740',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#3a5a7a', fontSize: '0.7rem', fontFamily: 'monospace', marginRight: 4 }}>
          <i className="fa-solid fa-gamepad" style={{ marginRight: 5 }} />controls:
        </span>
        {scenario.controls.map(ctrl => (
          <button
            key={ctrl.id}
            onClick={() => handleAction(ctrl.action)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              cursor: 'pointer',
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: ctrl.variant === 'primary' ? '#0e2a4a' : ctrl.variant === 'danger' ? '#3a1010' : '#0a1520',
              borderColor: ctrl.variant === 'primary' ? '#1e4a8a' : ctrl.variant === 'danger' ? '#7a2020' : '#1a2740',
              color: ctrl.variant === 'primary' ? '#58a6ff' : ctrl.variant === 'danger' ? '#f85149' : '#8b949e',
            }}
          >
            {ctrl.icon && <i className={`fa-solid ${ctrl.icon}`} style={{ fontSize: '0.7rem' }} />}
            {ctrl.label}
          </button>
        ))}
        {triggerMessage && (
          <span style={{ fontSize: '0.65rem', color: '#f97316', fontFamily: 'monospace' }}>
            <i className="fa-solid fa-circle-dot fa-fade" style={{ marginRight: 4 }} />live
          </span>
        )}
      </div>

      {/* Hint */}
      <div style={{
        padding: '4px 16px',
        backgroundColor: '#040a14',
        borderBottom: '1px solid #0d1a2a',
        fontSize: '0.65rem',
        color: '#2a4a6a',
        fontFamily: 'monospace',
        flexShrink: 0,
      }}>
        {scenario.description} — ephemeral=true · 每次觸發/重置會強制 remount ChatContent
      </div>

      {/* ChatContent */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatContent
          key={instanceKey}
          projectId="chat-lab"
          projectName="Chat Lab"
          ephemeral={true}
          initialMessage={triggerMessage}
          initialMode={triggerMode}
          emailMode={scenario.emailMode}
        />
      </div>
    </div>
  )
}
