export default function PulsingDots({ color = 'var(--text-tertiary)' }: { color?: string }) {
  return (
    <div className="flex gap-1 items-center">
      <span className="chat-wave-dot" style={{ '--dot-color': color, animationDelay: '0ms' } as React.CSSProperties} />
      <span className="chat-wave-dot" style={{ '--dot-color': color, animationDelay: '150ms' } as React.CSSProperties} />
      <span className="chat-wave-dot" style={{ '--dot-color': color, animationDelay: '300ms' } as React.CSSProperties} />
    </div>
  );
}
