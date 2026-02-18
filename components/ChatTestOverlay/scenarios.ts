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

export interface ScenarioStep {
  action: string
  expect: string
}

interface BaseScenario {
  id: string
  categoryId: string
  type: ScenarioType
  label: string
  description: string
  steps?: ScenarioStep[]
  passCondition?: string
}

export interface StaticScenario extends BaseScenario {
  type: 'static'
  sessionId: string
}

export interface InteractiveScenario extends BaseScenario {
  type: 'interactive'
  controls: ScenarioControl[]
  emailMode?: boolean
  canStop?: boolean
}

export interface TeamScenario extends BaseScenario {
  type: 'team'
  controls: ScenarioControl[]
  fixtureSessionId?: string
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
  { id: '3-1', categoryId: '3', type: 'interactive', label: '3.1 Streaming 文字', description: '觸發長文輸出，觀察 streaming UI', controls: [STREAM_CTRL, RESET_CTRL], steps: [{ action: '點擊「Stream 開始」', expect: 'Status bar 變橙色，顯示 streaming...' }, { action: '觀察文字逐字增加', expect: '文字不閃爍，游標閃爍（throttled 100ms）' }, { action: '等待完成', expect: 'Status bar 變綠色，顯示「已完成」' }], passCondition: 'Streaming 文字逐行顯示，游標動畫平順，完成後有綠色確認' },
  { id: '3-2', categoryId: '3', type: 'interactive', label: '3.2 Streaming → Stop', description: '觸發後手動中斷串流', controls: [{ id: 'stream-short', label: 'Stream 開始', icon: 'fa-play', variant: 'primary', action: 'trigger-stream-short' }, RESET_CTRL], canStop: true, steps: [{ action: '點擊「Stream 開始」', expect: 'Streaming 進行中，上方出現紅色「中斷串流」按鈕' }, { action: '在輸出中點「中斷串流」', expect: '按鈕點擊後立即停止，status bar 回到 idle（灰色）' }, { action: '觀察 ChatContent', expect: '最後一條訊息是不完整的輸出，之後沒有新訊息' }], passCondition: '中斷按鈕成功停止 streaming，訊息保持未完成狀態' },
  { id: '3-3', categoryId: '3', type: 'interactive', label: '3.3 Streaming 含 Tool', description: '觸發含 Bash tool 的串流', controls: [{ id: 'tool-stream', label: '觸發含 Tool', icon: 'fa-screwdriver-wrench', variant: 'primary', action: 'trigger-tool-stream' }, RESET_CTRL], steps: [{ action: '點擊「觸發含 Tool」', expect: 'ChatContent 先顯示 user 訊息，assistant 開始流式回覆' }, { action: '觀察工具呼叫', expect: 'Bash tool 訊息出現（可能在 ToolGroup 摺疊內），包含 command 和 output' }, { action: '等待完成', expect: 'Status bar 完成，整個流程穩定無卡頓' }], passCondition: 'Tool 訊息正確渲染，output 顯示完整' },
  { id: '3-4', categoryId: '3', type: 'interactive', label: '3.4 完成音效', description: '等 streaming 完成後播放叮咚', controls: [{ id: 'stream-audio', label: 'Stream 開始', icon: 'fa-play', variant: 'primary', action: 'trigger-stream-audio' }, RESET_CTRL], steps: [{ action: '點擊「Stream 開始」', expect: '開始播放音頻邏輯的訊息內容' }, { action: '等待 streaming 完成', expect: 'Status bar 變綠色，表示完成' }, { action: '確認音效', expect: '完成後自動播放叮咚音效（browser 權限允許的情況下）' }], passCondition: 'Streaming 完成，音效已播放（瀏覽器允許時）' },
  // Category 4
  { id: '4-1', categoryId: '4', type: 'interactive', label: '4.1 Auto-scroll（不干預）', description: '長輸出，自動停在底部', controls: [{ id: 'autoscroll', label: '觸發長輸出', icon: 'fa-arrows-down-to-line', variant: 'primary', action: 'trigger-autoscroll' }, RESET_CTRL], steps: [{ action: '點擊「觸發長輸出」', expect: 'ChatContent 開始接收長文本 streaming' }, { action: '觀察捲軸位置', expect: '隨著文字增加，捲軸自動停留在最底部，不會卡頓' }, { action: '等待完成', expect: 'Status bar 完成後，仍停在底部' }], passCondition: 'Auto-scroll 全程保持在底部，收到新訊息時自動捲下' },
  { id: '4-2', categoryId: '4', type: 'interactive', label: '4.2 往上滑不被帶走', description: '輸出中往上滑，確認不自動跳回底部', controls: [{ id: 'autoscroll', label: '觸發長輸出', icon: 'fa-arrows-down-to-line', variant: 'primary', action: 'trigger-autoscroll' }, RESET_CTRL], steps: [{ action: '點擊「觸發長輸出」後立即往上滑', expect: '捲軸被拖動到上面，streaming 繼續進行' }, { action: '觀察捲軸位置是否跳回底部', expect: '用戶往上滑後，auto-scroll 應該停止，不會被自動帶回底部' }, { action: '確認新訊息到達時不跳動', expect: '保持用戶滑動前的位置，不會驚跳' }], passCondition: '手動上滑後 auto-scroll 停止，不會強制回到底部' },
  { id: '4-3', categoryId: '4', type: 'interactive', label: '4.3 回到底部按鈕', description: '往上滑後確認 chevron ↓ 按鈕出現', controls: [{ id: 'autoscroll', label: '觸發長輸出', icon: 'fa-arrows-down-to-line', variant: 'primary', action: 'trigger-autoscroll' }, RESET_CTRL], steps: [{ action: '點擊「觸發長輸出」後往上滑', expect: '當滑到距底部 >100px 時，右下角出現藍色「↓」 chevron 按鈕' }, { action: '觀察按鈕位置', expect: '圓形 chevron 按鈕在 ChatContent 右下角' }, { action: '讓 streaming 繼續，按鈕應持續顯示', expect: '按鈕在 auto-scroll 停止期間持續可見' }], passCondition: 'Chevron 按鈕在正確位置，視覺清晰，可點擊' },
  { id: '4-4', categoryId: '4', type: 'interactive', label: '4.4 點回到底部', description: '點 chevron 後再送訊息，確認 auto-scroll 重啟', controls: [{ id: 'autoscroll', label: '觸發長輸出', icon: 'fa-arrows-down-to-line', variant: 'primary', action: 'trigger-autoscroll' }, RESET_CTRL], steps: [{ action: '往上滑後點 chevron ↓', expect: 'ChatContent 立即捲到底部，chevron 按鈕消失' }, { action: '觀察捲軸位置', expect: '確認在最底部' }, { action: '如果還有新訊息到達', expect: 'Auto-scroll 重新啟用，新訊息到達時自動捲下' }], passCondition: '點 chevron 後回到底部，auto-scroll 重新啟動' },
  // Category 5
  { id: '5-1', categoryId: '5', type: 'team', label: '5.1 Mock Team 生命週期', description: '60 秒 mock timeline：建立→任務→完成→刪除', fixtureSessionId: '5-1-team-lifecycle', controls: [{ id: 'start', label: '啟動 Mock Team', icon: 'fa-users-gear', variant: 'primary', action: 'start-mock-team' }, RESET_CTRL], steps: [{ action: '點擊「啟動 Mock Team」', expect: 'ChatContent 出現 TeamCreate 訊息，上方 Banner 顯示「查看 Agent Team」' }, { action: '右上角會看到「查看 Agent Team」按鈕', expect: 'TeamCreate teamEvent 正確觸發 Banner' }, { action: '側欄面板顯示 team-lead、3 個 member 狀態', expect: '60 秒內看到任務分派、member 執行進度、最終團隊解散' }], passCondition: 'TeamCreate 訊息出現、Banner 和 TeamMonitor 面板可用、整個 60s 時間線流暢展示' },
  { id: '5-2', categoryId: '5', type: 'team', label: '5.2 Team Banner 出現', description: 'TeamCreate 後「查看 Agent Team」Banner 出現', fixtureSessionId: '5-2-team-banner', controls: [{ id: 'start', label: '啟動 Mock Team', icon: 'fa-users-gear', variant: 'primary', action: 'start-mock-team' }, RESET_CTRL], steps: [{ action: '點擊「啟動 Mock Team」', expect: 'ChatContent 會顯示 refactor-team 的 TeamCreate 訊息' }, { action: '觀察 ChatContent 右上角區域', expect: '藍色「查看 Agent Team」Banner 立即出現' }, { action: '點擊 Banner', expect: '右側欄展開 TeamMonitorPanel，顯示 refactor-team 的實時狀態' }], passCondition: 'Banner 從 teamEvent message 正常路徑觸發，非 fallback' },
  { id: '5-3', categoryId: '5', type: 'team', label: '5.3 TeamMonitor 開啟', description: '按「查看 Agent Team」→ 側欄面板展開', fixtureSessionId: '5-3-team-monitor', controls: [{ id: 'start', label: '啟動 Mock Team', icon: 'fa-users-gear', variant: 'primary', action: 'start-mock-team' }, RESET_CTRL], steps: [{ action: '啟動後点「查看 Agent Team」', expect: '右側欄展開，顯示 TeamMonitorPanel' }, { action: '查看 TeamMonitorPanel 的各個 Tab', expect: '成員列表、任務隊列、通訊日誌、系統事件都能切換' }, { action: '觀察面板中的動態更新', expect: '隨著 mock 時間線進行，status 從 spawning → idle → working → completed' }], passCondition: '側欄面板完整渲染，各 Tab 可切換，動態更新正常' },
  { id: '5-4', categoryId: '5', type: 'team', label: '5.4 重啟後 Banner 重現', description: 'fallback 偵測 ~/claude/teams/ 邏輯', controls: [{ id: 'start', label: '啟動 Mock Team', icon: 'fa-users-gear', variant: 'primary', action: 'start-mock-team' }, RESET_CTRL], steps: [{ action: '不傳入 fixture（沒有 fixtureSessionId），ChatContent 初始為空', expect: 'fallback useEffect 掃描 ~/.claude/teams/ 目錄' }, { action: '如果 ~/claude/teams/ 有目錄，Banner 會自動出現', expect: '從 fallback 路徑觸發 Banner（而非 teamEvent message）' }, { action: '點 Banner 打開 TeamMonitorPanel', expect: '可以看到來自 /api/team-monitor/mock 的實時資料' }], passCondition: 'fallback 路徑生效，Banner 從目錄掃描觸發（不依賴 message）' },
  // Category 6
  { id: '6-1', categoryId: '6', type: 'static', label: '6.1 Chat History 分組', description: 'Today / Yesterday / Earlier 分組', sessionId: '6-1-history' },
  { id: '6-2', categoryId: '6', type: 'interactive', label: '6.2 切換 session 後 scroll 重設', description: '切換到長對話，確認自動捲到底部', controls: [{ id: 'load', label: '載入長對話', icon: 'fa-clock-rotate-left', variant: 'primary', action: 'load-long' }, RESET_CTRL] },
  { id: '6-3', categoryId: '6', type: 'static', label: '6.3 空對話初始狀態', description: '無訊息時的歡迎畫面', sessionId: '6-3-empty' },
  // Category 7
  { id: '7-1', categoryId: '7', type: 'interactive', label: '7.1 Plan mode 審批流程', description: '觸發 Plan mode → 審批 bar → approve', controls: [{ id: 'plan', label: '觸發 Plan', icon: 'fa-file-pen', variant: 'primary', action: 'trigger-plan' }, RESET_CTRL] },
  { id: '7-2', categoryId: '7', type: 'interactive', label: '7.2 Email mode', description: 'emailMode=true，顯示 Email 相關 UI', controls: [STREAM_CTRL, RESET_CTRL], emailMode: true },
]
