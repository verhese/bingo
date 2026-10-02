interface BoardProps {
  readonly maxNumber: number;
  readonly drawnNumbers: readonly number[];
  readonly undoneNumbers?: readonly number[];
  readonly verifiedBingo?: readonly number[] | null;
}

export function Board({ maxNumber, drawnNumbers, undoneNumbers = [], verifiedBingo }: BoardProps) {
  const layoutClass = maxNumber === 90
    ? 'bingo-board--90'
    : maxNumber === 75
      ? 'bingo-board--75'
      : 'bingo-board--speedy';

  return (
    <section className="bingo-board-section" aria-label="Called bingo numbers">
      {verifiedBingo && (
        <div className="bingo-announcement" role="alert">
          <strong>BINGO!</strong>
          <span>Verified winning line: {verifiedBingo.join(', ')}</span>
        </div>
      )}
      <div className={`bingo-board ${layoutClass}`}>
        {Array.from({ length: maxNumber }, (_, i) => i + 1).map((n) => {
          const drawn = drawnNumbers.includes(n);
          const undone = undoneNumbers.includes(n);
          return (
            <span
              key={n}
              className={`bingo-board-cell${drawn ? ' is-drawn' : ''}${undone ? ' is-undone' : ''}`}
              aria-label={undone ? `Number ${n}, call undone` : undefined}
            >
              {n}
            </span>
          );
        })}
      </div>
    </section>
  );
}
