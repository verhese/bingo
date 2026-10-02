import { cn } from '@/lib/utils';

interface CallerDisplayProps {
  readonly number: number | null;
  readonly isUndone?: boolean;
  readonly className?: string;
}

export function CallerDisplay({ number, isUndone = false, className }: CallerDisplayProps) {
  const callLabel = isUndone ? 'Undone call' : 'Latest call';
  const ariaLabel = number === null ? 'No number called' : `${callLabel} ${number}`;

  return (
    <div
      className={cn(
        'caller-display',
        isUndone && 'caller-display--undone',
        className,
      )}
    >
      {isUndone && <span className="caller-undone-label">Last call undone</span>}
      <span
        className={cn('caller-value', isUndone && 'caller-value--undone')}
        aria-label={ariaLabel}
        aria-live="polite"
        aria-atomic="true"
      >
        {number ?? '—'}
      </span>
    </div>
  );
}
