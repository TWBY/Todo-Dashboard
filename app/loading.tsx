export default function Loading() {
  return (
    <div className="flex h-screen">
      <div className="w-1/2 p-8 border-r border-[var(--border-color)] animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-[var(--radius-small)]" style={{ backgroundColor: 'var(--background-tertiary)' }} />
        <div className="h-40 rounded-[var(--radius-large)]" style={{ backgroundColor: 'var(--background-tertiary)' }} />
        <div className="h-32 rounded-[var(--radius-large)]" style={{ backgroundColor: 'var(--background-tertiary)' }} />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-[var(--radius-large)]" style={{ backgroundColor: 'var(--background-tertiary)' }} />
          ))}
        </div>
      </div>
      <div className="w-1/2 p-8 animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-[var(--radius-small)]" style={{ backgroundColor: 'var(--background-tertiary)' }} />
        <div className="h-10 rounded-[var(--radius-small)]" style={{ backgroundColor: 'var(--background-tertiary)' }} />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-[var(--radius-small)]" style={{ backgroundColor: 'var(--background-tertiary)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
