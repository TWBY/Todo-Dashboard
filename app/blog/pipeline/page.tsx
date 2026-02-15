'use client';

import { useRouter } from 'next/navigation';

import { ModelBadge } from '@/components/SkillArchitecture';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import BlogChatPanel from '@/components/BlogChatPanel';

// --- Types & Data ---

interface NodeData {
  command: string;
  label: string;
  model?: string;
  role?: string;
  description?: string;
  conditional?: string;
}

const PHASE_1: NodeData = {
  command: '/blog-intake',
  label: 'blog-intake',
  model: 'opus',
  role: 'Bridge Skill',
  description: '收斂對話中的素材，整理成結構化素材包後啟動流水線',
};

const PHASE_2: NodeData[] = [
  { command: '/blog-outline-architect', label: 'outline-architect', model: 'opus', role: '大綱架構師', description: '將靈感收斂為文章骨架' },
  { command: '/blog-pitfall-recorder', label: 'pitfall-recorder', model: 'sonnet', role: '踩坑記錄員', description: '補充技術坑點', conditional: '僅技術文' },
  { command: '/blog-beginner-reviewer', label: 'beginner-reviewer', model: 'sonnet', role: '小白審查員', description: '用初學者視角找出看不懂的地方' },
  { command: '/blog-visual-advisor', label: 'visual-advisor', model: 'sonnet', role: '視覺顧問', description: '建議圖片、表格、callout 的位置' },
  { command: '/blog-professional-editor', label: 'professional-editor', model: 'sonnet', role: '專業編輯', description: '文字潤色、用詞統一、排版規範' },
  { command: '/blog-seo-specialist', label: 'seo-specialist', model: 'sonnet', role: 'SEO 專家', description: '標題、關鍵詞、meta description、內鏈推薦（讀取既有語意索引）' },
  { command: '/blog-ai-quoter', label: 'ai-quoter', model: 'opus', role: 'AI 引用優化師', description: '讓文章更容易被 AI 搜尋引擎引用（讀取既有語意索引）' },
  { command: '/blog-engagement-designer', label: 'engagement-designer', model: 'sonnet', role: '互動設計師', description: 'CTA、延伸閱讀推薦（讀取既有語意索引）' },
];

const PHASE_5: NodeData = {
  command: '',
  label: '語意索引更新',
  role: '發布後觸發',
  description: '幫新文章做「小紙條」— 計算語意向量，找出跟它最像的 5 篇文章',
};

const UTILITIES: NodeData[] = [
  { command: '/blog-articles', label: 'blog-articles', model: 'haiku', role: '站內文章查詢', description: '被 SEO、AI 引用、互動設計等 Skill 引用' },
  { command: '/blog-pipeline-review', label: 'pipeline-review', model: 'opus', role: '流水線覆盤', description: '手動觸發，檢討各 Skill 是否需要調整' },
];

// --- Sub-components ---

function VArrow({ dashed }: { dashed?: boolean }) {
  return (
    <div className="flex flex-col items-center" style={{ height: '28px', margin: '4px 0' }}>
      <div
        style={{
          width: dashed ? 0 : 2,
          height: 16,
          borderLeft: dashed ? '2px dashed var(--text-tertiary)' : undefined,
          backgroundColor: dashed ? 'transparent' : 'var(--text-tertiary)',
        }}
      />
      <div
        style={{
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid var(--text-tertiary)',
        }}
      />
    </div>
  );
}

function HArrow() {
  return (
    <div className="hidden sm:flex items-center shrink-0 mx-2">
      <div style={{ width: 20, height: 2, backgroundColor: 'var(--text-tertiary)' }} />
      <div
        style={{
          width: 0, height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: '6px solid var(--text-tertiary)',
        }}
      />
    </div>
  );
}

function SkillNode({ node, index, copy, isCopied }: {
  node: NodeData;
  index?: number;
  copy: (text: string) => Promise<boolean>;
  isCopied: (text: string) => boolean;
}) {
  const hasCmd = !!node.command;
  const copied = hasCmd && isCopied(node.command);

  return (
    <div
      className={`rounded-lg transition-colors duration-150 ${hasCmd ? 'cursor-pointer hover:bg-white/5' : ''}`}
      style={{
        backgroundColor: 'var(--background-tertiary)',
        border: copied
          ? '1px solid rgba(34,197,94,0.4)'
          : '1px solid var(--border-color)',
        padding: '10px 14px',
      }}
      onClick={hasCmd ? () => copy(node.command) : undefined}
      title={hasCmd ? '點擊複製指令' : undefined}
    >
      <div className="flex items-start gap-2">
        {typeof index === 'number' && (
          <span className="text-sm shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {String.fromCharCode(9312 + index)}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-mono" style={{ color: hasCmd ? 'var(--primary-blue-light)' : 'var(--text-primary)' }}>
                {hasCmd ? node.command : node.label}
              </span>
              {copied && (
                <span className="text-sm shrink-0" style={{ color: '#22c55e' }}>已複製！</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {node.conditional && (
                <span
                  className="text-sm px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
                >
                  {node.conditional}
                </span>
              )}
              {node.model && <ModelBadge model={node.model} />}
            </div>
          </div>
          {node.role && !copied && (
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{node.role}</div>
          )}
          {node.description && !copied && (
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{node.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseHeader({ phase, title }: { phase: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="text-sm font-semibold px-2 py-0.5 rounded"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
      >
        {phase}
      </span>
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{title}</span>
    </div>
  );
}

function StatusBadge({ label, color }: { label: string; color: 'green' | 'blue' }) {
  const colors = {
    green: { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e', border: 'rgba(34,197,94,0.2)' },
    blue: { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
  };
  const c = colors[color];
  return (
    <span
      className="text-sm px-1.5 py-0.5 rounded shrink-0"
      style={{ backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      {label}
    </span>
  );
}

// --- Page ---

export default function BlogPipelinePage() {
  const router = useRouter();
  const { copy, isCopied } = useCopyToClipboard(1000);

  const leftCol = PHASE_2.slice(0, 4);
  const rightCol = PHASE_2.slice(4, 8);

  return (
      <div
        className="min-h-screen flex"
        style={{ backgroundColor: 'var(--background-primary)', color: 'var(--text-primary)' }}
      >
        {/* Left: Pipeline (scrollable) */}
        <div className="flex-1 min-w-0 overflow-y-auto h-screen">
          <div className="max-w-[820px] mx-auto px-5 sm:px-8 pt-8 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => router.push('/')}
                  className="px-3 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--background-tertiary)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  ← 儀表板
                </button>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Blog 編輯流水線
                </h1>
              </div>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-[2px]" style={{ backgroundColor: 'var(--text-tertiary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>依序執行</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-0" style={{ borderTop: '2px dashed var(--text-tertiary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>條件執行</span>
                </div>
              </div>
            </div>

            {/* Phase 1 */}
            <PhaseHeader phase="Phase 1" title="收斂討論" />
            <SkillNode node={PHASE_1} copy={copy} isCopied={isCopied} />

            <VArrow />

            {/* Phase 2 */}
            <PhaseHeader phase="Phase 2" title="流水線（依序執行）" />
            <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)' }}>
              {PHASE_2.map((node, i) => (
                <div key={node.command}>
                  {i > 0 && <VArrow dashed={node.conditional !== undefined} />}
                  <SkillNode node={node} index={i} copy={copy} isCopied={isCopied} />
                  {/* 小紙條提示 */}
                  {(i === 5 || i === 6 || i === 7) && (
                    <div className="mt-1.5 ml-6 text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>
                      <i className="fa-sharp fa-regular fa-bookmark mr-1" style={{ color: '#a855f7' }} />
                      讀取小紙條（Insforge `article_similarities` 表）
                    </div>
                  )}
                </div>
              ))}
            </div>

            <VArrow />

            {/* Phase 3 */}
            <PhaseHeader phase="Phase 3" title="入庫" />
            <div
              className="rounded-lg px-4 py-3"
              style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>Insforge DB</span>
                <StatusBadge label="draft" color="green" />
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                以 draft 狀態寫入資料庫
              </div>
            </div>

            <VArrow dashed />

            {/* Phase 4 */}
            <PhaseHeader phase="Phase 4" title="人工審閱" />
            <div
              className="rounded-lg px-4 py-3"
              style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>BlogBackend</span>
                <StatusBadge label="published" color="blue" />
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                人工審閱、微調後發布
              </div>
              <div className="text-sm mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>
                ~/Documents/Brickverse/BlogBackend
              </div>
            </div>

            <VArrow dashed />

            {/* Phase 5 */}
            <div className="mt-2">
            <PhaseHeader phase="Phase 5" title="語意索引（發布後手動觸發）" />
            <div
              className="rounded-lg px-4 py-3"
              style={{ backgroundColor: 'var(--background-tertiary)', border: '1px dashed rgba(168,85,247,0.4)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <i className="fa-sharp fa-regular fa-brain-circuit text-sm" style={{ color: '#a855f7' }} />
                  <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{PHASE_5.label}</span>
                </div>
                <span
                  className="text-sm px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}
                >
                  bge-m3 模型
                </span>
              </div>
              <div className="text-sm mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                {PHASE_5.description}
              </div>
              {/* 回饋說明 */}
              <div
                className="text-sm mt-3 px-3 py-2 rounded"
                style={{ backgroundColor: 'rgba(168,85,247,0.06)', color: 'var(--text-secondary)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <i className="fa-sharp fa-regular fa-arrow-turn-up fa-rotate-180 text-xs" style={{ color: '#a855f7' }} />
                  <span className="font-medium" style={{ color: '#a855f7' }}>回饋循環</span>
                </div>
                <div style={{ color: 'var(--text-tertiary)' }}>
                  索引更新後，下次寫新文章時 ⑥⑦⑧ 就能「看見」這篇文章來推薦內鏈；前台讀者也會看到延伸閱讀
                </div>
              </div>
            </div>
            </div>

            {/* Utilities */}
            <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                輔助工具
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {UTILITIES.map(node => (
                  <SkillNode key={node.command} node={node} copy={copy} isCopied={isCopied} />
                ))}
              </div>
              <div
                className="text-sm font-mono px-4 py-2.5 rounded-lg mt-3"
                style={{ color: 'var(--text-tertiary)', border: '1px dashed var(--border-color)' }}
              >
                ⑥⑦⑧ 優先讀取語意索引推薦相關文章，/blog-articles 作為補充（完整文章清單）
              </div>
            </div>
          </div>
        </div>

        {/* Right: Blog Chat Panel (lg+ only) */}
        <div
          className="hidden lg:flex flex-col w-[420px] shrink-0 h-screen sticky top-0"
          style={{ borderLeft: '1px solid var(--border-color)' }}
        >
          <BlogChatPanel />
        </div>
      </div>
  );
}
