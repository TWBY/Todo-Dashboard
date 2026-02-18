'use client'
import React, { useState } from 'react'
import ChatContent from '@/components/ChatContent'
import type { InteractiveScenario } from './scenarios'

interface Props {
  scenario: InteractiveScenario
}

const ACTION_MESSAGES: Record<string, { message: string; mode?: 'plan' | 'edit' }> = {
  'trigger-stream': {
    message: '請用繁體中文撰寫一篇關於「微服務架構」的技術文章，包含標題、各段落、程式碼範例、優缺點比較表格，至少 600 字。',
    mode: 'edit',
  },
  'trigger-stream-short': {
    message: '請列出 10 條 TypeScript 最佳實踐，每條 2-3 句話簡述原因。',
    mode: 'edit',
  },
  'trigger-stream-audio': {
    message: '請撰寫一篇「Clean Code 讀書筆記」，涵蓋你印象最深的 3 個觀念。',
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
  const [panelStatus, setPanelStatus] = useState<'idle' | 'streaming' | 'waiting' | 'completed'>('idle')
  const chatRef = React.useRef<any>(null)

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
        {panelStatus === 'streaming' && scenario.canStop && (
          <button
            onClick={() => chatRef.current?.stopStream?.()}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              cursor: 'pointer',
              border: '1px solid #7a2020',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: '#3a1010',
              color: '#f85149',
            }}
          >
            <i className="fa-solid fa-circle-stop" style={{ fontSize: '0.7rem' }} />
            中斷串流
          </button>
        )}
      </div>

      {/* Status Bar */}
      <div style={{
        padding: '4px 16px',
        backgroundColor:
          panelStatus === 'streaming' ? '#1a1410' :
          panelStatus === 'completed' ? '#0a1410' :
          panelStatus === 'waiting' ? '#141410' :
          '#040a14',
        borderBottom: '1px solid #0d1a2a',
        fontSize: '0.65rem',
        color: '#2a4a6a',
        fontFamily: 'monospace',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          color:
            panelStatus === 'streaming' ? '#f97316' :
            panelStatus === 'completed' ? '#3fb950' :
            panelStatus === 'waiting' ? '#d29922' :
            '#2a4a6a',
        }}>
          {panelStatus === 'streaming' && <i className="fa-solid fa-circle-dot fa-fade" />}
          {panelStatus === 'completed' && <i className="fa-solid fa-circle-check" />}
          {panelStatus === 'waiting' && <i className="fa-solid fa-clock" />}
          {panelStatus === 'idle' && <i className="fa-solid fa-circle" />}
        </span>
        <span style={{
          color:
            panelStatus === 'streaming' ? '#f97316' :
            panelStatus === 'completed' ? '#3fb950' :
            panelStatus === 'waiting' ? '#d29922' :
            '#2a4a6a',
        }}>
          {panelStatus === 'streaming' ? 'streaming...' :
           panelStatus === 'completed' ? '已完成' :
           panelStatus === 'waiting' ? '等待審批' :
           '就緒'}
        </span>
        <span style={{ marginLeft: 'auto', color: '#2a4a6a' }}>
          {scenario.description}
        </span>
      </div>

      {/* Steps Guide */}
      {scenario.steps && scenario.steps.length > 0 && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#0a0f1a',
          borderBottom: '1px solid #0d1a2a',
          fontSize: '0.65rem',
          color: '#4a6a8a',
          fontFamily: 'monospace',
          flexShrink: 0,
        }}>
          {scenario.steps.map((step, idx) => (
            <div key={idx} style={{ marginBottom: idx < scenario.steps!.length - 1 ? 6 : 0 }}>
              <span style={{ color: '#6a8a9a' }}>{idx + 1}. {step.action}</span>
              <span style={{ color: '#2a5a30', marginLeft: 12 }}>→ {step.expect}</span>
            </div>
          ))}
          {scenario.passCondition && (
            <div style={{ marginTop: 8, color: '#f97316', borderTop: '1px solid #0d1a2a', paddingTop: 6 }}>
              通過標準：{scenario.passCondition}
            </div>
          )}
        </div>
      )}

      {/* ChatContent */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatContent
          ref={chatRef}
          key={instanceKey}
          projectId="chat-lab"
          projectName="Chat Lab"
          ephemeral={true}
          initialMessage={triggerMessage}
          initialMode={triggerMode}
          emailMode={scenario.emailMode}
          onPanelStatusChange={setPanelStatus}
        />
      </div>
    </div>
  )
}
