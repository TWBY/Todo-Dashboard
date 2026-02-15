function SubBox({ title, subtitle, className }: { title: string; subtitle: string; className?: string }) {
  return (
    <div
      className={`px-4 py-3 rounded-[var(--radius-medium)] border text-center ${className || ''}`}
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="font-medium text-base">{title}</div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }} dangerouslySetInnerHTML={{ __html: subtitle }} />
    </div>
  );
}

export default function ArchitectureOverview() {
  return (
    <div
      className="space-y-6 pb-6"
    >
      {/* Brickverse 主體區塊 */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-full max-w-md px-5 py-4 rounded-[var(--radius-medium)] border text-center"
          style={{
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="font-semibold text-lg" style={{ color: 'var(--primary-blue-light)' }}>
            brickverse-web
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            主體
          </div>
        </div>

        {/* 向下箭頭 */}
        <div className="flex items-center gap-12">
          <Arrow />
          <Arrow />
        </div>

        {/* Frontend + Learning System */}
        <div className="flex gap-4 w-full max-w-md">
          <SubBox title="BlogFrontend" subtitle="Blog &middot; /blog" className="flex-1" />
          <SubBox title="brickverse-learn" subtitle="/course" className="flex-1" />
        </div>

        {/* Frontend 向下到 Backend */}
        <Arrow />

        <div className="flex items-center gap-3">
          <SubBox title="BlogBackend" subtitle="Blog 後端 &middot; 串接 Insforge" />
        </div>
      </div>

    </div>
  );
}

function Arrow() {
  return (
    <svg
      width="16"
      height="20"
      viewBox="0 0 16 20"
      fill="none"
      stroke="var(--text-tertiary)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="0" x2="8" y2="16" />
      <polyline points="4,12 8,18 12,12" />
    </svg>
  );
}
