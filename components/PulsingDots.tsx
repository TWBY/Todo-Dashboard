export default function PulsingDots({ color = 'var(--text-tertiary)' }: { color?: string }) {
  return (
    <div className="flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color, animationDelay: '0ms', animationDuration: '1.4s' }} />
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color, animationDelay: '200ms', animationDuration: '1.4s' }} />
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color, animationDelay: '400ms', animationDuration: '1.4s' }} />
    </div>
  );
}
