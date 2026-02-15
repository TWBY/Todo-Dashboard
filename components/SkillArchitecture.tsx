'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

// --- 分類設定：僅保留顯示順序和關係圖（分類本身從 SKILL.md frontmatter 動態讀取）---

const CATEGORY_RELATIONS: Record<string, string[]> = {
  '部署流程': [
    'ship → zeabur-setup（無設定時）',
    'ship → zeabur-debug（失敗時）',
  ],
  '程式碼品質': [
    'audit → code-health → security-review → refactor（條件觸發）',
  ],
  'Blog 編輯流水線': [
    'blog-intake → outline → pitfall → beginner → visual → editor → seo → ai-quoter → engagement → Insforge DB → 語意索引（bge-m3）',
  ],
};

const CATEGORY_ORDER = ['部署流程', '程式碼品質', '知識載入', 'Blog 編輯流水線'];

// --- Project Skills（靜態，較少變動）---

const PROJECT_SKILLS = [
  {
    label: 'Todo-Dashboard',
    items: [
      { name: 'add-child', desc: '新增子專案資料夾', model: 'haiku' },
      { name: 'rescan', desc: '重掃檔案系統同步 JSON', model: 'haiku' },
    ],
  },
  {
    label: 'brickverse-web',
    items: [
      { name: 'form-integration', desc: '表單整合測試（真實 API）', model: 'haiku' },
      { name: 'test-email', desc: 'Email 測試工具', model: 'haiku' },
      { name: 'insforge', desc: '連接 InsForge 後台', model: 'haiku' },
      { name: 'form-e2e', desc: '表單 E2E 測試（Mock API）', model: 'haiku' },
    ],
  },
];

// --- Types ---

interface SkillInfo {
  name: string;
  description: string;
  model?: string;
  category?: string;
}

interface GroupedSkill {
  label: string;
  items: { name: string; desc: string; model?: string }[];
  relations?: string[];
}

// --- Components ---

export function ModelBadge({ model }: { model: string }) {
  const colors: Record<string, string> = {
    opus: '#a78bfa',
    sonnet: '#d97706',
    haiku: '#22d3ee',
  };
  return (
    <span
      className="text-sm px-1.5 py-0.5 rounded-full font-medium ml-2 shrink-0"
      style={{
        backgroundColor: `${colors[model] || '#94a3b8'}15`,
        color: `${colors[model] || '#94a3b8'}cc`,
        border: `1px solid ${colors[model] || '#94a3b8'}30`,
      }}
    >
      {model}
    </span>
  );
}

function SkillItem({ name, desc, model, copy, isCopied }: { name: string; desc: string; model?: string; copy: (text: string) => void; isCopied: (text: string) => boolean }) {
  const command = `/${name}`;
  const copied = isCopied(command);
  return (
    <div
      className="flex items-center justify-between py-1.5 px-3 cursor-pointer transition-colors duration-150 hover:bg-white/5"
      onClick={() => copy(command)}
      title="點擊複製指令"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-mono shrink-0" style={{ color: 'var(--primary-blue-light)' }}>
          {command}
        </span>
        {copied ? (
          <span className="text-sm text-green-500 shrink-0">已複製！</span>
        ) : (
          <span className="text-sm truncate" style={{ color: 'var(--text-tertiary)' }}>
            {desc}
          </span>
        )}
      </div>
      {model && <ModelBadge model={model} />}
    </div>
  );
}

function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-sm px-2 py-1 rounded-md transition-all duration-200 cursor-pointer border"
      style={{
        color: loading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
        borderColor: 'var(--border-color)',
        backgroundColor: 'transparent',
      }}
      title="從 ~/.claude/skills/ 重新讀取"
    >
      <span className={loading ? 'inline-block animate-spin' : 'inline-block'}>
        ↻
      </span>
    </button>
  );
}

function groupSkills(skills: SkillInfo[]): GroupedSkill[] {
  const groups: Record<string, { name: string; desc: string; model?: string }[]> = {};

  for (const skill of skills) {
    const category = skill.category || '其他';
    if (!groups[category]) groups[category] = [];
    groups[category].push({ name: skill.name, desc: skill.description, model: skill.model });
  }

  // 按定義的順序排列，未知分類排最後
  const orderedLabels = [...CATEGORY_ORDER.filter(c => groups[c]), ...Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c))];

  return orderedLabels.map(label => ({
    label,
    items: groups[label],
    relations: CATEGORY_RELATIONS[label],
  }));
}

// --- Main Component ---

export default function SkillArchitecture() {
  const { copy, isCopied } = useCopyToClipboard(1000);
  const [globalGroups, setGlobalGroups] = useState<GroupedSkill[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/claude-chat/skills');
      const data = await res.json();
      setGlobalGroups(groupSkills(data.globalSkills || []));
    } catch {
      // 失敗時保持現有資料
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const sections = [
    {
      title: 'Global Skill',
      subtitle: '~/.claude/skills/',
      highlight: true,
      groups: globalGroups,
    },
    {
      title: 'Project Skill',
      subtitle: '<project>/.claude/skills/',
      groups: PROJECT_SKILLS.map(g => ({ label: g.label, items: g.items.map(i => ({ name: i.name, desc: i.desc, model: i.model })) })),
    },
  ];

  return (
    <div className="space-y-5">
      {/* 標題 + 重新整理按鈕 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Skill 架構</h2>
        <RefreshButton onClick={fetchSkills} loading={loading} />
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
      {sections.map((section) => (
        <div key={section.title}>
          {/* Section header */}
          <div
            className="px-4 py-3 rounded-t-[var(--radius-medium)] border border-b-0"
            style={{
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="font-semibold text-base">
              {section.title}
            </div>
            <div className="text-sm font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {section.subtitle}
            </div>
          </div>

          {/* Groups */}
          <div
            className="border rounded-b-[var(--radius-medium)] divide-y"
            style={{ borderColor: 'var(--border-color)', divideColor: 'var(--border-color)' } as React.CSSProperties}
          >
            {section.groups.map((group) => (
              <div key={group.label} className="py-2">
                <div className="px-3 pb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {group.label}
                  </span>
                </div>
                {group.label === 'Blog 編輯流水線' ? (
                  <div className="px-3 py-1.5">
                    <div className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      ↳ {group.items.length} 個 Skill（intake → ... → engagement → DB → 語意索引）
                    </div>
                  </div>
                ) : (
                  <>
                    {group.items.map((item) => (
                      <SkillItem key={item.name} name={item.name} desc={item.desc} model={item.model} copy={copy} isCopied={isCopied} />
                    ))}
                    {'relations' in group && group.relations && (
                      <div className="px-3 pt-1 pb-1 space-y-0.5">
                        {group.relations.map((r: string) => (
                          <div key={r} className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
                            ↳ {r}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>

      {/* Built-in */}
      <div
        className="px-3 py-2 rounded-[var(--radius-medium)] border flex items-center justify-between"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Built-in</span>
          <span className="text-sm font-mono" style={{ color: 'var(--primary-blue-light)' }}>/keybindings-help</span>
        </div>
        <span className="text-base" style={{ color: 'var(--text-tertiary)' }}>鍵盤快捷鍵設定</span>
      </div>

    </div>
  );
}
