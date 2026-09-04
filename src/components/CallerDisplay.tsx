import { cn } from '@/lib/utils';

interface CallerDisplayProps {
  readonly number: number | null;
  readonly className?: string;
}

export function CallerDisplay({ number, className }: CallerDisplayProps) {
  return (
    <div
      className={cn(
        'caller-display',
        className,
      )}
    >
      <span className="caller-value" aria-live="polite" aria-atomic="true">
        {number ?? '—'}
      </span>
    </div>
  );
}
