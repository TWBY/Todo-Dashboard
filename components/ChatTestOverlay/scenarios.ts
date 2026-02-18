// components/ChatTestOverlay/scenarios.ts

export type ScenarioType = 'static' | 'interactive' | 'team'

export interface ScenarioCategory {
  id: string
  label: string
  color: string
}

export interface ScenarioControl {
  id: string
  label: string
  icon?: string
  variant?: 'primary' | 'danger' | 'secondary'
  action: string
}

interface BaseScenario {
  id: string
  categoryId: string
  type: ScenarioType
  label: string
  description: string
}

export interface StaticScenario extends BaseScenario {
  type: 'static'
  sessionId: string
}

export interface InteractiveScenario extends BaseScenario {
  type: 'interactive'
  controls: ScenarioControl[]
  emailMode?: boolean
}

export interface TeamScenario extends BaseScenario {
  type: 'team'
  controls: ScenarioControl[]
}

export type Scenario = StaticScenario | InteractiveScenario | TeamScenario

export const CATEGORIES: ScenarioCategory[] = [
  { id: '1', label: 'Cat 1 — 訊息顯示', color: '#58a6ff' },
  { id: '2', label: 'Cat 2 — 工具呼叫', color: '#3fb950' },
  { id: '3', label: 'Cat 3 — Streaming', color: '#f97316' },
  { id: '4', label: 'Cat 4 — Auto-scroll', color: '#d29922' },
  { id: '5', label: 'Cat 5 — Team Agent', color: '#bc8cff' },
  { id: '6', label: 'Cat 6 — Chat History', color: '#8b949e' },
  { id: '7', label: 'Cat 7 — Panel / Mode', color: '#f85149' },
]

const RESET_CTRL: ScenarioControl = { id: 'reset', label: '重置', icon: 'fa-rotate-left', variant: 'secondary', action: 'reset' }
const STREAM_CTRL: ScenarioControl = { id: 'stream', label: 'Stream 開始', icon: 'fa-play', variant: 'primary', action: 'trigger-stream' }

export const SCENARIOS: Scenario[] = [
  // Category 1
  { id: '1-1', categoryId: '1', type: 'static', label: '1.1 純文字訊息', description: 'user + assistant 純文字，基本排版', sessionId: '1-1-basic' },
  { id: '1-2', categoryId: '1', type: 'static', label: '1.2 Markdown 格式', description: '標題、列表、程式碼、表格', sessionId: '1-2-markdown' },
  { id: '1-3', categoryId: '1', type: 'static', label: '1.3 超長對話', description: '多輪對話，測試捲動效能', sessionId: '1-3-long' },
  { id: '1-4', categoryId: '1', type: 'static', label: '1.4 Error 訊息', description: 'isError: true 的錯誤狀態', sessionId: '1-4-error' },
  // Category 2
  { id: '2-1', categoryId: '2', type: 'static', label: '2.1 TodoWrite', description: 'pending / in_progress / completed 三種狀態', sessionId: '2-1-todowrite' },
  { id: '2-2', categoryId: '2', type: 'static', label: '2.2 AskUserQuestion', description: '選項式問題對話框', sessionId: '2-2-ask-question' },
  { id: '2-3', categoryId: '2', type: 'static', label: '2.3 Plan Approval (pending)', description: 'ExitPlanMode 未審批', sessionId: '2-3-plan-pending' },
  { id: '2-4', categoryId: '2', type: 'static', label: '2.4 Plan Approval (approved)', description: 'ExitPlanMode 已審批', sessionId: '2-4-plan-approved' },
  { id: '2-5', categoryId: '2', type: 'static', label: '2.5 Task sub-agent', description: 'Task tool 藍色邊框渲染', sessionId: '2-5-task-agent' },
  { id: '2-6', categoryId: '2', type: 'static', label: '2.6 TeamCreate 事件', description: 'teamEvent type=create', sessionId: '2-6-team-create' },
  { id: '2-7', categoryId: '2', type: 'static', label: '2.7 ToolGroup 摺疊', description: '多個 low-level tool 合併顯示', sessionId: '2-7-toolgroup' },
  { id: '2-8', categoryId: '2', type: 'static', label: '2.8 Plan Write', description: 'Write to /plans/ 用 Markdown 渲染', sessionId: '2-8-plan-write' },
  // Category 3
  { id: '3-1', categoryId: '3', type: 'interactive', label: '3.1 Streaming 文字', description: '觸發長文輸出，觀察 streaming UI', controls: [STREAM_CTRL, RESET_CTRL] },
  { id: '3-2', categoryId: '3', type: 'interactive', label: '3.2 Streaming → Stop', description: '觸發後手動中斷串流', controls: [STREAM_CTRL, RESET_CTRL] },
  { id: '3-3', categoryId: '3', type: 'interactive', label: '3.3 Streaming 含 Tool', description: '觸發含 Bash tool 的串流', controls: [{ id: 'tool-stream', label: '觸發含 Tool', icon: 'fa-screwdriver-wrench', variant: 'primary', action: 'trigger-tool-stream' }, RESET_CTRL] },
  { id: '3-4', categoryId: '3', type: 'interactive', label: '3.4 完成音效', description: '等 streaming 完成後播放叮咚', controls: [STREAM_CTRL, RESET_CTRL] },
  // Category 4
  { id: '4-1', categoryId: '4', type: 'interactive', label: '4.1 Auto-scroll（不干預）', description: '長輸出，自動停在底部', controls: [{ id: 'autoscroll', label: '觸發長輸出', icon: 'fa-arrows-down-to-line', variant: 'primary', action: 'trigger-autoscroll' }, RESET_CTRL] },
  { id: '4-2', categoryId: '4', type: 'interactive', label: '4.2 往上滑不被帶走', description: '輸出中往上滑，確認不自動跳回底部', controls: [{ id: 'autoscroll', label: '觸發長輸出', icon: 'fa-arrows-down-to-line', variant: 'primary', action: 'trigger-autoscroll' }, RESET_CTRL] },
  { id: '4-3', categoryId: '4', type: 'interactive', label: '4.3 回到底部按鈕', description: '往上滑後確認 chevron ↓ 按鈕出現', controls: [{ id: 'autoscroll', label: '觸發長輸出', icon: 'fa-arrows-down-to-line', variant: 'primary', action: 'trigger-autoscroll' }, RESET_CTRL] },
  { id: '4-4', categoryId: '4', type: 'interactive', label: '4.4 點回到底部', description: '點 chevron 後再送訊息，確認 auto-scroll 重啟', controls: [{ id: 'autoscroll', label: '觸發長輸出', icon: 'fa-arrows-down-to-line', variant: 'primary', action: 'trigger-autoscroll' }, RESET_CTRL] },
  // Category 5
  { id: '5-1', categoryId: '5', type: 'team', label: '5.1 Mock Team 生命週期', description: '60 秒 mock timeline：建立→任務→完成→刪除', controls: [{ id: 'start', label: '啟動 Mock Team', icon: 'fa-users-gear', variant: 'primary', action: 'start-mock-team' }, RESET_CTRL] },
  { id: '5-2', categoryId: '5', type: 'team', label: '5.2 Team Banner 出現', description: 'TeamCreate 後「查看 Agent Team」Banner 出現', controls: [{ id: 'start', label: '啟動 Mock Team', icon: 'fa-users-gear', variant: 'primary', action: 'start-mock-team' }, RESET_CTRL] },
  { id: '5-3', categoryId: '5', type: 'team', label: '5.3 TeamMonitor 開啟', description: '按「查看 Agent Team」→ 側欄面板展開', controls: [{ id: 'start', label: '啟動 Mock Team', icon: 'fa-users-gear', variant: 'primary', action: 'start-mock-team' }, RESET_CTRL] },
  { id: '5-4', categoryId: '5', type: 'team', label: '5.4 重啟後 Banner 重現', description: 'fallback 偵測 ~/claude/teams/ 邏輯', controls: [{ id: 'start', label: '啟動 Mock Team', icon: 'fa-users-gear', variant: 'primary', action: 'start-mock-team' }, RESET_CTRL] },
  // Category 6
  { id: '6-1', categoryId: '6', type: 'static', label: '6.1 Chat History 分組', description: 'Today / Yesterday / Earlier 分組', sessionId: '6-1-history' },
  { id: '6-2', categoryId: '6', type: 'interactive', label: '6.2 切換 session 後 scroll 重設', description: '切換到長對話，確認自動捲到底部', controls: [{ id: 'load', label: '載入長對話', icon: 'fa-clock-rotate-left', variant: 'primary', action: 'load-long' }, RESET_CTRL] },
  { id: '6-3', categoryId: '6', type: 'static', label: '6.3 空對話初始狀態', description: '無訊息時的歡迎畫面', sessionId: '6-3-empty' },
  // Category 7
  { id: '7-1', categoryId: '7', type: 'interactive', label: '7.1 Plan mode 審批流程', description: '觸發 Plan mode → 審批 bar → approve', controls: [{ id: 'plan', label: '觸發 Plan', icon: 'fa-file-pen', variant: 'primary', action: 'trigger-plan' }, RESET_CTRL] },
  { id: '7-2', categoryId: '7', type: 'interactive', label: '7.2 Email mode', description: 'emailMode=true，顯示 Email 相關 UI', controls: [STREAM_CTRL, RESET_CTRL], emailMode: true },
]
