'use client'

import SubpageShell from '@/components/SubpageShell'
import SkillArchitecture from '@/components/SkillArchitecture'

export default function SkillsPage() {
  return (
    <SubpageShell title="Skills 總覽">
      <div className="px-4 py-4">
        <SkillArchitecture />
      </div>
    </SubpageShell>
  )
}
