'use client'

import { useRouter } from 'next/navigation'
import SkillArchitecture from '@/components/SkillArchitecture'

export default function SkillsPage() {
  const router = useRouter()

  return (
    <div style={{ backgroundColor: 'var(--background-primary)', color: 'var(--text-primary)', minHeight: '100vh' }} className="flex flex-col">
      {/* Header: 固定頂部 */}
      <div style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }} className="sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02]"
            style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', border: '1px solid var(--border-color)' }}
          >
            <i className="fa-solid fa-arrow-left text-xs" />
          </button>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Skills 總覽
          </h1>
        </div>
      </div>

      {/* 主內容 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <SkillArchitecture />
      </div>
    </div>
  )
}
