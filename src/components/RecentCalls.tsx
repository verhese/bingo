interface RecentCallsProps {
  readonly drawnNumbers: readonly number[];
}

export function RecentCalls({ drawnNumbers }: RecentCallsProps) {
  const recentCalls = drawnNumbers.slice(-5).reverse();

  return (
    <section aria-labelledby="recent-calls-title" className="flex flex-col gap-2">
      <h2 id="recent-calls-title" className="font-bold text-bingo-text">Recent calls</h2>
      {recentCalls.length === 0 ? (
        <p className="text-lg text-bingo-muted">No numbers have been called.</p>
      ) : (
        <ol className="flex flex-wrap gap-2" aria-label="Five most recent calls, newest first">
          {recentCalls.map((number) => (
            <li key={number} className="grid h-12 w-12 place-items-center rounded-md border-2 border-bingo-accent bg-bingo-surface text-xl font-bold text-bingo-accent">
              {number}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}